import { BaseEntity } from '../interfaces/base-entity.model';
import { Languages } from '../enums/app-enums';
import { PAGE_EMPTY } from '../enums/page-link-enums';

export interface LinkedFile extends BaseEntity<number> {
  idManga: number;
  pages: number;
  path: string;
  name: string;
  type: string;
  folder: string;
  language: Languages;
  dateCreate?: string;
  lastAccess?: string;
  lastAlteration?: string;
  /** Runtime: linked rows (one per manga page). */
  pagesLink?: LinkedPage[];
  /** Runtime: overflow pages from the linked file. */
  pagesNotLink?: LinkedPage[];
}

export interface LinkedPage extends BaseEntity<number> {
  idFile?: number | null;
  mangaPage: number;
  mangaPages: number;
  mangaPageName: string;
  mangaPagePath: string;
  fileLinkLeftPage: number;
  fileLinkLeftPages: number;
  fileLinkLeftPageName: string;
  fileLinkLeftPagePath: string;
  fileLinkRightPage: number;
  fileLinkRightPageName: string;
  fileLinkRightPagePath: string;
  isNotLinked: boolean;
  isDualImage: boolean;
  isMangaDualPage: boolean;
  isFileLeftDualPage: boolean;
  isFileRightDualPage: boolean;
  /** Runtime thumbnail URLs (local-page:///). */
  imageMangaPage?: string | null;
  imageLeftFileLinkPage?: string | null;
  imageRightFileLinkPage?: string | null;
}

export function createEmptyLinkedPage(partial?: Partial<LinkedPage>): LinkedPage {
  return {
    id: partial?.id,
    idFile: partial?.idFile ?? null,
    mangaPage: partial?.mangaPage ?? PAGE_EMPTY,
    mangaPages: partial?.mangaPages ?? 0,
    mangaPageName: partial?.mangaPageName ?? '',
    mangaPagePath: partial?.mangaPagePath ?? '',
    fileLinkLeftPage: partial?.fileLinkLeftPage ?? PAGE_EMPTY,
    fileLinkLeftPages: partial?.fileLinkLeftPages ?? 0,
    fileLinkLeftPageName: partial?.fileLinkLeftPageName ?? '',
    fileLinkLeftPagePath: partial?.fileLinkLeftPagePath ?? '',
    fileLinkRightPage: partial?.fileLinkRightPage ?? PAGE_EMPTY,
    fileLinkRightPageName: partial?.fileLinkRightPageName ?? '',
    fileLinkRightPagePath: partial?.fileLinkRightPagePath ?? '',
    isNotLinked: partial?.isNotLinked ?? false,
    isDualImage: partial?.isDualImage ?? false,
    isMangaDualPage: partial?.isMangaDualPage ?? false,
    isFileLeftDualPage: partial?.isFileLeftDualPage ?? false,
    isFileRightDualPage: partial?.isFileRightDualPage ?? false,
    imageMangaPage: partial?.imageMangaPage ?? null,
    imageLeftFileLinkPage: partial?.imageLeftFileLinkPage ?? null,
    imageRightFileLinkPage: partial?.imageRightFileLinkPage ?? null
  };
}

export function createMangaSpinePage(
  mangaPage: number,
  mangaPages: number,
  mangaPageName: string,
  mangaPagePath: string,
  imageMangaPage?: string | null
): LinkedPage {
  return createEmptyLinkedPage({
    mangaPage,
    mangaPages,
    mangaPageName,
    mangaPagePath,
    imageMangaPage: imageMangaPage ?? null
  });
}

export function createNotLinkedPage(
  idFile: number | null | undefined,
  fileLinkLeftPage: number,
  fileLinkLeftPages: number,
  fileLinkLeftPageName: string,
  fileLinkLeftPagePath: string,
  isFileLeftDualPage = false,
  imageLeftFileLinkPage?: string | null
): LinkedPage {
  return createEmptyLinkedPage({
    idFile,
    mangaPage: PAGE_EMPTY,
    isNotLinked: true,
    fileLinkLeftPage,
    fileLinkLeftPages,
    fileLinkLeftPageName,
    fileLinkLeftPagePath,
    isFileLeftDualPage,
    imageLeftFileLinkPage: imageLeftFileLinkPage ?? null
  });
}

