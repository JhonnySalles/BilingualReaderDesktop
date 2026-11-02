import * as path from 'path';
import AdmZip from 'adm-zip';
import { BookMetadataResult } from './epub-book-extractor';

export class DocxBookExtractor {
  public static extractMetadata(filePath: string): BookMetadataResult {
    const ext = path.extname(filePath).toLowerCase();
    const fallbackTitle = path.basename(filePath, ext);

    let title = '';
    let author = '';
    let coverImage: Buffer | null = null;

    try {
      const zip = new AdmZip(filePath);

      // Metadados em docProps/core.xml
      const coreEntry = zip.getEntry('docProps/core.xml');
      if (coreEntry) {
        const xml = coreEntry.getData().toString('utf-8');
        const titleMatch = xml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
        if (titleMatch?.[1]?.trim()) {
          title = titleMatch[1].trim();
        }
        const authorMatch = xml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
        if (authorMatch?.[1]?.trim()) {
          author = authorMatch[1].trim();
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
        // Ordena para pegar a primeira imagem (ex: image1.jpeg)
        imageEntries.sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: 'base' }));
        coverImage = imageEntries[0].getData();
      }
    } catch (e) {
      console.warn('[DocxBookExtractor] Failed to extract metadata:', filePath, e);
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
