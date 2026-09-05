import Database from 'better-sqlite3';
import { BaseRepository } from './base.repository';

export type HistoryContentType = 'MANGA' | 'BOOK';

export interface HistoryRow {
  id: number;
  id_library: number;
  id_reference: number;
  type: HistoryContentType;
  page_start: number;
  page_end: number;
  pages: number;
  completed: number;
  volume: string;
  chapters_read: number;
  date_time_start: string;
  date_time_end: string;
  seconds_read: number;
  average_time_page: number;
  use_tts: number;
  notified: number;
}

export interface HistorySessionInput {
  fkLibrary: number;
  fkReference: number;
  type: HistoryContentType;
  pageStart: number;
  pages: number;
  volume?: string;
}

export interface HistorySessionUpdate {
  id: number;
  pageEnd: number;
  pages?: number;
  endSession?: boolean;
}

export interface HistoryStatisticsItem {
  id: number;
  type: HistoryContentType;
  fkReference: number;
  fkLibrary: number;
  title: string;
  author: string;
  series: string;
  publisher: string;
  coverPath: string | null;
  favorite: boolean;
  hasSubtitle: boolean;
  bookMark: number;
  pages: number;
  completed: boolean;
  libraryName: string;
  pagesRead: number;
  timeRead: number;
  sessionDate: string;
  lastAccess: string;
}

export class HistoryRepository extends BaseRepository<HistoryRow, number> {
  constructor(db: Database.Database) {
    super(db, 'History');
  }

  private mapRow(row: any): HistoryRow {
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

  public override find(id: number): HistoryRow | undefined {
    const stmt = this.db.prepare(`SELECT * FROM History WHERE id = ?`);
    const row = stmt.get(id);
    return row ? this.mapRow(row) : undefined;
  }

  public startSession(input: HistorySessionInput): number {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO History (
        id_library, id_reference, type, page_start, page_end, pages, completed,
        volume, chapters_read, date_time_start, date_time_end, seconds_read,
        average_time_page, use_tts, notified
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, 0, 0, 0, 0)
    `);
    const result = stmt.run(
      input.fkLibrary ?? 0,
      input.fkReference,
      input.type,
      input.pageStart ?? 0,
      input.pageStart ?? 0,
      input.pages ?? 1,
      input.volume ?? '',
      now,
      now
    );
    return Number(result.lastInsertRowid);
  }

  public updateSession(update: HistorySessionUpdate): void {
    const existing = this.find(update.id);
    if (!existing) return;

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
        date_time_end = ?, seconds_read = ?, average_time_page = ?
      WHERE id = ?
    `);
    stmt.run(pageEnd, pages, completed, now, secondsRead, averageTimePage, update.id);
  }

  public findOpenSession(type: HistoryContentType, fkReference: number): HistoryRow | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM History
      WHERE type = ? AND id_reference = ? AND seconds_read = 0
      ORDER BY date_time_start DESC
      LIMIT 1
    `);
    const row = stmt.get(type, fkReference);
    return row ? this.mapRow(row) : undefined;
  }

  public listYears(type: HistoryContentType): number[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT CAST(SUBSTR(date_time_start, 1, 4) AS INTEGER) AS year
      FROM History
      WHERE type = ?
      ORDER BY year DESC
    `);
    return (stmt.all(type) as { year: number }[])
      .map(r => r.year)
      .filter(y => !!y);
  }

  public listAggregated(options: {
    type: HistoryContentType;
    year?: number | null;
    libraryId?: number | null;
    search?: string | null;
  }): HistoryStatisticsItem[] {
    const { type, year, libraryId, search } = options;
    const table = type === 'MANGA' ? 'Manga' : 'Book';
    const hasSubtitleSelect = type === 'MANGA' ? 'COALESCE(I.has_subtitle, 0)' : '0';

    let sql = `
      SELECT
        MIN(H.id) AS id,
        H.type AS type,
        H.id_reference AS fkReference,
        H.id_library AS fkLibrary,
        I.title AS title,
        COALESCE(I.author, '') AS author,
        COALESCE(I.series, '') AS series,
        COALESCE(I.publisher, '') AS publisher,
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

    const params: any[] = [type];

    if (year != null && year > 0) {
      sql += ` AND SUBSTR(H.date_time_start, 1, 4) = ?`;
      params.push(String(year));
    }

    if (libraryId != null && libraryId > 0) {
      sql += ` AND H.id_library = ?`;
      params.push(libraryId);
    }

    if (search && search.trim()) {
      sql += ` AND (I.title LIKE ? OR COALESCE(I.author, '') LIKE ? OR COALESCE(I.series, '') LIKE ?)`;
      const like = `%${search.trim()}%`;
      params.push(like, like, like);
    }

    sql += `
      GROUP BY SUBSTR(H.date_time_start, 1, 10), H.id_reference
      ORDER BY MAX(H.date_time_start) DESC
    `;

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(row => ({
      id: row.id,
      type: row.type,
      fkReference: row.fkReference,
      fkLibrary: row.fkLibrary,
      title: row.title,
      author: row.author,
      series: row.series,
      publisher: row.publisher,
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
}
