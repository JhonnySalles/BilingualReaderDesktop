import type { LlmTranslateMode, SubtitleTranslateTarget } from '../models/enums/ai-enums';

export type LlmSourceLang = 'ja' | 'en' | 'pt' | 'unknown';

export function mapOcrLangToSource(ocrLang: string): LlmSourceLang {
  const lang = (ocrLang || '').toLowerCase();
  if (lang.startsWith('jpn') || lang === 'ja' || lang === 'japanese') return 'ja';
  if (lang.startsWith('eng') || lang === 'en' || lang === 'english') return 'en';
  if (lang.startsWith('por') || lang === 'pt' || lang === 'portuguese') return 'pt';
  return 'unknown';
}

export function sourceLangLabel(source: LlmSourceLang): string {
  switch (source) {
    case 'ja':
      return 'Japanese';
    case 'en':
      return 'English';
    case 'pt':
      return 'Portuguese';
    default:
      return 'the source language';
  }
}

export function targetLangLabel(target: SubtitleTranslateTarget): string {
  if (target === 'ENGLISH') return 'English';
  return 'Brazilian Portuguese';
}

export function isTranslateTargetEnabled(target: string | null | undefined): target is Exclude<SubtitleTranslateTarget, 'OFF'> {
  const t = String(target || '').toUpperCase();
  return t === 'PORTUGUESE' || t === 'ENGLISH';
}

export function normalizeTranslateTarget(value: unknown): SubtitleTranslateTarget {
  const t = String(value || '').toUpperCase();
  if (t === 'ENGLISH') return 'ENGLISH';
  if (t === 'OFF' || t === 'DISABLED' || t === 'DESATIVADO') return 'OFF';
  if (t === 'PORTUGUESE' || t === 'PT' || t === 'PT-BR') return 'PORTUGUESE';
  return 'PORTUGUESE';
}

/** Temperature prefs are stored 0–100; OpenRouter expects 0–1. */
export function temperaturePrefToApi(pref: number): number {
  const n = Number(pref);
  if (!Number.isFinite(n)) return 0.8;
  return Math.max(0, Math.min(1, n / 100));
}

export function buildTranslateSystemPrompt(
  mode: LlmTranslateMode,
  source: LlmSourceLang,
  target: Exclude<SubtitleTranslateTarget, 'OFF'>
): string {
  const src = sourceLangLabel(source);
  const dst = targetLangLabel(target);
  if (mode === 'interpret') {
    return [
      `You help language learners read manga OCR text.`,
      `Source language: ${src}. Target language: ${dst}.`,
      `Provide a natural interpretive reading of the text for a learner: fluent phrasing, brief nuance notes when helpful (honorifics, tone, idioms).`,
      `Do not invent plot beyond the given text. Do not dump a full dictionary.`,
      `Reply only with the interpretation in ${dst}, no preamble or labels.`
    ].join(' ');
  }
  return [
    `You translate manga OCR text accurately.`,
    `Source language: ${src}. Target language: ${dst}.`,
    `Produce a faithful, concise translation. Preserve line breaks when they mark speech bubbles or panels.`,
    `Do not add commentary, notes, or romanization unless they appear in the source.`,
    `Reply only with the translation in ${dst}, no preamble or labels.`
  ].join(' ');
}

export function joinOcrText(fullText: string, blockTexts?: string[]): string {
  const full = (fullText || '').trim();
  if (full) return full;
  return (blockTexts || [])
    .map(t => String(t || '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}
