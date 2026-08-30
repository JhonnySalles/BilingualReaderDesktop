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

export enum TextSpeech {
  OFF = 'OFF',
  SYSTEM_TTS = 'SYSTEM_TTS',
  ONLINE_TTS = 'ONLINE_TTS'
}

export enum AudioStatus {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR'
}
