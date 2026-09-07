"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHARE_MARK_INITIAL_SYNC = exports.SHARE_ITEM_KEY_DATE_FORMAT = void 0;
exports.formatShareMarkDate = formatShareMarkDate;
exports.formatItemKeyDate = formatItemKeyDate;
exports.parseFlexibleDate = parseFlexibleDate;
exports.toIsoOrInitial = toIsoOrInitial;
exports.historyRowToShare = historyRowToShare;
exports.mangaAnnotationToShare = mangaAnnotationToShare;
exports.bookAnnotationToShare = bookAnnotationToShare;
exports.bookAnnotationToShareAsync = bookAnnotationToShareAsync;
exports.buildShareItemFromManga = buildShareItemFromManga;
exports.buildShareItemFromBook = buildShareItemFromBook;
exports.refreshShareItemHistory = refreshShareItemHistory;
exports.refreshShareItemMangaAnnotations = refreshShareItemMangaAnnotations;
exports.refreshShareItemBookAnnotations = refreshShareItemBookAnnotations;
exports.parseShareItemFromCloud = parseShareItemFromCloud;
exports.serializeShareItemForCloud = serializeShareItemForCloud;
exports.serializeShareMarkFile = serializeShareMarkFile;
exports.parseShareMarkFile = parseShareMarkFile;
exports.parseRangeString = parseRangeString;
const share_item_model_1 = require("../../../src/app/core/models/entities/share-item.model");
Object.defineProperty(exports, "SHARE_ITEM_KEY_DATE_FORMAT", { enumerable: true, get: function () { return share_item_model_1.SHARE_ITEM_KEY_DATE_FORMAT; } });
Object.defineProperty(exports, "SHARE_MARK_INITIAL_SYNC", { enumerable: true, get: function () { return share_item_model_1.SHARE_MARK_INITIAL_SYNC; } });
/** Format like Android SimpleDateFormat yyyy-MM-dd'T'HH:mm:ss.SSSZ */
function formatShareMarkDate(date = new Date()) {
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const abs = Math.abs(offset);
    const oh = pad(Math.floor(abs / 60));
    const om = pad(abs % 60);
    return (`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.` +
        `${pad(date.getMilliseconds(), 3)}${sign}${oh}${om}`);
}
/** Key format yyyy-MM-dd-HH:mm:ss */
function formatItemKeyDate(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return (`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`);
}
function parseFlexibleDate(value) {
    if (value == null)
        return null;
    if (value instanceof Date)
        return value;
    if (typeof value === 'number')
        return new Date(value);
    if (typeof value === 'object' && value !== null) {
        const o = value;
        if (typeof o._seconds === 'number') {
            return new Date(o._seconds * 1000 + Math.floor((o._nanoseconds ?? 0) / 1e6));
        }
        if (typeof o.seconds === 'number') {
            return new Date(o.seconds * 1000 + Math.floor((o.nanoseconds ?? 0) / 1e6));
        }
    }
    if (typeof value === 'string') {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime()))
            return d;
        // Android SHARE_MARKS.PARSE_DATE_TIME without colon in offset sometimes
        const normalized = value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
        const d2 = new Date(normalized);
        if (!Number.isNaN(d2.getTime()))
            return d2;
    }
    return null;
}
function toIsoOrInitial(value) {
    if (!value)
        return share_item_model_1.SHARE_MARK_INITIAL_SYNC;
    const d = parseFlexibleDate(value);
    return d ? d.toISOString() : share_item_model_1.SHARE_MARK_INITIAL_SYNC;
}
function num(v, fallback = 0) {
    if (typeof v === 'number')
        return v;
    if (typeof v === 'string' && v.trim() !== '')
        return Number(v) || fallback;
    return fallback;
}
function bool(v, fallback = false) {
    if (typeof v === 'boolean')
        return v;
    return fallback;
}
function str(v, fallback = '') {
    return typeof v === 'string' ? v : fallback;
}
function historyRowToShare(h) {
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
function mangaAnnotationToShare(a) {
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
function bookAnnotationToShare(a, opts) {
    const range = a.range && a.range.length >= 2 ? `${a.range[0]},${a.range[1]}` : '';
    const bookPages = Math.max(1, opts?.bookPages ?? a.pages ?? 1);
    let page = opts?.resolvedPage ?? a.page ?? 0;
    if (page < 0)
        page = 0;
    const pages = Math.max(1, a.pages || bookPages);
    const cfi = (a.cfiRange || '').trim();
    const share = {
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
async function bookAnnotationToShareAsync(a, book) {
    const bookPages = Math.max(1, book.pages ?? a.pages ?? 1);
    let page = a.page ?? 0;
    const cfi = (a.cfiRange || '').trim();
    if (page <= 0 && cfi && book.path) {
        try {
            const { pageFromCfi } = await Promise.resolve().then(() => __importStar(require('./annotation-cfi.util')));
            const resolved = await pageFromCfi(book.path, cfi);
            if (resolved != null) {
                page = resolved;
            }
        }
        catch (e) {
            console.warn('[share-item.mapper] pageFromCfi failed', e);
        }
    }
    if (page <= 0 && (book.bookMark ?? 0) > 0) {
        page = book.bookMark ?? 0;
    }
    if (page < 0)
        page = 0;
    if (page > bookPages)
        page = bookPages;
    return bookAnnotationToShare({ ...a, page, pages: a.pages && a.pages > 0 ? a.pages : bookPages }, { bookPages, resolvedPage: page });
}
function buildShareItemFromManga(manga, histories, annotations) {
    const history = {};
    for (const h of histories) {
        const d = parseFlexibleDate(h.date_time_start) || new Date();
        history[formatItemKeyDate(d)] = historyRowToShare(h);
    }
    const annotation = {};
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
        lastAccess: manga.lastAccess || share_item_model_1.SHARE_MARK_INITIAL_SYNC,
        sync: formatShareMarkDate(),
        history,
        annotation,
        alter: true,
        processed: true
    };
}
async function buildShareItemFromBook(book, histories, annotations) {
    const history = {};
    for (const h of histories) {
        const d = parseFlexibleDate(h.date_time_start) || new Date();
        history[formatItemKeyDate(d)] = historyRowToShare(h);
    }
    const annotation = {};
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
        lastAccess: book.lastAccess || share_item_model_1.SHARE_MARK_INITIAL_SYNC,
        sync: formatShareMarkDate(),
        history,
        annotation,
        alter: true,
        processed: true
    };
}
function refreshShareItemHistory(item, histories) {
    const history = {};
    for (const h of histories) {
        const d = parseFlexibleDate(h.date_time_start) || new Date();
        history[formatItemKeyDate(d)] = historyRowToShare(h);
    }
    item.history = history;
}
function refreshShareItemMangaAnnotations(item, annotations) {
    const annotation = {};
    for (const a of annotations) {
        const d = parseFlexibleDate(a.dateCreate) || new Date();
        annotation[formatItemKeyDate(d)] = mangaAnnotationToShare(a);
    }
    item.annotation = annotation;
}
async function refreshShareItemBookAnnotations(item, annotations, book) {
    const annotation = {};
    for (const a of annotations) {
        const d = parseFlexibleDate(a.dateCreate) || new Date();
        annotation[formatItemKeyDate(d)] = await bookAnnotationToShareAsync(a, book);
    }
    item.annotation = annotation;
}
function parseHistoryMap(raw) {
    if (!raw || typeof raw !== 'object')
        return undefined;
    const result = {};
    for (const [key, value] of Object.entries(raw)) {
        if (!value || typeof value !== 'object')
            continue;
        const v = value;
        const start = parseFlexibleDate(v[share_item_model_1.SHARE_HISTORY_FIELDS.START] ?? v.start);
        const end = parseFlexibleDate(v[share_item_model_1.SHARE_HISTORY_FIELDS.END] ?? v.end);
        result[key] = {
            pageStart: num(v[share_item_model_1.SHARE_HISTORY_FIELDS.PAGE_START] ?? v.pageStart),
            pageEnd: num(v[share_item_model_1.SHARE_HISTORY_FIELDS.PAGE_END] ?? v.pageEnd),
            pages: num(v[share_item_model_1.SHARE_HISTORY_FIELDS.PAGES] ?? v.pages, 1),
            completed: bool(v[share_item_model_1.SHARE_HISTORY_FIELDS.COMPLETED] ?? v.completed),
            volume: str(v[share_item_model_1.SHARE_HISTORY_FIELDS.VOLUME] ?? v.volume),
            chaptersRead: num(v[share_item_model_1.SHARE_HISTORY_FIELDS.CHAPTERS_READ] ?? v.chaptersRead),
            start: start ? start.toISOString() : new Date().toISOString(),
            end: end ? end.toISOString() : new Date().toISOString(),
            secondsRead: num(v[share_item_model_1.SHARE_HISTORY_FIELDS.SECONDS_READ] ?? v.secondsRead),
            averageTimeByPage: num(v[share_item_model_1.SHARE_HISTORY_FIELDS.AVERAGE_TIME_BY_PAGE] ?? v.averageTimeByPage),
            useTTS: bool(v[share_item_model_1.SHARE_HISTORY_FIELDS.USE_TTS] ?? v.useTTS)
        };
    }
    return result;
}
function parseAnnotationMap(raw) {
    if (!raw || typeof raw !== 'object')
        return undefined;
    const result = {};
    for (const [key, value] of Object.entries(raw)) {
        if (!value || typeof value !== 'object')
            continue;
        const v = value;
        const created = parseFlexibleDate(v[share_item_model_1.SHARE_ANNOTATION_FIELDS.CREATED] ?? v.created);
        const cfiRaw = str(v[share_item_model_1.SHARE_ANNOTATION_FIELDS.CFI_RANGE] ?? v.cfiRange);
        const share = {
            page: num(v[share_item_model_1.SHARE_ANNOTATION_FIELDS.PAGE] ?? v.page),
            pages: num(v[share_item_model_1.SHARE_ANNOTATION_FIELDS.PAGES] ?? v.pages),
            fontSize: num(v[share_item_model_1.SHARE_ANNOTATION_FIELDS.FONT_SIZE] ?? v.fontSize),
            type: str(v[share_item_model_1.SHARE_ANNOTATION_FIELDS.TYPE] ?? v.type, 'PageMark'),
            chapterNumber: num(v[share_item_model_1.SHARE_ANNOTATION_FIELDS.CHAPTER_NUMBER] ?? v.chapterNumber),
            chapter: str(v[share_item_model_1.SHARE_ANNOTATION_FIELDS.CHAPTER] ?? v.chapter),
            text: str(v[share_item_model_1.SHARE_ANNOTATION_FIELDS.TEXT] ?? v.text),
            range: str(v[share_item_model_1.SHARE_ANNOTATION_FIELDS.RANGE] ?? v.range),
            annotation: str(v[share_item_model_1.SHARE_ANNOTATION_FIELDS.ANNOTATION] ?? v.annotation),
            favorite: bool(v[share_item_model_1.SHARE_ANNOTATION_FIELDS.FAVORITE] ?? v.favorite),
            color: str(v[share_item_model_1.SHARE_ANNOTATION_FIELDS.COLOR] ?? v.color),
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
function parseShareItemFromCloud(raw) {
    const lastAccess = parseFlexibleDate(raw[share_item_model_1.SHARE_ITEM_FIELDS.LAST_ACCESS] ?? raw.lastAccess);
    const sync = parseFlexibleDate(raw[share_item_model_1.SHARE_ITEM_FIELDS.SYNC] ?? raw.sync);
    const bookMark = num(raw[share_item_model_1.SHARE_ITEM_FIELDS.BOOKMARK] ?? raw.bookMark);
    const pages = num(raw[share_item_model_1.SHARE_ITEM_FIELDS.PAGES] ?? raw.pages, 1);
    const completed = raw[share_item_model_1.SHARE_ITEM_FIELDS.COMPLETED] != null || raw.completed != null
        ? bool(raw[share_item_model_1.SHARE_ITEM_FIELDS.COMPLETED] ?? raw.completed)
        : bookMark >= pages;
    return {
        file: str(raw[share_item_model_1.SHARE_ITEM_FIELDS.FILE] ?? raw.file),
        bookMark,
        pages,
        completed,
        favorite: bool(raw[share_item_model_1.SHARE_ITEM_FIELDS.FAVORITE] ?? raw.favorite),
        lastAccess: lastAccess ? lastAccess.toISOString() : share_item_model_1.SHARE_MARK_INITIAL_SYNC,
        sync: sync ? sync.toISOString() : new Date().toISOString(),
        history: parseHistoryMap(raw[share_item_model_1.SHARE_ITEM_FIELDS.HISTORY] ?? raw.history),
        annotation: parseAnnotationMap(raw[share_item_model_1.SHARE_ITEM_FIELDS.ANNOTATION] ?? raw.annotation),
        alter: false,
        received: false,
        processed: false
    };
}
/** Serialize ShareItem with Portuguese keys for Drive JSON / Firestore. */
function serializeShareItemForCloud(item, useFirestoreTimestamps = false) {
    const lastAccess = parseFlexibleDate(item.lastAccess) || new Date(share_item_model_1.SHARE_MARK_INITIAL_SYNC);
    const sync = parseFlexibleDate(item.sync) || new Date();
    const history = {};
    if (item.history) {
        for (const [key, h] of Object.entries(item.history)) {
            const start = parseFlexibleDate(h.start) || new Date();
            const end = parseFlexibleDate(h.end) || new Date();
            history[key] = {
                [share_item_model_1.SHARE_HISTORY_FIELDS.PAGE_START]: h.pageStart,
                [share_item_model_1.SHARE_HISTORY_FIELDS.PAGE_END]: h.pageEnd,
                [share_item_model_1.SHARE_HISTORY_FIELDS.PAGES]: h.pages,
                [share_item_model_1.SHARE_HISTORY_FIELDS.COMPLETED]: h.completed,
                [share_item_model_1.SHARE_HISTORY_FIELDS.VOLUME]: h.volume,
                [share_item_model_1.SHARE_HISTORY_FIELDS.CHAPTERS_READ]: h.chaptersRead,
                [share_item_model_1.SHARE_HISTORY_FIELDS.START]: useFirestoreTimestamps ? toFirestoreTimestamp(start) : formatShareMarkDate(start),
                [share_item_model_1.SHARE_HISTORY_FIELDS.END]: useFirestoreTimestamps ? toFirestoreTimestamp(end) : formatShareMarkDate(end),
                [share_item_model_1.SHARE_HISTORY_FIELDS.SECONDS_READ]: h.secondsRead,
                [share_item_model_1.SHARE_HISTORY_FIELDS.AVERAGE_TIME_BY_PAGE]: h.averageTimeByPage,
                [share_item_model_1.SHARE_HISTORY_FIELDS.USE_TTS]: h.useTTS
            };
        }
    }
    const annotation = {};
    if (item.annotation) {
        for (const [key, a] of Object.entries(item.annotation)) {
            const created = parseFlexibleDate(a.created) || new Date();
            const entry = {
                [share_item_model_1.SHARE_ANNOTATION_FIELDS.PAGE]: a.page,
                [share_item_model_1.SHARE_ANNOTATION_FIELDS.PAGES]: a.pages,
                [share_item_model_1.SHARE_ANNOTATION_FIELDS.FONT_SIZE]: a.fontSize,
                [share_item_model_1.SHARE_ANNOTATION_FIELDS.TYPE]: a.type,
                [share_item_model_1.SHARE_ANNOTATION_FIELDS.CHAPTER_NUMBER]: a.chapterNumber,
                [share_item_model_1.SHARE_ANNOTATION_FIELDS.CHAPTER]: a.chapter,
                [share_item_model_1.SHARE_ANNOTATION_FIELDS.TEXT]: a.text,
                [share_item_model_1.SHARE_ANNOTATION_FIELDS.RANGE]: a.range,
                [share_item_model_1.SHARE_ANNOTATION_FIELDS.ANNOTATION]: a.annotation,
                [share_item_model_1.SHARE_ANNOTATION_FIELDS.FAVORITE]: a.favorite,
                [share_item_model_1.SHARE_ANNOTATION_FIELDS.COLOR]: a.color,
                [share_item_model_1.SHARE_ANNOTATION_FIELDS.CREATED]: useFirestoreTimestamps ? toFirestoreTimestamp(created) : formatShareMarkDate(created)
            };
            const cfi = (a.cfiRange || '').trim();
            if (cfi) {
                entry[share_item_model_1.SHARE_ANNOTATION_FIELDS.CFI_RANGE] = cfi;
            }
            annotation[key] = entry;
        }
    }
    return {
        [share_item_model_1.SHARE_ITEM_FIELDS.FILE]: item.file,
        [share_item_model_1.SHARE_ITEM_FIELDS.BOOKMARK]: item.bookMark,
        [share_item_model_1.SHARE_ITEM_FIELDS.PAGES]: item.pages,
        [share_item_model_1.SHARE_ITEM_FIELDS.COMPLETED]: item.completed,
        [share_item_model_1.SHARE_ITEM_FIELDS.FAVORITE]: item.favorite,
        [share_item_model_1.SHARE_ITEM_FIELDS.LAST_ACCESS]: useFirestoreTimestamps ? toFirestoreTimestamp(lastAccess) : formatShareMarkDate(lastAccess),
        [share_item_model_1.SHARE_ITEM_FIELDS.SYNC]: useFirestoreTimestamps ? toFirestoreTimestamp(sync) : formatShareMarkDate(sync),
        [share_item_model_1.SHARE_ITEM_FIELDS.HISTORY]: history,
        [share_item_model_1.SHARE_ITEM_FIELDS.ANNOTATION]: annotation
    };
}
function toFirestoreTimestamp(date) {
    const ms = date.getTime();
    return {
        seconds: Math.floor(ms / 1000),
        nanos: (ms % 1000) * 1e6
    };
}
function serializeShareMarkFile(share) {
    return {
        [share_item_model_1.SHARE_MARK_FILE_FIELDS.ORIGIN]: share.origin ?? '',
        [share_item_model_1.SHARE_MARK_FILE_FIELDS.LAST_ALTERATION]: share.lastAlteration
            ? formatShareMarkDate(parseFlexibleDate(share.lastAlteration) || new Date())
            : formatShareMarkDate(),
        [share_item_model_1.SHARE_MARK_FILE_FIELDS.TYPE]: share.type ?? 'MANGA',
        [share_item_model_1.SHARE_MARK_FILE_FIELDS.MARKS]: (share.marks || []).map((m) => serializeShareItemForCloud(m, false))
    };
}
function parseShareMarkFile(raw) {
    if (!raw || typeof raw !== 'object') {
        return { origin: '', lastAlteration: null, type: 'MANGA', marks: [] };
    }
    const o = raw;
    const marksRaw = (o[share_item_model_1.SHARE_MARK_FILE_FIELDS.MARKS] ?? o.marks ?? []);
    const marks = [];
    if (Array.isArray(marksRaw)) {
        for (const entry of marksRaw) {
            if (entry && typeof entry === 'object') {
                marks.push(parseShareItemFromCloud(entry));
            }
        }
    }
    const typeRaw = str(o[share_item_model_1.SHARE_MARK_FILE_FIELDS.TYPE] ?? o.type, 'MANGA').toUpperCase();
    return {
        origin: str(o[share_item_model_1.SHARE_MARK_FILE_FIELDS.ORIGIN] ?? o.origin),
        lastAlteration: (() => {
            const d = parseFlexibleDate(o[share_item_model_1.SHARE_MARK_FILE_FIELDS.LAST_ALTERATION] ?? o.lastAlteration);
            return d ? d.toISOString() : null;
        })(),
        type: typeRaw === 'BOOK' ? 'BOOK' : 'MANGA',
        marks
    };
}
function parseRangeString(range) {
    if (!range)
        return undefined;
    const parts = range.split(',').map((p) => Number(p.trim())).filter((n) => !Number.isNaN(n));
    return parts.length >= 2 ? [parts[0], parts[1]] : undefined;
}
