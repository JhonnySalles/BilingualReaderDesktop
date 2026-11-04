import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFileSync } from 'child_process';
import { BookMetadataResult } from './epub-book-extractor';
import { calibreCandidatePaths, findExecutable } from '../../services/ebook-convert/cli-utils';

export class CalibreMetaExtractor {
  private static cachedBin: string | null | undefined;

  public static getBinaryPath(): string | null {
    if (this.cachedBin !== undefined) return this.cachedBin;
    const metaCandidates = calibreCandidatePaths().map(p => {
      const dir = path.dirname(p);
      return path.join(dir, process.platform === 'win32' ? 'ebook-meta.exe' : 'ebook-meta');
    });
    this.cachedBin = findExecutable('ebook-meta', metaCandidates);
    return this.cachedBin;
  }

  public static isAvailable(): boolean {
    return !!this.getBinaryPath();
  }

  /**
   * Tenta primeiro obter metadados e capa locais (se a pasta for organizada pelo Calibre com metadata.opf e cover.jpg).
   * Caso contrário, se o executável ebook-meta estiver disponível, extrai capa e metadados via CLI.
   */
  public static extractMetadata(filePath: string, skipCli: boolean = false): BookMetadataResult | null {
    const ext = path.extname(filePath).toLowerCase();
    const fallbackTitle = path.basename(filePath, ext);
    const parentDir = path.dirname(filePath);

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

    // 1. Verificação de metadados e capa locais (pasta do Calibre)
    const localCoverPath = ['cover.jpg', 'cover.jpeg', 'cover.png']
      .map(name => path.join(parentDir, name))
      .find(p => fs.existsSync(p));

    if (localCoverPath) {
      try {
        coverImage = fs.readFileSync(localCoverPath);
      } catch {
        /* ignore */
      }
    }

    const localOpfPath = path.join(parentDir, 'metadata.opf');
    if (fs.existsSync(localOpfPath)) {
      try {
        const opf = fs.readFileSync(localOpfPath, 'utf-8');
        const tm = opf.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
        const opfTitle = tm?.[1]?.trim() || '';
        
        // Só aceita o metadata.opf local se for relevante para este arquivo específico
        const cleanOpf = opfTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanFile = fallbackTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanDir = path.basename(parentDir).toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchesBook = cleanOpf && (cleanFile.includes(cleanOpf) || cleanOpf.includes(cleanFile) || cleanDir.includes(cleanOpf));

        if (matchesBook) {
          if (opfTitle) title = opfTitle;

          const authors: string[] = [];
          const ams = opf.matchAll(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/gi);
          for (const m of ams) {
            const a = m[1].trim();
            if (a && !authors.includes(a)) authors.push(a);
          }
          if (authors.length > 0) author = authors.join(', ');

          const pm = opf.match(/<dc:publisher[^>]*>([^<]+)<\/dc:publisher>/i);
          if (pm?.[1]?.trim()) publisher = pm[1].trim();

          const sm = opf.match(/<meta[^>]*name=["']calibre:series["'][^>]*content=["']([^"']+)["']/i);
          if (sm?.[1]?.trim()) series = sm[1].trim();

          const dm = opf.match(/<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i);
          if (dm?.[1]?.trim()) annotation = dm[1].replace(/<[^>]+>/g, ' ').trim();

          const im = opf.match(/<dc:identifier[^>]*opf:scheme=["']ISBN["'][^>]*>([^<]+)<\/dc:identifier>/i);
          if (im?.[1]?.trim()) isbn = im[1].trim();
        }
      } catch {
        /* ignore */
      }
    }

    // Se já encontramos a capa e o título localmente, retorna de imediato
    if (coverImage && title) {
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

    // 2. Extração via ebook-meta CLI
    const bin = this.getBinaryPath();
    if (skipCli || !bin) {
      if (title || coverImage) {
        return {
          title: title || fallbackTitle,
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
      return null;
    }

    const tmpCover = path.join(os.tmpdir(), `ebk_cover_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);

    try {
      const stdout = execFileSync(bin, [filePath, `--get-cover=${tmpCover}`], {
        encoding: 'utf-8',
        timeout: 10000,
        windowsHide: true
      });

      if (fs.existsSync(tmpCover) && fs.statSync(tmpCover).size > 0) {
        coverImage = fs.readFileSync(tmpCover);
      }

      // Parse da saída padrão do ebook-meta
      const lines = stdout.split(/\r?\n/);
      let readingComments = false;
      const commentsLines: string[] = [];

      for (const line of lines) {
        // Checar se começou outra tag conhecida
        const isNewHeader = /^[A-Z][a-zA-Z\s\(\)]+\s*:\s*/.test(line);
        if (isNewHeader) {
          readingComments = false;
        }

        if (readingComments) {
          commentsLines.push(line);
          continue;
        }

        const titleMatch = line.match(/^Title\s*:\s*(.+)$/i);
        if (titleMatch && !title) title = titleMatch[1].trim();

        const authorMatch = line.match(/^Author\(s\)\s*:\s*([^\[]+)/i);
        if (authorMatch && !author) {
          const rawA = authorMatch[1].replace(/&/g, ',').trim();
          if (rawA && !/^(?:desconhecido|unknown)$/i.test(rawA)) {
            author = rawA;
          }
        }

        const pubMatch = line.match(/^Publisher\s*:\s*(.+)$/i);
        if (pubMatch && !publisher) publisher = pubMatch[1].trim();

        const seriesMatch = line.match(/^Series\s*:\s*(.+)$/i);
        if (seriesMatch && !series) {
          series = seriesMatch[1].replace(/\s*#\d+(?:\.\d+)?$/, '').trim();
        }

        const tagsMatch = line.match(/^Tags\s*:\s*(.+)$/i);
        if (tagsMatch && !tags) {
          tags = tagsMatch[1].trim();
          if (!genre) genre = tags;
        }

        const langMatch = line.match(/^Languages\s*:\s*(.+)$/i);
        if (langMatch && !language) language = langMatch[1].trim();

        const isbnMatch = line.match(/isbn[:=]\s*(\d[\d\-]+)/i);
        if (isbnMatch && !isbn) isbn = isbnMatch[1].trim();

        const commentsMatch = line.match(/^Comments\s*:\s*(.*)$/i);
        if (commentsMatch) {
          readingComments = true;
          if (commentsMatch[1]?.trim()) {
            commentsLines.push(commentsMatch[1].trim());
          }
        }
      }

      if (commentsLines.length > 0 && !annotation) {
        annotation = commentsLines.join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    } catch (e) {
      console.warn('[CalibreMetaExtractor] Execution warning for:', filePath, e);
    } finally {
      if (fs.existsSync(tmpCover)) {
        try {
          fs.unlinkSync(tmpCover);
        } catch {
          /* ignore */
        }
      }
    }

    if (!title && !coverImage) {
      return null;
    }

    return {
      title: title || fallbackTitle,
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
}
