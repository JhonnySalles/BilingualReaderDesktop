"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VocabularyRepository = void 0;
class VocabularyRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    get(id) {
        const stmt = this.db.prepare(`SELECT * FROM Vocabulary WHERE id = ?`);
        const row = stmt.get(id);
        if (!row)
            return undefined;
        return this.mapRow(row);
    }
    findByWord(word) {
        const stmt = this.db.prepare(`SELECT * FROM Vocabulary WHERE word = ? OR basic_form = ?`);
        const row = stmt.get(word, word);
        if (!row)
            return undefined;
        return this.mapRow(row);
    }
    list() {
        const stmt = this.db.prepare(`SELECT * FROM Vocabulary`);
        const rows = stmt.all();
        return rows.map(r => this.mapRow(r));
    }
    mapRow(row) {
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
exports.VocabularyRepository = VocabularyRepository;