export function cloneLinkedPage(page: LinkedPage): LinkedPage {
  return { ...page };
}

export function mergeLinkedPage(target: LinkedPage, another: LinkedPage): void {
  target.fileLinkLeftPage = another.fileLinkLeftPage;
  target.fileLinkLeftPages = another.fileLinkLeftPages;
  target.fileLinkLeftPageName = another.fileLinkLeftPageName;
  target.fileLinkLeftPagePath = another.fileLinkLeftPagePath;
  target.fileLinkRightPage = another.fileLinkRightPage;
  target.fileLinkRightPageName = another.fileLinkRightPageName;
  target.fileLinkRightPagePath = another.fileLinkRightPagePath;
  target.imageLeftFileLinkPage = another.imageLeftFileLinkPage;
  target.imageRightFileLinkPage = another.imageRightFileLinkPage;
  target.isNotLinked = another.isNotLinked;
  target.isDualImage = another.isDualImage;
  target.isFileLeftDualPage = another.isFileLeftDualPage;
  target.isFileRightDualPage = another.isFileRightDualPage;
}

export function addLeftPageLink(target: LinkedPage, another: LinkedPage): void {
  target.fileLinkLeftPage = another.fileLinkLeftPage;
  target.fileLinkLeftPages = another.fileLinkLeftPages;
  target.fileLinkLeftPageName = another.fileLinkLeftPageName;
  target.fileLinkLeftPagePath = another.fileLinkLeftPagePath;
  target.imageLeftFileLinkPage = another.imageLeftFileLinkPage;
  target.isFileLeftDualPage = another.isFileLeftDualPage;
}

export function addLeftFromRightPageLink(target: LinkedPage, another: LinkedPage): void {
  target.fileLinkLeftPage = another.fileLinkRightPage;
  target.fileLinkLeftPages = another.fileLinkLeftPages;
  target.fileLinkLeftPageName = another.fileLinkRightPageName;
  target.fileLinkLeftPagePath = another.fileLinkRightPagePath;
  target.imageLeftFileLinkPage = another.imageRightFileLinkPage;
  target.isFileLeftDualPage = another.isFileRightDualPage;
}

export function addRightPageLink(target: LinkedPage, another: LinkedPage): void {
  if (target.fileLinkLeftPage === PAGE_EMPTY) {
    target.fileLinkLeftPage = another.fileLinkRightPage !== PAGE_EMPTY
      ? another.fileLinkRightPage
      : another.fileLinkLeftPage;
    target.fileLinkLeftPageName = another.fileLinkRightPage !== PAGE_EMPTY
      ? another.fileLinkRightPageName
      : another.fileLinkLeftPageName;
    target.fileLinkLeftPagePath = another.fileLinkRightPage !== PAGE_EMPTY
      ? another.fileLinkRightPagePath
      : another.fileLinkLeftPagePath;
    target.imageLeftFileLinkPage = another.fileLinkRightPage !== PAGE_EMPTY
      ? another.imageRightFileLinkPage
      : another.imageLeftFileLinkPage;
    target.isFileLeftDualPage = another.fileLinkRightPage !== PAGE_EMPTY
      ? another.isFileRightDualPage
      : another.isFileLeftDualPage;
    if (another.fileLinkLeftPages) {
      target.fileLinkLeftPages = another.fileLinkLeftPages;
    }
  } else {
    target.fileLinkRightPage = another.fileLinkRightPage !== PAGE_EMPTY
      ? another.fileLinkRightPage
      : another.fileLinkLeftPage;
    target.fileLinkRightPageName = another.fileLinkRightPage !== PAGE_EMPTY
      ? another.fileLinkRightPageName
      : another.fileLinkLeftPageName;
    target.fileLinkRightPagePath = another.fileLinkRightPage !== PAGE_EMPTY
      ? another.fileLinkRightPagePath
      : another.fileLinkLeftPagePath;
    target.imageRightFileLinkPage = another.fileLinkRightPage !== PAGE_EMPTY
      ? another.imageRightFileLinkPage
      : another.imageLeftFileLinkPage;
    target.isFileRightDualPage = another.fileLinkRightPage !== PAGE_EMPTY
      ? another.isFileRightDualPage
      : another.isFileLeftDualPage;
  }
  target.isDualImage = target.fileLinkRightPage !== PAGE_EMPTY;
}

