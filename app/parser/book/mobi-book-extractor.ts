import * as fs from 'fs';
import * as path from 'path';
import { BookMetadataResult } from './epub-book-extractor';

export class MobiBookExtractor {
  public static extractMetadata(filePath: string): BookMetadataResult {
    const ext = path.extname(filePath).toLowerCase();
    const fallbackTitle = path.basename(filePath, ext);

    let title = '';
    const authors: string[] = [];
    let publisher = '';
    let annotation = '';
    let genre = '';
    let isbn = '';
    let language = '';
    let coverImage: Buffer | null = null;

    try {
      const buf = fs.readFileSync(filePath);
      if (buf.length >= 78) {
        const numRecords = buf.readUInt16BE(76);
        const offsets: number[] = [];
        for (let i = 0; i < numRecords; i++) {
          offsets.push(buf.readUInt32BE(78 + i * 8));
        }

        if (offsets.length > 0) {
          const rec0Start = offsets[0];
          const rec0End = offsets[1] || buf.length;
          const rec0 = buf.slice(rec0Start, rec0End);

          if (rec0.length >= 92) {
            const fullNameOffset = rec0.readUInt32BE(84);
            const fullNameLength = rec0.readUInt32BE(88);
            if (fullNameOffset + fullNameLength <= rec0.length) {
              title = rec0.slice(fullNameOffset, fullNameOffset + fullNameLength).toString('utf-8').trim();
            }

            const firstImageIndex = rec0.length >= 112 ? rec0.readUInt32BE(108) : 0;
            const exthFlags = rec0.length >= 132 ? rec0.readUInt32BE(128) : 0;

            let coverOffset = -1;
            let thumbOffset = -1;

            if ((exthFlags & 0x40) !== 0) {
              const exthPos = rec0.indexOf(Buffer.from('EXTH'));
              if (exthPos !== -1 && exthPos + 12 <= rec0.length) {
                const exthLen = rec0.readUInt32BE(exthPos + 4);
                const exthCount = rec0.readUInt32BE(exthPos + 8);
                let p = exthPos + 12;
                const end = Math.min(exthPos + exthLen, rec0.length);

                for (let i = 0; i < exthCount && p + 8 <= end; i++) {
                  const tag = rec0.readUInt32BE(p);
                  const len = rec0.readUInt32BE(p + 4);
                  if (len < 8 || p + len > end) break;
                  const data = rec0.slice(p + 8, p + len);
                  p += len;

                  const text = data.toString('utf-8').trim();
                  if (tag === 100) {
                    if (text && !authors.includes(text)) authors.push(text);
                  } else if (tag === 101) {
                    publisher = text;
                  } else if (tag === 103) {
                    annotation = text;
                  } else if (tag === 104) {
                    isbn = text;
                  } else if (tag === 105) {
                    genre = text;
                  } else if (tag === 524) {
                    language = text;
                  } else if (tag === 503 && !title) {
                    title = text;
                  } else if (tag === 201 && data.length >= 4) {
                    coverOffset = data.readUInt32BE(0);
                  } else if (tag === 202 && data.length >= 4) {
                    thumbOffset = data.readUInt32BE(0);
                  }
                }
              }
            }

            // Identifica o índice do registro de capa
            let targetImgIndex = -1;
            if (coverOffset >= 0 && firstImageIndex + coverOffset < numRecords) {
              targetImgIndex = firstImageIndex + coverOffset;
            } else if (thumbOffset >= 0 && firstImageIndex + thumbOffset < numRecords) {
              targetImgIndex = firstImageIndex + thumbOffset;
            } else if (firstImageIndex > 0 && firstImageIndex < numRecords) {
              for (let i = firstImageIndex; i < numRecords; i++) {
                const s = offsets[i];
                const e = i < numRecords - 1 ? offsets[i + 1] : buf.length;
                if (e - s > 16) {
                  const m = buf.slice(s, s + 4);
                  if (m[0] === 0xff && m[1] === 0xd8) {
                    targetImgIndex = i;
                    break;
                  }
                  if (m[0] === 0x89 && m[1] === 0x50 && m[2] === 0x4e && m[3] === 0x47) {
                    targetImgIndex = i;
                    break;
                  }
                }
              }
            }

            if (targetImgIndex >= 0 && targetImgIndex < numRecords) {
              const s = offsets[targetImgIndex];
              const e = targetImgIndex < numRecords - 1 ? offsets[targetImgIndex + 1] : buf.length;
              coverImage = buf.slice(s, e);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[MobiBookExtractor] Failed to extract metadata:', filePath, e);
    }

    if (!title) title = fallbackTitle;

    return {
      title,
      author: authors.join(', '),
      series: '',
      genre,
      publisher,
      language,
      isbn,
      annotation,
      tags: genre,
      coverImage
    };
  }
}
