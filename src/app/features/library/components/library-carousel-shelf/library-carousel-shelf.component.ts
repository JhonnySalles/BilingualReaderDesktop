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
import { isBigScroll } from '../../../../shared/scroll-edges-button/scroll-edges.util';

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
        
        <!-- Floating Left Arrow Overlay (Ir para o início) -->
        <button
          type="button"
          (click)="scrollToStart()"
          (mouseenter)="onButtonMouseEnter()"
          (mouseleave)="onButtonMouseLeave()"
          [class.opacity-0]="!canScrollLeft() || !isVisible()"
          [class.pointer-events-none]="!canScrollLeft() || !isVisible()"
          [class.opacity-100]="canScrollLeft() && isVisible()"
          class="absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 backdrop-blur-xl border cursor-pointer focus:outline-none group opacity-0 pointer-events-none"
          [ngClass]="type === 'book'
            ? 'bg-slate-900/90 text-amber-300 border-slate-700/70 hover:border-amber-500/70 hover:bg-slate-800 hover:text-amber-200 hover:shadow-amber-500/25 active:bg-amber-950/40'
            : 'bg-slate-900/90 text-indigo-300 border-slate-700/70 hover:border-indigo-500/70 hover:bg-slate-800 hover:text-indigo-200 hover:shadow-indigo-500/25 active:bg-indigo-950/40'"
          title="Ir para o início">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5 transition-transform duration-200 group-hover:-translate-x-0.5"
            [class.animate-arrow-left]="isAnimatingLeft()"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2.2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        <!-- Floating Right Arrow Overlay (Ir para o final) -->
        <button
          type="button"
          (click)="scrollToEnd()"
          (mouseenter)="onButtonMouseEnter()"
          (mouseleave)="onButtonMouseLeave()"
          [class.opacity-0]="!canScrollRight() || !isVisible()"
          [class.pointer-events-none]="!canScrollRight() || !isVisible()"
          [class.opacity-100]="canScrollRight() && isVisible()"
          class="absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 backdrop-blur-xl border cursor-pointer focus:outline-none group opacity-0 pointer-events-none"
          [ngClass]="type === 'book'
            ? 'bg-slate-900/90 text-amber-300 border-slate-700/70 hover:border-amber-500/70 hover:bg-slate-800 hover:text-amber-200 hover:shadow-amber-500/25 active:bg-amber-950/40'
            : 'bg-slate-900/90 text-indigo-300 border-slate-700/70 hover:border-indigo-500/70 hover:bg-slate-800 hover:text-indigo-200 hover:shadow-indigo-500/25 active:bg-indigo-950/40'"
          title="Ir para o final">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5"
            [class.animate-arrow-right]="isAnimatingRight()"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2.2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
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
          (scroll)="onTrackScroll()"
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
  isVisible = signal<boolean>(false);
  isAnimatingLeft = signal<boolean>(false);
  isAnimatingRight = signal<boolean>(false);

  private isDragging = false;
  private startX = 0;
  private scrollStart = 0;
  private dragThresholdPassed = false;
  private resizeObserver?: ResizeObserver;
  private lastRestScrollLeft = 0;
  private hideTimer: any = null;
  private isHovered = false;

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.checkScroll();
      if (this.trackRef?.nativeElement) {
        this.lastRestScrollLeft = this.trackRef.nativeElement.scrollLeft;
      }
    }, 100);

    if (typeof ResizeObserver !== 'undefined' && this.trackRef?.nativeElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.checkScroll();
      });
      this.resizeObserver.observe(this.trackRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }
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

  onTrackScroll(): void {
    this.checkScroll();
    const el = this.trackRef?.nativeElement;
    if (!el) return;

    if (isBigScroll(el.scrollLeft, this.lastRestScrollLeft, 150)) {
      this.isVisible.set(true);
    }

    if (this.isVisible()) {
      this.resetHideTimer();
    }
  }

  private resetHideTimer(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }

    this.hideTimer = setTimeout(() => {
      if (!this.isHovered) {
        this.isVisible.set(false);
        const el = this.trackRef?.nativeElement;
        if (el) {
          this.lastRestScrollLeft = el.scrollLeft;
        }
      }
    }, 3000);
  }

  onButtonMouseEnter(): void {
    this.isHovered = true;
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }
  }

  onButtonMouseLeave(): void {
    this.isHovered = false;
    if (this.isVisible()) {
      this.resetHideTimer();
    }
  }

  checkScroll(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;

    const atStart = el.scrollLeft <= 5;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 5;

    this.canScrollLeft.set(!atStart);
    this.canScrollRight.set(!atEnd);
  }

  scrollToStart(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    this.isAnimatingLeft.set(true);
    setTimeout(() => this.isAnimatingLeft.set(false), 500);
    this.isVisible.set(true);
    this.resetHideTimer();
    el.scrollTo({ left: 0, behavior: 'smooth' });
  }

  scrollToEnd(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    this.isAnimatingRight.set(true);
    setTimeout(() => this.isAnimatingRight.set(false), 500);
    this.isVisible.set(true);
    this.resetHideTimer();
    el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
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
        this.onTrackScroll();
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
    this.onTrackScroll();
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
