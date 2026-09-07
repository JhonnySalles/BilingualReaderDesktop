import {
  ShareAnnotation,
  ShareHistory,
  ShareItem,
  ShareMarkFile,
  SHARE_ANNOTATION_FIELDS as AF,
  SHARE_HISTORY_FIELDS as HF,
  SHARE_ITEM_FIELDS as IF,
  SHARE_ITEM_KEY_DATE_FORMAT,
  SHARE_MARK_FILE_FIELDS as MF,
  SHARE_MARK_INITIAL_SYNC
} from '../../../src/app/core/models/entities/share-item.model';
import { Manga, MangaAnnotation } from '../../../src/app/core/models/entities/manga.model';
import { Book, BookAnnotation } from '../../../src/app/core/models/entities/book.model';
import { HistoryRow } from '../../database/history.repository';

/** Format like Android SimpleDateFormat yyyy-MM-dd'T'HH:mm:ss.SSSZ */
export function formatShareMarkDate(date: Date = new Date()): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const oh = pad(Math.floor(abs / 60));
  const om = pad(abs % 60);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.` +
    `${pad(date.getMilliseconds(), 3)}${sign}${oh}${om}`
  );
}

/** Key format yyyy-MM-dd-HH:mm:ss */
export function formatItemKeyDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export function parseFlexibleDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'object' && value !== null) {
    const o = value as { _seconds?: number; seconds?: number; _nanoseconds?: number; nanoseconds?: number };
    if (typeof o._seconds === 'number') {
      return new Date(o._seconds * 1000 + Math.floor((o._nanoseconds ?? 0) / 1e6));
    }
    if (typeof o.seconds === 'number') {
      return new Date(o.seconds * 1000 + Math.floor((o.nanoseconds ?? 0) / 1e6));
    }
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
    // Android SHARE_MARKS.PARSE_DATE_TIME without colon in offset sometimes
    const normalized = value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
    const d2 = new Date(normalized);
    if (!Number.isNaN(d2.getTime())) return d2;
  }
  return null;
}

export function toIsoOrInitial(value?: string | null): string {
  if (!value) return SHARE_MARK_INITIAL_SYNC;
  const d = parseFlexibleDate(value);
  return d ? d.toISOString() : SHARE_MARK_INITIAL_SYNC;
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') return Number(v) || fallback;
  return fallback;
}

function bool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  return fallback;
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

export function historyRowToShare(h: HistoryRow): ShareHistory {
  return {
    pageStart: h.page_start ?? 0,
    pageEnd: h.page_end ?? 0,
    pages: h.pages ?? 1,
    completed: Boolean(h.completed),
    volume: h.volume || '',
    chaptersRead: h.chapters_read ?? 0,
    start: h.date_time_start || new Date().toISOString(),
    end: h.date_time_end || new Date().toISOString(),
    secondsRead: h.seconds_read ?? 0,
    averageTimeByPage: h.average_time_page ?? 0,
    useTTS: Boolean(h.use_tts)
  };
}

export function mangaAnnotationToShare(a: MangaAnnotation): ShareAnnotation {
  return {
    page: a.page ?? 0,
    pages: a.pages ?? 0,
    fontSize: 0,
    type: a.markType || 'PageMark',
    chapterNumber: 0,
    chapter: a.chapter || '',
    text: a.folder || '',
    range: '',
    annotation: a.note || '',
    favorite: false,
    color: '',
    created: a.dateCreate || new Date().toISOString()
  };
}

export function bookAnnotationToShare(
  a: BookAnnotation,
  opts?: { bookPages?: number; resolvedPage?: number }
): ShareAnnotation {
  const range =
    a.range && a.range.length >= 2 ? `${a.range[0]},${a.range[1]}` : '';
  const bookPages = Math.max(1, opts?.bookPages ?? a.pages ?? 1);
  let page = opts?.resolvedPage ?? a.page ?? 0;
  if (page < 0) page = 0;
  const pages = Math.max(1, a.pages || bookPages);
  const cfi = (a.cfiRange || '').trim();

  const share: ShareAnnotation = {
    page,
    pages,
    fontSize: a.fontSize ?? 0,
    type: a.markType || 'Annotation',
    chapterNumber: a.chapterNumber ?? 0,
    chapter: a.chapter || '',
    text: a.text || '',
    range,
    annotation: a.note || '',
    favorite: Boolean(a.favorite),
    color: a.color || 'Yellow',
    created: a.dateCreate || new Date().toISOString()
  };
  if (cfi) {
    share.cfiRange = cfi;
  }
  return share;
}

/**
 * Build ShareAnnotation ensuring page/pages for Android open.
 * Resolves page from CFI via EPUB when local page is missing/invalid.
 */
export async function bookAnnotationToShareAsync(
  a: BookAnnotation,
  book: { path?: string; pages?: number; bookMark?: number }
): Promise<ShareAnnotation> {
  const bookPages = Math.max(1, book.pages ?? a.pages ?? 1);
  let page = a.page ?? 0;
  const cfi = (a.cfiRange || '').trim();

  if (page <= 0 && cfi && book.path) {
    try {
      const { pageFromCfi } = await import('./annotation-cfi.util');
      const resolved = await pageFromCfi(book.path, cfi);
      if (resolved != null) {
        page = resolved;
      }
    } catch (e) {
      console.warn('[share-item.mapper] pageFromCfi failed', e);
    }
  }

  if (page <= 0 && (book.bookMark ?? 0) > 0) {
    page = book.bookMark ?? 0;
  }
  if (page < 0) page = 0;
  if (page > bookPages) page = bookPages;

  return bookAnnotationToShare(
    { ...a, page, pages: a.pages && a.pages > 0 ? a.pages : bookPages },
    { bookPages, resolvedPage: page }
  );
}

export function buildShareItemFromManga(
  manga: Manga,
  histories: HistoryRow[],
  annotations: MangaAnnotation[]
): ShareItem {
  const history: Record<string, ShareHistory> = {};
  for (const h of histories) {
    const d = parseFlexibleDate(h.date_time_start) || new Date();
    history[formatItemKeyDate(d)] = historyRowToShare(h);
  }
  const annotation: Record<string, ShareAnnotation> = {};
  for (const a of annotations) {
    const d = parseFlexibleDate(a.dateCreate) || new Date();
    annotation[formatItemKeyDate(d)] = mangaAnnotationToShare(a);
  }
  return {
    id: manga.id,
    idLibrary: manga.fkLibrary,
    file: manga.name,
    bookMark: manga.bookMark ?? 0,
    pages: manga.pages ?? 1,
    completed: Boolean(manga.completed),
    favorite: Boolean(manga.favorite),
    lastAccess: manga.lastAccess || SHARE_MARK_INITIAL_SYNC,
    sync: formatShareMarkDate(),
    history,
    annotation,
    alter: true,
    processed: true
  };
}

export async function buildShareItemFromBook(
  book: Book,
  histories: HistoryRow[],
  annotations: BookAnnotation[]
): Promise<ShareItem> {
  const history: Record<string, ShareHistory> = {};
  for (const h of histories) {
    const d = parseFlexibleDate(h.date_time_start) || new Date();
    history[formatItemKeyDate(d)] = historyRowToShare(h);
  }
  const annotation: Record<string, ShareAnnotation> = {};
  for (const a of annotations) {
    const d = parseFlexibleDate(a.dateCreate) || new Date();
    annotation[formatItemKeyDate(d)] = await bookAnnotationToShareAsync(a, book);
  }
  return {
    id: book.id,
    idLibrary: book.fkLibrary,
    file: book.name,
    bookMark: book.bookMark ?? 0,
    pages: book.pages ?? 1,
    completed: Boolean(book.completed),
    favorite: Boolean(book.favorite),
    lastAccess: book.lastAccess || SHARE_MARK_INITIAL_SYNC,
    sync: formatShareMarkDate(),
    history,
    annotation,
    alter: true,
    processed: true
  };
}

export function refreshShareItemHistory(item: ShareItem, histories: HistoryRow[]): void {
  const history: Record<string, ShareHistory> = {};
  for (const h of histories) {
    const d = parseFlexibleDate(h.date_time_start) || new Date();
    history[formatItemKeyDate(d)] = historyRowToShare(h);
  }
  item.history = history;
}

export function refreshShareItemMangaAnnotations(item: ShareItem, annotations: MangaAnnotation[]): void {
  const annotation: Record<string, ShareAnnotation> = {};
  for (const a of annotations) {
    const d = parseFlexibleDate(a.dateCreate) || new Date();
    annotation[formatItemKeyDate(d)] = mangaAnnotationToShare(a);
  }
  item.annotation = annotation;
}

export async function refreshShareItemBookAnnotations(
  item: ShareItem,
  annotations: BookAnnotation[],
  book: Book
): Promise<void> {
  const annotation: Record<string, ShareAnnotation> = {};
  for (const a of annotations) {
    const d = parseFlexibleDate(a.dateCreate) || new Date();
    annotation[formatItemKeyDate(d)] = await bookAnnotationToShareAsync(a, book);
  }
  item.annotation = annotation;
}

function parseHistoryMap(raw: unknown): Record<string, ShareHistory> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const result: Record<string, ShareHistory> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    const start = parseFlexibleDate(v[HF.START] ?? v.start);
    const end = parseFlexibleDate(v[HF.END] ?? v.end);
    result[key] = {
      pageStart: num(v[HF.PAGE_START] ?? v.pageStart),
      pageEnd: num(v[HF.PAGE_END] ?? v.pageEnd),
      pages: num(v[HF.PAGES] ?? v.pages, 1),
      completed: bool(v[HF.COMPLETED] ?? v.completed),
      volume: str(v[HF.VOLUME] ?? v.volume),
      chaptersRead: num(v[HF.CHAPTERS_READ] ?? v.chaptersRead),
      start: start ? start.toISOString() : new Date().toISOString(),
      end: end ? end.toISOString() : new Date().toISOString(),
      secondsRead: num(v[HF.SECONDS_READ] ?? v.secondsRead),
      averageTimeByPage: num(v[HF.AVERAGE_TIME_BY_PAGE] ?? v.averageTimeByPage),
      useTTS: bool(v[HF.USE_TTS] ?? v.useTTS)
    };
  }
  return result;
}

function parseAnnotationMap(raw: unknown): Record<string, ShareAnnotation> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const result: Record<string, ShareAnnotation> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    const created = parseFlexibleDate(v[AF.CREATED] ?? v.created);
    const cfiRaw = str(v[AF.CFI_RANGE] ?? v.cfiRange);
    const share: ShareAnnotation = {
      page: num(v[AF.PAGE] ?? v.page),
      pages: num(v[AF.PAGES] ?? v.pages),
      fontSize: num(v[AF.FONT_SIZE] ?? v.fontSize),
      type: str(v[AF.TYPE] ?? v.type, 'PageMark'),
      chapterNumber: num(v[AF.CHAPTER_NUMBER] ?? v.chapterNumber),
      chapter: str(v[AF.CHAPTER] ?? v.chapter),
      text: str(v[AF.TEXT] ?? v.text),
      range: str(v[AF.RANGE] ?? v.range),
      annotation: str(v[AF.ANNOTATION] ?? v.annotation),
      favorite: bool(v[AF.FAVORITE] ?? v.favorite),
      color: str(v[AF.COLOR] ?? v.color),
      created: created ? created.toISOString() : new Date().toISOString()
    };
    if (cfiRaw.trim()) {
      share.cfiRange = cfiRaw.trim();
    }
    result[key] = share;
  }
  return result;
}

/** Parse cloud document (PT-BR keys or camelCase) into ShareItem. */
export function parseShareItemFromCloud(raw: Record<string, unknown>): ShareItem {
  const lastAccess = parseFlexibleDate(raw[IF.LAST_ACCESS] ?? raw.lastAccess);
  const sync = parseFlexibleDate(raw[IF.SYNC] ?? raw.sync);
  const bookMark = num(raw[IF.BOOKMARK] ?? raw.bookMark);
  const pages = num(raw[IF.PAGES] ?? raw.pages, 1);
  const completed = raw[IF.COMPLETED] != null || raw.completed != null
    ? bool(raw[IF.COMPLETED] ?? raw.completed)
    : bookMark >= pages;

  return {
    file: str(raw[IF.FILE] ?? raw.file),
    bookMark,
    pages,
    completed,
    favorite: bool(raw[IF.FAVORITE] ?? raw.favorite),
    lastAccess: lastAccess ? lastAccess.toISOString() : SHARE_MARK_INITIAL_SYNC,
    sync: sync ? sync.toISOString() : new Date().toISOString(),
    history: parseHistoryMap(raw[IF.HISTORY] ?? raw.history),
    annotation: parseAnnotationMap(raw[IF.ANNOTATION] ?? raw.annotation),
    alter: false,
    received: false,
    processed: false
  };
}

/** Serialize ShareItem with Portuguese keys for Drive JSON / Firestore. */
export function serializeShareItemForCloud(item: ShareItem, useFirestoreTimestamps = false): Record<string, unknown> {
  const lastAccess = parseFlexibleDate(item.lastAccess) || new Date(SHARE_MARK_INITIAL_SYNC);
  const sync = parseFlexibleDate(item.sync) || new Date();

  const history: Record<string, unknown> = {};
  if (item.history) {
    for (const [key, h] of Object.entries(item.history) as [string, ShareHistory][]) {
      const start = parseFlexibleDate(h.start) || new Date();
      const end = parseFlexibleDate(h.end) || new Date();
      history[key] = {
        [HF.PAGE_START]: h.pageStart,
        [HF.PAGE_END]: h.pageEnd,
        [HF.PAGES]: h.pages,
        [HF.COMPLETED]: h.completed,
        [HF.VOLUME]: h.volume,
        [HF.CHAPTERS_READ]: h.chaptersRead,
        [HF.START]: useFirestoreTimestamps ? toFirestoreTimestamp(start) : formatShareMarkDate(start),
        [HF.END]: useFirestoreTimestamps ? toFirestoreTimestamp(end) : formatShareMarkDate(end),
        [HF.SECONDS_READ]: h.secondsRead,
        [HF.AVERAGE_TIME_BY_PAGE]: h.averageTimeByPage,
        [HF.USE_TTS]: h.useTTS
      };
    }
  }

  const annotation: Record<string, unknown> = {};
  if (item.annotation) {
    for (const [key, a] of Object.entries(item.annotation) as [string, ShareAnnotation][]) {
      const created = parseFlexibleDate(a.created) || new Date();
      const entry: Record<string, unknown> = {
        [AF.PAGE]: a.page,
        [AF.PAGES]: a.pages,
        [AF.FONT_SIZE]: a.fontSize,
        [AF.TYPE]: a.type,
        [AF.CHAPTER_NUMBER]: a.chapterNumber,
        [AF.CHAPTER]: a.chapter,
        [AF.TEXT]: a.text,
        [AF.RANGE]: a.range,
        [AF.ANNOTATION]: a.annotation,
        [AF.FAVORITE]: a.favorite,
        [AF.COLOR]: a.color,
        [AF.CREATED]: useFirestoreTimestamps ? toFirestoreTimestamp(created) : formatShareMarkDate(created)
      };
      const cfi = (a.cfiRange || '').trim();
      if (cfi) {
        entry[AF.CFI_RANGE] = cfi;
      }
      annotation[key] = entry;
    }
  }

  return {
    [IF.FILE]: item.file,
    [IF.BOOKMARK]: item.bookMark,
    [IF.PAGES]: item.pages,
    [IF.COMPLETED]: item.completed,
    [IF.FAVORITE]: item.favorite,
    [IF.LAST_ACCESS]: useFirestoreTimestamps ? toFirestoreTimestamp(lastAccess) : formatShareMarkDate(lastAccess),
    [IF.SYNC]: useFirestoreTimestamps ? toFirestoreTimestamp(sync) : formatShareMarkDate(sync),
    [IF.HISTORY]: history,
    [IF.ANNOTATION]: annotation
  };
}

function toFirestoreTimestamp(date: Date): { seconds: number; nanos: number } {
  const ms = date.getTime();
  return {
    seconds: Math.floor(ms / 1000),
    nanos: (ms % 1000) * 1e6
  };
}

export function serializeShareMarkFile(share: ShareMarkFile): Record<string, unknown> {
  return {
    [MF.ORIGIN]: share.origin ?? '',
    [MF.LAST_ALTERATION]: share.lastAlteration
      ? formatShareMarkDate(parseFlexibleDate(share.lastAlteration) || new Date())
      : formatShareMarkDate(),
    [MF.TYPE]: share.type ?? 'MANGA',
    [MF.MARKS]: (share.marks || []).map((m: ShareItem) => serializeShareItemForCloud(m, false))
  };
}

export function parseShareMarkFile(raw: unknown): ShareMarkFile {
  if (!raw || typeof raw !== 'object') {
    return { origin: '', lastAlteration: null, type: 'MANGA', marks: [] };
  }
  const o = raw as Record<string, unknown>;
  const marksRaw = (o[MF.MARKS] ?? o.marks ?? []) as unknown[];
  const marks: ShareItem[] = [];
  if (Array.isArray(marksRaw)) {
    for (const entry of marksRaw) {
      if (entry && typeof entry === 'object') {
        marks.push(parseShareItemFromCloud(entry as Record<string, unknown>));
      }
    }
  }
  const typeRaw = str(o[MF.TYPE] ?? o.type, 'MANGA').toUpperCase();
  return {
    origin: str(o[MF.ORIGIN] ?? o.origin),
    lastAlteration: (() => {
      const d = parseFlexibleDate(o[MF.LAST_ALTERATION] ?? o.lastAlteration);
      return d ? d.toISOString() : null;
    })(),
    type: typeRaw === 'BOOK' ? 'BOOK' : 'MANGA',
    marks
  };
}

export function parseRangeString(range: string): number[] | undefined {
  if (!range) return undefined;
  const parts = range.split(',').map((p) => Number(p.trim())).filter((n) => !Number.isNaN(n));
  return parts.length >= 2 ? [parts[0], parts[1]] : undefined;
}

export { SHARE_ITEM_KEY_DATE_FORMAT, SHARE_MARK_INITIAL_SYNC };
