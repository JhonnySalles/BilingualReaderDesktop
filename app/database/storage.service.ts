import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { getAppDataDir } from '../utils/app-paths';
import { MigrationsManager } from './migrations';
import { MangaRepository } from './manga.repository';
import { BookRepository } from './book.repository';
import { BookConfigurationRepository } from './book-configuration.repository';
import { BookAnnotationRepository } from './book-annotation.repository';
import { MangaAnnotationRepository } from './manga-annotation.repository';
import { BookSearchRepository } from './book-search.repository';
import { FileLinkRepository } from './file-link.repository';
import { KanjiRepository } from './kanji.repository';
import { KanjaxRepository } from './kanjax.repository';
import { VocabularyRepository } from './vocabulary.repository';
import { AssistantHistoryRepository } from './assistant-history.repository';
import {
  HistoryRepository,
  HistoryContentType,
  HistorySessionInput,
  HistorySessionUpdate,
  HistoryBookmarkEditInput
} from './history.repository';
import { StatisticsRepository } from './statistics.repository';
import { TrackRepository } from './track.repository';
import { Manga, MangaAnnotation } from '../../src/app/core/models/entities/manga.model';
import { Book, BookAnnotation, BookConfiguration, BookSearchHistory } from '../../src/app/core/models/entities/book.model';
import { LinkedFile } from '../../src/app/core/models/entities/linked-file.model';
import { Track } from '../../src/app/core/models/entities/track.model';

export class StorageService {
  private db!: Database.Database;
  public mangaRepository!: MangaRepository;
  public bookRepository!: BookRepository;
  public bookConfigurationRepository!: BookConfigurationRepository;
  public bookAnnotationRepository!: BookAnnotationRepository;
  public mangaAnnotationRepository!: MangaAnnotationRepository;
  public bookSearchRepository!: BookSearchRepository;
  public fileLinkRepository!: FileLinkRepository;
  public kanjiRepository!: KanjiRepository;
  public kanjaxRepository!: KanjaxRepository;
  public vocabularyRepository!: VocabularyRepository;
  public assistantHistoryRepository!: AssistantHistoryRepository;
  public historyRepository!: HistoryRepository;
  public statisticsRepository!: StatisticsRepository;
  public trackRepository!: TrackRepository;

  constructor() {
    this.initDatabase();
  }

  getDbPath(): string {
    return path.join(getAppDataDir(), 'BilingualReaderDesktop.db');
  }

  private initDatabase(): void {
    const dbPath = this.getDbPath();
    
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    const migrationsManager = new MigrationsManager(this.db);
    migrationsManager.runMigrations();

    this.mangaRepository = new MangaRepository(this.db);
    this.bookRepository = new BookRepository(this.db);
    this.bookConfigurationRepository = new BookConfigurationRepository(this.db);
    this.bookAnnotationRepository = new BookAnnotationRepository(this.db);
    this.mangaAnnotationRepository = new MangaAnnotationRepository(this.db);
    this.bookSearchRepository = new BookSearchRepository(this.db);
    this.fileLinkRepository = new FileLinkRepository(this.db);
    this.kanjiRepository = new KanjiRepository(this.db);
    this.kanjaxRepository = new KanjaxRepository(this.db);
    this.vocabularyRepository = new VocabularyRepository(this.db);
    this.assistantHistoryRepository = new AssistantHistoryRepository(this.db);
    this.historyRepository = new HistoryRepository(this.db);
    this.statisticsRepository = new StatisticsRepository(this.db);
    this.trackRepository = new TrackRepository(this.db);
  }

