import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
  ElementRef,
  OnInit,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Manga, Book, LibraryViewType } from '../../../../core/models';
import { MangaCardComponent } from '../../manga-library/components/manga-card/manga-card.component';
import { MangaListItemComponent } from '../../manga-library/components/manga-list-item/manga-list-item.component';
import { BookCardComponent } from '../book-card/book-card.component';
import { MangaCardSkeletonComponent } from '../manga-card-skeleton/manga-card-skeleton.component';
import { MangaListSkeletonComponent } from '../manga-list-skeleton/manga-list-skeleton.component';
import { LibraryStateService } from '../../../../core/services/library-state.service';
import { BookLibraryService } from '../../../../core/services/book-library.service';
import { progressPercent } from '../../../../core/utils/reading-progress.util';

export interface VirtualRow {
  id: string;
  groupTitle?: string;
  items: (Manga | Book)[];
  isLine: boolean;
}

@Component({
  selector: 'app-shared-list',
  standalone: true,
  imports: [
    CommonModule,
    MangaCardComponent,
    MangaListItemComponent,
    BookCardComponent,
    MangaCardSkeletonComponent,
    MangaListSkeletonComponent
  ],
  host: {
    class: 'block w-full min-h-0'
  },
  template: `
    <div class="w-full">
      @if (isLoading) {
        @if (!isLineView) {
          <div [class]="gridClasses + ' transition-all duration-300'">
            @for (dummy of skeletonItems; track $index) {
              <app-manga-card-skeleton></app-manga-card-skeleton>
            }
          </div>
        } @else {
          <div class="flex flex-col gap-2 transition-all duration-300">
            @for (dummy of skeletonItems; track $index) {
              <app-manga-list-skeleton></app-manga-list-skeleton>
            }
          </div>
        }
      } @else {
        <!-- Top Spacer for Virtual Windowing -->
        @if (topSpacerHeight() > 0) {
          <div [style.height.px]="topSpacerHeight()" class="w-full pointer-events-none"></div>
        }

        <!-- Visible Rows (Windowed) -->
        @for (row of visibleRows(); track trackRow($index, row)) {
          <div class="w-full">
            @if (row.groupTitle) {
              <div class="flex items-center gap-3 my-4 first:mt-1">
                <span class="text-sm font-bold text-indigo-400 font-mono bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                  {{ row.groupTitle }}
                </span>
                <div class="h-px bg-slate-800 flex-1"></div>
              </div>
            }

            @if (!row.isLine) {
              <div [class]="gridClasses + ' transition-all duration-300 pb-5'">
                @for (item of row.items; track getItemKey(item); let colIndex = $index) {
                  <div
                    draggable="true"
                    (dragstart)="onDragStart($event, item)"
                    (dragover)="onDragOver($event, item)"
                    (drop)="onDrop($event, item)"
                    (dragend)="onDragEnd()"
                    (pointerdown)="onPointerDown($event, item)"
                    (pointerup)="onPointerUp($event, item)"
                    (pointerleave)="onPointerCancel()"
                    (pointercancel)="onPointerCancel()"
                    (click)="onClick($event, item)"
                    (contextmenu)="onContextMenu($event, item)"
                    [class.opacity-40]="draggedItemKey() === getItemKey(item)"
                    [class.border-2]="dragOverItemKey() === getItemKey(item)"
                    [class.border-indigo-500]="dragOverItemKey() === getItemKey(item)"
                    class="cursor-pointer active:cursor-grabbing transition-all duration-200 rounded-xl overflow-hidden animate-fade-in-up">

                    @if (type === 'manga') {
                      <app-manga-card
                        [manga]="$any(item)"
                        [cardStyle]="effectiveCardStyle"
                        (setBookmark)="setBookmark.emit($event)"
                        (openTracker)="openTracker.emit($event)">
                      </app-manga-card>
                    } @else {
                      <app-book-card
                        [book]="$any(item)"
                        [cardStyle]="effectiveCardStyle"
                        (setBookmark)="setBookmark.emit($event)"
                        (openTracker)="openTracker.emit($event)">
                      </app-book-card>
                    }
                  </div>
                }
              </div>
            } @else {
              <div class="flex flex-col gap-2 transition-all duration-300 pb-2">
                @for (item of row.items; track getItemKey(item); let colIndex = $index) {
                  <div
                    draggable="true"
                    (dragstart)="onDragStart($event, item)"
                    (dragover)="onDragOver($event, item)"
                    (drop)="onDrop($event, item)"
                    (dragend)="onDragEnd()"
                    (pointerdown)="onPointerDown($event, item)"
                    (pointerup)="onPointerUp($event, item)"
                    (pointerleave)="onPointerCancel()"
                    (pointercancel)="onPointerCancel()"
                    (click)="onClick($event, item)"
                    (contextmenu)="onContextMenu($event, item)"
                    [class.opacity-40]="draggedItemKey() === getItemKey(item)"
                    [class.border-l-4]="dragOverItemKey() === getItemKey(item)"
                    [class.border-indigo-500]="dragOverItemKey() === getItemKey(item)"
                    class="cursor-pointer active:cursor-grabbing transition-all duration-200 rounded-lg animate-fade-in-up">

                    @if (type === 'manga') {
                      <app-manga-list-item
                        [manga]="$any(item)"
                        (setBookmark)="setBookmark.emit($event)"
                        (openTracker)="openTracker.emit($event)">
                      </app-manga-list-item>
                    } @else {
                      <div class="group bg-slate-800/40 backdrop-blur-md rounded-lg overflow-hidden border border-slate-700/40 hover:border-amber-500/40 hover:bg-slate-800/80 transition-all duration-200 cursor-pointer flex items-stretch justify-between gap-3 pr-3">
                        <div class="flex items-center gap-2.5 min-w-0 flex-1">
                          <div class="w-16 self-stretch min-h-[4.5rem] bg-slate-900 rounded-l-lg overflow-hidden shrink-0 relative border-r border-slate-700/50 flex items-center justify-center">
                            @if (item.coverPath) {
                              <img [src]="'local-cover:///' + item.coverPath" [alt]="item.title" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            } @else {
                              <span class="text-amber-400 font-bold text-[10px] uppercase p-1">
                                {{ item.fileType || 'EPUB' }}
                              </span>
                            }
                          </div>

                          <!-- Stacked Buttons: Favorite -->
                          <div class="flex flex-col justify-center items-center gap-1 shrink-0 py-1" (click)="$event.stopPropagation()">
                            <button
                              (click)="onBookFavoriteClick($event, $any(item))"
                              class="p-1 rounded-md text-amber-400 hover:text-amber-300 hover:bg-slate-700/60 transition-colors"
                              [title]="$any(item).favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'">
                              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" [class.fill-current]="$any(item).favorite" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                            </button>
                          </div>

                          <div class="min-w-0 flex-1 py-2">
                            <h4 class="text-sm font-medium text-slate-200 truncate group-hover:text-amber-400 transition-colors" [title]="item.title">
                              {{ item.title }}
                            </h4>
                            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                              <span class="px-1.5 py-0.5 rounded bg-slate-900/80 text-amber-300 font-mono text-[10px] border border-slate-700/60 uppercase">
                                {{ item.fileType || 'EPUB' }}
                              </span>
                              @if (item.series) {
                                <span class="flex items-center gap-1 text-slate-300 truncate">
                                  <span class="text-slate-500 font-medium">Série:</span> {{ item.series }}
                                </span>
                              }
                              @if (item.author) {
                                <span class="flex items-center gap-1 text-slate-300 truncate">
                                  <span class="text-slate-500 font-medium">Autor:</span> {{ item.author }}
                                </span>
                              }
                              @if (item.publisher) {
                                <span class="flex items-center gap-1 text-slate-400 truncate">
                                  <span class="text-slate-500 font-medium">Editora:</span> {{ item.publisher }}
                                </span>
                              }
                            </div>
                          </div>
                        </div>

                        <div class="flex items-center gap-4 shrink-0 py-2">
                          <div class="w-32 hidden sm:block">
                            <div class="flex justify-between text-[10px] text-slate-400 mb-1">
                              <span>{{ item.bookMark || 0 }}/{{ item.pages || 0 }} págs</span>
                              <span>{{ getBookProgressPercentage(item) }}%</span>
                            </div>
                            <div class="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                              <div class="h-full bg-amber-500 rounded-full" [style.width.%]="getBookProgressPercentage(item)"></div>
                            </div>
                          </div>

                          <div class="text-right text-xs text-slate-400 w-16 font-mono">
                            {{ item.pages || 0 }} págs
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- Bottom Spacer for Virtual Windowing -->
        @if (bottomSpacerHeight() > 0) {
          <div [style.height.px]="bottomSpacerHeight()" class="w-full pointer-events-none"></div>
        }
      }
    </div>
  `
})
export class SharedListComponent implements OnInit, OnDestroy {
  private _items = signal<(Manga | Book)[]>([]);
  @Input()
  set items(val: (Manga | Book)[]) {
    this._items.set(val || []);
  }
  get items(): (Manga | Book)[] {
    return this._items();
  }

