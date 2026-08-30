import Database from 'better-sqlite3';

export abstract class BaseRepository<T, ID extends number | string> {
  constructor(
    protected db: Database.Database,
    protected tableName: string,
    protected idColumn: string = 'id'
  ) {}

  public exist(id: ID): boolean {
    const stmt = this.db.prepare(`SELECT 1 FROM ${this.tableName} WHERE ${this.idColumn} = ? LIMIT 1`);
    return !!stmt.get(id);
  }

  public find(id: ID): T | undefined {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${this.idColumn} = ?`);
    return stmt.get(id) as T | undefined;
  }

  public findAll(): T[] {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName}`);
    return stmt.all() as T[];
  }

  public findAllByIds(ids: ID[]): T[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${this.idColumn} IN (${placeholders})`);
    return stmt.all(...ids) as T[];
  }

  public delete(id: ID): void {
    const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE ${this.idColumn} = ?`);
    stmt.run(id);
  }
}
