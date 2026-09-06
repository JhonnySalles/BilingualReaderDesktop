import {
  AnnotationChapterRow,
  AnnotationContentType,
  AnnotationFilters,
  AnnotationItem,
  AnnotationItemRow,
  AnnotationMarkFilter,
  AnnotationRootRow,
  AnnotationRow
} from '../../core/models';

function matchesMark(item: AnnotationItem, marks: AnnotationMarkFilter[]): boolean {
  if (!marks.length) return true;
  return marks.some(m => {
    switch (m) {
      case 'Favorite':
        return !!item.favorite;
      case 'Detach':
        return (item.markType || 'Annotation') === 'Annotation';
      case 'PageMark':
        return item.markType === 'PageMark';
      case 'BookMark':
        return item.markType === 'BookMark';
      default:
        return false;
    }
  });
}

function matchesColor(item: AnnotationItem, colors: string[]): boolean {
  if (!colors.length) return true;
  const c = item.color || 'Yellow';
  return colors.some(sel => {
    if (sel === 'None') return !item.color || item.color === 'None';
    return c === sel;
  });
}

function matchesChapter(item: AnnotationItem, chapters: string[]): boolean {
  if (!chapters.length) return true;
  const chapter = (item.chapter || '').trim();
  return chapters.includes(chapter);
}

function matchesSearch(item: AnnotationItem, search: string): boolean {
  if (!search) return true;
  const q = search.toLowerCase().trim();
  if (!q) return true;
  return (
    (item.text || '').toLowerCase().includes(q) ||
    (item.note || '').toLowerCase().includes(q) ||
    (item.chapter || '').toLowerCase().includes(q) ||
    (item.parentTitle || '').toLowerCase().includes(q)
  );
}

export function filterAnnotations(
  items: AnnotationItem[],
  filters: AnnotationFilters
): AnnotationItem[] {
  return items.filter(item => {
    if (filters.type && item.type !== filters.type) return false;
    if (!matchesMark(item, filters.marks)) return false;
    if (!matchesColor(item, filters.colors)) return false;
    if (!matchesChapter(item, filters.chapters)) return false;
    if (!matchesSearch(item, filters.search)) return false;
    return true;
  });
}

export function collectChapters(items: AnnotationItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    const c = (item.chapter || '').trim();
    if (c) set.add(c);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Build flat list rows with optional book/manga root separators and chapter separators.
 */
export function buildRows(
  items: AnnotationItem[],
  options: { withRoot: boolean }
): AnnotationRow[] {
  const rows: AnnotationRow[] = [];
  let lastRootKey = '';
  let lastChapterKey = '';
  let chapterRow: AnnotationChapterRow | null = null;

  for (const item of items) {
    const parentId = item.fkBook;
    const rootKey = `${item.type}-${parentId}`;
    const chapterLabel = (item.chapter || '').trim() || 'Sem capítulo';
    const chapterKey = `${rootKey}::${item.chapterNumber ?? 0}::${chapterLabel}`;

    if (options.withRoot && rootKey !== lastRootKey) {
      const root: AnnotationRootRow = {
        kind: 'root',
        key: `root-${rootKey}`,
        type: item.type,
        parentId,
        title: item.parentTitle || 'Sem título',
        subtitle: item.parentFileName || ''
      };
      rows.push(root);
      lastRootKey = rootKey;
      lastChapterKey = '';
      chapterRow = null;
    }

    if (chapterKey !== lastChapterKey) {
      chapterRow = {
        kind: 'chapter',
        key: `chapter-${chapterKey}`,
        type: item.type,
        parentId,
        title: chapterLabel,
        chapterNumber: item.chapterNumber ?? 0,
        count: 0
      };
      rows.push(chapterRow);
      lastChapterKey = chapterKey;
    }

    if (chapterRow) chapterRow.count += 1;

    const itemRow: AnnotationItemRow = {
      kind: 'item',
      key: `item-${item.type}-${item.id ?? item.cfiRange ?? item.page}`,
      item
    };
    rows.push(itemRow);
  }

  return rows;
}

export function toAnnotationItemsFromBooks(
  rows: (import('../../core/models/entities/book.model').BookAnnotation & {
    bookTitle: string;
    bookName: string;
  })[]
): AnnotationItem[] {
  return rows.map(r => ({
    ...r,
    type: 'BOOK' as AnnotationContentType,
    parentTitle: r.bookTitle || r.bookName || '',
    parentFileName: r.bookName || ''
  }));
}

export function toAnnotationItemsFromMangas(
  rows: (import('../../core/models/entities/manga.model').MangaAnnotation & {
    mangaTitle: string;
    mangaName: string;
  })[]
): AnnotationItem[] {
  return rows.map(r => ({
    id: r.id,
    fkBook: r.fkManga,
    page: r.page,
    pages: r.pages,
    text: r.chapter
      ? `${r.chapter} · Página ${r.page + 1}`
      : `Página ${r.page + 1}`,
    note: r.note || '',
    markType: r.markType || 'PageMark',
    chapter: r.chapter || '',
    chapterNumber: 0,
    favorite: false,
    dateCreate: r.dateCreate,
    alteration: r.alteration,
    type: 'MANGA' as AnnotationContentType,
    parentTitle: r.mangaTitle || r.mangaName || '',
    parentFileName: r.mangaName || ''
  }));
}

/** Group books then mangas by parent title / chapter / page for buildRows. */
export function sortAnnotationItems(items: AnnotationItem[]): AnnotationItem[] {
  return [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'BOOK' ? -1 : 1;
    const title = (a.parentTitle || '').localeCompare(b.parentTitle || '', 'pt-BR');
    if (title !== 0) return title;
    const ch = (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0);
    if (ch !== 0) return ch;
    const chLabel = (a.chapter || '').localeCompare(b.chapter || '', 'pt-BR');
    if (chLabel !== 0) return chLabel;
    return (a.page ?? 0) - (b.page ?? 0);
  });
}

export function markTypeLabel(markType?: string): string {
  switch (markType) {
    case 'PageMark':
      return 'Marca';
    case 'BookMark':
      return 'Marcador';
    case 'Annotation':
    default:
      return 'Destaque';
  }
}
