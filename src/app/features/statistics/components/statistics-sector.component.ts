import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SectorStats, ChartPoint, LibraryOption, HistoryContentType } from '../../../core/models';
import { formatReadingDuration } from '../../../core/services/statistics.service';
import { StatisticsKpiCardComponent } from './statistics-kpi-card.component';
import { StatisticsChartComponent } from './statistics-chart.component';

@Component({
  selector: 'app-statistics-sector',
  standalone: true,
  imports: [CommonModule, FormsModule, StatisticsKpiCardComponent, StatisticsChartComponent],
  template: `
    <section
      class="h-full flex flex-col rounded-2xl bg-slate-900 border overflow-hidden animate-fade-in-up"
      [ngClass]="panelBorderClass">

      <header class="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <span class="text-xl">{{ isManga ? '🎨' : '📚' }}</span>
          <div class="min-w-0">
            <h2 class="text-sm font-bold truncate" [ngClass]="titleClass">
              {{ title }}
            </h2>
            <p class="text-[10px] text-slate-500">Leituras / mês</p>
          </div>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto p-5 space-y-5">
        <div class="grid grid-cols-2 gap-3">
          <app-statistics-kpi-card
            label="Lendo"
            [value]="stats.reading"
            [accent]="accent" />
          <app-statistics-kpi-card
            label="Pendentes"
            [value]="stats.toRead"
            [accent]="accent" />
          <app-statistics-kpi-card
            label="Biblioteca"
            [value]="stats.library"
            [accent]="accent" />
          <app-statistics-kpi-card
            label="Completos"
            [value]="stats.read"
            [accent]="accent" />
        </div>

        <div class="rounded-xl bg-slate-800 border border-slate-700 p-4 space-y-3">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Concluído</h3>
          <div class="grid grid-cols-3 gap-3">
            <div class="text-center">
              <p class="text-[10px] text-slate-500 mb-1">{{ type === 'MANGA' ? 'Mangás/Comics' : 'Livros' }}</p>
              <p class="text-sm font-semibold text-slate-200 tabular-nums">{{ stats.read }}</p>
            </div>
            <div class="text-center">
              <p class="text-[10px] text-slate-500 mb-1">Páginas</p>
              <p class="text-sm font-semibold text-slate-200 tabular-nums">{{ stats.completeReadingPages }}</p>
            </div>
            <div class="text-center">
              <p class="text-[10px] text-slate-500 mb-1">Tempo</p>
              <p class="text-sm font-semibold text-slate-200">{{ formatDuration(stats.completeReadingSeconds) }}</p>
            </div>
          </div>
        </div>

        <div class="rounded-xl bg-slate-800 border border-slate-700 p-4 space-y-3">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Em andamento</h3>
          <div class="grid grid-cols-3 gap-3">
            <div class="text-center">
              <p class="text-[10px] text-slate-500 mb-1">{{ type === 'MANGA' ? 'Mangás/Comics' : 'Livros' }}</p>
              <p class="text-sm font-semibold text-slate-200 tabular-nums">{{ stats.reading }}</p>
            </div>
            <div class="text-center">
              <p class="text-[10px] text-slate-500 mb-1">Páginas</p>
              <p class="text-sm font-semibold text-slate-200 tabular-nums">{{ stats.currentReadingPages }}</p>
            </div>
            <div class="text-center">
              <p class="text-[10px] text-slate-500 mb-1">Tempo</p>
              <p class="text-sm font-semibold text-slate-200">{{ formatDuration(stats.currentReadingSeconds) }}</p>
            </div>
          </div>
        </div>

        <div class="rounded-xl bg-slate-800 border border-slate-700 p-4 space-y-3">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Mês atual</h3>
          <div class="grid grid-cols-3 gap-3">
            <div class="text-center">
              <p class="text-[10px] text-slate-500 mb-1">{{ type === 'MANGA' ? 'Mangás/Comics' : 'Livros' }}</p>
              <p class="text-sm font-semibold text-slate-200 tabular-nums">{{ stats.readThisMonth }}</p>
            </div>
            <div class="text-center">
              <p class="text-[10px] text-slate-500 mb-1">Páginas</p>
              <p class="text-sm font-semibold text-slate-200 tabular-nums">{{ stats.currentMonthPages }}</p>
            </div>
            <div class="text-center">
              <p class="text-[10px] text-slate-500 mb-1">Tempo</p>
              <p class="text-sm font-semibold text-slate-200">{{ formatDuration(stats.currentMonthSeconds) }}</p>
            </div>
          </div>
        </div>

        <div class="space-y-2.5">
          <div class="flex items-center justify-between gap-3 text-xs">
            <span class="text-slate-400">Total de páginas lidas</span>
            <span class="font-semibold text-slate-200 tabular-nums">{{ stats.totalReadPages }}</span>
          </div>
          <div class="flex items-center justify-between gap-3 text-xs">
            <span class="text-slate-400">Tempo total de leitura</span>
            <span class="font-semibold text-slate-200">{{ formatDuration(stats.totalReadSeconds) }}</span>
          </div>
          <div class="flex items-center justify-between gap-3 text-xs">
            <span class="text-slate-400">Média de leitura</span>
            <span class="font-semibold text-slate-200">{{ stats.averageMinutesPerPage }} min / página</span>
          </div>
          <div class="flex items-center justify-between gap-3 text-xs">
            <span class="text-slate-400">Quantidade no mês</span>
            <span class="font-semibold text-slate-200 tabular-nums">{{ stats.readThisMonth }}</span>
          </div>
        </div>

        <div>
          <h3 class="text-xs font-bold text-center mb-3" [ngClass]="titleClass">
            {{ chartTitle }}
          </h3>

          <div class="grid grid-cols-2 gap-2 mb-3">
            <label class="block">
              <span class="text-[10px] text-slate-500 uppercase tracking-wider">Ano</span>
              <select
                class="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200"
                [ngModel]="selectedYear"
                (ngModelChange)="onYearChange($event)">
                @for (y of years; track y) {
                  <option [ngValue]="y">{{ y }}</option>
                }
              </select>
            </label>
            <label class="block">
              <span class="text-[10px] text-slate-500 uppercase tracking-wider">Biblioteca</span>
              <select
                class="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200"
                [ngModel]="selectedLibraryId"
                (ngModelChange)="onLibraryChange($event)">
                <option [ngValue]="null">Todas</option>
                @for (lib of libraries; track lib.id) {
                  <option [ngValue]="lib.id">{{ lib.title }}</option>
                }
              </select>
            </label>
          </div>

          <div class="rounded-xl bg-slate-950 border border-slate-800 p-3">
            <app-statistics-chart
              [points]="chartPoints"
              [accent]="accent"
              [label]="chartTitle" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            (click)="openHistory.emit({ year: selectedYear, libraryId: selectedLibraryId })"
            class="py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-white text-center"
            [ngClass]="ctaClass">
            Histórico
          </button>
          <button
            type="button"
            (click)="openShare.emit({ year: selectedYear, libraryId: selectedLibraryId })"
            class="py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            title="Gerar imagem para Redes Sociais">
            <svg class="w-4 h-4" [ngClass]="isManga ? 'text-manga-400' : 'text-book-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Compartilhar
          </button>
        </div>
      </div>
    </section>
  `
})
export class StatisticsSectorComponent implements OnChanges {
  @Input({ required: true }) type!: HistoryContentType;
  @Input({ required: true }) title!: string;
  @Input({ required: true }) stats!: SectorStats;
  @Input() chartPoints: ChartPoint[] = [];
  @Input() years: number[] = [new Date().getFullYear()];
  @Input() libraries: LibraryOption[] = [];
  @Input() selectedYear = new Date().getFullYear();
  @Input() selectedLibraryId: number | null = null;
  @Input() accent: 'indigo' | 'amber' | 'manga' | 'book' = 'manga';

