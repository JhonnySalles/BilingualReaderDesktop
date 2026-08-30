"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KanjiRepository = void 0;
class KanjiRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    get(id) {
        const stmt = this.db.prepare(`SELECT * FROM Jlpt WHERE id = ?`);
        return stmt.get(id);
    }
    list() {
        const stmt = this.db.prepare(`SELECT * FROM Jlpt`);
        return stmt.all();
    }
    getHashMap() {
        const rows = this.list();
        const map = {};
        for (const item of rows) {
            map[item.kanji] = item.level;
        }
        return map;
    }
}
exports.KanjiRepository = KanjiRepository;
