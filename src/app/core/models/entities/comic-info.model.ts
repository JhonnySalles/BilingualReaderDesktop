export interface ComicInfoPage {
  imageIndex: number;
  type?: string;
  bookmark?: string;
}

export interface ComicInfo {
  id?: number;
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
  colorist?: string;
  letterer?: string;
  coverArtist?: string;
  editor?: string;
  translator?: string;
  publisher?: string;
  genre?: string;
  web?: string;
  pageCount?: number;
  languageISO?: string;
  format?: string;
  manga?: string;
  characters?: string;
  teams?: string;
  locations?: string;
  scanInformation?: string;
  storyArc?: string;
  seriesGroup?: string;
  ageRating?: string;
  tags?: string;
  pages?: ComicInfoPage[];
}

