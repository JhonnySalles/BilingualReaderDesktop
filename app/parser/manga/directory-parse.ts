import * as fs from 'fs';
import * as path from 'path';
import { Parse, CoverStreams } from './parse.interface';
import { ParseUtil } from './parse-util';
import { ComicInfo } from '../../../src/app/core/models/entities/comic-info.model';

export class DirectoryParse implements Parse {
  private files: string[] = [];
  private subtitles: string[] = [];
  private comicInfoFile: string | null = null;
  private coverFiles: (string | null)[] = [null, null, null];

  public parse(dirPath: string): void {
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      throw new Error(`Invalid directory path: ${dirPath}`);
    }

    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      if (fs.statSync(fullPath).isDirectory()) {
        continue;
      }

      if (ParseUtil.isImage(item)) {
        this.files.push(fullPath);
        const fileName = ParseUtil.getNameFromPath(item);
        if (fileName.toLowerCase().includes('volume')) {
          const coverPart = fileName.toLowerCase().substring(fileName.toLowerCase().lastIndexOf('volume'));
          if (coverPart.includes('frente') || coverPart.includes('cover') || coverPart.includes('front')) {
            this.coverFiles[0] = fullPath;
          } else if (coverPart.includes('tras') || coverPart.includes('back')) {
            this.coverFiles[1] = fullPath;
          } else if (coverPart.includes('tudo') || coverPart.includes('all') || coverPart.includes('everything')) {
            this.coverFiles[2] = fullPath;
          }
        }
      } else if (ParseUtil.isJson(item)) {
        this.subtitles.push(fullPath);
      } else if (ParseUtil.isXml(item) && item.toLowerCase().includes('comicinfo')) {
        this.comicInfoFile = fullPath;
      }
    }

    this.files.sort((a, b) => ParseUtil.naturalSort(a, b));

    if (!this.coverFiles[0] && this.files.length > 0) {
      this.coverFiles[0] = this.files[0];
    }
  }

  public destroy(): void {
    this.files = [];
    this.subtitles = [];
    this.comicInfoFile = null;
    this.coverFiles = [null, null, null];
  }

  public getPage(num: number): Buffer | null {
    if (num < 0 || num >= this.files.length) return null;
    return fs.readFileSync(this.files[num]);
  }

  public numPages(): number {
    return this.files.length;
  }

  public getSubtitles(): string[] {
    return this.subtitles.map(filePath => fs.readFileSync(filePath, 'utf-8'));
  }

  public hasSubtitles(): boolean {
    return this.subtitles.length > 0;
  }

  public getSubtitlesNames(): Record<string, number> {
    const map: Record<string, number> = {};
    this.subtitles.forEach((file, index) => {
      const name = ParseUtil.getNameFromPath(file);
      if (name && !(name in map)) {
        map[name] = index;
      }
    });
    return map;
  }

  public getPagePath(num: number): string | null {
    if (num < 0 || num >= this.files.length) return null;
    return ParseUtil.getNameFromPath(this.files[num]);
  }

  public getPagePaths(): Record<string, number> {
    const map: Record<string, number> = {};
    this.files.forEach((file, index) => {
      const folder = ParseUtil.getFolderFromPath(file);
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
    return this.comicInfoFile !== null;
  }

  public getComicInfo(): ComicInfo | null {
    if (!this.comicInfoFile) return null;
    const content = fs.readFileSync(this.comicInfoFile, 'utf-8');
    return ParseUtil.parseComicInfoXml(content);
  }

  public getCover(): CoverStreams {
    const front = this.coverFiles[0] ? fs.readFileSync(this.coverFiles[0]) : (this.files.length > 0 ? fs.readFileSync(this.files[0]) : null);
    const back = this.coverFiles[1] ? fs.readFileSync(this.coverFiles[1]) : null;
    return { front, back };
  }

  public hasFullCover(): boolean {
    return this.coverFiles[2] !== null;
  }

  public getFullCover(): Buffer | null {
    if (!this.coverFiles[2]) return null;
    return fs.readFileSync(this.coverFiles[2]);
  }
}
