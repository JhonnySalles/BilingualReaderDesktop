"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryRepository = void 0;
const base_repository_1 = require("./base.repository");
class HistoryRepository extends base_repository_1.BaseRepository {
    constructor(db) {
        super(db, 'History');
    }
    mapRow(row) {
        return {
            id: row.id,
            id_library: row.id_library ?? 0,
            id_reference: row.id_reference,
            type: row.type,
            page_start: row.page_start ?? 0,
            page_end: row.page_end ?? 0,
            pages: row.pages ?? 1,
            completed: row.completed ?? 0,
            volume: row.volume ?? '',
            chapters_read: row.chapters_read ?? 0,
            date_time_start: row.date_time_start,
            date_time_end: row.date_time_end,
            seconds_read: row.seconds_read ?? 0,
            average_time_page: row.average_time_page ?? 0,
            use_tts: row.use_tts ?? 0,
            notified: row.notified ?? 0
        };
    }
    find(id) {
        const stmt = this.db.prepare(`SELECT * FROM History WHERE id = ?`);
        const row = stmt.get(id);
        return row ? this.mapRow(row) : undefined;
    }
    startSession(input) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO History (
        id_library, id_reference, type, page_start, page_end, pages, completed,
        volume, chapters_read, date_time_start, date_time_end, seconds_read,
        average_time_page, use_tts, notified
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, 0, 0, 0, 0)
    `);
        const result = stmt.run(input.fkLibrary ?? 0, input.fkReference, input.type, input.pageStart ?? 0, input.pageStart ?? 0, input.pages ?? 1, input.volume ?? '', now, now);
        return Number(result.lastInsertRowid);
    }
    /** Manual bookmark edit from library/detail popup (Android PopupBookMark parity). */
    saveBookmarkEdit(input) {
        const when = input.dateTime || new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO History (
        id_library, id_reference, type, page_start, page_end, pages, completed,
        volume, chapters_read, date_time_start, date_time_end, seconds_read,
        average_time_page, use_tts, notified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 0, 0, 0)
    `);
        const result = stmt.run(input.fkLibrary ?? 0, input.fkReference, input.type, input.pageStart ?? 0, input.pageEnd ?? 0, input.pages ?? 1, input.completed ? 1 : 0, input.volume ?? '', when, when);
        return Number(result.lastInsertRowid);
    }
    updateSession(update) {
        const existing = this.find(update.id);
        if (!existing)
            return;
        const pages = update.pages ?? existing.pages;
        const pageEnd = Math.max(0, update.pageEnd);
        const completed = pageEnd >= pages ? 1 : 0;
        const now = new Date().toISOString();
        const startMs = new Date(existing.date_time_start).getTime();
        const endMs = update.endSession ? Date.now() : new Date(existing.date_time_end).getTime();
        const secondsRead = Math.max(0, Math.floor((endMs - startMs) / 1000));
        const pagesDelta = Math.max(1, pageEnd - existing.page_start);
        const averageTimePage = Math.floor(secondsRead / pagesDelta);
        const stmt = this.db.prepare(`
      UPDATE History SET
        page_end = ?, pages = ?, completed = ?,
        date_time_end = ?, seconds_read = ?, average_time_page = ?,
        use_tts = CASE WHEN ? = 1 THEN 1 ELSE use_tts END
      WHERE id = ?
    `);
        stmt.run(pageEnd, pages, completed, now, secondsRead, averageTimePage, update.useTTS ? 1 : 0, update.id);
    }
    findOpenSession(type, fkReference) {
        const stmt = this.db.prepare(`
      SELECT * FROM History
      WHERE type = ? AND id_reference = ? AND seconds_read = 0
      ORDER BY date_time_start DESC
      LIMIT 1
    `);
        const row = stmt.get(type, fkReference);
        return row ? this.mapRow(row) : undefined;
    }
    listByReference(type, fkReference) {
        const stmt = this.db.prepare(`
      SELECT * FROM History
      WHERE type = ? AND id_reference = ?
      ORDER BY date_time_start ASC
    `);
        return stmt.all(type, fkReference).map((row) => this.mapRow(row));
    }
    /** Insert a completed session received from cloud sync (notified = 0). */
    insertSharedSession(input) {
        const stmt = this.db.prepare(`
      INSERT INTO History (
        id_library, id_reference, type, page_start, page_end, pages, completed,
        volume, chapters_read, date_time_start, date_time_end, seconds_read,
        average_time_page, use_tts, notified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);
        const result = stmt.run(input.fkLibrary ?? 0, input.fkReference, input.type, input.pageStart ?? 0, input.pageEnd ?? 0, input.pages ?? 1, input.completed ? 1 : 0, input.volume ?? '', input.chaptersRead ?? 0, input.dateTimeStart, input.dateTimeEnd, input.secondsRead ?? 0, input.averageTimeByPage ?? 0, input.useTTS ? 1 : 0);
        return Number(result.lastInsertRowid);
    }
    listYears(type) {
        const stmt = this.db.prepare(`
      SELECT DISTINCT CAST(SUBSTR(date_time_start, 1, 4) AS INTEGER) AS year
      FROM History
      WHERE type = ?
      ORDER BY year DESC
    `);
        return stmt.all(type)
            .map(r => r.year)
            .filter(y => !!y);
    }
    listAggregated(options) {
        const { type, year, libraryId, search, filters } = options;
        const table = type === 'MANGA' ? 'Manga' : 'Book';
        const hasSubtitleSelect = type === 'MANGA' ? 'COALESCE(I.has_subtitle, 0)' : '0';
        const tagsSelect = type === 'BOOK' ? `COALESCE(I.tags, '')` : `''`;
        const volumeSelect = `COALESCE(I.volume, '')`;
        const typeSelect = `COALESCE(I.type, '')`;
        const nameSelect = `COALESCE(I.name, '')`;
        let sql = `
      SELECT
        MIN(H.id) AS id,
        H.type AS type,
        H.id_reference AS fkReference,
        H.id_library AS fkLibrary,
        I.title AS title,
        ${nameSelect} AS name,
        COALESCE(I.author, '') AS author,
        COALESCE(I.series, '') AS series,
        COALESCE(I.publisher, '') AS publisher,
        ${volumeSelect} AS volume,
        ${typeSelect} AS fileType,
        ${tagsSelect} AS tags,
        I.cover_path AS coverPath,
        COALESCE(I.favorite, 0) AS favorite,
        ${hasSubtitleSelect} AS hasSubtitle,
        COALESCE(I.book_mark, 0) AS bookMark,
        COALESCE(I.pages, 1) AS pages,
        COALESCE(I.completed, 0) AS completed,
        COALESCE(L.title, '') AS libraryName,
        SUM(CASE WHEN H.page_end > H.page_start THEN H.page_end - H.page_start ELSE 0 END) AS pagesRead,
        SUM(COALESCE(H.seconds_read, 0)) AS timeRead,
        SUBSTR(H.date_time_start, 1, 10) AS sessionDate,
        MAX(H.date_time_start) AS lastAccess
      FROM History H
      INNER JOIN ${table} I ON I.id = H.id_reference AND I.excluded = 0
      LEFT JOIN Libraries L ON L.id = H.id_library
      WHERE H.type = ?
    `;
        const params = [type];
        if (year != null && year > 0) {
            sql += ` AND SUBSTR(H.date_time_start, 1, 4) = ?`;
            params.push(String(year));
        }
        if (libraryId != null && libraryId > 0) {
            sql += ` AND H.id_library = ?`;
            params.push(libraryId);
        }
        if (search && search.trim()) {
            sql += ` AND (
        I.title LIKE ? OR
        COALESCE(I.name, '') LIKE ? OR
        COALESCE(I.type, '') LIKE ?
      )`;
            const like = `%${search.trim()}%`;
            params.push(like, like, like);
        }
        if (filters && filters.length > 0) {
            for (const f of filters) {
                const value = (f.value || '').trim();
                if (!value)
                    continue;
                const like = `%${value}%`;
                switch (f.kind) {
                    case 'Author':
                        sql += ` AND COALESCE(I.author, '') LIKE ?`;
                        params.push(like);
                        break;
                    case 'Publisher':
                        sql += ` AND COALESCE(I.publisher, '') LIKE ?`;
                        params.push(like);
                        break;
                    case 'Series':
                        sql += ` AND COALESCE(I.series, '') LIKE ?`;
                        params.push(like);
                        break;
                    case 'Volume':
                        sql += ` AND COALESCE(I.volume, '') LIKE ?`;
                        params.push(like);
                        break;
                    case 'Type':
                        sql += ` AND COALESCE(I.type, '') LIKE ?`;
                        params.push(like);
                        break;
                    case 'Tag':
                        if (type === 'BOOK') {
                            sql += ` AND COALESCE(I.tags, '') LIKE ?`;
                            params.push(like);
                        }
                        else {
                            // Manga has no tags — never match Tag filters
                            sql += ` AND 0`;
                        }
                        break;
                }
            }
        }
        sql += `
      GROUP BY SUBSTR(H.date_time_start, 1, 10), H.id_reference
      ORDER BY MAX(H.date_time_start) DESC
    `;
        const rows = this.db.prepare(sql).all(...params);
        return rows.map(row => ({
            id: row.id,
            type: row.type,
            fkReference: row.fkReference,
            fkLibrary: row.fkLibrary,
            title: row.title,
            name: row.name ?? '',
            author: row.author,
            series: row.series,
            publisher: row.publisher,
            volume: row.volume ?? '',
            fileType: row.fileType ?? '',
            tags: row.tags ?? '',
            coverPath: row.coverPath,
            favorite: Boolean(row.favorite),
            hasSubtitle: Boolean(row.hasSubtitle),
            bookMark: row.bookMark ?? 0,
            pages: row.pages ?? 1,
            completed: Boolean(row.completed),
            libraryName: row.libraryName ?? '',
            pagesRead: row.pagesRead ?? 0,
            timeRead: row.timeRead ?? 0,
            sessionDate: row.sessionDate,
            lastAccess: row.lastAccess
        }));
    }
    /**
     * Last N unique titles opened (manga + book).
     * Prefers entity last_access (bookmark / open) and merges History sessions.
     */
    listRecent(limit = 3) {
        const safeLimit = Math.max(1, Math.min(20, Math.floor(limit) || 3));
        const sql = `
      SELECT
        type, fkReference, fkLibrary, title, coverPath, bookMark, pages, completed, fileType,
        MAX(lastAccess) AS lastAccess
      FROM (
        SELECT
          'MANGA' AS type,
          M.id AS fkReference,
          COALESCE(M.id_library, 0) AS fkLibrary,
          M.title AS title,
          M.cover_path AS coverPath,
          COALESCE(M.book_mark, 0) AS bookMark,
          COALESCE(M.pages, 1) AS pages,
          COALESCE(M.completed, 0) AS completed,
          COALESCE(M.type, '') AS fileType,
          M.last_access AS lastAccess
        FROM Manga M
        WHERE M.excluded = 0 AND M.last_access IS NOT NULL AND TRIM(M.last_access) != ''

        UNION ALL

        SELECT
          'BOOK' AS type,
          B.id AS fkReference,
          COALESCE(B.id_library, 0) AS fkLibrary,
          B.title AS title,
          B.cover_path AS coverPath,
          COALESCE(B.book_mark, 0) AS bookMark,
          COALESCE(B.pages, 1) AS pages,
          COALESCE(B.completed, 0) AS completed,
          COALESCE(B.type, '') AS fileType,
          B.last_access AS lastAccess
        FROM Book B
        WHERE B.excluded = 0 AND B.last_access IS NOT NULL AND TRIM(B.last_access) != ''

        UNION ALL

        SELECT
          H.type AS type,
          H.id_reference AS fkReference,
          H.id_library AS fkLibrary,
          I.title AS title,
          I.cover_path AS coverPath,
          COALESCE(I.book_mark, 0) AS bookMark,
          COALESCE(I.pages, 1) AS pages,
          COALESCE(I.completed, 0) AS completed,
          COALESCE(I.type, '') AS fileType,
          MAX(H.date_time_start) AS lastAccess
        FROM History H
        INNER JOIN Manga I ON I.id = H.id_reference AND I.excluded = 0
        WHERE H.type = 'MANGA'
        GROUP BY H.id_reference

        UNION ALL

        SELECT
          H.type AS type,
          H.id_reference AS fkReference,
          H.id_library AS fkLibrary,
          I.title AS title,
          I.cover_path AS coverPath,
          COALESCE(I.book_mark, 0) AS bookMark,
          COALESCE(I.pages, 1) AS pages,
          COALESCE(I.completed, 0) AS completed,
          COALESCE(I.type, '') AS fileType,
          MAX(H.date_time_start) AS lastAccess
        FROM History H
        INNER JOIN Book I ON I.id = H.id_reference AND I.excluded = 0
        WHERE H.type = 'BOOK'
        GROUP BY H.id_reference
      )
      GROUP BY type, fkReference
      ORDER BY lastAccess DESC
      LIMIT ?
    `;
        const rows = this.db.prepare(sql).all(safeLimit);
        return rows.map(row => ({
            type: row.type,
            fkReference: row.fkReference,
            fkLibrary: row.fkLibrary ?? 0,
            title: row.title ?? '',
            coverPath: row.coverPath ?? null,
            bookMark: row.bookMark ?? 0,
            pages: row.pages ?? 1,
            completed: Boolean(row.completed),
            fileType: String(row.fileType || '').toUpperCase() || 'UNKNOWN',
            lastAccess: row.lastAccess
        }));
    }
    clearAll() {
        const result = this.db.prepare('DELETE FROM History').run();
        return Number(result.changes || 0);
    }
}
exports.HistoryRepository = HistoryRepository;
