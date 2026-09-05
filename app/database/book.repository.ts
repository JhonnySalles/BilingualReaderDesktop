import Database from 'better-sqlite3';
import * as path from 'path';
import { BaseRepository } from './base.repository';
import { Book } from '../../src/app/core/models/entities/book.model';
import { FileType } from '../../src/app/core/models/enums/app-enums';

export class BookRepository extends BaseRepository<Book, number> {
  constructor(db: Database.Database) {
    super(db, 'Book', 'id');
  }

  private mapRowToBook(row: any): Book {
    return {
      id: row.id,
      title: row.title,
      path: row.path,
      folder: row.folder,
      name: row.name,
      fileSize: row.size ?? 0,
      fileType: row.type as FileType,
      pages: row.pages ?? 1,
      bookMark: row.book_mark ?? 0,
      completed: Boolean(row.completed),
      favorite: Boolean(row.favorite),
      author: row.author || '',
      series: row.series || '',
      genre: row.genre || '',
      publisher: row.publisher || '',
      volume: row.volume || '',
      release: row.release,
      language: row.language || '',
      isbn: row.isbn || '',
      annotation: row.annotation || '',
      tags: row.tags || '',
      chapter: row.chapter || '',
      chapterDescription: row.chapter_description || '',
      password: row.password || '',
      fkLibrary: row.id_library,
      excluded: Boolean(row.excluded),
      dateCreate: row.date_create,
      lastAccess: row.last_access,
      lastAlteration: row.last_alteration,
      fileAlteration: row.file_alteration,
      lastVocabImport: row.last_vocabulary_import,
      lastVerify: row.last_verify,
      coverPath: row.cover_path
    };
  }

  public getBookCount(libraryId?: number): number {
    if (libraryId !== undefined && libraryId !== null) {
      const stmt = this.db.prepare(`SELECT count(*) as count FROM Book WHERE id_library = ? AND excluded = 0`);
      const row = stmt.get(libraryId) as { count: number };
      return row ? row.count : 0;
    }
    const stmt = this.db.prepare(`SELECT count(*) as count FROM Book WHERE excluded = 0`);
    const row = stmt.get() as { count: number };
    return row ? row.count : 0;
  }

  public list(libraryId?: number): Book[] {
    if (libraryId !== undefined && libraryId !== null) {
      const stmt = this.db.prepare(`SELECT * FROM Book WHERE id_library = ? AND excluded = 0 ORDER BY title ASC`);
      return stmt.all(libraryId).map(row => this.mapRowToBook(row));
    }
    const stmt = this.db.prepare(`SELECT * FROM Book WHERE excluded = 0 ORDER BY title ASC`);
    return stmt.all().map(row => this.mapRowToBook(row));
  }

  public listRecentChange(libraryId?: number): Book[] {
    if (libraryId !== undefined && libraryId !== null) {
      const stmt = this.db.prepare(
        `SELECT * FROM Book WHERE id_library = ? AND excluded = 0 AND last_alteration >= datetime('now','-5 hour')`
      );
      return stmt.all(libraryId).map(row => this.mapRowToBook(row));
    }
    const stmt = this.db.prepare(
      `SELECT * FROM Book WHERE excluded = 0 AND last_alteration >= datetime('now','-5 hour')`
    );
    return stmt.all().map(row => this.mapRowToBook(row));
  }

  public listHistory(): Book[] {
    const stmt = this.db.prepare(
      `SELECT * FROM Book WHERE last_access IS NOT NULL ORDER BY last_access DESC`
    );
    return stmt.all().map(row => this.mapRowToBook(row));
  }

  public getById(id: number): Book | undefined {
    const stmt = this.db.prepare(`SELECT * FROM Book WHERE id = ?`);
    const row = stmt.get(id);
    return row ? this.mapRowToBook(row) : undefined;
  }

  public getByFileName(name: string): Book | undefined {
    const stmt = this.db.prepare(`SELECT * FROM Book WHERE excluded = 0 AND UPPER(name) = UPPER(?)`);
    const row = stmt.get(name);
    return row ? this.mapRowToBook(row) : undefined;
  }

