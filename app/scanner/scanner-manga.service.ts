import * as fs from 'fs';
import * as path from 'path';
import { BrowserWindow } from 'electron';
import { StorageService } from '../database/storage.service';
import { Manga } from '../../src/app/core/models/entities/manga.model';
import { FileType } from '../../src/app/core/models/enums/app-enums';
import { ParseFactory } from '../parser/manga/parse-factory';
import { MangaImageCoverController } from '../controllers/manga-image-cover.controller';

const MANGA_EXTENSIONS = new Set(['.cbz', '.cbr', '.cb7', '.cbt', '.zip', '.rar', '.7z', '.tar', '.epub', '.epub3']);

export class ScannerMangaService {
  private isScanning = false;

  constructor(private storageService: StorageService) {}

  public isRunning(): boolean {
    return this.isScanning;
  }

  public async scanFolder(folderPath: string, window: BrowserWindow | null): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    if (window) {
      window.webContents.send('manga:scan-status', { status: 'STARTED', folderPath });
    }

    try {
      if (!fs.existsSync(folderPath)) {
        return;
      }

      const libraryId = this.storageService.getOrCreateLibrary(folderPath);
      const existingMangas = this.storageService.listMangas(libraryId);
      const existingMap = new Map<string, Manga>();
      existingMangas.forEach(m => existingMap.set(m.path || (m as any).file || '', m));

      const foundPaths = new Set<string>();
      await this.walkDirectory(folderPath, async (filePath, stat) => {
        const ext = path.extname(filePath).toLowerCase();
        if (MANGA_EXTENSIONS.has(ext)) {
          foundPaths.add(filePath);
          if (!existingMap.has(filePath)) {
            // New Manga Found
            await this.processNewManga(filePath, stat, libraryId, window);
          } else {
            existingMap.delete(filePath);
          }
        }
      });

      // Remove missing mangas
      for (const [missingPath, missingManga] of existingMap.entries()) {
        if (missingManga.id) {
          this.storageService.deleteManga(missingManga.id);
          if (window) {
            window.webContents.send('manga:updated-remove', { id: missingManga.id, path: missingPath });
          }
        }
      }

    } catch (err) {
      console.error('Error scanning folder:', err);
    } finally {
      this.isScanning = false;
      if (window) {
        window.webContents.send('manga:scan-status', { status: 'FINISHED', folderPath });
      }
    }
  }

  private async walkDirectory(dir: string, callback: (filePath: string, stat: fs.Stats) => Promise<void>): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.walkDirectory(fullPath, callback);
      } else if (entry.isFile()) {
        const stat = await fs.promises.stat(fullPath);
        await callback(fullPath, stat);
      }
    }
  }

  private async processNewManga(
    filePath: string,
    stat: fs.Stats,
    libraryId: number,
    window: BrowserWindow | null
  ): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    const title = path.basename(filePath, ext);
    const folder = path.dirname(filePath);

    let pages = 1;
    let coverPath: string | undefined = undefined;

    let author = '';
    let series = '';
    let genre = '';
    let publisher = '';
    let volume = '';
    let hasSubtitle = false;

    // Use ParseFactory to inspect comic/manga file
    const parser = ParseFactory.create(filePath);
    if (parser) {
      try {
        pages = Math.max(1, parser.numPages());
        hasSubtitle = parser.hasSubtitles();

        const comicInfo = parser.getComicInfo();
        if (comicInfo) {
          if (comicInfo.writer) author = comicInfo.writer;
          if (comicInfo.series) series = comicInfo.series;
          if (comicInfo.genre) genre = comicInfo.genre;
          if (comicInfo.publisher) publisher = comicInfo.publisher;
          if (comicInfo.number) volume = comicInfo.number;
        }

        const mangaEntity = { path: filePath, name: fileName } as Manga;
        const extractedCover = MangaImageCoverController.instance.getMangaCoverFile(mangaEntity);
        if (extractedCover) {
          coverPath = extractedCover;
        }
      } catch (e) {
        console.warn(`Could not parse ${fileName}:`, e);
      } finally {
        parser.destroy();
      }
    }

    const typeStr = ext.replace('.', '').toUpperCase();
    const manga: Partial<Manga> = {
      title,
      path: filePath,
      folder,
      name: fileName,
      fileSize: stat.size,
      fileType: (FileType as any)[typeStr] || FileType.UNKNOWN,
      pages,
      chapters: [],
      chaptersPages: {},
      bookMark: 0,
      completed: false,
      favorite: false,
      hasSubtitle,
      author,
      series,
      genre,
      publisher,
      volume,
      fkLibrary: libraryId,
      excluded: false,
      fileAlteration: stat.mtime.toISOString(),
      coverPath
    };

    const id = this.storageService.saveManga(manga);
    manga.id = id;

    if (window) {
      window.webContents.send('manga:updated-add', manga);
    }
  }
}


