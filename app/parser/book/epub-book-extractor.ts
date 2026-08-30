import AdmZip from 'adm-zip';
import * as path from 'path';

export interface BookMetadataResult {
  title: string;
  author: string;
  series: string;
  genre: string;
  publisher: string;
  language: string;
  coverImage: Buffer | null;
}

export class EpubBookExtractor {
  public static extractMetadata(filePath: string): BookMetadataResult {
    let title = '';
    let author = '';
    let series = '';
    let genre = '';
    let publisher = '';
    let language = '';
    let coverImage: Buffer | null = null;

    try {
      const zip = new AdmZip(filePath);
      const containerEntry = zip.getEntry('META-INF/container.xml');

      let opfPath = '';
      if (containerEntry) {
        const containerXml = zip.readAsText(containerEntry);
        const rootfileMatch = containerXml.match(/full-path=["']([^"']+)["']/i);
        if (rootfileMatch) {
          opfPath = rootfileMatch[1];
        }
      }

      if (!opfPath) {
        // Fallback: search for any .opf file in the zip
        const opfEntries = zip.getEntries().filter(e => e.entryName.endsWith('.opf'));
        if (opfEntries.length > 0) {
          opfPath = opfEntries[0].entryName;
        }
      }

      if (opfPath) {
        const opfEntry = zip.getEntry(opfPath);
        if (opfEntry) {
          const opfXml = zip.readAsText(opfEntry);

          const titleMatch = opfXml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
          if (titleMatch) title = this.cleanXmlText(titleMatch[1]);

          const creatorMatch = opfXml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
          if (creatorMatch) author = this.cleanXmlText(creatorMatch[1]);

          const publisherMatch = opfXml.match(/<dc:publisher[^>]*>([\s\S]*?)<\/dc:publisher>/i);
          if (publisherMatch) publisher = this.cleanXmlText(publisherMatch[1]);

          const langMatch = opfXml.match(/<dc:language[^>]*>([\s\S]*?)<\/dc:language>/i);
          if (langMatch) language = this.cleanXmlText(langMatch[1]);

          const subjectMatch = opfXml.match(/<dc:subject[^>]*>([\s\S]*?)<\/dc:subject>/i);
          if (subjectMatch) genre = this.cleanXmlText(subjectMatch[1]);

          // Extract Cover Image
          const coverMetaMatch = opfXml.match(/<meta[^>]*name=["']cover["'][^>]*content=["']([^"']+)["']/i) ||
                                 opfXml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']cover["']/i);
          let coverItemId = coverMetaMatch ? coverMetaMatch[1] : '';

          let coverHref = '';
          if (coverItemId) {
            const itemMatch = opfXml.match(new RegExp(`<item[^>]*id=["']${coverItemId}["'][^>]*href=["']([^"']+)["']`, 'i')) ||
                              opfXml.match(new RegExp(`<item[^>]*href=["']([^"']+)["'][^>]*id=["']${coverItemId}["']`, 'i'));
            if (itemMatch) {
              coverHref = itemMatch[1];
            }
          }

          if (!coverHref) {
            // Fallback: look for item with media-type image and 'cover' in id or href
            const coverItemMatch = opfXml.match(/<item[^>]*href=["']([^"']*(?:cover|cover-image)[^"']*)["'][^>]*media-type=["']image\/[^"']+["']/i) ||
                                   opfXml.match(/<item[^>]*media-type=["']image\/[^"']+["'][^>]*href=["']([^"']*(?:cover|cover-image)[^"']*)["']/i);
            if (coverItemMatch) {
              coverHref = coverItemMatch[1];
            }
          }

          if (coverHref) {
            const opfDir = path.dirname(opfPath);
            const fullCoverPath = opfDir === '.' ? coverHref : path.posix.join(opfDir.replace(/\\/g, '/'), coverHref);
            const coverEntry = zip.getEntry(fullCoverPath) || zip.getEntry(coverHref);
            if (coverEntry) {
              coverImage = zip.readFile(coverEntry);
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Error reading EPUB metadata for ${filePath}:`, e);
    }

    return {
      title,
      author,
      series,
      genre,
      publisher,
      language,
      coverImage
    };
  }

  private static cleanXmlText(text: string): string {
    return text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
  }
}
