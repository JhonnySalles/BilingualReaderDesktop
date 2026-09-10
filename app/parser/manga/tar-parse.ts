import * as fs from 'fs';
import * as zlib from 'zlib';
import * as tar from 'tar';
import { Parse, CoverStreams } from './parse.interface';
import { ParseUtil } from './parse-util';
import { ComicInfo } from '../../../src/app/core/models/entities/comic-info.model';
import {
  ArchiveFileItem,
  classifyArchiveItems,
  readArchiveItem,
  readArchiveItemText
} from './archive-item.util';

function isGzipFile(filePath: string): boolean {
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(2);
    fs.readSync(fd, header, 0, 2, 0);
    return header[0] === 0x1f && header[1] === 0x8b;
  } finally {
    fs.closeSync(fd);
  }
}

export class TarParse implements Parse {
  private imageItems: ArchiveFileItem[] = [];
  private subtitles: ArchiveFileItem[] = [];
  private comicInfoItem: ArchiveFileItem | null = null;
  private coverItems: (ArchiveFileItem | null)[] = [null, null, null];

  public async parse(filePath: string): Promise<void> {
    try {
      const gzip = isGzipFile(filePath);
      const rawItems: ArchiveFileItem[] = [];

      await new Promise<void>((resolve, reject) => {
        const input = fs.createReadStream(filePath);
        const source = gzip ? input.pipe(zlib.createGunzip()) : input;
        const parser = new tar.Parser();

        parser.on('entry', (entry: tar.ReadEntry) => {
          const name = String(entry.path || '').replace(/\\/g, '/');
          if (entry.type === 'Directory' || !name || name.endsWith('/')) {
            entry.resume();
            return;
          }
          const chunks: Buffer[] = [];
          entry.on('data', (chunk: Buffer) => chunks.push(chunk));
          entry.on('end', () => {
            rawItems.push({ name, fileData: Buffer.concat(chunks) });
          });
          entry.on('error', reject);
        });

        parser.on('end', () => resolve());
        parser.on('error', reject);
        source.on('error', reject);
        source.pipe(parser);
      });

      const classified = classifyArchiveItems(rawItems);
      this.imageItems = classified.imageItems;
      this.subtitles = classified.subtitles;
      this.comicInfoItem = classified.comicInfoItem;
      this.coverItems = classified.coverItems;

      if (this.imageItems.length === 0) {
        throw new Error('No images found or not a valid tar archive');
      }
    } catch (e) {
      this.destroy();
      throw e;
    }
  }

  public destroy(): void {
    this.imageItems = [];
    this.subtitles = [];
    this.comicInfoItem = null;
    this.coverItems = [null, null, null];
  }

  public getPage(num: number): Buffer | null {
    if (num < 0 || num >= this.imageItems.length) return null;
    return readArchiveItem(this.imageItems[num]);
  }

  public numPages(): number {
    return this.imageItems.length;
  }

  public getSubtitles(): string[] {
    return this.subtitles.map(item => readArchiveItemText(item));
  }

  public hasSubtitles(): boolean {
    return this.subtitles.length > 0;
  }

  public getSubtitlesNames(): Record<string, number> {
    const map: Record<string, number> = {};
    this.subtitles.forEach((item, index) => {
      const name = ParseUtil.getNameFromPath(item.name);
      if (name && !(name in map)) map[name] = index;
    });
    return map;
  }

  public getPagePath(num: number): string | null {
    if (num < 0 || num >= this.imageItems.length) return null;
    return this.imageItems[num].name;
  }

  public getPagePaths(): Record<string, number> {
    const map: Record<string, number> = {};
    this.imageItems.forEach((item, index) => {
      const folder = ParseUtil.getFolderFromPath(item.name);
      if (folder && !(folder in map)) map[folder] = index;
    });
    return map;
  }

  public getChapters(): number[] {
    return Object.values(this.getPagePaths()).filter(val => val !== 0);
  }

  public isComicInfo(): boolean {
    return this.comicInfoItem !== null;
  }

  public getComicInfo(): ComicInfo | null {
    if (!this.comicInfoItem) return null;
    return ParseUtil.parseComicInfoXml(readArchiveItemText(this.comicInfoItem));
  }

  public getCover(): CoverStreams {
    const frontItem = this.coverItems[0] || this.imageItems[0];
    const front = frontItem ? readArchiveItem(frontItem) : null;
    const back = this.coverItems[1] ? readArchiveItem(this.coverItems[1]) : null;
    return { front, back };
  }

  public hasFullCover(): boolean {
    return this.coverItems[2] !== null;
  }

  public getFullCover(): Buffer | null {
    if (!this.coverItems[2]) return null;
    return readArchiveItem(this.coverItems[2]);
  }
}