  @Output() openHistory = new EventEmitter<{ year: number; libraryId: number | null }>();
  @Output() openShare = new EventEmitter<{ year: number; libraryId: number | null }>();
  @Output() filtersChange = new EventEmitter<{ year: number; libraryId: number | null }>();

  get isManga(): boolean {
    return this.accent === 'indigo' || this.accent === 'manga';
  }

  get chartTitle(): string {
    return this.type === 'MANGA' ? 'Mangá / Comic leituras / mês' : 'Livro leituras / mês';
  }

  get panelBorderClass(): string {
    return this.isManga ? 'manga-stats-border' : 'book-stats-border';
  }

  get titleClass(): string {
    return this.isManga ? 'manga-stats-title' : 'book-stats-title';
  }

  get ctaClass(): string {
    return this.isManga
      ? 'manga-stats-cta'
      : 'book-stats-cta';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['years'] && this.years.length && !this.years.includes(this.selectedYear)) {
      this.selectedYear = this.years[0];
    }
  }

  formatDuration(seconds: number): string {
    return formatReadingDuration(seconds);
  }

  onYearChange(year: number): void {
    this.selectedYear = year;
    this.filtersChange.emit({ year: this.selectedYear, libraryId: this.selectedLibraryId });
  }

  onLibraryChange(libraryId: number | null): void {
    this.selectedLibraryId = libraryId;
    this.filtersChange.emit({ year: this.selectedYear, libraryId: this.selectedLibraryId });
  }
}
