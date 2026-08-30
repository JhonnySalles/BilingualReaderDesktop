import AdmZip from 'adm-zip';
import { Parse, CoverStreams } from './parse.interface';
import { ParseUtil } from './parse-util';
import { ComicInfo } from '../../../src/app/core/models/entities/comic-info.model';

export class ZipParse implements Parse {
  private zip: AdmZip | null = null;
  private entries: AdmZip.IZipEntry[] = [];
  private subtitles: AdmZip.IZipEntry[] = [];
  private comicInfoEntry: AdmZip.IZipEntry | null = null;
  private coverEntries: (AdmZip.IZipEntry | null)[] = [null, null, null];

  public parse(filePath: string): void {
    this.zip = new AdmZip(filePath);
    const zipEntries = this.zip.getEntries();

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;

      const name = entry.entryName;
      if (ParseUtil.isImage(name)) {
        this.entries.push(entry);
        const fileName = ParseUtil.getNameFromPath(name);
        if (fileName.toLowerCase().includes('volume')) {
          const coverPart = fileName.toLowerCase().substring(fileName.toLowerCase().lastIndexOf('volume'));
          if (coverPart.includes('frente') || coverPart.includes('cover') || coverPart.includes('front')) {
            this.coverEntries[0] = entry;
          } else if (coverPart.includes('tras') || coverPart.includes('back')) {
            this.coverEntries[1] = entry;
          } else if (coverPart.includes('tudo') || coverPart.includes('all') || coverPart.includes('everything')) {
            this.coverEntries[2] = entry;
          }
        }
      } else if (ParseUtil.isJson(name)) {
        this.subtitles.push(entry);
      } else if (ParseUtil.isXml(name) && name.toLowerCase().includes('comicinfo')) {
        this.comicInfoEntry = entry;
      }
    }

    this.entries.sort((a, b) => {
      const folderA = ParseUtil.getFolderFromPath(a.entryName);
      const folderB = ParseUtil.getFolderFromPath(b.entryName);
      if (folderA !== folderB) {
        return folderA.localeCompare(folderB);
      }
      return ParseUtil.naturalSort(a.entryName, b.entryName);
    });

    if (!this.coverEntries[0] && this.entries.length > 0) {
      this.coverEntries[0] = this.entries[0];
    }
  }

  public destroy(): void {
    this.zip = null;
    this.entries = [];
    this.subtitles = [];
    this.comicInfoEntry = null;
    this.coverEntries = [null, null, null];
  }

  public getPage(num: number): Buffer | null {
    if (!this.zip || num < 0 || num >= this.entries.length) return null;
    return this.zip.readFile(this.entries[num]);
  }

  public numPages(): number {
    return this.entries.length;
  }

  public getSubtitles(): string[] {
    if (!this.zip) return [];
    return this.subtitles.map(entry => this.zip!.readAsText(entry));
  }

  public hasSubtitles(): boolean {
    return this.subtitles.length > 0;
  }

  public getSubtitlesNames(): Record<string, number> {
    const map: Record<string, number> = {};
    this.subtitles.forEach((entry, index) => {
      const name = ParseUtil.getNameFromPath(entry.entryName);
      if (name && !(name in map)) {
        map[name] = index;
      }
    });
    return map;
  }

  public getPagePath(num: number): string | null {
    if (num < 0 || num >= this.entries.length) return null;
    return this.entries[num].entryName;
  }

  public getPagePaths(): Record<string, number> {
    const map: Record<string, number> = {};
    this.entries.forEach((entry, index) => {
      const folder = ParseUtil.getFolderFromPath(entry.entryName);
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
    return this.comicInfoEntry !== null;
  }

  public getComicInfo(): ComicInfo | null {
    if (!this.zip || !this.comicInfoEntry) return null;
    const content = this.zip.readAsText(this.comicInfoEntry);
    return ParseUtil.parseComicInfoXml(content);
  }

  public getCover(): CoverStreams {
    if (!this.zip) return { front: null, back: null };
    const front = this.coverEntries[0] ? this.zip.readFile(this.coverEntries[0]) : (this.entries.length > 0 ? this.zip.readFile(this.entries[0]) : null);
    const back = this.coverEntries[1] ? this.zip.readFile(this.coverEntries[1]) : null;
    return { front, back };
  }

  public hasFullCover(): boolean {
    return this.coverEntries[2] !== null;
  }

  public getFullCover(): Buffer | null {
    if (!this.zip || !this.coverEntries[2]) return null;
    return this.zip.readFile(this.coverEntries[2]);
  }
}
