import { ShareMark } from './share-mark.interface';
import { Manga } from '../../models/entities/manga.model';
import { Book } from '../../models/entities/book.model';
import { ShareMarkType } from '../../models/enums/sharemark.enum';
import { ShareItem } from '../../models/entities/share-item.model';

export abstract class ShareMarkBase implements ShareMark {
  public static readonly INITIAL_SYNC_DATE_TIME = '2000-01-01T01:01:01.001-0300';
  public static inSync = false;

  abstract readonly notConnectErrorType: ShareMarkType;
  abstract initialize(ending: (access: ShareMarkType) => void): void;
  abstract mangaShareMark(update: (manga: Manga) => void, ending: (processed: ShareMarkType) => void): void;
  abstract bookShareMark(update: (book: Book) => void, ending: (processed: ShareMarkType) => void): void;

  protected compareManga(item: ShareItem, manga: Manga): boolean {
    const mangaAccessDate = manga.lastAccess ? new Date(manga.lastAccess) : null;
    const mangaAlterationDate = manga.lastAlteration ? new Date(manga.lastAlteration) : null;
    const syncDate = new Date(item.sync);
    const itemAccessDate = new Date(item.lastAccess);

    if (
      (!mangaAccessDate && !mangaAlterationDate) ||
      (mangaAlterationDate && mangaAlterationDate < syncDate) ||
      (mangaAccessDate && itemAccessDate > mangaAccessDate)
    ) {
      manga.bookMark = item.bookMark;
      manga.lastAccess = item.lastAccess;
      manga.favorite = item.favorite;
      manga.completed = item.completed;

      item.processed = true;
      item.received = true;
      return true;
    } else {
      if (!mangaAccessDate) {
        this.mergeManga(item, manga);
      } else {
        const diff = itemAccessDate.getTime() - mangaAccessDate.getTime();
        if (diff > 5000 || diff < -5000) {
          this.mergeManga(item, manga);
        }
      }
      return false;
    }
  }

  protected compareBook(item: ShareItem, book: Book): boolean {
    const bookAccessDate = book.lastAccess ? new Date(book.lastAccess) : null;
    const bookAlterationDate = book.lastAlteration ? new Date(book.lastAlteration) : null;
    const syncDate = new Date(item.sync);
    const itemAccessDate = new Date(item.lastAccess);

    if (
      (!bookAccessDate && !bookAlterationDate) ||
      (bookAlterationDate && bookAlterationDate < syncDate) ||
      (bookAccessDate && itemAccessDate > bookAccessDate)
    ) {
      book.bookMark = item.bookMark;
      book.lastAccess = item.lastAccess;
      book.favorite = item.favorite;
      book.completed = item.completed;

      item.processed = true;
      item.received = true;
      return true;
    } else {
      if (!bookAccessDate) {
        this.mergeBook(item, book);
      } else {
        const diff = itemAccessDate.getTime() - bookAccessDate.getTime();
        if (diff > 5000 || diff < -5000) {
          this.mergeBook(item, book);
        }
      }
      return false;
    }
  }

  private mergeManga(item: ShareItem, manga: Manga): void {
    item.bookMark = manga.bookMark;
    item.pages = manga.pages;
    item.completed = manga.completed;
    item.lastAccess = manga.lastAccess || ShareMarkBase.INITIAL_SYNC_DATE_TIME;
    item.favorite = manga.favorite;
    item.alter = true;
    item.processed = true;
  }

  private mergeBook(item: ShareItem, book: Book): void {
    item.bookMark = book.bookMark;
    item.pages = book.pages;
    item.completed = book.completed;
    item.lastAccess = book.lastAccess || ShareMarkBase.INITIAL_SYNC_DATE_TIME;
    item.favorite = book.favorite;
    item.alter = true;
    item.processed = true;
  }
}
