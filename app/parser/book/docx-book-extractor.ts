import * as path from 'path';
import AdmZip from 'adm-zip';
import { BookMetadataResult } from './epub-book-extractor';

export class DocxBookExtractor {
  public static extractMetadata(filePath: string): BookMetadataResult {
    const ext = path.extname(filePath).toLowerCase();
    const fallbackTitle = path.basename(filePath, ext);

    let title = '';
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
      const zip = new AdmZip(filePath);

      // Metadados em docProps/core.xml
      const coreEntry = zip.getEntry('docProps/core.xml');
      if (coreEntry) {
        const xml = coreEntry.getData().toString('utf-8');
        const titleMatch = xml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
        if (titleMatch?.[1]?.trim()) {
          title = this.decodeXml(titleMatch[1].trim());
        }
        const authorMatch = xml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
        if (authorMatch?.[1]?.trim()) {
          author = this.decodeXml(authorMatch[1].trim()).replace(/\s*&\s*/g, ', ');
        }
        const kwMatch = xml.match(/<(?:cp:keywords|dc:subject)[^>]*>([^<]+)<\/(?:cp:keywords|dc:subject)>/i);
        if (kwMatch?.[1]?.trim()) {
          tags = this.decodeXml(kwMatch[1].trim());
          genre = tags.split(/[,;]/)[0]?.trim() || '';
        }
        const descMatch = xml.match(/<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i);
        if (descMatch?.[1]?.trim()) {
          annotation = this.decodeXml(descMatch[1].replace(/<[^>]+>/g, ' ').trim());
        }
        const langMatch = xml.match(/<dc:language[^>]*>([^<]+)<\/dc:language>/i);
        if (langMatch?.[1]?.trim()) {
          language = this.decodeXml(langMatch[1].trim());
        }
      }

      // Editora em docProps/app.xml (Calibre grava na tag <Company>)
      const appEntry = zip.getEntry('docProps/app.xml');
      if (appEntry) {
        const appXml = appEntry.getData().toString('utf-8');
        const compMatch = appXml.match(/<Company[^>]*>([^<]+)<\/Company>/i);
        if (compMatch?.[1]?.trim()) {
          publisher = this.decodeXml(compMatch[1].trim());
        }
      }

      // Imagem de capa em word/media/
      const entries = zip.getEntries();
      const imageEntries = entries.filter(
        e =>
          !e.isDirectory &&
          e.entryName.toLowerCase().startsWith('word/media/') &&
          /\.(jpe?g|png|webp|gif)$/i.test(e.entryName)
      );

      if (imageEntries.length > 0) {
        // 1. Prioridade: arquivo com 'cover' explícito no nome (ex: cover.jpeg, cover.png)
        const coverEntry = imageEntries.find(e =>
          path.basename(e.entryName).toLowerCase().includes('cover')
        );

        if (coverEntry) {
          coverImage = coverEntry.getData();
        } else {
          // 2. Prioridade: primeira imagem referenciada sequencialmente no fluxo do documento (document.xml + rels)
          let firstEmbeddedTarget: string | null = null;
          try {
            const relsEntry = zip.getEntry('word/_rels/document.xml.rels');
            const docEntry = zip.getEntry('word/document.xml');
            if (relsEntry && docEntry) {
              const relsXml = relsEntry.getData().toString('utf-8');
              const docXml = docEntry.getData().toString('utf-8');

              const relMap: Record<string, string> = {};
              const relRegex = /Id="([^"]+)"[^>]*Target="([^"]+)"/g;
              let rMatch: RegExpExecArray | null;
              while ((rMatch = relRegex.exec(relsXml)) !== null) {
                if (rMatch[2].includes('media/')) {
                  relMap[rMatch[1]] = rMatch[2];
                }
              }

              const blipRegex = /r:embed="([^"]+)"/g;
              let bMatch: RegExpExecArray | null;
              while ((bMatch = blipRegex.exec(docXml)) !== null) {
                const target = relMap[bMatch[1]];
                if (target) {
                  firstEmbeddedTarget = target;
                  break;
                }
              }
            }
          } catch {
            /* ignore rels parse errors */
          }

          if (firstEmbeddedTarget) {
            const normTarget = firstEmbeddedTarget.replace(/^(\.\.\/)+/, '').replace(/^\//, '');
            const targetEntry = imageEntries.find(e =>
              e.entryName.toLowerCase().endsWith(normTarget.toLowerCase())
            );
            if (targetEntry) {
              coverImage = targetEntry.getData();
            }
          }

          // 3. Fallback: primeira imagem ordenada
          if (!coverImage) {
            imageEntries.sort((a, b) =>
              a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: 'base' })
            );
            coverImage = imageEntries[0].getData();
          }
        }
      }
    } catch (e) {
      console.warn('[DocxBookExtractor] Failed to extract metadata:', filePath, e);
    }

    if (!title) title = fallbackTitle;

    return {
      title,
      author,
      series,
      genre,
      publisher,
      language,
      isbn,
      annotation,
      tags,
      coverImage
    };
  }

  private static decodeXml(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
  }
}
