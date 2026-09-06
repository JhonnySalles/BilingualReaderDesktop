import Database from 'better-sqlite3';
import { MangaAnnotation } from '../../src/app/core/models/entities/manga.model';

export class MangaAnnotationRepository {
  constructor(private db: Database.Database) {}

  private mapRow(row: any): MangaAnnotation {
    return {
      id: row.id,
      fkManga: row.id_manga,
      page: row.page ?? 0,
      pages: row.pages ?? 0,
      markType: row.type || 'PageMark',
      chapter: row.chapter || '',
      folder: row.folder || '',
      note: row.annotation || '',
      dateCreate: row.created || undefined,
      alteration: row.alteration || undefined
    };
  }

  listByManga(mangaId: number): MangaAnnotation[] {
    const stmt = this.db.prepare(
      `SELECT * FROM MangaMark WHERE id_manga = ? ORDER BY page ASC, id ASC`
    );
    return (stmt.all(mangaId) as any[]).map(row => this.mapRow(row));
  }

  listAll(): (MangaAnnotation & { mangaTitle: string; mangaName: string })[] {
    const stmt = this.db.prepare(`
      SELECT A.*, M.title AS manga_title, M.name AS manga_name
      FROM MangaMark A
      INNER JOIN Manga M ON M.id = A.id_manga AND M.excluded = 0
      ORDER BY M.title ASC, A.page ASC, A.id ASC
    `);
    return (stmt.all() as any[]).map(row => ({
      ...this.mapRow(row),
      mangaTitle: row.manga_title || row.manga_name || '',
      mangaName: row.manga_name || ''
    }));
  }

  findPageMark(mangaId: number, page: number): MangaAnnotation | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM MangaMark
      WHERE id_manga = ? AND page = ? AND type = 'PageMark'
      ORDER BY id DESC LIMIT 1
    `);
    const row = stmt.get(mangaId, page);
    return row ? this.mapRow(row) : undefined;
  }

  getById(id: number): MangaAnnotation | undefined {
    const stmt = this.db.prepare(`SELECT * FROM MangaMark WHERE id = ?`);
    const row = stmt.get(id);
    return row ? this.mapRow(row) : undefined;
  }

  save(annotation: MangaAnnotation): number {
    const now = new Date().toISOString();
    const alteration = now;
    const created = annotation.dateCreate || now;
    const markType = annotation.markType || 'PageMark';

    if (annotation.id) {
      const stmt = this.db.prepare(`
        UPDATE MangaMark SET
          id_manga = ?, page = ?, pages = ?, type = ?, chapter = ?,
          folder = ?, annotation = ?, alteration = ?
        WHERE id = ?
      `);
      stmt.run(
        annotation.fkManga,
        annotation.page ?? 0,
        annotation.pages ?? 0,
        markType,
        annotation.chapter || '',
        annotation.folder || '',
        annotation.note || '',
        alteration,
        annotation.id
      );
      return annotation.id;
    }

    const stmt = this.db.prepare(`
      INSERT INTO MangaMark (
        id_manga, page, pages, type, chapter, folder, annotation, alteration, created
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      annotation.fkManga,
      annotation.page ?? 0,
      annotation.pages ?? 0,
      markType,
      annotation.chapter || '',
      annotation.folder || '',
      annotation.note || '',
      alteration,
      created
    );
    return Number(info.lastInsertRowid);
  }

  delete(id: number): boolean {
    const stmt = this.db.prepare(`DELETE FROM MangaMark WHERE id = ?`);
    const info = stmt.run(id);
    return info.changes > 0;
  }
}
