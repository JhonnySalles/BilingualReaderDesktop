"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookRepository = void 0;
const path = __importStar(require("path"));
const base_repository_1 = require("./base.repository");
class BookRepository extends base_repository_1.BaseRepository {
    constructor(db) {
        super(db, 'Book', 'id');
    }
    mapRowToBook(row) {
        return {
            id: row.id,
            title: row.title,
            path: row.path,
            folder: row.folder,
            name: row.name,
            fileSize: row.size ?? 0,
            fileType: row.type,
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
    getBookCount(libraryId) {
        if (libraryId !== undefined && libraryId !== null) {
            const stmt = this.db.prepare(`SELECT count(*) as count FROM Book WHERE id_library = ? AND excluded = 0`);
            const row = stmt.get(libraryId);
            return row ? row.count : 0;
        }
        const stmt = this.db.prepare(`SELECT count(*) as count FROM Book WHERE excluded = 0`);
        const row = stmt.get();
        return row ? row.count : 0;
    }
    list(libraryId) {
        if (libraryId !== undefined && libraryId !== null) {
            const stmt = this.db.prepare(`SELECT * FROM Book WHERE id_library = ? AND excluded = 0 ORDER BY title ASC`);
            return stmt.all(libraryId).map(row => this.mapRowToBook(row));
        }
        const stmt = this.db.prepare(`SELECT * FROM Book WHERE excluded = 0 ORDER BY title ASC`);
        return stmt.all().map(row => this.mapRowToBook(row));
    }
    listRecentChange(libraryId) {
        if (libraryId !== undefined && libraryId !== null) {
            const stmt = this.db.prepare(`SELECT * FROM Book WHERE id_library = ? AND excluded = 0 AND last_alteration >= datetime('now','-5 hour')`);
            return stmt.all(libraryId).map(row => this.mapRowToBook(row));
        }
        const stmt = this.db.prepare(`SELECT * FROM Book WHERE excluded = 0 AND last_alteration >= datetime('now','-5 hour')`);
        return stmt.all().map(row => this.mapRowToBook(row));
    }
    listHistory() {
        const stmt = this.db.prepare(`SELECT * FROM Book WHERE last_access IS NOT NULL ORDER BY last_access DESC`);
        return stmt.all().map(row => this.mapRowToBook(row));
    }
    getByFileName(name) {
        const stmt = this.db.prepare(`SELECT * FROM Book WHERE excluded = 0 AND UPPER(name) = UPPER(?)`);
        const row = stmt.get(name);
        return row ? this.mapRowToBook(row) : undefined;
    }
    getByPath(filePath) {
        if (!filePath)
            return undefined;
        const normalized = path.normalize(filePath);
        const forwardSlash = normalized.replace(/\\/g, '/');
        const backSlash = normalized.replace(/\//g, '\\');
        const stmt = this.db.prepare(`SELECT * FROM Book WHERE path = ? OR path = ? OR path = ? OR LOWER(path) = LOWER(?)`);
        const row = stmt.get(filePath, forwardSlash, backSlash, normalized);
        return row ? this.mapRowToBook(row) : undefined;
    }
    listByFolder(folder) {
        const stmt = this.db.prepare(`SELECT * FROM Book WHERE excluded = 0 AND folder = ? ORDER BY title`);
        return stmt.all(folder).map(row => this.mapRowToBook(row));
    }
    listOrderByTitle(libraryId) {
        if (libraryId !== undefined && libraryId !== null) {
            const stmt = this.db.prepare(`SELECT * FROM Book WHERE id_library = ? AND excluded = 0 ORDER BY title`);
            return stmt.all(libraryId).map(row => this.mapRowToBook(row));
        }
        const stmt = this.db.prepare(`SELECT * FROM Book WHERE excluded = 0 ORDER BY title`);
        return stmt.all().map(row => this.mapRowToBook(row));
    }
    updateBookMark(id, marker) {
        const stmt = this.db.prepare(`UPDATE Book SET book_mark = ? WHERE id = ?`);
        stmt.run(marker, id);
    }
    softDelete(id) {
        const stmt = this.db.prepare(`UPDATE Book SET excluded = 1 WHERE id = ?`);
        stmt.run(id);
    }
    listDeleted(libraryId) {
        if (libraryId !== undefined && libraryId !== null) {
            const stmt = this.db.prepare(`SELECT * FROM Book WHERE id_library = ? AND excluded = 1`);
            return stmt.all(libraryId).map(row => this.mapRowToBook(row));
        }
        const stmt = this.db.prepare(`SELECT * FROM Book WHERE excluded = 1`);
        return stmt.all().map(row => this.mapRowToBook(row));
    }
    save(book) {
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
          id_library = ?, excluded = ?, last_access = ?, last_alteration = ?,
          file_alteration = ?, last_vocabulary_import = ?, last_verify = ?, cover_path = ?
        WHERE id = ?
      `);
            stmt.run(book.title, book.path, book.folder, book.name, book.fileSize ?? 0, book.fileType, book.pages ?? 1, book.bookMark ?? 0, book.completed ? 1 : 0, book.favorite ? 1 : 0, book.author ?? '', book.series ?? '', book.genre ?? '', book.publisher ?? '', book.volume ?? '', book.release ?? null, book.fkLibrary ?? null, book.excluded ? 1 : 0, book.lastAccess ?? null, book.lastAlteration ?? new Date().toISOString(), book.fileAlteration ?? new Date().toISOString(), book.lastVocabImport ?? null, book.lastVerify ?? null, book.coverPath ?? null, book.id);
            return book.id;
        }
        else {
            const stmt = this.db.prepare(`
        INSERT INTO Book (
          title, path, folder, name, size, type, pages,
          book_mark, completed, favorite, author, series, genre,
          publisher, volume, release, id_library, excluded, date_create, last_access,
          last_alteration, file_alteration, last_vocabulary_import, last_verify, cover_path
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);
            const info = stmt.run(book.title, book.path, book.folder, book.name, book.fileSize ?? 0, book.fileType, book.pages ?? 1, book.bookMark ?? 0, book.completed ? 1 : 0, book.favorite ? 1 : 0, book.author ?? '', book.series ?? '', book.genre ?? '', book.publisher ?? '', book.volume ?? '', book.release ?? null, book.fkLibrary ?? null, book.excluded ? 1 : 0, new Date().toISOString(), book.lastAccess ?? null, book.lastAlteration ?? new Date().toISOString(), book.fileAlteration ?? new Date().toISOString(), book.lastVocabImport ?? null, book.lastVerify ?? null, book.coverPath ?? null);
            return Number(info.lastInsertRowid);
        }
    }
}
exports.BookRepository = BookRepository;
