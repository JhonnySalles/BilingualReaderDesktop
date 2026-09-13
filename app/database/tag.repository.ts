import Database from 'better-sqlite3';
import { BaseRepository } from './base.repository';
import { Tag } from '../../src/app/core/models/entities/tag.model';

export class TagRepository extends BaseRepository<Tag, number> {
  constructor(db: Database.Database) {
    super(db, 'Tags', 'id');
  }

  public override findAll(): Tag[] {
    const stmt = this.db.prepare(`SELECT * FROM Tags ORDER BY name COLLATE NOCASE ASC`);
    return stmt.all() as Tag[];
  }

  public findByName(name: string): Tag | undefined {
    const stmt = this.db.prepare(`SELECT * FROM Tags WHERE name = ? COLLATE NOCASE LIMIT 1`);
    return stmt.get(name.trim()) as Tag | undefined;
  }

  public save(tag: Partial<Tag>): Tag {
    const cleanName = (tag.name || '').trim();
    if (!cleanName) {
      throw new Error('Nome da tag não pode ser vazio');
    }

    if (tag.id && this.exist(tag.id)) {
      const stmt = this.db.prepare(`UPDATE Tags SET name = ? WHERE id = ?`);
      stmt.run(cleanName, tag.id);
      return { id: tag.id, name: cleanName };
    } else {
      const existing = this.findByName(cleanName);
      if (existing) {
        return existing;
      }
      const stmt = this.db.prepare(`INSERT INTO Tags (name) VALUES (?)`);
      const info = stmt.run(cleanName);
      return { id: info.lastInsertRowid as number, name: cleanName };
    }
  }

  public override delete(id: number): void {
    const stmt = this.db.prepare(`DELETE FROM Tags WHERE id = ?`);
    stmt.run(id);
  }
}
