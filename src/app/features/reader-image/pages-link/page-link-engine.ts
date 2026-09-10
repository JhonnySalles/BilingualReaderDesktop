import {
  LinkedFile,
  LinkedPage,
  addLeftFromRightPageLink,
  addLeftPageLink,
  addRightFromLeftPageLink,
  addRightPageLink,
  clearLeftPageLink,
  clearPageLink,
  clearRightPageLink,
  cloneLinkedPage,
  createEmptyLinkedFile,
  createMangaSpinePage,
  createNotLinkedPage,
  mergeLinkedPage,
  movePageLinkRightToLeft
} from '../../../core/models/entities/linked-file.model';
import { Languages } from '../../../core/models/enums/app-enums';
import { PAGE_EMPTY, PageLinkSlot } from '../../../core/models/enums/page-link-enums';

export interface MangaPageSource {
  pageCount: number;
  pages: string[];
  pageNames: string[];
  pagePaths: string[];
}

export interface LinkedFileSource extends MangaPageSource {
  path: string;
  name: string;
  type: string;
  folder: string;
}

const MAX_BACKUPS = 10;

export class PageLinkEngine {
  linkedFile: LinkedFile = createEmptyLinkedFile(0);
  pagesLink: LinkedPage[] = [];
  pagesNotLink: LinkedPage[] = [];
  language: Languages = Languages.PORTUGUESE;
  mangaId = 0;
  mangaTitle = '';
  /** Pad using folder paths when linking (settings). */
  usePagePathForLinked = true;

  private backups: LinkedPage[][] = [];

  get hasBackup(): boolean {
    return this.backups.length > 0;
  }

  get hasLinkedFile(): boolean {
    return !!this.linkedFile.path;
  }

  reset(mangaId: number, mangaTitle = ''): void {
    this.mangaId = mangaId;
    this.mangaTitle = mangaTitle;
    this.linkedFile = createEmptyLinkedFile(mangaId);
    this.pagesLink = [];
    this.pagesNotLink = [];
    this.language = Languages.PORTUGUESE;
    this.clearBackup();
  }

  /** Build manga spine from the open reader session. */
  loadMangaSpine(source: MangaPageSource): void {
    this.clearBackup();
    const list: LinkedPage[] = [];
    for (let i = 0; i < source.pageCount; i++) {
      list.push(
        createMangaSpinePage(
          i,
          source.pageCount,
          source.pageNames[i] || String(i),
          source.pagePaths[i] || '',
          source.pages[i] || null
        )
      );
    }
    this.pagesLink = list;
    this.pagesNotLink = [];
    this.linkedFile = createEmptyLinkedFile(this.mangaId);
    this.linkedFile.pagesLink = this.pagesLink;
    this.linkedFile.pagesNotLink = this.pagesNotLink;
  }

  /** Restore a saved LinkedFile onto the current manga spine (or replace spine). */
  applySavedLink(saved: LinkedFile, mangaSource: MangaPageSource, linkedSource?: LinkedFileSource): void {
    this.clearBackup();
    if (!this.pagesLink.length) {
      this.loadMangaSpine(mangaSource);
    }

    this.linkedFile = {
      ...createEmptyLinkedFile(this.mangaId),
      ...saved,
      idManga: this.mangaId,
      pagesLink: undefined,
      pagesNotLink: undefined
    };
    this.language = saved.language || Languages.PORTUGUESE;

    const savedLinks = saved.pagesLink || [];
    for (let i = 0; i < this.pagesLink.length; i++) {
      const spine = this.pagesLink[i];
      const match = savedLinks.find(p => p.mangaPage === spine.mangaPage) || savedLinks[i];
      if (match) {
        mergeLinkedPage(spine, match);
        spine.isMangaDualPage = match.isMangaDualPage;
        spine.id = match.id;
        spine.idFile = match.idFile;
      } else {
        clearPageLink(spine);
      }
      spine.imageMangaPage = mangaSource.pages[i] || spine.imageMangaPage;
    }

    this.pagesNotLink = (saved.pagesNotLink || []).map(p =>
      createNotLinkedPage(
        p.idFile ?? saved.id ?? null,
        p.fileLinkLeftPage,
        p.fileLinkLeftPages,
        p.fileLinkLeftPageName,
        p.fileLinkLeftPagePath,
        p.isFileLeftDualPage,
        null
      )
    );

    if (linkedSource) {
      this.attachLinkedThumbnails(linkedSource);
    }

    this.syncFileLists();
  }

