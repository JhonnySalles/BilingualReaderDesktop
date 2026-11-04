import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { spawnSync } from 'child_process';
import { BookMetadataResult } from './epub-book-extractor';

const SNB_MAGIC = 'SNBP000B';

export class SnbBookExtractor {
  public static extractMetadata(filePath: string): BookMetadataResult {
    const ext = path.extname(filePath).toLowerCase();
    const fallbackTitle = path.basename(filePath, ext);

    let title = fallbackTitle;
    let author = '';
    let series = '';
    let genre = '';
    let publisher = '';
    let language = '';
    let isbn = '';
    let annotation = '';
    let tags = '';
    let coverImage: Buffer | null = null;

    try {
      const buf = fs.readFileSync(filePath);
      if (buf.length < 44) {
        return this.createResult({ title, author, series, genre, publisher, language, isbn, annotation, tags, coverImage });
      }

      const magic = buf.slice(0, 8).toString('ascii');
      if (magic !== SNB_MAGIC) {
        return this.createResult({ title, author, series, genre, publisher, language, isbn, annotation, tags, coverImage });
      }

      const fileCount = buf.readInt32BE(20);
      const vfatCompressed = buf.readInt32BE(28);
      const binStreamSize = buf.readInt32BE(32);
      const plainStreamSizeUncompressed = buf.readInt32BE(36);

      if (fileCount <= 0 || vfatCompressed <= 0 || buf.length < 44 + vfatCompressed) {
        return this.createResult({ title, author, series, genre, publisher, language, isbn, annotation, tags, coverImage });
      }

      // Descompacta a tabela VFAT usando zlib nativo
      const vfatCompData = buf.slice(44, 44 + vfatCompressed);
      const vfat = zlib.inflateSync(vfatCompData);

      const tableSize = fileCount * 12;
      if (vfat.length > tableSize) {
        const fileNamesTable = vfat.slice(tableSize);
        const fileNames = fileNamesTable.toString('utf8').split('\u0000');

        let binPos = 0;
        let candidateCover: Buffer | null = null;

        for (let i = 0; i < fileCount; i++) {
          const attr = vfat.readInt32BE(i * 12);
          const fileSize = vfat.readInt32BE(i * 12 + 8);
          const name = (fileNames[i] || '').trim();

          // Arquivos de imagem / binários no SNB
          if ((attr & 0x01000000) === 0x01000000) {
            const absPos = 44 + vfatCompressed + binPos;
            if (absPos + fileSize <= buf.length) {
              const lowerName = name.toLowerCase();
              const isImage =
                lowerName.endsWith('.jpg') ||
                lowerName.endsWith('.jpeg') ||
                lowerName.endsWith('.png') ||
                lowerName.endsWith('.webp');

              if (lowerName.includes('cover') && isImage) {
                // Prioridade máxima para imagem com 'cover' no nome
                coverImage = buf.slice(absPos, absPos + fileSize);
                break;
              } else if (!candidateCover && isImage) {
                candidateCover = buf.slice(absPos, absPos + fileSize);
              }
            }
            binPos += fileSize;
          }
        }

        if (!coverImage && candidateCover) {
          coverImage = candidateCover;
        }

        // Tentar descompactar e extrair metadados de snbf/book.snbf do plain stream
        const snbfMeta = this.extractSnbfMetadata(buf, fileNames, vfat, fileCount, binStreamSize, plainStreamSizeUncompressed);
        if (snbfMeta) {
          if (snbfMeta.title) title = snbfMeta.title;
          if (snbfMeta.author) author = snbfMeta.author;
          if (snbfMeta.publisher) publisher = snbfMeta.publisher;
          if (snbfMeta.language) language = snbfMeta.language;
          if (snbfMeta.annotation) annotation = snbfMeta.annotation;
        }
      }
    } catch (e) {
      console.warn('[SnbBookExtractor] Error extracting SNB metadata/cover from:', filePath, e);
    }

    return this.createResult({ title, author, series, genre, publisher, language, isbn, annotation, tags, coverImage });
  }