export function addRightFromLeftPageLink(target: LinkedPage, another: LinkedPage): void {
  if (target.fileLinkLeftPage === PAGE_EMPTY) {
    addLeftPageLink(target, another);
  } else {
    target.fileLinkRightPage = another.fileLinkLeftPage;
    target.fileLinkRightPageName = another.fileLinkLeftPageName;
    target.fileLinkRightPagePath = another.fileLinkLeftPagePath;
    target.imageRightFileLinkPage = another.imageLeftFileLinkPage;
    target.isFileRightDualPage = another.isFileLeftDualPage;
    target.isDualImage = true;
  }
}

export function clearRightPageLink(target: LinkedPage): void {
  target.fileLinkRightPage = PAGE_EMPTY;
  target.fileLinkRightPageName = '';
  target.fileLinkRightPagePath = '';
  target.imageRightFileLinkPage = null;
  target.isDualImage = false;
  target.isFileRightDualPage = false;
}

export function clearLeftPageLink(target: LinkedPage, canMoved = false): boolean {
  if (canMoved && target.fileLinkRightPage !== PAGE_EMPTY) {
    target.fileLinkLeftPage = target.fileLinkRightPage;
    target.fileLinkLeftPageName = target.fileLinkRightPageName;
    target.fileLinkLeftPagePath = target.fileLinkRightPagePath;
    target.imageLeftFileLinkPage = target.imageRightFileLinkPage;
    target.isFileLeftDualPage = target.isFileRightDualPage;
    clearRightPageLink(target);
    return true;
  }
  target.fileLinkLeftPage = PAGE_EMPTY;
  target.fileLinkLeftPages = 0;
  target.fileLinkLeftPageName = '';
  target.fileLinkLeftPagePath = '';
  target.imageLeftFileLinkPage = null;
  target.isFileLeftDualPage = false;
  return false;
}

export function movePageLinkRightToLeft(target: LinkedPage): void {
  target.fileLinkLeftPage = target.fileLinkRightPage;
  target.fileLinkLeftPageName = target.fileLinkRightPageName;
  target.fileLinkLeftPagePath = target.fileLinkRightPagePath;
  target.imageLeftFileLinkPage = target.imageRightFileLinkPage;
  target.isFileLeftDualPage = target.isFileRightDualPage;
  clearRightPageLink(target);
}

export function clearPageLink(target: LinkedPage): void {
  target.fileLinkLeftPage = PAGE_EMPTY;
  target.fileLinkLeftPages = 0;
  target.fileLinkLeftPageName = '';
  target.fileLinkLeftPagePath = '';
  target.fileLinkRightPage = PAGE_EMPTY;
  target.fileLinkRightPageName = '';
  target.fileLinkRightPagePath = '';
  target.imageLeftFileLinkPage = null;
  target.imageRightFileLinkPage = null;
  target.isFileLeftDualPage = false;
  target.isFileRightDualPage = false;
  target.isNotLinked = false;
  target.isDualImage = false;
}

export function createEmptyLinkedFile(idManga: number): LinkedFile {
  const now = new Date().toISOString();
  return {
    idManga,
    pages: 0,
    path: '',
    name: '',
    type: '',
    folder: '',
    language: Languages.PORTUGUESE,
    dateCreate: now,
    lastAccess: now,
    lastAlteration: now,
    pagesLink: [],
    pagesNotLink: []
  };
}
