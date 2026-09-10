import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { path7za } from '7zip-bin';
import { Parse, CoverStreams } from './parse.interface';
import { ParseUtil } from './parse-util';
import { ComicInfo } from '../../../src/app/core/models/entities/comic-info.model';
import {
  ArchiveFileItem,
  classifyArchiveItems,
  collectArchiveItemsFromDir,
  readArchiveItem,
  readArchiveItemText
} from './archive-item.util';

function resolve7za(): string {
  const candidates: string[] = [];
  if (process.env['BILINGUAL_7ZA_PATH']) {
    candidates.push(process.env['BILINGUAL_7ZA_PATH']);
  }
  // Packaged app: extraResources/7zip-bin/...
  try {
    const { app } = require('electron') as typeof import('electron');
    if (app?.isPackaged) {
      const platformDir =
        process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux';
      const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
      const exe = process.platform === 'win32' ? '7za.exe' : '7za';
      candidates.push(
        path.join(process.resourcesPath, '7zip-bin', platformDir, arch, exe),
        path.join(process.resourcesPath, '7zip-bin', exe)
      );
    }
  } catch {
    /* not in electron context */
  }
  candidates.push(path7za);
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return path7za;
}

function run7za(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(resolve7za(), args, { windowsHide: true });
    let stderr = '';
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      resolve({ code: 1, stderr: err.message });
    });
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stderr });
    });
  });
}

export class SevenZParse implements Parse {
  private extractDir: string | null = null;
  private imageItems: ArchiveFileItem[] = [];
  private subtitles: ArchiveFileItem[] = [];
  private comicInfoItem: ArchiveFileItem | null = null;
  private coverItems: (ArchiveFileItem | null)[] = [null, null, null];

  public async parse(filePath: string): Promise<void> {
    try {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'br-7z-'));
      this.extractDir = tmp;

      const result = await run7za(['x', filePath, `-o${tmp}`, '-y', '-bso0', '-bsp0']);
      if (result.code !== 0) {
        throw new Error(result.stderr || `7za extract failed with code ${result.code}`);
      }

      const all = collectArchiveItemsFromDir(tmp);
      const classified = classifyArchiveItems(all);
      this.imageItems = classified.imageItems;
      this.subtitles = classified.subtitles;
      this.comicInfoItem = classified.comicInfoItem;
      this.coverItems = classified.coverItems;

      if (this.imageItems.length === 0) {
        throw new Error('No images found or not a valid 7z archive');
      }
    } catch (e) {
      this.destroy();
      throw e;
    }
  }

  public destroy(isClearCache = true): void {
    this.imageItems = [];
    this.subtitles = [];
    this.comicInfoItem = null;
    this.coverItems = [null, null, null];
    if (isClearCache && this.extractDir && fs.existsSync(this.extractDir)) {
      try {
        fs.rmSync(this.extractDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    this.extractDir = null;
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
