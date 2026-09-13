import { Injectable, signal } from '@angular/core';
import { Manga, OrderType, LibraryViewType } from '../models';
import { clampBookMark } from '../utils/reading-progress.util';

@Injectable({
  providedIn: 'root'
})
export class MangaLibraryService {
  public mangas = signal<Manga[]>([]);
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
    if (window.electronAPI?.cancelMangaScan) {
      await window.electronAPI.cancelMangaScan();
    }
  }

  private initElectronListeners(): void {
    if (window.electronAPI?.on) {
      window.electronAPI.on('manga:scan-status', (data: { status: string; folderPath?: string; libraryId?: number; processedCount?: number; totalFound?: number }) => {
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
          this.loadMangas(data.folderPath || this.currentFolderPath);
        }
      });

      window.electronAPI.on('manga:updated-batch', (payload: { folderPath?: string; libraryId?: number; items: Manga[] } | Manga[]) => {
        const batch = Array.isArray(payload) ? payload : (payload?.items || []);
        const payloadFolder = Array.isArray(payload) ? undefined : payload?.folderPath;
        if (payloadFolder && this.currentFolderPath) {
          if (this.normalizePath(payloadFolder) !== this.normalizePath(this.currentFolderPath)) {
            return;
          }
        }
        if (!batch || batch.length === 0) return;
        const filteredBatch = batch.filter(m => this.isItemFromCurrentFolder(m.path));
        if (filteredBatch.length === 0) return;

        this.mangas.update(list => {
          const map = new Map<number, Manga>();
          for (const m of list) {
            if (m.id) map.set(m.id, m);
          }
          for (const m of filteredBatch) {
            if (m.id) map.set(m.id, m);
          }
          return Array.from(map.values());
        });
      });

      window.electronAPI.on('manga:updated-add', (manga: Manga) => {
        if (!manga || !manga.id) return;
        if (!this.isItemFromCurrentFolder(manga.path)) return;
        this.mangas.update(list => {
          const idx = list.findIndex(m => m.id === manga.id);
          if (idx >= 0) {
            const copy = [...list];
            copy[idx] = manga;
            return copy;
          }
          return [...list, manga];
        });
      });

      window.electronAPI.on('manga:updated-remove', (data: { id: number; path?: string; folderPath?: string }) => {
        if (data.folderPath && this.currentFolderPath) {
          if (this.normalizePath(data.folderPath) !== this.normalizePath(this.currentFolderPath)) {
            return;
          }
        }
        this.mangas.update(list => list.filter(m => m.id !== data.id));
      });
    }
  }

  public async scanFolder(folderPath: string, externalHd?: boolean): Promise<void> {
    if (!window.electronAPI?.scanLibrary || !folderPath) return;
    this.currentFolderPath = folderPath;
    await window.electronAPI.scanLibrary(folderPath, externalHd);
    await this.loadMangas(folderPath);
  }

  public async selectAndScanDirectory(): Promise<void> {
    if (!window.electronAPI?.selectDirectory) return;
    const folder = await window.electronAPI.selectDirectory();
    if (folder) {
      await this.scanFolder(folder);
    }
  }

  public async loadMangas(folderPath?: string): Promise<void> {
    if (!window.electronAPI?.listMangas) return;
    this.currentFolderPath = folderPath;
    const seq = ++this.loadSequenceId;
    const mangas = await window.electronAPI.listMangas(folderPath);
    if (seq === this.loadSequenceId) {
      this.mangas.set(mangas || []);
    }
  }

  public async toggleFavorite(manga: Manga): Promise<void> {
    if (!window.electronAPI?.saveManga || !manga.id) return;
    const updatedFav = !manga.favorite;
    const updated = await window.electronAPI.saveManga({ ...manga, favorite: updatedFav });
    if (updated) {
      this.mangas.update(list => list.map(m => m.id === manga.id ? { ...m, favorite: updatedFav } : m));
    }
  }

  public async clearProgress(manga: Manga): Promise<void> {
    if (!window.electronAPI?.clearMangaProgress || !manga.id) return;
    const updated = await window.electronAPI.clearMangaProgress(manga.id);
    if (updated) {
      this.mangas.update(list => list.map(m => m.id === manga.id ? { ...m, bookMark: 0, completed: false } : m));
    }
  }

  /** Apply bookmark popup: page, completed, lastAccess + History session. */
  public async updateBookmark(
    manga: Manga,
    payload: {
      page: number;
      lastAccess: string;
      completed: boolean;
      secondsRead?: number;
      secondsReadAutomatic?: boolean;
      wordCount?: number;
    }
  ): Promise<Manga | null> {
    if (!window.electronAPI?.saveManga || !manga.id) return null;
    const pages = Math.max(1, manga.pages || 1);
    const bookMark = clampBookMark(payload.page, pages);
    const pageStart = manga.bookMark || 0;
    const updated = await window.electronAPI.saveManga({
      ...manga,
      bookMark,
      completed: payload.completed,
      lastAccess: payload.lastAccess
    });
    if (window.electronAPI.saveHistoryBookmarkEdit) {
      await window.electronAPI.saveHistoryBookmarkEdit({
        fkLibrary: manga.fkLibrary ?? 0,
        fkReference: manga.id,
        type: 'MANGA',
        pageStart,
        pageEnd: bookMark,
        pages,
        completed: payload.completed,
        volume: manga.volume || '',
        dateTime: payload.lastAccess,
        secondsRead: payload.secondsRead,
        secondsReadAutomatic: payload.secondsReadAutomatic,
        wordCount: payload.wordCount
      });
    }
    if (updated) {
      this.mangas.update(list =>
        list.map(m =>
          m.id === manga.id
            ? { ...m, bookMark: updated.bookMark, completed: updated.completed, lastAccess: updated.lastAccess }
            : m
        )
      );
    }
    return updated;
  }

  public async deleteManga(manga: Manga): Promise<void> {
    if (!window.electronAPI?.deleteManga || !manga.id) return;
    const success = await window.electronAPI.deleteManga(manga.id);
    if (success) {
      this.mangas.update(list => list.filter(m => m.id !== manga.id));
    }
  }
}
