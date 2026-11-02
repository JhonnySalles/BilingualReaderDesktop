import * as path from 'path';
import { EpubBookExtractor, BookMetadataResult } from './epub-book-extractor';
import { MobiBookExtractor } from './mobi-book-extractor';
import { Fb2BookExtractor } from './fb2-book-extractor';
import { DocxBookExtractor } from './docx-book-extractor';
import { ArchiveBookExtractor } from './archive-book-extractor';
import { RocketBookExtractor } from './rocket-book-extractor';
import { CalibreMetaExtractor } from './calibre-meta-extractor';
import { CoverGenerator } from './cover-generator';

export { BookMetadataResult } from './epub-book-extractor';

export class BookExtractorFactory {
  public static getMetadata(filePath: string): BookMetadataResult {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath, ext);
    let meta: BookMetadataResult | null = null;

    // 1. Tenta extratores nativos específicos por formato
    switch (ext) {
      case '.epub':
      case '.kepub':
      case '.epub3':
        meta = EpubBookExtractor.extractMetadata(filePath);
        break;
      case '.mobi':
      case '.azw':
      case '.azw3':
      case '.azw4':
      case '.prc':
        meta = MobiBookExtractor.extractMetadata(filePath);
        break;
      case '.fb2':
        meta = Fb2BookExtractor.extractMetadata(filePath);
        break;
      case '.docx':
        meta = DocxBookExtractor.extractMetadata(filePath);
        break;
      case '.htmlz':
      case '.txtz':
        meta = ArchiveBookExtractor.extractMetadata(filePath);
        break;
      case '.rb':
        meta = RocketBookExtractor.extractMetadata(filePath);
        break;
      case '.pdf':
      case '.lit':
      case '.lrf':
      case '.snb':
        meta = CalibreMetaExtractor.extractMetadata(filePath);
        break;
    }

    // 2. Se não extraiu ou faltou capa, tenta o CalibreMetaExtractor (pasta do Calibre ou CLI)
    // Para formatos comprovadamente de texto puro (.txt, .pdb, .tcr), não executa CLI demorado se não houver capa local
    const isTextOnly = ext === '.txt' || ext === '.pdb' || ext === '.tcr';
    if (!meta || !meta.coverImage) {
      const calibreMeta = CalibreMetaExtractor.extractMetadata(filePath, isTextOnly);
      if (calibreMeta) {
        if (!meta) {
          meta = calibreMeta;
        } else {
          if (!meta.coverImage && calibreMeta.coverImage) {
            meta.coverImage = calibreMeta.coverImage;
          }
          if (!meta.author && calibreMeta.author) meta.author = calibreMeta.author;
          if (!meta.series && calibreMeta.series) meta.series = calibreMeta.series;
          if (!meta.annotation && calibreMeta.annotation) meta.annotation = calibreMeta.annotation;
          if (!meta.genre && calibreMeta.genre) meta.genre = calibreMeta.genre;
          if (!meta.isbn && calibreMeta.isbn) meta.isbn = calibreMeta.isbn;
        }
      }
    }

    // 3. Fallback de título e autor pelo nome do arquivo
    let title = meta?.title?.trim() || fileName;
    let author = meta?.author?.trim() || '';
    if (!author && fileName.includes(' - ')) {
      const parts = fileName.split(' - ');
      title = parts[0].trim();
      author = parts[1].trim();
    }

    // 4. Se ainda assim não houver imagem de capa (formatos de texto puro: .txt, .pdb, .tcr), gera a capa visual estilizada!
    let coverImage = meta?.coverImage || null;
    if (!coverImage) {
      coverImage = CoverGenerator.generateSvgCover(title, author, ext);
    }

    return {
      title,
      author,
      series: meta?.series || '',
      genre: meta?.genre || '',
      publisher: meta?.publisher || '',
      language: meta?.language || '',
      isbn: meta?.isbn || '',
      annotation: meta?.annotation || '',
      tags: meta?.tags || '',
      coverImage
    };
  }
}