  /**
   * Open a second archive: auto-assign 1:1 (with optional folder padding),
   * overflow → pagesNotLink. If a saved mapping exists for name+pages, caller
   * should prefer applySavedLink instead.
   */
  readFileLink(source: LinkedFileSource, useSaved?: LinkedFile | null): void {
    this.clearBackup();

    if (useSaved?.pagesLink?.length) {
      this.applySavedLink(useSaved, {
        pageCount: this.pagesLink.length,
        pages: this.pagesLink.map(p => p.imageMangaPage || ''),
        pageNames: this.pagesLink.map(p => p.mangaPageName),
        pagePaths: this.pagesLink.map(p => p.mangaPagePath)
      }, source);
      return;
    }

    for (const page of this.pagesLink) clearPageLink(page);
    this.pagesNotLink = [];

    const now = new Date().toISOString();
    this.linkedFile = {
      ...createEmptyLinkedFile(this.mangaId),
      pages: source.pageCount,
      path: source.path,
      name: source.name,
      type: source.type,
      folder: source.folder,
      language: this.language,
      dateCreate: now,
      lastAccess: now,
      lastAlteration: now
    };

    const hasFolders =
      this.pagesLink.some(p => !!p.mangaPagePath) &&
      source.pagePaths.some(p => !!p);

    let lastFolder = '';
    let padding = 0;
    const notLinked: LinkedPage[] = [];

    for (let i = 0; i < source.pageCount; i++) {
      const pagePath = source.pagePaths[i] || '';
      if (this.usePagePathForLinked && hasFolders) {
        const folder = pagePath;
        if (folder !== lastFolder) {
          lastFolder = folder;
          if (i > 0 && i + padding < this.pagesLink.length) {
            if (
              this.pagesLink[i + padding].mangaPagePath ===
              this.pagesLink[i + padding - 1].mangaPagePath
            ) {
              do {
                padding++;
                if (i + padding >= this.pagesLink.length) break;
              } while (
                this.pagesLink[i + padding].mangaPagePath ===
                this.pagesLink[i + padding - 1].mangaPagePath
              );
            }
          }
        }
      }

      const index = i + padding;
      if (index > -1 && index < this.pagesLink.length) {
        const page = this.pagesLink[index];
        page.fileLinkLeftPage = i;
        page.fileLinkLeftPageName = source.pageNames[i] || String(i);
        page.fileLinkLeftPagePath = pagePath;
        page.fileLinkLeftPages = source.pageCount;
        page.imageLeftFileLinkPage = source.pages[i] || null;
      } else {
        notLinked.push(
          createNotLinkedPage(
            null,
            i,
            source.pageCount,
            source.pageNames[i] || String(i),
            pagePath,
            false,
            source.pages[i] || null
          )
        );
      }
    }

    this.pagesNotLink = notLinked;
    this.syncFileLists();
  }

  clearFileLink(): void {
    this.clearBackup();
    this.linkedFile = createEmptyLinkedFile(this.mangaId);
    this.language = Languages.PORTUGUESE;
    this.pagesNotLink = [];
    for (const page of this.pagesLink) clearPageLink(page);
    this.syncFileLists();
  }

  attachLinkedThumbnails(source: LinkedFileSource): void {
    const url = (idx: number) =>
      idx > PAGE_EMPTY && idx < source.pages.length ? source.pages[idx] : null;

    for (const page of this.pagesLink) {
      page.imageLeftFileLinkPage = url(page.fileLinkLeftPage);
      page.imageRightFileLinkPage = url(page.fileLinkRightPage);
    }
    for (const page of this.pagesNotLink) {
      page.imageLeftFileLinkPage = url(page.fileLinkLeftPage);
    }
  }

  setLanguage(language: Languages): void {
    this.language = language;
    this.linkedFile.language = language;
  }

  toPersistable(): LinkedFile {
    this.syncFileLists();
    return {
      ...this.linkedFile,
      idManga: this.mangaId,
      language: this.language,
      lastAccess: new Date().toISOString(),
      pagesLink: this.pagesLink.map(p => this.stripRuntime(p)),
      pagesNotLink: this.pagesNotLink.map(p => this.stripRuntime(p))
    };
  }

  // ── Undo ──────────────────────────────────────────────────────────

  generateBackup(): void {
    const backup: LinkedPage[] = [];
    for (const page of this.pagesLink) {
      const copy = cloneLinkedPage(page);
      backup.push(copy);
    }
    for (const page of this.pagesNotLink) {
      backup.push(cloneLinkedPage(page));
    }
    if (this.backups.length >= MAX_BACKUPS) this.backups.shift();
    this.backups.push(backup);
  }

  returnBackup(): void {
    if (!this.backups.length) return;
    const backup = this.backups.pop()!;
    this.pagesLink = backup.filter(p => !p.isNotLinked).map(cloneLinkedPage);
    this.pagesNotLink = backup.filter(p => p.isNotLinked).map(cloneLinkedPage);
    this.syncFileLists();
  }

