import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StatisticsService } from '../../core/services/statistics.service';
import { StatisticsSectorComponent } from './components/statistics-sector.component';
import { StatisticsHeatmapComponent } from './components/statistics-heatmap.component';
import { StatisticsLibrariesCardComponent } from './components/statistics-libraries-card.component';
import { SocialShareService } from '../../core/services/social-share.service';

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [CommonModule, StatisticsSectorComponent, StatisticsHeatmapComponent, StatisticsLibrariesCardComponent],
  template: `
    <div class="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      @if (stats.loading()) {
        <div class="px-6 py-2 text-[10px] text-indigo-300 animate-pulse border-b border-slate-800">Atualizando…</div>
      }

      <div class="flex-1 min-h-0 overflow-y-auto px-6 pb-12 pt-24">
        <!-- Reading Days Heatmap -->
        <app-statistics-heatmap [days]="stats.heatmap()" />

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 min-h-[640px] mb-8">
          <app-statistics-sector
            type="MANGA"
            title="Mangás & Comics"
            accent="indigo"
            [stats]="stats.mangaStats()"
            [chartPoints]="stats.mangaChart()"
            [years]="stats.mangaYears()"
            [libraries]="stats.mangaLibraries()"
            [selectedYear]="mangaYear()"
            [selectedLibraryId]="mangaLibraryId()"
            (filtersChange)="onMangaFilters($event)"
            (openHistory)="goHistory('manga', $event.year, $event.libraryId)"
            (openShare)="openShareDialog('MANGA', $event.year, $event.libraryId)" />

          <app-statistics-sector
            type="BOOK"
            title="Livros & EPUBs"
            accent="amber"
            [stats]="stats.bookStats()"
            [chartPoints]="stats.bookChart()"
            [years]="stats.bookYears()"
            [libraries]="stats.bookLibraries()"
            [selectedYear]="bookYear()"
            [selectedLibraryId]="bookLibraryId()"
            (filtersChange)="onBookFilters($event)"
            (openHistory)="goHistory('book', $event.year, $event.libraryId)"
            (openShare)="openShareDialog('BOOK', $event.year, $event.libraryId)" />
        </div>

        <!-- Estatísticas por Biblioteca -->
        <app-statistics-libraries-card [stats]="stats.librariesStats()" />
      </div>
    </div>
  `
})
export class StatisticsComponent implements OnInit {
  readonly stats = inject(StatisticsService);
  private router = inject(Router);
  private socialShare = inject(SocialShareService);

  mangaYear = signal(new Date().getFullYear());
  bookYear = signal(new Date().getFullYear());
  mangaLibraryId = signal<number | null>(null);
  bookLibraryId = signal<number | null>(null);

  openShareDialog(type: 'MANGA' | 'BOOK' | 'ALL', year: number, _libraryId?: number | null): void {
    this.socialShare.open({
      initialMediaType: type,
      initialYear: year,
      initialLibraryId: null
    });
  }

  async ngOnInit(): Promise<void> {
    await this.stats.loadOverview();
    const yearsM = this.stats.mangaYears();
    const yearsB = this.stats.bookYears();
    if (yearsM.length) this.mangaYear.set(yearsM[0]);
    if (yearsB.length) this.bookYear.set(yearsB[0]);
    await Promise.all([
      this.stats.loadChart('MANGA', this.mangaYear(), this.mangaLibraryId()),
      this.stats.loadChart('BOOK', this.bookYear(), this.bookLibraryId())
    ]);
  }

  async onMangaFilters(event: { year: number; libraryId: number | null }): Promise<void> {
    this.mangaYear.set(event.year);
    this.mangaLibraryId.set(event.libraryId);
    await this.stats.loadChart('MANGA', event.year, event.libraryId);
  }

  async onBookFilters(event: { year: number; libraryId: number | null }): Promise<void> {
    this.bookYear.set(event.year);
    this.bookLibraryId.set(event.libraryId);
    await this.stats.loadChart('BOOK', event.year, event.libraryId);
  }

  goHistory(type: 'manga' | 'book', year: number, libraryId: number | null): void {
    const currentYear = new Date().getFullYear();
    const queryParams: Record<string, string | number> = {};

    if (year !== currentYear) {
      queryParams['year'] = year;
    }
    if (libraryId !== null) {
      queryParams['libraryId'] = libraryId;
    }

    this.router.navigate(['/statistics/history', type], {
      queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined
    });
  }
}
