import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MangaFitMode,
  MangaScrollingMode,
  PageTransitionType,
  isMangaHorizontalMode,
  isMangaLongStripMode,
  isMangaRtlMode
} from '../../core/models';
import { NormalizedSubtitleText } from '../../core/utils/subtitle-normalize';
import { MangaSubtitleOverlayComponent } from './subtitle/manga-subtitle-overlay.component';
import {
  applyColumnAction,
  canScrollSlot,
  DRAG_THRESHOLD_PX,
  pageLandOffsets,
  planColumnStep,
  readSlotOverflow,
  resolvePagerDragTarget,
  type PageLand
} from './manga-reader-navigation';

const WHEEL_PAGE_THRESHOLD = 200;
const PROGRAMMATIC_SCROLL_FALLBACK_MS = 1000;

/**
 * Single-page (carousel / long-strip) viewport.
 * Isolated from dual-spread so shell can swap by scrolling mode.
 */
@Component({
  selector: 'app-manga-spread-viewport',
  standalone: true,
  imports: [CommonModule, MangaSubtitleOverlayComponent],
  host: { class: 'block h-full w-full relative' },
  styles: [`
    .reader-zoom-img {
      -webkit-user-drag: none;
      user-drag: none;
    }
    .reader-zoom-original {
      zoom: var(--reader-zoom, 1);
      max-width: none;
    }
    .reader-zoom-strip {
      width: calc(100% * var(--reader-zoom, 1));
      max-width: none;
    }
    .reader-viewport {
      overscroll-behavior: contain;
    }
    .reader-viewport.is-panning,
    .reader-viewport.is-turning {
      scroll-behavior: auto !important;
      scroll-snap-type: none !important;
    }
  `],
  template: `
    <div
      #viewport
      class="outline-none absolute inset-0"
      [class]="viewportClasses()"
      [class.cursor-grab]="!panning()"
      [class.cursor-grabbing]="panning()"
      (scroll)="onViewportScroll()"
      (click)="onHostClick($event)"
      (wheel)="onWheel($event)"
      (pointerdown)="onPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="onPointerUp($event)"
      (pointercancel)="onPointerUp($event)">
      @if (isLongStrip()) {
        <div class="reader-zoom-strip flex flex-col items-center mx-auto"
          [class.gap-6]="scrollingMode === MangaScrollingMode.LongStripGap"
          [style.--reader-zoom]="zoom">
          @for (url of pages; track $index; let i = $index) {
            @if (scrollingMode === MangaScrollingMode.LongStripGap && i > 0) {
              <div class="text-[10px] uppercase tracking-wider text-slate-500 py-2">{{ i }} / {{ pages.length }}</div>
            }
            @if (isShowingLinked(i) && linkedList(i).length > 1) {
              <div class="flex items-start justify-center gap-0.5 w-full" [attr.data-page]="i">
                @for (lu of linkedList(i); track $index) {
                  <img
                    [src]="lu"
                    [alt]="'Tradução ' + (i + 1)"
                    [loading]="eagerNear(i) ? 'eager' : 'lazy'"
                    draggable="false"
                    [class]="pageImageClasses()"
                    [style.filter]="cssFilter || null"
                    (dragstart)="$event.preventDefault()"
                    (load)="linkedImageLoad.emit(i)"
                    (error)="imageError.emit({ page: i, url: lu })" />
                }
              </div>
            } @else {
              <div class="relative inline-block max-h-full max-w-full">
                <img
                  [attr.data-page]="i"
                  [src]="displayUrl(i)"
                  [alt]="'Página ' + (i + 1)"
                  [loading]="eagerNear(i) ? 'eager' : 'lazy'"
                  draggable="false"
                  [class]="pageImageClasses()"
                  [style.filter]="cssFilter || null"
                  (dragstart)="$event.preventDefault()"
                  (load)="onImgLoad(i, $event)"
                  (error)="imageError.emit({ page: i, url: displayUrl(i) })" />
                @for (tint of tintOverlays; track $index) {
                  <div class="absolute inset-0 pointer-events-none" [style.background]="tint"></div>
                }
                @if (showSubtitleOverlay && i === activeReadPage && subtitleTexts.length) {
                  <app-manga-subtitle-overlay
                    [visible]="true"
                    [texts]="subtitleTexts"
                    [imageWidth]="naturalSize(i).w"
                    [imageHeight]="naturalSize(i).h"
                    [selectedSequence]="selectedSubtitleSeq"
                    (selectText)="selectText.emit($event)" />
                }
                @if (showOcrOverlay && i === activeReadPage && ocrTexts.length) {
                  <app-manga-subtitle-overlay
                    [visible]="true"
                    [texts]="ocrTexts"
                    [imageWidth]="naturalSize(i).w"
                    [imageHeight]="naturalSize(i).h"
                    [selectedSequence]="null"
                    (selectText)="selectText.emit($event)" />
                }
              </div>
            }
          }
        </div>
      } @else {
        @for (url of pages; track $index; let i = $index) {
          <div
            class="reader-page snap-center shrink-0 flex items-center justify-center"
            [attr.data-page]="i"
            [class]="pagedSlotClasses()">
            @if (isShowingLinked(i) && linkedList(i).length > 1) {
              <div class="flex items-center justify-center gap-0.5 h-full"
                [style.width.%]="zoomWidthPercent()"
                [style.height.%]="zoomHeightPercent()"
                [style.--reader-zoom]="zoom">
                @for (lu of linkedList(i); track $index) {
                  <img
                    [src]="lu"
                    [alt]="'Tradução ' + (i + 1)"
                    [loading]="eagerNear(i) ? 'eager' : 'lazy'"
                    draggable="false"
                    [class]="pageImageClasses()"
                    [style.filter]="cssFilter || null"
                    (dragstart)="$event.preventDefault()"
                    (load)="linkedImageLoad.emit(i)"
                    (error)="imageError.emit({ page: i, url: lu })" />
                }
              </div>
            } @else {
              <div class="relative inline-block max-h-full max-w-full"
                [style.width.%]="zoomWidthPercent()"
                [style.height.%]="zoomHeightPercent()"
                [style.--reader-zoom]="zoom">
                <img
                  [attr.data-page]="i"
                  [src]="displayUrl(i)"
                  [alt]="'Página ' + (i + 1)"
                  [loading]="eagerNear(i) ? 'eager' : 'lazy'"
                  draggable="false"
                  [class]="pageImageClasses()"
                  [style.filter]="cssFilter || null"
                  (dragstart)="$event.preventDefault()"
                  (load)="onImgLoad(i, $event)"
                  (error)="imageError.emit({ page: i, url: displayUrl(i) })" />
                @for (tint of tintOverlays; track $index) {
                  <div class="absolute inset-0 pointer-events-none" [style.background]="tint"></div>
                }
                @if (showSubtitleOverlay && i === activeReadPage && subtitleTexts.length) {
                  <app-manga-subtitle-overlay
                    [visible]="true"
                    [texts]="subtitleTexts"
                    [imageWidth]="naturalSize(i).w"
                    [imageHeight]="naturalSize(i).h"
                    [selectedSequence]="selectedSubtitleSeq"
                    (selectText)="selectText.emit($event)" />
                }
                @if (showOcrOverlay && i === activeReadPage && ocrTexts.length) {
                  <app-manga-subtitle-overlay
                    [visible]="true"
                    [texts]="ocrTexts"
                    [imageWidth]="naturalSize(i).w"
                    [imageHeight]="naturalSize(i).h"
                    [selectedSequence]="null"
                    (selectText)="selectText.emit($event)" />
                }
              </div>
            }
          </div>
        }
      }
    </div>
  `
})
export class MangaSpreadViewportComponent {
  @ViewChild('viewport') viewportRef?: ElementRef<HTMLElement>;

