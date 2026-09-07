"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VocabularyController = void 0;
const electron_1 = require("electron");
const vocabulary_import_service_1 = require("../services/vocabulary-import.service");
class VocabularyController {
    storage;
    importer;
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
}
exports.VocabularyController = VocabularyController;
