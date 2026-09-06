"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookReaderController = void 0;
const electron_1 = require("electron");
const book_reader_session_service_1 = require("../services/book-reader-session.service");
class BookReaderController {
    storage;
    sessionService = new book_reader_session_service_1.BookReaderSessionService();
    constructor(storage) {
        this.storage = storage;
    }
    getSessionService() {
        return this.sessionService;
    }
    registerIpcHandlers(_getWindow) {
        electron_1.ipcMain.handle('book-reader:open', async (_event, bookId) => {
            const book = this.storage.findBookById(bookId);
            if (!book) {
                throw new Error('Livro não encontrado');
            }
            const configuration = this.storage.getBookConfiguration(bookId) || null;
            return await this.sessionService.open(book.id, book.path, book.title || book.name || 'Livro', book.author || '', book.bookMark ?? 0, book.bookMarkCfi || '', !!book.favorite, configuration);
        });
        electron_1.ipcMain.handle('book-reader:close', async (_event, sessionId) => {
            return this.sessionService.close(sessionId);
        });
        electron_1.ipcMain.handle('book:set-bookmark', async (_event, payload) => {
            const book = this.storage.findBookById(payload.id);
            if (!book?.id)
                return null;
            const pages = Math.max(1, payload.pages ?? book.pages ?? 1);
            const bookMark = Math.min(Math.max(0, payload.bookMark), Math.max(0, pages - 1));
            const now = new Date().toISOString();
            const id = this.storage.saveBook({
                ...book,
                bookMark,
                bookMarkCfi: payload.bookMarkCfi ?? book.bookMarkCfi,
                chapter: payload.chapter ?? book.chapter,
                chapterDescription: payload.chapterDescription ?? book.chapterDescription,
                pages,
                completed: bookMark >= pages - 1,
                lastAccess: now,
                lastAlteration: now
            });
            return this.storage.findBookById(id) || null;
        });
        electron_1.ipcMain.handle('book:toggle-favorite', async (_event, bookId) => {
            const book = this.storage.findBookById(bookId);
            if (!book?.id)
                return null;
            const now = new Date().toISOString();
            const id = this.storage.saveBook({
                ...book,
                favorite: !book.favorite,
                lastAlteration: now
            });
            return this.storage.findBookById(id) || null;
        });
        electron_1.ipcMain.handle('book:get-configuration', async (_event, bookId) => {
            return this.storage.getBookConfiguration(bookId) || null;
        });
        electron_1.ipcMain.handle('book:save-configuration', async (_event, config) => {
            if (!config?.fkBook)
                return null;
            this.storage.saveBookConfiguration(config);
            return this.storage.getBookConfiguration(config.fkBook) || null;
        });
        electron_1.ipcMain.handle('book:list-annotations', async (_event, bookId) => {
            if (!bookId)
                return [];
            return this.storage.listBookAnnotations(bookId);
        });
        electron_1.ipcMain.handle('book:list-all-annotations', async () => {
            return this.storage.listAllBookAnnotations();
        });
        electron_1.ipcMain.handle('book:save-annotation', async (_event, annotation) => {
            if (!annotation?.fkBook)
                return null;
            const payload = {
                ...annotation,
                markType: annotation.markType || 'Annotation',
                pages: annotation.pages ?? 0,
                page: annotation.page ?? 0,
                text: annotation.text || ''
            };
            const id = this.storage.saveBookAnnotation(payload);
            return this.storage.getBookAnnotation(id) || null;
        });
        electron_1.ipcMain.handle('book:delete-annotation', async (_event, id) => {
            if (!id)
                return false;
            return this.storage.deleteBookAnnotation(id);
        });
        electron_1.ipcMain.handle('book:search-history-list', async (_event, bookId) => {
            if (!bookId)
                return [];
            return this.storage.listBookSearchHistory(bookId);
        });
        electron_1.ipcMain.handle('book:search-history-save', async (_event, bookId, search) => {
            if (!bookId || !(search || '').trim())
                return null;
            return this.storage.saveBookSearchHistory(bookId, search);
        });
        electron_1.ipcMain.handle('book:search-history-delete', async (_event, id) => {
            if (!id)
                return false;
            return this.storage.deleteBookSearchHistory(id);
        });
        electron_1.ipcMain.handle('book:search-history-delete-all', async (_event, bookId) => {
            if (!bookId)
                return false;
            return this.storage.deleteAllBookSearchHistory(bookId);
        });
    }
}
exports.BookReaderController = BookReaderController;
