import * as path from 'path';

export type EbookConverterId =
  | 'passthrough'
  | 'libmobi'
  | 'document-js'
  | 'fb2'
  | 'pandoc'
  | 'calibre';

/** Preference for conversion cascade (Settings → Sistema). */
export type EbookConvertMode = 'auto' | 'calibre' | 'native';

export const EBOOK_CONVERT_MODE_KEY = 'EBOOK_CONVERT_MODE';
export const DEFAULT_EBOOK_CONVERT_MODE: EbookConvertMode = 'auto';

export const NATIVE_CONVERTER_IDS: ReadonlySet<EbookConverterId> = new Set([
  'passthrough',
  'libmobi',
  'document-js',
  'fb2'
]);

export function normalizeEbookConvertMode(value: unknown): EbookConvertMode {
  if (value === 'calibre' || value === 'native' || value === 'auto') return value;
  return DEFAULT_EBOOK_CONVERT_MODE;
}

export interface EbookIrChapter {
  id: string;
  title: string;
  html: string;
}

export interface EbookIrAsset {
  href: string;
  mediaType: string;
  data: Buffer;
}

export interface EbookIr {
  title: string;
  author?: string;
  language?: string;
  chapters: EbookIrChapter[];
  assets: EbookIrAsset[];
  toc?: Array<{ title: string; href: string }>;
}

export interface EbookConverterAdapter {
  readonly id: EbookConverterId;
  readonly label: string;
  /** Higher = tried first among canHandle matches. */
  readonly priority: number;
  isAvailable(): boolean;
  canHandle(ext: string): boolean;
  convert(inputPath: string, outputEpubPath: string): Promise<void>;
}

export interface AdapterStatus {
  id: EbookConverterId;
  label: string;
  available: boolean;
  detail?: string | null;
}

export class EbookConversionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'missing_tools'
      | 'unsupported'
      | 'conversion_failed'
      | 'drm'
      | 'not_found'
  ) {
    super(message);
    this.name = 'EbookConversionError';
  }
}

export function normalizeExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.gz' && filePath.toLowerCase().endsWith('.tar.gz')) return '.tar.gz';
  return ext;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function escapeHtml(text: string): string {
  return escapeXml(text);
}
