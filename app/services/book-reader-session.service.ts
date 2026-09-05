import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';
import { EBookConverterService } from './ebook-converter.service';
import { BookConfiguration } from '../../src/app/core/models/entities/book.model';

export interface OpenBookReaderResult {
  sessionId: string;
  bookId: number;
  title: string;
  author: string;
  epubUrl: string;
  epubPath: string;
  bookMark: number;
  bookMarkCfi: string;
  favorite: boolean;
  configuration: BookConfiguration | null;
}

interface ActiveSession {
  sessionId: string;
  bookId: number;
  epubPath: string;
  sourcePath: string;
}

export class BookReaderSessionService {
  private active = new Map<string, ActiveSession>();
  private allowedPaths = new Set<string>();

  getConvertedCacheRoot(): string {
    return path.join(app.getPath('userData'), 'cache', 'converted');
  }

  isPathAllowed(filePath: string): boolean {
    let candidate = filePath;
    if (/^\/[A-Za-z]:\//.test(candidate)) {
      candidate = candidate.slice(1);
    }
    const resolved = path.resolve(candidate);
    if (this.allowedPaths.has(resolved)) {
      return true;
    }
    const convertRoot = path.resolve(this.getConvertedCacheRoot());
    return resolved === convertRoot || resolved.startsWith(convertRoot + path.sep);
  }

  toLocalBookUrl(filePath: string): string {
    const normalized = path.resolve(filePath).replace(/\\/g, '/');
    return `local-book://book/?p=${encodeURIComponent(normalized)}`;
  }

  async open(
    bookId: number,
    bookPath: string,
    title: string,
    author: string,
    bookMark: number,
    bookMarkCfi: string,
    favorite: boolean,
    configuration: BookConfiguration | null
  ): Promise<OpenBookReaderResult> {
    if (!fs.existsSync(bookPath)) {
      throw new Error(`Arquivo não encontrado: ${bookPath}`);
    }

    let epubPath: string;
    try {
      epubPath = await EBookConverterService.instance.convertToEpub(bookPath);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (/Failed to convert/i.test(msg)) {
        throw new Error(
          'Não foi possível converter o arquivo para EPUB. Instale Pandoc ou Calibre (ebook-convert) e tente novamente.'
        );
      }
      throw err;
    }

    if (!fs.existsSync(epubPath)) {
      throw new Error('Arquivo EPUB convertido não encontrado');
    }

    const resolvedEpub = path.resolve(epubPath);
    const resolvedSource = path.resolve(bookPath);
    this.allowedPaths.add(resolvedEpub);
    this.allowedPaths.add(resolvedSource);

    const sessionId = crypto.randomBytes(8).toString('hex');
    this.active.set(sessionId, {
      sessionId,
      bookId,
      epubPath: resolvedEpub,
      sourcePath: resolvedSource
    });

    return {
      sessionId,
      bookId,
      title,
      author,
      epubUrl: this.toLocalBookUrl(resolvedEpub),
      epubPath: resolvedEpub,
      bookMark: Math.max(0, bookMark || 0),
      bookMarkCfi: bookMarkCfi || '',
      favorite: !!favorite,
      configuration
    };
  }

  close(sessionId: string): boolean {
    const session = this.active.get(sessionId);
    if (!session) return false;
    this.active.delete(sessionId);
    return true;
  }
}
