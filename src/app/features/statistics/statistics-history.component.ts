import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { StatisticsService } from '../../core/services/statistics.service';
import { ElectronService } from '../../core/services/electron.service';
import { HistoryUiStateService } from '../../core/services/history-ui-state.service';
import { LibraryStateService } from '../../core/services/library-state.service';
import { NavigationStackService } from '../../core/services/navigation-stack.service';
import { HistoryStatisticsItem, LibraryViewType } from '../../core/models';
import { HistoryStatsCardComponent } from './components/history-stats-card.component';
import { HistoryStatsListItemComponent } from './components/history-stats-list-item.component';
import { MangaFilterModalComponent } from '../library/manga-library/components/manga-filter-modal/manga-filter-modal.component';
import { formatShortDuration } from '../../core/services/statistics.service';

interface HistoryDayGroup {
  date: string;
  items: HistoryStatisticsItem[];
}

@Component({
  selector: 'app-statistics-history',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    HistoryStatsCardComponent,
    HistoryStatsListItemComponent,
    MangaFilterModalComponent
  ],
  template: `
    <div class="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none relative">
      @if (libraryState.showFilterModal()) {
        <app-manga-filter-modal (close)="libraryState.showFilterModal.set(false)"></app-manga-filter-modal>
      }

      <div class="flex-1 min-h-0 overflow-y-auto p-6">
        @if (loading()) {
          <div class="h-40 flex items-center justify-center text-sm text-slate-400 animate-pulse">
            Carregando histórico…
          </div>
        } @else if (groups().length === 0) {
          <div class="h-48 flex flex-col items-center justify-center text-center gap-2">
            <p class="text-sm font-semibold text-slate-300">Nenhuma leitura registrada</p>
            <p class="text-xs text-slate-500 max-w-sm">
              Abra um mangá ou livro no leitor para começar a registrar sessões de leitura.
            </p>
          </div>
        } @else {
          <div class="space-y-8">
            @for (group of groups(); track group.date) {
              <section>
                <div class="sticky top-0 z-10 mb-4 bg-slate-950/90 backdrop-blur py-2 border-b border-slate-800 flex items-center gap-3">
                  <span class="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                    {{ formatDateLabel(group.date) }}
                  </span>
                  <div class="h-px bg-slate-800 flex-1"></div>
                </div>

                @if (isLineView()) {
                  <div class="flex flex-col gap-2">
                    @for (item of group.items; track item.id + '-' + item.sessionDate + '-' + item.fkReference) {
                      <app-history-stats-list-item [item]="item" (open)="openItem($event)" />
                    }
                  </div>
                } @else {
                  <div [class]="gridClasses()">
                    @for (item of group.items; track item.id + '-' + item.sessionDate + '-' + item.fkReference) {
                      <app-history-stats-card
                        [item]="item"
                        [cardStyle]="effectiveCardStyle()"
                        (open)="openItem($event)" />
                    }
                  </div>
                }
              </section>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class StatisticsHistoryComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private stats = inject(StatisticsService);
  private electron = inject(ElectronService);
  readonly historyUi = inject(HistoryUiStateService);
  readonly libraryState = inject(LibraryStateService);
  private nav = inject(NavigationStackService);

  readonly items = signal<HistoryStatisticsItem[]>([]);
  readonly loading = signal(false);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private ready = false;

  readonly isLineView = computed(() => {
    const view = this.libraryState.currentView();
    return view === LibraryViewType.LINE || view === LibraryViewType.SEPARATOR_LINE;
  });

  readonly effectiveCardStyle = computed<'STANDARD' | 'OVERLAY'>(() => {
    const view = this.libraryState.currentView();
    if (view === LibraryViewType.GRID_OVERLAY || view === LibraryViewType.SEPARATOR_OVERLAY) {
      return 'OVERLAY';
    }
    return 'STANDARD';
  });

  readonly groups = computed<HistoryDayGroup[]>(() => {
    const ascending = this.libraryState.isAscending();
    const sortedItems = [...this.items()].sort((a, b) => {
      const cmp = (a.lastAccess || a.sessionDate).localeCompare(b.lastAccess || b.sessionDate);
      return ascending ? cmp : -cmp;
    });

    const map = new Map<string, HistoryStatisticsItem[]>();
    for (const item of sortedItems) {
      const list = map.get(item.sessionDate) ?? [];
      list.push(item);
      map.set(item.sessionDate, list);
    }

    const entries = Array.from(map.entries());
    entries.sort((a, b) => (ascending ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0])));
    return entries.map(([date, groupItems]) => ({ date, items: groupItems }));
  });

  constructor() {
    effect(() => {
      const token = this.historyUi.reloadToken();
      if (!this.ready) return;
      void token;
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        void this.onFiltersChanged();
      }, 200);
    });
  }

  async ngOnInit(): Promise<void> {
    const path = this.router.url.split('?')[0];
    this.historyUi.fromStatistics.set(path.startsWith('/statistics/history'));

    const typeParam = this.route.snapshot.paramMap.get('type');
    if (typeParam === 'book' || typeParam === 'BOOK') {
      this.historyUi.activeType.set('BOOK');
    } else if (typeParam === 'manga' || typeParam === 'MANGA') {
      this.historyUi.activeType.set('MANGA');
    }

    const yearParam = this.route.snapshot.queryParamMap.get('year');
    if (yearParam) {
      const y = parseInt(yearParam, 10);
      if (!isNaN(y)) this.historyUi.year.set(y);
    }

    await this.reloadFilterOptions();
    await this.loadItems();
    this.ready = true;
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  openItem(item: HistoryStatisticsItem): void {
    if (item.type === 'MANGA') {
      this.nav.openReader(this.router, 'image', item.fkReference);
    } else {
      this.nav.openReader(this.router, 'text', item.fkReference);
    }
  }

  formatDateLabel(date: string): string {
    const d = new Date(date + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return date;
    return d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  formatTime(seconds: number): string {
    return formatShortDuration(seconds);
  }

  gridClasses(): string {
    const view = this.libraryState.currentView();
    switch (view) {
      case LibraryViewType.GRID_BIG:
      case LibraryViewType.SEPARATOR_BIG:
        return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5';
      case LibraryViewType.GRID_OVERLAY:
      case LibraryViewType.SEPARATOR_OVERLAY:
        return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5';
      case LibraryViewType.GRID_MEDIUM:
      case LibraryViewType.SEPARATOR_MEDIUM:
      default:
        return 'grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-5';
    }
  }

  private async onFiltersChanged(): Promise<void> {
    await this.reloadFilterOptions();
    await this.loadItems();
  }

  private async reloadFilterOptions(): Promise<void> {
    const type = this.historyUi.activeType();
    const [years, libs] = await Promise.all([
      this.electron.getStatisticsYears(type),
      this.electron.listLibrariesByType(type)
    ]);
    this.historyUi.setFilterOptions(years, libs);
  }

  private async loadItems(): Promise<void> {
    this.loading.set(true);
    try {
      const items = await this.stats.loadHistory({
        type: this.historyUi.activeType(),
        year: this.historyUi.year(),
        libraryId: this.historyUi.libraryId(),
        search: this.historyUi.search() || null
      });
      this.items.set(items);
    } finally {
      this.loading.set(false);
    }
  }
}
