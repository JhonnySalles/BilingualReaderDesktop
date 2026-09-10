export enum AssistantMessage {
  SYSTEM = 'SYSTEM',
  USER = 'USER',
  ASSISTANT = 'ASSISTANT'
}

export enum LlmProvider {
  OPENAI = 'OPENAI',
  GEMINI = 'GEMINI',
  OLLAMA = 'OLLAMA',
  LM_STUDIO = 'LM_STUDIO',
  CLAUDE = 'CLAUDE',
  DEEPSEEK = 'DEEPSEEK',
  OPENROUTER = 'OPENROUTER'
}

export type LlmProviderSetting = 'openrouter' | 'ollama' | 'lm_studio';

/** Target language for OCR/subtitle machine translation. */
export type SubtitleTranslateTarget = 'PORTUGUESE' | 'ENGLISH' | 'OFF';

export type LlmTranslateMode = 'literal' | 'interpret';

export const LLM_MANGA_MODEL_OPTIONS = [
  'openrouter/free',
  'google/gemini-2.5-flash',
  'anthropic/claude-3.5-sonnet',
  'openai/gpt-4o-mini',
  'deepseek/deepseek-chat'
] as const;

export enum LlmUse {
  TRANSLATION = 'TRANSLATION',
  EXPLANATION = 'EXPLANATION',
  DICTIONARY = 'DICTIONARY',
  CHAT = 'CHAT'
}

export { TextSpeech, AudioStatus } from './tts-enums';
