"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = void 0;
class BaseRepository {
    db;
    tableName;
    idColumn;
    constructor(db, tableName, idColumn = 'id') {
        this.db = db;
        this.tableName = tableName;
        this.idColumn = idColumn;
    }
    exist(id) {
        const stmt = this.db.prepare(`SELECT 1 FROM ${this.tableName} WHERE ${this.idColumn} = ? LIMIT 1`);
        return !!stmt.get(id);
    }
    find(id) {
        const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${this.idColumn} = ?`);
        return stmt.get(id);
    }
    findAll() {
        const stmt = this.db.prepare(`SELECT * FROM ${this.tableName}`);
        return stmt.all();
    }
    findAllByIds(ids) {
        if (ids.length === 0)
            return [];
        const placeholders = ids.map(() => '?').join(',');
        const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${this.idColumn} IN (${placeholders})`);
        return stmt.all(...ids);
    }
    delete(id) {
        const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE ${this.idColumn} = ?`);
        stmt.run(id);
    }
}
exports.BaseRepository = BaseRepository;
