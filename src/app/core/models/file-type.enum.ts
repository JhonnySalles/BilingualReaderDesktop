export * from './enums/app-enums';

export const MANGA_EXTENSIONS: Record<string, any> = {
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

export function getMangaFileType(filePath: string): any {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return MANGA_EXTENSIONS[ext] || 'UNKNOWN';
}

export function isMangaFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return ext in MANGA_EXTENSIONS;
}
