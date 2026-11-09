import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ElectronService } from './electron.service';

export type AppLanguage = 'en' | 'pt';
export type LanguagePreference = 'auto' | AppLanguage;

const STORAGE_KEY = 'bilingual_reader_app_language';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private translate = inject(TranslateService);
  private electron = inject(ElectronService);

  readonly preference = signal<LanguagePreference>('auto');
  readonly systemLanguage = signal<AppLanguage>(this.detectSystemLanguage());

  readonly currentLang = computed<AppLanguage>(() => {
    const pref = this.preference();
    if (pref === 'auto') {
      return this.systemLanguage();
    }
    return pref;
  });

  readonly currentLocale = computed<string>(() => {
    return this.currentLang() === 'pt' ? 'pt-BR' : 'en-US';
  });

  constructor() {
    this.initLanguage();
  }

  private detectSystemLanguage(): AppLanguage {
    try {
      const langs = (typeof navigator !== 'undefined' && navigator.languages) ? navigator.languages : [navigator?.language || 'en'];
      for (const l of langs) {
        if (l && l.toLowerCase().startsWith('pt')) {
          return 'pt';
        }
      }
    } catch {
      // fallback
    }
    return 'en';
  }

  private initLanguage(): void {
    let savedPref: LanguagePreference = 'auto';
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'pt' || stored === 'en' || stored === 'auto') {
        savedPref = stored;
      }
    } catch {
      // ignore
    }

    this.preference.set(savedPref);
    const active = savedPref === 'auto' ? this.systemLanguage() : savedPref;

    this.translate.setFallbackLang('en');
    this.translate.use(active);
    this.updateDocumentLang(active);
    this.notifyElectron(savedPref, active);
  }

  setPreference(pref: LanguagePreference): void {
    this.preference.set(pref);
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // ignore
    }

    const active = pref === 'auto' ? this.systemLanguage() : pref;
    this.translate.use(active);
    this.updateDocumentLang(active);
    this.notifyElectron(pref, active);
  }

  private updateDocumentLang(lang: AppLanguage): void {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = lang;
    }
  }

  private notifyElectron(pref: LanguagePreference, activeLang: AppLanguage): void {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        void window.electronAPI.setSetting('APP_LANGUAGE', pref);
        // Se houver canal específico de troca de idioma
        if ((window.electronAPI as any).setAppLanguage) {
          void (window.electronAPI as any).setAppLanguage(activeLang);
        }
      }
    } catch {
      // ignore
    }
  }

  t(key: string, interpolateParams?: Record<string, any>): string {
    // Referenciar currentLang para criar dependência reativa caso chamado dentro de computeds/templates
    this.currentLang();
    return this.translate.instant(key, interpolateParams);
  }

  locale(): string {
    return this.currentLocale();
  }

  formatDate(dateInput: string | Date, options?: Intl.DateTimeFormatOptions): string {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (Number.isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString(this.locale(), options);
  }

  formatDateLabel(date: string): string {
    const d = new Date(date + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return date;
    const str = d.toLocaleDateString(this.locale(), {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

