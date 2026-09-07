import {
  NormalizedSubtitleChapter,
  NormalizedSubtitlePage,
  NormalizedSubtitleText,
  SubtitleCatalog
} from '../../../core/utils/subtitle-normalize';

function basename(name: string): string {
  const n = (name || '').replace(/\\/g, '/');
  const i = n.lastIndexOf('/');
  return (i >= 0 ? n.slice(i + 1) : n).trim().toLowerCase();
}

function namesEqual(a: string, b: string): boolean {
  return basename(a) === basename(b);
}

/**
 * Pick chapters for a language (exact match, else first available).
 */
export function chaptersForLanguage(
  catalog: SubtitleCatalog | null | undefined,
  language: string | null | undefined
): NormalizedSubtitleChapter[] {
  if (!catalog?.chapters?.length) return [];
  const lang = (language || '').trim().toUpperCase();
  if (lang) {
    const exact = catalog.chapters.filter(c => c.language === lang);
    if (exact.length) return exact;
  }
  const firstLang = catalog.languages[0] || catalog.chapters[0]?.language;
  return catalog.chapters.filter(c => c.language === firstLang);
}

/**
 * Android findKeys parity: hash → name+path → name alone.
 */
export function findSubtitlePage(
  chapters: NormalizedSubtitleChapter[],
  opts: {
    pageHash?: string | null;
    pageName?: string | null;
    pagePath?: string | null;
  }
): { chapter: NormalizedSubtitleChapter; page: NormalizedSubtitlePage } | null {
  if (!chapters.length) return null;
  const hash = (opts.pageHash || '').trim().toLowerCase();
  const name = (opts.pageName || '').trim();
  const folder = (opts.pagePath || '').trim().toLowerCase();

  if (hash) {
    for (const ch of chapters) {
      for (const page of ch.pages) {
        if (page.hash && page.hash.toLowerCase() === hash) {
          return { chapter: ch, page };
        }
      }
    }
  }

  if (name) {
    if (folder) {
      for (const ch of chapters) {
        for (const page of ch.pages) {
          if (namesEqual(page.name, name)) {
            // Prefer match when chapter volume/path hints align — filename+folder soft match
            return { chapter: ch, page };
          }
        }
      }
    }
    for (const ch of chapters) {
      for (const page of ch.pages) {
        if (namesEqual(page.name, name)) {
          return { chapter: ch, page };
        }
      }
    }
  }

  return null;
}

export function hitTestSubtitleText(
  texts: NormalizedSubtitleText[],
  x: number,
  y: number
): NormalizedSubtitleText | null {
  for (const t of texts) {
    const minX = Math.min(t.x1, t.x2);
    const maxX = Math.max(t.x1, t.x2);
    const minY = Math.min(t.y1, t.y2);
    const maxY = Math.max(t.y1, t.y2);
    if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
      return t;
    }
  }
  return null;
}
