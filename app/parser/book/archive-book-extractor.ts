import * as path from 'path';
import AdmZip from 'adm-zip';
import { BookMetadataResult } from './epub-book-extractor';

export class ArchiveBookExtractor {
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
      const opfEntry = zip.getEntry('metadata.opf');

      if (opfEntry) {
        const opf = opfEntry.getData().toString('utf-8');

        // Título
        const titleMatch = opf.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
        if (titleMatch?.[1]?.trim()) {
          title = this.decodeXml(titleMatch[1].trim());
        }

        // Autor
        const authors: string[] = [];
        const authorMatches = opf.matchAll(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/gi);
        for (const am of authorMatches) {
          const a = this.decodeXml(am[1].trim());
          if (a && !authors.includes(a)) authors.push(a);
        }
        if (authors.length > 0) author = authors.join(', ');

        // Editora
        const pubMatch = opf.match(/<dc:publisher[^>]*>([^<]+)<\/dc:publisher>/i);
        if (pubMatch?.[1]?.trim()) publisher = this.decodeXml(pubMatch[1].trim());

        // Sinopse
        const descMatch = opf.match(/<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i);
        if (descMatch?.[1]?.trim()) {
          annotation = this.decodeXml(descMatch[1].replace(/<[^>]+>/g, ' ').trim());
        }

        // Série
        const seriesMatch = opf.match(/<meta[^>]*name=["']calibre:series["'][^>]*content=["']([^"']+)["']/i);
        if (seriesMatch?.[1]?.trim()) series = this.decodeXml(seriesMatch[1].trim());

        // Gênero / Tags
        const subjects: string[] = [];
        const subjectMatches = opf.matchAll(/<dc:subject[^>]*>([^<]+)<\/dc:subject>/gi);
        for (const sm of subjectMatches) {
          const s = this.decodeXml(sm[1].trim());
          if (s && !subjects.includes(s)) subjects.push(s);
        }
        if (subjects.length > 0) {
          tags = subjects.join(', ');
          genre = subjects[0];
        }

        // ISBN
        const isbnMatch = opf.match(/<dc:identifier[^>]*(?:opf:)?scheme=["']ISBN["'][^>]*>([^<]+)<\/dc:identifier>/i) ||
                          opf.match(/<dc:identifier[^>]*>(?:(?:urn:)?isbn:)\s*([0-9Xx-]{10,17})<\/dc:identifier>/i);
        if (isbnMatch?.[1]?.trim()) isbn = isbnMatch[1].trim();

        // Idioma
        const langMatch = opf.match(/<dc:language[^>]*>([^<]+)<\/dc:language>/i);
        if (langMatch?.[1]?.trim()) language = this.decodeXml(langMatch[1].trim());
      }

      // Extração da Capa
      const entries = zip.getEntries();
      // 1. Procura cover.jpg, cover.jpeg, cover.png
      const coverEntry = entries.find(
        e => !e.isDirectory && /^(?:images\/)?cover\.(jpe?g|png|webp)$/i.test(e.entryName)
      );

      if (coverEntry) {
        coverImage = coverEntry.getData();
      } else {
        // 2. Fallback: primeira imagem encontrada
        const firstImg = entries.find(
          e => !e.isDirectory && /\.(jpe?g|png|webp)$/i.test(e.entryName)
        );
        if (firstImg) {
          coverImage = firstImg.getData();
        }
      }
    } catch (e) {
      console.warn('[ArchiveBookExtractor] Failed to extract metadata:', filePath, e);
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
