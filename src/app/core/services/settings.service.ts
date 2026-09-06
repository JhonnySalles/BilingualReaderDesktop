import { Injectable, signal, effect } from '@angular/core';
import {
  BookAlign,
  BookMarginSize,
  BookScrollingMode,
  BookSpacingSize,
  MangaFitMode,
  MangaScrollingMode,
  TouchPosition,
  TouchScreen,
  TouchZoneMap
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

const MANGA_TOUCH_DEFAULT: TouchZoneMap = {
  [TouchPosition.TOP]: TouchScreen.SHARE_IMAGE,
  [TouchPosition.CORNER_TOP_LEFT]: TouchScreen.FIT_WIDTH,
  [TouchPosition.CORNER_TOP_RIGHT]: TouchScreen.ASPECT_FIT,
  [TouchPosition.LEFT]: TouchScreen.PREVIOUS_PAGE,
  [TouchPosition.RIGHT]: TouchScreen.NEXT_PAGE,
  [TouchPosition.BOTTOM]: TouchScreen.CHAPTER_LIST,
  [TouchPosition.CORNER_BOTTOM_LEFT]: TouchScreen.PREVIOUS_FILE,
  [TouchPosition.CORNER_BOTTOM_RIGHT]: TouchScreen.NEXT_FILE
};

const BOOK_TOUCH_DEFAULT: TouchZoneMap = {
  [TouchPosition.TOP]: TouchScreen.PAGE_MARK,
  [TouchPosition.CORNER_TOP_LEFT]: TouchScreen.PREVIOUS_PAGE,
  [TouchPosition.CORNER_TOP_RIGHT]: TouchScreen.NEXT_PAGE,
  [TouchPosition.LEFT]: TouchScreen.PREVIOUS_PAGE,
  [TouchPosition.RIGHT]: TouchScreen.NEXT_PAGE,
  [TouchPosition.BOTTOM]: TouchScreen.CHAPTER_LIST,
  [TouchPosition.CORNER_BOTTOM_LEFT]: TouchScreen.PREVIOUS_FILE,
  [TouchPosition.CORNER_BOTTOM_RIGHT]: TouchScreen.NEXT_FILE
};

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
  mangaTouchMap?: Partial<TouchZoneMap>;
  bookTouchMap?: Partial<TouchZoneMap>;
  mangaTouchDemoShown?: boolean;
  bookTouchDemoShown?: boolean;
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

  mangaTouchMap = signal<TouchZoneMap>({ ...MANGA_TOUCH_DEFAULT });
  bookTouchMap = signal<TouchZoneMap>({ ...BOOK_TOUCH_DEFAULT });
  mangaTouchDemoShown = signal(false);
  bookTouchDemoShown = signal(false);

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
        bookSpacing: this.bookSpacing(),
        mangaTouchMap: this.mangaTouchMap(),
        bookTouchMap: this.bookTouchMap(),
        mangaTouchDemoShown: this.mangaTouchDemoShown(),
        bookTouchDemoShown: this.bookTouchDemoShown()
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
        if (data.mangaTouchMap) {
          this.mangaTouchMap.set(this.mergeTouchMap(MANGA_TOUCH_DEFAULT, data.mangaTouchMap));
        }
        if (data.bookTouchMap) {
          this.bookTouchMap.set(this.mergeTouchMap(BOOK_TOUCH_DEFAULT, data.bookTouchMap));
        }
        if (typeof data.mangaTouchDemoShown === 'boolean') {
          this.mangaTouchDemoShown.set(data.mangaTouchDemoShown);
        }
        if (typeof data.bookTouchDemoShown === 'boolean') {
          this.bookTouchDemoShown.set(data.bookTouchDemoShown);
        }
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }
  }

  private mergeTouchMap(defaults: TouchZoneMap, raw: Partial<TouchZoneMap>): TouchZoneMap {
    const result = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof TouchZoneMap)[]) {
      const value = raw[key];
      if (value && Object.values(TouchScreen).includes(value) && value !== TouchScreen.NOT_IMPLEMENTED) {
        result[key] = value;
      }
    }
    return result;
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
