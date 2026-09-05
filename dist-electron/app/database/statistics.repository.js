"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatisticsRepository = void 0;
class StatisticsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    getOverview() {
        return {
            manga: this.getSectorStats('MANGA'),
            book: this.getSectorStats('BOOK')
        };
    }
    getSectorStats(type) {
        const table = type === 'MANGA' ? 'Manga' : 'Book';
        const counts = this.db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN book_mark > 0 AND book_mark < pages THEN 1 ELSE 0 END), 0) AS reading,
        COALESCE(SUM(CASE WHEN book_mark <= 0 THEN 1 ELSE 0 END), 0) AS toRead,
        COALESCE(SUM(CASE WHEN excluded = 0 THEN 1 ELSE 0 END), 0) AS library,
        COALESCE(SUM(CASE WHEN book_mark > 0 AND book_mark >= pages THEN 1 ELSE 0 END), 0) AS read
      FROM ${table}
      WHERE excluded = 0
    `).get();
        const history = this.db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN completed = 1 AND page_end > page_start THEN page_end - page_start ELSE 0 END), 0) AS completeReadingPages,
        COALESCE(SUM(CASE WHEN completed = 1 THEN seconds_read ELSE 0 END), 0) AS completeReadingSeconds,
        COALESCE(SUM(CASE WHEN completed = 0 AND page_end > page_start THEN page_end - page_start ELSE 0 END), 0) AS currentReadingPages,
        COALESCE(SUM(CASE WHEN completed = 0 THEN seconds_read ELSE 0 END), 0) AS currentReadingSeconds,
        COALESCE(SUM(CASE WHEN page_end > page_start THEN page_end - page_start ELSE 0 END), 0) AS totalReadPages,
        COALESCE(SUM(seconds_read), 0) AS totalReadSeconds
      FROM History
      WHERE type = ?
    `).get(type);
        const totalReadPages = Number(history?.totalReadPages ?? 0);
        const totalReadSeconds = Number(history?.totalReadSeconds ?? 0);
        const averageMinutesPerPage = totalReadPages > 0 ? Math.round(totalReadSeconds / totalReadPages / 60) : 0;
        return {
            type,
            reading: Number(counts?.reading ?? 0),
            toRead: Number(counts?.toRead ?? 0),
            library: Number(counts?.library ?? 0),
            read: Number(counts?.read ?? 0),
            completeReadingPages: Number(history?.completeReadingPages ?? 0),
            completeReadingSeconds: Number(history?.completeReadingSeconds ?? 0),
            currentReadingPages: Number(history?.currentReadingPages ?? 0),
            currentReadingSeconds: Number(history?.currentReadingSeconds ?? 0),
            totalReadPages,
            totalReadSeconds,
            averageMinutesPerPage
        };
    }
    getChartData(type, year, libraryId) {
        const dateStart = `${year}-01-01T00:00:00.000Z`;
        const dateEnd = `${year}-12-31T23:59:59.999Z`;
        let sql = `
      SELECT
        CAST(SUBSTR(date_time_start, 6, 2) AS INTEGER) AS month,
        COALESCE(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END), 0) AS count
      FROM History
      WHERE type = ?
        AND date_time_start >= ?
        AND date_time_start <= ?
    `;
        const params = [type, dateStart, dateEnd];
        if (libraryId != null && libraryId > 0) {
            sql += ` AND id_library = ?`;
            params.push(libraryId);
        }
        sql += ` GROUP BY SUBSTR(date_time_start, 6, 2) ORDER BY month`;
        const rows = this.db.prepare(sql).all(...params);
        const byMonth = new Map(rows.map(r => [r.month, Number(r.count)]));
        const now = new Date();
        const maxMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
        const points = [];
        for (let month = 1; month <= maxMonth; month++) {
            points.push({ month, count: byMonth.get(month) ?? 0 });
        }
        return points;
    }
    listYears(type) {
        const stmt = this.db.prepare(`
      SELECT DISTINCT CAST(SUBSTR(date_time_start, 1, 4) AS INTEGER) AS year
      FROM History
      WHERE type = ?
      ORDER BY year DESC
    `);
        const years = stmt.all(type)
            .map(r => r.year)
            .filter(y => !!y);
        const currentYear = new Date().getFullYear();
        if (!years.includes(currentYear)) {
            years.unshift(currentYear);
        }
        return years;
    }
    listLibrariesByType(type) {
        const stmt = this.db.prepare(`
      SELECT id, title, type, path
      FROM Libraries
      WHERE type = ? AND excluded = 0 AND enabled = 1
      ORDER BY title ASC
    `);
        return stmt.all(type).map(row => ({
            id: row.id,
            title: row.title,
            type: row.type,
            path: row.path
        }));
    }
}
exports.StatisticsRepository = StatisticsRepository;
