import { BrowserWindow, ipcMain } from 'electron';
import { StorageService } from '../database/storage.service';
import { MangaReaderSessionService } from '../services/manga-reader-session.service';

export class MangaReaderController {
  private sessionService = new MangaReaderSessionService();

  constructor(private storage: StorageService) {}

  getSessionService(): MangaReaderSessionService {
    return this.sessionService;
  }

  registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
    ipcMain.handle('manga-reader:open', async (_event, mangaId: number) => {
      const manga = this.storage.findMangaById(mangaId);
      if (!manga) {
        throw new Error('Mangá não encontrado');
      }

      const result = await this.sessionService.open(
        manga.id!,
        manga.path,
        manga.title || manga.name || 'Mangá',
        manga.bookMark ?? 0,
        !!manga.favorite,
        getWindow()
      );

      // Persist chapters discovered at open if DB was empty
      if ((!manga.chapters || manga.chapters.length === 0) && result.chapters.length > 0) {
        this.storage.saveManga({
          ...manga,
          chapters: result.chapters,
          pages: result.pageCount
        });
      } else if (manga.pages !== result.pageCount) {
        this.storage.saveManga({
          ...manga,
          pages: result.pageCount
        });
      }

      return result;
    });

    ipcMain.handle('manga-reader:close', async (_event, sessionId: string) => {
      return this.sessionService.close(sessionId);
    });

    ipcMain.handle('manga:set-bookmark', async (_event, mangaId: number, page: number) => {
      const manga = this.storage.findMangaById(mangaId);
      if (!manga?.id) return null;
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

    ipcMain.handle('manga:toggle-favorite', async (_event, mangaId: number) => {
      const manga = this.storage.findMangaById(mangaId);
      if (!manga?.id) return null;
      const now = new Date().toISOString();
      const id = this.storage.saveManga({
        ...manga,
        favorite: !manga.favorite,
        lastAlteration: now
      });
      return this.storage.findMangaById(id) || null;
    });

    ipcMain.handle('manga:list-annotations', async (_event, mangaId: number) => {
      if (!mangaId) return [];
      return this.storage.listMangaAnnotations(mangaId);
    });

    ipcMain.handle('manga:list-all-annotations', async () => {
      return this.storage.listAllMangaAnnotations();
    });

    ipcMain.handle('manga:save-annotation', async (_event, annotation: any) => {
      if (!annotation?.fkManga) return null;
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

    ipcMain.handle('manga:delete-annotation', async (_event, id: number) => {
      if (!id) return false;
      return this.storage.deleteMangaAnnotation(id);
    });
  }
}
