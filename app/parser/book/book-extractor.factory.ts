import * as path from 'path';
import { EpubBookExtractor, BookMetadataResult } from './epub-book-extractor';

export class BookExtractorFactory {
  public static getMetadata(filePath: string): BookMetadataResult {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.epub' || ext === '.kepub') {
      const meta = EpubBookExtractor.extractMetadata(filePath);
      if (!meta.title) {
        meta.title = path.basename(filePath, ext);
      }
      return meta;
    }

    // Default metadata inferred from file name
    const fileName = path.basename(filePath, ext);
    let title = fileName;
    let author = '';

    // Handle "Title - Author" format if present in filename
    if (fileName.includes(' - ')) {
      const parts = fileName.split(' - ');
      title = parts[0].trim();
      author = parts[1].trim();
    }

    return {
      title,
      author,
      series: '',
      genre: '',
      publisher: '',
      language: '',
      coverImage: null
    };
  }
}
