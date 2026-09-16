import { ShareHistory } from '../models/entities/share-item.model';

export interface LocalHistoryLike {
  id?: number;
  page_start?: number;
  page_end?: number;
  pages?: number;
  completed?: number | boolean;
  volume?: string;
  chapters_read?: number;
  date_time_start?: string;
  date_time_end?: string;
  seconds_read?: number;
  average_time_page?: number;
  use_tts?: number | boolean;
}

export interface HistoryReconcileResult {
  /** Reconciled fields that should be stored locally (if changed). */
  localUpdate?: {
    pageStart: number;
    pageEnd: number;
    pages: number;
    completed: boolean;
    volume: string;
    chaptersRead: number;
    dateTimeEnd: string;
    secondsRead: number;
    averageTimeByPage: number;
    useTTS: boolean;
  };
  /** Whether the local database row was updated. */
  localChanged: boolean;
  /** Whether the cloud entity needs an upload because local data is more complete / has higher reading time. */
  needsCloudUpload: boolean;
}

/**
 * Reconciles a single matching history session between local SQLite and cloud (Firestore / Google Drive).
 * 
 * Rules:
 * 1. Progress (pages read, completed) takes the max progress.
 * 2. Reading time (`secondsRead`) takes the max between local and cloud, preventing 0 on cloud from erasing local calculated/recorded time.
 * 3. If local has higher reading time or progress than cloud, `needsCloudUpload` is set to true.
 * 4. If cloud has higher reading time or progress than local, `localChanged` is set to true and `localUpdate` is provided.
 */
export function reconcileHistorySession(
  local: LocalHistoryLike,
  cloud: ShareHistory
): HistoryReconcileResult {
  const localPageStart = local.page_start ?? 0;
  const localPageEnd = local.page_end ?? 0;
  const localPages = local.pages ?? 1;
  const localCompleted = Boolean(local.completed);
  const localSecondsRead = local.seconds_read ?? 0;
  const localAverageTime = local.average_time_page ?? 0;
  const localChaptersRead = local.chapters_read ?? 0;
  const localUseTTS = Boolean(local.use_tts);
  const localVolume = local.volume || '';
  const localEnd = local.date_time_end || '';

  const cloudPageStart = cloud.pageStart ?? 0;
  const cloudPageEnd = cloud.pageEnd ?? 0;
  const cloudPages = cloud.pages ?? 1;
  const cloudCompleted = Boolean(cloud.completed);
  const cloudSecondsRead = cloud.secondsRead ?? 0;
  const cloudAverageTime = cloud.averageTimeByPage ?? 0;
  const cloudChaptersRead = cloud.chaptersRead ?? 0;
  const cloudUseTTS = Boolean(cloud.useTTS);
  const cloudVolume = cloud.volume ?? '';
  const cloudEnd = cloud.end || localEnd;

  // Reconciled target values
  const reconciledSecondsRead = Math.max(localSecondsRead, cloudSecondsRead);
  const reconciledPageEnd = Math.max(localPageEnd, cloudPageEnd);
  const reconciledPageStart = Math.min(localPageStart, cloudPageStart);
  const reconciledPages = Math.max(localPages, cloudPages);
  const reconciledCompleted = localCompleted || cloudCompleted || (reconciledPages > 0 && reconciledPageEnd >= reconciledPages);
  const reconciledChaptersRead = Math.max(localChaptersRead, cloudChaptersRead);
  const reconciledUseTTS = localUseTTS || cloudUseTTS;
  const reconciledVolume = cloudVolume || localVolume;
  
  let reconciledAverageTime = Math.max(localAverageTime, cloudAverageTime);
  if (reconciledAverageTime <= 0 && reconciledSecondsRead > 0) {
    const delta = Math.max(1, reconciledPageEnd - reconciledPageStart);
    reconciledAverageTime = Math.floor(reconciledSecondsRead / delta);
  }

  // Determine if cloud had superior/new info that local should adopt
  const localNeedsUpdate =
    reconciledSecondsRead > localSecondsRead ||
    reconciledAverageTime > localAverageTime ||
    reconciledPageEnd > localPageEnd ||
    (reconciledCompleted && !localCompleted) ||
    reconciledChaptersRead > localChaptersRead ||
    (!localVolume && Boolean(cloudVolume)) ||
    (!localUseTTS && cloudUseTTS) ||
    (Boolean(cloudEnd) && localEnd !== cloudEnd && cloudPageEnd >= localPageEnd);

  // Determine if local has superior info that cloud should receive
  const needsCloudUpload =
    localSecondsRead > cloudSecondsRead ||
    localAverageTime > cloudAverageTime ||
    localPageEnd > cloudPageEnd ||
    (localCompleted && !cloudCompleted) ||
    localChaptersRead > cloudChaptersRead ||
    (Boolean(localVolume) && !cloudVolume);

  return {
    localChanged: localNeedsUpdate,
    needsCloudUpload,
    localUpdate: localNeedsUpdate
      ? {
          pageStart: reconciledPageStart,
          pageEnd: reconciledPageEnd,
          pages: reconciledPages,
          completed: reconciledCompleted,
          volume: reconciledVolume,
          chaptersRead: reconciledChaptersRead,
          dateTimeEnd: cloudEnd || localEnd,
          secondsRead: reconciledSecondsRead,
          averageTimeByPage: reconciledAverageTime,
          useTTS: reconciledUseTTS
        }
      : undefined
  };
}
