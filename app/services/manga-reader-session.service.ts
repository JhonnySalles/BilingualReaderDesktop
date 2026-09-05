import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app, BrowserWindow } from 'electron';
import { ParseFactory } from '../parser/manga/parse-factory';

const CACHE_SLOTS = ['a', 'b', 'c'] as const;
const MAX_SESSIONS_PER_SLOT = 4;
const META_FILE = 'pages.json';

export interface MangaPagesMeta {
  mangaId: number;
  path: string;
  pageCount: number;
  files: string[];
  chapters: number[];
  createdAt: number;
}

export interface OpenMangaReaderResult {
  sessionId: string;
  mangaId: number;
  title: string;
  pageCount: number;
  pages: string[];
  chapters: number[];
  bookMark: number;
  favorite: boolean;
  cacheDir: string;
}

interface ActiveSession {
  sessionId: string;
  mangaId: number;
  cacheDir: string;
}

export class MangaReaderSessionService {
  private active = new Map<string, ActiveSession>();

  getCacheRoot(): string {
    return path.join(app.getPath('userData'), 'cache', 'manga-pages');
  }

  isPathAllowed(filePath: string): boolean {
    const root = path.resolve(this.getCacheRoot());
    let candidate = filePath;
    if (/^\/[A-Za-z]:\//.test(candidate)) {
      candidate = candidate.slice(1);
    }
    const resolved = path.resolve(candidate);
    return resolved === root || resolved.startsWith(root + path.sep);
  }

  toLocalPageUrl(filePath: string): string {
    const normalized = path.resolve(filePath).replace(/\\/g, '/');
    return 'local-page:///' + normalized;
  }

  async open(
    mangaId: number,
    mangaPath: string,
    title: string,
    bookMark: number,
    favorite: boolean,
    sender?: BrowserWindow | null
  ): Promise<OpenMangaReaderResult> {
    if (!fs.existsSync(mangaPath)) {
      throw new Error(`Arquivo não encontrado: ${mangaPath}`);
    }

    const hash = this.fileHash(mangaPath);
    let cacheDir = this.findExistingCache(hash);

    if (!cacheDir) {
      const slot = CACHE_SLOTS[Math.floor(Math.random() * CACHE_SLOTS.length)];
      this.trimSlot(slot);
      cacheDir = path.join(this.getCacheRoot(), slot, hash);
      fs.mkdirSync(cacheDir, { recursive: true });
      await this.extractPages(mangaId, mangaPath, cacheDir, sender);
    }

    const meta = this.readMeta(cacheDir);
    if (!meta || meta.pageCount < 1 || meta.files.length !== meta.pageCount) {
      // corrupt cache — rebuild
      fs.rmSync(cacheDir, { recursive: true, force: true });
      const slot = CACHE_SLOTS[Math.floor(Math.random() * CACHE_SLOTS.length)];
      this.trimSlot(slot);
      cacheDir = path.join(this.getCacheRoot(), slot, hash);
      fs.mkdirSync(cacheDir, { recursive: true });
      await this.extractPages(mangaId, mangaPath, cacheDir, sender);
    }

    const finalMeta = this.readMeta(cacheDir)!;
    const sessionId = crypto.randomBytes(8).toString('hex');
    this.active.set(sessionId, { sessionId, mangaId, cacheDir });

    const pages = finalMeta.files.map(f => this.toLocalPageUrl(path.join(cacheDir, f)));

    return {
      sessionId,
      mangaId,
      title,
      pageCount: finalMeta.pageCount,
      pages,
      chapters: finalMeta.chapters || [],
      bookMark: Math.min(Math.max(0, bookMark || 0), Math.max(0, finalMeta.pageCount - 1)),
      favorite: !!favorite,
      cacheDir
    };
  }

  close(sessionId: string): boolean {
    return this.active.delete(sessionId);
  }

