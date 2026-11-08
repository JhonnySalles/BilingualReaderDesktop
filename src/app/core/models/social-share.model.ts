import { HistoryContentType } from './entities/history.model';

export interface SocialShareItem {
  type: HistoryContentType;
  fkReference: number;
  fkLibrary: number;
  title: string;
  author: string;
  series: string;
  volume: string;
  fileType: string;
  coverPath: string | null;
  bookMark: number;
  pages: number;
  completed: boolean;
  pagesReadInPeriod: number;
  secondsReadInPeriod: number;
  lastAccessInPeriod: string;
}

export type SocialPlatformPreset =
  | 'INSTAGRAM_STORY'
  | 'INSTAGRAM_POST'
  | 'INSTAGRAM_SQUARE'
  | 'TWITTER_POST'
  | 'TUMBLR_POST'
  | 'SINGLE_FULL_IMAGE';

export interface PlatformPresetConfig {
  id: SocialPlatformPreset;
  label: string;
  sublabel: string;
  width: number;
  height: number;
  aspectRatioLabel: string;
  recommendedTemplate: SocialLayoutTemplate;
}

export type SocialLayoutTemplate =
  | 'BENTO_GRID'
  | 'PERSPECTIVE_SHOWCASE'
  | 'WRAPPED_STATS'
  | 'MINIMALIST_LIST'
  | 'MAGAZINE_HERO'
  | 'POLAROID_GALLERY'
  | 'PODIUM_RANKING'
  | 'GLASS_CARDS';

export type SocialTheme =
  | 'AMBIENT_DYNAMIC'
  | 'COVER_BLUR_MOSAIC'
  | 'DARK_SLATE'
  | 'OLED_BLACK'
  | 'AURORA_BOREALIS'
  | 'SUNSET_SYNTH'
  | 'ROYAL_GOLD'
  | 'MATCHA_BOTANICAL'
  | 'CYBER_NEON'
  | 'WARM_PAPER'
  | 'SAKURA_DREAM'
  | 'NORDIC_FROST'
  | 'CUSTOM';

export type SocialBackgroundPattern = 'GRID' | 'DOTS' | 'ORBS' | 'NONE';

export interface SocialCustomThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textMode: 'AUTO' | 'LIGHT' | 'DARK';
}

export interface SocialRenderOptions {
  preset: SocialPlatformPreset;
  template: SocialLayoutTemplate;
  theme: SocialTheme;
  title: string;
  subtitle: string;
  userHandle?: string;
  showStatsBanner: boolean;
  showCoverTitles: boolean;
  useCardBlur?: boolean;
  showProgressBadge: boolean;
  showBranding: boolean;
  itemsPerPage?: number;
  pageIndex?: number;
  totalPages?: number;
  customTheme?: SocialCustomThemeConfig;
  backgroundPattern?: SocialBackgroundPattern;
}

export interface SocialRenderedPage {
  pageNumber: number;
  totalPages: number;
  width: number;
  height: number;
  dataUrl: string;
  itemsCount: number;
}

