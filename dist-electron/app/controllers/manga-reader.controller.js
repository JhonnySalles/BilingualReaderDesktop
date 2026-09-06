"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MangaReaderController = void 0;
const electron_1 = require("electron");
const manga_reader_session_service_1 = require("../services/manga-reader-session.service");
class MangaReaderController {
    storage;
    sessionService = new manga_reader_session_service_1.MangaReaderSessionService();
    constructor(storage) {
        this.storage = storage;
    }
    getSessionService() {
        return this.sessionService;
    }
    registerIpcHandlers(getWindow) {
        electron_1.ipcMain.handle('manga-reader:open', async (_event, mangaId) => {
            const manga = this.storage.findMangaById(mangaId);
            if (!manga) {
                throw new Error('Mangá não encontrado');
            }
            const result = await this.sessionService.open(manga.id, manga.path, manga.title || manga.name || 'Mangá', manga.bookMark ?? 0, !!manga.favorite, getWindow());
            // Persist chapters discovered at open if DB was empty
            if ((!manga.chapters || manga.chapters.length === 0) && result.chapters.length > 0) {
                this.storage.saveManga({
                    ...manga,
                    chapters: result.chapters,
                    pages: result.pageCount
                });
            }
            else if (manga.pages !== result.pageCount) {
                this.storage.saveManga({
                    ...manga,
                    pages: result.pageCount
                });
            }
            return result;
        });
        electron_1.ipcMain.handle('manga-reader:close', async (_event, sessionId) => {
            return this.sessionService.close(sessionId);
        });
        electron_1.ipcMain.handle('manga:set-bookmark', async (_event, mangaId, page) => {
            const manga = this.storage.findMangaById(mangaId);
            if (!manga?.id)
                return null;
            const now = new Date().toISOString();
            const pages = Math.max(1, manga.pages || 1);
            const bookMark = Math.min(Math.max(0, page), pages - 1);
            const id = this.storage.saveManga({
                ...manga,
                bookMark,
                completed: bookMark >= pages - 1,
                lastAccess: now,
                lastAlteration: now
            });
            return this.storage.findMangaById(id) || null;
        });
        electron_1.ipcMain.handle('manga:toggle-favorite', async (_event, mangaId) => {
            const manga = this.storage.findMangaById(mangaId);
            if (!manga?.id)
                return null;
            const now = new Date().toISOString();
            const id = this.storage.saveManga({
                ...manga,
                favorite: !manga.favorite,
                lastAlteration: now
            });
            return this.storage.findMangaById(id) || null;
        });
        electron_1.ipcMain.handle('manga:list-annotations', async (_event, mangaId) => {
            if (!mangaId)
                return [];
            return this.storage.listMangaAnnotations(mangaId);
        });
        electron_1.ipcMain.handle('manga:list-all-annotations', async () => {
            return this.storage.listAllMangaAnnotations();
        });
        electron_1.ipcMain.handle('manga:save-annotation', async (_event, annotation) => {
            if (!annotation?.fkManga)
                return null;
            const payload = {
                ...annotation,
                markType: annotation.markType || 'PageMark',
                pages: annotation.pages ?? 0,
                page: annotation.page ?? 0,
                chapter: annotation.chapter || '',
                folder: annotation.folder || '',
                note: annotation.note || ''
            };
            const id = this.storage.saveMangaAnnotation(payload);
            return this.storage.getMangaAnnotation(id) || null;
        });
        electron_1.ipcMain.handle('manga:delete-annotation', async (_event, id) => {
            if (!id)
                return false;
            return this.storage.deleteMangaAnnotation(id);
        });
    }
}
exports.MangaReaderController = MangaReaderController;
