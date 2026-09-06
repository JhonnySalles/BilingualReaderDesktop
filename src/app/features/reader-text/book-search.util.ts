import { Book as EpubBook } from 'epubjs';
import { BookSearchListItem } from '../../core/models';

export interface BookSearchTocEntry {
  label: string;
  href: string;
  location: number;
}

export interface RunBookSearchOptions {
  book: EpubBook;
  query: string;
  toc: BookSearchTocEntry[];
  signal?: AbortSignal;
  onProgress?: (items: BookSearchListItem[]) => void;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Highlight query occurrences in excerpt with safe HTML <mark>. */
export function highlightExcerptHtml(excerpt: string, query: string): string {
  const plain = excerpt || '';
  const q = (query || '').trim();
  if (!q) return escapeHtml(plain);

  const lower = plain.toLowerCase();
  const needle = q.toLowerCase();
  let out = '';
  let cursor = 0;
  let idx = lower.indexOf(needle, cursor);

  while (idx !== -1) {
    out += escapeHtml(plain.slice(cursor, idx));
    out += `<mark class="br-search-mark">${escapeHtml(plain.slice(idx, idx + q.length))}</mark>`;
    cursor = idx + q.length;
    idx = lower.indexOf(needle, cursor);
  }
  out += escapeHtml(plain.slice(cursor));
  return out;
}

function normalizeHref(href?: string): string {
  if (!href) return '';
  return href.split('#')[0].replace(/^\.\//, '').toLowerCase();
}

function chapterForHref(toc: BookSearchTocEntry[], href: string): BookSearchTocEntry | null {
  const target = normalizeHref(href);
  if (!target || !toc.length) return null;
  const match = [...toc].reverse().find(e => {
    const h = normalizeHref(e.href);
    return h && (target.includes(h) || h.includes(target));
  });
  return match || null;
}

function pageFromCfi(book: EpubBook, cfi: string): number {
  try {
    const raw = book.locations?.locationFromCfi?.(cfi) as unknown;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
      return Math.floor(raw);
    }
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  } catch { /* ignore */ }

  try {
    const pct = book.locations?.percentageFromCfi?.(cfi) as unknown;
    const p = typeof pct === 'number' ? pct : Number(pct);
    const len = book.locations?.length?.() ?? 0;
    if (Number.isFinite(p) && len > 0) {
      return Math.min(len - 1, Math.max(0, Math.floor(p * len)));
    }
  } catch { /* ignore */ }

  return 0;
}

/**
 * Search open EPUB spine sections via epub.js `section.find`.
 * Emits progressive results (chapter headers + hits). Supports AbortSignal.
 */
export async function runBookSearch(options: RunBookSearchOptions): Promise<BookSearchListItem[]> {
  const { book, signal, onProgress } = options;
  const query = (options.query || '').trim();
  const toc = options.toc || [];
  const results: BookSearchListItem[] = [];

  if (!query || !book) return results;

  const spine = (book as any).spine;
  if (!spine) return results;

  let lastChapterKey = '';
  let chapterIndex = -1;
  let sinceProgress = 0;

  const emit = (force = false) => {
    sinceProgress++;
    if (force || sinceProgress >= 8) {
      sinceProgress = 0;
      onProgress?.([...results]);
    }
  };

  const items: any[] = [];
  try {
    if (typeof spine.each === 'function') {
      spine.each((section: any) => items.push(section));
    } else if (Array.isArray(spine.spineItems)) {
      items.push(...spine.spineItems);
    } else if (typeof spine.length === 'number') {
      for (let i = 0; i < spine.length; i++) {
        const s = spine.get?.(i) ?? spine[i];
        if (s) items.push(s);
      }
    }
  } catch {
    return results;
  }

  for (const section of items) {
    if (signal?.aborted) break;

    try {
      await section.load(book.load.bind(book));
    } catch {
      continue;
    }

    if (signal?.aborted) {
      try { section.unload?.(); } catch { /* ignore */ }
      break;
    }

    let matches: { cfi: string; excerpt: string }[] = [];
    try {
      matches = section.find(query) || [];
    } catch {
      matches = [];
    }

    if (matches.length) {
      const href = section.href || section.url || '';
      const chapter = chapterForHref(toc, href);
      const chapterKey = chapter
        ? `${chapter.href}::${chapter.label}`
        : `spine:${section.index ?? href}`;

      if (chapterKey !== lastChapterKey) {
        lastChapterKey = chapterKey;
        chapterIndex++;
        results.push({
          kind: 'chapter',
          title: chapter?.label || 'Capítulo',
          chapterIndex
        });
        emit();
      }

      for (const match of matches) {
        if (signal?.aborted) break;
        const plainExcerpt = match.excerpt || '';
        results.push({
          kind: 'hit',
          cfi: match.cfi,
          page: pageFromCfi(book, match.cfi),
          excerptHtml: highlightExcerptHtml(plainExcerpt, query),
          plainExcerpt,
          query
        });
        emit();
      }
    }

    try {
      section.unload?.();
    } catch { /* ignore */ }

    // Yield so UI stays responsive between spine items
    await new Promise<void>(r => setTimeout(r, 0));
  }

  onProgress?.([...results]);
  return results;
}
