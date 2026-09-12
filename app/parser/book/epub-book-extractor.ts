import AdmZip from 'adm-zip';
import * as path from 'path';
import * as fs from 'fs';

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

          const coverHref = this.resolveCoverHref(opfXml);
          if (coverHref) {
            coverImage = this.readZipImage(zip, opfPath, coverHref);
          }
        }
      }

      // ZIP filename fallback (Kotlin-aligned): cover*.jpg/png when OPF resolution fails
      if (!coverImage) {
        coverImage = this.findCoverByZipFilename(zip);
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

  /** Escape a string for safe use inside a RegExp pattern. */
  private static escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Resolve cover image href from OPF:
   * 1) meta name=cover content → item id
   * 2) meta content → item properties (Yen Press: content="cover-image" but id differs)
   * 3) item with properties containing cover-image
   * 4) image item whose href contains cover / cover-image
   */
  private static resolveCoverHref(opfXml: string): string {
    const coverMetaMatch =
      opfXml.match(/<meta[^>]*name=["']cover["'][^>]*content=["']([^"']+)["']/i) ||
      opfXml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']cover["']/i);
    const coverRef = coverMetaMatch ? coverMetaMatch[1] : '';

    if (coverRef) {
      const escaped = this.escapeRegExp(coverRef);

      // Match item by id === meta content
      const byId =
        opfXml.match(new RegExp(`<item[^>]*id=["']${escaped}["'][^>]*href=["']([^"']+)["']`, 'i')) ||
        opfXml.match(new RegExp(`<item[^>]*href=["']([^"']+)["'][^>]*id=["']${escaped}["']`, 'i'));
      if (byId?.[1]) {
        return byId[1];
      }

      // Match item by properties === meta content (e.g. properties="cover-image")
      const byExactProp =
        opfXml.match(
          new RegExp(`<item[^>]*properties=["']${escaped}["'][^>]*href=["']([^"']+)["']`, 'i')
        ) ||
        opfXml.match(
          new RegExp(`<item[^>]*href=["']([^"']+)["'][^>]*properties=["']${escaped}["']`, 'i')
        );
      if (byExactProp?.[1]) {
        return byExactProp[1];
      }
    }

    // EPUB3: properties contains cover-image (may be space-separated with other props)
    const byCoverProp =
      opfXml.match(
        /<item[^>]*properties=["'][^"']*\bcover-image\b[^"']*["'][^>]*href=["']([^"']+)["']/i
      ) ||
      opfXml.match(
        /<item[^>]*href=["']([^"']+)["'][^>]*properties=["'][^"']*\bcover-image\b[^"']*["']/i
      );
    if (byCoverProp?.[1]) {
      return byCoverProp[1];
    }

    // Fallback: image item with 'cover' / 'cover-image' in href
    const byHref =
      opfXml.match(
        /<item[^>]*href=["']([^"']*(?:cover|cover-image)[^"']*)["'][^>]*media-type=["']image\/[^"']+["']/i
      ) ||
      opfXml.match(
        /<item[^>]*media-type=["']image\/[^"']+["'][^>]*href=["']([^"']*(?:cover|cover-image)[^"']*)["']/i
      );
    if (byHref?.[1]) {
      return byHref[1];
    }

    return '';
  }

  private static readZipImage(zip: AdmZip, opfPath: string, coverHref: string): Buffer | null {
    const decodedHref = (() => {
      try {
        return decodeURIComponent(coverHref);
      } catch {
        return coverHref;
      }
    })();

    const opfDir = path.dirname(opfPath).replace(/\\/g, '/');
    const fullCoverPath =
      opfDir === '.' ? decodedHref : path.posix.join(opfDir, decodedHref);

    let coverEntry = zip.getEntry(fullCoverPath) || zip.getEntry(decodedHref) || zip.getEntry(coverHref);
    if (!coverEntry) {
      const basename = decodedHref.includes('/')
        ? decodedHref.substring(decodedHref.lastIndexOf('/') + 1)
        : decodedHref;
      coverEntry =
        zip.getEntries().find(e => !e.isDirectory && e.entryName.includes(decodedHref)) ||
        zip.getEntries().find(e => !e.isDirectory && e.entryName.endsWith('/' + basename)) ||
        zip.getEntries().find(e => !e.isDirectory && e.entryName.endsWith(basename)) ||
        null;
    }

    if (coverEntry) {
      return zip.readFile(coverEntry);
    }
    return null;
  }

  /** Prefer basename starting with "cover", else any image basename containing "cover". */
  private static findCoverByZipFilename(zip: AdmZip): Buffer | null {
    const imageExt = /\.(jpe?g|png)$/i;
    let coverAux: Buffer | null = null;

    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const name = entry.entryName.replace(/\\/g, '/');
      const basename = name.includes('/') ? name.substring(name.lastIndexOf('/') + 1) : name;
      if (!imageExt.test(basename)) continue;

      const low = basename.toLowerCase();
      if (low.startsWith('cover')) {
        return zip.readFile(entry);
      }
      if (coverAux === null && low.includes('cover')) {
        coverAux = zip.readFile(entry);
      }
    }

    return coverAux;
  }

  private static cleanXmlText(text: string): string {
    return text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
  }

  /**
   * Count total words in an EPUB file (or in a specified spine/page range if applicable).
   */
  public static countWords(filePath: string, pageStart?: number, pageEnd?: number): number {
    try {
      if (!filePath || !fs.existsSync(filePath)) return 0;
      const zip = new AdmZip(filePath);

      let opfPath = '';
      const containerEntry = zip.getEntry('META-INF/container.xml');
      if (containerEntry) {
        const containerXml = zip.readAsText(containerEntry);
        const rootfileMatch = containerXml.match(/full-path=["']([^"']+)["']/i);
        if (rootfileMatch) {
          opfPath = rootfileMatch[1];
        }
      }

      if (!opfPath) {
        const opfEntries = zip.getEntries().filter(e => e.entryName.endsWith('.opf'));
        if (opfEntries.length > 0) opfPath = opfEntries[0].entryName;
      }

      const opfDir = opfPath ? path.dirname(opfPath).replace(/\\/g, '/') : '';
      let spineHrefs: string[] = [];

      if (opfPath) {
        const opfEntry = zip.getEntry(opfPath);
        if (opfEntry) {
          const opfXml = zip.readAsText(opfEntry);
          const manifestItems: Record<string, string> = {};
          const itemRegex = /<item\s+[^>]*id=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
          let match: RegExpExecArray | null;
          while ((match = itemRegex.exec(opfXml)) !== null) {
            manifestItems[match[1]] = match[2];
          }

          const spineRegex = /<itemref\s+[^>]*idref=["']([^"']+)["'][^>]*>/gi;
          while ((match = spineRegex.exec(opfXml)) !== null) {
            const idref = match[1];
            if (manifestItems[idref]) {
              const href = manifestItems[idref];
              const fullHref = opfDir && opfDir !== '.' ? path.posix.join(opfDir, href) : href;
              spineHrefs.push(fullHref);
            }
          }
        }
      }

      // Fallback: extract all html/xhtml entries in zip
      if (spineHrefs.length === 0) {
        spineHrefs = zip.getEntries()
          .filter(e => !e.isDirectory && /\.(x?html|xml|htm)$/i.test(e.entryName))
          .map(e => e.entryName);
      }

      if (spineHrefs.length === 0) return 0;

      // Filter by page/spine range if provided (1-based)
      if (pageStart != null && pageEnd != null && pageStart > 0 && pageEnd >= pageStart) {
        const startIdx = Math.max(0, pageStart - 1);
        const endIdx = Math.min(spineHrefs.length, pageEnd);
        spineHrefs = spineHrefs.slice(startIdx, endIdx);
      }

      let totalWords = 0;
      for (const href of spineHrefs) {
        const decodedHref = decodeURIComponent(href);
        const entry = zip.getEntry(decodedHref) || zip.getEntry(href);
        if (!entry) continue;

        const content = zip.readAsText(entry);
        // Remove style and script tags and their content
        const stripped = content
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
          .replace(/<rt\b[^<]*(?:(?!<\/rt>)<[^<]*)*<\/rt>/gi, ' ') // Furigana rt tags
          .replace(/<[^>]+>/g, ' ');

        const text = stripped
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .trim();

        if (!text) continue;

        // Check for CJK characters
        const cjkMatches = text.match(/[\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff]/g);
        if (cjkMatches && cjkMatches.length > text.length * 0.3) {
          // Primarily CJK: count characters
          totalWords += cjkMatches.length;
        } else {
          // Western text: count words
          const words = text.split(/\s+/).filter(w => w.length > 0);
          totalWords += words.length;
        }
      }

      return totalWords;
    } catch (e) {
      console.warn(`Error counting words in EPUB ${filePath}:`, e);
      return 0;
    }
  }
}
