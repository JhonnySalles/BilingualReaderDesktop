import Database from 'better-sqlite3';
import { AssistantMessage } from '../../src/app/core/models/enums/ai-enums';

export type AssistantContentType = 'BOOK' | 'MANGA';

export interface AssistantHistoryRow {
  id?: number;
  idReference: number;
  type: AssistantContentType;
  role: AssistantMessage;
  message: string;
  date: string;
}

export class AssistantHistoryRepository {
  constructor(private db: Database.Database) {}

  list(idReference: number, type: AssistantContentType): AssistantHistoryRow[] {
    const stmt = this.db.prepare(
      `SELECT id, id_reference, type, role, message, date
       FROM AssistantHistory
       WHERE id_reference = ? AND type = ?
       ORDER BY date ASC, id ASC`
    );
    const rows = stmt.all(idReference, type) as any[];
    return rows.map(r => this.mapRow(r));
  }

  append(row: Omit<AssistantHistoryRow, 'id'>): AssistantHistoryRow {
    const date = row.date || new Date().toISOString();
    const info = this.db
      .prepare(
        `INSERT INTO AssistantHistory (id_reference, type, role, message, date)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(row.idReference, row.type, row.role, row.message, date);
    return {
      id: Number(info.lastInsertRowid),
      idReference: row.idReference,
      type: row.type,
      role: row.role,
      message: row.message,
      date
    };
  }

  clear(idReference: number, type: AssistantContentType): number {
    const info = this.db
      .prepare(`DELETE FROM AssistantHistory WHERE id_reference = ? AND type = ?`)
      .run(idReference, type);
    return info.changes;
  }

  private mapRow(row: any): AssistantHistoryRow {
    return {
      id: row.id,
      idReference: row.id_reference,
      type: row.type as AssistantContentType,
      role: row.role as AssistantMessage,
      message: String(row.message || ''),
      date: String(row.date || '')
    };
  }
}
