import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';
import { BookExtractorFactory } from '../parser/book/book-extractor.factory';
import { Book } from '../../src/app/core/models/entities/book.model';

export class BookImageCoverController {
  private static _instance: BookImageCoverController;

  public static get instance(): BookImageCoverController {
    if (!this._instance) {
      this._instance = new BookImageCoverController();
    }
    return this._instance;
  }

  private getCacheDir(): string {
    const userData = app ? app.getPath('userData') : process.cwd();
    const cacheDir = path.join(userData, 'cache', 'covers', 'book');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    return cacheDir;
  }

  public generateHash(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex');
  }

  public getBookCoverFile(book: Book): string | null {
    if (!book.path || !fs.existsSync(book.path)) {
      return null;
    }

    const hash = this.generateHash(book.path);
    const cacheDir = this.getCacheDir();
    const coverPath = path.join(cacheDir, `${hash}.png`);

    if (fs.existsSync(coverPath)) {
      return coverPath;
    }

    const meta = BookExtractorFactory.getMetadata(book.path);
    if (meta.coverImage) {
      try {
        fs.writeFileSync(coverPath, meta.coverImage);
        return coverPath;
      } catch (e) {
        console.error('Error saving book cover:', book.name, e);
      }
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
