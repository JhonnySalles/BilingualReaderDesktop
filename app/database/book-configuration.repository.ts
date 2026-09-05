import Database from 'better-sqlite3';
import { BookConfiguration } from '../../src/app/core/models/entities/book.model';
import { BookScrollingMode } from '../../src/app/core/models/enums/reader-enums';

export class BookConfigurationRepository {
  constructor(private db: Database.Database) {}

  private mapRow(row: any): BookConfiguration {
    return {
      id: row.id,
      fkBook: row.id_book,
      alignment: row.alignment || 'justify',
      margin: row.margin || 'medium',
      spacing: row.spacing || 'medium',
      scrolling: row.scrolling || BookScrollingMode.Pagination,
      pagination: row.pagination || 'Default',
      fontType: row.font_type || 'Georgia, serif',
      fontSize: typeof row.font_size === 'number' ? row.font_size : 18
    };
  }

  getByBook(bookId: number): BookConfiguration | undefined {
    const stmt = this.db.prepare(`SELECT * FROM BookConfiguration WHERE id_book = ?`);
    const row = stmt.get(bookId);
    return row ? this.mapRow(row) : undefined;
  }

  upsert(config: BookConfiguration): number {
    const existing = this.getByBook(config.fkBook);
    if (existing?.id) {
      const stmt = this.db.prepare(`
        UPDATE BookConfiguration SET
          alignment = ?, margin = ?, spacing = ?, scrolling = ?,
          pagination = ?, font_type = ?, font_size = ?
        WHERE id = ?
      `);
      stmt.run(
        config.alignment,
        config.margin,
        config.spacing,
        config.scrolling,
        config.pagination || 'Default',
        config.fontType,
        config.fontSize,
        existing.id
      );
      return existing.id;
    }

    const stmt = this.db.prepare(`
      INSERT INTO BookConfiguration (
        id_book, alignment, margin, spacing, scrolling, pagination, font_type, font_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      config.fkBook,
      config.alignment,
      config.margin,
      config.spacing,
      config.scrolling,
      config.pagination || 'Default',
      config.fontType,
      config.fontSize
    );
    return Number(info.lastInsertRowid);
  }
}
