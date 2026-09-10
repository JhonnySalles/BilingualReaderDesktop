export enum FileType {
  UNKNOWN = 'UNKNOWN',
  IMAGE = 'IMAGE',
  
  // Manga e Livro
  EPUB = 'EPUB',
  EPUB3 = 'EPUB3',

  // Livro
  PDF = 'PDF',
  MOBI = 'MOBI',
  DJVU = 'DJVU',
  FB2 = 'FB2',
  TXT = 'TXT',
  RTF = 'RTF',
  AZW = 'AZW',
  AZW3 = 'AZW3',
  HTML = 'HTML',
  DOC = 'DOC',
  DOCX = 'DOCX',
  OPDS = 'OPDS',
  TIFF = 'TIFF',
  ODT = 'ODT',
  MD = 'MD',
  MHT = 'MHT',

  // Mangá / Comic
  CBZ = 'CBZ',
  CBR = 'CBR',
  CB7 = 'CB7',
  CBT = 'CBT',
  ZIP = 'ZIP',
  RAR = 'RAR',
  SEVENZ = '7Z',
  TAR = 'TAR',
  DIRECTORY = 'DIR'
}

export enum Languages {
  PORTUGUESE = 'pt',
  ENGLISH = 'en',
  JAPANESE = 'ja',
  SPANISH = 'es',
  FRENCH = 'fr',
  GERMAN = 'de',
  ITALIAN = 'it',
  CHINESE = 'zh',
  KOREAN = 'ko'
}

export enum Libraries {
  DEFAULT = 'DEFAULT',
  MANGA = 'MANGA',
  BOOK = 'BOOK'
}

export enum ListMode {
  FULL = 'FULL',
  ADD = 'ADD',
  REM = 'REM',
  MOD = 'MOD'
}

export enum Order {
  Name = 'Name',
  Date = 'Date',
  LastAccess = 'LastAccess',
  Favorite = 'Favorite',
  Author = 'Author',
  Genre = 'Genre',
  Series = 'Series'
}

export enum ThemeMode {
  LIGHT = 'LIGHT',
  DARK = 'DARK',
  SYSTEM = 'SYSTEM'
}

export enum Themes {
  DEFAULT = 'DEFAULT',
  DARK = 'DARK',
  LIGHT = 'LIGHT',
  GLASSMORPHISM = 'GLASSMORPHISM',
  AMOLEDS = 'AMOLED'
}

export enum Color {
  RED = 'RED',
  BLUE = 'BLUE',
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  PURPLE = 'PURPLE',
  ORANGE = 'ORANGE',
  PINK = 'PINK',
  GRAY = 'GRAY'
}

export enum FontType {
  DEFAULT = 'DEFAULT',
  SERIF = 'SERIF',
  SANSSERIF = 'SANSSERIF',
  MONOSPACE = 'MONOSPACE',
  ROBOTO = 'ROBOTO',
  INTER = 'INTER'
}

export const MANGA_EXTENSIONS: Record<string, FileType> = {
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

export function getMangaFileType(filePath: string): FileType {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return MANGA_EXTENSIONS[ext] ?? FileType.UNKNOWN;
}

export function isMangaFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return ext in MANGA_EXTENSIONS;
}

/** Comic / manga archive and related formats (Android FileType.getManga). */
export function getMangaFileTypes(): FileType[] {
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
export function getBookFileTypes(): FileType[] {
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
export const BOOK_EXTENSION_TYPES: Record<string, FileType> = {
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

export function getBookFileType(filePath: string): FileType {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return BOOK_EXTENSION_TYPES[ext] ?? FileType.UNKNOWN;
}

export function isBookFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return ext in BOOK_EXTENSION_TYPES;
}

/** True when free-text looks like a file extension for this type. */
export function compareFileTypeExtension(fileType: string | FileType | undefined | null, query: string): boolean {
  if (!fileType || !query) return false;
  const type = String(fileType).toLowerCase();
  const q = query.toLowerCase().replace(/^\./, '');
  return type.includes(q) || type === q;
}