  private clearBackup(): void {
    this.backups = [];
  }

  // ── Drag / drop ───────────────────────────────────────────────────

  onMove(origin: LinkedPage, destiny: LinkedPage): void {
    if (origin === destiny) return;
    this.generateBackup();
    const originIndex = this.pagesLink.indexOf(origin);
    const destinyIndex = this.pagesLink.indexOf(destiny);
    if (originIndex < 0 || destinyIndex < 0) return;
    let differ = destinyIndex - originIndex;

    if (originIndex > destinyIndex) {
      let limit = this.pagesLink.length - 1;
      let index = -1;
      for (let i = this.pagesLink.length - 1; i >= 0; i--) {
        if (this.pagesLink[i].imageLeftFileLinkPage || this.pagesLink[i].fileLinkLeftPage !== PAGE_EMPTY) {
          index = i;
          break;
        }
      }
      if (index < 0) index = this.pagesLink.length - 1;

      for (let i = index; i >= originIndex; i--) {
        if (this.pagesLink[i].fileLinkLeftPage === PAGE_EMPTY) limit = i;
      }

      for (let i = destinyIndex; i < originIndex; i++) {
        this.addNotLinkedInternal(this.pagesLink[i]);
      }

      differ *= -1;
      for (let i = destinyIndex; i < limit; i++) {
        if (i === destinyIndex) {
          addLeftPageLink(this.pagesLink[i], origin);
          clearLeftPageLink(origin);
        } else if (i + differ <= limit) {
          addLeftPageLink(this.pagesLink[i], this.pagesLink[i + differ]);
          clearLeftPageLink(this.pagesLink[i + differ]);
        }
      }

      for (let i = destinyIndex; i < limit; i++) {
        const p = this.pagesLink[i];
        if (
          p.isDualImage &&
          p.fileLinkLeftPage === PAGE_EMPTY &&
          p.fileLinkRightPage !== PAGE_EMPTY
        ) {
          movePageLinkRightToLeft(p);
        }
      }
    } else {
      let limit = this.pagesLink.length - 1;
      let spacesFree = 0;
      for (let i = originIndex; i < limit; i++) {
        if (this.pagesLink[i].fileLinkLeftPage === PAGE_EMPTY) spacesFree++;
      }

      if (differ > spacesFree) {
        for (let i = limit; i >= limit - differ; i--) {
          if (i >= 0) this.addNotLinkedInternal(this.pagesLink[i]);
        }
        for (let i = limit; i >= originIndex; i--) {
          if (i < destinyIndex) clearLeftPageLink(this.pagesLink[i]);
          else addLeftPageLink(this.pagesLink[i], this.pagesLink[i - differ]);
        }
      } else {
        let spaceUsed = 0;
        for (let i = originIndex; i < limit; i++) {
          if (this.pagesLink[i].fileLinkLeftPage === PAGE_EMPTY) {
            spaceUsed++;
            if (spaceUsed >= differ) {
              limit = i;
              break;
            }
          }
        }
        spaceUsed = 0;
        for (let i = limit; i >= originIndex; i--) {
          if (i < destinyIndex) {
            clearLeftPageLink(this.pagesLink[i], true);
          } else {
            let idx = i - (1 + spaceUsed);
            while (
              idx >= 0 &&
              this.pagesLink[idx].fileLinkLeftPage === PAGE_EMPTY
            ) {
              spaceUsed++;
              idx = i - (1 + spaceUsed);
            }
            if (idx >= 0) addLeftPageLink(this.pagesLink[i], this.pagesLink[idx]);
          }
        }
      }
    }
    this.syncFileLists();
  }

  onNotLinked(origin: LinkedPage): void {
    this.generateBackup();
    this.pagesNotLink.push(
      createNotLinkedPage(
        origin.idFile,
        origin.fileLinkLeftPage,
        origin.fileLinkLeftPages,
        origin.fileLinkLeftPageName,
        origin.fileLinkLeftPagePath,
        origin.isFileLeftDualPage,
        origin.imageLeftFileLinkPage
      )
    );
    if (origin.isDualImage) movePageLinkRightToLeft(origin);
    else clearPageLink(origin);
    this.syncFileLists();
  }

  fromNotLinked(origin: LinkedPage, destiny: LinkedPage): void {
    this.generateBackup();
    const destinyIndex = this.pagesLink.indexOf(destiny);
    if (destinyIndex < 0) return;
    const size = this.pagesLink.length - 1;
    this.pagesNotLink = this.pagesNotLink.filter(p => p !== origin);

    if (destiny.fileLinkLeftPage === PAGE_EMPTY) {
      addLeftPageLink(this.pagesLink[destinyIndex], origin);
    } else {
      this.addNotLinkedInternal(this.pagesLink[size]);
      for (let i = size; i >= destinyIndex; i--) {
        if (i === destinyIndex) addLeftPageLink(this.pagesLink[i], origin);
        else addLeftPageLink(this.pagesLink[i], this.pagesLink[i - 1]);
      }
    }
    this.syncFileLists();
  }