  private static extractSnbfMetadata(
    buf: Buffer,
    fileNames: string[],
    vfat: Buffer,
    fileCount: number,
    binStreamSize: number,
    plainStreamSizeUncompressed: number
  ): { title?: string; author?: string; publisher?: string; language?: string; annotation?: string } | null {
    try {
      if (buf.length < 16) return null;
      const tailSize = buf.readUInt32BE(buf.length - 16);
      const tailOffset = buf.readUInt32BE(buf.length - 12);
      if (tailOffset + tailSize > buf.length || tailSize <= 0) return null;

      const tailCompData = buf.slice(tailOffset, tailOffset + tailSize);
      const vTail = zlib.inflateSync(tailCompData);

      const binBlock = Math.floor((binStreamSize + 0x8000 - 1) / 0x8000);
      const plainBlock = Math.floor((plainStreamSizeUncompressed + 0x8000 - 1) / 0x8000);
      if (vTail.length < (binBlock + plainBlock) * 4) return null;

      const blockOffsets: number[] = [];
      for (let i = 0; i < binBlock + plainBlock; i++) {
        blockOffsets.push(vTail.readUInt32BE(i * 4));
      }

      // Procurar offset de snbf/book.snbf na tabela VFAT
      let targetFileOffset = -1;
      let targetFileSize = 0;
      let plainAcc = 0;
      for (let i = 0; i < fileCount; i++) {
        const attr = vfat.readInt32BE(i * 12);
        const fSize = vfat.readInt32BE(i * 12 + 8);
        const name = fileNames[i] || '';

        if ((attr & 0x41000000) === 0x41000000) {
          if (name === 'snbf/book.snbf') {
            targetFileOffset = plainAcc;
            targetFileSize = fSize;
            break;
          }
          plainAcc += fSize;
        }
      }

      if (targetFileOffset < 0 || targetFileSize <= 0) return null;

      // Descompactar os blocos necessários usando 7za
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sevenZip = require('7zip-bin');
      const sevenZipPath = sevenZip?.path7za;
      if (!sevenZipPath || !fs.existsSync(sevenZipPath)) return null;

      const uncompressedChunks: Buffer[] = [];
      let totalUncompressed = 0;
      for (let i = 0; i < plainBlock; i++) {
        const curOff = blockOffsets[binBlock + i];
        const bSize = i < plainBlock - 1 ? blockOffsets[binBlock + i + 1] - curOff : tailOffset - curOff;
        const blockBytes = buf.slice(curOff, curOff + bSize);

        if (bSize < 32768) {
          const res = spawnSync(sevenZipPath, ['e', '-si', '-so', '-tbzip2'], {
            input: blockBytes,
            maxBuffer: 5 * 1024 * 1024,
            windowsHide: true
          });
          if (res.stdout && res.stdout.length > 0) {
            uncompressedChunks.push(res.stdout);
            totalUncompressed += res.stdout.length;
          } else {
            uncompressedChunks.push(blockBytes);
            totalUncompressed += blockBytes.length;
          }
        } else {
          uncompressedChunks.push(blockBytes);
          totalUncompressed += blockBytes.length;
        }

        // Se já descompactamos o suficiente para cobrir o arquivo alvo, podemos parar!
        if (totalUncompressed >= targetFileOffset + targetFileSize) {
          break;
        }
      }

      const fullPlain = Buffer.concat(uncompressedChunks);
      if (fullPlain.length < targetFileOffset + targetFileSize) return null;

      const xml = fullPlain.slice(targetFileOffset, targetFileOffset + targetFileSize).toString('utf8');
      const nameMatch = xml.match(/<name[^>]*>([^<]+)<\/name>/i);
      const authorMatch = xml.match(/<author[^>]*>([^<]+)<\/author>/i);
      const pubMatch = xml.match(/<publisher[^>]*>([^<]+)<\/publisher>/i);
      const langMatch = xml.match(/<language[^>]*>([^<]+)<\/language>/i);
      const absMatch = xml.match(/<abstract[^>]*>([\s\S]*?)<\/abstract>/i);

      return {
        title: nameMatch?.[1]?.trim(),
        author: authorMatch?.[1]?.trim(),
        publisher: pubMatch?.[1]?.trim(),
        language: langMatch?.[1]?.trim(),
        annotation: absMatch?.[1]?.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim()
      };
    } catch {
      return null;
    }
  }

  private static createResult(data: {
    title: string;
    author: string;
    series: string;
    genre: string;
    publisher: string;
    language: string;
    isbn: string;
    annotation: string;
    tags: string;
    coverImage: Buffer | null;
  }): BookMetadataResult {
    return data;
  }
}
