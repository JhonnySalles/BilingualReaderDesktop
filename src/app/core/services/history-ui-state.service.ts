import { Injectable, signal, computed } from '@angular/core';
import { HistoryContentType, LibraryOption } from '../models';

@Injectable({ providedIn: 'root' })
export class HistoryUiStateService {
  readonly search = signal('');
  readonly year = signal<number | null>(null);
  readonly libraryId = signal<number | null>(null);
  readonly activeType = signal<HistoryContentType>('MANGA');
  readonly years = signal<number[]>([]);
  readonly libraries = signal<LibraryOption[]>([]);
  readonly fromStatistics = signal(false);
  readonly reloadToken = signal(0);

  readonly pageTitle = computed(() =>
    this.activeType() === 'MANGA' ? 'Histórico — Mangá' : 'Histórico — Livro'
  );

  setSearch(value: string): void {
    this.search.set(value);
    this.bumpReload();
  }

  setYear(year: number | null): void {
    this.year.set(year);
    this.bumpReload();
  }

  setLibrary(libraryId: number | null): void {
    this.libraryId.set(libraryId);
    this.bumpReload();
  }

  setType(type: HistoryContentType): void {
    if (this.activeType() === type) return;
    this.activeType.set(type);
    this.libraryId.set(null);
    this.bumpReload();
  }

  setFilterOptions(years: number[], libraries: LibraryOption[]): void {
    this.years.set(years);
    this.libraries.set(libraries);
  }

  bumpReload(): void {
    this.reloadToken.update(v => v + 1);
  }
}