  MangaScrollingMode = MangaScrollingMode;

  @Input() pages: string[] = [];
  @Input() currentPage = 0;
  @Input() scrollingMode: MangaScrollingMode = MangaScrollingMode.Horizontal;
  @Input() fitMode: MangaFitMode = MangaFitMode.FitWidth;
  @Input() zoom = 1;
  @Input() linkedUrls: Record<number, string[]> = {};
  @Input() showingLinked: Record<number, boolean> = {};
  @Input() cssFilter = '';
  @Input() tintOverlays: string[] = [];
  @Input() subtitleTexts: NormalizedSubtitleText[] = [];
  @Input() ocrTexts: NormalizedSubtitleText[] = [];
  @Input() showSubtitleOverlay = false;
  @Input() showOcrOverlay = false;
  @Input() selectedSubtitleSeq: number | null = null;
  @Input() pageNaturals: Record<number, { w: number; h: number }> = {};
  @Input() activeReadPage = 0;
  @Input() turning = false;
  @Input() loading = false;
  @Input() effect: PageTransitionType = PageTransitionType.Default;

  @Output() pageChange = new EventEmitter<{ page: number; land: PageLand }>();
  @Output() pageSync = new EventEmitter<number>();
  @Output() viewportClick = new EventEmitter<MouseEvent>();
  @Output() viewportWheel = new EventEmitter<WheelEvent>();
  @Output() shiftMagnify = new EventEmitter<PointerEvent>();
  @Output() imageSized = new EventEmitter<{ page: number; width: number; height: number }>();
  @Output() imageError = new EventEmitter<{ page: number; url: string }>();
  @Output() linkedImageLoad = new EventEmitter<number>();
  @Output() selectText = new EventEmitter<NormalizedSubtitleText>();
  @Output() dragFlag = new EventEmitter<boolean>();
  /** Interactive curl drag progress; commit null while dragging. */
  @Output() curlDrag = new EventEmitter<{
    factor: number;
    goingNext: boolean;
    commit: boolean | null;
  }>();