  onMoveDualPage(
    originType: PageLinkSlot,
    origin: LinkedPage,
    destinyType: PageLinkSlot,
    destiny: LinkedPage
  ): void {
    this.generateBackup();
    if (origin === destiny && destinyType === PageLinkSlot.DUAL_PAGE) return;

    let notLink: LinkedPage | null = null;
    if (destinyType !== PageLinkSlot.LINKED && destiny.isDualImage) {
      notLink = createNotLinkedPage(
        destiny.idFile,
        destiny.fileLinkRightPage,
        destiny.fileLinkLeftPages,
        destiny.fileLinkRightPageName,
        destiny.fileLinkRightPagePath,
        destiny.isFileRightDualPage,
        destiny.imageRightFileLinkPage
      );
    } else if (
      destinyType === PageLinkSlot.LINKED &&
      destiny.fileLinkLeftPage !== PAGE_EMPTY
    ) {
      notLink = createNotLinkedPage(
        destiny.idFile,
        destiny.fileLinkLeftPage,
        destiny.fileLinkLeftPages,
        destiny.fileLinkLeftPageName,
        destiny.fileLinkLeftPagePath,
        destiny.isFileLeftDualPage,
        destiny.imageLeftFileLinkPage
      );
    }

    if (originType === PageLinkSlot.DUAL_PAGE && destinyType === PageLinkSlot.DUAL_PAGE) {
      addRightPageLink(destiny, origin);
      clearRightPageLink(origin);
    } else if (
      originType === PageLinkSlot.NOT_LINKED ||
      destinyType === PageLinkSlot.NOT_LINKED
    ) {
      if (originType === PageLinkSlot.NOT_LINKED && destinyType === PageLinkSlot.NOT_LINKED) {
        return;
      }
      if (originType === PageLinkSlot.NOT_LINKED) {
        addRightFromLeftPageLink(destiny, origin);
        this.pagesNotLink = this.pagesNotLink.filter(p => p !== origin);
      } else if (destinyType === PageLinkSlot.NOT_LINKED) {
        clearRightPageLink(origin);
      }
    } else {
      const originIndex = this.pagesLink.indexOf(origin);
      let destinyIndex = this.pagesLink.indexOf(destiny);

      if (originType !== PageLinkSlot.DUAL_PAGE && destinyType === PageLinkSlot.LINKED) {
        addLeftPageLink(destiny, origin);
      } else if (originType !== PageLinkSlot.DUAL_PAGE && destinyType !== PageLinkSlot.LINKED) {
        addRightFromLeftPageLink(destiny, origin);
      } else if (originType === PageLinkSlot.DUAL_PAGE && destinyType === PageLinkSlot.LINKED) {
        if (destinyIndex + 1 < this.pagesLink.length) {
          notLink = null;
          this.onMove(this.pagesLink[destinyIndex], this.pagesLink[destinyIndex + 1]);
          // onMove already backed up — avoid double; continue with current state
          destiny = this.pagesLink[destinyIndex];
        }
        addLeftFromRightPageLink(destiny, origin);
      } else if (originType === PageLinkSlot.DUAL_PAGE && destinyType !== PageLinkSlot.LINKED) {
        addRightFromLeftPageLink(destiny, origin);
      }

      if (originType === PageLinkSlot.LINKED) clearLeftPageLink(origin, true);
      else if (originType === PageLinkSlot.DUAL_PAGE) clearRightPageLink(origin);

      if (
        originIndex > destinyIndex &&
        originType !== PageLinkSlot.DUAL_PAGE &&
        origin.fileLinkLeftPage === PAGE_EMPTY
      ) {
        const nextO = originIndex + 1;
        const nextD = destinyIndex + 1;
        if (nextO < this.pagesLink.length && nextD < this.pagesLink.length) {
          // shift cascade like Android when moving upward into dual
        }
      }
    }

    if (notLink) this.pagesNotLink.push(notLink);
    this.syncFileLists();
  }

  // ── Reorder algorithms ────────────────────────────────────────────

