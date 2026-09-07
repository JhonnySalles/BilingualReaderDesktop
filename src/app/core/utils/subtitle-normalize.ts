/**
 * Normalize Android BilingualReader subtitle JSON (Gson wire) into a stable catalog.
 * Accepts volume wrapper (`capitulos`) or a bare chapter root.
 */

export interface NormalizedSubtitleText {
  text: string;
  sequence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface NormalizedSubtitlePage {
  name: string;
  number: number;
  hash: string;
  texts: NormalizedSubtitleText[];
}

export interface NormalizedSubtitleChapter {
  /** e.g. "JAPANESE - Chapter 1" */
  key: string;
  language: string;
  chapter: number;
  manga: string;
  volume: number;
  scan: string;
  pages: NormalizedSubtitlePage[];
}

export interface SubtitleCatalog {
  chapters: NormalizedSubtitleChapter[];
  languages: string[];
  source: 'embedded' | 'external';
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ''): string {
  return v == null ? fallback : String(v);
}

function normalizeLanguage(raw: unknown): string {
  const s = str(raw, 'JAPANESE').trim().toUpperCase();
  if (!s) return 'JAPANESE';
  return s;
}

function normalizeText(raw: any): NormalizedSubtitleText | null {
  if (!raw || typeof raw !== 'object') return null;
  const text = str(raw.texto ?? raw.text ?? raw.original).trim();
  if (!text) return null;
  const x1 = num(raw.x1 ?? raw.x);
  const y1 = num(raw.y1 ?? raw.y);
  const x2 = num(raw.x2, x1 + num(raw.width));
  const y2 = num(raw.y2, y1 + num(raw.height));
  return {
    text,
    sequence: num(raw.sequencia ?? raw.sequence, 0),
    x1,
    y1,
    x2,
    y2
  };
}

function normalizePage(raw: any): NormalizedSubtitlePage | null {
  if (!raw || typeof raw !== 'object') return null;
  const textsRaw = raw.textos ?? raw.texts ?? raw.subTitleTexts ?? [];
  const texts = (Array.isArray(textsRaw) ? textsRaw : [])
    .map(normalizeText)
    .filter((t): t is NormalizedSubtitleText => !!t)
    .sort((a, b) => a.sequence - b.sequence);
  return {
    name: str(raw.nomePagina ?? raw.name ?? raw.pageName),
    number: num(raw.numero ?? raw.number ?? raw.pageNumber),
    hash: str(raw.hash).toLowerCase(),
    texts
  };
}

function chapterKey(language: string, chapter: number): string {
  return `${language} - Chapter ${chapter}`;
}

function normalizeChapter(raw: any, fallbackLang?: string, fallbackManga?: string, fallbackVolume?: number): NormalizedSubtitleChapter | null {
  if (!raw || typeof raw !== 'object') return null;
  const language = normalizeLanguage(raw.lingua ?? raw.language ?? fallbackLang);
  const chapter = num(raw.capitulo ?? raw.chapter ?? raw.chapterNumber, 0);
  const pagesRaw = raw.paginas ?? raw.pages ?? [];
  const pages = (Array.isArray(pagesRaw) ? pagesRaw : [])
    .map(normalizePage)
    .filter((p): p is NormalizedSubtitlePage => !!p);
  if (pages.length === 0) return null;
  return {
    key: chapterKey(language, chapter),
    language,
    chapter,
    manga: str(raw.manga, fallbackManga || ''),
    volume: num(raw.volume ?? raw.volumeNumber, fallbackVolume ?? 0),
    scan: str(raw.scan),
    pages
  };
}

/** Parse one JSON string (volume or chapter). Returns chapters found. */
export function parseSubtitleJsonString(raw: string): NormalizedSubtitleChapter[] {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  return parseSubtitleJsonObject(data);
}

export function parseSubtitleJsonObject(data: any): NormalizedSubtitleChapter[] {
  if (!data || typeof data !== 'object') return [];

  const chaptersRaw = data.capitulos ?? data.chapters;
  if (Array.isArray(chaptersRaw)) {
    const lang = normalizeLanguage(data.lingua ?? data.language);
    const manga = str(data.manga);
    const volume = num(data.volume ?? data.volumeNumber);
    return chaptersRaw
      .map((ch: any) => normalizeChapter(ch, lang, manga, volume))
      .filter((c): c is NormalizedSubtitleChapter => !!c);
  }

  // Bare chapter (has paginas/pages)
  if (data.paginas || data.pages) {
    const ch = normalizeChapter(data);
    return ch ? [ch] : [];
  }

  return [];
}

/** Merge multiple JSON strings from an archive into one catalog. */
export function buildSubtitleCatalog(
  rawJsonStrings: string[],
  source: 'embedded' | 'external' = 'embedded'
): SubtitleCatalog {
  const byKey = new Map<string, NormalizedSubtitleChapter>();
  for (const raw of rawJsonStrings) {
    if (!raw?.trim()) continue;
    for (const ch of parseSubtitleJsonString(raw)) {
      const existing = byKey.get(ch.key);
      if (!existing) {
        byKey.set(ch.key, ch);
      } else {
        // Prefer chapter with more pages
        if (ch.pages.length > existing.pages.length) {
          byKey.set(ch.key, ch);
        }
      }
    }
  }

  const chapters = Array.from(byKey.values()).sort((a, b) => {
    const langCmp = a.language.localeCompare(b.language);
    if (langCmp !== 0) return langCmp;
    return a.chapter - b.chapter;
  });

  const languages = Array.from(new Set(chapters.map(c => c.language))).sort();
  return { chapters, languages, source };
}

export function emptySubtitleCatalog(): SubtitleCatalog {
  return { chapters: [], languages: [], source: 'embedded' };
}
