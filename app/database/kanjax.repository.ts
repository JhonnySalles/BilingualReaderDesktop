import Database from 'better-sqlite3';

export interface Kanjax {
  id: number;
  kanji: string;
  keyword: string;
  meaning: string;
  koohii: string;
  kohii2: string;
  onyomi: string;
  kunyomi: string;
  onwords: string;
  kunwords: string;
  jlpt: number;
  grade: number;
  frequence: number;
  strokes: number;
  variants: string;
  radical: string;
  parts: string;
  utf8: string;
  sjis: string;
  keywordsPt: string;
  meaningPt: string;
}

export class KanjaxRepository {
  constructor(private db: Database.Database) {}

  public get(kanji: string): Kanjax | undefined {
    const stmt = this.db.prepare(`SELECT * FROM Kanjax WHERE kanji = ?`);
    const row = stmt.get(kanji) as any;
    if (!row) return undefined;
    return {
      ...row,
      keywordsPt: row.keywords_pt,
      meaningPt: row.meaning_pt
    };
  }

  public list(): Kanjax[] {
    const stmt = this.db.prepare(`SELECT * FROM Kanjax`);
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      ...row,
      keywordsPt: row.keywords_pt,
      meaningPt: row.meaning_pt
    }));
  }
}
