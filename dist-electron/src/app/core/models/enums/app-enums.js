"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOOK_EXTENSION_TYPES = exports.MANGA_EXTENSIONS = exports.FontType = exports.Color = exports.Themes = exports.ThemeMode = exports.Order = exports.ListMode = exports.Libraries = exports.Languages = exports.FileType = void 0;
exports.getMangaFileType = getMangaFileType;
exports.isMangaFile = isMangaFile;
exports.getMangaFileTypes = getMangaFileTypes;
exports.getBookFileTypes = getBookFileTypes;
exports.getBookFileType = getBookFileType;
exports.isBookFile = isBookFile;
exports.compareFileTypeExtension = compareFileTypeExtension;
var FileType;
(function (FileType) {
    FileType["UNKNOWN"] = "UNKNOWN";
    FileType["IMAGE"] = "IMAGE";
    // Manga e Livro
    FileType["EPUB"] = "EPUB";
    FileType["EPUB3"] = "EPUB3";
    // Livro
    FileType["PDF"] = "PDF";
    FileType["MOBI"] = "MOBI";
    FileType["DJVU"] = "DJVU";
    FileType["FB2"] = "FB2";
    FileType["TXT"] = "TXT";
    FileType["RTF"] = "RTF";
    FileType["AZW"] = "AZW";
    FileType["AZW3"] = "AZW3";
    FileType["HTML"] = "HTML";
    FileType["DOC"] = "DOC";
    FileType["DOCX"] = "DOCX";
    FileType["OPDS"] = "OPDS";
    FileType["TIFF"] = "TIFF";
    FileType["ODT"] = "ODT";
    FileType["MD"] = "MD";
    FileType["MHT"] = "MHT";
    // Mangá / Comic
    FileType["CBZ"] = "CBZ";
    FileType["CBR"] = "CBR";
    FileType["CB7"] = "CB7";
    FileType["CBT"] = "CBT";
    FileType["ZIP"] = "ZIP";
    FileType["RAR"] = "RAR";
    FileType["SEVENZ"] = "7Z";
    FileType["TAR"] = "TAR";
    FileType["DIRECTORY"] = "DIR";
})(FileType || (exports.FileType = FileType = {}));
var Languages;
(function (Languages) {
    Languages["PORTUGUESE"] = "pt";
    Languages["ENGLISH"] = "en";
    Languages["JAPANESE"] = "ja";
    Languages["SPANISH"] = "es";
    Languages["FRENCH"] = "fr";
    Languages["GERMAN"] = "de";
    Languages["ITALIAN"] = "it";
    Languages["CHINESE"] = "zh";
    Languages["KOREAN"] = "ko";
})(Languages || (exports.Languages = Languages = {}));
var Libraries;
(function (Libraries) {
    Libraries["DEFAULT"] = "DEFAULT";
    Libraries["MANGA"] = "MANGA";
    Libraries["BOOK"] = "BOOK";
})(Libraries || (exports.Libraries = Libraries = {}));
var ListMode;
(function (ListMode) {
    ListMode["FULL"] = "FULL";
    ListMode["ADD"] = "ADD";
    ListMode["REM"] = "REM";
    ListMode["MOD"] = "MOD";
})(ListMode || (exports.ListMode = ListMode = {}));
var Order;
(function (Order) {
    Order["Name"] = "Name";
    Order["Date"] = "Date";
    Order["LastAccess"] = "LastAccess";
    Order["Favorite"] = "Favorite";
    Order["Author"] = "Author";
    Order["Genre"] = "Genre";
    Order["Series"] = "Series";
})(Order || (exports.Order = Order = {}));
var ThemeMode;
(function (ThemeMode) {
    ThemeMode["LIGHT"] = "LIGHT";
    ThemeMode["DARK"] = "DARK";
    ThemeMode["SYSTEM"] = "SYSTEM";
})(ThemeMode || (exports.ThemeMode = ThemeMode = {}));
var Themes;
(function (Themes) {
    Themes["DEFAULT"] = "DEFAULT";
    Themes["DARK"] = "DARK";
    Themes["LIGHT"] = "LIGHT";
    Themes["GLASSMORPHISM"] = "GLASSMORPHISM";
    Themes["AMOLEDS"] = "AMOLED";
})(Themes || (exports.Themes = Themes = {}));
var Color;
(function (Color) {
    Color["RED"] = "RED";
    Color["BLUE"] = "BLUE";
    Color["GREEN"] = "GREEN";
    Color["YELLOW"] = "YELLOW";
    Color["PURPLE"] = "PURPLE";
    Color["ORANGE"] = "ORANGE";
    Color["PINK"] = "PINK";
    Color["GRAY"] = "GRAY";
})(Color || (exports.Color = Color = {}));
var FontType;
(function (FontType) {
    FontType["DEFAULT"] = "DEFAULT";
    FontType["SERIF"] = "SERIF";
    FontType["SANSSERIF"] = "SANSSERIF";
    FontType["MONOSPACE"] = "MONOSPACE";
    FontType["ROBOTO"] = "ROBOTO";
    FontType["INTER"] = "INTER";
})(FontType || (exports.FontType = FontType = {}));
exports.MANGA_EXTENSIONS = {
    cbz: FileType.CBZ,
    cbr: FileType.CBR,
    cb7: FileType.CB7,
    cbt: FileType.CBT,
    zip: FileType.ZIP,
    rar: FileType.RAR,
    '7z': FileType.SEVENZ,
    tar: FileType.TAR,
    tgz: FileType.TAR,
    epub: FileType.EPUB,
    epub3: FileType.EPUB3
};
function getMangaFileType(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    return exports.MANGA_EXTENSIONS[ext] ?? FileType.UNKNOWN;
}
function isMangaFile(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    return ext in exports.MANGA_EXTENSIONS;
}
/** Comic / manga archive and related formats (Android FileType.getManga). */
function getMangaFileTypes() {
    return [
        FileType.CBZ,
        FileType.CBR,
        FileType.CB7,
        FileType.CBT,
        FileType.ZIP,
        FileType.RAR,
        FileType.SEVENZ,
        FileType.TAR,
        FileType.DIRECTORY,
        FileType.EPUB,
        FileType.EPUB3
    ];
}
/** Book / ebook formats (Android FileType.getBook). */
function getBookFileTypes() {
    return [
        FileType.EPUB,
        FileType.EPUB3,
        FileType.PDF,
        FileType.MOBI,
        FileType.DJVU,
        FileType.FB2,
        FileType.TXT,
        FileType.RTF,
        FileType.AZW,
        FileType.AZW3,
        FileType.HTML,
        FileType.DOC,
        FileType.DOCX,
        FileType.OPDS,
        FileType.TIFF,
        FileType.ODT,
        FileType.MD,
        FileType.MHT
    ];
}
/** Extension → FileType for book scanner / open dialog. */
exports.BOOK_EXTENSION_TYPES = {
    epub: FileType.EPUB,
    kepub: FileType.EPUB,
    epub3: FileType.EPUB3,
    pdf: FileType.PDF,
    xps: FileType.UNKNOWN,
    mobi: FileType.MOBI,
    azw: FileType.AZW,
    azw3: FileType.AZW3,
    azw4: FileType.AZW3,
    pdb: FileType.MOBI,
    prc: FileType.MOBI,
    djvu: FileType.DJVU,
    fb2: FileType.FB2,
    txt: FileType.TXT,
    rtf: FileType.RTF,
    html: FileType.HTML,
    htm: FileType.HTML,
    xhtml: FileType.HTML,
    xhtm: FileType.HTML,
    htmlz: FileType.HTML,
    pmlz: FileType.UNKNOWN,
    doc: FileType.DOC,
    docx: FileType.DOCX,
    odt: FileType.ODT,
    md: FileType.MD,
    markdown: FileType.MD,
    mht: FileType.MHT,
    mhtml: FileType.MHT,
    shtml: FileType.HTML
};
function getBookFileType(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    return exports.BOOK_EXTENSION_TYPES[ext] ?? FileType.UNKNOWN;
}
function isBookFile(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    return ext in exports.BOOK_EXTENSION_TYPES;
}
/** True when free-text looks like a file extension for this type. */
function compareFileTypeExtension(fileType, query) {
    if (!fileType || !query)
        return false;
    const type = String(fileType).toLowerCase();
    const q = query.toLowerCase().replace(/^\./, '');
    return type.includes(q) || type === q;
}
