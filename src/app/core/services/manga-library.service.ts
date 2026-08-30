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

  private initElectronListeners(): void {
    if (window.electronAPI) {
      window.electronAPI.on('manga:scan-status', (data: { status: string }) => {
        this.isScanning.set(data.status === 'STARTED');
      });

      window.electronAPI.on('manga:updated-add', (row: any) => {
        const manga = this.mapRowToManga(row);
        this.mangas.update(list => [...list.filter(m => m.id !== manga.id), manga]);
      });

      window.electronAPI.on('manga:updated-remove', (data: { id: number }) => {
        this.mangas.update(list => list.filter(m => m.id !== data.id));
      });
    }
  }

  public async selectAndScanDirectory(): Promise<void> {
    if (!window.electronAPI) return;
    const folder = await window.electronAPI.selectDirectory();
    if (folder) {
      await window.electronAPI.scanLibrary(folder);
      await this.loadMangas();
    }
  }

  public async loadMangas(libraryId?: number): Promise<void> {
    if (!window.electronAPI) return;
    const rows = await window.electronAPI.listMangas(libraryId);
    const mapped = rows.map((r: any) => this.mapRowToManga(r));
    this.mangas.set(mapped);
  }

  private mapRowToManga(row: any): Manga {
    return {
      id: row.id,
      title: row.title,
      path: row.file_path,
      folder: row.file_folder,
      name: row.file_name,
      fileSize: row.file_size,
      fileType: row.file_type,
      pages: row.pages,
      chapters: JSON.parse(row.chapters || '[]'),
      chaptersPages: JSON.parse(row.chapters_pages || '{}'),
      bookMark: row.book_mark,
      completed: !!row.completed,
      favorite: !!row.favorite,
      hasSubtitle: !!row.has_subtitle,
      author: row.author || '',
      series: row.series || '',
      genre: row.genre || '',
      publisher: row.publisher || '',
      volume: row.volume || '',
      release: row.release_date,
      fkLibrary: row.fk_id_library,
      excluded: !!row.excluded,
      dateCreate: row.date_create,
      lastAccess: row.last_access,
      lastAlteration: row.last_alteration,
      fileAlteration: row.file_alteration,
      coverPath: row.cover_path
    };
  }
}
