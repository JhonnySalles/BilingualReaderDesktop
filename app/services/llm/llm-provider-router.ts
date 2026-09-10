import { SettingsService } from '../settings.service';
import { Secrets } from '../../utils/secrets';
import { GeneralConsts } from '../../utils/constants';
import {
  OpenAiCompatError,
  OpenAiCompatMessage,
  OpenAiCompatModelInfo,
  openAiCompatChatCompletion,
  openAiCompatChatCompletionStream,
  openAiCompatListModels
} from './openai-compat-client';
import {
  OpenRouterError,
  listOpenRouterModels,
  openRouterChatCompletion,
  openRouterChatCompletionStream,
  type OpenRouterMessage,
  type OpenRouterModelInfo
} from './openrouter-client';

export type LlmProviderId = 'openrouter' | 'ollama' | 'lm_studio';

export interface LlmEndpoint {
  provider: LlmProviderId;
  baseUrl: string;
  apiKey: string;
  requireApiKey: boolean;
  extraHeaders?: Record<string, string>;
}

export interface LlmChatParams {
  model: string;
  temperature: number;
  messages: OpenAiCompatMessage[] | OpenRouterMessage[];
  maxTokens?: number;
  signal?: AbortSignal;
}

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const OLLAMA_DEFAULT = 'http://127.0.0.1:11434/v1';
const LM_STUDIO_DEFAULT = 'http://127.0.0.1:1234/v1';

function prefs() {
  return SettingsService.instance;
}

function K() {
  return GeneralConsts.KEYS.LLM;
}

export function normalizeLlmProvider(raw: unknown): LlmProviderId {
  const v = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (v === 'ollama') return 'ollama';
  if (v === 'lm_studio' || v === 'lmstudio') return 'lm_studio';
  if (v === 'openrouter' || v === 'auto' || !v) return 'openrouter';
  return 'openrouter';
}

export class LlmProviderRouter {
  getActiveProvider(): LlmProviderId {
    return normalizeLlmProvider(prefs().get(K().PROVIDER, K().DEFAULT_PROVIDER));
  }

  resolveEndpoint(providerOverride?: LlmProviderId): LlmEndpoint {
    const provider = providerOverride || this.getActiveProvider();
    if (provider === 'ollama') {
      const baseUrl = String(prefs().get(K().OLLAMA_BASE_URL, OLLAMA_DEFAULT) || OLLAMA_DEFAULT).trim();
      const apiKey = String(prefs().get(K().OLLAMA_API_KEY, '') || '').trim();
      return { provider, baseUrl: baseUrl || OLLAMA_DEFAULT, apiKey, requireApiKey: false };
    }
    if (provider === 'lm_studio') {
      const baseUrl = String(
        prefs().get(K().LM_STUDIO_BASE_URL, LM_STUDIO_DEFAULT) || LM_STUDIO_DEFAULT
      ).trim();
      const apiKey = String(prefs().get(K().LM_STUDIO_API_KEY, '') || '').trim();
      return { provider, baseUrl: baseUrl || LM_STUDIO_DEFAULT, apiKey, requireApiKey: false };
    }
    const fromPrefs = String(prefs().get(K().OPENROUTER_API_KEY, '') || '').trim();
    const apiKey = fromPrefs || Secrets.instance.getOpenRouterApiKey().trim();
    return {
      provider: 'openrouter',
      baseUrl: OPENROUTER_BASE,
      apiKey,
      requireApiKey: true,
      extraHeaders: {
        'HTTP-Referer': 'https://github.com/JhonnySalles/BilingualMangaReader',
        'X-Title': 'BilingualReader Desktop'
      }
    };
  }

  isLocalProvider(provider?: LlmProviderId): boolean {
    const p = provider || this.getActiveProvider();
    return p === 'ollama' || p === 'lm_studio';
  }

  resolveModel(
    kind: 'book_qa' | 'book_summary' | 'manga' | 'manga_interpret',
    providerOverride?: LlmProviderId
  ): string {
    const provider = providerOverride || this.getActiveProvider();
    const local = this.isLocalProvider(provider);
    if (local) {
      if (kind === 'book_summary') {
        return String(prefs().get(K().BOOK_LOCAL_MODEL_SUMMARY, '') || '').trim() ||
          String(prefs().get(K().BOOK_LOCAL_MODEL, '') || '').trim() ||
          'llama3.2';
      }
      if (kind === 'manga_interpret') {
        return (
          String(prefs().get(K().MANGA_LOCAL_MODEL, '') || '').trim() ||
          String(prefs().get(K().BOOK_LOCAL_MODEL, '') || '').trim() ||
          'llama3.2'
        );
      }
      if (kind === 'manga') {
        return String(prefs().get(K().MANGA_LOCAL_MODEL, '') || '').trim() || 'llama3.2';
      }
      return String(prefs().get(K().BOOK_LOCAL_MODEL, '') || '').trim() || 'llama3.2';
    }
    if (kind === 'book_summary') {
      return String(
        prefs().get(K().BOOK_OPENROUTER_MODEL_SUMMARY, K().DEFAULT_OPENROUTER_MODEL) ||
          K().DEFAULT_OPENROUTER_MODEL
      );
    }
    if (kind === 'manga_interpret') {
      const def = String(
        prefs().get(K().MANGA_OPENROUTER_MODEL, K().DEFAULT_OPENROUTER_MODEL) ||
          K().DEFAULT_OPENROUTER_MODEL
      );
      return String(prefs().get(K().MANGA_INTERPRET_MODEL, def) || def);
    }
    if (kind === 'manga') {
      return String(
        prefs().get(K().MANGA_OPENROUTER_MODEL, K().DEFAULT_OPENROUTER_MODEL) ||
          K().DEFAULT_OPENROUTER_MODEL
      );
    }
    return String(
      prefs().get(K().BOOK_OPENROUTER_MODEL, K().DEFAULT_OPENROUTER_MODEL) ||
        K().DEFAULT_OPENROUTER_MODEL
    );
  }

