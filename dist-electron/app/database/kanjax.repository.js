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
        return {
            ...row,
            keywordsPt: row.keywords_pt,
            meaningPt: row.meaning_pt
        };
    }
    list() {
        const stmt = this.db.prepare(`SELECT * FROM Kanjax`);
        const rows = stmt.all();
        return rows.map(row => ({
            ...row,
            keywordsPt: row.keywords_pt,
            meaningPt: row.meaning_pt
        }));
    }
}
exports.KanjaxRepository = KanjaxRepository;
