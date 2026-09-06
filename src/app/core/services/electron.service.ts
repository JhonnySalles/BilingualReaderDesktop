import { Injectable } from '@angular/core';
import {
  StatisticsOverview,
  ChartPoint,
  LibraryOption,
  HistoryStatisticsItem,
  HistoryContentType,
  Manga,
  Book,
  BookAnnotation,
  BookConfiguration
} from '../models';

declare global {
  interface Window {
    electronAPI?: {
      ping: () => Promise<string>;
      selectDirectory: () => Promise<string | null>;
      listMangas: (folderPath?: string) => Promise<any[]>;
      scanLibrary: (folderPath: string) => Promise<boolean>;
      listBooks: (folderPath?: string) => Promise<any[]>;
      scanBookLibrary: (folderPath: string) => Promise<boolean>;
      getLibraryCount: (libraryId: number, type: 'MANGA' | 'BOOK') => Promise<number>;
      getManga: (id: number) => Promise<Manga | null>;
      getBook: (id: number) => Promise<Book | null>;
      saveManga: (manga: Partial<Manga>) => Promise<Manga | null>;
      saveBook: (book: Partial<Book>) => Promise<Book | null>;
      deleteManga: (id: number) => Promise<boolean>;
      deleteBook: (id: number) => Promise<boolean>;
      clearMangaProgress: (id: number) => Promise<Manga | null>;
      clearBookProgress: (id: number) => Promise<Book | null>;
      markMangaRead: (id: number) => Promise<Manga | null>;
      markBookRead: (id: number) => Promise<Book | null>;
      getSetting: (key: string, defaultValue?: any) => Promise<any>;
      setSetting: (key: string, value: any) => Promise<any>;
      getSecret: (secretKey: string) => Promise<any>;
      getStatistics: () => Promise<StatisticsOverview>;
      getStatisticsChart: (type: HistoryContentType, year: number, libraryId?: number | null) => Promise<ChartPoint[]>;
      getStatisticsYears: (type: HistoryContentType) => Promise<number[]>;
      listLibrariesByType: (type: HistoryContentType) => Promise<LibraryOption[]>;
      listHistoryAggregated: (options: {
        type: HistoryContentType;
        year?: number | null;
        libraryId?: number | null;
        search?: string | null;
      }) => Promise<HistoryStatisticsItem[]>;
      startHistorySession: (input: {
        fkLibrary: number;
        fkReference: number;
        type: HistoryContentType;
        pageStart: number;
        pages: number;
        volume?: string;
      }) => Promise<number>;
      updateHistorySession: (update: { id: number; pageEnd: number; pages?: number }) => Promise<boolean>;
      endHistorySession: (payload: {
        id: number;
        pageEnd: number;
        pages?: number;
        type?: HistoryContentType;
        fkReference?: number;
      }) => Promise<boolean>;
      openMangaReader: (mangaId: number) => Promise<{
        sessionId: string;
        mangaId: number;
        title: string;
        pageCount: number;
        pages: string[];
        chapters: number[];
        bookMark: number;
        favorite: boolean;
        cacheDir: string;
      }>;
      closeMangaReader: (sessionId: string) => Promise<boolean>;
      setMangaBookmark: (mangaId: number, page: number) => Promise<Manga | null>;
      toggleMangaFavorite: (mangaId: number) => Promise<Manga | null>;
      openBookReader: (bookId: number) => Promise<{
        sessionId: string;
        bookId: number;
        title: string;
        author: string;
        epubUrl: string;
        epubPath: string;
        bookMark: number;
        bookMarkCfi: string;
        favorite: boolean;
        configuration: BookConfiguration | null;
      }>;
      closeBookReader: (sessionId: string) => Promise<boolean>;
      setBookBookmark: (payload: {
        id: number;
        bookMark: number;
        bookMarkCfi?: string;
        chapter?: string;
        chapterDescription?: string;
        pages?: number;
      }) => Promise<Book | null>;
      toggleBookFavorite: (bookId: number) => Promise<Book | null>;
      getBookConfiguration: (bookId: number) => Promise<BookConfiguration | null>;
      saveBookConfiguration: (config: BookConfiguration) => Promise<BookConfiguration | null>;
      listBookAnnotations: (bookId: number) => Promise<BookAnnotation[]>;
      saveBookAnnotation: (annotation: BookAnnotation) => Promise<BookAnnotation | null>;
      deleteBookAnnotation: (id: number) => Promise<boolean>;
      send: (channel: string, data: any) => void;
      on: (channel: string, func: (...args: any[]) => void) => () => void;
    };
  }
}

