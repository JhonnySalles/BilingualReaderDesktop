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
exports.MangaRepository = void 0;
const path = __importStar(require("path"));
const base_repository_1 = require("./base.repository");
class MangaRepository extends base_repository_1.BaseRepository {
    constructor(db) {
        super(db, 'Manga', 'id');
    }
    mapRowToManga(row) {
        return {
            id: row.id,
            title: row.title,
            path: row.path,
            folder: row.folder,
            name: row.name,
            fileSize: row.size ?? 0,
            fileType: row.type,
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
    getMangaCount(libraryId) {
        if (libraryId !== undefined && libraryId !== null) {
            const stmt = this.db.prepare(`SELECT count(*) as count FROM Manga WHERE id_library = ? AND excluded = 0`);
            const row = stmt.get(libraryId);
            return row ? row.count : 0;
        }
        const stmt = this.db.prepare(`SELECT count(*) as count FROM Manga WHERE excluded = 0`);
        const row = stmt.get();
        return row ? row.count : 0;
    }
    list(libraryId) {
        if (libraryId !== undefined && libraryId !== null) {
            const stmt = this.db.prepare(`SELECT * FROM Manga WHERE id_library = ? AND excluded = 0 ORDER BY title ASC`);
            return stmt.all(libraryId).map(row => this.mapRowToManga(row));
        }
        const stmt = this.db.prepare(`SELECT * FROM Manga WHERE excluded = 0 ORDER BY title ASC`);
        return stmt.all().map(row => this.mapRowToManga(row));
    }
    listRecentChange(libraryId) {
        if (libraryId !== undefined && libraryId !== null) {
            const stmt = this.db.prepare(`SELECT * FROM Manga WHERE id_library = ? AND excluded = 0 AND last_alteration >= datetime('now','-5 hour')`);
            return stmt.all(libraryId).map(row => this.mapRowToManga(row));
        }
        const stmt = this.db.prepare(`SELECT * FROM Manga WHERE excluded = 0 AND last_alteration >= datetime('now','-5 hour')`);
        return stmt.all().map(row => this.mapRowToManga(row));
    }
    listHistory() {
        const stmt = this.db.prepare(`SELECT * FROM Manga WHERE last_access IS NOT NULL ORDER BY last_access DESC`);
        return stmt.all().map(row => this.mapRowToManga(row));
    }
    getById(id) {
        const stmt = this.db.prepare(`SELECT * FROM Manga WHERE id = ?`);
        const row = stmt.get(id);
        return row ? this.mapRowToManga(row) : undefined;
    }
    getByFileName(name) {
        const stmt = this.db.prepare(`SELECT * FROM Manga WHERE excluded = 0 AND UPPER(name) = UPPER(?)`);
        const row = stmt.get(name);
        return row ? this.mapRowToManga(row) : undefined;
    }
    getByPath(filePath) {
        if (!filePath)
            return undefined;
        const normalized = path.normalize(filePath);
        const forwardSlash = normalized.replace(/\\/g, '/');
        const backSlash = normalized.replace(/\//g, '\\');
        const stmt = this.db.prepare(`SELECT * FROM Manga WHERE path = ? OR path = ? OR path = ? OR LOWER(path) = LOWER(?)`);
        const row = stmt.get(filePath, forwardSlash, backSlash, normalized);
        return row ? this.mapRowToManga(row) : undefined;
    }
    listByFolder(folder) {
        const stmt = this.db.prepare(`SELECT * FROM Manga WHERE excluded = 0 AND folder = ? ORDER BY title`);
        return stmt.all(folder).map(row => this.mapRowToManga(row));
    }
    listOrderByTitle(libraryId) {
        if (libraryId !== undefined && libraryId !== null) {
            const stmt = this.db.prepare(`SELECT * FROM Manga WHERE id_library = ? AND excluded = 0 ORDER BY title`);
            return stmt.all(libraryId).map(row => this.mapRowToManga(row));
        }
        const stmt = this.db.prepare(`SELECT * FROM Manga WHERE excluded = 0 ORDER BY title`);
        return stmt.all().map(row => this.mapRowToManga(row));
    }
    updateBookMark(id, marker) {
        const stmt = this.db.prepare(`UPDATE Manga SET book_mark = ? WHERE id = ?`);
        stmt.run(marker, id);
    }
    softDelete(id) {
        const stmt = this.db.prepare(`UPDATE Manga SET excluded = 1 WHERE id = ?`);
        stmt.run(id);
    }
    clearProgress(id) {
        const stmt = this.db.prepare(`UPDATE Manga SET book_mark = 0, completed = 0, last_alteration = ? WHERE id = ?`);
        stmt.run(new Date().toISOString(), id);
        return this.getById(id);
    }
    markRead(id) {
        const manga = this.getById(id);
        if (!manga)
            return undefined;
        const pages = Math.max(1, manga.pages || 1);
        const stmt = this.db.prepare(`UPDATE Manga SET book_mark = ?, completed = 1, last_alteration = ? WHERE id = ?`);
        stmt.run(pages, new Date().toISOString(), id);
        return this.getById(id);
    }
    listDeleted(libraryId) {
        if (libraryId !== undefined && libraryId !== null) {
            const stmt = this.db.prepare(`SELECT * FROM Manga WHERE id_library = ? AND excluded = 1`);
            return stmt.all(libraryId).map(row => this.mapRowToManga(row));
        }
        const stmt = this.db.prepare(`SELECT * FROM Manga WHERE excluded = 1`);
        return stmt.all().map(row => this.mapRowToManga(row));
    }
    save(manga) {
        if (!manga.id && manga.path) {
            const existing = this.getByPath(manga.path);
            if (existing) {
                manga.id = existing.id;
            }
        }
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
          last_vocabulary_import = ?, last_verify = ?, cover_path = ?
        WHERE id = ?
      `);
            stmt.run(manga.title, manga.path, manga.folder, manga.name, manga.fileSize ?? 0, manga.fileType, manga.pages ?? 1, chaptersJson, chaptersPagesJson, manga.bookMark ?? 0, manga.completed ? 1 : 0, manga.favorite ? 1 : 0, manga.hasSubtitle ? 1 : 0, manga.author ?? '', manga.series ?? '', manga.genre ?? '', manga.publisher ?? '', manga.volume ?? '', manga.release ?? null, manga.fkLibrary ?? null, manga.excluded ? 1 : 0, manga.lastAccess ?? null, manga.lastAlteration ?? new Date().toISOString(), manga.fileAlteration ?? new Date().toISOString(), manga.lastVocabImport ?? null, manga.lastVerify ?? null, manga.coverPath ?? null, manga.id);
            return manga.id;
        }
        else {
            const stmt = this.db.prepare(`
        INSERT INTO Manga (
          title, path, folder, name, size, type, pages, chapters, chapters_pages,
          book_mark, completed, favorite, has_subtitle, author, series, genre,
          publisher, volume, release, id_library, excluded, date_create, last_access,
          last_alteration, file_alteration, last_vocabulary_import, last_verify, cover_path
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);
            const info = stmt.run(manga.title, manga.path, manga.folder, manga.name, manga.fileSize ?? 0, manga.fileType, manga.pages ?? 1, chaptersJson, chaptersPagesJson, manga.bookMark ?? 0, manga.completed ? 1 : 0, manga.favorite ? 1 : 0, manga.hasSubtitle ? 1 : 0, manga.author ?? '', manga.series ?? '', manga.genre ?? '', manga.publisher ?? '', manga.volume ?? '', manga.release ?? null, manga.fkLibrary ?? null, manga.excluded ? 1 : 0, new Date().toISOString(), manga.lastAccess ?? null, manga.lastAlteration ?? new Date().toISOString(), manga.fileAlteration ?? new Date().toISOString(), manga.lastVocabImport ?? null, manga.lastVerify ?? null, manga.coverPath ?? null);
            return Number(info.lastInsertRowid);
        }
    }
}
exports.MangaRepository = MangaRepository;
