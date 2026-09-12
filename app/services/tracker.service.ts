import { StorageService } from '../database/storage.service';
import { Track } from '../../src/app/core/models/entities/track.model';

export interface TrackerMatchResult {
  track: Track | null;
  volume: number | null;
  chapter: number | null;
  matchedBy: 'MAL_ID' | 'TITLE' | 'REGEX' | 'NONE';
}

export class TrackerService {
  constructor(private storage: StorageService) {}

  /**
   * Sanitizes a media title / filename to remove tags, volume, chapter, and file extension.
   */
  public cleanMediaName(filename: string): string {
    let clean = filename;

    // Remove file extension
    clean = clean.replace(/\.[a-zA-Z0-9]+$/, '');

    // Remove brackets / parenthesis metadata like [Scanlator], (2021), etc.
    clean = clean.replace(/\[[^\]]*\]/g, ' ');
    clean = clean.replace(/\([^\)]*\)/g, ' ');

    // Remove volume/chapter patterns
    clean = clean.replace(/\s*-\s*(?:Vol\.?|Volume)\s*\d+/gi, ' ');
    clean = clean.replace(/,\s*(?:Vol\.?|Volume)\s*\d+/gi, ' ');
    clean = clean.replace(/\s+(?:Vol\.?|Volume)\s*\d+/gi, ' ');
    clean = clean.replace(/\s*-\s*(?:Cap\.?|Capitulo|Chapter|Ch\.?|c)\s*\d+/gi, ' ');
    clean = clean.replace(/\s+(?:Cap\.?|Capitulo|Chapter|Ch\.?|c)\s*\d+/gi, ' ');
    clean = clean.replace(/\s*v\d+(\.\d+)?/gi, ' ');

    // Collapse multiple whitespaces and trim
    return clean.replace(/\s+/g, ' ').trim();
  }

  /**
   * Extracts volume number from title or filename.
   */
  public extractVolume(name: string): number | null {
    const volRegex = /(?:Vol\.?|Volume|v)\s*0*(\d+)/i;
    const match = name.match(volRegex);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  /**
   * Extracts chapter number from title or filename.
   */
  public extractChapter(name: string): number | null {
    const chRegex = /(?:Cap\.?|Capitulo|Chapter|Ch\.?|c)\s*0*(\d+)/i;
    const match = name.match(chRegex);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  /**
   * Cascading resolution to find the associated Track for a file in a library.
   * Priority:
   * 1. ComicInfo MAL ID (if provided)
   * 2. Direct match with ComicInfo Title or media title
   * 3. Regex / cleaned filename matching against Track.titleRegex or Track.title
   */
  public matchTrack(
    libraryId: number,
    title: string,
    filename: string,
    comicInfoMalId?: number | null,
    comicInfoTitle?: string | null
  ): TrackerMatchResult {
    const volume = this.extractVolume(filename) || (title ? this.extractVolume(title) : null);
    const chapter = this.extractChapter(filename) || (title ? this.extractChapter(title) : null);

    const libraryTracks = this.storage.getTracksByLibrary(libraryId);
    if (!libraryTracks || libraryTracks.length === 0) {
      return { track: null, volume, chapter, matchedBy: 'NONE' };
    }

    // 1. Level 1: Match by MAL ID
    if (comicInfoMalId) {
      const trackByMal = libraryTracks.find(t => t.malId === comicInfoMalId);
      if (trackByMal) {
        return { track: trackByMal, volume, chapter, matchedBy: 'MAL_ID' };
      }
    }

    // 2. Level 2: Match by ComicInfo Title or Media Title
    const titleCandidates = [comicInfoTitle, title].filter((t): t is string => !!t && t.trim().length > 0);
    for (const t of titleCandidates) {
      const exactMatch = libraryTracks.find(
        track => track.title && track.title.toLowerCase().trim() === t.toLowerCase().trim()
      );
      if (exactMatch) {
        return { track: exactMatch, volume, chapter, matchedBy: 'TITLE' };
      }
    }

    // 3. Level 3: Regex match / Cleaned filename match
    const cleanedFilename = this.cleanMediaName(filename);
    const searchStrings = [filename, cleanedFilename, ...titleCandidates];

    for (const track of libraryTracks) {
      if (track.titleRegex && track.titleRegex.trim().length > 0) {
        try {
          const regex = new RegExp(track.titleRegex.trim(), 'i');
          const isMatch = searchStrings.some(s => regex.test(s));
          if (isMatch) {
            return { track, volume, chapter, matchedBy: 'REGEX' };
          }
        } catch (e) {
          // Invalid regex fallback: simple substring search
          const simpleMatch = searchStrings.some(s =>
            s.toLowerCase().includes(track.titleRegex.toLowerCase())
          );
          if (simpleMatch) {
            return { track, volume, chapter, matchedBy: 'REGEX' };
          }
        }
      }

      if (track.title && track.title.trim().length > 0) {
        const titleLower = track.title.toLowerCase().trim();
        const cleanedLower = cleanedFilename.toLowerCase();
        if (cleanedLower.includes(titleLower) || titleLower.includes(cleanedLower)) {
          return { track, volume, chapter, matchedBy: 'TITLE' };
        }
      }
    }

    return { track: null, volume, chapter, matchedBy: 'NONE' };
  }

  /**
   * Returns all tracks enriched with library details and count of matched media files.
   */
  public getAllTracksWithMetadata(): Array<Track & { libraryTitle?: string; libraryType?: 'MANGA' | 'BOOK'; matchedCount: number }> {
    const tracks = this.storage.getAllTracks();
    const allLibs = this.storage.listAllLibraries();
    const libMap = new Map<number, { title: string; type: 'MANGA' | 'BOOK' }>();
    for (const lib of allLibs) {
      libMap.set(lib.id, { title: lib.title, type: lib.type });
    }

    return tracks.map(track => {
      const libInfo = libMap.get(track.fkLibrary);
      const matched = this.getMatchedMedia(track.fkLibrary, track.titleRegex, track.title, track.malId);
      return {
        ...track,
        libraryTitle: libInfo?.title || `Biblioteca #${track.fkLibrary}`,
        libraryType: libInfo?.type || 'MANGA',
        matchedCount: matched.length
      };
    });
  }

  /**
   * Finds all media items in a library that match a given Regex, title, or MAL ID.
   */
  public getMatchedMedia(
    libraryId: number,
    titleRegex: string,
    title?: string | null,
    _malId?: number | null
  ): any[] {
    if (!libraryId) return [];

    const lib = this.storage.getLibraryById(libraryId);
    const libType = lib?.type || 'MANGA';

    let items: any[] = [];
    if (libType === 'MANGA') {
      items = this.storage.mangaRepository.list(libraryId);
    } else {
      items = this.storage.bookRepository.list(libraryId);
    }

    if (!items || items.length === 0) return [];

    const regexStr = (titleRegex || '').trim();
    let regex: RegExp | null = null;
    if (regexStr) {
      try {
        regex = new RegExp(regexStr, 'i');
      } catch {
        // Fallback: literal string match
      }
    }

    const titleLower = (title || '').trim().toLowerCase();

    return items
      .filter(item => {
        const itemName = item.name || '';
        const itemTitle = item.title || '';
        const cleanedName = this.cleanMediaName(itemName);
        const candidates = [itemName, itemTitle, cleanedName];

        // 1. Regex test
        if (regex) {
          if (candidates.some(c => regex!.test(c))) return true;
        } else if (regexStr) {
          if (candidates.some(c => c.toLowerCase().includes(regexStr.toLowerCase()))) return true;
        }

        // 2. Title test
        if (titleLower) {
          if (candidates.some(c => c.toLowerCase().includes(titleLower))) return true;
        }

        return false;
      })
      .map(item => ({
        id: item.id,
        title: item.title || item.name,
        name: item.name,
        coverPath: item.coverPath,
        bookMark: item.bookMark ?? 0,
        pages: item.pages ?? 1,
        fileSize: item.fileSize ?? 0,
        fileType: item.fileType,
        type: libType,
        series: item.series,
        author: item.author,
        publisher: (item as any).publisher,
        completed: Boolean(item.completed)
      }));
  }

  /**
   * Lists all available libraries formatted for dropdown selection.
   */
  public listLibrariesFormatted(): Array<{ id: number; title: string; type: 'MANGA' | 'BOOK'; displayName: string }> {
    const libs = this.storage.listAllLibraries();
    return libs.map(l => ({
      id: l.id,
      title: l.title,
      type: l.type,
      displayName: `${l.type === 'MANGA' ? 'Mangá' : 'Livro'} - ${l.title}`
    }));
  }
}

