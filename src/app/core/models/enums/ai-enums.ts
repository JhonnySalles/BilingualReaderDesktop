export enum AssistantMessage {
  SYSTEM = 'SYSTEM',
  USER = 'USER',
  ASSISTANT = 'ASSISTANT'
}

export enum LlmProvider {
  OPENAI = 'OPENAI',
  GEMINI = 'GEMINI',
  OLLAMA = 'OLLAMA',
  CLAUDE = 'CLAUDE',
  DEEPSEEK = 'DEEPSEEK'
}

export enum LlmUse {
  TRANSLATION = 'TRANSLATION',
  EXPLANATION = 'EXPLANATION',
  DICTIONARY = 'DICTIONARY',
  CHAT = 'CHAT'
}

export { TextSpeech, AudioStatus } from './tts-enums';
