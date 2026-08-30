"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MANGA_EXTENSIONS = exports.FontType = exports.Color = exports.Themes = exports.ThemeMode = exports.Order = exports.ListMode = exports.Libraries = exports.Languages = exports.FileType = void 0;
exports.getMangaFileType = getMangaFileType;
exports.isMangaFile = isMangaFile;
var FileType;
(function (FileType) {
    FileType["UNKNOWN"] = "UNKNOWN";
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
    cbz: 'CBZ',
    cbr: 'CBR',
    cb7: 'CB7',
    cbt: 'CBT',
    zip: 'ZIP',
    rar: 'RAR',
    '7z': '7Z',
    tar: 'TAR',
    epub: 'EPUB',
    epub3: 'EPUB3'
};
function getMangaFileType(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const typeStr = exports.MANGA_EXTENSIONS[ext];
    if (typeStr && typeStr in FileType) {
        return FileType[typeStr];
    }
    return FileType.UNKNOWN;
}
function isMangaFile(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    return ext in exports.MANGA_EXTENSIONS;
}
