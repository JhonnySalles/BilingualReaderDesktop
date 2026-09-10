import * as fs from 'fs';
import * as path from 'path';
import { ParseUtil } from './parse-util';

export interface ArchiveFileItem {
  name: string;
  /** Absolute path on disk after extract, or empty if data is in memory. */
  diskPath?: string;
  fileData?: Buffer;
}

export function collectArchiveItemsFromDir(
  rootDir: string,
  relativePrefix = ''
): ArchiveFileItem[] {
  const items: ArchiveFileItem[] = [];
  if (!fs.existsSync(rootDir)) return items;

  const walk = (dir: string, prefix: string): void => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        walk(full, rel.replace(/\\/g, '/'));
      } else {
        items.push({ name: rel.replace(/\\/g, '/'), diskPath: full });
      }
    }
  };
  walk(rootDir, relativePrefix);
  return items;
}

export function classifyArchiveItems(items: ArchiveFileItem[]): {
  imageItems: ArchiveFileItem[];
  subtitles: ArchiveFileItem[];
  comicInfoItem: ArchiveFileItem | null;
  coverItems: (ArchiveFileItem | null)[];
} {
  const imageItems: ArchiveFileItem[] = [];
  const subtitles: ArchiveFileItem[] = [];
  let comicInfoItem: ArchiveFileItem | null = null;
  const coverItems: (ArchiveFileItem | null)[] = [null, null, null];

  for (const item of items) {
    const name = item.name;
    if (ParseUtil.isImage(name)) {
      imageItems.push(item);
      const fileName = ParseUtil.getNameFromPath(name);
      if (fileName.toLowerCase().includes('volume')) {
        const coverPart = fileName.toLowerCase().substring(fileName.toLowerCase().lastIndexOf('volume'));
        if (coverPart.includes('frente') || coverPart.includes('cover') || coverPart.includes('front')) {
          coverItems[0] = item;
        } else if (coverPart.includes('tras') || coverPart.includes('back')) {
          coverItems[1] = item;
        } else if (coverPart.includes('tudo') || coverPart.includes('all') || coverPart.includes('everything')) {
          coverItems[2] = item;
        }
      }
    } else if (ParseUtil.isJson(name)) {
      subtitles.push(item);
    } else if (ParseUtil.isXml(name) && name.toLowerCase().includes('comicinfo')) {
      comicInfoItem = item;
    }
  }

  imageItems.sort((a, b) => {
    const folderA = ParseUtil.getFolderFromPath(a.name);
    const folderB = ParseUtil.getFolderFromPath(b.name);
    if (folderA !== folderB) {
      return folderA.localeCompare(folderB);
    }
    return ParseUtil.naturalSort(a.name, b.name);
  });

  if (!coverItems[0] && imageItems.length > 0) {
    coverItems[0] = imageItems[0];
  }

  return { imageItems, subtitles, comicInfoItem, coverItems };
}

export function readArchiveItem(item: ArchiveFileItem): Buffer | null {
  if (item.fileData) return item.fileData;
  if (item.diskPath && fs.existsSync(item.diskPath)) {
    return fs.readFileSync(item.diskPath);
  }
  return null;
}

export function readArchiveItemText(item: ArchiveFileItem): string {
  const buf = readArchiveItem(item);
  return buf ? buf.toString('utf-8') : '';
}
