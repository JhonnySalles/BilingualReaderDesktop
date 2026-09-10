/** Shared OpenAI-compatible chat client (Ollama, LM Studio, and similar). */

export class OpenAiCompatError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: 'unauthorized' | 'rate_limit' | 'network' | 'empty' | 'api'
  ) {
    super(message);
    this.name = 'OpenAiCompatError';
  }
}

export type OpenAiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface OpenAiCompatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenAiContentPart[];
}

export interface OpenAiCompatChatInput {
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature: number;
  messages: OpenAiCompatMessage[];
  maxTokens?: number;
  signal?: AbortSignal;
  /** Extra headers (e.g. OpenRouter Referer). */
  extraHeaders?: Record<string, string>;
  /** When true, require a non-empty API key. */
  requireApiKey?: boolean;
}

export interface OpenAiCompatModelInfo {
  id: string;
  name: string;
  hasVision: boolean;
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }>;
  error?: { message?: string };
}

function normalizeBaseUrl(baseUrl: string): string {
  return String(baseUrl || '')
    .trim()
    .replace(/\/+$/, '');
}

function buildHeaders(apiKey: string | undefined, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra || {})
  };
  const key = (apiKey || '').trim();
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

async function throwForHttp(res: Response): Promise<never> {
  let body: ChatResponse = {};
  try {
    body = (await res.json()) as ChatResponse;
  } catch {
    body = {};
  }
  if (res.status === 401 || res.status === 403) {
    throw new OpenAiCompatError(body.error?.message || 'Não autorizado', res.status, 'unauthorized');
  }
  if (res.status === 429) {
    throw new OpenAiCompatError(body.error?.message || 'Limite de taxa', res.status, 'rate_limit');
  }
  throw new OpenAiCompatError(
    body.error?.message || `HTTP ${res.status}`,
    res.status,
    'api'
  );
}

function assertModel(model: string): void {
  if (!model.trim()) {
    throw new OpenAiCompatError('Modelo LLM não configurado', undefined, 'api');
  }
}

export async function openAiCompatChatCompletion(input: OpenAiCompatChatInput): Promise<string> {
  const base = normalizeBaseUrl(input.baseUrl);
  if (!base) throw new OpenAiCompatError('Base URL ausente', undefined, 'api');
  assertModel(input.model);
  if (input.requireApiKey && !(input.apiKey || '').trim()) {
    throw new OpenAiCompatError('API key ausente', 401, 'unauthorized');
  }

  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(input.apiKey, input.extraHeaders),
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
    throw new OpenAiCompatError(e?.message || 'Falha de rede', undefined, 'network');
  }

  if (!res.ok) await throwForHttp(res);

  let body: ChatResponse = {};
  try {
    body = (await res.json()) as ChatResponse;
  } catch {
    body = {};
  }

  const text = (body.choices?.[0]?.message?.content || '').trim();
  if (!text) {
    throw new OpenAiCompatError('Resposta vazia do modelo', res.status, 'empty');
  }
  return text;
}

export async function openAiCompatChatCompletionStream(
  input: OpenAiCompatChatInput,
  onChunk: (delta: string) => void
): Promise<string> {
  const base = normalizeBaseUrl(input.baseUrl);
  if (!base) throw new OpenAiCompatError('Base URL ausente', undefined, 'api');
  assertModel(input.model);
  if (input.requireApiKey && !(input.apiKey || '').trim()) {
    throw new OpenAiCompatError('API key ausente', 401, 'unauthorized');
  }

  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(input.apiKey, input.extraHeaders),
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
    throw new OpenAiCompatError(e?.message || 'Falha de rede', undefined, 'network');
  }

  if (!res.ok) await throwForHttp(res);
  if (!res.body) {
    throw new OpenAiCompatError('Resposta sem corpo (stream)', res.status, 'empty');
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
        const parsed = JSON.parse(data) as ChatResponse;
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
    throw new OpenAiCompatError('Resposta vazia do modelo', res.status, 'empty');
  }
  return full;
}

export async function openAiCompatListModels(
  baseUrl: string,
  apiKey?: string,
  extraHeaders?: Record<string, string>
): Promise<OpenAiCompatModelInfo[]> {
  const base = normalizeBaseUrl(baseUrl);
  if (!base) throw new OpenAiCompatError('Base URL ausente', undefined, 'api');

  let res: Response;
  try {
    res = await fetch(`${base}/models`, {
      method: 'GET',
      headers: buildHeaders(apiKey, extraHeaders)
    });
  } catch (e: any) {
    throw new OpenAiCompatError(e?.message || 'Falha de rede ao listar modelos', undefined, 'network');
  }
  if (!res.ok) await throwForHttp(res);

  const json = (await res.json()) as {
    data?: Array<{
      id?: string;
      name?: string;
      owned_by?: string;
    }>;
  };

  const out: OpenAiCompatModelInfo[] = [];
  const seen = new Set<string>();
  for (const m of json.data || []) {
    const id = String(m.id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name = String(m.name || id);
    const lower = `${id} ${name}`.toLowerCase();
    const hasVision =
      lower.includes('vision') ||
      lower.includes('llava') ||
      lower.includes('gpt-4o') ||
      lower.includes('gemini') ||
      lower.includes('qwen2-vl') ||
      lower.includes('minicpm-v');
    out.push({ id, name, hasVision });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export function buildOpenAiVisionUserContent(
  text: string,
  imagesBase64: string[]
): string | OpenAiContentPart[] {
  const imgs = (imagesBase64 || []).filter(Boolean).slice(0, 8);
  if (!imgs.length) return text;
  const parts: OpenAiContentPart[] = [{ type: 'text', text }];
  for (const b64 of imgs) {
    const url = b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
    parts.push({ type: 'image_url', image_url: { url } });
  }
  return parts;
}
