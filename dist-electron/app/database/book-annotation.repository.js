"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookAnnotationRepository = void 0;
const book_model_1 = require("../../src/app/core/models/entities/book.model");
class BookAnnotationRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    mapRow(row) {
        const rangeStr = typeof row.range === 'string' ? row.range : '';
        const rangeParts = rangeStr
            .split(',')
            .map((p) => Number(p.trim()))
            .filter((n) => !Number.isNaN(n));
        return {
            id: row.id,
            fkBook: row.id_book,
            page: row.page ?? 0,
            pages: row.pages ?? 0,
            text: row.text || '',
            note: row.annotation || '',
            color: row.color || book_model_1.BookAnnotationColor.Yellow,
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
    serializeRange(range) {
        if (!range || range.length < 2)
            return '';
        return `${range[0]},${range[1]}`;
    }
    listByBook(bookId) {
        const stmt = this.db.prepare(`SELECT * FROM BookAnnotation WHERE id_book = ? ORDER BY alteration DESC, id DESC`);
        return stmt.all(bookId).map(row => this.mapRow(row));
    }
    getById(id) {
        const stmt = this.db.prepare(`SELECT * FROM BookAnnotation WHERE id = ?`);
        const row = stmt.get(id);
        return row ? this.mapRow(row) : undefined;
    }
    save(annotation) {
        const now = new Date().toISOString();
        const alteration = now;
        const created = annotation.dateCreate || now;
        const markType = annotation.markType || 'Annotation';
        const color = annotation.color || book_model_1.BookAnnotationColor.Yellow;
        const range = this.serializeRange(annotation.range);
        if (annotation.id) {
            const stmt = this.db.prepare(`
        UPDATE BookAnnotation SET
          id_book = ?, page = ?, pages = ?, font_size = ?, type = ?,
          chapter_number = ?, chapter = ?, text = ?, range = ?, annotation = ?,
          favorite = ?, color = ?, cfi_range = ?, alteration = ?
        WHERE id = ?
      `);
            stmt.run(annotation.fkBook, annotation.page ?? 0, annotation.pages ?? 0, annotation.fontSize ?? 0, markType, annotation.chapterNumber ?? 0, annotation.chapter || '', annotation.text || '', range, annotation.note || '', annotation.favorite ? 1 : 0, color, annotation.cfiRange || '', alteration, annotation.id);
            return annotation.id;
        }
        const stmt = this.db.prepare(`
      INSERT INTO BookAnnotation (
        id_book, page, pages, font_size, type, chapter_number, chapter,
        text, range, annotation, favorite, color, cfi_range, created, alteration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const info = stmt.run(annotation.fkBook, annotation.page ?? 0, annotation.pages ?? 0, annotation.fontSize ?? 0, markType, annotation.chapterNumber ?? 0, annotation.chapter || '', annotation.text || '', range, annotation.note || '', annotation.favorite ? 1 : 0, color, annotation.cfiRange || '', created, alteration);
        return Number(info.lastInsertRowid);
    }
    delete(id) {
        const stmt = this.db.prepare(`DELETE FROM BookAnnotation WHERE id = ?`);
        const info = stmt.run(id);
        return info.changes > 0;
    }
}
exports.BookAnnotationRepository = BookAnnotationRepository;
