import Database from 'better-sqlite3';

export interface KanjiJLPT {
  id?: number;
  kanji: string;
  level: number;
}

export class KanjiRepository {
  constructor(private db: Database.Database) {}

  public get(id: number): KanjiJLPT | undefined {
    const stmt = this.db.prepare(`SELECT * FROM Jlpt WHERE id = ?`);
    return stmt.get(id) as KanjiJLPT | undefined;
  }

  public list(): KanjiJLPT[] {
    const stmt = this.db.prepare(`SELECT * FROM Jlpt`);
    return stmt.all() as KanjiJLPT[];
  }

  public getHashMap(): Record<string, number> {
    const rows = this.list();
    const map: Record<string, number> = {};
    for (const item of rows) {
      map[item.kanji] = item.level;
    }
    return map;
  }
}
