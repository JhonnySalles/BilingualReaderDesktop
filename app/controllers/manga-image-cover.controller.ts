import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';
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
    const userData = app ? app.getPath('userData') : process.cwd();
    const cacheDir = path.join(userData, 'cache', 'covers', 'manga');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    return cacheDir;
  }

  public generateHash(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex');
  }

  public getMangaCoverFile(manga: Manga): string | null {
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

    const parser = ParseFactory.create(filePath);
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

  public saveCoverToCache(filePath: string, buffer: Buffer): string {
    const hash = this.generateHash(filePath);
    const cacheDir = this.getCacheDir();
    const coverPath = path.join(cacheDir, `${hash}.png`);
    fs.writeFileSync(coverPath, buffer);
    return coverPath;
  }
}
