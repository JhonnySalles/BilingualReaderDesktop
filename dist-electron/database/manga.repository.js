"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MangaRepository = void 0;
const base_repository_1 = require("./base.repository");
class MangaRepository extends base_repository_1.BaseRepository {
    constructor(db) {
        super(db, 'Manga', 'id');
    }
    getMangaCount() {
        const stmt = this.db.prepare(`SELECT count(*) as count FROM Manga`);
        const row = stmt.get();
        return row ? row.count : 0;
    }
    list(libraryId) {
        if (libraryId !== undefined && libraryId !== null) {
            const stmt = this.db.prepare(`SELECT * FROM Manga WHERE id_library = ? AND excluded = 0`);
            return stmt.all(libraryId);
        }
        const stmt = this.db.prepare(`SELECT * FROM Manga WHERE excluded = 0`);
        return stmt.all();
    }
    listRecentChange(libraryId) {
        if (libraryId !== undefined && libraryId !== null) {
            const stmt = this.db.prepare(`SELECT * FROM Manga WHERE id_library = ? AND excluded = 0 AND last_alteration >= datetime('now','-5 hour')`);
            return stmt.all(libraryId);
        }
        const stmt = this.db.prepare(`SELECT * FROM Manga WHERE excluded = 0 AND last_alteration >= datetime('now','-5 hour')`);
        return stmt.all();
    }
    listHistory() {
        const stmt = this.db.prepare(`SELECT * FROM Manga WHERE last_access IS NOT NULL ORDER BY last_access DESC`);
        return stmt.all();
    }
    getByFileName(name) {
        const stmt = this.db.prepare(`SELECT * FROM Manga WHERE excluded = 0 AND UPPER(name) = UPPER(?)`);
        return stmt.get(name);
    }
    getByPath(filePath) {
        const stmt = this.db.prepare(`SELECT * FROM Manga WHERE excluded = 0 AND path = ?`);
        return stmt.get(filePath);
    }
    listByFolder(folder) {
        const stmt = this.db.prepare(`SELECT * FROM Manga WHERE excluded = 0 AND folder = ? ORDER BY title`);
        return stmt.all(folder);
    }
    listOrderByTitle(libraryId) {
        if (libraryId !== undefined && libraryId !== null) {
            const stmt = this.db.prepare(`SELECT * FROM Manga WHERE id_library = ? AND excluded = 0 ORDER BY title`);
            return stmt.all(libraryId);
        }
        const stmt = this.db.prepare(`SELECT * FROM Manga WHERE excluded = 0 ORDER BY title`);
        return stmt.all();
    }
    updateBookMark(id, marker) {
        const stmt = this.db.prepare(`UPDATE Manga SET book_mark = ? WHERE id = ?`);
        stmt.run(marker, id);
    }
    softDelete(id) {
        const stmt = this.db.prepare(`UPDATE Manga SET excluded = 1 WHERE id = ?`);
        stmt.run(id);
    }
    listDeleted(libraryId) {
        if (libraryId !== undefined && libraryId !== null) {
            const stmt = this.db.prepare(`SELECT * FROM Manga WHERE id_library = ? AND excluded = 1`);
            return stmt.all(libraryId);
        }
        const stmt = this.db.prepare(`SELECT * FROM Manga WHERE excluded = 1`);
        return stmt.all();
    }
    save(manga) {
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
            stmt.run(manga.title, manga.path, manga.folder, manga.name, manga.size ?? 0, manga.type, manga.pages ?? 1, manga.chapters ?? '[]', manga.chapters_pages ?? '{}', manga.book_mark ?? 0, manga.completed ? 1 : 0, manga.favorite ? 1 : 0, manga.has_subtitle ? 1 : 0, manga.author ?? '', manga.series ?? '', manga.genre ?? '', manga.publisher ?? '', manga.volume ?? '', manga.release ?? null, manga.id_library ?? null, manga.excluded ? 1 : 0, manga.last_access ?? null, manga.last_alteration ?? new Date().toISOString(), manga.file_alteration ?? new Date().toISOString(), manga.last_vocabulary_import ?? null, manga.last_verify ?? null, manga.id);
            return manga.id;
        }
        else {
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
            const info = stmt.run(manga.title, manga.path, manga.folder, manga.name, manga.size ?? 0, manga.type, manga.pages ?? 1, manga.chapters ?? '[]', manga.chapters_pages ?? '{}', manga.book_mark ?? 0, manga.completed ? 1 : 0, manga.favorite ? 1 : 0, manga.has_subtitle ? 1 : 0, manga.author ?? '', manga.series ?? '', manga.genre ?? '', manga.publisher ?? '', manga.volume ?? '', manga.release ?? null, manga.id_library ?? null, manga.excluded ? 1 : 0, new Date().toISOString(), manga.last_access ?? null, manga.last_alteration ?? new Date().toISOString(), manga.file_alteration ?? new Date().toISOString(), manga.last_vocabulary_import ?? null, manga.last_verify ?? null);
            return Number(info.lastInsertRowid);
        }
    }
}
exports.MangaRepository = MangaRepository;
