import * as path from 'path';
import { ComicInfo } from '../../../src/app/core/models/entities/comic-info.model';

export class ParseUtil {
  public static readonly IMAGE_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif'
  ]);

  public static isImage(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return this.IMAGE_EXTENSIONS.has(ext);
  }

  public static isJson(filename: string): boolean {
    return filename.toLowerCase().endsWith('.json');
  }

  public static isXml(filename: string): boolean {
    return filename.toLowerCase().endsWith('.xml');
  }

  public static getNameFromPath(filePath: string): string {
    return path.basename(filePath);
  }

  public static getFolderFromPath(filePath: string): string {
    const dir = path.dirname(filePath);
    return dir === '.' ? '' : dir;
  }

  /**
   * Sorts filenames naturally so that 'page2' comes before 'page10'
   */
  public static naturalSort(a: string, b: string): number {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  }

  /**
   * Simple parser to convert ComicInfo.xml content to a ComicInfo object
   */
  public static parseComicInfoXml(xmlContent: string): ComicInfo | null {
    try {
      const getTagValue = (tagName: string): string => {
        const regex = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i');
        const match = xmlContent.match(regex);
        return match ? match[1].trim() : '';
      };

      const getTagNumber = (tagName: string): number => {
        const val = getTagValue(tagName);
        return val ? Number(val) : 0;
      };

      return {
        id: 0,
        title: getTagValue('Title'),
        series: getTagValue('Series'),
        number: getTagValue('Number'),
        summary: getTagValue('Summary'),
        writer: getTagValue('Writer'),
        penciller: getTagValue('Penciller'),
        inker: getTagValue('Inker'),
        colorist: getTagValue('Colorist'),
        letterer: getTagValue('Letterer'),
        coverArtist: getTagValue('CoverArtist'),
        editor: getTagValue('Editor'),
        publisher: getTagValue('Publisher'),
        genre: getTagValue('Genre'),
        web: getTagValue('Web'),
        pageCount: getTagNumber('PageCount'),
        languageISO: getTagValue('LanguageISO'),
        format: getTagValue('Format'),
        manga: getTagValue('Manga'),
        characters: getTagValue('Characters'),
        teams: getTagValue('Teams'),
        locations: getTagValue('Locations'),
        scanInformation: getTagValue('ScanInformation'),
        storyArc: getTagValue('StoryArc'),
        seriesGroup: getTagValue('SeriesGroup'),
        ageRating: getTagValue('AgeRating'),
        year: getTagNumber('Year'),
        month: getTagNumber('Month'),
        day: getTagNumber('Day')
      } as ComicInfo;
    } catch {
      return null;
    }
  }
}
