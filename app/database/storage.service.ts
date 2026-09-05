import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { MigrationsManager } from './migrations';
import { MangaRepository } from './manga.repository';
import { BookRepository } from './book.repository';
import { KanjiRepository } from './kanji.repository';
import { KanjaxRepository } from './kanjax.repository';
import { VocabularyRepository } from './vocabulary.repository';
import { HistoryRepository, HistoryContentType, HistorySessionInput, HistorySessionUpdate } from './history.repository';
import { StatisticsRepository } from './statistics.repository';
import { Manga } from '../../src/app/core/models/entities/manga.model';
import { Book } from '../../src/app/core/models/entities/book.model';

export class StorageService {
  private db!: Database.Database;
  public mangaRepository!: MangaRepository;
  public bookRepository!: BookRepository;
  public kanjiRepository!: KanjiRepository;
  public kanjaxRepository!: KanjaxRepository;
  public vocabularyRepository!: VocabularyRepository;
  public historyRepository!: HistoryRepository;
  public statisticsRepository!: StatisticsRepository;

  constructor() {
    this.initDatabase();
  }

  private initDatabase(): void {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'BilingualReaderDesktop.db');
    
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
    this.kanjiRepository = new KanjiRepository(this.db);
    this.kanjaxRepository = new KanjaxRepository(this.db);
    this.vocabularyRepository = new VocabularyRepository(this.db);
    this.historyRepository = new HistoryRepository(this.db);
    this.statisticsRepository = new StatisticsRepository(this.db);
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

  public findBookByPath(filePath: string): Book | undefined {
    return this.bookRepository.getByPath(filePath);
  }

  public saveBook(book: Partial<Book>): number {
    return this.bookRepository.save(book);
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
  }) {
    return this.historyRepository.listAggregated(options);
  }

  public startHistorySession(input: HistorySessionInput): number {
    return this.historyRepository.startSession(input);
  }

  public updateHistorySession(update: HistorySessionUpdate): void {
    this.historyRepository.updateSession(update);
  }

  public endHistorySession(id: number, pageEnd: number, pages?: number): void {
    this.historyRepository.updateSession({ id, pageEnd, pages, endSession: true });
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
}
