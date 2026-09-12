"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MangaReaderController = void 0;
const electron_1 = require("electron");
const manga_reader_session_service_1 = require("../services/manga-reader-session.service");
const tracker_service_1 = require("../services/tracker.service");
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
            const dbChaptersPages = manga.chaptersPages || {};
            const dbHasPages = Object.keys(dbChaptersPages).length > 0;
            let chaptersPages = result.chaptersPages || {};
            if (Object.keys(chaptersPages).length === 0) {
                if (dbHasPages) {
                    chaptersPages = dbChaptersPages;
                }
                else {
                    chaptersPages = await this.sessionService.loadChaptersPages(manga.path);
                }
            }
            let chapters = result.chapters || [];
            if (chapters.length === 0 && Object.keys(chaptersPages).length > 0) {
                chapters = this.sessionService.resolveChapters([], chaptersPages);
            }
            const shouldPersistPages = Object.keys(chaptersPages).length > 0 &&
                (!dbHasPages || !manga.chapters || manga.chapters.length === 0);
            const shouldPersistChapters = (!manga.chapters || manga.chapters.length === 0) && chapters.length > 0;
            if (shouldPersistPages || shouldPersistChapters || manga.pages !== result.pageCount) {
                this.storage.saveManga({
                    ...manga,
                    ...(shouldPersistChapters || shouldPersistPages ? { chapters } : {}),
                    ...(shouldPersistPages ? { chaptersPages } : {}),
                    pages: result.pageCount
                });
            }
            return {
                ...result,
                chapters,
                chaptersPages
            };
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
            const bookMark = Math.min(Math.max(0, Math.floor(page)), pages);
            const isCompleted = bookMark >= pages;
            const id = this.storage.saveManga({
                ...manga,
                bookMark,
                completed: isCompleted,
                lastAccess: now,
                lastAlteration: now
            });
            // Auto update track progress if completed
            if (isCompleted && manga.fkLibrary) {
                try {
                    const trackerService = new tracker_service_1.TrackerService(this.storage);
                    const match = trackerService.matchTrack(manga.fkLibrary, manga.title || manga.series || '', manga.name || '');
                    if (match.track?.id) {
                        const nextVol = match.volume !== null ? Math.max(match.track.volumesRead, match.volume) : match.track.volumesRead;
                        const nextCh = match.chapter !== null ? Math.max(match.track.chaptersRead, match.chapter) : match.track.chaptersRead;
                        if (nextVol > match.track.volumesRead || nextCh > match.track.chaptersRead) {
                            this.storage.updateTrackProgress(match.track.id, nextCh, nextVol);
                        }
                    }
                }
                catch (err) {
                    console.warn('[MangaReaderController] Failed to auto update track progress:', err);
                }
            }
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
        electron_1.ipcMain.handle('subtitle:getForSession', async (_event, sessionId) => {
            return this.sessionService.getSessionSubtitles(sessionId);
        });
        electron_1.ipcMain.handle('subtitle:importJson', async (_event, sessionId) => {
            const win = getWindow();
            const result = await electron_1.dialog.showOpenDialog(win ?? undefined, {
                title: 'Importar legenda JSON',
                properties: ['openFile'],
                filters: [{ name: 'JSON', extensions: ['json'] }]
            });
            if (result.canceled || !result.filePaths[0])
                return null;
            return this.sessionService.importExternalSubtitles(sessionId, result.filePaths[0]);
        });
    }
}
exports.MangaReaderController = MangaReaderController;
