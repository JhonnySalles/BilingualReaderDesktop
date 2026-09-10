"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VocabularyController = void 0;
const electron_1 = require("electron");
const vocabulary_import_service_1 = require("../services/vocabulary-import.service");
const japanese_tokenizer_service_1 = require("../services/japanese-tokenizer.service");
class VocabularyController {
    storage;
    importer;
    tokenizer = japanese_tokenizer_service_1.JapaneseTokenizerService.getInstance();
    constructor(storage) {
        this.storage = storage;
        this.importer = new vocabulary_import_service_1.VocabularyImportService(storage);
    }
    registerIpcHandlers() {
        electron_1.ipcMain.handle('vocabulary:search', async (_event, options) => {
            return this.storage.searchVocabulary(options || {});
        });
        electron_1.ipcMain.handle('vocabulary:get', async (_event, id) => {
            return this.storage.getVocabulary(id) ?? null;
        });
        electron_1.ipcMain.handle('vocabulary:setFavorite', async (_event, id, favorite) => {
            return this.storage.setVocabularyFavorite(id, !!favorite) ?? null;
        });
        electron_1.ipcMain.handle('vocabulary:related', async (_event, vocabularyId, titleHint) => {
            return this.storage.getVocabularyRelated(vocabularyId, titleHint);
        });
        electron_1.ipcMain.handle('vocabulary:lookup', async (_event, options) => {
            return this.lookupVocabulary(options || { text: '' });
        });
        electron_1.ipcMain.handle('kanjax:get', async (_event, kanji) => {
            return this.storage.getKanjax(kanji);
        });
        electron_1.ipcMain.handle('kanjax:forWord', async (_event, word) => {
            return this.storage.getKanjaxForWord(word || '');
        });
        electron_1.ipcMain.handle('vocabulary:importManga', async (_event, mangaId, forced = true) => {
            return this.importer.importManga(mangaId, forced !== false);
        });
        electron_1.ipcMain.handle('vocabulary:importBook', async (_event, bookId, forced = true) => {
            return this.importer.importBook(bookId, forced !== false);
        });
    }
    async lookupVocabulary(options) {
        const text = String(options?.text || '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!text)
            return null;
        const mangaId = options.mangaId ?? null;
        const bookId = options.bookId ?? null;
        const repo = this.storage.vocabularyRepository;
        const tryExact = (word, basic) => {
            const w = word.trim();
            if (!w)
                return undefined;
            if (basic != null && basic.trim()) {
                const both = repo.findByWordAndBasicForm(w, basic.trim());
                if (both)
                    return both;
            }
            return repo.findByWord(w);
        };
        let hit = tryExact(text);
        if (hit)
            return hit;
        try {
            const tokens = await this.tokenizer.tokenize(text);
            for (const t of tokens) {
                hit = tryExact(t.surface, t.dictionaryForm);
                if (hit)
                    return hit;
                if (t.dictionaryForm && t.dictionaryForm !== t.surface) {
                    hit = tryExact(t.dictionaryForm);
                    if (hit)
                        return hit;
                }
            }
        }
        catch (e) {
            console.warn('[vocabulary] tokenize during lookup failed', e);
        }
        const page = repo.searchPage({
            query: text,
            mangaId,
            bookId,
            limit: 1,
            offset: 0,
            order: 'appears',
            desc: true
        });
        return page.items[0] ?? null;
    }
}
exports.VocabularyController = VocabularyController;
