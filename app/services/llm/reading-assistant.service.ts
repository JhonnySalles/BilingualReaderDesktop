import { nativeImage } from 'electron';
import * as fs from 'fs';
import { SettingsService } from '../settings.service';
import { GeneralConsts } from '../../utils/constants';
import {
  AssistantContentType,
  AssistantHistoryRow
} from '../../database/assistant-history.repository';
import { StorageService } from '../../database/storage.service';
import { MangaReaderSessionService } from '../manga-reader-session.service';
import {
  OpenRouterError,
  OpenRouterMessage,
  buildVisionUserContent
} from './openrouter-client';
import { OpenAiCompatError } from './openai-compat-client';
import {
  LlmProviderId,
  llmProviderRouter,
  normalizeLlmProvider
} from './llm-provider-router';
import { temperaturePrefToApi } from '../../../src/app/core/utils/llm-translate.prompts';
import {
  AssistantReplyLanguage,
  buildQaSystemPrompt,
  buildQaUserPrompt,
  buildSummarySystemPrompt,
  buildSummaryUserPrompt,
  trimChatHistory
} from '../../../src/app/core/utils/llm-assistant.prompts';
import { AssistantMessage } from '../../../src/app/core/models/enums/ai-enums';

export interface AssistantAskInput {
  type: AssistantContentType;
  referenceId: number;
  title: string;
  question: string;
  contextText: string;
  imagesBase64?: string[];
  model?: string | null;
  mode?: 'qa' | 'summary';
  language?: AssistantReplyLanguage;
  requestId: string;
}

export class ReadingAssistantService {
  private aborts = new Map<string, AbortController>();

  constructor(
    private storage: StorageService,
    private mangaSessions?: MangaReaderSessionService
  ) {}

  get history() {
    return this.storage.assistantHistoryRepository;
  }

  getActiveProvider(): LlmProviderId {
    return llmProviderRouter.getActiveProvider();
  }

  /** True when the active provider is ready to accept requests. */
  isReady(): { ready: boolean; provider: LlmProviderId; reason?: string } {
    const provider = this.getActiveProvider();
    const ep = llmProviderRouter.resolveEndpoint(provider);
    if (provider === 'openrouter') {
      if (!ep.apiKey) {
        return { ready: false, provider, reason: 'Chave OpenRouter ausente' };
      }
      return { ready: true, provider };
    }
    if (!ep.baseUrl) {
      return { ready: false, provider, reason: 'Base URL local ausente' };
    }
    return { ready: true, provider };
  }

  resolveApiKey(): string {
    return llmProviderRouter.resolveEndpoint().apiKey;
  }

  isEnabled(): boolean {
    return !!SettingsService.instance.get(GeneralConsts.KEYS.LLM.ENABLED, false);
  }

  getMaxContextChars(): number {
    const n = Number(
      SettingsService.instance.get(
        GeneralConsts.KEYS.LLM.MAX_CONTEXT_CHARS,
        GeneralConsts.KEYS.LLM.DEFAULT_MAX_CONTEXT_CHARS
      )
    );
    return Number.isFinite(n) && n > 0 ? n : GeneralConsts.KEYS.LLM.DEFAULT_MAX_CONTEXT_CHARS;
  }

  getMaxHistoryChars(): number {
    const n = Number(
      SettingsService.instance.get(
        GeneralConsts.KEYS.LLM.MAX_HISTORY_CHARS,
        GeneralConsts.KEYS.LLM.DEFAULT_MAX_HISTORY_CHARS
      )
    );
    return Number.isFinite(n) && n > 0 ? n : GeneralConsts.KEYS.LLM.DEFAULT_MAX_HISTORY_CHARS;
  }

  getTemperatureApi(): number {
    const pref = Number(
      SettingsService.instance.get(
        GeneralConsts.KEYS.LLM.TEMPERATURE,
        GeneralConsts.KEYS.LLM.DEFAULT_TEMPERATURE
      )
    );
    return temperaturePrefToApi(pref);
  }

  resolveModel(type: AssistantContentType, mode: 'qa' | 'summary', override?: string | null): string {
    if (override && override.trim()) return override.trim();
    if (type === 'BOOK' && mode === 'summary') {
      return llmProviderRouter.resolveModel('book_summary');
    }
    if (type === 'BOOK') {
      return llmProviderRouter.resolveModel('book_qa');
    }
    return llmProviderRouter.resolveModel('manga');
  }

  selectionKey(type: AssistantContentType, referenceId: number): string {
    return `${GeneralConsts.KEYS.LLM.SELECTION_PREFIX}${type}_${referenceId}`;
  }

  getSelection(type: AssistantContentType, referenceId: number): string {
    return String(SettingsService.instance.get(this.selectionKey(type, referenceId), '') || '');
  }

  setSelection(type: AssistantContentType, referenceId: number, value: string): void {
    SettingsService.instance.set(this.selectionKey(type, referenceId), value || '');
  }