  /** Checkpoint WAL into the main file so a single .db copy is consistent. */
  checkpointWal(): void {
    try {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {
      console.warn('[StorageService] wal_checkpoint failed', e);
    }
  }

  closeDatabase(): void {
    try {
      this.checkpointWal();
      this.db.close();
    } catch (e) {
      console.warn('[StorageService] closeDatabase failed', e);
    }
  }

  clearHistory(): number {
    return this.historyRepository.clearAll();
  }

  // --- Manga Repository Delegates ---

  public listMangas(libraryId?: number): Manga[] {
    return this.mangaRepository.list(libraryId);
  }

  public findMangaById(id: number): Manga | undefined {
    return this.mangaRepository.getById(id);
  }

  public findMangaByPath(filePath: string): Manga | undefined {
    return this.mangaRepository.getByPath(filePath);
  }

  public saveManga(manga: Partial<Manga>): number {
    return this.mangaRepository.save(manga);
  }

  public countMangas(libraryId?: number): number {
    return this.mangaRepository.getMangaCount(libraryId);
  }

  public deleteManga(id: number): void {
    this.mangaRepository.softDelete(id);
  }

  public softDeleteManga(id: number): void {
    this.mangaRepository.softDelete(id);
  }

  public clearMangaProgress(id: number) {
    return this.mangaRepository.clearProgress(id);
  }

  public markMangaRead(id: number) {
    return this.mangaRepository.markRead(id);
  }

  // --- Book Repository Delegates ---

  public listBooks(libraryId?: number): Book[] {
    return this.bookRepository.list(libraryId);
  }

  public findBookById(id: number): Book | undefined {
    return this.bookRepository.getById(id);
  }

  public getAdjacentBooks(bookId: number): { prev: Book | null; next: Book | null } {
    return this.bookRepository.getAdjacentBooks(bookId);
  }

  public getAdjacentMangas(mangaId: number): { prev: Manga | null; next: Manga | null } {
    return this.mangaRepository.getAdjacentMangas(mangaId);
  }

  public findBookByPath(filePath: string): Book | undefined {
    return this.bookRepository.getByPath(filePath);
  }

  public saveBook(book: Partial<Book>): number {
    return this.bookRepository.save(book);
  }

  public setBookPassword(id: number, password: string): Book | undefined {
    return this.bookRepository.setPassword(id, password);
  }

  public countBooks(libraryId?: number): number {
    return this.bookRepository.getBookCount(libraryId);
  }

  public deleteBook(id: number): void {
    this.bookRepository.softDelete(id);
  }

  public softDeleteBook(id: number): void {
    this.bookRepository.softDelete(id);
  }

  public clearBookProgress(id: number) {
    return this.bookRepository.clearProgress(id);
  }

  public markBookRead(id: number) {
    return this.bookRepository.markRead(id);
  }

  public getBookConfiguration(bookId: number): BookConfiguration | undefined {
    return this.bookConfigurationRepository.getByBook(bookId);
  }

  public saveBookConfiguration(config: BookConfiguration): number {
    return this.bookConfigurationRepository.upsert(config);
  }

  public listBookAnnotations(bookId: number): BookAnnotation[] {
    return this.bookAnnotationRepository.listByBook(bookId);
  }

  public listAllBookAnnotations(): (BookAnnotation & { bookTitle: string; bookName: string })[] {
    return this.bookAnnotationRepository.listAll();
  }

  public saveBookAnnotation(annotation: BookAnnotation): number {
    return this.bookAnnotationRepository.save(annotation);
  }

  public getBookAnnotation(id: number): BookAnnotation | undefined {
    return this.bookAnnotationRepository.getById(id);
  }

  public deleteBookAnnotation(id: number): boolean {
    return this.bookAnnotationRepository.delete(id);
  }

  public listMangaAnnotations(mangaId: number): MangaAnnotation[] {
    return this.mangaAnnotationRepository.listByManga(mangaId);
  }

  public listAllMangaAnnotations(): (MangaAnnotation & { mangaTitle: string; mangaName: string })[] {
    return this.mangaAnnotationRepository.listAll();
  }

  public saveMangaAnnotation(annotation: MangaAnnotation): number {
    return this.mangaAnnotationRepository.save(annotation);
  }

  public getMangaAnnotation(id: number): MangaAnnotation | undefined {
    return this.mangaAnnotationRepository.getById(id);
  }

  public deleteMangaAnnotation(id: number): boolean {
    return this.mangaAnnotationRepository.delete(id);
  }

  public listBookSearchHistory(bookId: number): BookSearchHistory[] {
    return this.bookSearchRepository.listHistory(bookId);
  }

  public saveBookSearchHistory(bookId: number, search: string): BookSearchHistory {
    return this.bookSearchRepository.saveHistory(bookId, search);
  }

  public deleteBookSearchHistory(id: number): boolean {
    return this.bookSearchRepository.deleteHistory(id);
  }

  public deleteAllBookSearchHistory(bookId: number): boolean {
    return this.bookSearchRepository.deleteAllHistory(bookId);
  }

  // --- File link (bilingual manga pages) ---

  public getFileLinkByManga(mangaId: number): LinkedFile | undefined {
    return this.fileLinkRepository.getByManga(mangaId);
  }

  public findFileLinkByName(mangaId: number, name: string, pages: number): LinkedFile | undefined {
    return this.fileLinkRepository.findByFileName(mangaId, name, pages);
  }

  public saveFileLink(file: LinkedFile): number {
    if (file.id) {
      this.fileLinkRepository.update(file);
      return file.id;
    }
    return this.fileLinkRepository.save(file);
  }

  public deleteFileLinkByManga(mangaId: number): void {
    this.fileLinkRepository.deleteByManga(mangaId);
  }

  public deleteFileLink(file: LinkedFile): void {
    this.fileLinkRepository.delete(file);
  }

  public listBooksDeleted(libraryId?: number): Book[] {
    return this.bookRepository.listDeleted(libraryId);
  }

  // --- History / Statistics ---

  public getStatisticsOverview() {
    return this.statisticsRepository.getOverview();
  }

  public getStatisticsChart(type: HistoryContentType, year: number, libraryId?: number | null) {
    return this.statisticsRepository.getChartData(type, year, libraryId);
  }

  public listStatisticsYears(type: HistoryContentType) {
    return this.statisticsRepository.listYears(type);
  }

  public listLibrariesByType(type: HistoryContentType) {
    return this.statisticsRepository.listLibrariesByType(type);
  }

  public listHistoryAggregated(options: {
    type: HistoryContentType;
    year?: number | null;
    libraryId?: number | null;
    search?: string | null;
    filters?: import('./history.repository').HistorySearchFilter[] | null;
  }) {
    return this.historyRepository.listAggregated(options);
  }

  public listRecentReads(limit = 3) {
    return this.historyRepository.listRecent(limit);
  }

  public getReadingActivityHeatmap(_weeks?: number) {
    return this.statisticsRepository.getReadingActivityHeatmap();
  }

  public startHistorySession(input: HistorySessionInput): number {
    return this.historyRepository.startSession(input);
  }

  public saveHistoryBookmarkEdit(input: HistoryBookmarkEditInput): number {
    return this.historyRepository.saveBookmarkEdit(input);
  }

  public updateHistorySession(update: HistorySessionUpdate): void {
    this.historyRepository.updateSession(update);
  }

  public endHistorySession(
    id: number,
    pageEnd: number,
    pages?: number,
    useTTS?: boolean
  ): void {
    this.historyRepository.updateSession({ id, pageEnd, pages, endSession: true, useTTS });
  }

  // --- Vocabulary / Kanjax ---

  public searchVocabulary(options: import('./vocabulary.repository').VocabularySearchOptions) {
    return this.vocabularyRepository.searchPage(options);
  }

  public getVocabulary(id: number) {
    return this.vocabularyRepository.get(id);
  }

  public setVocabularyFavorite(id: number, favorite: boolean) {
    return this.vocabularyRepository.setFavorite(id, favorite);
  }

  public getVocabularyRelated(vocabularyId: number, titleHint?: string | null) {
    return {
      mangas: this.vocabularyRepository.findRelatedMangas(vocabularyId, titleHint),
      books: this.vocabularyRepository.findRelatedBooks(vocabularyId, titleHint)
    };
  }

  public getKanjax(kanji: string) {
    return this.kanjaxRepository.get(kanji) ?? null;
  }

  public getKanjaxForWord(word: string) {
    return this.kanjaxRepository.forWord(word);
  }

  public getOrCreateLibrary(folderPath: string, type: 'MANGA' | 'BOOK' = 'MANGA'): number {
    const normalized = path.normalize(folderPath);
    const findStmt = this.db.prepare(`SELECT id FROM Libraries WHERE LOWER(path) = LOWER(?) OR path = ?`);
    const row = findStmt.get(normalized, folderPath) as { id: number } | undefined;
    if (row) return row.id;

    const title = path.basename(folderPath) || 'Biblioteca';
    const insertStmt = this.db.prepare(`INSERT INTO Libraries (title, path, type, enabled, excluded) VALUES (?, ?, ?, 1, 0)`);
    const res = insertStmt.run(title, folderPath, type);
    return Number(res.lastInsertRowid);
  }

  /* ================= Track (Reading Tracker) Methods ================= */

  public getAllTracks(): Track[] {
    return this.trackRepository.findAll();
  }

  public getTracksByLibrary(libraryId: number): Track[] {
    return this.trackRepository.findByLibrary(libraryId);
  }

  public getTrackById(id: number): Track | null {
    return this.trackRepository.find(id) ?? null;
  }

  public saveTrack(track: Partial<Track>): number {
    return this.trackRepository.save(track);
  }

  public deleteTrack(id: number): void {
    this.trackRepository.delete(id);
  }

  public updateTrackProgress(id: number, chaptersRead: number, volumesRead: number, status?: string): void {
    this.trackRepository.updateProgress(id, chaptersRead, volumesRead, status);
  }

  public listAllLibraries(): Array<{ id: number; title: string; type: 'MANGA' | 'BOOK'; path: string }> {
    const stmt = this.db.prepare(`
      SELECT id, title, type, path
      FROM Libraries
      WHERE excluded = 0
      ORDER BY type ASC, title ASC
    `);
    return stmt.all() as any[];
  }

  public getLibraryById(id: number): { id: number; title: string; type: 'MANGA' | 'BOOK'; path: string } | null {
    const stmt = this.db.prepare(`SELECT id, title, type, path FROM Libraries WHERE id = ? LIMIT 1`);
    const row = stmt.get(id);
    return (row as any) ?? null;
  }
}