  reorderDoublePages(useDualPageCalculate = false, initial?: LinkedPage | null): void {
    if (!this.hasLinkedFile) return;
    this.generateBackup();
    const pagesLink = this.pagesLink;
    const startIndex = initial ? pagesLink.indexOf(initial) : -1;
    let padding = 1;

    for (let index = 0; index < pagesLink.length; index++) {
      const page = pagesLink[index];
      if (index < startIndex || page.isDualImage || (useDualPageCalculate && page.isFileLeftDualPage)) {
        continue;
      }
      if (index + padding >= pagesLink.length) break;

      let next = pagesLink[index + padding];
      if (next.fileLinkLeftPage === PAGE_EMPTY) {
        do {
          padding++;
          if (index + padding >= pagesLink.length) break;
          next = pagesLink[index + padding];
        } while (next.fileLinkLeftPage === PAGE_EMPTY);
      }
      if (index + padding >= pagesLink.length) break;

      if (next.isDualImage || (useDualPageCalculate && page.isFileLeftDualPage)) {
        if (page.fileLinkLeftPage !== PAGE_EMPTY) continue;
        mergeLinkedPage(page, next);
        clearPageLink(next);
      } else if (useDualPageCalculate) {
        if (page.fileLinkLeftPage === PAGE_EMPTY) {
          addLeftPageLink(page, next);
          clearLeftPageLink(next);
          if (!page.isFileLeftDualPage) {
            if (next.fileLinkRightPage !== PAGE_EMPTY) {
              addRightPageLink(page, next);
              clearRightPageLink(next);
            } else {
              padding++;
              if (index + padding >= pagesLink.length) {
                padding--;
                continue;
              }
              next = pagesLink[index + padding];
              if (
                next.fileLinkLeftPage !== PAGE_EMPTY &&
                !next.isDualImage &&
                !next.isFileLeftDualPage
              ) {
                addRightFromLeftPageLink(page, next);
                clearLeftPageLink(next);
              } else padding--;
            }
          }
        } else if (!next.isFileLeftDualPage) {
          addRightFromLeftPageLink(page, next);
          clearLeftPageLink(next);
        }
      } else {
        if (page.fileLinkLeftPage === PAGE_EMPTY) {
          addLeftPageLink(page, next);
          clearLeftPageLink(next);
          if (next.fileLinkRightPage !== PAGE_EMPTY) {
            addRightPageLink(page, next);
            clearRightPageLink(next);
          } else {
            padding++;
            if (index + padding >= pagesLink.length) {
              padding--;
              continue;
            }
            next = pagesLink[index + padding];
            if (!next.isDualImage && next.fileLinkLeftPage !== PAGE_EMPTY) {
              addRightFromLeftPageLink(page, next);
              clearLeftPageLink(next);
            } else padding--;
          }
        } else {
          addRightFromLeftPageLink(page, next);
          clearLeftPageLink(next);
        }
      }
    }

    if (this.pagesNotLink.length) {
      const pool = [...this.pagesNotLink].sort(
        (a, b) => a.fileLinkLeftPage - b.fileLinkLeftPage
      );
      for (const page of pagesLink) {
        if (!pool.length) break;
        if (page.isDualImage || (useDualPageCalculate && page.isFileRightDualPage)) continue;
        if (page.fileLinkLeftPage !== PAGE_EMPTY) {
          addRightFromLeftPageLink(page, pool.shift()!);
        } else if (useDualPageCalculate) {
          const first = pool.shift()!;
          addLeftPageLink(page, first);
          if (first.isFileLeftDualPage) continue;
          if (!pool.length) break;
          addRightFromLeftPageLink(page, pool.shift()!);
        } else {
          addLeftPageLink(page, pool.shift()!);
          if (!pool.length) break;
          addRightFromLeftPageLink(page, pool.shift()!);
        }
      }
      this.pagesNotLink = pool;
    }
    this.syncFileLists();
  }

  reorderSimplePages(notifyBackup = true, initial?: LinkedPage | null): void {
    if (!this.hasLinkedFile) return;
    const hasDual = this.pagesLink.some(p => p.isDualImage);
    if (!hasDual) return;
    if (notifyBackup) this.generateBackup();

    const pagesLink = this.pagesLink;
    const startIndex = initial ? pagesLink.indexOf(initial) : 0;
    let amount = pagesLink.filter(p => p.isDualImage).length;
    let amountNotLink = amount * 2 - pagesLink.length;

    if (amountNotLink > 0) {
      for (let i = pagesLink.length - 1; i >= startIndex; i--) {
        const item = pagesLink[i];
        if (item.fileLinkLeftPage === PAGE_EMPTY) continue;
        if (item.isDualImage) {
          this.addNotLinkedInternal(item);
          amountNotLink -= 2;
          clearPageLink(item);
        } else {
          this.addNotLinkedInternal(item);
          amountNotLink--;
          clearLeftPageLink(item);
        }
        if (amountNotLink < 1) break;
      }
      this.pagesNotLink.sort((a, b) => a.fileLinkLeftPage - b.fileLinkLeftPage);
    }

    let padding = 0;
    const pagesLinkTemp: LinkedPage[] = [];
    for (let index = 0; index < pagesLink.length; index++) {
      if (index < startIndex) {
        pagesLinkTemp.push(pagesLink[index]);
      } else {
        const newPage = cloneLinkedPage(pagesLink[index]);
        clearPageLink(newPage);
        newPage.imageMangaPage = pagesLink[index].imageMangaPage;
        newPage.isMangaDualPage = pagesLink[index].isMangaDualPage;
        pagesLinkTemp.push(newPage);
        const page = pagesLink[index - padding];
        addLeftPageLink(newPage, page);
        if (page.isDualImage) {
          clearLeftPageLink(page, true);
          padding++;
        }
      }
    }
    this.pagesLink = pagesLinkTemp;
    this.syncFileLists();
  }

