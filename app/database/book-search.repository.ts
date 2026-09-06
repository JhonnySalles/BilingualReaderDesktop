import Database from 'better-sqlite3';
import { BookSearchHistory } from '../../src/app/core/models/entities/book.model';

export class BookSearchRepository {
  constructor(private db: Database.Database) {}

  private mapRow(row: any): BookSearchHistory {
    return {
      id: row.id,
      fkBook: row.id_book,
      search: row.search || '',
      date: row.date || ''
    };
  }

  listHistory(bookId: number): BookSearchHistory[] {
    const stmt = this.db.prepare(
      `SELECT * FROM BookSearchHistory WHERE id_book = ? ORDER BY date DESC, id DESC`
    );
    return (stmt.all(bookId) as any[]).map(row => this.mapRow(row));
  }

  saveHistory(bookId: number, search: string): BookSearchHistory {
    const term = (search || '').trim();
    if (!term || !bookId) {
      throw new Error('Invalid search history');
    }

    const now = new Date().toISOString();
    const existing = this.db
      .prepare(
        `SELECT * FROM BookSearchHistory
         WHERE id_book = ? AND LOWER(search) = LOWER(?)
         ORDER BY date DESC, id DESC
         LIMIT 1`
      )
      .get(bookId, term) as any | undefined;

    if (existing?.id) {
      this.db
        .prepare(`UPDATE BookSearchHistory SET search = ?, date = ? WHERE id = ?`)
        .run(term, now, existing.id);
      return this.mapRow({ ...existing, search: term, date: now });
    }

    const result = this.db
      .prepare(`INSERT INTO BookSearchHistory (id_book, search, date) VALUES (?, ?, ?)`)
      .run(bookId, term, now);

    return {
      id: Number(result.lastInsertRowid),
      fkBook: bookId,
      search: term,
      date: now
    };
  }

  deleteHistory(id: number): boolean {
    if (!id) return false;
    const result = this.db.prepare(`DELETE FROM BookSearchHistory WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  deleteAllHistory(bookId: number): boolean {
    if (!bookId) return false;
    const result = this.db.prepare(`DELETE FROM BookSearchHistory WHERE id_book = ?`).run(bookId);
    return result.changes >= 0;
  }
}
