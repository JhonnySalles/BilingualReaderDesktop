import { Injectable, signal, effect } from '@angular/core';

export interface CustomLibrary {
  id: string;
  title: string;
  language: string;
  path: string;
  type: 'manga' | 'book';
}

const SETTINGS_KEY = 'bilingual_reader_settings';

interface SettingsData {
  mangaBasePath: string;
  bookBasePath: string;
  libraries: CustomLibrary[];
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  mangaBasePath = signal<string>('C:\\Users\\Jhonny\\Documents\\BilingualReader\\Mangas');
  bookBasePath = signal<string>('C:\\Users\\Jhonny\\Documents\\BilingualReader\\Books');
  libraries = signal<CustomLibrary[]>([]);

  constructor() {
    this.loadSettings();
    
    effect(() => {
      const data: SettingsData = {
        mangaBasePath: this.mangaBasePath(),
        bookBasePath: this.bookBasePath(),
        libraries: this.libraries()
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
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