  autoReorderDoublePages(isClear = false): void {
    if (!this.hasLinkedFile) return;
    this.generateBackup();
    const hasDualImage = isClear
      ? (this.reorderSimplePages(false), false)
      : this.pagesLink.some(p => p.isDualImage);

    if (!hasDualImage && (this.linkedFile.id == null || isClear)) {
      const pagesLink = this.pagesLink;
      const lastIndex = pagesLink.length - 1;
      for (let index = 0; index < pagesLink.length; index++) {
        const page = pagesLink[index];
        if (page.fileLinkLeftPage === PAGE_EMPTY || index >= lastIndex) continue;
        if (page.isMangaDualPage && page.isFileLeftDualPage) continue;

        if (page.isMangaDualPage) {
          const nextPage = pagesLink[index + 1];
          if (nextPage.fileLinkLeftPage === PAGE_EMPTY || nextPage.isFileLeftDualPage) continue;
          addRightFromLeftPageLink(page, nextPage);
          clearPageLink(nextPage);
          for (let idxNext = index + 1; idxNext < lastIndex; idxNext++) {
            const next = pagesLink[idxNext];
            const aux = pagesLink[idxNext + 1];
            addLeftPageLink(next, aux);
            clearLeftPageLink(aux);
          }
        } else if (page.isFileLeftDualPage) {
          if (pagesLink[index + 1].fileLinkLeftPage === PAGE_EMPTY) continue;
          let indexEmpty = lastIndex;
          for (let i = index + 1; i < lastIndex; i++) {
            if (pagesLink[i].fileLinkLeftPage === PAGE_EMPTY) {
              indexEmpty = i;
              break;
            }
          }
          this.addNotLinkedInternal(pagesLink[indexEmpty]);
          for (let i = indexEmpty; i >= index + 2; i--) {
            const aux = pagesLink[i - 1];
            addLeftPageLink(pagesLink[i], aux);
            clearLeftPageLink(aux);
          }
        }
      }
    }
    this.syncFileLists();
  }

  autoReorderFrom(initial: LinkedPage): void {
    if (!this.hasLinkedFile) return;
    this.generateBackup();
    const startIndex = this.pagesLink.indexOf(initial);
    if (startIndex < 0) return;
    const hasDual = this.pagesLink
      .filter((_, i) => i >= startIndex)
      .some(p => p.isDualImage);
    if (hasDual) return;

    const pagesLink = this.pagesLink;
    const lastIndex = pagesLink.length - 1;
    for (let index = startIndex; index < pagesLink.length; index++) {
      const page = pagesLink[index];
      if (page.fileLinkLeftPage === PAGE_EMPTY || index >= lastIndex) continue;
      if (page.isMangaDualPage && page.isFileLeftDualPage) continue;

      if (page.isMangaDualPage) {
        const nextPage = pagesLink[index + 1];
        if (nextPage.fileLinkLeftPage === PAGE_EMPTY || nextPage.isFileLeftDualPage) continue;
        addRightFromLeftPageLink(page, nextPage);
        clearPageLink(nextPage);
        for (let idxNext = index + 1; idxNext < lastIndex; idxNext++) {
          addLeftPageLink(pagesLink[idxNext], pagesLink[idxNext + 1]);
          clearLeftPageLink(pagesLink[idxNext + 1]);
        }
      } else if (page.isFileLeftDualPage) {
        if (pagesLink[index + 1].fileLinkLeftPage === PAGE_EMPTY) continue;
        let indexEmpty = lastIndex;
        for (let i = index + 1; i < lastIndex; i++) {
          if (pagesLink[i].fileLinkLeftPage === PAGE_EMPTY) {
            indexEmpty = i;
            break;
          }
        }
        this.addNotLinkedInternal(pagesLink[indexEmpty]);
        for (let i = indexEmpty; i >= index + 2; i--) {
          addLeftPageLink(pagesLink[i], pagesLink[i - 1]);
          clearLeftPageLink(pagesLink[i - 1]);
        }
      }
    }
    this.syncFileLists();
  }

