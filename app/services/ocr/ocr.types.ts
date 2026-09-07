export interface OcrBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrResult {
  fullText: string;
  blocks: OcrBlock[];
  engine: 'tesseract' | 'windows';
}

export type OcrEnginePref = 'auto' | 'tesseract' | 'windows';

export interface OcrRecognizeInput {
  /** Absolute path to image file (full page). */
  imagePath?: string;
  /** PNG/JPEG data URL for crop region. */
  dataUrl?: string;
  lang: string;
  mode: 'region' | 'page';
  engine?: OcrEnginePref;
}

export interface OcrProvider {
  id: 'tesseract' | 'windows';
  isAvailable(): Promise<boolean>;
  recognize(input: OcrRecognizeInput): Promise<OcrResult>;
}
