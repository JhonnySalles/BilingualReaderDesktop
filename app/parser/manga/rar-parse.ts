import * as fs from 'fs';
import { createExtractorFromData, ArcFile } from 'node-unrar-js';
import { Parse, CoverStreams } from './parse.interface';
import { ParseUtil } from './parse-util';
import { ComicInfo } from '../../../src/app/core/models/entities/comic-info.model';

interface RarFileItem {
  name: string;
  fileData: Uint8Array;
}

export class RarParse implements Parse {
  private items: RarFileItem[] = [];
  private imageItems: RarFileItem[] = [];
  private subtitles: RarFileItem[] = [];
  private comicInfoItem: RarFileItem | null = null;
  private coverItems: (RarFileItem | null)[] = [null, null, null];

  public async parse(filePath: string): Promise<void> {
    try {
      const buf = fs.readFileSync(filePath);
      const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      const extractor = await createExtractorFromData({ data: arrayBuffer });
      const extracted = extractor.extract({});
      const fileGen = extracted.files;

      if (!fileGen) return;

      while (true) {
        let nextItem;
        try {
          nextItem = fileGen.next();
        } catch {
          break;
        }
        if (!nextItem || nextItem.done) break;

        const file = nextItem.value as ArcFile<Uint8Array>;
        if (!file || !file.fileHeader || file.fileHeader.flags?.directory) continue;
        const name = file.fileHeader.name;
        const fileData = file.extraction;
        if (!fileData) continue;

        const item: RarFileItem = { name, fileData };
        this.items.push(item);

        if (ParseUtil.isImage(name)) {
          this.imageItems.push(item);
          const fileName = ParseUtil.getNameFromPath(name);
          if (fileName.toLowerCase().includes('volume')) {
            const coverPart = fileName.toLowerCase().substring(fileName.toLowerCase().lastIndexOf('volume'));
            if (coverPart.includes('frente') || coverPart.includes('cover') || coverPart.includes('front')) {
              this.coverItems[0] = item;
            } else if (coverPart.includes('tras') || coverPart.includes('back')) {
              this.coverItems[1] = item;
            } else if (coverPart.includes('tudo') || coverPart.includes('all') || coverPart.includes('everything')) {
              this.coverItems[2] = item;
            }
          }
        } else if (ParseUtil.isJson(name)) {
          this.subtitles.push(item);
        } else if (ParseUtil.isXml(name) && name.toLowerCase().includes('comicinfo')) {
          this.comicInfoItem = item;
        }
      }

      this.imageItems.sort((a, b) => {
        const folderA = ParseUtil.getFolderFromPath(a.name);
        const folderB = ParseUtil.getFolderFromPath(b.name);
        if (folderA !== folderB) {
          return folderA.localeCompare(folderB);
        }
        return ParseUtil.naturalSort(a.name, b.name);
      });

      if (!this.coverItems[0] && this.imageItems.length > 0) {
        this.coverItems[0] = this.imageItems[0];
      }

      if (this.imageItems.length === 0) {
        throw new Error('No images found or not a valid RAR archive');
      }
    } catch (e) {
      this.destroy();
      throw e;
    }
  }

  public destroy(): void {
    this.items = [];
    this.imageItems = [];
    this.subtitles = [];
    this.comicInfoItem = null;
    this.coverItems = [null, null, null];
  }

  public getPage(num: number): Buffer | null {
    if (num < 0 || num >= this.imageItems.length) return null;
    return Buffer.from(this.imageItems[num].fileData);
  }

  public numPages(): number {
    return this.imageItems.length;
  }

  public getSubtitles(): string[] {
    return this.subtitles.map(item => Buffer.from(item.fileData).toString('utf-8'));
  }

  public hasSubtitles(): boolean {
    return this.subtitles.length > 0;
  }

  public getSubtitlesNames(): Record<string, number> {
    const map: Record<string, number> = {};
    this.subtitles.forEach((item, index) => {
      const name = ParseUtil.getNameFromPath(item.name);
      if (name && !(name in map)) {
        map[name] = index;
      }
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
      if (folder && !(folder in map)) {
        map[folder] = index;
      }
    });
    return map;
  }

  public getChapters(): number[] {
    const paths = this.getPagePaths();
    return Object.values(paths).filter(val => val !== 0);
  }

  public isComicInfo(): boolean {
    return this.comicInfoItem !== null;
  }

  public getComicInfo(): ComicInfo | null {
    if (!this.comicInfoItem) return null;
    const content = Buffer.from(this.comicInfoItem.fileData).toString('utf-8');
    return ParseUtil.parseComicInfoXml(content);
  }

  public getCover(): CoverStreams {
    const front = this.coverItems[0] ? Buffer.from(this.coverItems[0].fileData) : (this.imageItems.length > 0 ? Buffer.from(this.imageItems[0].fileData) : null);
    const back = this.coverItems[1] ? Buffer.from(this.coverItems[1].fileData) : null;
    return { front, back };
  }

  public hasFullCover(): boolean {
    return this.coverItems[2] !== null;
  }

  public getFullCover(): Buffer | null {
    if (!this.coverItems[2]) return null;
    return Buffer.from(this.coverItems[2].fileData);
  }
}
