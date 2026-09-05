import { Injectable, signal } from '@angular/core';
import { Manga, OrderType, LibraryViewType } from '../models';

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

  private initElectronListeners(): void {
    if (window.electronAPI?.on) {
      window.electronAPI.on('manga:scan-status', (data: { status: string; folderPath?: string }) => {
        const isStarted = data.status === 'STARTED';
        this.isScanning.set(isStarted);
        if (!isStarted) {
          this.loadMangas(data.folderPath || this.currentFolderPath);
        }
      });

      window.electronAPI.on('manga:updated-add', (manga: Manga) => {
        this.mangas.update(list => [...list.filter(m => m.id !== manga.id), manga]);
      });

      window.electronAPI.on('manga:updated-remove', (data: { id: number }) => {
        this.mangas.update(list => list.filter(m => m.id !== data.id));
      });
    }
  }

  public async scanFolder(folderPath: string): Promise<void> {
    if (!window.electronAPI?.scanLibrary || !folderPath) return;
    this.currentFolderPath = folderPath;
    await window.electronAPI.scanLibrary(folderPath);
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
    const mangas = await window.electronAPI.listMangas(folderPath);
    this.mangas.set(mangas || []);
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

  public async deleteManga(manga: Manga): Promise<void> {
    if (!window.electronAPI?.deleteManga || !manga.id) return;
    const success = await window.electronAPI.deleteManga(manga.id);
    if (success) {
      this.mangas.update(list => list.filter(m => m.id !== manga.id));
    }
  }
}
