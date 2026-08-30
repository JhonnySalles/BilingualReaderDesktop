import Database from 'better-sqlite3';
import { BaseRepository } from './base.repository';
import { Manga } from '../../src/app/core/models/entities/manga.model';
import { FileType } from '../../src/app/core/models/enums/app-enums';

export class MangaRepository extends BaseRepository<Manga, number> {
  constructor(db: Database.Database) {
    super(db, 'Manga', 'id');
  }

  private mapRowToManga(row: any): Manga {
    return {
      id: row.id,
      title: row.title,
      path: row.path,
      folder: row.folder,
      name: row.name,
      fileSize: row.size ?? 0,
      fileType: row.type as FileType,
      pages: row.pages ?? 1,
      chapters: typeof row.chapters === 'string' ? (JSON.parse(row.chapters || '[]')) : (row.chapters || []),
      chaptersPages: typeof row.chapters_pages === 'string' ? (JSON.parse(row.chapters_pages || '{}')) : (row.chapters_pages || {}),
      bookMark: row.book_mark ?? 0,
      completed: Boolean(row.completed),
      favorite: Boolean(row.favorite),
      hasSubtitle: Boolean(row.has_subtitle),
      author: row.author || '',
      series: row.series || '',
      genre: row.genre || '',
      publisher: row.publisher || '',
      volume: row.volume || '',
      release: row.release,
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

  public getMangaCount(): number {
    const stmt = this.db.prepare(`SELECT count(*) as count FROM Manga`);
    const row = stmt.get() as { count: number };
    return row ? row.count : 0;
  }

  public list(libraryId?: number): Manga[] {
    if (libraryId !== undefined && libraryId !== null) {
      const stmt = this.db.prepare(`SELECT * FROM Manga WHERE id_library = ? AND excluded = 0 ORDER BY title ASC`);
      return stmt.all(libraryId).map(row => this.mapRowToManga(row));
    }
    const stmt = this.db.prepare(`SELECT * FROM Manga WHERE excluded = 0 ORDER BY title ASC`);
    return stmt.all().map(row => this.mapRowToManga(row));
  }

  public listRecentChange(libraryId?: number): Manga[] {
    if (libraryId !== undefined && libraryId !== null) {
      const stmt = this.db.prepare(
        `SELECT * FROM Manga WHERE id_library = ? AND excluded = 0 AND last_alteration >= datetime('now','-5 hour')`
      );
      return stmt.all(libraryId).map(row => this.mapRowToManga(row));
    }
    const stmt = this.db.prepare(
      `SELECT * FROM Manga WHERE excluded = 0 AND last_alteration >= datetime('now','-5 hour')`
    );
    return stmt.all().map(row => this.mapRowToManga(row));
  }

  public listHistory(): Manga[] {
    const stmt = this.db.prepare(
      `SELECT * FROM Manga WHERE last_access IS NOT NULL ORDER BY last_access DESC`
    );
    return stmt.all().map(row => this.mapRowToManga(row));
  }

  public getByFileName(name: string): Manga | undefined {
    const stmt = this.db.prepare(`SELECT * FROM Manga WHERE excluded = 0 AND UPPER(name) = UPPER(?)`);
    const row = stmt.get(name);
    return row ? this.mapRowToManga(row) : undefined;
  }

  public getByPath(filePath: string): Manga | undefined {
    const stmt = this.db.prepare(`SELECT * FROM Manga WHERE excluded = 0 AND path = ?`);
    const row = stmt.get(filePath);
    return row ? this.mapRowToManga(row) : undefined;
  }

  public listByFolder(folder: string): Manga[] {
    const stmt = this.db.prepare(`SELECT * FROM Manga WHERE excluded = 0 AND folder = ? ORDER BY title`);
    return stmt.all(folder).map(row => this.mapRowToManga(row));
  }

  public listOrderByTitle(libraryId?: number): Manga[] {
    if (libraryId !== undefined && libraryId !== null) {
      const stmt = this.db.prepare(`SELECT * FROM Manga WHERE id_library = ? AND excluded = 0 ORDER BY title`);
      return stmt.all(libraryId).map(row => this.mapRowToManga(row));
    }
    const stmt = this.db.prepare(`SELECT * FROM Manga WHERE excluded = 0 ORDER BY title`);
    return stmt.all().map(row => this.mapRowToManga(row));
  }

  public updateBookMark(id: number, marker: number): void {
    const stmt = this.db.prepare(`UPDATE Manga SET book_mark = ? WHERE id = ?`);
    stmt.run(marker, id);
  }

  public softDelete(id: number): void {
    const stmt = this.db.prepare(`UPDATE Manga SET excluded = 1 WHERE id = ?`);
    stmt.run(id);
  }

  public listDeleted(libraryId?: number): Manga[] {
    if (libraryId !== undefined && libraryId !== null) {
      const stmt = this.db.prepare(`SELECT * FROM Manga WHERE id_library = ? AND excluded = 1`);
      return stmt.all(libraryId).map(row => this.mapRowToManga(row));
    }
    const stmt = this.db.prepare(`SELECT * FROM Manga WHERE excluded = 1`);
    return stmt.all().map(row => this.mapRowToManga(row));
  }

  public save(manga: Partial<Manga>): number {
    const chaptersJson = typeof manga.chapters === 'string' ? manga.chapters : JSON.stringify(manga.chapters || []);
    const chaptersPagesJson = typeof manga.chaptersPages === 'string' ? manga.chaptersPages : JSON.stringify(manga.chaptersPages || {});

    if (manga.id) {
      const stmt = this.db.prepare(`
        UPDATE Manga SET
          title = ?, path = ?, folder = ?, name = ?, size = ?,
          type = ?, pages = ?, chapters = ?, chapters_pages = ?, book_mark = ?,
          completed = ?, favorite = ?, has_subtitle = ?, author = ?, series = ?,
          genre = ?, publisher = ?, volume = ?, release = ?, id_library = ?,
          excluded = ?, last_access = ?, last_alteration = ?, file_alteration = ?,
          last_vocabulary_import = ?, last_verify = ?
        WHERE id = ?
      `);
      stmt.run(
        manga.title, manga.path, manga.folder, manga.name, manga.fileSize ?? 0,
        manga.fileType, manga.pages ?? 1, chaptersJson, chaptersPagesJson, manga.bookMark ?? 0,
        manga.completed ? 1 : 0, manga.favorite ? 1 : 0, manga.hasSubtitle ? 1 : 0, manga.author ?? '', manga.series ?? '',
        manga.genre ?? '', manga.publisher ?? '', manga.volume ?? '', manga.release ?? null, manga.fkLibrary ?? null,
        manga.excluded ? 1 : 0, manga.lastAccess ?? null, manga.lastAlteration ?? new Date().toISOString(), manga.fileAlteration ?? new Date().toISOString(),
        manga.lastVocabImport ?? null, manga.lastVerify ?? null, manga.id
      );
      return manga.id;
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO Manga (
          title, path, folder, name, size, type, pages, chapters, chapters_pages,
          book_mark, completed, favorite, has_subtitle, author, series, genre,
          publisher, volume, release, id_library, excluded, date_create, last_access,
          last_alteration, file_alteration, last_vocabulary_import, last_verify
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);
      const info = stmt.run(
        manga.title, manga.path, manga.folder, manga.name, manga.fileSize ?? 0, manga.fileType, manga.pages ?? 1,
        chaptersJson, chaptersPagesJson, manga.bookMark ?? 0,
        manga.completed ? 1 : 0, manga.favorite ? 1 : 0, manga.hasSubtitle ? 1 : 0,
        manga.author ?? '', manga.series ?? '', manga.genre ?? '', manga.publisher ?? '', manga.volume ?? '',
        manga.release ?? null, manga.fkLibrary ?? null, manga.excluded ? 1 : 0,
        new Date().toISOString(), manga.lastAccess ?? null, manga.lastAlteration ?? new Date().toISOString(),
        manga.fileAlteration ?? new Date().toISOString(), manga.lastVocabImport ?? null, manga.lastVerify ?? null
      );
      return Number(info.lastInsertRowid);
    }
  }
}