  private _type = signal<'manga' | 'book'>('manga');
  @Input()
  set type(val: 'manga' | 'book') {
    const oldVal = this._type();
    this._type.set(val || 'manga');
    if (oldVal !== val) {
      this.resetScroll();
    }
  }
  get type(): 'manga' | 'book' {
    return this._type();
  }

  public resetScroll(): void {
    if (this.scrollEl) {
      this.scrollEl.scrollTop = 0;
    }
    this.scrollTop.set(0);
  }

  @Input() isLoading: boolean = false;
  @Input() cardStyle: 'STANDARD' | 'OVERLAY' = 'STANDARD';
  @Output() reordered = new EventEmitter<(Manga | Book)[]>();
  @Output() open = new EventEmitter<Manga | Book>();
  @Output() openDetail = new EventEmitter<Manga | Book>();
  @Output() setBookmark = new EventEmitter<Manga | Book>();
  @Output() openTracker = new EventEmitter<Manga | Book>();

  public libraryStateService = inject(LibraryStateService);
  private bookService = inject(BookLibraryService);
  private elRef = inject(ElementRef);
  LibraryViewType = LibraryViewType;

  skeletonItems = Array(12).fill(0);
  draggedItemKey = signal<string | number | null>(null);
  dragOverItemKey = signal<string | number | null>(null);
  containerWidth = signal<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);

  scrollTop = signal<number>(0);
  viewportHeight = signal<number>(typeof window !== 'undefined' ? window.innerHeight : 900);

  private resizeObserver?: ResizeObserver;
  private scrollEl: HTMLElement | null = null;
  private scrollRafId: number | null = null;
  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressFired = false;
  private suppressClick = false;
  private didDrag = false;
  private readonly LONG_PRESS_MS = 480;

  ngOnInit(): void {
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
  }

  private connectScrollListener(): void {
    if (typeof window === 'undefined' || !this.elRef?.nativeElement) return;
    this.scrollEl = this.elRef.nativeElement.closest('.overflow-y-auto') || this.elRef.nativeElement.parentElement;
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
    this.clearPressTimer();
  }

  get isLineView(): boolean {
    const view = this.libraryStateService.getView(this._type());
    return view === LibraryViewType.LINE || view === LibraryViewType.SEPARATOR_LINE;
  }

  get hasSeparator(): boolean {
    const view = this.libraryStateService.getView(this._type());
    return view === LibraryViewType.SEPARATOR_BIG ||
      view === LibraryViewType.SEPARATOR_MEDIUM ||
      view === LibraryViewType.SEPARATOR_OVERLAY ||
      view === LibraryViewType.SEPARATOR_LINE;
  }

  get effectiveCardStyle(): 'STANDARD' | 'OVERLAY' {
    const view = this.libraryStateService.getView(this._type());
    if (view === LibraryViewType.GRID_OVERLAY || view === LibraryViewType.SEPARATOR_OVERLAY) {
      return 'OVERLAY';
    }
    return this.cardStyle;
  }

  get gridClasses(): string {
    const view = this.libraryStateService.getView(this._type());
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

  get columnsCount(): number {
    if (this.isLineView) return 1;
    const width = this.containerWidth();
    const view = this.libraryStateService.getView(this._type());

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
    if (this.isLineView) {
      return 84;
    }
    const view = this.libraryStateService.getView(this._type());
    switch (view) {
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

  allRows = computed<VirtualRow[]>(() => {
    const items = this._items();
    if (!items || items.length === 0) return [];

    const cols = this.columnsCount;
    const isLine = this.isLineView;
    const rows: VirtualRow[] = [];

    if (!this.hasSeparator) {
      for (let i = 0; i < items.length; i += cols) {
        const chunk = items.slice(i, i + cols);
        const firstId = this.getItemKey(chunk[0]);
        rows.push({
          id: `row-${firstId}-${i}`,
          items: chunk,
          isLine
        });
      }
      return rows;
    }

    const groups: Map<string, (Manga | Book)[]> = new Map();
    for (const item of items) {
      const letter = (item.title || '?')[0].toUpperCase();
      const key = /[A-Z0-9]/.test(letter) ? letter : '#';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }

    const sortedGroups = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    for (const [title, groupItems] of sortedGroups) {
      for (let i = 0; i < groupItems.length; i += cols) {
        const chunk = groupItems.slice(i, i + cols);
        const firstId = this.getItemKey(chunk[0]);
        rows.push({
          id: `group-${title}-${firstId}-${i}`,
          groupTitle: i === 0 ? title : undefined,
          items: chunk,
          isLine
        });
      }
    }

    return rows;
  });

  windowRange = computed<{ start: number; end: number; topSpacer: number; bottomSpacer: number }>(() => {
    const rows = this.allRows();
    if (rows.length === 0) {
      return { start: 0, end: 0, topSpacer: 0, bottomSpacer: 0 };
    }

    // If small amount of rows, render all directly without virtualization calculations
    if (rows.length <= 15) {
      return { start: 0, end: rows.length, topSpacer: 0, bottomSpacer: 0 };
    }

    const rowHeight = this.rowItemSize;
    const scroll = this.scrollTop();
    const vh = this.viewportHeight();

    const offsetTop = this.elRef.nativeElement ? this.elRef.nativeElement.offsetTop : 0;
    const effectiveScroll = Math.max(0, scroll - offsetTop);

    const BUFFER_ROWS = 4;
    const start = Math.max(0, Math.floor(effectiveScroll / rowHeight) - BUFFER_ROWS);
    const end = Math.min(rows.length, Math.ceil((effectiveScroll + vh) / rowHeight) + BUFFER_ROWS);

    const topSpacer = start * rowHeight;
    const bottomSpacer = Math.max(0, (rows.length - end) * rowHeight);

    return { start, end, topSpacer, bottomSpacer };
  });

  visibleRows = computed<VirtualRow[]>(() => {
    const range = this.windowRange();
    const rows = this.allRows();
    return rows.slice(range.start, range.end);
  });

  topSpacerHeight = computed<number>(() => this.windowRange().topSpacer);
  bottomSpacerHeight = computed<number>(() => this.windowRange().bottomSpacer);

  trackRow(index: number, row: VirtualRow): string {
    return row.id;
  }

  getBookProgressPercentage(book: any): number {
    return progressPercent(book?.bookMark || 0, book?.pages || 0, book?.completed);
  }

  onBookFavoriteClick(event: MouseEvent, book: Book): void {
    event.stopPropagation();
    this.bookService.toggleFavorite(book);
    book.favorite = !book.favorite;
  }

  getItemKey(item: Manga | Book): string | number {
    return item.id || item.path || item.title;
  }

  onPointerDown(event: PointerEvent, item: Manga | Book): void {
    if (event.button !== 0) return;
    this.longPressFired = false;
    this.suppressClick = false;
    this.didDrag = false;
    this.clearPressTimer();
    this.pressTimer = setTimeout(() => {
      this.longPressFired = true;
      this.suppressClick = true;
      this.openDetail.emit(item);
    }, this.LONG_PRESS_MS);
  }

  onPointerUp(_event: PointerEvent, _item: Manga | Book): void {
    this.clearPressTimer();
  }

  onPointerCancel(): void {
    this.clearPressTimer();
  }

  onClick(event: MouseEvent, item: Manga | Book): void {
    if (this.suppressClick || this.didDrag || this.longPressFired) {
      event.preventDefault();
      event.stopPropagation();
      this.suppressClick = false;
      this.longPressFired = false;
      return;
    }
    this.open.emit(item);
  }

  onContextMenu(event: MouseEvent, item: Manga | Book): void {
    event.preventDefault();
    this.clearPressTimer();
    this.openDetail.emit(item);
  }

  onDragStart(event: DragEvent, item: Manga | Book) {
    this.didDrag = true;
    this.clearPressTimer();
    this.suppressClick = true;
    this.draggedItemKey.set(this.getItemKey(item));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(this.getItemKey(item)));
    }
  }

  onDragOver(event: DragEvent, item: Manga | Book) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    const key = this.getItemKey(item);
    if (this.draggedItemKey() !== key) {
      this.dragOverItemKey.set(key);
    }
  }

  onDrop(event: DragEvent, targetItem: Manga | Book) {
    event.preventDefault();
    const fromKey = this.draggedItemKey();
    const toKey = this.getItemKey(targetItem);
    if (fromKey !== null && fromKey !== toKey) {
      const fromIndex = this.items.findIndex(i => this.getItemKey(i) === fromKey);
      const toIndex = this.items.findIndex(i => this.getItemKey(i) === toKey);
      if (fromIndex >= 0 && toIndex >= 0) {
        const updated = [...this.items];
        const [movedItem] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, movedItem);
        this.reordered.emit(updated);
      }
    }
    this.onDragEnd();
  }

  onDragEnd() {
    this.draggedItemKey.set(null);
    this.dragOverItemKey.set(null);
    setTimeout(() => {
      this.suppressClick = false;
      this.didDrag = false;
    }, 0);
  }

  private clearPressTimer(): void {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }
}
