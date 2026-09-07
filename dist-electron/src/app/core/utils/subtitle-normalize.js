"use strict";
/**
 * Normalize Android BilingualReader subtitle JSON (Gson wire) into a stable catalog.
 * Accepts volume wrapper (`capitulos`) or a bare chapter root.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSubtitleJsonString = parseSubtitleJsonString;
exports.parseSubtitleJsonObject = parseSubtitleJsonObject;
exports.buildSubtitleCatalog = buildSubtitleCatalog;
exports.emptySubtitleCatalog = emptySubtitleCatalog;
function num(v, fallback = 0) {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}
function str(v, fallback = '') {
    return v == null ? fallback : String(v);
}
function normalizeLanguage(raw) {
    const s = str(raw, 'JAPANESE').trim().toUpperCase();
    if (!s)
        return 'JAPANESE';
    return s;
}
function normalizeText(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const text = str(raw.texto ?? raw.text ?? raw.original).trim();
    if (!text)
        return null;
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
function normalizePage(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const textsRaw = raw.textos ?? raw.texts ?? raw.subTitleTexts ?? [];
    const texts = (Array.isArray(textsRaw) ? textsRaw : [])
        .map(normalizeText)
        .filter((t) => !!t)
        .sort((a, b) => a.sequence - b.sequence);
    return {
        name: str(raw.nomePagina ?? raw.name ?? raw.pageName),
        number: num(raw.numero ?? raw.number ?? raw.pageNumber),
        hash: str(raw.hash).toLowerCase(),
        texts
    };
}
function chapterKey(language, chapter) {
    return `${language} - Chapter ${chapter}`;
}
function normalizeChapter(raw, fallbackLang, fallbackManga, fallbackVolume) {
    if (!raw || typeof raw !== 'object')
        return null;
    const language = normalizeLanguage(raw.lingua ?? raw.language ?? fallbackLang);
    const chapter = num(raw.capitulo ?? raw.chapter ?? raw.chapterNumber, 0);
    const pagesRaw = raw.paginas ?? raw.pages ?? [];
    const pages = (Array.isArray(pagesRaw) ? pagesRaw : [])
        .map(normalizePage)
        .filter((p) => !!p);
    if (pages.length === 0)
        return null;
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
function parseSubtitleJsonString(raw) {
    let data;
    try {
        data = JSON.parse(raw);
    }
    catch {
        return [];
    }
    return parseSubtitleJsonObject(data);
}
function parseSubtitleJsonObject(data) {
    if (!data || typeof data !== 'object')
        return [];
    const chaptersRaw = data.capitulos ?? data.chapters;
    if (Array.isArray(chaptersRaw)) {
        const lang = normalizeLanguage(data.lingua ?? data.language);
        const manga = str(data.manga);
        const volume = num(data.volume ?? data.volumeNumber);
        return chaptersRaw
            .map((ch) => normalizeChapter(ch, lang, manga, volume))
            .filter((c) => !!c);
    }
    // Bare chapter (has paginas/pages)
    if (data.paginas || data.pages) {
        const ch = normalizeChapter(data);
        return ch ? [ch] : [];
    }
    return [];
}
/** Merge multiple JSON strings from an archive into one catalog. */
function buildSubtitleCatalog(rawJsonStrings, source = 'embedded') {
    const byKey = new Map();
    for (const raw of rawJsonStrings) {
        if (!raw?.trim())
            continue;
        for (const ch of parseSubtitleJsonString(raw)) {
            const existing = byKey.get(ch.key);
            if (!existing) {
                byKey.set(ch.key, ch);
            }
            else {
                // Prefer chapter with more pages
                if (ch.pages.length > existing.pages.length) {
                    byKey.set(ch.key, ch);
                }
            }
        }
    }
    const chapters = Array.from(byKey.values()).sort((a, b) => {
        const langCmp = a.language.localeCompare(b.language);
        if (langCmp !== 0)
            return langCmp;
        return a.chapter - b.chapter;
    });
    const languages = Array.from(new Set(chapters.map(c => c.language))).sort();
    return { chapters, languages, source };
}
function emptySubtitleCatalog() {
    return { chapters: [], languages: [], source: 'embedded' };
}
