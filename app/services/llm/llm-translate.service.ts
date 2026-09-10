import { GeneralConsts } from '../../utils/constants';
import { SettingsService } from '../settings.service';
import {
  buildTranslateSystemPrompt,
  isTranslateTargetEnabled,
  joinOcrText,
  mapOcrLangToSource,
  normalizeTranslateTarget,
  temperaturePrefToApi
} from '../../../src/app/core/utils/llm-translate.prompts';
import type { LlmTranslateMode } from '../../../src/app/core/models/enums/ai-enums';
import { OpenRouterError } from './openrouter-client';
import { OpenAiCompatError } from './openai-compat-client';
import { llmProviderRouter } from './llm-provider-router';

export interface LlmTranslateRequest {
  text?: string;
  blocks?: string[];
  mode: LlmTranslateMode;
  /** OCR lang code (jpn, eng, …) or source hint. */
  sourceLang?: string;
  /** PORTUGUESE | ENGLISH | OFF — if omitted, read from settings. */
  targetLang?: string;
  model?: string;
  temperature?: number;
}

export interface LlmTranslateResult {
  text: string;
  mode: LlmTranslateMode;
  model: string;
}

export interface LlmStatus {
  enabled: boolean;
  hasKey: boolean;
  targetLang: string;
  provider: string;
  ready: boolean;
}

export class LlmTranslateService {
  resolveApiKey(): string {
    return llmProviderRouter.resolveEndpoint().apiKey;
  }

  status(): LlmStatus {
    const prefs = SettingsService.instance;
    const enabled = !!prefs.get(GeneralConsts.KEYS.LLM.ENABLED, false);
    const targetLang = normalizeTranslateTarget(
      prefs.get(GeneralConsts.KEYS.SUBTITLE.TRANSLATE, 'PORTUGUESE')
    );
    const ep = llmProviderRouter.resolveEndpoint();
    const ready =
      ep.provider === 'openrouter' ? !!ep.apiKey : !!ep.baseUrl;
    return {
      enabled,
      hasKey: !!ep.apiKey || ep.provider !== 'openrouter',
      targetLang,
      provider: ep.provider,
      ready
    };
  }

  async translate(req: LlmTranslateRequest): Promise<LlmTranslateResult> {
    const prefs = SettingsService.instance;
    const enabled = !!prefs.get(GeneralConsts.KEYS.LLM.ENABLED, false);
    if (!enabled) {
      throw new OpenRouterError('Recursos de IA desativados nas configurações', undefined, 'api');
    }

    const target = normalizeTranslateTarget(
      req.targetLang ?? prefs.get(GeneralConsts.KEYS.SUBTITLE.TRANSLATE, 'PORTUGUESE')
    );
    if (!isTranslateTargetEnabled(target)) {
      throw new OpenRouterError('Tradução desativada (idioma-alvo = OFF)', undefined, 'api');
    }

    const text = joinOcrText(req.text || '', req.blocks);
    if (!text) {
      throw new OpenRouterError('Nenhum texto OCR para traduzir', undefined, 'empty');
    }

    const mode: LlmTranslateMode = req.mode === 'interpret' ? 'interpret' : 'literal';
    const model = (
      req.model ||
      llmProviderRouter.resolveModel(mode === 'interpret' ? 'manga_interpret' : 'manga')
    ).trim();

    const tempPref =
      typeof req.temperature === 'number'
        ? req.temperature
        : Number(prefs.get(GeneralConsts.KEYS.LLM.TEMPERATURE, GeneralConsts.KEYS.LLM.DEFAULT_TEMPERATURE));
    const temperature = temperaturePrefToApi(tempPref);

    const source = mapOcrLangToSource(req.sourceLang || 'jpn');
    const system = buildTranslateSystemPrompt(mode, source, target);
    const ep = llmProviderRouter.resolveEndpoint();
    if (ep.provider === 'openrouter' && !ep.apiKey) {
      throw new OpenRouterError('Chave OpenRouter ausente', 401, 'unauthorized');
    }

    try {
      const out = await llmProviderRouter.chat({
        model,
        temperature,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text }
        ]
      });
      return { text: out, mode, model };
    } catch (e: any) {
      if (e instanceof OpenRouterError || e instanceof OpenAiCompatError) throw e;
      throw new OpenRouterError(e?.message || 'Falha na tradução LLM', undefined, 'api');
    }
  }
}