  listHistory(referenceId: number, type: AssistantContentType): AssistantHistoryRow[] {
    return this.history.list(referenceId, type);
  }

  clearHistory(referenceId: number, type: AssistantContentType): number {
    return this.history.clear(referenceId, type);
  }

  cancel(requestId: string): boolean {
    const ctrl = this.aborts.get(requestId);
    if (!ctrl) return false;
    ctrl.abort();
    this.aborts.delete(requestId);
    return true;
  }

  async listModels(providerOverride?: string) {
    const provider = providerOverride
      ? normalizeLlmProvider(providerOverride)
      : undefined;
    return llmProviderRouter.listModels(provider);
  }

  /**
   * Encode manga page images as JPEG base64 (max dim ~800).
   */
  encodeMangaPageImages(sessionId: string, pages: number[]): string[] {
    if (!this.mangaSessions) return [];
    const out: string[] = [];
    for (const page of pages.slice(0, 8)) {
      const abs = this.mangaSessions.resolvePageAbsolutePath(sessionId, page);
      if (!abs || !fs.existsSync(abs)) continue;
      try {
        let img = nativeImage.createFromPath(abs);
        if (img.isEmpty()) continue;
        const size = img.getSize();
        const max = 800;
        if (size.width > max || size.height > max) {
          const scale = Math.min(max / size.width, max / size.height);
          img = img.resize({
            width: Math.max(1, Math.round(size.width * scale)),
            height: Math.max(1, Math.round(size.height * scale)),
            quality: 'better'
          });
        }
        const jpeg = img.toJPEG(65);
        out.push(Buffer.from(jpeg).toString('base64'));
      } catch (e) {
        console.warn('[assistant] page image encode failed', page, e);
      }
    }
    return out;
  }

  async ask(
    input: AssistantAskInput,
    onChunk: (delta: string) => void
  ): Promise<{ ok: true; text: string; model: string } | { ok: false; error: string; code?: string }> {
    if (!this.isEnabled()) {
      return { ok: false, error: 'IA desativada nas configurações', code: 'disabled' };
    }
    const ready = this.isReady();
    if (!ready.ready) {
      return {
        ok: false,
        error: ready.reason || 'Provedor LLM não pronto',
        code: ready.provider === 'openrouter' ? 'unauthorized' : 'network'
      };
    }

    const mode = input.mode === 'summary' ? 'summary' : 'qa';
    const language: AssistantReplyLanguage = input.language || 'Portuguese';
    const model = this.resolveModel(input.type, mode, input.model);
    const maxCtx = this.getMaxContextChars();
    const maxHist = this.getMaxHistoryChars();

    const messages: OpenRouterMessage[] = [];
    if (mode === 'summary') {
      messages.push({ role: 'system', content: buildSummarySystemPrompt(language) });
      messages.push({
        role: 'user',
        content: buildSummaryUserPrompt(input.title || 'Obra', input.contextText || '', maxCtx)
      });
    } else {
      messages.push({
        role: 'system',
        content: buildQaSystemPrompt(input.type, input.title || 'Obra', language)
      });

      const prior = this.history
        .list(input.referenceId, input.type)
        .filter(h => h.role === AssistantMessage.USER || h.role === AssistantMessage.ASSISTANT)
        .map(h => ({
          role: (h.role === AssistantMessage.USER ? 'user' : 'assistant') as 'user' | 'assistant',
          content: h.message
        }));
      const trimmed = trimChatHistory(prior, 4, maxHist);
      for (const m of trimmed) {
        messages.push({ role: m.role, content: m.content });
      }

      const userText = buildQaUserPrompt(input.contextText || '', input.question || '', maxCtx);
      const content = buildVisionUserContent(userText, input.imagesBase64 || []);
      messages.push({ role: 'user', content });
    }

    const ctrl = new AbortController();
    this.aborts.set(input.requestId, ctrl);

    try {
      const text = await llmProviderRouter.chatStream(
        {
          model,
          temperature: this.getTemperatureApi(),
          messages,
          signal: ctrl.signal
        },
        onChunk
      );

      if (mode === 'qa') {
        this.history.append({
          idReference: input.referenceId,
          type: input.type,
          role: AssistantMessage.USER,
          message: input.question,
          date: new Date().toISOString()
        });
        this.history.append({
          idReference: input.referenceId,
          type: input.type,
          role: AssistantMessage.ASSISTANT,
          message: text,
          date: new Date().toISOString()
        });
      }

      return { ok: true, text, model };
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        return { ok: false, error: 'Cancelado', code: 'aborted' };
      }
      const err =
        e instanceof OpenRouterError || e instanceof OpenAiCompatError
          ? e
          : new OpenRouterError(e?.message || 'Falha no assistente', undefined, 'api');
      return { ok: false, error: err.message, code: err.code };
    } finally {
      this.aborts.delete(input.requestId);
    }
  }
}
