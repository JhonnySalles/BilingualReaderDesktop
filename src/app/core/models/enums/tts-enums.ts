import { Languages } from './app-enums';

/** Neural Edge / Azure voice catalog (Android TextSpeech parity). */
export enum TextSpeech {
  ARIA = 'ARIA',
  GUY = 'GUY',
  JENNY = 'JENNY',
  NANAMI = 'NANAMI',
  KEITA = 'KEITA',
  FRANCISCA = 'FRANCISCA',
  ANTONIO = 'ANTONIO'
}

export interface TextSpeechMeta {
  id: TextSpeech;
  azureName: string;
  language: Languages;
  label: string;
  gender: 'feminine' | 'masculine';
  active: boolean;
}

export const TEXT_SPEECH_CATALOG: Record<TextSpeech, TextSpeechMeta> = {
  [TextSpeech.ARIA]: {
    id: TextSpeech.ARIA,
    azureName: 'en-US-AriaNeural',
    language: Languages.ENGLISH,
    label: 'Aria (EN · feminino)',
    gender: 'feminine',
    active: true
  },
  [TextSpeech.GUY]: {
    id: TextSpeech.GUY,
    azureName: 'en-US-GuyNeural',
    language: Languages.ENGLISH,
    label: 'Guy (EN · masculino)',
    gender: 'masculine',
    active: true
  },
  [TextSpeech.JENNY]: {
    id: TextSpeech.JENNY,
    azureName: 'en-US-JennyNeural',
    language: Languages.ENGLISH,
    label: 'Jenny (EN · feminino)',
    gender: 'feminine',
    active: true
  },
  [TextSpeech.NANAMI]: {
    id: TextSpeech.NANAMI,
    azureName: 'ja-JP-NanamiNeural',
    language: Languages.JAPANESE,
    label: 'Nanami (JA · feminino)',
    gender: 'feminine',
    active: true
  },
  [TextSpeech.KEITA]: {
    id: TextSpeech.KEITA,
    azureName: 'ja-JP-KeitaNeural',
    language: Languages.JAPANESE,
    label: 'Keita (JA · masculino)',
    gender: 'masculine',
    active: true
  },
  [TextSpeech.FRANCISCA]: {
    id: TextSpeech.FRANCISCA,
    azureName: 'pt-BR-FranciscaNeural',
    language: Languages.PORTUGUESE,
    label: 'Francisca (PT · feminino)',
    gender: 'feminine',
    active: true
  },
  [TextSpeech.ANTONIO]: {
    id: TextSpeech.ANTONIO,
    azureName: 'pt-BR-AntonioNeural',
    language: Languages.PORTUGUESE,
    label: 'Antonio (PT · masculino)',
    gender: 'masculine',
    active: true
  }
};

export function activeTextSpeechVoices(): TextSpeechMeta[] {
  return Object.values(TEXT_SPEECH_CATALOG).filter(v => v.active);
}

export function textSpeechDefault(isJapanese: boolean): TextSpeech {
  return isJapanese ? TextSpeech.NANAMI : TextSpeech.FRANCISCA;
}

export function parseTextSpeech(value: unknown, fallback: TextSpeech): TextSpeech {
  if (typeof value !== 'string') return fallback;
  return (Object.values(TextSpeech) as string[]).includes(value)
    ? (value as TextSpeech)
    : fallback;
}

export function textSpeechAzureName(id: TextSpeech): string {
  return TEXT_SPEECH_CATALOG[id]?.azureName ?? TEXT_SPEECH_CATALOG[TextSpeech.FRANCISCA].azureName;
}

/** Edge rate string from Android-style −50…+50 slider. */
export function ttsRateToEdge(rate: number): string {
  const n = Math.max(-50, Math.min(50, Math.round(rate / 5) * 5));
  return n >= 0 ? `+${n}%` : `${n}%`;
}

export function formatTtsSpeedLabel(rate: number): string {
  const n = Math.max(-50, Math.min(50, Math.round(Number(rate) || 0)));
  return n >= 0 ? `+${n}%` : `${n}%`;
}

export enum AudioStatus {
  PREPARE = 'PREPARE',
  PLAY = 'PLAY',
  PAUSE = 'PAUSE',
  STOP = 'STOP',
  ENDING = 'ENDING',
  ERROR = 'ERROR'
}
