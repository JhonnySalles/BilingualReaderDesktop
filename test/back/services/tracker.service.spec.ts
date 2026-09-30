import { TrackerService } from '../../../app/services/tracker.service';
import { StorageService } from '../../../app/database/storage.service';
import { Track } from '../../../src/app/core/models/entities/track.model';

describe('TrackerService (Backend)', () => {
  let trackerService: TrackerService;
  let mockStorageService: jest.Mocked<StorageService>;

  beforeEach(() => {
    mockStorageService = {
      getTracksByLibrary: jest.fn(),
      getAllTracks: jest.fn(),
      listAllLibraries: jest.fn(),
      getLibraryById: jest.fn(),
      mangaRepository: {
        list: jest.fn()
      },
      bookRepository: {
        list: jest.fn()
      }
    } as unknown as jest.Mocked<StorageService>;

    trackerService = new TrackerService(mockStorageService);
  });

  describe('cleanMediaName', () => {
    it('should remove file extensions', () => {
      expect(trackerService.cleanMediaName('One Piece - Vol 01.cbz')).toBe('One Piece');
      expect(trackerService.cleanMediaName('Naruto Chapter 10.zip')).toBe('Naruto');
      expect(trackerService.cleanMediaName('Bleach.pdf')).toBe('Bleach');
    });

    it('should remove bracketed and parenthesized metadata (scanlators, years)', () => {
      expect(trackerService.cleanMediaName('[Scanlator] Berserk (2021) - Vol 01.cbz')).toBe('Berserk');
      expect(trackerService.cleanMediaName('Chainsaw Man (Digital) [Colored].zip')).toBe('Chainsaw Man');
    });

    it('should remove volume patterns', () => {
      expect(trackerService.cleanMediaName('Monster - Vol. 05')).toBe('Monster');
      expect(trackerService.cleanMediaName('Monster Volume 05')).toBe('Monster');
      expect(trackerService.cleanMediaName('Monster v05')).toBe('Monster');
      expect(trackerService.cleanMediaName('Monster, Vol 05')).toBe('Monster');
    });

    it('should remove chapter patterns', () => {
      expect(trackerService.cleanMediaName('Attack on Titan - Chapter 139')).toBe('Attack on Titan');
      expect(trackerService.cleanMediaName('Attack on Titan - Cap. 139')).toBe('Attack on Titan');
      expect(trackerService.cleanMediaName('Attack on Titan Capitulo 139')).toBe('Attack on Titan');
      expect(trackerService.cleanMediaName('Attack on Titan Ch. 139')).toBe('Attack on Titan');
      expect(trackerService.cleanMediaName('Attack on Titan c139')).toBe('Attack on Titan');
    });

    it('should collapse extra spaces and trim', () => {
      expect(trackerService.cleanMediaName('   Kingdom    [Group]   -   Vol 10   ')).toBe('Kingdom');
    });
  });

  describe('extractVolume', () => {
    it('should extract volume correctly with various prefixes', () => {
      expect(trackerService.extractVolume('One Piece Vol. 01')).toBe(1);
      expect(trackerService.extractVolume('One Piece Volume 10')).toBe(10);
      expect(trackerService.extractVolume('One Piece v05')).toBe(5);
      expect(trackerService.extractVolume('One Piece Vol 100')).toBe(100);
    });

    it('should return null when no volume is found', () => {
      expect(trackerService.extractVolume('One Piece Chapter 10')).toBeNull();
      expect(trackerService.extractVolume('One Piece')).toBeNull();
    });
  });

  describe('extractChapter', () => {
    it('should extract chapter correctly with various prefixes', () => {
      expect(trackerService.extractChapter('Jujutsu Kaisen Chapter 01')).toBe(1);
      expect(trackerService.extractChapter('Jujutsu Kaisen Ch. 250')).toBe(250);
      expect(trackerService.extractChapter('Jujutsu Kaisen Cap. 15')).toBe(15);
      expect(trackerService.extractChapter('Jujutsu Kaisen Capitulo 05')).toBe(5);
      expect(trackerService.extractChapter('Jujutsu Kaisen c10')).toBe(10);
    });

    it('should return null when no chapter is found', () => {
      expect(trackerService.extractChapter('Jujutsu Kaisen Vol. 10')).toBeNull();
      expect(trackerService.extractChapter('Jujutsu Kaisen')).toBeNull();
    });
  });

  describe('matchTrack', () => {
    const libraryId = 1;

    it('should return NONE match if no tracks exist for the library', () => {
      mockStorageService.getTracksByLibrary.mockReturnValue([]);

      const result = trackerService.matchTrack(
        libraryId,
        'One Piece',
        'One Piece - Vol 01.cbz'
      );

      expect(result).toEqual({
        track: null,
        volume: 1,
        chapter: null,
        matchedBy: 'NONE'
      });
    });

    it('should match by MAL_ID (Level 1 Priority)', () => {
      const mockTrack: Track = {
        id: 10,
        fkLibrary: libraryId,
        malId: 13,
        title: 'One Piece',
        titleRegex: 'One Piece',
        chaptersRead: 0,
        volumesRead: 0
      };
      mockStorageService.getTracksByLibrary.mockReturnValue([mockTrack]);

      const result = trackerService.matchTrack(
        libraryId,
        'Different Title',
        'different_file.cbz',
        13, // comicInfoMalId
        'ComicInfo Title'
      );

      expect(result.matchedBy).toBe('MAL_ID');
      expect(result.track).toBe(mockTrack);
    });

    it('should match by TITLE (Level 2 Priority) when MAL_ID is not provided or not matched', () => {
      const mockTrack: Track = {
        id: 11,
        fkLibrary: libraryId,
        title: 'Bleach',
        titleRegex: 'Bleach',
        chaptersRead: 0,
        volumesRead: 0
      };
      mockStorageService.getTracksByLibrary.mockReturnValue([mockTrack]);

      const result = trackerService.matchTrack(
        libraryId,
        'Bleach',
        'Bleach - Vol 01.cbz',
        null,
        'Bleach'
      );

      expect(result.matchedBy).toBe('TITLE');
      expect(result.track).toBe(mockTrack);
    });

    it('should match by REGEX / Cleaned Filename (Level 3 Priority)', () => {
      const mockTrack: Track = {
        id: 12,
        fkLibrary: libraryId,
        title: 'Hunter x Hunter',
        titleRegex: '^HxH',
        chaptersRead: 0,
        volumesRead: 0
      };
      mockStorageService.getTracksByLibrary.mockReturnValue([mockTrack]);

      const result = trackerService.matchTrack(
        libraryId,
        '',
        'HxH - Vol 01.cbz'
      );

      expect(result.matchedBy).toBe('REGEX');
      expect(result.track).toBe(mockTrack);
    });
  });

  describe('listLibrariesFormatted', () => {
    it('should format manga and book libraries properly', () => {
      mockStorageService.listAllLibraries.mockReturnValue([
        { id: 1, title: 'Meus Mangás', type: 'MANGA', path: '/mangas' },
        { id: 2, title: 'Minhas Novels', type: 'BOOK', path: '/books' }
      ]);

      const formatted = trackerService.listLibrariesFormatted();

      expect(formatted).toEqual([
        { id: 1, title: 'Meus Mangás', type: 'MANGA', displayName: 'Mangá - Meus Mangás' },
        { id: 2, title: 'Minhas Novels', type: 'BOOK', displayName: 'Livro - Minhas Novels' }
      ]);
    });
  });
});
