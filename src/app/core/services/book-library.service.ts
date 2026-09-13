import { Injectable, signal } from '@angular/core';
import { Book, OrderType, LibraryViewType } from '../models';
import { clampBookMark } from '../utils/reading-progress.util';

@Injectable({
  providedIn: 'root'
})
export class BookLibraryService {
  public books = signal<Book[]>([]);
  public isScanning = signal<boolean>(false);
  public searchQuery = signal<string>('');
  public currentOrder = signal<OrderType>(OrderType.Name);
  public isAscending = signal<boolean>(true);
  public currentView = signal<LibraryViewType>(LibraryViewType.GRID_MEDIUM);

  constructor() {
    this.initElectronListeners();
  }

  private currentFolderPath?: string;
  private loadSequenceId = 0;

  private normalizePath(p?: string): string {
    return (p || '').replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
  }

  private isItemFromCurrentFolder(itemPath?: string): boolean {
    if (!this.currentFolderPath || !itemPath) return true;
    const normFolder = this.normalizePath(this.currentFolderPath);
    const normItem = this.normalizePath(itemPath);
    return normItem.startsWith(normFolder);
  }

  public async cancelScan(): Promise<void> {
    this.isScanning.set(false);
    if (window.electronAPI?.cancelBookScan) {
      await window.electronAPI.cancelBookScan();
    }
  }

  private initElectronListeners(): void {
    if (window.electronAPI?.on) {
      window.electronAPI.on('book:scan-status', (data: { status: string; folderPath?: string; libraryId?: number; processedCount?: number; totalFound?: number }) => {
        if (data.folderPath && this.currentFolderPath) {
          if (this.normalizePath(data.folderPath) !== this.normalizePath(this.currentFolderPath)) {
            return;
          }
        }
        if (data.status === 'STARTED' || data.status === 'PROGRESS') {
          this.isScanning.set(true);
        } else if (data.status === 'CANCELLED') {
          this.isScanning.set(false);
        } else {
          this.isScanning.set(false);
          this.loadBooks(data.folderPath || this.currentFolderPath);
        }
      });

      window.electronAPI.on('book:updated-batch', (payload: { folderPath?: string; libraryId?: number; items: Book[] } | Book[]) => {
        const batch = Array.isArray(payload) ? payload : (payload?.items || []);
        const payloadFolder = Array.isArray(payload) ? undefined : payload?.folderPath;
        if (payloadFolder && this.currentFolderPath) {
          if (this.normalizePath(payloadFolder) !== this.normalizePath(this.currentFolderPath)) {
            return;
          }
        }
        if (!batch || batch.length === 0) return;
        const filteredBatch = batch.filter(b => this.isItemFromCurrentFolder(b.path));
        if (filteredBatch.length === 0) return;

        this.books.update(list => {
          const map = new Map<number, Book>();
          for (const b of list) {
            if (b.id) map.set(b.id, b);
          }
          for (const b of filteredBatch) {
            if (b.id) map.set(b.id, b);
          }
          return Array.from(map.values());
        });
      });

      window.electronAPI.on('book:updated-add', (book: Book) => {
        if (!book || !book.id) return;
        if (!this.isItemFromCurrentFolder(book.path)) return;
        this.books.update(list => {
          const idx = list.findIndex(b => b.id === book.id);
          if (idx >= 0) {
            const copy = [...list];
            copy[idx] = book;
            return copy;
          }
          return [...list, book];
        });
      });

      window.electronAPI.on('book:updated-remove', (data: { id: number; path?: string; folderPath?: string }) => {
        if (data.folderPath && this.currentFolderPath) {
          if (this.normalizePath(data.folderPath) !== this.normalizePath(this.currentFolderPath)) {
            return;
          }
        }
        this.books.update(list => list.filter(b => b.id !== data.id));
      });
    }
  }

  public async scanFolder(folderPath: string, externalHd?: boolean): Promise<void> {
    if (!window.electronAPI?.scanBookLibrary || !folderPath) return;
    this.currentFolderPath = folderPath;
    await window.electronAPI.scanBookLibrary(folderPath, externalHd);
    await this.loadBooks(folderPath);
  }

  public async selectAndScanDirectory(): Promise<void> {
    if (!window.electronAPI?.selectDirectory) return;
    const folder = await window.electronAPI.selectDirectory();
    if (folder) {
      await this.scanFolder(folder);
    }
  }

  public async loadBooks(folderPath?: string): Promise<void> {
    if (!window.electronAPI?.listBooks) return;
    this.currentFolderPath = folderPath;
    const seq = ++this.loadSequenceId;
    const books = await window.electronAPI.listBooks(folderPath);
    if (seq === this.loadSequenceId) {
      this.books.set(books || []);
    }
  }

  public async toggleFavorite(book: Book): Promise<void> {
    if (!window.electronAPI?.saveBook || !book.id) return;
    const updatedFav = !book.favorite;
    const updated = await window.electronAPI.saveBook({ ...book, favorite: updatedFav });
    if (updated) {
      this.books.update(list => list.map(b => b.id === book.id ? { ...b, favorite: updatedFav } : b));
    }
  }

  public async clearProgress(book: Book): Promise<void> {
    if (!window.electronAPI?.clearBookProgress || !book.id) return;
    const updated = await window.electronAPI.clearBookProgress(book.id);
    if (updated) {
      this.books.update(list => list.map(b => b.id === book.id ? { ...b, bookMark: 0, completed: false } : b));
    }
  }

  /** Apply bookmark popup: page, completed, lastAccess + History session. */
  public async updateBookmark(
    book: Book,
    payload: {
      page: number;
      lastAccess: string;
      completed: boolean;
      secondsRead?: number;
      secondsReadAutomatic?: boolean;
      wordCount?: number;
    }
  ): Promise<Book | null> {
    if (!window.electronAPI?.saveBook || !book.id) return null;
    const pages = Math.max(1, book.pages || 1);
    const bookMark = clampBookMark(payload.page, pages);
    const pageStart = book.bookMark || 0;
    const updated = await window.electronAPI.saveBook({
      ...book,
      bookMark,
      completed: payload.completed,
      lastAccess: payload.lastAccess
    });
    if (window.electronAPI.saveHistoryBookmarkEdit) {
      await window.electronAPI.saveHistoryBookmarkEdit({
        fkLibrary: book.fkLibrary ?? 0,
        fkReference: book.id,
        type: 'BOOK',
        pageStart,
        pageEnd: bookMark,
        pages,
        completed: payload.completed,
        volume: book.volume || '',
        dateTime: payload.lastAccess,
        secondsRead: payload.secondsRead,
        secondsReadAutomatic: payload.secondsReadAutomatic,
        wordCount: payload.wordCount
      });
    }
    if (updated) {
      this.books.update(list =>
        list.map(b =>
          b.id === book.id
            ? { ...b, bookMark: updated.bookMark, completed: updated.completed, lastAccess: updated.lastAccess }
            : b
        )
      );
    }
    return updated;
  }

  public async deleteBook(book: Book): Promise<void> {
    if (!window.electronAPI?.deleteBook || !book.id) return;
    const success = await window.electronAPI.deleteBook(book.id);
    if (success) {
      this.books.update(list => list.filter(b => b.id !== book.id));
    }
  }
}
