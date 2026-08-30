import Database from 'better-sqlite3';

export interface Vocabulary {
  id?: number;
  word: string;
  basicForm: string;
  reading: string;
  english: string;
  portuguese: string;
  jlpt: string;
  revised: boolean;
  favorite: boolean;
  appears: number;
}

export class VocabularyRepository {
  constructor(private db: Database.Database) {}

  public get(id: number): Vocabulary | undefined {
    const stmt = this.db.prepare(`SELECT * FROM Vocabulary WHERE id = ?`);
    const row = stmt.get(id) as any;
    if (!row) return undefined;
    return this.mapRow(row);
  }

  public findByWord(word: string): Vocabulary | undefined {
    const stmt = this.db.prepare(`SELECT * FROM Vocabulary WHERE word = ? OR basic_form = ?`);
    const row = stmt.get(word, word) as any;
    if (!row) return undefined;
    return this.mapRow(row);
  }

  public list(): Vocabulary[] {
    const stmt = this.db.prepare(`SELECT * FROM Vocabulary`);
    const rows = stmt.all() as any[];
    return rows.map(r => this.mapRow(r));
  }

  private mapRow(row: any): Vocabulary {
    return {
      id: row.id,
      word: row.word,
      basicForm: row.basic_form,
      reading: row.reading,
      english: row.english,
      portuguese: row.portuguese,
      jlpt: row.jlpt,
      revised: Boolean(row.revised),
      favorite: Boolean(row.favorite),
      appears: row.appears ?? 0
    };
  }
}