  panning = signal(false);

  private wheelAccum = 0;
  private didDrag = false;
  private panPointerId: number | null = null;
  private panLastX = 0;
  private panLastY = 0;
  private panStartX = 0;
  private panStartY = 0;
  private panStartTime = 0;
  private panStartPage = 0;
  private panStartScrollLeft = 0;
  private panStartScrollTop = 0;
  private panTarget: HTMLElement | null = null;
  private lockToPagePan = false;
  private pagerDragActive = false;
  private gestureModePending = false;
  private curlDragging = false;
  private scrollSyncLock = false;
  private scrollLockTimer: ReturnType<typeof setTimeout> | null = null;
  private scrollEndHandler: (() => void) | null = null;
  private pendingJump: number | null = null;
  private pendingPageLand: PageLand = 'start';

  get viewportEl(): HTMLElement | null {
    return this.viewportRef?.nativeElement ?? null;
  }

  isLongStrip(): boolean {
    return isMangaLongStripMode(this.scrollingMode);
  }

  isHorizontal(): boolean {
    return isMangaHorizontalMode(this.scrollingMode);
  }

  isRtl(): boolean {
    return isMangaRtlMode(this.scrollingMode);
  }

  isShowingLinked(page: number): boolean {
    return !!this.showingLinked[page] && (this.linkedUrls[page]?.length ?? 0) > 0;
  }

  linkedList(page: number): string[] {
    return this.linkedUrls[page] || [];
  }

  displayUrl(page: number): string {
    if (this.isShowingLinked(page)) {
      const urls = this.linkedList(page);
      if (urls.length) return urls[0];
    }
    return this.pages[page] || '';
  }

  naturalSize(page: number): { w: number; h: number } {
    return this.pageNaturals[page] || { w: 1, h: 1 };
  }

  eagerNear(index: number): boolean {
    return Math.abs(index - this.currentPage) <= 2;
  }

  private isCurlEffect(): boolean {
    return (
      this.effect === PageTransitionType.CurlPage ||
      this.effect === PageTransitionType.Curl3DPage
    );
  }

