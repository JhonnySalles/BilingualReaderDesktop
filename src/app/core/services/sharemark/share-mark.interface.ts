import { Manga } from '../../models/entities/manga.model';
import { Book } from '../../models/entities/book.model';
import { ShareMarkType } from '../../models/enums/sharemark.enum';

export interface ShareMark {
  mangaShareMark(update: (manga: Manga) => void, ending: (processed: ShareMarkType) => void): void;
  bookShareMark(update: (book: Book) => void, ending: (processed: ShareMarkType) => void): void;
}
