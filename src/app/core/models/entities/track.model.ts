import { BaseEntity } from '../interfaces/base-entity.model';

export type TrackStatus = 'READING' | 'COMPLETED' | 'ON_HOLD' | 'DROPPED' | 'PLAN_TO_READ';

export interface Track extends BaseEntity {
  id?: number;
  malId?: number | null;
  aniId?: number | null;
  fkLibrary: number; // Mapeia para id_library no SQLite
  titleRegex: string;
  title?: string | null;
  totalVolumes?: number | null;
  totalChapters?: number | null;
  status?: TrackStatus | string | null;
  score?: number | null;
  scoreDate?: string | null;
  chaptersRead: number;
  volumesRead: number;
  lastSyncDate?: string | null;

  // Campos virtuais de visualização / UI
  libraryTitle?: string;
  libraryType?: 'MANGA' | 'BOOK';
  matchedCount?: number;
}

export interface TrackerMatchedItem {
  id: number;
  title: string;
  name: string;
  coverPath?: string | null;
  bookMark?: number;
  pages?: number;
  fileSize?: number;
  fileType?: string;
  type: 'MANGA' | 'BOOK';
  series?: string;
  author?: string;
  publisher?: string;
  completed?: boolean;
}

export interface TrackerLibraryOption {
  id: number;
  title: string;
  type: 'MANGA' | 'BOOK';
  displayName: string;
  path?: string;
}

export interface ExternalTrackerSearchResult {
  id: number;
  title: string;
  score?: number | null;
  coverImage?: string | null;
  totalChapters?: number | null;
  totalVolumes?: number | null;
  status?: string | null;
  mediaType?: string | null;
}

export interface ExternalTrackerUserStatus {
  inList: boolean;
  status?: string | null;
  score?: number | null;
  chaptersRead?: number;
  volumesRead?: number;
  updatedAt?: string | null;
}

export interface ExternalTrackerUpdatePayload {
  mediaId: number;
  status?: string | null;
  score?: number | null;
  chaptersRead?: number;
  volumesRead?: number;
}

export interface TrackerAuthStatus {
  authenticated: boolean;
  username?: string | null;
  avatar?: string | null;
  expiresAt?: number | null;
}

