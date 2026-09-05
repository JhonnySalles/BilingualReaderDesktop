import { Injectable, signal, effect } from '@angular/core';
import {
  BookAlign,
  BookMarginSize,
  BookScrollingMode,
  BookSpacingSize,
  MangaFitMode,
  MangaScrollingMode
} from '../models';

export interface CustomLibrary {
  id: string;
  title: string;
  language: string;
  path: string;
  type: 'manga' | 'book';
  count?: number;
}

const SETTINGS_KEY = 'bilingual_reader_settings';

interface SettingsData {
  mangaBasePath: string;
  bookBasePath: string;
  libraries: CustomLibrary[];
  mangaScrollingMode?: MangaScrollingMode;
  mangaFitMode?: MangaFitMode;
  bookScrollingMode?: BookScrollingMode;
  bookFontSize?: number;
  bookFontFamily?: string;
  bookLineHeight?: number;
  bookMargin?: BookMarginSize;
  bookAlign?: BookAlign;
  bookSpacing?: BookSpacingSize;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  mangaBasePath = signal<string>('C:\\Users\\Jhonny\\Documents\\BilingualReader\\Mangas');
  bookBasePath = signal<string>('C:\\Users\\Jhonny\\Documents\\BilingualReader\\Books');
  libraries = signal<CustomLibrary[]>([]);
  mangaScrollingMode = signal<MangaScrollingMode>(MangaScrollingMode.Horizontal);
  mangaFitMode = signal<MangaFitMode>(MangaFitMode.FitWidth);

  bookScrollingMode = signal<BookScrollingMode>(BookScrollingMode.Pagination);
  bookFontSize = signal<number>(18);
  bookFontFamily = signal<string>('Georgia, serif');
  bookLineHeight = signal<number>(1.6);
  bookMargin = signal<BookMarginSize>('medium');
  bookAlign = signal<BookAlign>('justify');
  bookSpacing = signal<BookSpacingSize>('medium');

  constructor() {
    this.loadSettings();

    effect(() => {
      const data: SettingsData = {
        mangaBasePath: this.mangaBasePath(),
        bookBasePath: this.bookBasePath(),
        libraries: this.libraries(),
        mangaScrollingMode: this.mangaScrollingMode(),
        mangaFitMode: this.mangaFitMode(),
        bookScrollingMode: this.bookScrollingMode(),
        bookFontSize: this.bookFontSize(),
        bookFontFamily: this.bookFontFamily(),
        bookLineHeight: this.bookLineHeight(),
        bookMargin: this.bookMargin(),
        bookAlign: this.bookAlign(),
        bookSpacing: this.bookSpacing()
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
      if (typeof window !== 'undefined' && window.electronAPI?.setSetting) {
        void window.electronAPI.setSetting('libraries', this.libraries());
        void window.electronAPI.setSetting('mangaBasePath', this.mangaBasePath());
        void window.electronAPI.setSetting('bookBasePath', this.bookBasePath());
      }
    });
  }

  private loadSettings(): void {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      try {
        const data: SettingsData = JSON.parse(raw);
        if (data.mangaBasePath) this.mangaBasePath.set(data.mangaBasePath);
        if (data.bookBasePath) this.bookBasePath.set(data.bookBasePath);
        if (Array.isArray(data.libraries)) this.libraries.set(data.libraries);
        if (data.mangaScrollingMode && Object.values(MangaScrollingMode).includes(data.mangaScrollingMode)) {
          this.mangaScrollingMode.set(data.mangaScrollingMode);
        }
        if (data.mangaFitMode && Object.values(MangaFitMode).includes(data.mangaFitMode)) {
          this.mangaFitMode.set(data.mangaFitMode);
        }
        if (data.bookScrollingMode && Object.values(BookScrollingMode).includes(data.bookScrollingMode)) {
          this.bookScrollingMode.set(data.bookScrollingMode);
        }
        if (typeof data.bookFontSize === 'number' && data.bookFontSize >= 10 && data.bookFontSize <= 40) {
          this.bookFontSize.set(data.bookFontSize);
        }
        if (typeof data.bookFontFamily === 'string' && data.bookFontFamily.trim()) {
          this.bookFontFamily.set(data.bookFontFamily);
        }
        if (typeof data.bookLineHeight === 'number' && data.bookLineHeight >= 1.2 && data.bookLineHeight <= 2.4) {
          this.bookLineHeight.set(data.bookLineHeight);
        }
        if (data.bookMargin && ['small', 'medium', 'large'].includes(data.bookMargin)) {
          this.bookMargin.set(data.bookMargin);
        }
        if (data.bookAlign && ['justify', 'left', 'center', 'right'].includes(data.bookAlign)) {
          this.bookAlign.set(data.bookAlign);
        }
        if (data.bookSpacing && ['small', 'medium', 'large'].includes(data.bookSpacing)) {
          this.bookSpacing.set(data.bookSpacing);
        }
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }
  }

  addLibrary(library: CustomLibrary): void {
    this.libraries.update(libs => [...libs, library]);
  }

  updateLibrary(library: CustomLibrary): void {
    this.libraries.update(libs => libs.map(l => l.id === library.id ? library : l));
  }

  deleteLibrary(id: string): void {
    this.libraries.update(libs => libs.filter(l => l.id !== id));
  }
}
