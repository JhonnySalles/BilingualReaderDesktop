import { StorageService } from '../database/storage.service';
import { HistoryRow } from '../database/history.repository';
import { EpubBookExtractor } from '../parser/book/epub-book-extractor';

export interface RecalculateBatchOptions {
  type: 'MANGA' | 'BOOK';
  onlyNew: boolean;
  avgTimePerPage: number; // in seconds
  avgTimePerWord: number; // in seconds per word
  onProgress?: (progress: { current: number; total: number; title: string }) => void;
}

export interface RecalculateBatchResult {
  processed: number;
  updated: number;
}

export class ReadingTimeCalculatorService {
  constructor(private storage: StorageService) {}

  public calculateMangaTime(pages: number, avgTimePerPage: number): number {
    const p = Math.max(1, pages);
    const speed = avgTimePerPage > 0 ? avgTimePerPage : 120;
    return Math.round(p * speed);
  }

  public calculateBookTime(wordCount: number, avgTimePerWord: number): number {
    const words = Math.max(0, wordCount);
    const speed = avgTimePerWord > 0 ? avgTimePerWord : 0.24;
    return Math.round(words * speed);
  }

  public async recalculateBatch(options: RecalculateBatchOptions): Promise<RecalculateBatchResult> {
    const { type, onlyNew, avgTimePerPage, avgTimePerWord, onProgress } = options;
    const historyRepo = this.storage.historyRepository;

    const histories: HistoryRow[] = onlyNew
      ? historyRepo.findByTypeNotAutomatic(type)
      : historyRepo.findAllByType(type);

    let processed = 0;
    let updated = 0;
    const total = histories.length;

    // Cache book paths and word counts to prevent repeated parsing of the same book
    const bookWordCountCache = new Map<number, number>();

    for (const h of histories) {
      processed++;
      const pagesDelta = Math.max(1, (h.page_end ?? 0) - (h.page_start ?? 0));
      let calculatedSeconds = 0;
      let calculatedWordCount = h.word_count ?? 0;
      let title = '';

      if (type === 'MANGA') {
        const manga = this.storage.findMangaById(h.id_reference);
        if (manga) title = manga.title || manga.name;
        calculatedSeconds = this.calculateMangaTime(pagesDelta, avgTimePerPage);
      } else {
        const book = this.storage.findBookById(h.id_reference);
        if (book) {
          title = book.title || book.name;
          const bookId = book.id;
          if (calculatedWordCount <= 0 && book.path && bookId != null) {
            if (bookWordCountCache.has(bookId)) {
              calculatedWordCount = bookWordCountCache.get(bookId)!;
            } else {
              // Extract total words or words for read pages
              calculatedWordCount = EpubBookExtractor.countWords(book.path);
              bookWordCountCache.set(bookId, calculatedWordCount);
            }
          }
        }

        // If whole book word count is known, prorate by pages read ratio or use count
        let wordsForSession = calculatedWordCount;
        if (h.pages > 0 && calculatedWordCount > 0 && pagesDelta < h.pages) {
          wordsForSession = Math.round((calculatedWordCount / h.pages) * pagesDelta);
        }
        // Fallback: estimate 250 words per page if EPUB couldn't be parsed
        if (wordsForSession <= 0) {
          wordsForSession = pagesDelta * 250;
        }

        calculatedSeconds = this.calculateBookTime(wordsForSession, avgTimePerWord);
      }

      if (onProgress) {
        onProgress({ current: processed, total, title });
      }

      // Rule: Apply if calculatedSeconds > current seconds_read or if onlyNew is true and seconds_read == 0
      const shouldUpdate = onlyNew
        ? true
        : calculatedSeconds > (h.seconds_read ?? 0);

      if (shouldUpdate) {
        const averageTimePage = Math.floor(calculatedSeconds / pagesDelta);
        historyRepo.updateHistoryCalculatedTime(
          h.id,
          calculatedSeconds,
          averageTimePage,
          calculatedWordCount,
          1 // seconds_read_automatic = true
        );

        // Update lastAlteration on parent entity for Cloud Sync (ShareMark)
        const now = new Date().toISOString();
        if (type === 'MANGA') {
          const manga = this.storage.findMangaById(h.id_reference);
          if (manga) {
            this.storage.saveManga({
              ...manga,
              lastAlteration: now
            });
          }
        } else {
          const book = this.storage.findBookById(h.id_reference);
          if (book) {
            this.storage.saveBook({
              ...book,
              lastAlteration: now
            });
          }
        }

        updated++;
      }
    }

    return { processed, updated };
  }
}
