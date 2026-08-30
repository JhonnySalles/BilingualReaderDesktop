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

export const MANGA_EXTENSIONS: Record<string, string> = {
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

export function getMangaFileType(filePath: string): FileType {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const typeStr = MANGA_EXTENSIONS[ext];
  if (typeStr && typeStr in FileType) {
    return (FileType as any)[typeStr];
  }
  return FileType.UNKNOWN;
}

export function isMangaFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return ext in MANGA_EXTENSIONS;
}

