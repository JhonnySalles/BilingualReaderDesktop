import Database from 'better-sqlite3';
import { BaseRepository } from './base.repository';
import { Track } from '../../src/app/core/models/entities/track.model';

export class TrackRepository extends BaseRepository<Track, number> {
  constructor(db: Database.Database) {
    super(db, 'Track', 'id');
  }

  private mapRowToTrack(row: any): Track {
    return {
      id: row.id,
      malId: row.malId ?? null,
      aniId: row.aniId ?? null,
      fkLibrary: row.id_library,
      titleRegex: row.titleRegex || '',
      title: row.title || null,
      totalVolumes: row.totalVolumes ?? null,
      totalChapters: row.totalChapters ?? null,
      status: row.status || null,
      score: row.score ?? null,
      scoreDate: row.scoreDate || null,
      chaptersRead: row.chaptersRead ?? 0,
      volumesRead: row.volumesRead ?? 0,
      lastSyncDate: row.lastSyncDate || null
    };
  }

  public override find(id: number): Track | undefined {
    const stmt = this.db.prepare(`SELECT * FROM Track WHERE id = ?`);
    const row = stmt.get(id);
    return row ? this.mapRowToTrack(row) : undefined;
  }

  public override findAll(): Track[] {
    const stmt = this.db.prepare(`SELECT * FROM Track ORDER BY id DESC`);
    const rows = stmt.all();
    return rows.map((r: any) => this.mapRowToTrack(r));
  }

  public findByLibrary(libraryId: number): Track[] {
    const stmt = this.db.prepare(`SELECT * FROM Track WHERE id_library = ? ORDER BY id DESC`);
    const rows = stmt.all(libraryId);
    return rows.map((r: any) => this.mapRowToTrack(r));
  }

  public findByMalId(malId: number): Track | undefined {
    const stmt = this.db.prepare(`SELECT * FROM Track WHERE malId = ? LIMIT 1`);
    const row = stmt.get(malId);
    return row ? this.mapRowToTrack(row) : undefined;
  }

  public findByAniId(aniId: number): Track | undefined {
    const stmt = this.db.prepare(`SELECT * FROM Track WHERE aniId = ? LIMIT 1`);
    const row = stmt.get(aniId);
    return row ? this.mapRowToTrack(row) : undefined;
  }

  public save(track: Partial<Track>): number {
    if (track.id && this.exist(track.id)) {
      const stmt = this.db.prepare(`
        UPDATE Track SET
          malId = ?,
          aniId = ?,
          id_library = ?,
          titleRegex = ?,
          title = ?,
          totalVolumes = ?,
          totalChapters = ?,
          status = ?,
          score = ?,
          scoreDate = ?,
          chaptersRead = ?,
          volumesRead = ?,
          lastSyncDate = ?
        WHERE id = ?
      `);

      stmt.run(
        track.malId ?? null,
        track.aniId ?? null,
        track.fkLibrary,
        track.titleRegex || '',
        track.title ?? null,
        track.totalVolumes ?? null,
        track.totalChapters ?? null,
        track.status ?? null,
        track.score ?? null,
        track.scoreDate ?? null,
        track.chaptersRead ?? 0,
        track.volumesRead ?? 0,
        track.lastSyncDate ?? null,
        track.id
      );
      return track.id;
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO Track (
          malId,
          aniId,
          id_library,
          titleRegex,
          title,
          totalVolumes,
          totalChapters,
          status,
          score,
          scoreDate,
          chaptersRead,
          volumesRead,
          lastSyncDate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const info = stmt.run(
        track.malId ?? null,
        track.aniId ?? null,
        track.fkLibrary,
        track.titleRegex || '',
        track.title ?? null,
        track.totalVolumes ?? null,
        track.totalChapters ?? null,
        track.status ?? null,
        track.score ?? null,
        track.scoreDate ?? null,
        track.chaptersRead ?? 0,
        track.volumesRead ?? 0,
        track.lastSyncDate ?? null
      );
      return info.lastInsertRowid as number;
    }
  }

  public updateProgress(id: number, chaptersRead: number, volumesRead: number, status?: string): void {
    const stmt = this.db.prepare(`
      UPDATE Track SET
        chaptersRead = ?,
        volumesRead = ?,
        status = COALESCE(?, status),
        lastSyncDate = datetime('now', 'localtime')
      WHERE id = ?
    `);
    stmt.run(chaptersRead, volumesRead, status ?? null, id);
  }
}
