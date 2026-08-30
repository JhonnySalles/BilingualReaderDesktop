import { ShareMarkBase } from './share-mark-base.service';
import { Manga } from '../../models/entities/manga.model';
import { Book } from '../../models/entities/book.model';
import { ShareMarkType } from '../../models/enums/sharemark.enum';

export class ShareMarkGDriveService extends ShareMarkBase {
  readonly notConnectErrorType = ShareMarkType.NOT_CONNECT_GDRIVE;

  initialize(ending: (access: ShareMarkType) => void): void {
    // Google Drive REST API initialization placeholder
    ending(ShareMarkType.SUCCESS);
  }

  mangaShareMark(update: (manga: Manga) => void, ending: (processed: ShareMarkType) => void): void {
    // Sincronização de mangá via Google Drive API
    ending(ShareMarkType.NOT_ALTERATION);
  }

  bookShareMark(update: (book: Book) => void, ending: (processed: ShareMarkType) => void): void {
    // Sincronização de livro via Google Drive API
    ending(ShareMarkType.NOT_ALTERATION);
  }
}
