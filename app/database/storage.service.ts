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
import { Manga } from '../../src/app/core/models/entities/manga.model';
import { Book } from '../../src/app/core/models/entities/book.model';

export class StorageService {
  private db!: Database.Database;
  public mangaRepository!: MangaRepository;
  public bookRepository!: BookRepository;
  public kanjiRepository!: KanjiRepository;
  public kanjaxRepository!: KanjaxRepository;
  public vocabularyRepository!: VocabularyRepository;

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
  }

  // --- Manga Repository Delegates ---

  public listMangas(libraryId?: number): Manga[] {
    return this.mangaRepository.list(libraryId);
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
    this.mangaRepository.delete(id);
  }

  // --- Book Repository Delegates ---

  public listBooks(libraryId?: number): Book[] {
    return this.bookRepository.list(libraryId);
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
    this.bookRepository.delete(id);
  }

  public listBooksDeleted(libraryId?: number): Book[] {
    return this.bookRepository.listDeleted(libraryId);
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
