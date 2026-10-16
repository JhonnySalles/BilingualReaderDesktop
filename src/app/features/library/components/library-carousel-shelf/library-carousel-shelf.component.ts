import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  signal,
  AfterViewInit,
  OnDestroy,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Manga, Book, OrderType } from '../../../../core/models';
import { LibraryCarouselCardComponent } from '../library-carousel-card/library-carousel-card.component';

@Component({
  selector: 'app-library-carousel-shelf',
  standalone: true,
  imports: [CommonModule, LibraryCarouselCardComponent],
  template: `
    <div class="w-full relative group/shelf my-5 first:mt-1">
      
      <!-- Shelf Header (when title is provided) -->
      @if (title) {
        <div class="flex items-center justify-between gap-3 mb-2 px-1">
          <div class="flex items-center gap-2.5 min-w-0">
            <span
              class="text-xs font-bold font-mono px-2.5 py-1 rounded-lg border flex items-center gap-1.5 shadow-sm truncate"
              [ngClass]="type === 'manga'
                ? 'manga-badge bg-indigo-500/10'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/25'">
              <span class="w-1.5 h-1.5 rounded-full" [ngClass]="type === 'manga' ? 'manga-section-dot' : 'bg-amber-400'"></span>
              {{ title }}
            </span>

            <span class="text-[11px] font-medium text-slate-400 font-mono">
              {{ items.length }} {{ getItemCountLabel() }}
            </span>
          </div>

          <div class="h-px bg-slate-800 flex-1 mx-3 hidden sm:block"></div>

          <!-- Header Navigation Controls -->
          <div class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              (click)="scrollLeft()"
              [disabled]="!canScrollLeft()"
              class="p-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-sm"
              title="Rolar para esquerda">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              type="button"
              (click)="scrollRight()"
              [disabled]="!canScrollRight()"
              class="p-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-sm"
              title="Rolar para direita">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      }

      <!-- Carousel Track Container -->
      <div class="relative w-full">
        
        <!-- Floating Left Arrow Overlay -->
        <button
          type="button"
          (click)="scrollLeft()"
          [class.opacity-0]="!canScrollLeft()"
          [class.pointer-events-none]="!canScrollLeft()"
          class="absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-white flex items-center justify-center shadow-2xl opacity-0 group-hover/shelf:opacity-100 transition-all duration-200 hover:scale-110 hover:bg-slate-800 cursor-pointer focus:outline-none"
          title="Anterior">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <!-- Floating Right Arrow Overlay -->
        <button
          type="button"
          (click)="scrollRight()"
          [class.opacity-0]="!canScrollRight()"
          [class.pointer-events-none]="!canScrollRight()"
          class="absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-white flex items-center justify-center shadow-2xl opacity-0 group-hover/shelf:opacity-100 transition-all duration-200 hover:scale-110 hover:bg-slate-800 cursor-pointer focus:outline-none"
          title="Próximo">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <!-- Horizontal Scrollable Track -->
        <div
          #track
          (wheel)="onWheel($event)"
          (pointerdown)="onPointerDown($event)"
          (pointermove)="onPointerMove($event)"
          (pointerup)="onPointerUp()"
          (pointercancel)="onPointerUp()"
          (scroll)="checkScroll()"
          class="flex items-stretch gap-3.5 overflow-x-auto pb-3 pt-1 px-1 custom-horizontal-scrollbar scroll-smooth cursor-grab select-none">
          
          @for (item of items; track getItemKey(item); let idx = $index) {
            <app-library-carousel-card
              [item]="item"
              [type]="type"
              [order]="order"
              [instanceId]="'shelf-' + (shelfId || 'default') + '-' + getItemKey(item)"
              (open)="open.emit($event)"
              (openDetail)="openDetail.emit($event)"
              (setBookmark)="setBookmark.emit($event)"
              (openTracker)="openTracker.emit($event)"
              (openTags)="openTags.emit($event)">
            </app-library-carousel-card>
          }
        </div>

      </div>

    </div>
  `,
  styles: [`
    .custom-horizontal-scrollbar {
      scrollbar-width: thin;
      scrollbar-color: rgba(71, 85, 105, 0.4) transparent;
    }
    .custom-horizontal-scrollbar::-webkit-scrollbar {
      height: 6px;
    }
    .custom-horizontal-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-horizontal-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(71, 85, 105, 0.4);
      border-radius: 9999px;
    }
    .custom-horizontal-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(99, 102, 241, 0.6);
    }
  `]
})
export class LibraryCarouselShelfComponent implements AfterViewInit, OnDestroy {
  @Input() title?: string;
  @Input({ required: true }) items: (Manga | Book)[] = [];
  @Input() type: 'manga' | 'book' = 'manga';
  @Input() order: OrderType = OrderType.Name;
  @Input() shelfId?: string;

  @Output() open = new EventEmitter<Manga | Book>();
  @Output() openDetail = new EventEmitter<Manga | Book>();
  @Output() setBookmark = new EventEmitter<Manga | Book>();
  @Output() openTracker = new EventEmitter<Manga | Book>();
  @Output() openTags = new EventEmitter<Manga | Book>();

  @ViewChild('track') trackRef?: ElementRef<HTMLDivElement>;

  canScrollLeft = signal<boolean>(false);
  canScrollRight = signal<boolean>(false);

  private isDragging = false;
  private startX = 0;
  private scrollStart = 0;
  private dragThresholdPassed = false;
  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.checkScroll();
    }, 100);

    if (typeof ResizeObserver !== 'undefined' && this.trackRef?.nativeElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.checkScroll();
      });
      this.resizeObserver.observe(this.trackRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  getItemKey(item: Manga | Book): string | number {
    return item.id || item.path || item.title;
  }

  getItemCountLabel(): string {
    if (this.order === OrderType.Series) {
      return this.items.length === 1 ? 'volume' : 'volumes';
    }
    return this.items.length === 1
      ? (this.type === 'manga' ? 'item' : 'livro')
      : (this.type === 'manga' ? 'itens' : 'livros');
  }

  checkScroll(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;

    const atStart = el.scrollLeft <= 5;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 5;

    this.canScrollLeft.set(!atStart);
    this.canScrollRight.set(!atEnd);
  }

  scrollLeft(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    const scrollAmount = Math.max(300, el.clientWidth * 0.75);
    el.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  }

  scrollRight(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    const scrollAmount = Math.max(300, el.clientWidth * 0.75);
    el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }

  onWheel(event: WheelEvent): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;

    // Convert vertical wheel scrolling to horizontal scrolling seamlessly
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      if (el.scrollWidth > el.clientWidth) {
        el.scrollLeft += event.deltaY * 1.5;
        event.preventDefault();
        this.checkScroll();
      }
    }
  }

  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const el = this.trackRef?.nativeElement;
    if (!el) return;

    this.isDragging = true;
    this.dragThresholdPassed = false;
    this.startX = event.clientX;
    this.scrollStart = el.scrollLeft;
    el.classList.add('cursor-grabbing');
    el.classList.remove('cursor-grab');
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDragging) return;
    const el = this.trackRef?.nativeElement;
    if (!el) return;

    const diff = event.clientX - this.startX;
    if (Math.abs(diff) > 5) {
      this.dragThresholdPassed = true;
    }
    el.scrollLeft = this.scrollStart - diff;
    this.checkScroll();
  }

  onPointerUp(): void {
    this.isDragging = false;
    const el = this.trackRef?.nativeElement;
    if (el) {
      el.classList.remove('cursor-grabbing');
      el.classList.add('cursor-grab');
    }
  }
}
