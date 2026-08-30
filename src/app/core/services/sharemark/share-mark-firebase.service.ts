import { ShareMarkBase } from './share-mark-base.service';
import { Manga } from '../../models/entities/manga.model';
import { Book } from '../../models/entities/book.model';
import { ShareMarkType } from '../../models/enums/sharemark.enum';

export class ShareMarkFirebaseService extends ShareMarkBase {
  readonly notConnectErrorType = ShareMarkType.NOT_CONNECT_FIREBASE;

  initialize(ending: (access: ShareMarkType) => void): void {
    // Firebase initialization placeholder (credentials to be injected in future setup)
    ending(ShareMarkType.SUCCESS);
  }

  mangaShareMark(update: (manga: Manga) => void, ending: (processed: ShareMarkType) => void): void {
    // Sincronização de mangá via Firestore (executado sob demanda na atualização da biblioteca)
    ending(ShareMarkType.NOT_ALTERATION);
  }

  bookShareMark(update: (book: Book) => void, ending: (processed: ShareMarkType) => void): void {
    // Sincronização de livro via Firestore (executado sob demanda na atualização da biblioteca)
    ending(ShareMarkType.NOT_ALTERATION);
  }
}
