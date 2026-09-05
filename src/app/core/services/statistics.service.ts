import { Injectable, signal } from '@angular/core';
import { ElectronService } from './electron.service';
import {
  SectorStats,
  ChartPoint,
  LibraryOption,
  HistoryStatisticsItem,
  HistoryContentType,
  StatisticsOverview
} from '../models';

export function formatReadingDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  if (seconds <= 0) return '0s';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 && days === 0 && hours === 0) parts.push(`${secs}s`);
  if (parts.length === 0) parts.push('0s');
  return parts.join(' ');
}

export function formatShortDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

const emptySector = (type: HistoryContentType): SectorStats => ({
  type,
  reading: 0,
  toRead: 0,
  library: 0,
  read: 0,
  completeReadingPages: 0,
  completeReadingSeconds: 0,
  currentReadingPages: 0,
  currentReadingSeconds: 0,
  totalReadPages: 0,
  totalReadSeconds: 0,
  averageMinutesPerPage: 0
});

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  readonly loading = signal(false);
  readonly mangaStats = signal<SectorStats>(emptySector('MANGA'));
  readonly bookStats = signal<SectorStats>(emptySector('BOOK'));
  readonly mangaChart = signal<ChartPoint[]>([]);
  readonly bookChart = signal<ChartPoint[]>([]);
  readonly mangaYears = signal<number[]>([new Date().getFullYear()]);
  readonly bookYears = signal<number[]>([new Date().getFullYear()]);
  readonly mangaLibraries = signal<LibraryOption[]>([]);
  readonly bookLibraries = signal<LibraryOption[]>([]);

  constructor(private electron: ElectronService) {}

  async loadOverview(): Promise<void> {
    this.loading.set(true);
    try {
      const overview: StatisticsOverview | null = await this.electron.getStatistics();
      if (overview) {
        this.mangaStats.set(overview.manga);
        this.bookStats.set(overview.book);
      }

      const [mangaYears, bookYears, mangaLibs, bookLibs] = await Promise.all([
        this.electron.getStatisticsYears('MANGA'),
        this.electron.getStatisticsYears('BOOK'),
        this.electron.listLibrariesByType('MANGA'),
        this.electron.listLibrariesByType('BOOK')
      ]);

      this.mangaYears.set(mangaYears);
      this.bookYears.set(bookYears);
      this.mangaLibraries.set(mangaLibs);
      this.bookLibraries.set(bookLibs);
    } finally {
      this.loading.set(false);
    }
  }

  async loadChart(
    type: HistoryContentType,
    year: number,
    libraryId?: number | null
  ): Promise<ChartPoint[]> {
    const points = await this.electron.getStatisticsChart(type, year, libraryId);
    if (type === 'MANGA') {
      this.mangaChart.set(points);
    } else {
      this.bookChart.set(points);
    }
    return points;
  }

  async loadHistory(options: {
    type: HistoryContentType;
    year?: number | null;
    libraryId?: number | null;
    search?: string | null;
  }): Promise<HistoryStatisticsItem[]> {
    return this.electron.listHistoryAggregated(options);
  }
}