@Injectable({
  providedIn: 'root'
})
export class ElectronService {
  get isElectron(): boolean {
    return !!(window && window.electronAPI);
  }

  async ping(): Promise<string> {
    if (this.isElectron && window.electronAPI?.ping) {
      return await window.electronAPI.ping();
    }
    return 'Electron IPC não está ativo no navegador!';
  }

  async selectDirectory(): Promise<string | null> {
    if (this.isElectron && window.electronAPI?.selectDirectory) {
      return await window.electronAPI.selectDirectory();
    }
    return prompt('Digite o caminho da pasta:');
  }

  async getLibraryCount(libraryId: number, type: 'MANGA' | 'BOOK'): Promise<number> {
    if (this.isElectron && window.electronAPI?.getLibraryCount) {
      return await window.electronAPI.getLibraryCount(libraryId, type);
    }
    return 0;
  }

  async getManga(id: number): Promise<Manga | null> {
    if (this.isElectron && window.electronAPI?.getManga) {
      return await window.electronAPI.getManga(id);
    }
    return null;
  }

  async getBook(id: number): Promise<Book | null> {
    if (this.isElectron && window.electronAPI?.getBook) {
      return await window.electronAPI.getBook(id);
    }
    return null;
  }

  async saveManga(manga: Partial<Manga>): Promise<Manga | null> {
    if (this.isElectron && window.electronAPI?.saveManga) {
      return await window.electronAPI.saveManga(manga);
    }
    return null;
  }

  async saveBook(book: Partial<Book>): Promise<Book | null> {
    if (this.isElectron && window.electronAPI?.saveBook) {
      return await window.electronAPI.saveBook(book);
    }
    return null;
  }

  async deleteManga(id: number): Promise<boolean> {
    if (this.isElectron && window.electronAPI?.deleteManga) {
      return await window.electronAPI.deleteManga(id);
    }
    return false;
  }

  async deleteBook(id: number): Promise<boolean> {
    if (this.isElectron && window.electronAPI?.deleteBook) {
      return await window.electronAPI.deleteBook(id);
    }
    return false;
  }

  async clearMangaProgress(id: number): Promise<Manga | null> {
    if (this.isElectron && window.electronAPI?.clearMangaProgress) {
      return await window.electronAPI.clearMangaProgress(id);
    }
    return null;
  }

  async clearBookProgress(id: number): Promise<Book | null> {
    if (this.isElectron && window.electronAPI?.clearBookProgress) {
      return await window.electronAPI.clearBookProgress(id);
    }
    return null;
  }

  async markMangaRead(id: number): Promise<Manga | null> {
    if (this.isElectron && window.electronAPI?.markMangaRead) {
      return await window.electronAPI.markMangaRead(id);
    }
    return null;
  }

  async markBookRead(id: number): Promise<Book | null> {
    if (this.isElectron && window.electronAPI?.markBookRead) {
      return await window.electronAPI.markBookRead(id);
    }
    return null;
  }

  async getStatistics(): Promise<StatisticsOverview | null> {
    if (this.isElectron && window.electronAPI?.getStatistics) {
      return await window.electronAPI.getStatistics();
    }
    return null;
  }

  async getStatisticsChart(
    type: HistoryContentType,
    year: number,
    libraryId?: number | null
  ): Promise<ChartPoint[]> {
    if (this.isElectron && window.electronAPI?.getStatisticsChart) {
      return await window.electronAPI.getStatisticsChart(type, year, libraryId);
    }
    return [];
  }

  async getStatisticsYears(type: HistoryContentType): Promise<number[]> {
    if (this.isElectron && window.electronAPI?.getStatisticsYears) {
      return await window.electronAPI.getStatisticsYears(type);
    }
    return [new Date().getFullYear()];
  }

  async listLibrariesByType(type: HistoryContentType): Promise<LibraryOption[]> {
    if (this.isElectron && window.electronAPI?.listLibrariesByType) {
      return await window.electronAPI.listLibrariesByType(type);
    }
    return [];
  }

  async listHistoryAggregated(options: {
    type: HistoryContentType;
    year?: number | null;
    libraryId?: number | null;
    search?: string | null;
  }): Promise<HistoryStatisticsItem[]> {
    if (this.isElectron && window.electronAPI?.listHistoryAggregated) {
      return await window.electronAPI.listHistoryAggregated(options);
    }
    return [];
  }

