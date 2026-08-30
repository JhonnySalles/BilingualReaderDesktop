export interface ComicInfoPage {
  imageIndex: number;
  type?: string;
  bookmark?: string;
}

export interface ComicInfo {
  title?: string;
  series?: string;
  number?: string;
  volume?: string;
  summary?: string;
  notes?: string;
  year?: number;
  month?: number;
  day?: number;
  writer?: string;
  penciller?: string;
  inker?: string;
  publisher?: string;
  genre?: string;
  pageCount?: number;
  pages?: ComicInfoPage[];
}
