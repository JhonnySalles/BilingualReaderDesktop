"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KanjaxRepository = void 0;
class KanjaxRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    get(kanji) {
        const stmt = this.db.prepare(`SELECT * FROM Kanjax WHERE kanji = ?`);
        const row = stmt.get(kanji);
        if (!row)
            return undefined;
        return this.mapRow(row);
    }
    list() {
        const stmt = this.db.prepare(`SELECT * FROM Kanjax`);
        const rows = stmt.all();
        return rows.map(row => this.mapRow(row));
    }
    /** Lookup Kanjax entries for each unique kanji character in a word. */
    forWord(word) {
        if (!word)
            return [];
        const seen = new Set();
        const out = [];
        for (const ch of word) {
            if (!/[\u4e00-\u9faf\u3400-\u4dbf]/.test(ch))
                continue;
            if (seen.has(ch))
                continue;
            seen.add(ch);
            const entry = this.get(ch);
            if (entry)
                out.push(entry);
        }
        return out;
    }
    mapRow(row) {
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
exports.KanjaxRepository = KanjaxRepository;
