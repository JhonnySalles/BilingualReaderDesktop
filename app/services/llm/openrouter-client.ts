export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: 'unauthorized' | 'rate_limit' | 'network' | 'empty' | 'api'
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

export type OpenRouterContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenRouterContentPart[];
}

export interface OpenRouterChatInput {
  apiKey: string;
  model: string;
  temperature: number;
  messages: OpenRouterMessage[];
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface OpenRouterModelInfo {
  id: string;
  name: string;
  hasVision: boolean;
  isFree: boolean;
}

interface OpenRouterChatResponse {
  choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }>;
  error?: { message?: string };
}

const OR_HEADERS = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': 'https://github.com/JhonnySalles/BilingualMangaReader',
  'X-Title': 'BilingualReader Desktop'
});

function assertKeyModel(apiKey: string, model: string): void {
  if (!apiKey.trim()) {
    throw new OpenRouterError('Chave OpenRouter ausente', 401, 'unauthorized');
  }
  if (!model.trim()) {
    throw new OpenRouterError('Modelo LLM não configurado', undefined, 'api');
  }
}

async function throwForHttp(res: Response): Promise<never> {
  let body: OpenRouterChatResponse = {};
  try {
    body = (await res.json()) as OpenRouterChatResponse;
  } catch {
    body = {};
  }
  if (res.status === 401 || res.status === 403) {
    throw new OpenRouterError(body.error?.message || 'Chave OpenRouter inválida', res.status, 'unauthorized');
  }
  if (res.status === 429) {
    throw new OpenRouterError(body.error?.message || 'Limite de taxa OpenRouter', res.status, 'rate_limit');
  }
  throw new OpenRouterError(
    body.error?.message || `OpenRouter HTTP ${res.status}`,
    res.status,
    'api'
  );
}

export async function openRouterChatCompletion(input: OpenRouterChatInput): Promise<string> {
  assertKeyModel(input.apiKey, input.model);

  let res: Response;
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: OR_HEADERS(input.apiKey.trim()),
      body: JSON.stringify({
        model: input.model.trim(),
        temperature: input.temperature,
        max_tokens: input.maxTokens ?? 1024,
        messages: input.messages
      }),
      signal: input.signal
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new OpenRouterError(e?.message || 'Falha de rede ao chamar OpenRouter', undefined, 'network');
  }

  if (!res.ok) await throwForHttp(res);

  let body: OpenRouterChatResponse = {};
  try {
    body = (await res.json()) as OpenRouterChatResponse;
  } catch {
    body = {};
  }

  const text = (body.choices?.[0]?.message?.content || '').trim();
  if (!text) {
    throw new OpenRouterError('Resposta vazia do modelo', res.status, 'empty');
  }
  return text;
}

export async function openRouterChatCompletionStream(
  input: OpenRouterChatInput,
  onChunk: (delta: string) => void
): Promise<string> {
  assertKeyModel(input.apiKey, input.model);

  let res: Response;
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: OR_HEADERS(input.apiKey.trim()),
      body: JSON.stringify({
        model: input.model.trim(),
        temperature: input.temperature,
        max_tokens: input.maxTokens ?? 1024,
        stream: true,
        messages: input.messages
      }),
      signal: input.signal
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new OpenRouterError(e?.message || 'Falha de rede ao chamar OpenRouter', undefined, 'network');
  }

  if (!res.ok) await throwForHttp(res);

  if (!res.body) {
    throw new OpenRouterError('Resposta sem corpo (stream)', res.status, 'empty');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data) as OpenRouterChatResponse;
        const delta = parsed.choices?.[0]?.delta?.content || '';
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      } catch {
        /* ignore partial JSON */
      }
    }
  }

  if (!full.trim()) {
    throw new OpenRouterError('Resposta vazia do modelo', res.status, 'empty');
  }
  return full;
}

export async function listOpenRouterModels(apiKey: string): Promise<OpenRouterModelInfo[]> {
  const key = apiKey.trim();
  if (!key) throw new OpenRouterError('Chave OpenRouter ausente', 401, 'unauthorized');

  let res: Response;
  try {
    res = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: OR_HEADERS(key)
    });
  } catch (e: any) {
    throw new OpenRouterError(e?.message || 'Falha de rede ao listar modelos', undefined, 'network');
  }
  if (!res.ok) await throwForHttp(res);

  const json = (await res.json()) as {
    data?: Array<{
      id?: string;
      name?: string;
      architecture?: { modality?: string; input_modalities?: string[] };
      pricing?: { prompt?: string; completion?: string };
    }>;
  };

  const out: OpenRouterModelInfo[] = [];
  const seen = new Set<string>();
  for (const m of json.data || []) {
    const id = String(m.id || '').trim();
    if (!id || seen.has(id)) continue;
    const prompt = String(m.pricing?.prompt ?? '1');
    const completion = String(m.pricing?.completion ?? '1');
    const isFree = (prompt === '0' && completion === '0') || id === 'openrouter/free' || id.includes(':free');
    if (!isFree && id !== 'openrouter/free') continue;
    const modality = String(m.architecture?.modality || '').toLowerCase();
    const inputs = m.architecture?.input_modalities || [];
    const hasVision =
      modality.includes('image') ||
      inputs.some(x => String(x).toLowerCase().includes('image'));
    seen.add(id);
    out.push({
      id,
      name: String(m.name || id),
      hasVision,
      isFree: true
    });
  }

  if (!seen.has('openrouter/free')) {
    out.unshift({ id: 'openrouter/free', name: 'OpenRouter Free', hasVision: false, isFree: true });
  }

  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export function buildVisionUserContent(
  text: string,
  imagesBase64: string[]
): string | OpenRouterContentPart[] {
  const imgs = (imagesBase64 || []).filter(Boolean).slice(0, 8);
  if (!imgs.length) return text;
  const parts: OpenRouterContentPart[] = [{ type: 'text', text }];
  for (const b64 of imgs) {
    const url = b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
    parts.push({ type: 'image_url', image_url: { url } });
  }
  return parts;
}
