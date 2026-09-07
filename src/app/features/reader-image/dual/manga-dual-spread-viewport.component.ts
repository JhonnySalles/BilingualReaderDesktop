import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MangaFitMode, PageTransitionType } from '../../../core/models';
import { NormalizedSubtitleText } from '../../../core/utils/subtitle-normalize';
import { MangaSubtitleOverlayComponent } from '../subtitle/manga-subtitle-overlay.component';
import {
  MangaSpread,
  visualOrder
} from './manga-dual-spread';
import { DRAG_THRESHOLD_PX } from '../manga-reader-navigation';

/**
 * Dual-page (spread) viewport for desktop manga reading.
 * Isolated from the Android-parity single-page carousel so spread-turn
 * animations live in the parent overlay (app-manga-page-turn-layer).
 */
@Component({
  selector: 'app-manga-dual-spread-viewport',
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
    .dual-viewport {
      overscroll-behavior: contain;
    }
    .dual-viewport.is-panning {
      cursor: grabbing;
    }
  `],
  template: `
    <div
      #viewport
      class="dual-viewport absolute inset-0 outline-none overflow-auto flex items-center justify-center bg-slate-950"
      [class.is-panning]="panning()"
      [class.cursor-grab]="!panning() && zoom > 1"
      (pointerdown)="onPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="onPointerUp($event)"
      (pointercancel)="onPointerUp($event)"
      (wheel)="onWheel($event)"
      (click)="onHostClick($event)">
      @if (spread(); as s) {
        <div
          class="flex items-center justify-center gap-0.5 h-full max-h-full min-h-0 max-w-full"
          [class.w-full]="isSingle(s)"
          [style.--reader-zoom]="zoom">
          @for (page of orderedPages(s); track page) {
            <div
              class="relative flex items-center justify-center h-full min-h-0 min-w-0"
              [class.flex-1]="!isSingle(s)"
              [class.w-full]="isSingle(s)"
              [ngClass]="page === activePage ? 'ring-2 ring-indigo-500/50' : ''"
              (click)="onPageClick(page, $event)">
              @if (isLinked(page) && linkedList(page).length > 1) {
                <div class="flex items-center justify-center gap-0.5 h-full w-full">
                  @for (lu of linkedList(page); track $index) {
                    <img
                      [attr.data-page]="page"
                      [src]="lu"
                      [alt]="'Tradução ' + (page + 1)"
                      loading="eager"
                      draggable="false"
                      [class]="imageClasses()"
                      [style.height.%]="heightPercent()"
                      [style.width.%]="widthPercent()"
                      [style.filter]="cssFilter || null"
                      (dragstart)="$event.preventDefault()"
                      (load)="onImgLoad(page, $event)"
                      (error)="imageError.emit({ page, url: lu })" />
                  }
                </div>
              } @else if (isLinked(page) && linkedList(page).length === 1) {
                <div class="relative inline-block max-h-full max-w-full">
                  <img
                    [attr.data-page]="page"
                    [src]="linkedList(page)[0]"
                    [alt]="'Tradução ' + (page + 1)"
                    loading="eager"
                    draggable="false"
                    [class]="imageClasses()"
                    [style.height.%]="heightPercent()"
                    [style.width.%]="widthPercent()"
                    [style.filter]="cssFilter || null"
                    (dragstart)="$event.preventDefault()"
                    (load)="onImgLoad(page, $event)"
                    (error)="imageError.emit({ page, url: linkedList(page)[0] })" />
                  @for (tint of tintOverlays; track $index) {
                    <div class="absolute inset-0 pointer-events-none" [style.background]="tint"></div>
                  }
                  @if (showSubtitleOverlay && page === activePage && subtitleTexts.length) {
                    <app-manga-subtitle-overlay
                      [visible]="true"
                      [texts]="subtitleTexts"
                      [imageWidth]="pageNaturalWidth"
                      [imageHeight]="pageNaturalHeight"
                      [selectedSequence]="selectedSubtitleSeq"
                      (selectText)="selectText.emit($event)" />
                  }
                  @if (showOcrOverlay && page === activePage && ocrTexts.length) {
                    <app-manga-subtitle-overlay
                      [visible]="true"
                      [texts]="ocrTexts"
                      [imageWidth]="pageNaturalWidth"
                      [imageHeight]="pageNaturalHeight"
                      [selectedSequence]="null" />
                  }
                </div>
              } @else if (pages[page]) {
                <div class="relative inline-block max-h-full max-w-full">
                  <img
                    [attr.data-page]="page"
                    [src]="pages[page]"
                    [alt]="'Página ' + (page + 1)"
                    loading="eager"
                    draggable="false"
                    [class]="imageClasses()"
                    [style.height.%]="heightPercent()"
                    [style.width.%]="widthPercent()"
                    [style.filter]="cssFilter || null"
                    (dragstart)="$event.preventDefault()"
                    (load)="onImgLoad(page, $event)"
                    (error)="imageError.emit({ page, url: pages[page] })" />
                  @for (tint of tintOverlays; track $index) {
                    <div class="absolute inset-0 pointer-events-none" [style.background]="tint"></div>
                  }
                  @if (showSubtitleOverlay && page === activePage && subtitleTexts.length) {
                    <app-manga-subtitle-overlay
                      [visible]="true"
                      [texts]="subtitleTexts"
                      [imageWidth]="pageNaturalWidth"
                      [imageHeight]="pageNaturalHeight"
                      [selectedSequence]="selectedSubtitleSeq"
                      (selectText)="selectText.emit($event)" />
                  }
                  @if (showOcrOverlay && page === activePage && ocrTexts.length) {
                    <app-manga-subtitle-overlay
                      [visible]="true"
                      [texts]="ocrTexts"
                      [imageWidth]="pageNaturalWidth"
                      [imageHeight]="pageNaturalHeight"
                      [selectedSequence]="null" />
                  }
                </div>
              } @else {
                <div class="w-40 h-56 rounded-lg bg-slate-800/80 animate-pulse"></div>
              }
            </div>
          }
        </div>
      }
    </div>
  `
})
export class MangaDualSpreadViewportComponent implements OnChanges {
  @ViewChild('viewport') viewportRef?: ElementRef<HTMLElement>;

  @Input() pages: string[] = [];
  @Input() spreads: MangaSpread[] = [];
  @Input() spreadIndex = 0;
  @Input() rtl = false;
  @Input() fitMode: MangaFitMode = MangaFitMode.FitHeight;
  @Input() zoom = 1;
  /** Navigation axis for drag/wheel page turns. */
  @Input() axis: 'horizontal' | 'vertical' = 'horizontal';
  @Input() effect: PageTransitionType = PageTransitionType.Default;
  @Input() activePage = 0;
  @Input() linkedUrls: Record<number, string[]> = {};
  @Input() showingLinked: Record<number, boolean> = {};
  /** CSS filter string applied to page images (grayscale/invert/sepia). */
  @Input() cssFilter = '';
  /** RGBA tint overlays drawn above each page image. */
  @Input() tintOverlays: string[] = [];
  @Input() subtitleTexts: NormalizedSubtitleText[] = [];
  @Input() ocrTexts: NormalizedSubtitleText[] = [];
  @Input() showSubtitleOverlay = false;
  @Input() showOcrOverlay = false;
  @Input() selectedSubtitleSeq: number | null = null;
  @Input() pageNaturalWidth = 1;
  @Input() pageNaturalHeight = 1;

  @Output() spreadIndexChange = new EventEmitter<number>();
  @Output() pageActivate = new EventEmitter<number>();
  @Output() imageSized = new EventEmitter<{ page: number; width: number; height: number }>();
  @Output() imageError = new EventEmitter<{ page: number; url: string }>();
  @Output() viewportClick = new EventEmitter<MouseEvent>();
  @Output() viewportWheel = new EventEmitter<WheelEvent>();
  /** Shift+pointerdown — parent handles magnifier; dual must not pan. */
  @Output() shiftMagnify = new EventEmitter<PointerEvent>();
  @Output() selectText = new EventEmitter<NormalizedSubtitleText>();
  /** Interactive curl drag progress; null = cancelled/idle. */
  @Output() curlDrag = new EventEmitter<{
    factor: number;
    goingNext: boolean;
    commit: boolean | null;
  } | null>();

  panning = signal(false);

  private pointerId: number | null = null;
  private panStartX = 0;
  private panStartY = 0;
  private scrollStartX = 0;
  private scrollStartY = 0;
  private moved = false;
  private pagerDrag = false;
  private curlDragging = false;

  /** Exposed so the shell can resolve click/zoom geometry without #viewport. */
  get viewportEl(): HTMLElement | null {
    return this.viewportRef?.nativeElement ?? null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['zoom'] && this.zoom <= 1) {
      const el = this.viewportEl;
      if (el) {
        el.scrollLeft = 0;
        el.scrollTop = 0;
      }
    }
  }

  spread(): MangaSpread | null {
    return this.spreads[this.spreadIndex] ?? null;
  }

  orderedPages(s: MangaSpread): number[] {
    return visualOrder(s.left, s.right, this.rtl);
  }

  isSingle(s: MangaSpread): boolean {
    return s.right == null;
  }

  isLinked(page: number): boolean {
    return !!this.showingLinked[page] && (this.linkedUrls[page]?.length ?? 0) > 0;
  }

  linkedList(page: number): string[] {
    return this.linkedUrls[page] || [];
  }

  imageClasses(): string {
    const base = 'reader-zoom-img block object-contain [-webkit-user-drag:none] max-h-full';
    if (this.fitMode === MangaFitMode.FitHeight) {
      return `${base} w-auto h-full max-w-full`;
    }
    if (this.fitMode === MangaFitMode.Original) {
      return `${base} reader-zoom-original w-auto h-auto`;
    }
    return `${base} h-auto max-w-none`;
  }

  heightPercent(): number | null {
    if (this.fitMode !== MangaFitMode.FitHeight) return null;
    return 100 * this.zoom;
  }

  widthPercent(): number | null {
    if (this.fitMode !== MangaFitMode.FitWidth) return null;
    return 100 * this.zoom;
  }

  onPageClick(page: number, ev: MouseEvent): void {
    ev.stopPropagation();
    this.pageActivate.emit(page);
    // Still forward to host so chrome / 3x3 / double-click zoom work.
    this.onHostClick(ev);
  }

  onHostClick(ev: MouseEvent): void {
    if (this.moved) return;
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

  onPointerDown(ev: PointerEvent): void {
    if (ev.button !== 0) return;
    if (ev.shiftKey) {
      this.shiftMagnify.emit(ev);
      ev.preventDefault();
      return;
    }
    const el = this.viewportRef?.nativeElement;
    if (!el) return;
    this.pointerId = ev.pointerId;
    this.panStartX = ev.clientX;
    this.panStartY = ev.clientY;
    this.scrollStartX = el.scrollLeft;
    this.scrollStartY = el.scrollTop;
    this.moved = false;
    this.pagerDrag = this.zoom <= 1;
    try {
      el.setPointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
  }

  onPointerMove(ev: PointerEvent): void {
    if (this.pointerId !== ev.pointerId) return;
    const el = this.viewportRef?.nativeElement;
    if (!el) return;
    const dx = ev.clientX - this.panStartX;
    const dy = ev.clientY - this.panStartY;
    if (Math.abs(dx) + Math.abs(dy) > 4) this.moved = true;

    if (this.zoom > 1) {
      this.panning.set(true);
      el.scrollLeft = this.scrollStartX - dx;
      el.scrollTop = this.scrollStartY - dy;
      return;
    }

    // Interactive curl follows the finger
    if (
      this.pagerDrag &&
      this.moved &&
      (this.effect === PageTransitionType.CurlPage ||
        this.effect === PageTransitionType.Curl3DPage)
    ) {
      const w = el.clientWidth || 1;
      const goingNext = this.rtl ? dx > 0 : dx < 0;
      const progress = Math.min(1, Math.abs(dx) / Math.max(w * 0.45, 1));
      this.curlDragging = true;
      this.curlDrag.emit({ factor: -progress, goingNext, commit: null });
    }
  }

  onPointerUp(ev: PointerEvent): void {
    if (this.pointerId !== ev.pointerId) return;
    const el = this.viewportRef?.nativeElement;
    if (el && this.pointerId != null) {
      try {
        el.releasePointerCapture(this.pointerId);
      } catch {
        /* ignore */
      }
    }
    const dx = ev.clientX - this.panStartX;
    const dy = ev.clientY - this.panStartY;
    const wasPager = this.pagerDrag && this.moved && this.zoom <= 1;
    const wasCurl = this.curlDragging;
    this.pointerId = null;
    this.panning.set(false);
    this.pagerDrag = false;
    this.curlDragging = false;

    if (wasCurl && this.axis === 'horizontal') {
      const commit = Math.abs(dx) >= DRAG_THRESHOLD_PX;
      const goingNext = this.rtl ? dx > 0 : dx < 0;
      const w = el?.clientWidth || 1;
      const progress = Math.min(1, Math.abs(dx) / Math.max(w * 0.45, 1));
      this.curlDrag.emit({ factor: -progress, goingNext, commit });
      if (commit) {
        this.emitSpreadDelta(goingNext ? 1 : -1);
      }
      return;
    }

    if (wasPager) {
      if (this.axis === 'vertical') {
        if (Math.abs(dy) < DRAG_THRESHOLD_PX) return;
        // Drag up (dy < 0) → next
        this.emitSpreadDelta(dy < 0 ? 1 : -1);
      } else {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        const goingNext = this.rtl ? dx > 0 : dx < 0;
        this.emitSpreadDelta(goingNext ? 1 : -1);
      }
    }
  }

  onWheel(ev: WheelEvent): void {
    if (ev.ctrlKey) {
      this.viewportWheel.emit(ev);
      return;
    }
    if (this.zoom > 1) return;
    if (this.axis === 'vertical') {
      if (Math.abs(ev.deltaY) < 40) return;
      ev.preventDefault();
      this.emitSpreadDelta(ev.deltaY > 0 ? 1 : -1);
      return;
    }
    const delta = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;
    if (Math.abs(delta) < 40) return;
    ev.preventDefault();
    if (delta > 0) this.emitSpreadDelta(this.rtl ? -1 : 1);
    else this.emitSpreadDelta(this.rtl ? 1 : -1);
  }

  private emitSpreadDelta(delta: number): void {
    const next = this.spreadIndex + delta;
    if (next < 0 || next >= this.spreads.length) return;
    this.spreadIndexChange.emit(next);
  }
}