  reorderBySortPages(): void {
    if (!this.hasLinkedFile) return;
    this.generateBackup();
    const pagesNotLink = this.pagesNotLink;
    const pagesLink = this.pagesLink;
    let maxNumPage = 0;
    for (const page of pagesLink) {
      maxNumPage = Math.max(maxNumPage, page.fileLinkLeftPage, page.fileLinkRightPage);
    }
    for (const page of pagesNotLink) {
      maxNumPage = Math.max(maxNumPage, page.fileLinkLeftPage);
    }

    const pagesLinkTemp: LinkedPage[] = [];
    const pagesNotLinkTemp: LinkedPage[] = [];

    for (const page of pagesLink) {
      if (page.mangaPage === PAGE_EMPTY) continue;
      const linkedPage = cloneLinkedPage(page);
      clearPageLink(linkedPage);
      linkedPage.imageMangaPage = page.imageMangaPage;
      linkedPage.isMangaDualPage = page.isMangaDualPage;
      pagesLinkTemp.push(linkedPage);

      if (page.mangaPage <= maxNumPage) {
        const findPageLink =
          pagesLink.find(
            p =>
              p.fileLinkLeftPage === page.mangaPage ||
              p.fileLinkRightPage === page.mangaPage
          ) || pagesNotLink.find(p => p.fileLinkLeftPage === page.mangaPage);
        if (findPageLink) {
          if (findPageLink.fileLinkRightPage === page.mangaPage) {
            addLeftFromRightPageLink(linkedPage, findPageLink);
          } else {
            addLeftPageLink(linkedPage, findPageLink);
          }
        }
      }
    }

    if (maxNumPage >= pagesLinkTemp.length) {
      for (let numPage = pagesLinkTemp.length; numPage < maxNumPage; numPage++) {
        const pageLink =
          pagesLink.find(
            p => p.fileLinkLeftPage === numPage || p.fileLinkRightPage === numPage
          ) || pagesNotLink.find(p => p.fileLinkLeftPage === numPage);
        if (!pageLink) continue;
        if (pageLink.fileLinkLeftPage === numPage) {
          pagesNotLinkTemp.push(
            createNotLinkedPage(
              pageLink.idFile,
              pageLink.fileLinkLeftPage,
              pageLink.fileLinkLeftPages,
              pageLink.fileLinkLeftPageName,
              pageLink.fileLinkLeftPagePath,
              pageLink.isFileLeftDualPage,
              pageLink.imageLeftFileLinkPage
            )
          );
        } else {
          pagesNotLinkTemp.push(
            createNotLinkedPage(
              pageLink.idFile,
              pageLink.fileLinkRightPage,
              pageLink.fileLinkLeftPages,
              pageLink.fileLinkRightPageName,
              pageLink.fileLinkRightPagePath,
              pageLink.isFileRightDualPage,
              pageLink.imageRightFileLinkPage
            )
          );
        }
      }
    }

    pagesLinkTemp.sort((a, b) => a.mangaPage - b.mangaPage);
    pagesNotLinkTemp.sort((a, b) => a.fileLinkLeftPage - b.fileLinkLeftPage);
    this.pagesLink = pagesLinkTemp;
    this.pagesNotLink = pagesNotLinkTemp;
    this.syncFileLists();
  }

  reorderReturnPages(initial: LinkedPage): void {
    if (!this.hasLinkedFile || initial.fileLinkLeftPage !== PAGE_EMPTY) return;
    this.generateBackup();
    const pagesLink = this.pagesLink;
    const startIndex = pagesLink.indexOf(initial);
    if (startIndex < 0) return;
    let padding = 1;
    let lastNumber = -1;

    for (let index = 0; index < pagesLink.length; index++) {
      const pageLink = pagesLink[index];
      if (index < startIndex) {
        lastNumber = Math.max(lastNumber, pageLink.fileLinkLeftPage, pageLink.fileLinkRightPage);
        continue;
      }
      if (index + padding < pagesLink.length) {
        const nextPage = pagesLink[index + padding];
        if (nextPage.isDualImage) {
          addLeftPageLink(pageLink, nextPage);
          addRightPageLink(pageLink, nextPage);
          clearPageLink(nextPage);
        } else if (nextPage.fileLinkLeftPage !== PAGE_EMPTY) {
          addLeftPageLink(pageLink, nextPage);
          clearPageLink(nextPage);
        } else {
          clearPageLink(pageLink);
        }
        lastNumber = Math.max(lastNumber, pageLink.fileLinkLeftPage, pageLink.fileLinkRightPage);
        padding++;
      } else if (this.pagesNotLink.length) {
        const found = this.pagesNotLink.find(p => p.fileLinkLeftPage > lastNumber);
        if (found) {
          addLeftPageLink(pageLink, found);
          lastNumber = Math.max(lastNumber, found.fileLinkLeftPage);
          this.pagesNotLink = this.pagesNotLink.filter(p => p !== found);
        }
      } else {
        clearPageLink(pageLink);
      }
    }
    this.syncFileLists();
  }

