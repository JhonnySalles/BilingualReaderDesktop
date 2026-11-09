import { Component, OnInit, OnDestroy, ElementRef, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { StatisticsService } from '../../core/services/statistics.service';
import { ElectronService } from '../../core/services/electron.service';
import { HistoryUiStateService } from '../../core/services/history-ui-state.service';
import { LibraryStateService } from '../../core/services/library-state.service';
import { NavigationStackService } from '../../core/services/navigation-stack.service';
import { LibrarySearchService } from '../../core/services/library-search.service';
import { MangaLibraryService } from '../../core/services/manga-library.service';
import { BookLibraryService } from '../../core/services/book-library.service';
import { HistoryStatisticsItem, LibraryViewType, OrderType } from '../../core/models';
import { HistoryStatsCardComponent } from './components/history-stats-card.component';
import { HistoryStatsListItemComponent } from './components/history-stats-list-item.component';
import { HistoryStatsCarouselShelfComponent } from './components/history-stats-carousel-shelf.component';
import { HistoryFilterModalComponent } from '../history/components/history-filter-modal/history-filter-modal.component';
import { ScrollEdgesButtonComponent } from '../../shared/scroll-edges-button/scroll-edges-button.component';
import { formatShortDuration } from '../../core/services/statistics.service';
import { parseLibrarySearch } from '../../core/utils/library-search.parser';

interface HistoryDayGroup {
  date: string;
  items: HistoryStatisticsItem[];
}

export interface VirtualHistoryGroup {
  date: string;
  totalItems: number;
  totalRows: number;
  totalHeight: number;
  topSpacer: number;
  bottomSpacer: number;
  visibleRows: {
    id: string;
    items: HistoryStatisticsItem[];
    isLine: boolean;
    isCarousel?: boolean;
  }[];
}

@Component({
  selector: 'app-statistics-history',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    HistoryStatsCardComponent,
    HistoryStatsListItemComponent,
    HistoryStatsCarouselShelfComponent,
    ScrollEdgesButtonComponent
  ],
  template: `
    <div class="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none relative">
      <div #statsScrollContainer class="flex-1 min-h-0 overflow-y-auto px-6 pb-6 pt-24">
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
            @for (group of virtualGroups(); track group.date + '-' + $index) {
              <section>
                <!-- Sticky Date Header (for non-carousel views with date) -->
                @if (!isCarouselView() && group.date) {
                  <div class="sticky top-0 z-10 mb-4 bg-slate-950/90 backdrop-blur py-2 flex items-center justify-between gap-3 px-1">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <span
                        class="text-sm font-bold font-mono px-2.5 py-1 rounded-lg border flex items-center gap-1.5 shadow-sm truncate"
                        [ngClass]="historyUi.activeType() === 'BOOK'
                          ? 'book-badge bg-book-500/10'
                          : (historyUi.activeType() === 'MANGA' ? 'manga-badge bg-manga-500/10' : 'bg-primary-500/10 text-primary-300 border-primary-500/25')">
                        <span
                          class="w-1.5 h-1.5 rounded-full"
                          [ngClass]="historyUi.activeType() === 'BOOK'
                            ? 'book-section-dot'
                            : (historyUi.activeType() === 'MANGA' ? 'manga-section-dot' : 'bg-primary-400')"></span>
                        {{ formatDateLabel(group.date) }}
                      </span>

                      <span class="text-[11px] font-medium text-slate-400 font-mono">
                        {{ group.totalItems }} {{ group.totalItems === 1 ? 'leitura' : 'leituras' }}
                      </span>
                    </div>

                    <div class="h-px bg-slate-800 flex-1 mx-3 hidden sm:block"></div>
                  </div>
                }

                <!-- Top Spacer for Virtual Windowing in this group -->
                @if (group.topSpacer > 0) {
                  <div [style.height.px]="group.topSpacer" class="w-full pointer-events-none"></div>
                }

                @if (isCarouselView()) {
                  @for (row of group.visibleRows; track row.id) {
                    <app-history-stats-carousel-shelf
                      [title]="(hasSeparator() && group.date) ? formatDateLabel(group.date) : ''"
                      [items]="row.items"
                      [cardStyle]="effectiveCardStyle()"
                      [cardSize]="isCarouselSmallView() ? 'small' : 'normal'"
                      [shelfId]="row.id"
                      [mediaType]="historyUi.activeType()"
                      (open)="openItem($event)"
                      (favoriteChange)="onItemFavoriteChanged($event)"
                      (historyCleared)="onItemRemoved($event)"
                      (fileDeleted)="onItemRemoved($event)">
                    </app-history-stats-carousel-shelf>
                  }
                } @else if (isLineView()) {
                  <div class="flex flex-col gap-2">
                    @for (row of group.visibleRows; track row.id) {
                      @for (item of row.items; track item.id + '-' + item.sessionDate + '-' + item.fkReference) {
                        <app-history-stats-list-item
                          [item]="item"
                          (open)="openItem($event)"
                          (favoriteChange)="onItemFavoriteChanged($event)"
                          (historyCleared)="onItemRemoved($event)"
                          (fileDeleted)="onItemRemoved($event)" />
                      }
                    }
                  </div>
                } @else {
                  <div [class]="gridClasses()">
                    @for (row of group.visibleRows; track row.id) {
                      @for (item of row.items; track item.id + '-' + item.sessionDate + '-' + item.fkReference) {
                        <app-history-stats-card
                          [attr.data-flip-id]="'hist-' + item.fkReference + '-' + item.sessionDate"
                          [item]="item"
                          [cardStyle]="effectiveCardStyle()"
                          [cardSize]="cardSize()"
                          (open)="openItem($event)"
                          (favoriteChange)="onItemFavoriteChanged($event)"
                          (historyCleared)="onItemRemoved($event)"
                          (fileDeleted)="onItemRemoved($event)" />
                      }
                    }
                  </div>
                }

                <!-- Bottom Spacer for Virtual Windowing in this group -->
                @if (group.bottomSpacer > 0) {
                  <div [style.height.px]="group.bottomSpacer" class="w-full pointer-events-none"></div>
                }
              </section>
            }
          </div>
        }

        <!-- Botões de rolagem suave para início e fim do histórico de estatística -->
        <app-scroll-edges-button
          [target]="statsScrollContainer"
          accent="primary">
        </app-scroll-edges-button>
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
  private librarySearch = inject(LibrarySearchService);
  private mangaLibrary = inject(MangaLibraryService);
  private bookLibrary = inject(BookLibraryService);
  private elRef = inject(ElementRef);

  readonly items = signal<HistoryStatisticsItem[]>([]);
  readonly loading = signal(false);

  scrollTop = signal<number>(0);
  viewportHeight = signal<number>(typeof window !== 'undefined' ? window.innerHeight : 900);
  containerWidth = signal<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);

  private resizeObserver?: ResizeObserver;
  private scrollEl: HTMLElement | null = null;
  private scrollRafId: number | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private ready = false;

  readonly isLineView = computed(() => {
    return this.libraryState.currentView() === LibraryViewType.SEPARATOR_LINE;
  });

  readonly isCarouselView = computed(() => {
    const view = this.libraryState.currentView();
    return view === LibraryViewType.SEPARATOR_CAROUSEL || view === LibraryViewType.SEPARATOR_CAROUSEL_SMALL;
  });

  readonly isCarouselSmallView = computed(() => {
    return this.libraryState.currentView() === LibraryViewType.SEPARATOR_CAROUSEL_SMALL;
  });

  readonly isSeparatorCarouselView = computed(() => {
    const view = this.libraryState.currentView();
    return view === LibraryViewType.SEPARATOR_CAROUSEL || view === LibraryViewType.SEPARATOR_CAROUSEL_SMALL;
  });

  readonly hasSeparator = computed(() => true);

  readonly cardSize = computed<'big' | 'medium' | 'small'>(() => {
    const view = this.libraryState.currentView();
    if (view === LibraryViewType.SEPARATOR_SMALL || view === LibraryViewType.SEPARATOR_CAROUSEL_SMALL || view === LibraryViewType.GRID_SMALL) {
      return 'small';
    }
    if (view === LibraryViewType.SEPARATOR_BIG || view === LibraryViewType.GRID_BIG) {
      return 'big';
    }
    return 'medium';
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
    const order = this.libraryState.currentOrder();

    const sortedItems = [...this.items()].sort((a, b) => {
      let cmp = 0;
      switch (order) {
        case OrderType.Name:
          cmp = (a.title || '').localeCompare(b.title || '');
          break;
        case OrderType.Date:
        case OrderType.LastAccess:
          cmp = (a.lastAccess || a.sessionDate).localeCompare(b.lastAccess || b.sessionDate);
          break;
        case OrderType.Favorite:
          cmp = (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
          break;
        case OrderType.Author:
          cmp = (a.author || '').localeCompare(b.author || '');
          break;
        default:
          cmp = (a.lastAccess || a.sessionDate).localeCompare(b.lastAccess || b.sessionDate);
      }
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

  get columnsCount(): number {
    if (this.isLineView() || this.isCarouselView()) return 1;
    const width = this.containerWidth();
    const view = this.libraryState.currentView();

    if (view === LibraryViewType.GRID_SMALL || view === LibraryViewType.SEPARATOR_SMALL) {
      if (width < 640) return 3;
      if (width < 768) return 4;
      if (width < 1024) return 5;
      if (width < 1280) return 7;
      if (width < 1536) return 8;
      return 10;
    }
    if (view === LibraryViewType.GRID_BIG || view === LibraryViewType.SEPARATOR_BIG) {
      if (width < 640) return 2;
      if (width < 768) return 3;
      if (width < 1024) return 4;
      return 5;
    }
    if (view === LibraryViewType.GRID_OVERLAY || view === LibraryViewType.SEPARATOR_OVERLAY) {
      if (width < 640) return 2;
      if (width < 768) return 3;
      if (width < 1024) return 4;
      if (width < 1280) return 5;
      return 6;
    }
    // GRID_MEDIUM / SEPARATOR_MEDIUM
    if (width < 640) return 2;
    if (width < 768) return 4;
    if (width < 1024) return 5;
    if (width < 1280) return 6;
    return 7;
  }

  get rowItemSize(): number {
    if (this.isLineView()) {
      return 84;
    }
    if (this.isCarouselView()) {
      return this.isCarouselSmallView() ? 280 : 390;
    }
    const view = this.libraryState.currentView();
    switch (view) {
      case LibraryViewType.GRID_SMALL:
      case LibraryViewType.SEPARATOR_SMALL:
        return 290;
      case LibraryViewType.GRID_BIG:
      case LibraryViewType.SEPARATOR_BIG:
        return 430;
      case LibraryViewType.GRID_OVERLAY:
      case LibraryViewType.SEPARATOR_OVERLAY:
        return 330;
      case LibraryViewType.GRID_MEDIUM:
      case LibraryViewType.SEPARATOR_MEDIUM:
      default:
        return 370;
    }
  }

  readonly virtualGroups = computed<VirtualHistoryGroup[]>(() => {
    const rawGroups = this.groups();
    if (!rawGroups || rawGroups.length === 0) return [];

    const cols = this.columnsCount;
    const isLine = this.isLineView();
    const isCarousel = this.isCarouselView();
    const rowHeight = this.rowItemSize;
    const scroll = this.scrollTop();
    const vh = this.viewportHeight();

    const BUFFER_PX = rowHeight * 3;
    const windowStart = Math.max(0, scroll - BUFFER_PX);
    const windowEnd = scroll + vh + BUFFER_PX;

    let currentY = 0;
    const HEADER_HEIGHT = isCarousel ? 0 : 56;
    const SECTION_MARGIN = isCarousel ? 16 : 32;

    return rawGroups.map((group, groupIdx) => {
      const items = group.items;
      const totalRows = isCarousel ? 1 : Math.ceil(items.length / cols);
      const groupItemsHeight = totalRows * rowHeight;
      const sectionStartY = currentY;
      const itemsStartY = sectionStartY + (group.date && !isCarousel ? HEADER_HEIGHT : 0);
      const itemsEndY = itemsStartY + groupItemsHeight;
      const sectionEndY = itemsEndY + (groupIdx > 0 ? SECTION_MARGIN : 0);

      currentY = sectionEndY;

      // Check if group is entirely above window
      if (itemsEndY < windowStart) {
        return {
          date: group.date,
          totalItems: items.length,
          totalRows,
          totalHeight: groupItemsHeight,
          topSpacer: groupItemsHeight,
          bottomSpacer: 0,
          visibleRows: []
        };
      }

      // Check if group is entirely below window
      if (itemsStartY > windowEnd) {
        return {
          date: group.date,
          totalItems: items.length,
          totalRows,
          totalHeight: groupItemsHeight,
          topSpacer: 0,
          bottomSpacer: groupItemsHeight,
          visibleRows: []
        };
      }

      // Partially or fully visible
      const startRow = Math.max(0, Math.floor((windowStart - itemsStartY) / rowHeight));
      const endRow = Math.min(totalRows, Math.ceil((windowEnd - itemsStartY) / rowHeight));

      const topSpacer = startRow * rowHeight;
      const bottomSpacer = Math.max(0, (totalRows - endRow) * rowHeight);

      const visibleRows: { id: string; items: HistoryStatisticsItem[]; isLine: boolean; isCarousel?: boolean }[] = [];
      if (isCarousel) {
        if (startRow === 0 && endRow >= 1) {
          const firstItem = items[0];
          const firstId = `${firstItem.id}-${firstItem.sessionDate}-${firstItem.fkReference}`;
          visibleRows.push({
            id: `carousel-shelf-${group.date || 'shelf'}-${firstId}-${groupIdx}`,
            items,
            isLine: false,
            isCarousel: true
          });
        }
      } else {
        for (let r = startRow; r < endRow; r++) {
          const chunk = items.slice(r * cols, (r + 1) * cols);
          const firstItem = chunk[0];
          const firstId = `${firstItem.id}-${firstItem.sessionDate}-${firstItem.fkReference}`;
          visibleRows.push({
            id: `row-${group.date}-${firstId}-${r}`,
            items: chunk,
            isLine,
            isCarousel: false
          });
        }
      }

      return {
        date: group.date,
        totalItems: items.length,
        totalRows,
        totalHeight: groupItemsHeight,
        topSpacer,
        bottomSpacer,
        visibleRows
      };
    });
  });

  constructor() {
    effect(() => {
      const token = this.historyUi.reloadToken();
      const activeType = this.historyUi.activeType();
      this.libraryState.activeContext.set(activeType === 'BOOK' ? 'history-book' : 'history-manga');
      this.librarySearch.historyContentType.set(activeType);
      this.resetScroll();
      if (!this.ready) return;
      void token;
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        void this.onFiltersChanged();
      }, 200);
    });
  }

  async ngOnInit(): Promise<void> {
    if (typeof ResizeObserver !== 'undefined' && this.elRef?.nativeElement) {
      this.resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const width = entry.contentRect.width;
          if (width > 0) {
            this.containerWidth.set(width);
          }
        }
      });
      this.resizeObserver.observe(this.elRef.nativeElement);
    }

    setTimeout(() => {
      this.connectScrollListener();
    }, 0);

    const path = this.router.url.split('?')[0];
    this.historyUi.fromStatistics.set(path.startsWith('/statistics/history'));

    const typeParam = this.route.snapshot.paramMap.get('type');
    if (typeParam === 'book' || typeParam === 'BOOK') {
      this.historyUi.activeType.set('BOOK');
    } else if (typeParam === 'manga' || typeParam === 'MANGA') {
      this.historyUi.activeType.set('MANGA');
    }

    this.libraryState.activeContext.set(
      this.historyUi.activeType() === 'BOOK' ? 'history-book' : 'history-manga'
    );

    const currentYear = new Date().getFullYear();
    const yearParam = this.route.snapshot.queryParamMap.get('year');
    if (yearParam) {
      const y = parseInt(yearParam, 10);
      this.historyUi.year.set(!isNaN(y) ? y : currentYear);
    } else {
      this.historyUi.year.set(currentYear);
    }

    const libParam = this.route.snapshot.queryParamMap.get('libraryId');
    if (libParam) {
      const l = parseInt(libParam, 10);
      this.historyUi.libraryId.set(!isNaN(l) ? l : null);
    } else {
      this.historyUi.libraryId.set(null);
    }

    await this.reloadFilterOptions();
    // Ensure suggestion catalogs are populated even if libraries were never opened
    void this.mangaLibrary.loadMangas();
    void this.bookLibrary.loadBooks();
    await this.loadItems();
    this.ready = true;
  }

  private connectScrollListener(): void {
    if (typeof window === 'undefined' || !this.elRef?.nativeElement) return;
    this.scrollEl = this.elRef.nativeElement.querySelector('.overflow-y-auto') || this.elRef.nativeElement;
    if (this.scrollEl) {
      this.scrollEl.addEventListener('scroll', this.onScroll, { passive: true });
      this.scrollTop.set(this.scrollEl.scrollTop);
      this.viewportHeight.set(this.scrollEl.clientHeight || window.innerHeight);
    }
  }

  private onScroll = (): void => {
    if (this.scrollRafId !== null) return;
    this.scrollRafId = requestAnimationFrame(() => {
      this.scrollRafId = null;
      if (this.scrollEl) {
        this.scrollTop.set(this.scrollEl.scrollTop);
        this.viewportHeight.set(this.scrollEl.clientHeight || window.innerHeight);
      }
    });
  };

  public resetScroll(): void {
    if (this.scrollEl) {
      this.scrollEl.scrollTop = 0;
    }
    this.scrollTop.set(0);
  }

  ngOnDestroy(): void {
    if (this.scrollEl) {
      this.scrollEl.removeEventListener('scroll', this.onScroll);
      this.scrollEl = null;
    }
    if (this.scrollRafId !== null) {
      cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = null;
    }
    this.resizeObserver?.disconnect();
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  openItem(item: HistoryStatisticsItem): void {
    const type = item.type === 'MANGA' ? 'manga' : 'book';
    this.nav.openDetail(this.router, type, item.fkReference, item);
  }

  onItemFavoriteChanged(item: HistoryStatisticsItem): void {
    this.items.update(list =>
      list.map(i =>
        i.fkReference === item.fkReference && i.type === item.type
          ? { ...i, favorite: item.favorite }
          : i
      )
    );
  }

  onItemRemoved(item: HistoryStatisticsItem): void {
    this.items.update(list =>
      list.filter(i => !(i.fkReference === item.fkReference && i.type === item.type))
    );
  }

  formatDateLabel(date: string): string {
    const d = new Date(date + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return date;
    const str = d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  formatTime(seconds: number): string {
    return formatShortDuration(seconds);
  }

  gridClasses(): string {
    const view = this.libraryState.currentView();
    switch (view) {
      case LibraryViewType.GRID_SMALL:
      case LibraryViewType.SEPARATOR_SMALL:
        return 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-3 sm:gap-4';
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
      const raw = this.historyUi.committedSearch() || '';
      const parsed = parseLibrarySearch(raw, 'history');
      const items = await this.stats.loadHistory({
        type: this.historyUi.activeType(),
        year: this.historyUi.year(),
        libraryId: this.historyUi.libraryId(),
        search: parsed.freeText || null,
        filters: parsed.tokens.map(t => ({ kind: t.kind, value: t.value }))
      });
      this.items.set(items);
    } finally {
      this.loading.set(false);
    }
  }
}


