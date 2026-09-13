"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookReaderController = void 0;
const electron_1 = require("electron");
const book_reader_session_service_1 = require("../services/book-reader-session.service");
const epub_book_extractor_1 = require("../parser/book/epub-book-extractor");
const tracker_service_1 = require("../services/tracker.service");
const book_image_cover_controller_1 = require("./book-image-cover.controller");
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
            const bookMark = Math.min(Math.max(0, Math.floor(payload.bookMark)), pages);
            const isCompleted = bookMark >= pages;
            const now = new Date().toISOString();
            const id = this.storage.saveBook({
                ...book,
                bookMark,
                pages,
                ...(payload.bookMarkCfi ? { bookMarkCfi: payload.bookMarkCfi } : {}),
                ...(payload.chapter ? { chapter: payload.chapter } : {}),
                ...(payload.chapterDescription ? { chapterDescription: payload.chapterDescription } : {}),
                completed: isCompleted,
                lastAccess: now,
                lastAlteration: now
            });
            // Auto update track progress if completed
            if (isCompleted && book.fkLibrary) {
                try {
                    const trackerService = new tracker_service_1.TrackerService(this.storage);
                    const match = trackerService.matchTrack(book.fkLibrary, book.title || '', book.name || '');
                    if (match.track?.id) {
                        const nextVol = match.volume !== null ? Math.max(match.track.volumesRead, match.volume) : match.track.volumesRead;
                        const nextCh = match.chapter !== null ? Math.max(match.track.chaptersRead, match.chapter) : match.track.chaptersRead;
                        if (nextVol > match.track.volumesRead || nextCh > match.track.chaptersRead) {
                            this.storage.updateTrackProgress(match.track.id, nextCh, nextVol);
                        }
                    }
                }
                catch (err) {
                    console.warn('[BookReaderController] Failed to auto update track progress:', err);
                }
            }
            return this.storage.findBookById(id) || null;
        });
        electron_1.ipcMain.handle('book:calculate-pages', async (_event, bookId) => {
            const book = this.storage.findBookById(bookId);
            if (!book?.path)
                return null;
            try {
                const pages = await epub_book_extractor_1.EpubBookExtractor.calculatePages(book.path);
                if (pages > 0 && pages !== book.pages) {
                    const id = this.storage.saveBook({
                        ...book,
                        pages
                    });
                    return this.storage.findBookById(id) || null;
                }
            }
            catch (err) {
                console.warn(`[BookReaderController] Failed to calculate pages for book ${bookId}:`, err);
            }
            return book;
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
            if (!bookId)
                return null;
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
        electron_1.ipcMain.handle('book:get-cover-3d', async (_event, bookId) => {
            const book = this.storage.findBookById(bookId);
            if (!book)
                return null;
            return book_image_cover_controller_1.BookImageCoverController.instance.getBookCover3D(book);
        });
    }
}
exports.BookReaderController = BookReaderController;