  viewportClasses(): string {
    const pan = this.panning() || this.turning ? ' is-panning is-turning' : '';
    const base = 'reader-viewport outline-none touch-none';
    if (this.isHorizontal()) {
      return this.isRtl()
        ? `${base} overflow-x-auto overflow-y-hidden flex flex-row-reverse snap-x snap-mandatory scroll-smooth${pan}`
        : `${base} overflow-x-auto overflow-y-hidden flex snap-x snap-mandatory scroll-smooth${pan}`;
    }
    if (this.scrollingMode === MangaScrollingMode.Vertical) {
      return `${base} overflow-y-auto overflow-x-hidden flex flex-col snap-y snap-mandatory scroll-smooth${pan}`;
    }
    return `${base} overflow-y-auto overflow-x-hidden scroll-smooth${pan}`;
  }

  pagedSlotClasses(): string {
    const zoomed = this.zoom !== 1;
    if (this.isHorizontal()) {
      return zoomed
        ? 'w-full h-full min-w-full overflow-y-auto overflow-x-auto overscroll-contain'
        : 'w-full h-full min-w-full overflow-y-auto overflow-x-hidden overscroll-contain';
    }
    return zoomed
      ? 'w-full min-h-full h-full overflow-y-auto overflow-x-auto overscroll-contain'
      : 'w-full min-h-full h-full overflow-y-auto overflow-x-hidden overscroll-contain';
  }

  pageImageClasses(): string {
    const base = 'reader-zoom-img block object-contain [-webkit-user-drag:none]';
    if (this.isLongStrip()) {
      return `${base} w-full h-auto`;
    }
    if (this.fitMode === MangaFitMode.FitHeight) {
      return `${base} w-auto max-w-full`;
    }
    if (this.fitMode === MangaFitMode.Original) {
      return `${base} reader-zoom-original w-auto h-auto`;
    }
    return `${base} h-auto w-full max-w-full`;
  }

  zoomWidthPercent(): number | null {
    if (this.isLongStrip()) return null;
    if (this.fitMode === MangaFitMode.FitWidth) return 100 * this.zoom;
    return null;
  }

  zoomHeightPercent(): number | null {
    if (this.isLongStrip()) return null;
    if (this.fitMode === MangaFitMode.FitHeight) return 100 * this.zoom;
    return null;
  }

  onHostClick(ev: MouseEvent): void {
    if (this.didDrag) {
      this.didDrag = false;
      this.dragFlag.emit(false);
      return;
    }
    this.viewportClick.emit(ev);
  }