  async chat(params: LlmChatParams, providerOverride?: LlmProviderId): Promise<string> {
    const ep = this.resolveEndpoint(providerOverride);
    if (ep.provider === 'openrouter') {
      return openRouterChatCompletion({
        apiKey: ep.apiKey,
        model: params.model,
        temperature: params.temperature,
        messages: params.messages as OpenRouterMessage[],
        maxTokens: params.maxTokens,
        signal: params.signal
      });
    }
    return openAiCompatChatCompletion({
      baseUrl: ep.baseUrl,
      apiKey: ep.apiKey,
      model: params.model,
      temperature: params.temperature,
      messages: params.messages as OpenAiCompatMessage[],
      maxTokens: params.maxTokens,
      signal: params.signal,
      requireApiKey: ep.requireApiKey
    });
  }

  async chatStream(
    params: LlmChatParams,
    onChunk: (delta: string) => void,
    providerOverride?: LlmProviderId
  ): Promise<string> {
    const ep = this.resolveEndpoint(providerOverride);
    if (ep.provider === 'openrouter') {
      return openRouterChatCompletionStream(
        {
          apiKey: ep.apiKey,
          model: params.model,
          temperature: params.temperature,
          messages: params.messages as OpenRouterMessage[],
          maxTokens: params.maxTokens,
          signal: params.signal
        },
        onChunk
      );
    }
    return openAiCompatChatCompletionStream(
      {
        baseUrl: ep.baseUrl,
        apiKey: ep.apiKey,
        model: params.model,
        temperature: params.temperature,
        messages: params.messages as OpenAiCompatMessage[],
        maxTokens: params.maxTokens,
        signal: params.signal,
        requireApiKey: ep.requireApiKey
      },
      onChunk
    );
  }

  async listModels(providerOverride?: LlmProviderId): Promise<
    Array<{ id: string; name: string; hasVision: boolean; isFree?: boolean }>
  > {
    const ep = this.resolveEndpoint(providerOverride);
    if (ep.provider === 'openrouter') {
      const models: OpenRouterModelInfo[] = await listOpenRouterModels(ep.apiKey);
      return models.map(m => ({
        id: m.id,
        name: m.name,
        hasVision: m.hasVision,
        isFree: m.isFree
      }));
    }
    const models: OpenAiCompatModelInfo[] = await openAiCompatListModels(ep.baseUrl, ep.apiKey);
    return models.map(m => ({ id: m.id, name: m.name, hasVision: m.hasVision }));
  }

  async testConnection(providerOverride?: LlmProviderId): Promise<{
    ok: boolean;
    models?: number;
    error?: string;
    provider: LlmProviderId;
  }> {
    const ep = this.resolveEndpoint(providerOverride);
    try {
      if (ep.provider === 'openrouter' && !ep.apiKey) {
        return {
          ok: false,
          error: 'Nenhuma chave OpenRouter configurada (settings ou .env)',
          provider: ep.provider
        };
      }
      const models = await this.listModels(ep.provider);
      return { ok: true, models: models.length, provider: ep.provider };
    } catch (e: any) {
      const msg =
        e instanceof OpenAiCompatError || e instanceof OpenRouterError
          ? e.message
          : e?.message || String(e);
      return { ok: false, error: msg, provider: ep.provider };
    }
  }

  /** Test an arbitrary local base URL (settings card). */
  async testLocalEndpoint(
    baseUrl: string,
    apiKey?: string
  ): Promise<{ ok: boolean; models?: number; error?: string }> {
    try {
      const models = await openAiCompatListModels(baseUrl, apiKey);
      return { ok: true, models: models.length };
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) };
    }
  }

  async listLocalModels(
    baseUrl: string,
    apiKey?: string
  ): Promise<{ ok: boolean; models: OpenAiCompatModelInfo[]; error?: string }> {
    try {
      const models = await openAiCompatListModels(baseUrl, apiKey);
      return { ok: true, models };
    } catch (e: any) {
      return { ok: false, models: [], error: e?.message || String(e) };
    }
  }
}

export const llmProviderRouter = new LlmProviderRouter();