  reorderNotLinked(initial: LinkedPage): void {
    if (!this.hasLinkedFile || !this.pagesNotLink.length) return;
    if (initial.fileLinkLeftPage !== PAGE_EMPTY) return;
    this.generateBackup();
    const pagesLink = this.pagesLink;
    const startIndex = pagesLink.indexOf(initial);
    if (startIndex < 0) return;
    let lastNumber = -1;

    for (let index = 0; index < pagesLink.length; index++) {
      const pageLink = pagesLink[index];
      lastNumber = Math.max(lastNumber, pageLink.fileLinkLeftPage, pageLink.fileLinkRightPage);
      if (index < startIndex) continue;
      if (pageLink.fileLinkLeftPage !== PAGE_EMPTY) break;
      const found = this.pagesNotLink.find(p => p.fileLinkLeftPage > lastNumber);
      if (found) {
        addLeftPageLink(pageLink, found);
        lastNumber = Math.max(lastNumber, found.fileLinkLeftPage);
        this.pagesNotLink = this.pagesNotLink.filter(p => p !== found);
      }
    }
    this.syncFileLists();
  }

  addNotLinkedFromSlot(page: LinkedPage, isRight: boolean): void {
    this.generateBackup();
    if (isRight) {
      if (page.isDualImage) {
        this.pagesNotLink.push(
          createNotLinkedPage(
            page.idFile,
            page.fileLinkRightPage,
            page.fileLinkLeftPages,
            page.fileLinkRightPageName,
            page.fileLinkRightPagePath,
            page.isFileRightDualPage,
            page.imageRightFileLinkPage
          )
        );
        clearRightPageLink(page);
      }
    } else if (page.isDualImage) {
      if (page.fileLinkLeftPage !== PAGE_EMPTY) {
        this.pagesNotLink.push(
          createNotLinkedPage(
            page.idFile,
            page.fileLinkLeftPage,
            page.fileLinkLeftPages,
            page.fileLinkLeftPageName,
            page.fileLinkLeftPagePath,
            page.isFileLeftDualPage,
            page.imageLeftFileLinkPage
          )
        );
      }
      clearLeftPageLink(page, true);
    } else if (page.fileLinkLeftPage !== PAGE_EMPTY) {
      this.pagesNotLink.push(
        createNotLinkedPage(
          page.idFile,
          page.fileLinkLeftPage,
          page.fileLinkLeftPages,
          page.fileLinkLeftPageName,
          page.fileLinkLeftPagePath,
          page.isFileLeftDualPage,
          page.imageLeftFileLinkPage
        )
      );
      clearLeftPageLink(page);
    }
    this.syncFileLists();
  }

  markDualFromImage(page: LinkedPage, slot: 'manga' | 'left' | 'right', width: number, height: number): void {
    if (!height) return;
    const isDual = width / height > 0.9;
    if (slot === 'manga') page.isMangaDualPage = isDual;
    else if (slot === 'left') page.isFileLeftDualPage = isDual;
    else page.isFileRightDualPage = isDual;
  }

  // ── helpers ───────────────────────────────────────────────────────

  private addNotLinkedInternal(page: LinkedPage): void {
    if (page.fileLinkLeftPage !== PAGE_EMPTY) {
      this.pagesNotLink.push(
        createNotLinkedPage(
          page.idFile,
          page.fileLinkLeftPage,
          page.fileLinkLeftPages,
          page.fileLinkLeftPageName,
          page.fileLinkLeftPagePath,
          page.isFileLeftDualPage,
          page.imageLeftFileLinkPage
        )
      );
    }
    if (page.isDualImage) {
      this.pagesNotLink.push(
        createNotLinkedPage(
          page.idFile,
          page.fileLinkRightPage,
          page.fileLinkLeftPages,
          page.fileLinkRightPageName,
          page.fileLinkRightPagePath,
          page.isFileRightDualPage,
          page.imageRightFileLinkPage
        )
      );
      clearRightPageLink(page);
    }
  }

  private stripRuntime(page: LinkedPage): LinkedPage {
    const {
      imageMangaPage: _m,
      imageLeftFileLinkPage: _l,
      imageRightFileLinkPage: _r,
      ...rest
    } = page;
    return rest;
  }

  private syncFileLists(): void {
    this.linkedFile.pagesLink = this.pagesLink;
    this.linkedFile.pagesNotLink = this.pagesNotLink;
    this.linkedFile.language = this.language;
  }
}
