import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
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
  template: `
    <div class="w-full h-full">
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
        @for (group of groupedItems; track group.title) {
          @if (hasSeparator && group.title) {
            <div class="flex items-center gap-3 my-4 first:mt-0">
              <span class="text-sm font-bold text-indigo-400 font-mono bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                {{ group.title }}
              </span>
              <div class="h-px bg-slate-800 flex-1"></div>
            </div>
          }

          @if (!isLineView) {
            <div [class]="gridClasses + ' transition-all duration-300 mb-6'">
              @for (item of group.items; track getItemKey(item); let index = $index) {
                <div
                  draggable="true"
                  (dragstart)="onDragStart($event, index)"
                  (dragover)="onDragOver($event, index)"
                  (drop)="onDrop($event, index)"
                  (dragend)="onDragEnd()"
                  (pointerdown)="onPointerDown($event, item)"
                  (pointerup)="onPointerUp($event, item)"
                  (pointerleave)="onPointerCancel()"
                  (pointercancel)="onPointerCancel()"
                  (click)="onClick($event, item)"
                  (contextmenu)="onContextMenu($event, item)"
                  [class.opacity-40]="draggedIndex() === index"
                  [class.scale-105]="draggedIndex() === index"
                  [class.border-2]="dragOverIndex() === index"
                  [class.border-indigo-500]="dragOverIndex() === index"
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
          }

          @if (isLineView) {
            <div class="flex flex-col gap-2 transition-all duration-300 mb-6">
              @for (item of group.items; track getItemKey(item); let index = $index) {
                <div
                  draggable="true"
                  (dragstart)="onDragStart($event, index)"
                  (dragover)="onDragOver($event, index)"
                  (drop)="onDrop($event, index)"
                  (dragend)="onDragEnd()"
                  (pointerdown)="onPointerDown($event, item)"
                  (pointerup)="onPointerUp($event, item)"
                  (pointerleave)="onPointerCancel()"
                  (pointercancel)="onPointerCancel()"
                  (click)="onClick($event, item)"
                  (contextmenu)="onContextMenu($event, item)"
                  [class.opacity-40]="draggedIndex() === index"
                  [class.border-l-4]="dragOverIndex() === index"
                  [class.border-indigo-500]="dragOverIndex() === index"
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
        }
      }
    </div>
  `
})
export class SharedListComponent {
  @Input() items: (Manga | Book)[] = [];
  @Input() type: 'manga' | 'book' = 'manga';
  @Input() isLoading: boolean = false;
  @Input() cardStyle: 'STANDARD' | 'OVERLAY' = 'STANDARD';
  @Output() reordered = new EventEmitter<(Manga | Book)[]>();
  @Output() open = new EventEmitter<Manga | Book>();
  @Output() openDetail = new EventEmitter<Manga | Book>();
  @Output() setBookmark = new EventEmitter<Manga | Book>();
  @Output() openTracker = new EventEmitter<Manga | Book>();

  public libraryStateService = inject(LibraryStateService);
  private bookService = inject(BookLibraryService);
  LibraryViewType = LibraryViewType;

  skeletonItems = Array(12).fill(0);
  draggedIndex = signal<number | null>(null);
  dragOverIndex = signal<number | null>(null);

  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressFired = false;
  private suppressClick = false;
  private didDrag = false;
  private readonly LONG_PRESS_MS = 480;

  get isLineView(): boolean {
    const view = this.libraryStateService.getView(this.type);
    return view === LibraryViewType.LINE || view === LibraryViewType.SEPARATOR_LINE;
  }

  get hasSeparator(): boolean {
    const view = this.libraryStateService.getView(this.type);
    return view === LibraryViewType.SEPARATOR_BIG ||
      view === LibraryViewType.SEPARATOR_MEDIUM ||
      view === LibraryViewType.SEPARATOR_OVERLAY ||
      view === LibraryViewType.SEPARATOR_LINE;
  }

  get effectiveCardStyle(): 'STANDARD' | 'OVERLAY' {
    const view = this.libraryStateService.getView(this.type);
    if (view === LibraryViewType.GRID_OVERLAY || view === LibraryViewType.SEPARATOR_OVERLAY) {
      return 'OVERLAY';
    }
    return this.cardStyle;
  }

  get gridClasses(): string {
    const view = this.libraryStateService.getView(this.type);
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

  getBookProgressPercentage(book: any): number {
    return progressPercent(book?.bookMark || 0, book?.pages || 0, book?.completed);
  }

  onBookFavoriteClick(event: MouseEvent, book: Book): void {
    event.stopPropagation();
    this.bookService.toggleFavorite(book);
    book.favorite = !book.favorite;
  }

  get groupedItems(): { title: string; items: (Manga | Book)[] }[] {
    if (!this.items || this.items.length === 0) return [];
    if (!this.hasSeparator) {
      return [{ title: '', items: this.items }];
    }
    const groups: Map<string, (Manga | Book)[]> = new Map();
    for (const item of this.items) {
      const letter = (item.title || '?')[0].toUpperCase();
      const key = /[A-Z0-9]/.test(letter) ? letter : '#';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([title, items]) => ({ title, items }));
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

  onDragStart(event: DragEvent, index: number) {
    this.didDrag = true;
    this.clearPressTimer();
    this.suppressClick = true;
    this.draggedIndex.set(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', index.toString());
    }
  }

  onDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    if (this.draggedIndex() !== index) {
      this.dragOverIndex.set(index);
    }
  }

  onDrop(event: DragEvent, dropIndex: number) {
    event.preventDefault();
    const fromIndex = this.draggedIndex();
    if (fromIndex !== null && fromIndex !== dropIndex) {
      const updated = [...this.items];
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(dropIndex, 0, movedItem);
      this.reordered.emit(updated);
    }
    this.onDragEnd();
  }

  onDragEnd() {
    this.draggedIndex.set(null);
    this.dragOverIndex.set(null);
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
