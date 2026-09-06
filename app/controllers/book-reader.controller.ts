import { BrowserWindow, ipcMain } from 'electron';
import { StorageService } from '../database/storage.service';
import { BookReaderSessionService } from '../services/book-reader-session.service';
import { BookAnnotation, BookConfiguration } from '../../src/app/core/models/entities/book.model';

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
      }
    );

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
  }
}
