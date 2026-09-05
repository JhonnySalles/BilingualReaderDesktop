import { Injectable, signal } from '@angular/core';
import { Book, OrderType, LibraryViewType } from '../models';

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

  private initElectronListeners(): void {
    if (window.electronAPI?.on) {
      window.electronAPI.on('book:scan-status', (data: { status: string; folderPath?: string }) => {
        const isStarted = data.status === 'STARTED';
        this.isScanning.set(isStarted);
        if (!isStarted) {
          this.loadBooks(data.folderPath || this.currentFolderPath);
        }
      });

      window.electronAPI.on('book:updated-add', (book: Book) => {
        this.books.update(list => [...list.filter(b => b.id !== book.id), book]);
      });

      window.electronAPI.on('book:updated-remove', (data: { id: number }) => {
        this.books.update(list => list.filter(b => b.id !== data.id));
      });
    }
  }

  public async scanFolder(folderPath: string): Promise<void> {
    if (!window.electronAPI?.scanBookLibrary || !folderPath) return;
    this.currentFolderPath = folderPath;
    await window.electronAPI.scanBookLibrary(folderPath);
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
    const books = await window.electronAPI.listBooks(folderPath);
    this.books.set(books || []);
  }
}
