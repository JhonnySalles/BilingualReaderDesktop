import * as fs from 'fs';
import { ScannerMangaService } from '../../../app/scanner/scanner-manga.service';
import { StorageService } from '../../../app/database/storage.service';
import { ParseFactory } from '../../../app/parser/manga/parse-factory';
import { MangaImageCoverController } from '../../../app/controllers/manga-image-cover.controller';
import { BrowserWindow } from 'electron';
import { Manga } from '../../../src/app/core/models/entities/manga.model';

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    promises: {
      stat: jest.fn()
    }
  };
});

jest.mock('../../../app/parser/manga/parse-factory');
jest.mock('../../../app/controllers/manga-image-cover.controller');
jest.mock('../../../app/utils/telemetry', () => ({
  Telemetry: {
    recordException: jest.fn()
  }
}));

describe('ScannerMangaService (Backend)', () => {
  let service: ScannerMangaService;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockWindow: jest.Mocked<BrowserWindow>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStorageService = {
      getOrCreateLibrary: jest.fn().mockReturnValue(1),
      listMangas: jest.fn().mockReturnValue([]),
      saveManga: jest.fn().mockReturnValue(100),
      saveMangasBatch: jest.fn().mockImplementation((items) => items),
      findMangaByPath: jest.fn().mockReturnValue(null),
      findMangaById: jest.fn().mockReturnValue(null),
      deleteManga: jest.fn()
    } as unknown as jest.Mocked<StorageService>;

    mockWindow = {
      webContents: {
        send: jest.fn()
      }
    } as unknown as jest.Mocked<BrowserWindow>;

    service = new ScannerMangaService(mockStorageService);
  });

  describe('isRunning & stopScanning', () => {
    it('should report false when not running', () => {
      expect(service.isRunning()).toBe(false);
    });

    it('should notify window when stopping an active scan', async () => {
      // Force internal state for test
      (service as any).isScanning = true;
      (service as any).currentFolderPath = '/test/folder';

      await service.stopScanning(mockWindow);

      expect(service.isRunning()).toBe(false);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('manga:scan-status', {
        status: 'CANCELLED',
        folderPath: '/test/folder'
      });
    });
  });

  describe('processSingleFile', () => {
    it('should return null if file does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await service.processSingleFile('/invalid/path.cbz', mockWindow);
      expect(result).toBeNull();
    });

    it('should process a new file and save it to storage', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.stat as jest.Mock).mockResolvedValue({
        isDirectory: () => false,
        size: 1024 * 1024,
        mtime: new Date('2026-01-01T00:00:00Z')
      });

      const mockParser = {
        numPages: jest.fn().mockReturnValue(20),
        hasSubtitles: jest.fn().mockReturnValue(false),
        getComicInfo: jest.fn().mockReturnValue({
          writer: 'Eiichiro Oda',
          series: 'One Piece',
          genre: 'Adventure',
          number: '1'
        }),
        getCover: jest.fn().mockReturnValue({ front: Buffer.from('cover') }),
        destroy: jest.fn()
      };

      (ParseFactory.create as jest.Mock).mockResolvedValue(mockParser);
      (MangaImageCoverController as any).instance = {
        saveCoverToCache: jest.fn().mockReturnValue('/cache/cover.jpg')
      };

      const savedManga: Manga = {
        id: 100,
        title: 'One Piece 01',
        name: 'One Piece 01.cbz',
        path: '/mangas/One Piece 01.cbz',
        folder: '/mangas',
        fkLibrary: 1,
        pages: 20,
        chapters: [],
        chaptersPages: {},
        bookMark: 0,
        completed: false,
        favorite: false,
        hasSubtitle: false,
        author: 'Eiichiro Oda',
        series: 'One Piece',
        genre: 'Adventure',
        publisher: '',
        volume: '1',
        excluded: false,
        fileSize: 1024 * 1024,
        fileType: 0 as any,
        fileAlteration: '2026-01-01T00:00:00.000Z'
      };

      mockStorageService.findMangaByPath
        .mockReturnValueOnce(undefined) // first check: not in db
        .mockReturnValue(savedManga); // second check: after processNewManga

      const result = await service.processSingleFile('/mangas/One Piece 01.cbz', mockWindow);

      expect(mockStorageService.getOrCreateLibrary).toHaveBeenCalledWith('/mangas', 'MANGA');
      expect(mockStorageService.saveManga).toHaveBeenCalled();
      expect(mockParser.destroy).toHaveBeenCalled();
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('manga:updated-add', expect.any(Object));
      expect(result).toEqual(savedManga);
    });
  });
});
