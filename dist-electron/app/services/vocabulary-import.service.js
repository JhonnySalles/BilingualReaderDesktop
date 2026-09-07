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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VocabularyImportService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const parse_factory_1 = require("../parser/manga/parse-factory");
const settings_service_1 = require("./settings.service");
const constants_1 = require("../utils/constants");
const subtitle_model_1 = require("../../src/app/core/models/entities/subtitle.model");
const ebook_converter_service_1 = require("./ebook-converter.service");
class VocabularyImportService {
    storage;
    tokenizerPromise = null;
    constructor(storage) {
        this.storage = storage;
    }
    async importManga(mangaId, forced = false) {
        const manga = this.storage.findMangaById(mangaId);
        if (!manga?.path) {
            return { ok: false, linked: 0, message: 'Mangá não encontrado' };
        }
        if (!forced && manga.lastVocabImport) {
            const fileMtime = this.safeMtime(manga.path);
            const last = Date.parse(manga.lastVocabImport);
            if (fileMtime && last && fileMtime <= last) {
                return {
                    ok: true,
                    skipped: true,
                    linked: 0,
                    message: 'Vocabulário já importado para este arquivo'
                };
            }
        }
        const parser = await parse_factory_1.ParseFactory.create(manga.path);
        if (!parser) {
            return { ok: false, linked: 0, message: 'Não foi possível abrir o arquivo do mangá' };
        }
        try {
            if (!parser.hasSubtitles()) {
                return { ok: false, linked: 0, message: 'Este mangá não possui legendas JSON' };
            }
            const counts = new Map();
            for (const raw of parser.getSubtitles()) {
                this.collectFromSubtitleJson(raw, counts);
            }
            if (counts.size === 0) {
                return {
                    ok: false,
                    linked: 0,
                    message: 'Nenhum vocabulário japonês encontrado nas legendas'
                };
            }
            if (forced) {
                this.storage.vocabularyRepository.clearMangaLinks(mangaId);
            }
            let linked = 0;
            for (const item of counts.values()) {
                const saved = this.storage.vocabularyRepository.upsert(item.vocab);
                if (!saved.id)
                    continue;
                this.storage.vocabularyRepository.linkManga(mangaId, saved.id, Math.max(1, item.appears));
                linked++;
            }
            this.storage.saveManga({
                id: mangaId,
                lastVocabImport: new Date().toISOString(),
                fileAlteration: manga.fileAlteration
            });
            return { ok: true, linked, message: `${linked} palavras vinculadas` };
        }
        catch (e) {
            console.error('[vocabulary-import] manga failed', e);
            return { ok: false, linked: 0, message: e?.message || 'Falha ao importar vocabulário' };
        }
        finally {
            try {
                parser.destroy();
            }
            catch { /* ignore */ }
        }
    }
    async importBook(bookId, forced = false) {
        const book = this.storage.findBookById(bookId);
        if (!book?.path) {
            return { ok: false, linked: 0, message: 'Livro não encontrado' };
        }
        if (!forced && book.lastVocabImport) {
            const fileMtime = this.safeMtime(book.path);
            const last = Date.parse(book.lastVocabImport);
            if (fileMtime && last && fileMtime <= last) {
                return {
                    ok: true,
                    skipped: true,
                    linked: 0,
                    message: 'Vocabulário já importado para este arquivo'
                };
            }
        }
        try {
            const epubPath = await ebook_converter_service_1.EBookConverterService.instance.convertToEpub(book.path);
            const textChunks = this.extractEpubText(epubPath);
            if (!textChunks.length) {
                return { ok: false, linked: 0, message: 'Não foi possível extrair texto do livro' };
            }
            const tokenizer = await this.getTokenizer();
            const counts = new Map();
            if (tokenizer) {
                for (const chunk of textChunks) {
                    for (const token of tokenizer.tokenize(chunk)) {
                        const surface = (token.surface_form || '').trim();
                        const basic = (token.basic_form || surface).trim();
                        if (!surface || basic === '*')
                            continue;
                        if (!this.isJapaneseWord(surface))
                            continue;
                        const pos = token.pos || '';
                        if (pos.startsWith('助詞') || pos.startsWith('助動詞') || pos.startsWith('記号'))
                            continue;
                        const key = `${surface}\0${basic}`;
                        const existing = counts.get(key);
                        if (existing) {
                            existing.appears += 1;
                        }
                        else {
                            counts.set(key, {
                                appears: 1,
                                vocab: {
                                    word: surface,
                                    basicForm: basic,
                                    reading: token.reading || '',
                                    english: '',
                                    portuguese: '',
                                    jlpt: '',
                                    revised: false,
                                    favorite: false,
                                    appears: 0
                                }
                            });
                        }
                    }
                }
            }
            else {
                // Fallback: match dictionary entries that appear in text
                this.matchDictionaryInText(textChunks.join('\n'), counts);
            }
            if (counts.size === 0) {
                return { ok: false, linked: 0, message: 'Nenhuma palavra encontrada no livro' };
            }
            if (forced) {
                this.storage.vocabularyRepository.clearBookLinks(bookId);
            }
            let linked = 0;
            for (const item of counts.values()) {
                // Prefer linking known dictionary entries; upsert creates thin stubs when missing
                const known = this.storage.vocabularyRepository.findByWordAndBasicForm(item.vocab.word, item.vocab.basicForm) ||
                    this.storage.vocabularyRepository.findByWord(item.vocab.word);
                const saved = known
                    ? known
                    : this.storage.vocabularyRepository.upsert(item.vocab);
                if (!saved.id)
                    continue;
                this.storage.vocabularyRepository.linkBook(bookId, saved.id, item.appears);
                linked++;
            }
            this.storage.saveBook({
                id: bookId,
                lastVocabImport: new Date().toISOString(),
                fileAlteration: book.fileAlteration
            });
            return { ok: true, linked, message: `${linked} palavras vinculadas` };
        }
        catch (e) {
            console.error('[vocabulary-import] book failed', e);
            return { ok: false, linked: 0, message: e?.message || 'Falha ao importar vocabulário' };
        }
    }
    shouldAutoProcessManga() {
        return !!settings_service_1.SettingsService.instance.get(constants_1.GeneralConsts.KEYS.READER.MANGA_PROCESS_VOCABULARY, true);
    }
    shouldAutoProcessBook() {
        return !!settings_service_1.SettingsService.instance.get(constants_1.GeneralConsts.KEYS.READER.BOOK_PROCESS_VOCABULARY, true);
    }
    collectFromSubtitleJson(raw, counts) {
        let data;
        try {
            data = JSON.parse(raw);
        }
        catch {
            return;
        }
        const chapters = this.extractJapaneseChapters(data);
        for (const chapter of chapters) {
            const chapterVocabs = this.readVocabList(chapter.vocabularios);
            for (const v of chapterVocabs) {
                this.bumpCount(counts, v, 0);
            }
            const pages = chapter.paginas || chapter.pages || [];
            for (const page of pages) {
                const pageVocabs = this.readVocabList(page.vocabularios);
                for (const v of pageVocabs) {
                    this.bumpCount(counts, v, 1);
                }
            }
            // Ensure chapter-only entries still get appears >= 1
            for (const v of chapterVocabs) {
                const key = this.vocabKey(v);
                const entry = counts.get(key);
                if (entry && entry.appears < 1)
                    entry.appears = 1;
            }
        }
    }
    extractJapaneseChapters(data) {
        if (!data || typeof data !== 'object')
            return [];
        const isJapanese = (lang) => {
            const s = String(lang || '').toUpperCase();
            return s === 'JAPANESE' || s === 'JA' || s === 'JP' || s.includes('JAPAN');
        };
        // Volume wrapper
        if (Array.isArray(data.capitulos) || Array.isArray(data.chapters)) {
            const chapters = data.capitulos || data.chapters || [];
            const lang = data.lingua || data.language;
            return chapters.filter((ch) => isJapanese(ch?.lingua || ch?.language || lang));
        }
        // Single chapter
        if (data.vocabularios || data.paginas || data.pages) {
            if (isJapanese(data.lingua || data.language))
                return [data];
            return [];
        }
        // Array of chapters
        if (Array.isArray(data)) {
            return data.filter((ch) => isJapanese(ch?.lingua || ch?.language));
        }
        return [];
    }
    readVocabList(list) {
        if (!Array.isArray(list) && !(list instanceof Set))
            return [];
        const arr = Array.isArray(list) ? list : Array.from(list);
        const out = [];
        for (const item of arr) {
            const n = (0, subtitle_model_1.normalizeVocabularyWire)(item);
            if (!n)
                continue;
            out.push({
                word: n.word,
                basicForm: n.basicForm || n.word,
                reading: n.reading || '',
                english: n.english || '',
                portuguese: n.portuguese || '',
                jlpt: n.jlpt || '',
                revised: !!n.revised,
                favorite: !!n.favorite,
                appears: n.appears || 0
            });
        }
        return out;
    }
    bumpCount(counts, vocab, delta) {
        const key = this.vocabKey(vocab);
        const existing = counts.get(key);
        if (existing) {
            existing.appears += delta;
            // Prefer richer metadata
            if (!existing.vocab.portuguese && vocab.portuguese)
                existing.vocab.portuguese = vocab.portuguese;
            if (!existing.vocab.english && vocab.english)
                existing.vocab.english = vocab.english;
            if (!existing.vocab.reading && vocab.reading)
                existing.vocab.reading = vocab.reading;
        }
        else {
            counts.set(key, { vocab: { ...vocab }, appears: Math.max(0, delta) });
        }
    }
    vocabKey(v) {
        return `${v.word}\0${v.basicForm || v.word}`;
    }
    extractEpubText(epubPath) {
        if (!fs.existsSync(epubPath))
            return [];
        try {
            const zip = new adm_zip_1.default(epubPath);
            const entries = zip.getEntries().filter(e => {
                if (e.isDirectory)
                    return false;
                const name = e.entryName.toLowerCase();
                return name.endsWith('.xhtml') || name.endsWith('.html') || name.endsWith('.htm');
            });
            entries.sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }));
            const chunks = [];
            for (const entry of entries) {
                const html = zip.readAsText(entry);
                const text = html
                    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
                    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&')
                    .replace(/\s+/g, ' ')
                    .trim();
                if (text)
                    chunks.push(text);
            }
            return chunks;
        }
        catch (e) {
            console.warn('[vocabulary-import] epub extract failed', e);
            return [];
        }
    }
    matchDictionaryInText(text, counts) {
        // Limit scan to words that appear as substrings — sample by length buckets for performance
        const candidates = this.storage.vocabularyRepository.list().filter(v => v.word && v.word.length >= 2 && /[\u3040-\u30ff\u4e00-\u9faf]/.test(v.word));
        // Prefer longer matches first; cap work
        candidates.sort((a, b) => (b.word?.length || 0) - (a.word?.length || 0));
        const maxCheck = Math.min(candidates.length, 8000);
        for (let i = 0; i < maxCheck; i++) {
            const v = candidates[i];
            let idx = 0;
            let appears = 0;
            while (appears < 50) {
                const found = text.indexOf(v.word, idx);
                if (found < 0)
                    break;
                appears++;
                idx = found + v.word.length;
            }
            if (appears > 0) {
                counts.set(this.vocabKey(v), { vocab: v, appears });
            }
        }
    }
    async getTokenizer() {
        if (!this.tokenizerPromise) {
            this.tokenizerPromise = this.loadKuromoji();
        }
        return this.tokenizerPromise;
    }
    async loadKuromoji() {
        try {
            // Dynamic require so missing dep doesn't crash boot
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const kuromoji = require('kuromoji');
            const dictPath = this.resolveKuromojiDict();
            if (!dictPath || !fs.existsSync(dictPath)) {
                console.warn('[vocabulary-import] kuromoji dict not found', dictPath);
                return null;
            }
            console.log('[vocabulary-import] loading kuromoji dict from', dictPath);
            return await new Promise((resolve) => {
                kuromoji.builder({ dicPath: dictPath }).build((err, tokenizer) => {
                    if (err || !tokenizer) {
                        console.warn('[vocabulary-import] kuromoji load failed', err, 'dict=', dictPath);
                        resolve(null);
                        return;
                    }
                    console.log('[vocabulary-import] kuromoji ready');
                    resolve(tokenizer);
                });
            });
        }
        catch (e) {
            console.warn('[vocabulary-import] kuromoji unavailable', e);
            return null;
        }
    }
    /**
     * Resolve kuromoji IPADIC dict folder for:
     * - yarn/npm install (require.resolve)
     * - tsc output under dist-electron/app/services
     * - packaged Electron with asarUnpack → app.asar.unpacked/node_modules/kuromoji/dict
     */
    resolveKuromojiDict() {
        const candidates = [];
        try {
            const pkgDir = path.dirname(require.resolve('kuromoji/package.json'));
            candidates.push(path.join(pkgDir, 'dict'));
            // If resolve landed inside app.asar, prefer the unpacked sibling
            if (pkgDir.includes(`${path.sep}app.asar${path.sep}`) || pkgDir.includes('/app.asar/')) {
                candidates.unshift(pkgDir.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`));
                candidates.unshift(pkgDir.replace('/app.asar/', '/app.asar.unpacked/'));
            }
        }
        catch { /* package not resolvable */ }
        if (typeof process.resourcesPath === 'string' && process.resourcesPath) {
            candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'kuromoji', 'dict'), path.join(process.resourcesPath, 'node_modules', 'kuromoji', 'dict'));
        }
        // dist-electron/app/services → project root (3 levels up)
        candidates.push(path.join(__dirname, '..', '..', '..', 'node_modules', 'kuromoji', 'dict'), path.join(__dirname, '..', '..', 'node_modules', 'kuromoji', 'dict'), path.join(process.cwd(), 'node_modules', 'kuromoji', 'dict'));
        for (const c of candidates) {
            try {
                if (c && fs.existsSync(c) && fs.existsSync(path.join(c, 'base.dat.gz'))) {
                    return c;
                }
            }
            catch { /* ignore */ }
        }
        return candidates.find(Boolean) || path.join(process.cwd(), 'node_modules', 'kuromoji', 'dict');
    }
    isJapaneseWord(text) {
        return /[\u3040-\u30ff\u4e00-\u9faf]/.test(text) && text.length > 0;
    }
    safeMtime(filePath) {
        try {
            return fs.statSync(filePath).mtimeMs;
        }
        catch {
            return null;
        }
    }
}
exports.VocabularyImportService = VocabularyImportService;