  onImgLoad(page: number, ev: Event): void {
    const img = ev.target as HTMLImageElement;
    if (img?.naturalWidth && img?.naturalHeight) {
      this.imageSized.emit({
        page,
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    }
  }

  onWheel(ev: WheelEvent): void {
    if (this.loading) return;
    if (ev.ctrlKey) {
      this.viewportWheel.emit(ev);
      return;
    }
    if (!this.isHorizontal()) return;

    ev.preventDefault();
    const slot = this.currentPageSlot();
    if (slot && canScrollSlot(slot, 'y', ev.deltaY > 0 ? 1 : -1)) {
      slot.scrollTop += ev.deltaY;
      this.wheelAccum = 0;
      return;
    }

    this.wheelAccum += ev.deltaY;
    if (Math.abs(this.wheelAccum) < WHEEL_PAGE_THRESHOLD) return;

    const forward = this.wheelAccum > 0;
    this.wheelAccum = 0;
    const next = this.isRtl()
      ? forward
        ? this.currentPage - 1
        : this.currentPage + 1
      : forward
        ? this.currentPage + 1
        : this.currentPage - 1;
    const land: PageLand = next > this.currentPage ? 'start' : 'end';
    this.pageChange.emit({ page: next, land });
  }

  onPointerDown(ev: PointerEvent): void {
    if (ev.button !== 0 || this.loading) return;
    if (ev.shiftKey) {
      this.shiftMagnify.emit(ev);
      return;
    }
    const el = this.viewportEl;
    if (!el) return;

    this.didDrag = false;
    this.dragFlag.emit(false);
    this.panning.set(true);
    this.panPointerId = ev.pointerId;
    this.panLastX = ev.clientX;
    this.panLastY = ev.clientY;
    this.panStartX = ev.clientX;
    this.panStartY = ev.clientY;
    this.panStartTime = performance.now();
    this.panStartPage = this.currentPage;
    this.panStartScrollLeft = el.scrollLeft;
    this.panStartScrollTop = el.scrollTop;
    this.panTarget = this.currentPageSlot() || el;
    this.lockToPagePan = false;
    this.pagerDragActive = false;
    this.gestureModePending = !this.isLongStrip();
    this.curlDragging = false;

    ev.preventDefault();
    try {
      el.setPointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
  }

  onPointerMove(ev: PointerEvent): void {
    if (this.panPointerId !== ev.pointerId || !this.panning()) return;
    const dx = ev.clientX - this.panLastX;
    const dy = ev.clientY - this.panLastY;
    this.panLastX = ev.clientX;
    this.panLastY = ev.clientY;

    const totalDx = ev.clientX - this.panStartX;
    const totalDy = ev.clientY - this.panStartY;
    if (Math.abs(totalDx) + Math.abs(totalDy) > DRAG_THRESHOLD_PX) {
      this.didDrag = true;
      this.dragFlag.emit(true);
    }

    const slot = this.panTarget;
    const viewport = this.viewportEl;
    if (!viewport) return;

    if (this.isLongStrip()) {
      viewport.scrollTop -= dy;
      viewport.scrollLeft -= dx;
      return;
    }

    if (this.gestureModePending && this.didDrag) {
      this.gestureModePending = false;
      const dominantX = Math.abs(totalDx) >= Math.abs(totalDy);
      const slotEl = slot && slot !== viewport ? slot : this.currentPageSlot();
      if (slotEl) {
        if (dominantX) {
          const dir = (totalDx < 0 ? 1 : -1) as 1 | -1;
          this.lockToPagePan = canScrollSlot(slotEl, 'x', dir);
          if (!this.lockToPagePan && Math.abs(totalDy) > DRAG_THRESHOLD_PX) {
            this.lockToPagePan = canScrollSlot(slotEl, 'y', totalDy < 0 ? 1 : -1);
          }
        } else {
          const dir = (totalDy < 0 ? 1 : -1) as 1 | -1;
          this.lockToPagePan = canScrollSlot(slotEl, 'y', dir);
          if (!this.lockToPagePan && Math.abs(totalDx) > DRAG_THRESHOLD_PX) {
            this.lockToPagePan = canScrollSlot(slotEl, 'x', totalDx < 0 ? 1 : -1);
          }
        }
      }
      this.pagerDragActive = !this.lockToPagePan;
    }

    if (this.lockToPagePan && slot && slot !== viewport) {
      slot.scrollTop -= dy;
      slot.scrollLeft -= dx;
      return;
    }

    if (this.gestureModePending) return;

    this.pagerDragActive = true;

    // Interactive curl follows the finger (horizontal paged only).
    if (this.isCurlEffect() && this.isHorizontal()) {
      this.curlDragging = true;
      const w = viewport.clientWidth || 1;
      const goingNext = this.isRtl() ? totalDx > 0 : totalDx < 0;
      const progress = Math.min(1, Math.abs(totalDx) / Math.max(w * 0.45, 1));
      // Hold carousel on the start page while curl paints over it.
      viewport.scrollLeft = this.panStartScrollLeft;
      viewport.scrollTop = this.panStartScrollTop;
      this.curlDrag.emit({ factor: -progress, goingNext, commit: null });
      return;
    }

    if (this.isHorizontal()) {
      viewport.scrollLeft -= dx;
    } else {
      viewport.scrollTop -= dy;
    }
  }

  onPointerUp(ev: PointerEvent): void {
    if (this.panPointerId !== ev.pointerId) return;
    const el = this.viewportEl;
    if (el && this.panPointerId != null) {
      try {
        el.releasePointerCapture(this.panPointerId);
      } catch {
        /* ignore */
      }
    }

    const wasDrag = this.didDrag;
    const wasPager = this.pagerDragActive && wasDrag && !this.isLongStrip();
    const wasCurl = this.curlDragging;
    const startPage = this.panStartPage;
    const startLeft = this.panStartScrollLeft;
    const startTop = this.panStartScrollTop;
    const startTime = this.panStartTime;
    const totalDx = ev.clientX - this.panStartX;

    this.panPointerId = null;
    this.panTarget = null;
    this.lockToPagePan = false;
    this.pagerDragActive = false;
    this.gestureModePending = false;
    this.curlDragging = false;
    this.panning.set(false);

    if (wasCurl && this.isHorizontal()) {
      const w = el?.clientWidth || 1;
      const commit = Math.abs(totalDx) >= DRAG_THRESHOLD_PX;
      const goingNext = this.isRtl() ? totalDx > 0 : totalDx < 0;
      const progress = Math.min(1, Math.abs(totalDx) / Math.max(w * 0.45, 1));
      this.curlDrag.emit({ factor: -progress, goingNext, commit });
      if (commit) {
        const target = goingNext ? startPage + 1 : startPage - 1;
        const max = Math.max(0, this.pages.length - 1);
        const page = Math.min(Math.max(0, target), max);
        if (page !== startPage) {
          const land: PageLand = page > startPage ? 'start' : 'end';
          this.pageChange.emit({ page, land });
        } else if (el) {
          el.scrollLeft = startLeft;
          el.scrollTop = startTop;
        }
      } else if (el) {
        el.scrollLeft = startLeft;
        el.scrollTop = startTop;
      }
      return;
    }

    if (!wasPager || !el) return;

    const elapsed = Math.max(1, performance.now() - startTime) / 1000;
    const pageCount = this.pages.length;
    if (this.isHorizontal()) {
      const delta = el.scrollLeft - startLeft;
      const pageW = el.clientWidth || 1;
      const velocity = delta / elapsed;
      const target = resolvePagerDragTarget({
        startPage,
        delta,
        pageSize: pageW,
        pageCount,
        velocityPxPerS: velocity
      });
      const land: PageLand = target > startPage ? 'start' : target < startPage ? 'end' : 'start';
      this.pageChange.emit({ page: target, land });
    } else if (this.scrollingMode === MangaScrollingMode.Vertical) {
      const delta = el.scrollTop - startTop;
      const pageH = el.clientHeight || 1;
      const velocity = delta / elapsed;
      const target = resolvePagerDragTarget({
        startPage,
        delta,
        pageSize: pageH,
        pageCount,
        velocityPxPerS: velocity
      });
      const land: PageLand = target > startPage ? 'start' : target < startPage ? 'end' : 'start';
      this.pageChange.emit({ page: target, land });
    }
  }

  onViewportScroll(): void {
    if (this.scrollSyncLock || this.loading) return;
    this.syncCurrentPageFromDom();
  }

  /** Flush a pending programmatic jump after view exists. */
  flushPendingJump(): void {
    if (this.pendingJump == null || !this.viewportEl || this.loading) return;
    const page = this.pendingJump;
    this.pendingJump = null;
    this.scrollToPage(page, false, this.pendingPageLand);
  }

  scrollToPage(page: number, smooth: boolean, land: PageLand = this.pendingPageLand): void {
    const el = this.viewportEl;
    if (!el) {
      this.pendingJump = page;
      this.pendingPageLand = land;
      return;
    }

    this.beginProgrammaticScroll(smooth);
    const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto';

    if (this.isHorizontal() && !this.isRtl()) {
      el.scrollTo({ left: page * el.clientWidth, behavior });
    } else if (this.scrollingMode === MangaScrollingMode.Vertical) {
      el.scrollTo({ top: page * el.clientHeight, behavior });
    } else {
      const target = el.querySelector(`[data-page="${page}"]`) as HTMLElement | null;
      target?.scrollIntoView({ behavior, block: 'nearest', inline: 'center' });
    }

    const delay = smooth ? PROGRAMMATIC_SCROLL_FALLBACK_MS : 0;
    setTimeout(() => {
      const slot = el.querySelector(`[data-page="${page}"]`) as HTMLElement | null;
      if (!slot || this.isLongStrip()) return;
      const offsets = pageLandOffsets(slot, land, this.isRtl());
      slot.scrollTop = offsets.top;
      slot.scrollLeft = offsets.left;
    }, delay);
  }

  currentPageSlot(): HTMLElement | null {
    return this.pageSlotAt(this.currentPage);
  }

  pageSlotAt(page: number): HTMLElement | null {
    const el = this.viewportEl;
    if (!el) return null;
    return el.querySelector(`[data-page="${page}"]`) as HTMLElement | null;
  }

  tryScrollCurrentPage(dir: 1 | -1): boolean {
    if (this.isLongStrip()) return false;
    if (!this.isHorizontal() && this.scrollingMode !== MangaScrollingMode.Vertical) {
      return false;
    }
    const slot = this.currentPageSlot();
    if (!slot) return false;

    const overflow = readSlotOverflow(slot);
    const action = planColumnStep({
      overflow,
      dir,
      rtl: this.isRtl(),
      allowHorizontalColumns: this.isHorizontal() || this.zoom !== 1,
      clientWidth: slot.clientWidth,
      clientHeight: slot.clientHeight
    });
    return applyColumnAction(slot, action);
  }

  resetSlotScroll(): void {
    const slot = this.currentPageSlot();
    if (slot) {
      slot.scrollTop = 0;
      slot.scrollLeft = 0;
    }
  }

  private beginProgrammaticScroll(smooth: boolean): void {
    this.scrollSyncLock = true;
    this.clearProgrammaticScrollListeners();
    const el = this.viewportEl;
    if (smooth && el) {
      this.scrollEndHandler = () => this.endProgrammaticScroll();
      el.addEventListener('scrollend', this.scrollEndHandler, { once: true });
    }
    this.scrollLockTimer = setTimeout(() => {
      this.endProgrammaticScroll();
    }, smooth ? PROGRAMMATIC_SCROLL_FALLBACK_MS : 50);
  }

  private endProgrammaticScroll(): void {
    if (!this.scrollSyncLock) return;
    this.clearProgrammaticScrollListeners();
    this.scrollSyncLock = false;
    this.syncCurrentPageFromDom();
  }

  private clearProgrammaticScrollListeners(): void {
    if (this.scrollLockTimer) {
      clearTimeout(this.scrollLockTimer);
      this.scrollLockTimer = null;
    }
    const el = this.viewportEl;
    if (el && this.scrollEndHandler) {
      el.removeEventListener('scrollend', this.scrollEndHandler);
      this.scrollEndHandler = null;
    }
  }

  private syncCurrentPageFromDom(): void {
    const el = this.viewportEl;
    if (!el) return;

    let index = this.currentPage;
    if (this.isHorizontal()) {
      if (this.isRtl()) {
        index = this.nearestPageFromDom(el);
      } else {
        const pageW = el.clientWidth || 1;
        index = Math.round(el.scrollLeft / pageW);
      }
    } else if (this.scrollingMode === MangaScrollingMode.Vertical) {
      const pageH = el.clientHeight || 1;
      index = Math.round(el.scrollTop / pageH);
    } else {
      index = this.nearestPageFromDom(el);
    }

    index = Math.min(Math.max(0, index), Math.max(0, this.pages.length - 1));
    if (index !== this.currentPage) {
      this.pageSync.emit(index);
    }
  }

  private nearestPageFromDom(el: HTMLElement): number {
    const nodes = Array.from(el.querySelectorAll('[data-page]')) as HTMLElement[];
    if (nodes.length === 0) return 0;
    const midY = el.scrollTop + el.clientHeight / 2;
    const midX = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const node of nodes) {
      const page = Number(node.getAttribute('data-page') || 0);
      const top = node.offsetTop;
      const left = node.offsetLeft;
      const dist = this.isHorizontal()
        ? Math.abs(left + node.offsetWidth / 2 - midX)
        : Math.abs(top + node.offsetHeight / 2 - midY);
      if (dist < bestDist) {
        bestDist = dist;
        best = page;
      }
    }
    return best;
  }
}
