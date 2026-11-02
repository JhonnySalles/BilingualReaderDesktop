import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getAppCoversDir } from '../utils/app-paths';
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
    const cacheDir = path.join(getAppCoversDir(), 'book');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    return cacheDir;
  }

  public generateHash(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex');
  }

  public getBookCover3D(book: Book): {
    fullCoverPath: string | null;
    frontCoverPath: string | null;
    backCoverPath: string | null;
    isFullCover: boolean;
  } {
    const coverPath = this.ensureCover(book);
    return {
      fullCoverPath: null,
      frontCoverPath: coverPath,
      backCoverPath: null,
      isFullCover: false
    };
  }

  public getBookCoverFile(book: Book, signal?: AbortSignal): string | null {
    if (signal?.aborted) return null;
    if (!book.path || !fs.existsSync(book.path)) {
      return null;
    }

    const hash = this.generateHash(book.path);
    const cacheDir = this.getCacheDir();

    // Verifica se já existe capa em cache com alguma extensão suportada
    const existing = ['.png', '.jpg', '.jpeg', '.webp', '.svg']
      .map(ext => path.join(cacheDir, `${hash}${ext}`))
      .find(p => fs.existsSync(p));

    if (existing) {
      return existing;
    }
    if (signal?.aborted) return null;

    const meta = BookExtractorFactory.getMetadata(book.path);
    if (signal?.aborted) return null;
    if (meta.coverImage) {
      try {
        let ext = '.png';
        const strStart = meta.coverImage.slice(0, 50).toString('utf-8');
        if (strStart.includes('<svg') || strStart.includes('<?xml')) {
          ext = '.svg';
        } else if (meta.coverImage[0] === 0xff && meta.coverImage[1] === 0xd8) {
          ext = '.jpg';
        } else if (meta.coverImage.slice(0, 4).toString('hex') === '89504e47') {
          ext = '.png';
        }

        const coverPath = path.join(cacheDir, `${hash}${ext}`);
        fs.writeFileSync(coverPath, meta.coverImage);
        return coverPath;
      } catch (e) {
        console.error('Error saving book cover:', book.name, e);
      }
    }

    return null;
  }

  /** Return existing coverPath if present on disk; otherwise re-extract from source. */
  public ensureCover(book: Book): string | null {
    if (book.coverPath && fs.existsSync(book.coverPath)) {
      return book.coverPath;
    }
    try {
      return this.getBookCoverFile(book);
    } catch (e) {
      console.warn('[BookImageCover] ensureCover failed', book.name, e);
      return null;
    }
  }

  public saveCoverToCache(filePath: string, buffer: Buffer): string {
    const hash = this.generateHash(filePath);
    const cacheDir = this.getCacheDir();
    let ext = '.png';
    const strStart = buffer.slice(0, 50).toString('utf-8');
    if (strStart.includes('<svg') || strStart.includes('<?xml')) {
      ext = '.svg';
    } else if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      ext = '.jpg';
    }
    const coverPath = path.join(cacheDir, `${hash}${ext}`);
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
        console.warn('[BookImageCover] clearCache failed', full, e);
      }
    }
    return removed;
  }
}
