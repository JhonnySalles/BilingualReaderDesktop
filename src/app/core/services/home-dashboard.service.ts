import { Injectable, computed, inject, signal } from '@angular/core';
import { HomeRecentItem, HeatmapDay } from '../models';
import { ElectronService } from './electron.service';

@Injectable({ providedIn: 'root' })
export class HomeDashboardService {
  private electron = inject(ElectronService);

  readonly loading = signal(false);
  readonly recentReads = signal<HomeRecentItem[]>([]);
  readonly heatmap = signal<HeatmapDay[]>([]);

  readonly continueItem = computed(() => this.recentReads()[0] ?? null);

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const [recent, heat] = await Promise.all([
        this.electron.listRecentReads(3),
        this.electron.getReadingActivityHeatmap()
      ]);
      this.recentReads.set(recent || []);
      this.heatmap.set(heat || []);
    } catch (e) {
      console.error('Failed to load home dashboard data', e);
      this.recentReads.set([]);
      this.heatmap.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}
