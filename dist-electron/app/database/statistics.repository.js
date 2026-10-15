"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatisticsRepository = void 0;
const settings_service_1 = require("../services/settings.service");
function normalizePath(p) {
    return (p || '').replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
}
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
        COALESCE(SUM(CASE WHEN IFNULL(completed, 0) = 0 AND book_mark > 0 AND book_mark < pages THEN 1 ELSE 0 END), 0) AS reading,
        COALESCE(SUM(CASE WHEN book_mark <= 0 AND IFNULL(completed, 0) = 0 THEN 1 ELSE 0 END), 0) AS toRead,
        COALESCE(SUM(CASE WHEN excluded = 0 THEN 1 ELSE 0 END), 0) AS library,
        COALESCE(SUM(CASE WHEN completed = 1 OR book_mark >= pages THEN 1 ELSE 0 END), 0) AS read
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
        const currentMonthPrefix = this.toLocalDateKey(new Date()).slice(0, 7);
        const currentMonthHistory = this.db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN page_end > page_start THEN page_end - page_start ELSE 0 END), 0) AS currentMonthPages,
        COALESCE(SUM(seconds_read), 0) AS currentMonthSeconds,
        COALESCE(COUNT(DISTINCT CASE WHEN completed = 1 THEN id_reference END), 0) AS readThisMonth
      FROM History
      WHERE type = ? AND SUBSTR(date_time_start, 1, 7) = ?
    `).get(type, currentMonthPrefix);
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
            currentMonthPages: Number(currentMonthHistory?.currentMonthPages ?? 0),
            currentMonthSeconds: Number(currentMonthHistory?.currentMonthSeconds ?? 0),
            readThisMonth: Number(currentMonthHistory?.readThisMonth ?? 0),
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
            if (this.isDefaultLibraryId(libraryId, type)) {
                sql += ` AND (id_library = ? OR id_library = 0 OR id_library IS NULL)`;
            }
            else {
                sql += ` AND id_library = ?`;
            }
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
    isDefaultLibraryId(libraryId, type) {
        const stmt = this.db.prepare(`SELECT path FROM Libraries WHERE id = ? LIMIT 1`);
        const row = stmt.get(libraryId);
        if (!row)
            return false;
        const defaultKey = type === 'MANGA' ? 'mangaBasePath' : 'bookBasePath';
        const fallbackPath = type === 'MANGA'
            ? 'C:\\Users\\Jhonny\\Documents\\BilingualReader\\Mangas'
            : 'C:\\Users\\Jhonny\\Documents\\BilingualReader\\Books';
        const defaultBasePath = normalizePath(settings_service_1.SettingsService.instance?.get ? settings_service_1.SettingsService.instance.get(defaultKey, fallbackPath) : fallbackPath);
        const norm = normalizePath(row.path);
        if (norm === defaultBasePath)
            return true;
        const customLibs = (settings_service_1.SettingsService.instance?.get ? settings_service_1.SettingsService.instance.get('libraries', []) : []) || [];
        const filteredCustom = customLibs.filter(l => l.type?.toLowerCase() === (type === 'MANGA' ? 'manga' : 'book'));
        const isCustom = filteredCustom.some(c => normalizePath(c.path) === norm);
        return !isCustom;
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
        const defaultKey = type === 'MANGA' ? 'mangaBasePath' : 'bookBasePath';
        const fallbackPath = type === 'MANGA'
            ? 'C:\\Users\\Jhonny\\Documents\\BilingualReader\\Mangas'
            : 'C:\\Users\\Jhonny\\Documents\\BilingualReader\\Books';
        const defaultBasePath = normalizePath(settings_service_1.SettingsService.instance?.get ? settings_service_1.SettingsService.instance.get(defaultKey, fallbackPath) : fallbackPath);
        const customLibs = (settings_service_1.SettingsService.instance?.get ? settings_service_1.SettingsService.instance.get('libraries', []) : []) || [];
        const filteredCustom = customLibs.filter(l => l.type?.toLowerCase() === (type === 'MANGA' ? 'manga' : 'book'));
        const customByNormPath = new Map();
        for (const c of filteredCustom) {
            if (c.path && c.title) {
                customByNormPath.set(normalizePath(c.path), c.title);
            }
        }
        const stmt = this.db.prepare(`
      SELECT id, title, type, path
      FROM Libraries
      WHERE type = ? AND excluded = 0 AND enabled = 1
    `);
        const rows = stmt.all(type);
        let updateTitleStmt = null;
        try {
            updateTitleStmt = this.db.prepare(`UPDATE Libraries SET title = ? WHERE id = ?`);
        }
        catch {
            updateTitleStmt = null;
        }
        const result = [];
        let defaultLibOption = null;
        for (const row of rows) {
            const norm = normalizePath(row.path);
            const isCustom = customByNormPath.has(norm);
            let effectiveTitle;
            let isDefault = false;
            if (isCustom) {
                effectiveTitle = customByNormPath.get(norm);
            }
            else if (norm === defaultBasePath || (!isCustom && !defaultLibOption)) {
                effectiveTitle = 'Padrão';
                isDefault = true;
            }
            else {
                effectiveTitle = row.title;
            }
            if (updateTitleStmt && row.title !== effectiveTitle) {
                try {
                    updateTitleStmt.run(effectiveTitle, row.id);
                }
                catch {
                    // Ignore
                }
            }
            const opt = {
                id: row.id,
                title: effectiveTitle,
                type: row.type,
                path: row.path
            };
            if (isDefault) {
                defaultLibOption = opt;
            }
            else {
                result.push(opt);
            }
        }
        // Ordenar as bibliotecas customizadas em ordem alfabética
        result.sort((a, b) => a.title.localeCompare(b.title));
        // A biblioteca padrão vem primeiro
        if (defaultLibOption) {
            result.unshift(defaultLibOption);
        }
        return result;
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
