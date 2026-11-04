import * as fs from 'fs';
import * as path from 'path';
import { BookMetadataResult } from './epub-book-extractor';

export class Fb2BookExtractor {
  public static extractMetadata(filePath: string): BookMetadataResult {
    const ext = path.extname(filePath).toLowerCase();
    const fallbackTitle = path.basename(filePath, ext);

    let title = '';
    const authors: string[] = [];
    let series = '';
    let genre = '';
    let publisher = '';
    let language = '';
    let isbn = '';
    let annotation = '';
    let tags = '';
    let coverImage: Buffer | null = null;

    try {
      const raw = fs.readFileSync(filePath);
      let xml = raw.toString('utf-8');
      if (xml.charCodeAt(0) === 0xfeff) xml = xml.slice(1);
      if (raw[0] === 0xff && raw[1] === 0xfe) {
        xml = raw.toString('utf16le');
        if (xml.charCodeAt(0) === 0xfeff) xml = xml.slice(1);
      }

      // Título
      const titleMatch = xml.match(/<book-title\b[^>]*>([\s\S]*?)<\/book-title>/i);
      if (titleMatch) {
        title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
      }

      // Autores
      const authorMatches = xml.matchAll(/<author\b[^>]*>([\s\S]*?)<\/author>/gi);
      for (const am of authorMatches) {
        const fn = (am[1].match(/<first-name\b[^>]*>([\s\S]*?)<\/first-name>/i)?.[1] || '').trim();
        const ln = (am[1].match(/<last-name\b[^>]*>([\s\S]*?)<\/last-name>/i)?.[1] || '').trim();
        const nick = (am[1].match(/<nickname\b[^>]*>([\s\S]*?)<\/nickname>/i)?.[1] || '').trim();
        const full = [fn, ln].filter(Boolean).join(' ') || nick;
        if (full && !authors.includes(full)) {
          authors.push(full);
        }
      }

      // Gênero / Tags
      const genres: string[] = [];
      const genreMatches = xml.matchAll(/<genre\b[^>]*>([\s\S]*?)<\/genre>/gi);
      for (const gm of genreMatches) {
        const g = gm[1].replace(/<[^>]+>/g, '').trim();
        if (g && !genres.includes(g)) {
          genres.push(g);
        }
      }
      const keywordsMatch = xml.match(/<keywords\b[^>]*>([\s\S]*?)<\/keywords>/i);
      if (keywordsMatch) {
        const kws = keywordsMatch[1].replace(/<[^>]+>/g, '').split(/[,;]/).map(k => k.trim()).filter(Boolean);
        for (const kw of kws) {
          if (!genres.includes(kw)) genres.push(kw);
        }
      }
      if (genres.length > 0) {
        genre = genres[0];
        tags = genres.join(', ');
      }

      // Série
      const seqMatch = xml.match(/<sequence\b[^>]*name=["']([^"']+)["']/i);
      if (seqMatch?.[1]?.trim()) {
        series = seqMatch[1].trim();
      }

      // Editora
      const pubMatch = xml.match(/<publisher\b[^>]*>([\s\S]*?)<\/publisher>/i);
      if (pubMatch?.[1]?.trim()) {
        publisher = pubMatch[1].replace(/<[^>]+>/g, '').trim();
      }

      // Idioma
      const langMatch = xml.match(/<lang\b[^>]*>([\s\S]*?)<\/lang>/i);
      if (langMatch?.[1]?.trim()) {
        language = langMatch[1].replace(/<[^>]+>/g, '').trim();
      }

      // ISBN
      const isbnMatch = xml.match(/<isbn\b[^>]*>([\s\S]*?)<\/isbn>/i);
      if (isbnMatch?.[1]?.trim()) {
        isbn = isbnMatch[1].replace(/<[^>]+>/g, '').trim();
      }

      // Sinopse
      const annoMatch = xml.match(/<annotation\b[^>]*>([\s\S]*?)<\/annotation>/i);
      if (annoMatch) {
        annotation = annoMatch[1].replace(/<[^>]+>/g, ' ').trim();
      }

      // Capa
      const coverMatch = xml.match(/<coverpage\b[^>]*>[\s\S]*?<image\s+[^>]*(?:l:href|xlink:href)=["']#([^"']+)["']/i);
      const coverId = coverMatch ? coverMatch[1] : null;

      if (coverId) {
        const binRegex = new RegExp(`<binary\\b[^>]*id=["']${this.escapeRegex(coverId)}["'][^>]*>([\\s\\S]*?)<\\/binary>`, 'i');
        const binMatch = xml.match(binRegex);
        if (binMatch) {
          const b64 = binMatch[1].replace(/\s+/g, '');
          coverImage = Buffer.from(b64, 'base64');
        }
      }

      if (!coverImage) {
        const firstBin = xml.match(/<binary\b[^>]*content-type=["']image\/[^"']+["'][^>]*>([\s\S]*?)<\/binary>/i);
        if (firstBin) {
          const b64 = firstBin[1].replace(/\s+/g, '');
          coverImage = Buffer.from(b64, 'base64');
        }
      }
    } catch (e) {
      console.warn('[Fb2BookExtractor] Failed to extract metadata:', filePath, e);
    }

    if (!title) title = fallbackTitle;

    return {
      title,
      author: authors.join(', '),
      series,
      genre,
      publisher,
      language,
      isbn,
      annotation,
      tags: tags || genre,
      coverImage
    };
  }

  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
