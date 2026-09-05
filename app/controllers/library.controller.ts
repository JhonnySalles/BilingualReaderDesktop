import { ipcMain } from 'electron';
import { StorageService } from '../database/storage.service';
import { Manga } from '../../src/app/core/models/entities/manga.model';
import { Book } from '../../src/app/core/models/entities/book.model';

export class LibraryController {
  constructor(private storage: StorageService) {}

  public registerIpcHandlers(): void {
    ipcMain.handle('manga:save', async (_event, manga: Partial<Manga>) => {
      const id = this.storage.saveManga(manga);
      return this.storage.findMangaById(id) ?? null;
    });

    ipcMain.handle('book:save', async (_event, book: Partial<Book>) => {
      const id = this.storage.saveBook(book);
      return this.storage.findBookById(id) ?? null;
    });

    ipcMain.handle('manga:delete', async (_event, id: number) => {
      this.storage.softDeleteManga(id);
      return true;
    });

    ipcMain.handle('book:delete', async (_event, id: number) => {
      this.storage.softDeleteBook(id);
      return true;
    });

    ipcMain.handle('manga:clearProgress', async (_event, id: number) => {
      return this.storage.clearMangaProgress(id) ?? null;
    });

    ipcMain.handle('book:clearProgress', async (_event, id: number) => {
      return this.storage.clearBookProgress(id) ?? null;
    });

    ipcMain.handle('manga:markRead', async (_event, id: number) => {
      return this.storage.markMangaRead(id) ?? null;
    });

    ipcMain.handle('book:markRead', async (_event, id: number) => {
      return this.storage.markBookRead(id) ?? null;
    });
  }
}
