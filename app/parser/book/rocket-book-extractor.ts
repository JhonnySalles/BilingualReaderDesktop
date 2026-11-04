import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { BookMetadataResult } from './epub-book-extractor';

interface RbItem {
  name: string;
  size: number;
  offset: number;
  flags: number;
}

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

            // Lê info.info e extrai metadados + nome do documento BODY
            let bodyName = 'index.html';
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
                } else if (/^BODY=/i.test(trimmed)) {
                  bodyName = trimmed.replace(/^BODY=/i, '').trim();
                }
              }
            }

            // Extração de Capa com estratégia Multi-Tier
            coverImage = this.extractCover(buf, items, bodyName);
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

  private static isImageExt(fileName: string): boolean {
    return /\.(png|jpe?g|webp|bmp)$/i.test(fileName);
  }

  private static extractCover(buf: Buffer, items: RbItem[], bodyName: string): Buffer | null {
    // Tier 1: Item explicitamente nomeado com 'cover'
    const coverNamedItem = items.find(it => this.isImageExt(it.name) && /cover/i.test(it.name));
    if (coverNamedItem && coverNamedItem.offset + coverNamedItem.size <= buf.length) {
      return buf.slice(coverNamedItem.offset, coverNamedItem.offset + coverNamedItem.size);
    }

    // Tier 2: Primeira tag <img> no documento BODY (normalmente index.html)
    const bodyItem = items.find(it => it.name.toLowerCase() === bodyName.toLowerCase())
      || items.find(it => it.name.toLowerCase().endsWith('.html') || it.name.toLowerCase().endsWith('.htm'));

    if (bodyItem && bodyItem.offset + bodyItem.size <= buf.length) {
      const bodyBuf = buf.slice(bodyItem.offset, bodyItem.offset + bodyItem.size);
      let htmlSnippet = '';

      if (bodyBuf.length >= 8) {
        try {
          const chunkCount = bodyBuf.readUInt32LE(0);
          if (chunkCount > 0 && chunkCount < 20000 && 8 + chunkCount * 4 <= bodyBuf.length) {
            let chunkOffset = 8 + chunkCount * 4;
            const maxChunksToScan = Math.min(chunkCount, 5);
            for (let i = 0; i < maxChunksToScan; i++) {
              const clen = bodyBuf.readUInt32LE(8 + i * 4);
              if (chunkOffset + clen <= bodyBuf.length) {
                const cdata = bodyBuf.slice(chunkOffset, chunkOffset + clen);
                try {
                  const decomp = zlib.inflateSync(cdata);
                  htmlSnippet += decomp.toString('utf-8') + '\n';
                  if (/<img[^>]+src=/i.test(htmlSnippet)) break;
                } catch {
                  try {
                    const decompRaw = zlib.inflateRawSync(cdata);
                    htmlSnippet += decompRaw.toString('utf-8') + '\n';
                    if (/<img[^>]+src=/i.test(htmlSnippet)) break;
                  } catch (_) {}
                }
                chunkOffset += clen;
              }
            }
          }
        } catch (e) {
          console.warn('[RocketBookExtractor] Error decoding body chunks:', e);
        }
      }

      if (!htmlSnippet) {
        // Fallback caso não seja comprimido em chunks
        htmlSnippet = bodyBuf.slice(0, 32768).toString('utf-8');
      }

      const imgMatches = htmlSnippet.matchAll(/<img[^>]+src=["']?([^"'>\s]+)/gi);
      for (const match of imgMatches) {
        const src = match[1];
        const cleanSrc = path.basename(src.replace(/[?#].*$/, ''));
        const foundItem = items.find(it => it.name.toLowerCase() === cleanSrc.toLowerCase());
        if (foundItem && foundItem.offset + foundItem.size <= buf.length) {
          return buf.slice(foundItem.offset, foundItem.offset + foundItem.size);
        }
      }
    }

    // Tier 3: Heurística de dimensão/proporção Retrato (h > w)
    const imageItems = items.filter(it => this.isImageExt(it.name) && it.offset + it.size <= buf.length);
    for (const it of imageItems) {
      const imgBuf = buf.slice(it.offset, it.offset + it.size);
      if (it.name.toLowerCase().endsWith('.png') && imgBuf.length >= 24) {
        const w = imgBuf.readUInt32BE(16);
        const h = imgBuf.readUInt32BE(20);
        if (h > w && h > 200) {
          return imgBuf;
        }
      }
    }

    // Tier 4: Fallback para a primeira imagem disponível
    if (imageItems.length > 0) {
      const first = imageItems[0];
      return buf.slice(first.offset, first.offset + first.size);
    }

    return null;
  }
}
