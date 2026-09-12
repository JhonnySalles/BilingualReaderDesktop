import { BrowserWindow, ipcMain } from 'electron';
import { StorageService } from '../database/storage.service';
import { BookReaderSessionService } from '../services/book-reader-session.service';
import { BookAnnotation, BookConfiguration } from '../../src/app/core/models/entities/book.model';
import { EpubBookExtractor } from '../parser/book/epub-book-extractor';
import { TrackerService } from '../services/tracker.service';


export class BookReaderController {
  private sessionService = new BookReaderSessionService();

  constructor(private storage: StorageService) {}

  getSessionService(): BookReaderSessionService {
    return this.sessionService;
  }

  registerIpcHandlers(_getWindow: () => BrowserWindow | null): void {
    ipcMain.handle('book-reader:open', async (_event, bookId: number) => {
      const book = this.storage.findBookById(bookId);
      if (!book) {
        throw new Error('Livro não encontrado');
      }

      const configuration = this.storage.getBookConfiguration(bookId) || null;

      return await this.sessionService.open(
        book.id!,
        book.path,
        book.title || book.name || 'Livro',
        book.author || '',
        book.bookMark ?? 0,
        book.bookMarkCfi || '',
        !!book.favorite,
        configuration
      );
    });

    ipcMain.handle('book-reader:close', async (_event, sessionId: string) => {
      return this.sessionService.close(sessionId);
    });

    ipcMain.handle(
      'book:set-bookmark',
      async (
        _event,
        payload: {
          id: number;
          bookMark: number;
          bookMarkCfi?: string;
          chapter?: string;
          chapterDescription?: string;
          pages?: number;
        }
      ) => {
        const book = this.storage.findBookById(payload.id);
        if (!book?.id) return null;

        const pages = Math.max(1, payload.pages ?? book.pages ?? 1);
        const bookMark = Math.min(Math.max(0, Math.floor(payload.bookMark)), pages);
        const now = new Date().toISOString();
        const isCompleted = bookMark >= pages;

        const id = this.storage.saveBook({
          ...book,
          bookMark,
          bookMarkCfi: payload.bookMarkCfi ?? book.bookMarkCfi,
          chapter: payload.chapter ?? book.chapter,
          chapterDescription: payload.chapterDescription ?? book.chapterDescription,
          pages,
          completed: isCompleted,
          lastAccess: now,
          lastAlteration: now
        });

        // Auto update track progress if completed
        if (isCompleted && book.fkLibrary) {
          try {
            const trackerService = new TrackerService(this.storage);
            const match = trackerService.matchTrack(
              book.fkLibrary,
              book.title || '',
              book.name || ''
            );
            if (match.track?.id) {
              const nextVol = match.volume !== null ? Math.max(match.track.volumesRead, match.volume) : match.track.volumesRead;
              const nextCh = match.chapter !== null ? Math.max(match.track.chaptersRead, match.chapter) : match.track.chaptersRead;
              if (nextVol > match.track.volumesRead || nextCh > match.track.chaptersRead) {
                this.storage.updateTrackProgress(match.track.id, nextCh, nextVol);
              }
            }
          } catch (err) {
            console.warn('[BookReaderController] Failed to auto update track progress:', err);
          }
        }

        return this.storage.findBookById(id) || null;
      }
    );

    ipcMain.handle('book:calculate-pages', async (_event, bookId: number) => {
      const book = this.storage.findBookById(bookId);
      if (!book?.id || !book.path) return null;

      try {
        const wordCount = EpubBookExtractor.countWords(book.path);
        const calculatedPages = Math.max(1, Math.ceil(wordCount / 250));
        const now = new Date().toISOString();

        const id = this.storage.saveBook({
          ...book,
          pages: calculatedPages,
          lastAlteration: now
        });

        return this.storage.findBookById(id) || null;
      } catch (err) {
        console.error('[book:calculate-pages] Error calculating pages for book:', book.path, err);
        return book;
      }
    });

    ipcMain.handle('book:toggle-favorite', async (_event, bookId: number) => {
      const book = this.storage.findBookById(bookId);
      if (!book?.id) return null;
      const now = new Date().toISOString();
      const id = this.storage.saveBook({
        ...book,
        favorite: !book.favorite,
        lastAlteration: now
      });
      return this.storage.findBookById(id) || null;
    });

    ipcMain.handle('book:get-configuration', async (_event, bookId: number) => {
      return this.storage.getBookConfiguration(bookId) || null;
    });

    ipcMain.handle('book:save-configuration', async (_event, config: BookConfiguration) => {
      if (!config?.fkBook) return null;
      this.storage.saveBookConfiguration(config);
      return this.storage.getBookConfiguration(config.fkBook) || null;
    });

    ipcMain.handle('book:list-annotations', async (_event, bookId: number) => {
      if (!bookId) return [];
      return this.storage.listBookAnnotations(bookId);
    });

    ipcMain.handle('book:list-all-annotations', async () => {
      return this.storage.listAllBookAnnotations();
    });

    ipcMain.handle('book:save-annotation', async (_event, annotation: BookAnnotation) => {
      if (!annotation?.fkBook) return null;
      const payload: BookAnnotation = {
        ...annotation,
        markType: annotation.markType || 'Annotation',
        pages: annotation.pages ?? 0,
        page: annotation.page ?? 0,
        text: annotation.text || ''
      };
      const id = this.storage.saveBookAnnotation(payload);
      return this.storage.getBookAnnotation(id) || null;
    });

    ipcMain.handle('book:delete-annotation', async (_event, id: number) => {
      if (!id) return false;
      return this.storage.deleteBookAnnotation(id);
    });

    ipcMain.handle('book:search-history-list', async (_event, bookId: number) => {
      if (!bookId) return [];
      return this.storage.listBookSearchHistory(bookId);
    });

    ipcMain.handle('book:search-history-save', async (_event, bookId: number, search: string) => {
      if (!bookId || !(search || '').trim()) return null;
      return this.storage.saveBookSearchHistory(bookId, search);
    });

    ipcMain.handle('book:search-history-delete', async (_event, id: number) => {
      if (!id) return false;
      return this.storage.deleteBookSearchHistory(id);
    });

    ipcMain.handle('book:search-history-delete-all', async (_event, bookId: number) => {
      if (!bookId) return false;
      return this.storage.deleteAllBookSearchHistory(bookId);
    });
  }
}
