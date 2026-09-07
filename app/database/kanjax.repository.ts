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
    return this.mapRow(row);
  }

  public list(): Kanjax[] {
    const stmt = this.db.prepare(`SELECT * FROM Kanjax`);
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapRow(row));
  }

  /** Lookup Kanjax entries for each unique kanji character in a word. */
  public forWord(word: string): Kanjax[] {
    if (!word) return [];
    const seen = new Set<string>();
    const out: Kanjax[] = [];
    for (const ch of word) {
      if (!/[\u4e00-\u9faf\u3400-\u4dbf]/.test(ch)) continue;
      if (seen.has(ch)) continue;
      seen.add(ch);
      const entry = this.get(ch);
      if (entry) out.push(entry);
    }
    return out;
  }

  private mapRow(row: any): Kanjax {
    return {
      id: row.id,
      kanji: row.kanji,
      keyword: row.keyword || '',
      meaning: row.meaning || '',
      koohii: row.koohii || '',
      kohii2: row.kohii2 || '',
      onyomi: row.onyomi || '',
      kunyomi: row.kunyomi || '',
      onwords: row.onwords || '',
      kunwords: row.kunwords || '',
      jlpt: row.jlpt ?? 0,
      grade: row.grade ?? 0,
      frequence: row.frequence ?? 0,
      strokes: row.strokes ?? 0,
      variants: row.variants || '',
      radical: row.radical || '',
      parts: row.parts || '',
      utf8: row.utf8 || '',
      sjis: row.sjis || '',
      keywordsPt: row.keywords_pt || '',
      meaningPt: row.meaning_pt || ''
    };
  }
}