  async startHistorySession(input: {
    fkLibrary: number;
    fkReference: number;
    type: HistoryContentType;
    pageStart: number;
    pages: number;
    volume?: string;
  }): Promise<number | null> {
    if (this.isElectron && window.electronAPI?.startHistorySession) {
      return await window.electronAPI.startHistorySession(input);
    }
    return null;
  }

  async updateHistorySession(update: { id: number; pageEnd: number; pages?: number }): Promise<boolean> {
    if (this.isElectron && window.electronAPI?.updateHistorySession) {
      return await window.electronAPI.updateHistorySession(update);
    }
    return false;
  }

  async endHistorySession(payload: {
    id: number;
    pageEnd: number;
    pages?: number;
    type?: HistoryContentType;
    fkReference?: number;
  }): Promise<boolean> {
    if (this.isElectron && window.electronAPI?.endHistorySession) {
      return await window.electronAPI.endHistorySession(payload);
    }
    return false;
  }

  async openMangaReader(mangaId: number) {
    if (this.isElectron && window.electronAPI?.openMangaReader) {
      return await window.electronAPI.openMangaReader(mangaId);
    }
    return null;
  }

  async closeMangaReader(sessionId: string): Promise<boolean> {
    if (this.isElectron && window.electronAPI?.closeMangaReader) {
      return await window.electronAPI.closeMangaReader(sessionId);
    }
    return false;
  }

  async setMangaBookmark(mangaId: number, page: number): Promise<Manga | null> {
    if (this.isElectron && window.electronAPI?.setMangaBookmark) {
      return await window.electronAPI.setMangaBookmark(mangaId, page);
    }
    return null;
  }

  async toggleMangaFavorite(mangaId: number): Promise<Manga | null> {
    if (this.isElectron && window.electronAPI?.toggleMangaFavorite) {
      return await window.electronAPI.toggleMangaFavorite(mangaId);
    }
    return null;
  }

  async openBookReader(bookId: number) {
    if (this.isElectron && window.electronAPI?.openBookReader) {
      return await window.electronAPI.openBookReader(bookId);
    }
    return null;
  }

  async closeBookReader(sessionId: string): Promise<boolean> {
    if (this.isElectron && window.electronAPI?.closeBookReader) {
      return await window.electronAPI.closeBookReader(sessionId);
    }
    return false;
  }

  async setBookBookmark(payload: {
    id: number;
    bookMark: number;
    bookMarkCfi?: string;
    chapter?: string;
    chapterDescription?: string;
    pages?: number;
  }): Promise<Book | null> {
    if (this.isElectron && window.electronAPI?.setBookBookmark) {
      return await window.electronAPI.setBookBookmark(payload);
    }
    return null;
  }

  async toggleBookFavorite(bookId: number): Promise<Book | null> {
    if (this.isElectron && window.electronAPI?.toggleBookFavorite) {
      return await window.electronAPI.toggleBookFavorite(bookId);
    }
    return null;
  }

  async getBookConfiguration(bookId: number): Promise<BookConfiguration | null> {
    if (this.isElectron && window.electronAPI?.getBookConfiguration) {
      return await window.electronAPI.getBookConfiguration(bookId);
    }
    return null;
  }

  async saveBookConfiguration(config: BookConfiguration): Promise<BookConfiguration | null> {
    if (this.isElectron && window.electronAPI?.saveBookConfiguration) {
      return await window.electronAPI.saveBookConfiguration(config);
    }
    return null;
  }

  async listBookAnnotations(bookId: number): Promise<BookAnnotation[]> {
    if (this.isElectron && window.electronAPI?.listBookAnnotations) {
      return await window.electronAPI.listBookAnnotations(bookId);
    }
    return [];
  }

  async saveBookAnnotation(annotation: BookAnnotation): Promise<BookAnnotation | null> {
    if (this.isElectron && window.electronAPI?.saveBookAnnotation) {
      return await window.electronAPI.saveBookAnnotation(annotation);
    }
    return null;
  }

  async deleteBookAnnotation(id: number): Promise<boolean> {
    if (this.isElectron && window.electronAPI?.deleteBookAnnotation) {
      return await window.electronAPI.deleteBookAnnotation(id);
    }
    return false;
  }

  onExtractProgress(handler: (progress: { current: number; total: number }) => void): () => void {
    if (this.isElectron && window.electronAPI?.on) {
      return window.electronAPI.on('manga-reader:extract-progress', handler);
    }
    return () => undefined;
  }

  onNavigate(handler: (routePath: string) => void): () => void {
    if (this.isElectron && window.electronAPI?.on) {
      return window.electronAPI.on('app:navigate', handler);
    }
    return () => undefined;
  }
}
