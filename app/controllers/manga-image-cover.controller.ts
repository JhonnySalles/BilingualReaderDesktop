import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getAppCoversDir } from '../utils/app-paths';
import { ParseFactory } from '../parser/manga/parse-factory';
import { Manga } from '../../src/app/core/models/entities/manga.model';

export class MangaImageCoverController {
  private static _instance: MangaImageCoverController;

  public static get instance(): MangaImageCoverController {
    if (!this._instance) {
      this._instance = new MangaImageCoverController();
    }
    return this._instance;
  }

  private getCacheDir(): string {
    const cacheDir = path.join(getAppCoversDir(), 'manga');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    return cacheDir;
  }

  public generateHash(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex');
  }

  public async getMangaCoverFile(manga: Manga): Promise<string | null> {
    const filePath = manga.path || (manga as any).file;
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }

    const hash = this.generateHash(filePath);
    const cacheDir = this.getCacheDir();
    const coverPath = path.join(cacheDir, `${hash}.png`);

    if (fs.existsSync(coverPath)) {
      return coverPath;
    }

    const parser = await ParseFactory.create(filePath);
    if (!parser) {
      return null;
    }

    try {
      const cover = parser.getCover();
      const coverBuffer = cover.front;
      if (coverBuffer) {
        fs.writeFileSync(coverPath, coverBuffer);
        return coverPath;
      }
    } catch (e) {
      console.error('Error extracting cover for manga:', manga.name, e);
    } finally {
      parser.destroy();
    }

    return null;
  }

  /** Return existing coverPath if present on disk; otherwise re-extract from source. */
  public async ensureCover(manga: Manga): Promise<string | null> {
    if (manga.coverPath && fs.existsSync(manga.coverPath)) {
      return manga.coverPath;
    }
    try {
      return await this.getMangaCoverFile(manga);
    } catch (e) {
      console.warn('[MangaImageCover] ensureCover failed', manga.name, e);
      return null;
    }
  }

  public saveCoverToCache(filePath: string, buffer: Buffer): string {
    const hash = this.generateHash(filePath);
    const cacheDir = this.getCacheDir();
    const coverPath = path.join(cacheDir, `${hash}.png`);
    fs.writeFileSync(coverPath, buffer);
    return coverPath;
  }

  /** Remove all cached cover files. Returns count of entries removed. */
  public clearCache(): number {
    const cacheDir = this.getCacheDir();
    if (!fs.existsSync(cacheDir)) return 0;
    let removed = 0;
    for (const name of fs.readdirSync(cacheDir)) {
      const full = path.join(cacheDir, name);
      try {
        const st = fs.statSync(full);
        if (st.isDirectory()) {
          fs.rmSync(full, { recursive: true, force: true });
        } else {
          fs.unlinkSync(full);
        }
        removed += 1;
      } catch (e) {
        console.warn('[MangaImageCover] clearCache failed', full, e);
      }
    }
    return removed;
  }
}
