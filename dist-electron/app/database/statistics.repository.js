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
    /**
     * Daily reading activity for the last 12 months (GitHub contribution style).
     * value = seconds_read that day (min 1s per session so open sessions count);
     * pages = pages advanced.
     */
    getReadingActivityHeatmap(_weeks) {
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        // ~12 months back, then align start to Sunday so the grid is week-aligned
        const start = new Date(today);
        start.setMonth(start.getMonth() - 12);
        start.setDate(start.getDate() + 1); // inclusive window ending today
        start.setDate(start.getDate() - start.getDay()); // back to Sunday
        const startIso = this.toLocalDateKey(start);
        const endIso = this.toLocalDateKey(today);
        const rows = this.db.prepare(`
      SELECT
        SUBSTR(date_time_start, 1, 10) AS day,
        COALESCE(SUM(CASE WHEN seconds_read > 0 THEN seconds_read ELSE 1 END), 0) AS seconds,
        COALESCE(SUM(CASE WHEN page_end > page_start THEN page_end - page_start ELSE 0 END), 0) AS pages
      FROM History
      WHERE SUBSTR(date_time_start, 1, 10) >= ?
        AND SUBSTR(date_time_start, 1, 10) <= ?
      GROUP BY SUBSTR(date_time_start, 1, 10)
      ORDER BY day ASC
    `).all(startIso, endIso);
        const byDay = new Map(rows.map(r => [r.day, {
                value: Number(r.seconds) || 0,
                pages: Number(r.pages) || 0
            }]));
        const result = [];
        const cursor = new Date(start);
        while (this.toLocalDateKey(cursor) <= endIso) {
            const key = this.toLocalDateKey(cursor);
            const entry = byDay.get(key);
            result.push({
                date: key,
                value: entry?.value ?? 0,
                pages: entry?.pages ?? 0
            });
            cursor.setDate(cursor.getDate() + 1);
        }
        return result;
    }
    toLocalDateKey(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
}
exports.StatisticsRepository = StatisticsRepository;
