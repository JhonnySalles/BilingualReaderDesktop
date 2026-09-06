import Database from 'better-sqlite3';
import {
  BookAnnotation,
  BookAnnotationColor
} from '../../src/app/core/models/entities/book.model';

export class BookAnnotationRepository {
  constructor(private db: Database.Database) {}

  private mapRow(row: any): BookAnnotation {
    const rangeStr = typeof row.range === 'string' ? row.range : '';
    const rangeParts = rangeStr
      .split(',')
      .map((p: string) => Number(p.trim()))
      .filter((n: number) => !Number.isNaN(n));

    return {
      id: row.id,
      fkBook: row.id_book,
      page: row.page ?? 0,
      pages: row.pages ?? 0,
      text: row.text || '',
      note: row.annotation || '',
      color: row.color || BookAnnotationColor.Yellow,
      chapter: row.chapter || '',
      chapterNumber: typeof row.chapter_number === 'number' ? row.chapter_number : 0,
      range: rangeParts.length >= 2 ? [rangeParts[0], rangeParts[1]] : undefined,
      markType: row.type || 'Annotation',
      favorite: Boolean(row.favorite),
      cfiRange: row.cfi_range || '',
      fontSize: typeof row.font_size === 'number' ? row.font_size : 0,
      dateCreate: row.created || undefined,
      alteration: row.alteration || undefined
    };
  }

  private serializeRange(range?: number[]): string {
    if (!range || range.length < 2) return '';
    return `${range[0]},${range[1]}`;
  }

  listByBook(bookId: number): BookAnnotation[] {
    const stmt = this.db.prepare(
      `SELECT * FROM BookAnnotation WHERE id_book = ? ORDER BY alteration DESC, id DESC`
    );
    return (stmt.all(bookId) as any[]).map(row => this.mapRow(row));
  }

  getById(id: number): BookAnnotation | undefined {
    const stmt = this.db.prepare(`SELECT * FROM BookAnnotation WHERE id = ?`);
    const row = stmt.get(id);
    return row ? this.mapRow(row) : undefined;
  }

  save(annotation: BookAnnotation): number {
    const now = new Date().toISOString();
    const alteration = now;
    const created = annotation.dateCreate || now;
    const markType = annotation.markType || 'Annotation';
    const color = annotation.color || BookAnnotationColor.Yellow;
    const range = this.serializeRange(annotation.range);

    if (annotation.id) {
      const stmt = this.db.prepare(`
        UPDATE BookAnnotation SET
          id_book = ?, page = ?, pages = ?, font_size = ?, type = ?,
          chapter_number = ?, chapter = ?, text = ?, range = ?, annotation = ?,
          favorite = ?, color = ?, cfi_range = ?, alteration = ?
        WHERE id = ?
      `);
      stmt.run(
        annotation.fkBook,
        annotation.page ?? 0,
        annotation.pages ?? 0,
        annotation.fontSize ?? 0,
        markType,
        annotation.chapterNumber ?? 0,
        annotation.chapter || '',
        annotation.text || '',
        range,
        annotation.note || '',
        annotation.favorite ? 1 : 0,
        color,
        annotation.cfiRange || '',
        alteration,
        annotation.id
      );
      return annotation.id;
    }

    const stmt = this.db.prepare(`
      INSERT INTO BookAnnotation (
        id_book, page, pages, font_size, type, chapter_number, chapter,
        text, range, annotation, favorite, color, cfi_range, created, alteration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      annotation.fkBook,
      annotation.page ?? 0,
      annotation.pages ?? 0,
      annotation.fontSize ?? 0,
      markType,
      annotation.chapterNumber ?? 0,
      annotation.chapter || '',
      annotation.text || '',
      range,
      annotation.note || '',
      annotation.favorite ? 1 : 0,
      color,
      annotation.cfiRange || '',
      created,
      alteration
    );
    return Number(info.lastInsertRowid);
  }

  delete(id: number): boolean {
    const stmt = this.db.prepare(`DELETE FROM BookAnnotation WHERE id = ?`);
    const info = stmt.run(id);
    return info.changes > 0;
  }
}
