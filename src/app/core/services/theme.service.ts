import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light' | 'win-mica-dark' | 'win-mica-light' | 'system';
export type AccentColor = 'indigo' | 'emerald' | 'purple' | 'oled';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  themeMode = signal<ThemeMode>('dark');
  accentColor = signal<AccentColor>('indigo');
  lastReadCoverUrl = signal<string | null>(null);

  constructor() {
    this.initTheme();
  }

  initTheme(): void {
    const savedTheme = (localStorage.getItem('br_theme_mode') as ThemeMode) || 'dark';
    const savedAccent = (localStorage.getItem('br_accent_color') as AccentColor) || 'indigo';

    this.setTheme(savedTheme);
    this.setAccent(savedAccent);

    // Cover de demonstração padrão (ou recuperada do histórico)
    this.setLastReadCover('https://picsum.photos/800/1200');
  }

  setTheme(mode: ThemeMode): void {
    this.themeMode.set(mode);
    localStorage.setItem('br_theme_mode', mode);

    let effectiveMode = mode;
    if (mode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveMode = prefersDark ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', effectiveMode);
  }

  setAccent(accent: AccentColor): void {
    this.accentColor.set(accent);
    localStorage.setItem('br_accent_color', accent);
    document.documentElement.setAttribute('data-accent', accent);
  }

  setLastReadCover(url: string | null): void {
    this.lastReadCoverUrl.set(url);
    if (url) {
      document.documentElement.style.setProperty('--mica-cover-bg', `url('${url}')`);
    } else {
      document.documentElement.style.removeProperty('--mica-cover-bg');
    }
  }
}
