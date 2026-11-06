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
  | 'TUMBLR_POST';

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
  | 'MINIMALIST_LIST';

export type SocialTheme =
  | 'AMBIENT_DYNAMIC'
  | 'DARK_SLATE'
  | 'OLED_BLACK'
  | 'WARM_PAPER'
  | 'CYBER_NEON';

export interface SocialRenderOptions {
  preset: SocialPlatformPreset;
  template: SocialLayoutTemplate;
  theme: SocialTheme;
  title: string;
  subtitle: string;
  userHandle?: string;
  showStatsBanner: boolean;
  showCoverTitles: boolean;
  showProgressBadge: boolean;
  showBranding: boolean;
}

