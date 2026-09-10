import * as fs from 'fs';
import * as path from 'path';
import { Parse } from './parse.interface';
import { DirectoryParse } from './directory-parse';
import { ZipParse } from './zip-parse';
import { RarParse } from './rar-parse';
import { SevenZParse } from './sevenz-parse';
import { TarParse } from './tar-parse';

export class ParseFactory {
  public static async create(filePath: string): Promise<Parse | null> {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      const parser = new DirectoryParse();
      try {
        await parser.parse(filePath);
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
    } else if (ext === '.cb7' || ext === '.7z') {
      parser = new SevenZParse();
    } else if (ext === '.cbt' || ext === '.tar' || ext === '.tgz' || ext === '.tar.gz') {
      parser = new TarParse();
    }

    if (parser) {
      const result = await this.tryParseInternal(parser, filePath);
      if (result) return result;
      // Do not Zip/Rar-fallback dedicated 7z/tar extensions — they are not zip/rar.
      if (ext === '.cb7' || ext === '.7z' || ext === '.cbt' || ext === '.tar' || ext === '.tgz') {
        return null;
      }
    }

    // Fallback for unknown / mislabeled: try Zip then Rar
    const zipFallback = new ZipParse();
    const fallbackResult = await this.tryParseInternal(zipFallback, filePath);
    if (fallbackResult) return fallbackResult;

    const rarFallback = new RarParse();
    return await this.tryParseInternal(rarFallback, filePath);
  }

  private static async tryParseInternal(parser: Parse, filePath: string): Promise<Parse | null> {
    try {
      await parser.parse(filePath);
      return parser;
    } catch (err) {
      console.warn(`[ParseFactory] Failed to parse ${filePath} with ${parser.constructor.name}:`, err);
      try {
        parser.destroy();
      } catch {}
      return null;
    }
  }
}
