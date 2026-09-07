import { Injectable } from '@angular/core';
import {
  StatisticsOverview,
  ChartPoint,
  LibraryOption,
  HistoryStatisticsItem,
  HistoryContentType,
  HistorySearchFilter,
  HomeRecentItem,
  HeatmapDay,
  Manga,
  Book,
  BookAnnotation,
  MangaAnnotation,
  BookConfiguration,
  BookSearchHistory,
  LinkedFile
} from '../models';

export interface OpenFileLinkResult {
  sessionId: string;
  path: string;
  name: string;
  type: string;
  folder: string;
  pageCount: number;
  pages: string[];
  pageNames: string[];
  pagePaths: string[];
  chapters: number[];
  chaptersPages?: Record<number, string>;
  cacheDir: string;
}

declare global {
  interface Window {
    electronAPI?: {
      ping: () => Promise<string>;
      selectDirectory: () => Promise<string | null>;
      openMangaFile: () => Promise<string | null>;
      listMangas: (folderPath?: string) => Promise<any[]>;
      scanLibrary: (folderPath: string) => Promise<boolean>;
      listBooks: (folderPath?: string) => Promise<any[]>;
      scanBookLibrary: (folderPath: string) => Promise<boolean>;
      getLibraryCount: (libraryId: number, type: 'MANGA' | 'BOOK') => Promise<number>;
      getManga: (id: number) => Promise<Manga | null>;
      getBook: (id: number) => Promise<Book | null>;
      getAdjacentBooks: (id: number) => Promise<{ prev: Book | null; next: Book | null }>;
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
        filters?: HistorySearchFilter[] | null;
      }) => Promise<HistoryStatisticsItem[]>;
      listRecentReads: (limit?: number) => Promise<HomeRecentItem[]>;
      getReadingActivityHeatmap: (weeks?: number) => Promise<HeatmapDay[]>;
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
        pageNames?: string[];
        pagePaths?: string[];
        chapters: number[];
        chaptersPages?: Record<number, string>;
        bookMark: number;
        favorite: boolean;
        cacheDir: string;
      }>;
      closeMangaReader: (sessionId: string) => Promise<boolean>;
      setMangaBookmark: (mangaId: number, page: number) => Promise<Manga | null>;
      toggleMangaFavorite: (mangaId: number) => Promise<Manga | null>;
      listMangaAnnotations: (mangaId: number) => Promise<MangaAnnotation[]>;
      listAllMangaAnnotations: () => Promise<
        (MangaAnnotation & { mangaTitle: string; mangaName: string })[]
      >;
      saveMangaAnnotation: (annotation: MangaAnnotation) => Promise<MangaAnnotation | null>;
      deleteMangaAnnotation: (id: number) => Promise<boolean>;
      getFileLink: (mangaId: number) => Promise<LinkedFile | null>;
      findFileLink: (mangaId: number, name: string, pages: number) => Promise<LinkedFile | null>;
      saveFileLink: (file: LinkedFile) => Promise<LinkedFile | null>;
      deleteFileLink: (mangaId: number) => Promise<boolean>;
      openFileLink: (filePath: string, mangaId?: number) => Promise<OpenFileLinkResult>;
      closeFileLink: (sessionId: string) => Promise<boolean>;
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
      listAllBookAnnotations: () => Promise<
        (BookAnnotation & { bookTitle: string; bookName: string })[]
      >;
      saveBookAnnotation: (annotation: BookAnnotation) => Promise<BookAnnotation | null>;
      deleteBookAnnotation: (id: number) => Promise<boolean>;
      listBookSearchHistory: (bookId: number) => Promise<BookSearchHistory[]>;
      saveBookSearchHistory: (bookId: number, search: string) => Promise<BookSearchHistory | null>;
      deleteBookSearchHistory: (id: number) => Promise<boolean>;
      deleteAllBookSearchHistory: (bookId: number) => Promise<boolean>;
      shareMarkStatus: () => Promise<any>;
      shareMarkSignIn: () => Promise<any>;
      shareMarkSignOut: () => Promise<any>;
      shareMarkSetEnabled: (enabled: boolean) => Promise<any>;
      shareMarkSetCloud: (cloud: string) => Promise<any>;
      shareMarkClearLastSync: (type: 'MANGA' | 'BOOK') => Promise<any>;
      shareMarkSync: (type: 'MANGA' | 'BOOK') => Promise<any>;
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

  async listMangas(folderPath?: string): Promise<Manga[]> {
    if (this.isElectron && window.electronAPI?.listMangas) {
      return (await window.electronAPI.listMangas(folderPath)) as Manga[];
    }
    return [];
  }

  async openMangaFile(): Promise<string | null> {
    if (this.isElectron && window.electronAPI?.openMangaFile) {
      return await window.electronAPI.openMangaFile();
    }
    return prompt('Digite o caminho do arquivo de mangá:');
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

  async getAdjacentBooks(bookId: number): Promise<{ prev: Book | null; next: Book | null }> {
    if (this.isElectron && window.electronAPI?.getAdjacentBooks) {
      return await window.electronAPI.getAdjacentBooks(bookId);
    }
    return { prev: null, next: null };
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
    filters?: HistorySearchFilter[] | null;
  }): Promise<HistoryStatisticsItem[]> {
    if (this.isElectron && window.electronAPI?.listHistoryAggregated) {
      return await window.electronAPI.listHistoryAggregated(options);
    }
    return [];
  }

  async listRecentReads(limit = 3): Promise<HomeRecentItem[]> {
    if (this.isElectron && window.electronAPI?.listRecentReads) {
      return await window.electronAPI.listRecentReads(limit);
    }
    return [];
  }

  async getReadingActivityHeatmap(_weeks?: number): Promise<HeatmapDay[]> {
    if (this.isElectron && window.electronAPI?.getReadingActivityHeatmap) {
      return await window.electronAPI.getReadingActivityHeatmap();
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

  async listMangaAnnotations(mangaId: number): Promise<MangaAnnotation[]> {
    if (this.isElectron && window.electronAPI?.listMangaAnnotations) {
      return await window.electronAPI.listMangaAnnotations(mangaId);
    }
    return [];
  }

  async listAllMangaAnnotations(): Promise<(MangaAnnotation & { mangaTitle: string; mangaName: string })[]> {
    if (this.isElectron && window.electronAPI?.listAllMangaAnnotations) {
      return await window.electronAPI.listAllMangaAnnotations();
    }
    console.warn('[electron] listAllMangaAnnotations unavailable — rebuild Electron preload');
    return [];
  }

  async saveMangaAnnotation(annotation: MangaAnnotation): Promise<MangaAnnotation | null> {
    if (this.isElectron && window.electronAPI?.saveMangaAnnotation) {
      return await window.electronAPI.saveMangaAnnotation(annotation);
    }
    return null;
  }

  async deleteMangaAnnotation(id: number): Promise<boolean> {
    if (this.isElectron && window.electronAPI?.deleteMangaAnnotation) {
      return await window.electronAPI.deleteMangaAnnotation(id);
    }
    return false;
  }

  async getFileLink(mangaId: number): Promise<LinkedFile | null> {
    if (this.isElectron && window.electronAPI?.getFileLink) {
      return await window.electronAPI.getFileLink(mangaId);
    }
    return null;
  }

  async findFileLink(mangaId: number, name: string, pages: number): Promise<LinkedFile | null> {
    if (this.isElectron && window.electronAPI?.findFileLink) {
      return await window.electronAPI.findFileLink(mangaId, name, pages);
    }
    return null;
  }

  async saveFileLink(file: LinkedFile): Promise<LinkedFile | null> {
    if (this.isElectron && window.electronAPI?.saveFileLink) {
      return await window.electronAPI.saveFileLink(file);
    }
    return null;
  }

  async deleteFileLink(mangaId: number): Promise<boolean> {
    if (this.isElectron && window.electronAPI?.deleteFileLink) {
      return await window.electronAPI.deleteFileLink(mangaId);
    }
    return false;
  }

  async openFileLink(filePath: string, mangaId?: number): Promise<OpenFileLinkResult | null> {
    if (this.isElectron && window.electronAPI?.openFileLink) {
      return await window.electronAPI.openFileLink(filePath, mangaId);
    }
    return null;
  }

  async closeFileLink(sessionId: string): Promise<boolean> {
    if (this.isElectron && window.electronAPI?.closeFileLink) {
      return await window.electronAPI.closeFileLink(sessionId);
    }
    return false;
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

  async listAllBookAnnotations(): Promise<(BookAnnotation & { bookTitle: string; bookName: string })[]> {
    if (this.isElectron && window.electronAPI?.listAllBookAnnotations) {
      return await window.electronAPI.listAllBookAnnotations();
    }
    console.warn('[electron] listAllBookAnnotations unavailable — rebuild Electron preload');
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

  async listBookSearchHistory(bookId: number): Promise<BookSearchHistory[]> {
    if (this.isElectron && window.electronAPI?.listBookSearchHistory) {
      return await window.electronAPI.listBookSearchHistory(bookId);
    }
    return [];
  }

  async saveBookSearchHistory(bookId: number, search: string): Promise<BookSearchHistory | null> {
    if (this.isElectron && window.electronAPI?.saveBookSearchHistory) {
      return await window.electronAPI.saveBookSearchHistory(bookId, search);
    }
    return null;
  }

  async deleteBookSearchHistory(id: number): Promise<boolean> {
    if (this.isElectron && window.electronAPI?.deleteBookSearchHistory) {
      return await window.electronAPI.deleteBookSearchHistory(id);
    }
    return false;
  }

  async deleteAllBookSearchHistory(bookId: number): Promise<boolean> {
    if (this.isElectron && window.electronAPI?.deleteAllBookSearchHistory) {
      return await window.electronAPI.deleteAllBookSearchHistory(bookId);
    }
    return false;
  }

  async shareMarkStatus(): Promise<any | null> {
    if (this.isElectron && window.electronAPI?.shareMarkStatus) {
      return await window.electronAPI.shareMarkStatus();
    }
    return null;
  }

  async shareMarkSignIn(): Promise<any | null> {
    if (this.isElectron && window.electronAPI?.shareMarkSignIn) {
      return await window.electronAPI.shareMarkSignIn();
    }
    return { ok: false, error: 'Electron IPC indisponível' };
  }

  async shareMarkSignOut(): Promise<any | null> {
    if (this.isElectron && window.electronAPI?.shareMarkSignOut) {
      return await window.electronAPI.shareMarkSignOut();
    }
    return null;
  }

  async shareMarkSetEnabled(enabled: boolean): Promise<any | null> {
    if (this.isElectron && window.electronAPI?.shareMarkSetEnabled) {
      return await window.electronAPI.shareMarkSetEnabled(enabled);
    }
    return null;
  }

  async shareMarkSetCloud(cloud: string): Promise<any | null> {
    if (this.isElectron && window.electronAPI?.shareMarkSetCloud) {
      return await window.electronAPI.shareMarkSetCloud(cloud);
    }
    return null;
  }

  async shareMarkClearLastSync(type: 'MANGA' | 'BOOK'): Promise<any | null> {
    if (this.isElectron && window.electronAPI?.shareMarkClearLastSync) {
      return await window.electronAPI.shareMarkClearLastSync(type);
    }
    return null;
  }

  async shareMarkSync(type: 'MANGA' | 'BOOK'): Promise<any | null> {
    if (this.isElectron && window.electronAPI?.shareMarkSync) {
      return await window.electronAPI.shareMarkSync(type);
    }
    return null;
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