  public getByPath(filePath: string): Book | undefined {
    if (!filePath) return undefined;
    const normalized = path.normalize(filePath);
    const forwardSlash = normalized.replace(/\\/g, '/');
    const backSlash = normalized.replace(/\//g, '\\');
    const stmt = this.db.prepare(
      `SELECT * FROM Book WHERE path = ? OR path = ? OR path = ? OR LOWER(path) = LOWER(?)`
    );
    const row = stmt.get(filePath, forwardSlash, backSlash, normalized);
    return row ? this.mapRowToBook(row) : undefined;
  }

  public listByFolder(folder: string): Book[] {
    const stmt = this.db.prepare(`SELECT * FROM Book WHERE excluded = 0 AND folder = ? ORDER BY title`);
    return stmt.all(folder).map(row => this.mapRowToBook(row));
  }

  public listOrderByTitle(libraryId?: number): Book[] {
    if (libraryId !== undefined && libraryId !== null) {
      const stmt = this.db.prepare(`SELECT * FROM Book WHERE id_library = ? AND excluded = 0 ORDER BY title`);
      return stmt.all(libraryId).map(row => this.mapRowToBook(row));
    }
    const stmt = this.db.prepare(`SELECT * FROM Book WHERE excluded = 0 ORDER BY title`);
    return stmt.all().map(row => this.mapRowToBook(row));
  }

  public updateBookMark(id: number, marker: number): void {
    const stmt = this.db.prepare(`UPDATE Book SET book_mark = ? WHERE id = ?`);
    stmt.run(marker, id);
  }

  public softDelete(id: number): void {
    const stmt = this.db.prepare(`UPDATE Book SET excluded = 1 WHERE id = ?`);
    stmt.run(id);
  }

  public clearProgress(id: number): Book | undefined {
    const stmt = this.db.prepare(
      `UPDATE Book SET book_mark = 0, completed = 0, last_alteration = ? WHERE id = ?`
    );
    stmt.run(new Date().toISOString(), id);
    return this.getById(id);
  }

  public markRead(id: number): Book | undefined {
    const book = this.getById(id);
    if (!book) return undefined;
    const pages = Math.max(1, book.pages || 1);
    const stmt = this.db.prepare(
      `UPDATE Book SET book_mark = ?, completed = 1, last_alteration = ? WHERE id = ?`
    );
    stmt.run(pages, new Date().toISOString(), id);
    return this.getById(id);
  }

  public listDeleted(libraryId?: number): Book[] {
    if (libraryId !== undefined && libraryId !== null) {
      const stmt = this.db.prepare(`SELECT * FROM Book WHERE id_library = ? AND excluded = 1`);
      return stmt.all(libraryId).map(row => this.mapRowToBook(row));
    }
    const stmt = this.db.prepare(`SELECT * FROM Book WHERE excluded = 1`);
    return stmt.all().map(row => this.mapRowToBook(row));
  }

  public save(book: Partial<Book>): number {
    if (!book.id && book.path) {
      const existing = this.getByPath(book.path);
      if (existing) {
        book.id = existing.id;
      }
    }
    if (book.id) {
      const stmt = this.db.prepare(`
        UPDATE Book SET
          title = ?, path = ?, folder = ?, name = ?, size = ?,
          type = ?, pages = ?, book_mark = ?, completed = ?, favorite = ?,
          author = ?, series = ?, genre = ?, publisher = ?, volume = ?, release = ?,
          language = ?, isbn = ?, annotation = ?, tags = ?, chapter = ?, chapter_description = ?,
          password = ?, id_library = ?, excluded = ?, last_access = ?, last_alteration = ?,
          file_alteration = ?, last_vocabulary_import = ?, last_verify = ?, cover_path = ?
        WHERE id = ?
      `);
      stmt.run(
        book.title, book.path, book.folder, book.name, book.fileSize ?? 0,
        book.fileType, book.pages ?? 1, book.bookMark ?? 0,
        book.completed ? 1 : 0, book.favorite ? 1 : 0, book.author ?? '', book.series ?? '',
        book.genre ?? '', book.publisher ?? '', book.volume ?? '', book.release ?? null,
        book.language ?? '', book.isbn ?? '', book.annotation ?? '', book.tags ?? '',
        book.chapter ?? '', book.chapterDescription ?? '', book.password ?? '',
        book.fkLibrary ?? null,
        book.excluded ? 1 : 0, book.lastAccess ?? null, book.lastAlteration ?? new Date().toISOString(),
        book.fileAlteration ?? new Date().toISOString(), book.lastVocabImport ?? null, book.lastVerify ?? null,
        book.coverPath ?? null, book.id
      );
      return book.id;
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO Book (
          title, path, folder, name, size, type, pages,
          book_mark, completed, favorite, author, series, genre,
          publisher, volume, release, language, isbn, annotation, tags,
          chapter, chapter_description, password,
          id_library, excluded, date_create, last_access,
          last_alteration, file_alteration, last_vocabulary_import, last_verify, cover_path
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);
      const info = stmt.run(
        book.title, book.path, book.folder, book.name, book.fileSize ?? 0, book.fileType, book.pages ?? 1,
        book.bookMark ?? 0, book.completed ? 1 : 0, book.favorite ? 1 : 0,
        book.author ?? '', book.series ?? '', book.genre ?? '', book.publisher ?? '', book.volume ?? '',
        book.release ?? null, book.language ?? '', book.isbn ?? '', book.annotation ?? '', book.tags ?? '',
        book.chapter ?? '', book.chapterDescription ?? '', book.password ?? '',
        book.fkLibrary ?? null, book.excluded ? 1 : 0,
        new Date().toISOString(), book.lastAccess ?? null, book.lastAlteration ?? new Date().toISOString(),
        book.fileAlteration ?? new Date().toISOString(), book.lastVocabImport ?? null, book.lastVerify ?? null,
        book.coverPath ?? null
      );
      return Number(info.lastInsertRowid);
    }
  }
}
