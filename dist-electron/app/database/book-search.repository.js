"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookSearchRepository = void 0;
class BookSearchRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    mapRow(row) {
        return {
            id: row.id,
            fkBook: row.id_book,
            search: row.search || '',
            date: row.date || ''
        };
    }
    listHistory(bookId) {
        const stmt = this.db.prepare(`SELECT * FROM BookSearchHistory WHERE id_book = ? ORDER BY date DESC, id DESC`);
        return stmt.all(bookId).map(row => this.mapRow(row));
    }
    saveHistory(bookId, search) {
        const term = (search || '').trim();
        if (!term || !bookId) {
            throw new Error('Invalid search history');
        }
        const now = new Date().toISOString();
        const existing = this.db
            .prepare(`SELECT * FROM BookSearchHistory
         WHERE id_book = ? AND LOWER(search) = LOWER(?)
         ORDER BY date DESC, id DESC
         LIMIT 1`)
            .get(bookId, term);
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
    deleteHistory(id) {
        if (!id)
            return false;
        const result = this.db.prepare(`DELETE FROM BookSearchHistory WHERE id = ?`).run(id);
        return result.changes > 0;
    }
    deleteAllHistory(bookId) {
        if (!bookId)
            return false;
        const result = this.db.prepare(`DELETE FROM BookSearchHistory WHERE id_book = ?`).run(bookId);
        return result.changes >= 0;
    }
}
exports.BookSearchRepository = BookSearchRepository;
