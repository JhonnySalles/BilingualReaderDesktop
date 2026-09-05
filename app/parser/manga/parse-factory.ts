import * as fs from 'fs';
import * as path from 'path';
import { Parse } from './parse.interface';
import { DirectoryParse } from './directory-parse';
import { ZipParse } from './zip-parse';
import { RarParse } from './rar-parse';

export class ParseFactory {
  public static create(filePath: string): Parse | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      const parser = new DirectoryParse();
      try {
        parser.parse(filePath);
        if (parser.numPages() < 4) {
          parser.destroy();
          return null;
        }
        return parser;
      } catch {
        parser.destroy();
        return null;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    let parser: Parse | null = null;

    if (ext === '.cbz' || ext === '.zip') {
      parser = new ZipParse();
    } else if (ext === '.cbr' || ext === '.rar') {
      parser = new RarParse();
    }

    if (parser) {
      const result = this.tryParseInternal(parser, filePath);
      if (result) return result;
    }

    // Fallback: try ZipParse then RarParse
    const zipFallback = new ZipParse();
    const fallbackResult = this.tryParseInternal(zipFallback, filePath);
    if (fallbackResult) return fallbackResult;

    const rarFallback = new RarParse();
    const rarFallbackResult = this.tryParseInternal(rarFallback, filePath);
    if (rarFallbackResult) return rarFallbackResult;

    return null;
  }

  private static tryParseInternal(parser: Parse, filePath: string): Parse | null {
    try {
      parser.parse(filePath);
      return parser;
    } catch {
      try {
        parser.destroy();
      } catch {}
      return null;
    }
  }
}