  private fileHash(filePath: string): string {
    const stat = fs.statSync(filePath);
    const key = `${filePath}|${stat.size}|${stat.mtimeMs}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }

  private findExistingCache(hash: string): string | null {
    for (const slot of CACHE_SLOTS) {
      const dir = path.join(this.getCacheRoot(), slot, hash);
      const metaPath = path.join(dir, META_FILE);
      if (fs.existsSync(metaPath)) {
        try {
          const meta = this.readMeta(dir);
          if (meta && meta.pageCount > 0 && meta.files.length === meta.pageCount) {
            const allExist = meta.files.every(f => fs.existsSync(path.join(dir, f)));
            if (allExist) return dir;
          }
        } catch {
          // ignore and continue
        }
      }
    }
    return null;
  }

  private readMeta(cacheDir: string): MangaPagesMeta | null {
    const metaPath = path.join(cacheDir, META_FILE);
    if (!fs.existsSync(metaPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(metaPath, 'utf8')) as MangaPagesMeta;
    } catch {
      return null;
    }
  }

  private trimSlot(slot: string): void {
    const slotDir = path.join(this.getCacheRoot(), slot);
    if (!fs.existsSync(slotDir)) {
      fs.mkdirSync(slotDir, { recursive: true });
      return;
    }

    const entries = fs.readdirSync(slotDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => {
        const full = path.join(slotDir, d.name);
        const meta = this.readMeta(full);
        let mtime = 0;
        try {
          mtime = fs.statSync(full).mtimeMs;
        } catch {}
        return { full, createdAt: meta?.createdAt ?? mtime };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    while (entries.length >= MAX_SESSIONS_PER_SLOT) {
      const oldest = entries.pop();
      if (!oldest) break;
      try {
        fs.rmSync(oldest.full, { recursive: true, force: true });
      } catch (e) {
        console.warn('[MangaReaderSession] Failed to trim cache', e);
      }
    }
  }

  private async extractPages(
    mangaId: number,
    mangaPath: string,
    cacheDir: string,
    sender?: BrowserWindow | null
  ): Promise<void> {
    const parser = await ParseFactory.create(mangaPath);
    if (!parser) {
      throw new Error('Não foi possível abrir o arquivo de mangá');
    }

    try {
      const pageCount = parser.numPages();
      if (pageCount < 1) {
        throw new Error('Arquivo sem páginas de imagem');
      }

      const chapters = parser.getChapters?.() ?? [];
      const files: string[] = [];

      for (let i = 0; i < pageCount; i++) {
        const buf = parser.getPage(i);
        if (!buf) {
          throw new Error(`Falha ao extrair página ${i}`);
        }
        const sourcePath = parser.getPagePath(i) || '';
        const ext = this.resolveExtension(sourcePath, buf);
        const name = `${String(i).padStart(4, '0')}${ext}`;
        fs.writeFileSync(path.join(cacheDir, name), buf);
        files.push(name);

        if (sender && !sender.isDestroyed()) {
          sender.webContents.send('manga-reader:extract-progress', {
            current: i + 1,
            total: pageCount
          });
        }
      }

      const meta: MangaPagesMeta = {
        mangaId,
        path: mangaPath,
        pageCount,
        files,
        chapters,
        createdAt: Date.now()
      };
      fs.writeFileSync(path.join(cacheDir, META_FILE), JSON.stringify(meta, null, 2), 'utf8');
    } finally {
      try {
        parser.destroy(false);
      } catch {}
    }
  }

  private resolveExtension(sourcePath: string, buf: Buffer): string {
    const fromPath = path.extname(sourcePath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(fromPath)) {
      return fromPath === '.jpeg' ? '.jpg' : fromPath;
    }
    if (buf.length >= 8) {
      if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return '.png';
      if (buf[0] === 0xff && buf[1] === 0xd8) return '.jpg';
      if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return '.gif';
      if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return '.webp';
    }
    return '.jpg';
  }
}
