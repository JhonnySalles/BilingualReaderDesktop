"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmptyLinkedPage = createEmptyLinkedPage;
exports.createMangaSpinePage = createMangaSpinePage;
exports.createNotLinkedPage = createNotLinkedPage;
exports.cloneLinkedPage = cloneLinkedPage;
exports.mergeLinkedPage = mergeLinkedPage;
exports.addLeftPageLink = addLeftPageLink;
exports.addLeftFromRightPageLink = addLeftFromRightPageLink;
exports.addRightPageLink = addRightPageLink;
exports.addRightFromLeftPageLink = addRightFromLeftPageLink;
exports.clearRightPageLink = clearRightPageLink;
exports.clearLeftPageLink = clearLeftPageLink;
exports.movePageLinkRightToLeft = movePageLinkRightToLeft;
exports.clearPageLink = clearPageLink;
exports.createEmptyLinkedFile = createEmptyLinkedFile;
const app_enums_1 = require("../enums/app-enums");
const page_link_enums_1 = require("../enums/page-link-enums");
function createEmptyLinkedPage(partial) {
    return {
        id: partial?.id,
        idFile: partial?.idFile ?? null,
        mangaPage: partial?.mangaPage ?? page_link_enums_1.PAGE_EMPTY,
        mangaPages: partial?.mangaPages ?? 0,
        mangaPageName: partial?.mangaPageName ?? '',
        mangaPagePath: partial?.mangaPagePath ?? '',
        fileLinkLeftPage: partial?.fileLinkLeftPage ?? page_link_enums_1.PAGE_EMPTY,
        fileLinkLeftPages: partial?.fileLinkLeftPages ?? 0,
        fileLinkLeftPageName: partial?.fileLinkLeftPageName ?? '',
        fileLinkLeftPagePath: partial?.fileLinkLeftPagePath ?? '',
        fileLinkRightPage: partial?.fileLinkRightPage ?? page_link_enums_1.PAGE_EMPTY,
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
function createMangaSpinePage(mangaPage, mangaPages, mangaPageName, mangaPagePath, imageMangaPage) {
    return createEmptyLinkedPage({
        mangaPage,
        mangaPages,
        mangaPageName,
        mangaPagePath,
        imageMangaPage: imageMangaPage ?? null
    });
}
function createNotLinkedPage(idFile, fileLinkLeftPage, fileLinkLeftPages, fileLinkLeftPageName, fileLinkLeftPagePath, isFileLeftDualPage = false, imageLeftFileLinkPage) {
    return createEmptyLinkedPage({
        idFile,
        mangaPage: page_link_enums_1.PAGE_EMPTY,
        isNotLinked: true,
        fileLinkLeftPage,
        fileLinkLeftPages,
        fileLinkLeftPageName,
        fileLinkLeftPagePath,
        isFileLeftDualPage,
        imageLeftFileLinkPage: imageLeftFileLinkPage ?? null
    });
}
function cloneLinkedPage(page) {
    return { ...page };
}
function mergeLinkedPage(target, another) {
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
function addLeftPageLink(target, another) {
    target.fileLinkLeftPage = another.fileLinkLeftPage;
    target.fileLinkLeftPages = another.fileLinkLeftPages;
    target.fileLinkLeftPageName = another.fileLinkLeftPageName;
    target.fileLinkLeftPagePath = another.fileLinkLeftPagePath;
    target.imageLeftFileLinkPage = another.imageLeftFileLinkPage;
    target.isFileLeftDualPage = another.isFileLeftDualPage;
}
function addLeftFromRightPageLink(target, another) {
    target.fileLinkLeftPage = another.fileLinkRightPage;
    target.fileLinkLeftPages = another.fileLinkLeftPages;
    target.fileLinkLeftPageName = another.fileLinkRightPageName;
    target.fileLinkLeftPagePath = another.fileLinkRightPagePath;
    target.imageLeftFileLinkPage = another.imageRightFileLinkPage;
    target.isFileLeftDualPage = another.isFileRightDualPage;
}
function addRightPageLink(target, another) {
    if (target.fileLinkLeftPage === page_link_enums_1.PAGE_EMPTY) {
        target.fileLinkLeftPage = another.fileLinkRightPage !== page_link_enums_1.PAGE_EMPTY
            ? another.fileLinkRightPage
            : another.fileLinkLeftPage;
        target.fileLinkLeftPageName = another.fileLinkRightPage !== page_link_enums_1.PAGE_EMPTY
            ? another.fileLinkRightPageName
            : another.fileLinkLeftPageName;
        target.fileLinkLeftPagePath = another.fileLinkRightPage !== page_link_enums_1.PAGE_EMPTY
            ? another.fileLinkRightPagePath
            : another.fileLinkLeftPagePath;
        target.imageLeftFileLinkPage = another.fileLinkRightPage !== page_link_enums_1.PAGE_EMPTY
            ? another.imageRightFileLinkPage
            : another.imageLeftFileLinkPage;
        target.isFileLeftDualPage = another.fileLinkRightPage !== page_link_enums_1.PAGE_EMPTY
            ? another.isFileRightDualPage
            : another.isFileLeftDualPage;
        if (another.fileLinkLeftPages) {
            target.fileLinkLeftPages = another.fileLinkLeftPages;
        }
    }
    else {
        target.fileLinkRightPage = another.fileLinkRightPage !== page_link_enums_1.PAGE_EMPTY
            ? another.fileLinkRightPage
            : another.fileLinkLeftPage;
        target.fileLinkRightPageName = another.fileLinkRightPage !== page_link_enums_1.PAGE_EMPTY
            ? another.fileLinkRightPageName
            : another.fileLinkLeftPageName;
        target.fileLinkRightPagePath = another.fileLinkRightPage !== page_link_enums_1.PAGE_EMPTY
            ? another.fileLinkRightPagePath
            : another.fileLinkLeftPagePath;
        target.imageRightFileLinkPage = another.fileLinkRightPage !== page_link_enums_1.PAGE_EMPTY
            ? another.imageRightFileLinkPage
            : another.imageLeftFileLinkPage;
        target.isFileRightDualPage = another.fileLinkRightPage !== page_link_enums_1.PAGE_EMPTY
            ? another.isFileRightDualPage
            : another.isFileLeftDualPage;
    }
    target.isDualImage = target.fileLinkRightPage !== page_link_enums_1.PAGE_EMPTY;
}
function addRightFromLeftPageLink(target, another) {
    if (target.fileLinkLeftPage === page_link_enums_1.PAGE_EMPTY) {
        addLeftPageLink(target, another);
    }
    else {
        target.fileLinkRightPage = another.fileLinkLeftPage;
        target.fileLinkRightPageName = another.fileLinkLeftPageName;
        target.fileLinkRightPagePath = another.fileLinkLeftPagePath;
        target.imageRightFileLinkPage = another.imageLeftFileLinkPage;
        target.isFileRightDualPage = another.isFileLeftDualPage;
        target.isDualImage = true;
    }
}
function clearRightPageLink(target) {
    target.fileLinkRightPage = page_link_enums_1.PAGE_EMPTY;
    target.fileLinkRightPageName = '';
    target.fileLinkRightPagePath = '';
    target.imageRightFileLinkPage = null;
    target.isDualImage = false;
    target.isFileRightDualPage = false;
}
function clearLeftPageLink(target, canMoved = false) {
    if (canMoved && target.fileLinkRightPage !== page_link_enums_1.PAGE_EMPTY) {
        target.fileLinkLeftPage = target.fileLinkRightPage;
        target.fileLinkLeftPageName = target.fileLinkRightPageName;
        target.fileLinkLeftPagePath = target.fileLinkRightPagePath;
        target.imageLeftFileLinkPage = target.imageRightFileLinkPage;
        target.isFileLeftDualPage = target.isFileRightDualPage;
        clearRightPageLink(target);
        return true;
    }
    target.fileLinkLeftPage = page_link_enums_1.PAGE_EMPTY;
    target.fileLinkLeftPages = 0;
    target.fileLinkLeftPageName = '';
    target.fileLinkLeftPagePath = '';
    target.imageLeftFileLinkPage = null;
    target.isFileLeftDualPage = false;
    return false;
}
function movePageLinkRightToLeft(target) {
    target.fileLinkLeftPage = target.fileLinkRightPage;
    target.fileLinkLeftPageName = target.fileLinkRightPageName;
    target.fileLinkLeftPagePath = target.fileLinkRightPagePath;
    target.imageLeftFileLinkPage = target.imageRightFileLinkPage;
    target.isFileLeftDualPage = target.isFileRightDualPage;
    clearRightPageLink(target);
}
function clearPageLink(target) {
    target.fileLinkLeftPage = page_link_enums_1.PAGE_EMPTY;
    target.fileLinkLeftPages = 0;
    target.fileLinkLeftPageName = '';
    target.fileLinkLeftPagePath = '';
    target.fileLinkRightPage = page_link_enums_1.PAGE_EMPTY;
    target.fileLinkRightPageName = '';
    target.fileLinkRightPagePath = '';
    target.imageLeftFileLinkPage = null;
    target.imageRightFileLinkPage = null;
    target.isFileLeftDualPage = false;
    target.isFileRightDualPage = false;
    target.isNotLinked = false;
    target.isDualImage = false;
}
function createEmptyLinkedFile(idManga) {
    const now = new Date().toISOString();
    return {
        idManga,
        pages: 0,
        path: '',
        name: '',
        type: '',
        folder: '',
        language: app_enums_1.Languages.PORTUGUESE,
        dateCreate: now,
        lastAccess: now,
        lastAlteration: now,
        pagesLink: [],
        pagesNotLink: []
    };
}
