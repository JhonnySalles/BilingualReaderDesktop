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
import { HistoryStatisticsItem } from '../../../core/models';
import { HistoryStatsCardComponent } from './history-stats-card.component';

@Component({
  selector: 'app-history-stats-carousel-shelf',
  standalone: true,
  imports: [CommonModule, HistoryStatsCardComponent],
  template: `
    <div class="w-full relative group/shelf my-5 first:mt-1">

      <!-- Shelf Header (when title is provided) -->
      @if (title) {
        <div class="flex items-center justify-between gap-3 mb-2 px-1">
          <div class="flex items-center gap-2.5 min-w-0">
            <span
              class="text-xs font-bold font-mono px-2.5 py-1 rounded-lg border flex items-center gap-1.5 shadow-sm truncate"
              [ngClass]="headerBadgeClass">
              <span class="w-1.5 h-1.5 rounded-full" [ngClass]="headerDotClass"></span>
              {{ title }}
            </span>

            <span class="text-[11px] font-medium text-slate-400 font-mono">
              {{ items.length }} {{ items.length === 1 ? 'leitura' : 'leituras' }}
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
            <div class="flex-none w-36 sm:w-44 xl:w-48 flex flex-col">
              <app-history-stats-card
                [item]="item"
                [cardStyle]="cardStyle"
                [instanceId]="'shelf-' + (shelfId || 'hist') + '-' + getItemKey(item)"
                (open)="onCardClick(item)">
              </app-history-stats-card>
            </div>
          }
        </div>

      </div>

    </div>
  `
})
export class HistoryStatsCarouselShelfComponent implements AfterViewInit, OnDestroy {
  @Input() title?: string;
  @Input({ required: true }) items: HistoryStatisticsItem[] = [];
  @Input() cardStyle: 'STANDARD' | 'OVERLAY' = 'STANDARD';
  @Input() shelfId?: string;
  @Input() mediaType?: 'ALL' | 'MANGA' | 'BOOK' = 'ALL';

  @Output() open = new EventEmitter<HistoryStatisticsItem>();

  @ViewChild('track') trackRef?: ElementRef<HTMLDivElement>;

  canScrollLeft = signal<boolean>(false);
  canScrollRight = signal<boolean>(false);

  private isDragging = false;
  private startX = 0;
  private scrollStart = 0;
  private dragThresholdPassed = false;
  private resizeObserver?: ResizeObserver;

  get headerBadgeClass(): string {
    if (this.mediaType === 'MANGA') {
      return 'manga-badge bg-indigo-500/10';
    }
    if (this.mediaType === 'BOOK') {
      return 'bg-amber-500/10 text-amber-300 border-amber-500/25';
    }
    return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25';
  }

  get headerDotClass(): string {
    if (this.mediaType === 'MANGA') {
      return 'manga-section-dot';
    }
    if (this.mediaType === 'BOOK') {
      return 'bg-amber-400';
    }
    return 'bg-indigo-400';
  }

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

  getItemKey(item: HistoryStatisticsItem): string {
    return `${item.id}-${item.sessionDate}-${item.fkReference}`;
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

  onCardClick(item: HistoryStatisticsItem): void {
    if (this.dragThresholdPassed) {
      this.dragThresholdPassed = false;
      return;
    }
    this.open.emit(item);
  }
}
