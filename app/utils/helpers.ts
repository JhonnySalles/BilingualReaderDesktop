import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { FileType } from '../../src/app/core/models/enums/app-enums';

export class Util {
  public static MD5(input: string | Buffer): string {
    if (typeof input === 'string') {
      return crypto.createHash('md5').update(input).digest('hex');
    }
    return crypto.createHash('md5').update(input).digest('hex');
  }

  public static getNameFromPath(filePath: string): string {
    if (!filePath) return '';
    return path.basename(filePath);
  }

  public static getNameWithoutExtensionFromPath(filePath: string): string {
    if (!filePath) return '';
    const name = path.basename(filePath);
    const ext = path.extname(name);
    return ext ? name.substring(0, name.length - ext.length) : name;
  }

  public static getExtensionFromPath(filePath: string): string {
    if (!filePath) return '';
    const ext = path.extname(filePath);
    return ext.startsWith('.') ? ext.substring(1) : ext;
  }

  public static getNameWithoutVolumeAndChapter(mangaTitle: string): string {
    if (!mangaTitle) return '';

    let name = mangaTitle;
    if (name.includes(' - ')) {
      name = name.substring(0, name.lastIndexOf(' - '));
    }

    const lower = name.toLowerCase();
    if (lower.includes('volume')) {
      const idx = lower.lastIndexOf('volume');
      name = name.substring(0, idx).trim();
    } else if (lower.includes('capitulo')) {
      const idx = lower.lastIndexOf('capitulo');
      name = name.substring(0, idx).trim();
    } else if (lower.includes('capítulo')) {
      const idx = lower.lastIndexOf('capítulo');
      name = name.substring(0, idx).trim();
    }

    return name.trim();
  }

  public static normalizeNameCache(name: string, prefix: string = '', isRandom: Boolean = true): string {
    let normalize = name;
    if (name.includes('-')) {
      normalize = name.split('-')[0];
    } else if (name.includes(' ')) {
      normalize = name.split(' ')[0];
    }

    const randomStr = isRandom ? Math.floor(Math.random() * 1000000).toString() : '';
    const cleaned = normalize.replace(/[^\w\d ]/g, '').replace(/\s+/g, '_').trim().toLowerCase();
    return `${prefix}${cleaned}${randomStr}`;
  }

  public static normalizeFilePath(filePath: string): string {
    let folder = filePath;
    if (folder.includes('primary')) {
      folder = folder.replace('primary', 'emulated/0');
    }
    if (folder.includes('/tree')) {
      folder = folder.replace('/tree', '/storage').replace(/:/g, '/');
    } else if (folder.includes('/document')) {
      folder = folder.replace('/document', '/storage').replace(/:/g, '/');
    }
    return folder;
  }

  public static getChapterFromPath(filePath: string): number {
    if (!filePath) return -1;
    const normalized = filePath.replace(/[/\\]+$/, '');
    let folder = path.basename(normalized);

    const lower = folder.toLowerCase();
    if (lower.includes('capitulo')) {
      folder = folder.substring(lower.lastIndexOf('capitulo') + 8);
    } else if (lower.includes('capítulo')) {
      folder = folder.substring(lower.lastIndexOf('capítulo') + 8);
    }

    const parsed = parseFloat(folder.trim());
    return isNaN(parsed) ? -1 : parsed;
  }

  public static getFolderFromPath(filePath: string): string {
    if (!filePath) return '';
    const dir = path.dirname(filePath);
    return dir === '.' ? '' : dir;
  }

  public static getNormalizedNameOrdering(filePath: string): string {
    const name = Util.getNameWithoutExtensionFromPath(filePath);
    const match = name.match(/(\d+|\d+\w|\d+\.\d+|[\(\{\[]\d+[\)\}\]])$/);
    if (!match) return Util.getNameFromPath(filePath);

    const numbers = match[0];
    const padded = numbers.padStart(10, '0');
    const baseName = name.substring(0, name.lastIndexOf(numbers));
    const ext = Util.getExtensionFromPath(filePath);
    return `${baseName}${padded}${ext ? '.' + ext : ''}`;
  }
}

export class FileUtil {
  public static isXml(filename: string): boolean {
    return /\.xml$/i.test(filename);
  }

  public static isJson(filename: string): boolean {
    return /\.json$/i.test(filename);
  }

  public static isImage(filename: string): boolean {
    return /\.(jpg|jpeg|bmp|gif|png|webp|avif|heic|heif|jxl|tiff|tif|pcx|jpf|jp2|j2k|jpx|pbm|pgm|ppm|pnm|iff)$/i.test(filename);
  }

  public static isHtml(filename: string): boolean {
    return /\.(html|xhtml)$/i.test(filename);
  }

  public static getFileType(filename: string): FileType {
    const ext = Util.getExtensionFromPath(filename).toLowerCase();
    switch (ext) {
      case 'cbz':
      case 'cbr':
      case 'cb7':
      case 'cbt':
      case 'rar':
      case 'zip':
      case '7z':
      case 'tar':
        return FileType.ZIP;
      case 'pdf':
        return FileType.PDF;
      case 'epub':
        return FileType.EPUB;
      case 'mobi':
        return FileType.MOBI;
      case 'txt':
        return FileType.TXT;
      default:
        if (FileUtil.isImage(filename)) return FileType.IMAGE;
        return FileType.UNKNOWN;
    }
  }

  public static formatSize(size: number): string {
    if (size < 1024) return `${size} B`;
    const i = Math.floor(Math.log(size) / Math.log(1024));
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    return `${(size / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }
}
