import * as fs from 'fs';
import * as path from 'path';
import { BookMetadataResult } from './epub-book-extractor';

export class RocketBookExtractor {
  public static extractMetadata(filePath: string): BookMetadataResult {
    const ext = path.extname(filePath).toLowerCase();
    const fallbackTitle = path.basename(filePath, ext);

    let title = '';
    let author = '';
    let coverImage: Buffer | null = null;

    try {
      const buf = fs.readFileSync(filePath);
      if (buf.length >= 32) {
        // Verifica magic NUVO (offset 6)
        if (buf.slice(6, 10).toString('ascii') === 'NUVO') {
          const tocOffset = buf.readUInt32LE(24);
          if (tocOffset + 4 <= buf.length) {
            const count = buf.readUInt32LE(tocOffset);
            let p = tocOffset + 4;

            interface RbItem {
              name: string;
              size: number;
              offset: number;
              flags: number;
            }
            const items: RbItem[] = [];

            for (let i = 0; i < count && p + 44 <= buf.length; i++) {
              const nameBytes = buf.slice(p, p + 32);
              let len = 0;
              while (len < 32 && nameBytes[len] !== 0) len++;
              const name = nameBytes.slice(0, len).toString('utf-8').trim();
              const size = buf.readUInt32LE(p + 32);
              const offset = buf.readUInt32LE(p + 36);
              const flags = buf.readUInt32LE(p + 40);
              p += 44;
              items.push({ name, size, offset, flags });
            }

            // Lê info.info
            const infoItem = items.find(it => it.flags === 2 || it.name.toLowerCase() === 'info.info');
            if (infoItem && infoItem.offset + infoItem.size <= buf.length) {
              const infoText = buf.slice(infoItem.offset, infoItem.offset + infoItem.size).toString('utf-8');
              const lines = infoText.split(/\r?\n/);
              for (const line of lines) {
                const trimmed = line.trim();
                if (/^TITLE=/i.test(trimmed)) {
                  title = trimmed.replace(/^TITLE=/i, '').trim();
                } else if (/^AUTHOR=/i.test(trimmed)) {
                  author = trimmed.replace(/^AUTHOR=/i, '').trim();
                }
              }
            }

            // Procura imagem de capa
            const imgItem = items.find(it => {
              const n = it.name.toLowerCase();
              return n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg');
            });

            if (imgItem && imgItem.offset + imgItem.size <= buf.length) {
              coverImage = buf.slice(imgItem.offset, imgItem.offset + imgItem.size);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[RocketBookExtractor] Failed to extract metadata:', filePath, e);
    }

    if (!title) title = fallbackTitle;

    return {
      title,
      author,
      series: '',
      genre: '',
      publisher: '',
      language: '',
      isbn: '',
      annotation: '',
      tags: '',
      coverImage
    };
  }
}
