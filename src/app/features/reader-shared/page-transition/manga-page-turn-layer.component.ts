import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MangaFitMode, PageTransitionType } from '../../../core/models';
import type { TurnAxis, TurnDir } from '../../../core/models/enums/page-transition.enums';
import { PAGE_TURN_DURATION_MS } from '../../../core/models/enums/page-transition.enums';
import { accelerateDecelerate } from './page-transition.math';
import { PageTurnDriver } from './page-transition.driver';
import {
  curlFoldingLeaf,
  drawCurl,
  positionToCurl,
  progressToCurlPosition,
  progressToTurnPosition
} from './page-curl.canvas';
import {
  pageImageClasses,
  pageWrapperClasses,
  pageWrapperStyle
} from '../../reader-image/manga-page-geometry';

export interface TurnLayerPage {
  urls: string[];
  /** Optional intrinsic size for layout hints on overlay <img>s. */
  naturalW?: number;
  naturalH?: number;
}

/** Slot scroll / content offset captured from the live reader viewport. */
export interface TurnSlotView {
  scrollLeft: number;
  scrollTop: number;
  /**
   * Content top-left relative to the visible slot.
   * null = use centered pageFitRect (no capture).
   */
  offsetX: number | null;
  offsetY: number | null;
}

const EMPTY_VIEW: TurnSlotView = {
  scrollLeft: 0,
  scrollTop: 0,
  offsetX: null,
  offsetY: null
};

@Component({
  selector: 'app-manga-page-turn-layer',
  standalone: true,
  imports: [CommonModule],
  host: {
    class: 'absolute inset-0 z-20 pointer-events-none overflow-hidden turn-layer-host'
  },
  styles: [`
    :host.turn-layer-host {
      background: var(--reader-surface, #0f172a);
    }
    .turn-underlay {
      position: absolute;
      inset: 0;
      z-index: 0;
      overflow: hidden;
      background: var(--reader-surface, #0f172a);
    }
    .turn-underlay:has(.turn-content-centered),
    .turn-page:has(.turn-content-centered) {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .turn-content {
      position: absolute;
      top: 0;
      left: 0;
    }
    .turn-content-centered {
      position: relative;
      top: auto;
      left: auto;
    }
    .turn-page {
      position: absolute;
      inset: 0;
      z-index: 1;
      overflow: hidden;
      display: block;
      background: transparent;
      will-change: transform, opacity;
    }
    .turn-page.has-fill {
      background: var(--reader-surface, #0f172a);
    }
    .turn-page img {
      -webkit-user-drag: none;
      user-drag: none;
    }
    .turn-canvas {
      position: absolute;
      inset: 0;
      z-index: 1;
      width: 100%;
      height: 100%;
    }
    .reader-zoom-original {
      zoom: var(--reader-zoom, 1);
      max-width: none;
    }
  `],
  template: `
    <!-- Opaque mask only — never paint destination bitmap (avoids Depth/Zoom ghost). -->
    <div class="turn-underlay" aria-hidden="true"></div>

    @if (isCurl()) {
      <canvas #outCanvas class="turn-canvas"></canvas>
    } @else {
      <div #outgoingEl class="turn-page has-fill">
        <div class="turn-content"
          [class.turn-content-centered]="outgoingView.offsetX == null"
          [style.left.px]="outgoingView.offsetX"
          [style.top.px]="outgoingView.offsetY"
          [style.--reader-zoom]="zoom">
          <div [class]="wrapperClass()"
            [style.width.%]="widthPercent()"
            [style.height.%]="heightPercent()">
            @for (u of outgoing.urls; track $index) {
              <img [src]="u" alt="" draggable="false" [class]="imgClass()"
                [attr.width]="outgoing.naturalW || null"
                [attr.height]="outgoing.naturalH || null"
                [style.aspect-ratio]="pageAspect(outgoing)"
                [style.filter]="cssFilter || null" />
            }
          </div>
        </div>
      </div>
      <div #incomingEl class="turn-page has-fill">
        <div class="turn-content"
          [class.turn-content-centered]="incomingView.offsetX == null"
          [style.left.px]="incomingView.offsetX"
          [style.top.px]="incomingView.offsetY"
          [style.--reader-zoom]="zoom">
          <div [class]="wrapperClass()"
            [style.width.%]="widthPercent()"
            [style.height.%]="heightPercent()">
            @for (u of incoming.urls; track $index) {
              <img [src]="u" alt="" draggable="false" [class]="imgClass()"
                [attr.width]="incoming.naturalW || null"
                [attr.height]="incoming.naturalH || null"
                [style.aspect-ratio]="pageAspect(incoming)"
                [style.filter]="cssFilter || null" />
            }
          </div>
        </div>
      </div>
    }
  `
})
export class MangaPageTurnLayerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('outgoingEl') outgoingRef?: ElementRef<HTMLElement>;
  @ViewChild('incomingEl') incomingRef?: ElementRef<HTMLElement>;
  @ViewChild('outCanvas') outCanvasRef?: ElementRef<HTMLCanvasElement>;

  @HostBinding('attr.data-effect') get effectAttr(): string {
    return this.effect;
  }

  @Input({ required: true }) outgoing!: TurnLayerPage;
  @Input({ required: true }) incoming!: TurnLayerPage;
  @Input() effect: PageTransitionType = PageTransitionType.Default;
  @Input() axis: TurnAxis = 'x';
  /** Logical turn direction: +1 = next page index, -1 = previous. */
  @Input() dir: TurnDir = 1;
  /**
   * When true (RTL horizontal), mirror the curl edge / CSS slide without
   * changing which leaf folds (logical dir).
   */
  @Input() mirror = false;
  @Input() fitMode: MangaFitMode = MangaFitMode.FitHeight;
  @Input() zoom = 1;
  @Input() cssFilter = '';
  /** View state of the page that is leaving (FROM slot). */
  @Input() outgoingView: TurnSlotView = EMPTY_VIEW;
  /** View state of the page that is entering (land start/end). */
  @Input() incomingView: TurnSlotView = EMPTY_VIEW;
  /**
   * Interactive progress 0..1 while dragging.
   * null = auto-play full animation on mount.
   */
  @Input() progress: number | null = null;
  /** When non-null, animate remaining progress then emit finished. */
  @Input() progressCommit: boolean | null = null;

  @Output() finished = new EventEmitter<void>();

  private abort?: AbortController;
  private bitmaps = new Map<string, ImageBitmap>();
  private started = false;
  private finishing = false;
  private emitted = false;
  private rafId = 0;
  private driver: PageTurnDriver | null = null;
  private bitmapsReady: Promise<void> | null = null;

  isCurl(): boolean {
    return (
      this.effect === PageTransitionType.CurlPage ||
      this.effect === PageTransitionType.Curl3DPage
    );
  }

  /** Visual dir for CSS transforms / curl edge mirroring. */
  private visualDir(): TurnDir {
    return (this.mirror ? -this.dir : this.dir) as TurnDir;
  }

  wrapperClass(): string {
    return pageWrapperClasses(this.zoom);
  }

  imgClass(): string {
    return pageImageClasses(this.fitMode, this.zoom);
  }

  pageAspect(page: TurnLayerPage): string | null {
    if (page.naturalW && page.naturalH && page.naturalW > 1 && page.naturalH > 1) {
      return `${page.naturalW} / ${page.naturalH}`;
    }
    return null;
  }

  heightPercent(): number | null {
    return pageWrapperStyle(this.fitMode, this.zoom).heightPercent;
  }

  widthPercent(): number | null {
    return pageWrapperStyle(this.fitMode, this.zoom).widthPercent;
  }

  ngAfterViewInit(): void {
    void this.begin();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['progress'] && this.isCurl() && this.progress != null && !this.finishing) {
      void this.paintCurlAtProgress(this.progress);
    }
    if (changes['progressCommit'] && this.progressCommit != null && this.isCurl() && !this.finishing) {
      void this.finishCurl(this.progressCommit);
    }
    if (
      changes['progress'] &&
      !this.isCurl() &&
      this.progress != null &&
      this.driver &&
      !this.finishing
    ) {
      this.driver.setPosition(progressToTurnPosition(this.progress, this.visualDir()));
    }
    if (
      changes['progressCommit'] &&
      this.progressCommit != null &&
      !this.isCurl() &&
      this.driver &&
      !this.finishing
    ) {
      void this.finishCssTurn(this.progressCommit);
    }
  }

  ngOnDestroy(): void {
    this.abort?.abort();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.driver?.release();
    this.driver = null;
    for (const bmp of this.bitmaps.values()) {
      try {
        bmp.close();
      } catch {
        /* ignore */
      }
    }
    this.bitmaps.clear();
    this.emitFinished();
  }

  private emitFinished(): void {
    if (this.emitted) return;
    this.emitted = true;
    this.finished.emit();
  }

  private async begin(): Promise<void> {
    if (this.started) return;
    this.started = true;

    if (this.isCurl()) {
      await this.ensureBitmaps();
      if (this.progress != null) {
        await this.paintCurlAtProgress(this.progress);
        this.markPaint();
        return;
      }
      await this.paintCurlAtProgress(0);
      this.markPaint();
      await this.playCurlAnimation();
      this.emitFinished();
      return;
    }

    // Wait a frame so ViewChild leaves exist
    await new Promise<void>(r => requestAnimationFrame(() => r()));

    const out = this.outgoingRef?.nativeElement;
    const inn = this.incomingRef?.nativeElement;
    if (!out || !inn) {
      this.emitFinished();
      return;
    }

    const size =
      this.axis === 'x'
        ? out.clientWidth || window.innerWidth
        : out.clientHeight || window.innerHeight;

    const vDir = this.visualDir();
    this.driver = new PageTurnDriver({
      outgoing: out,
      incoming: inn,
      effect: this.effect,
      axis: this.axis,
      dir: vDir,
      size,
      variant: 'manga'
    });

    if (this.progress != null) {
      this.driver.setPosition(progressToTurnPosition(this.progress, vDir));
      this.markPaint();
      return;
    }

    this.driver.setPosition(0);
    this.markPaint();
    this.abort = new AbortController();
    await this.driver.animateTo(-vDir, PAGE_TURN_DURATION_MS);
    this.emitFinished();
  }

  private markPaint(): void {
    try {
      performance.mark('manga-turn:paint');
    } catch {
      /* ignore */
    }
  }

  private async finishCssTurn(commit: boolean): Promise<void> {
    if (!this.driver) {
      this.emitFinished();
      return;
    }
    this.finishing = true;
    const vDir = this.visualDir();
    const target = commit ? -vDir : 0;
    await this.driver.animateTo(target, PAGE_TURN_DURATION_MS);
    this.emitFinished();
  }

  private async finishCurl(commit: boolean): Promise<void> {
    this.finishing = true;
    await this.ensureBitmaps();
    const start = this.progress ?? 0;
    const end = commit ? 1 : 0;
    await this.animateProgressRange(start, end, PAGE_TURN_DURATION_MS);
    this.emitFinished();
  }

  private async playCurlAnimation(): Promise<void> {
    await this.animateProgressRange(0, 1, PAGE_TURN_DURATION_MS);
  }

  private animateProgressRange(from: number, to: number, durationMs: number): Promise<void> {
    return new Promise(resolve => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / Math.max(1, durationMs));
        const eased = accelerateDecelerate(t);
        const progress = from + (to - from) * eased;
        void this.paintCurlAtProgress(progress).then(() => {
          if (t >= 1) {
            this.rafId = 0;
            resolve();
            return;
          }
          this.rafId = requestAnimationFrame(tick);
        });
      };
      this.rafId = requestAnimationFrame(tick);
    });
  }

  private async ensureBitmaps(): Promise<void> {
    if (!this.bitmapsReady) {
      const urls = [...new Set([...this.outgoing.urls, ...this.incoming.urls].filter(Boolean))];
      this.bitmapsReady = Promise.all(urls.map(u => this.getBitmap(u))).then(() => undefined);
    }
    await this.bitmapsReady;
  }

  private async paintCurlAtProgress(progress: number): Promise<void> {
    const canvas = this.outCanvasRef?.nativeElement;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const w = parent?.clientWidth || window.innerWidth;
    const h = parent?.clientHeight || window.innerHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    await this.ensureBitmaps();

    const outUrl = this.outgoing.urls[0];
    const inUrl = this.incoming.urls[0];
    if (!outUrl) return;

    const outBmp = await this.getBitmap(outUrl);
    if (!outBmp) return;
    const inBmp = inUrl ? await this.getBitmap(inUrl) : outBmp;

    // Leaf selection uses LOGICAL dir (next folds outgoing; prev folds incoming).
    const leaf = curlFoldingLeaf(this.dir);
    const foldBmp = leaf === 'outgoing' ? outBmp : inBmp ?? outBmp;
    const underBmp = leaf === 'outgoing' ? inBmp ?? outBmp : outBmp;
    const is3d = this.effect === PageTransitionType.Curl3DPage;
    // 3D verso = opposite page; 2D flap is surface only (no next-page paint).
    const backBmp = is3d ? underBmp : null;
    const curlPos = progressToCurlPosition(progress, this.dir);
    const visualDir = this.visualDir();

    const foldView = leaf === 'outgoing' ? this.outgoingView : this.incomingView;
    const underView = leaf === 'outgoing' ? this.incomingView : this.outgoingView;

    const foldScrollLeft =
      foldView.offsetX == null ? foldView.scrollLeft : 0;
    const foldScrollTop =
      foldView.offsetY == null ? foldView.scrollTop : 0;
    const useFoldAbs = foldView.offsetX != null && foldView.offsetY != null;
    const useUnderAbs = underView.offsetX != null && underView.offsetY != null;

    drawCurl(ctx, {
      front: foldBmp,
      back: backBmp,
      under: underBmp,
      curl: positionToCurl(curlPos),
      mode: is3d ? '3d' : '2d',
      surfaceColor: '#0f172a',
      dir: visualDir,
      fitMode: this.fitMode,
      zoom: this.zoom,
      scrollLeft: useFoldAbs ? undefined : foldScrollLeft,
      scrollTop: useFoldAbs ? undefined : foldScrollTop,
      underScrollLeft: useUnderAbs ? undefined : underView.scrollLeft,
      underScrollTop: useUnderAbs ? undefined : underView.scrollTop,
      frontOffset:
        useFoldAbs && foldView.offsetX != null && foldView.offsetY != null
          ? { x: foldView.offsetX, y: foldView.offsetY }
          : null,
      underOffset:
        useUnderAbs && underView.offsetX != null && underView.offsetY != null
          ? { x: underView.offsetX, y: underView.offsetY }
          : null
    });
  }

  private async getBitmap(url: string): Promise<ImageBitmap | null> {
    const cached = this.bitmaps.get(url);
    if (cached) return cached;
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      const bmp = await createImageBitmap(img);
      this.bitmaps.set(url, bmp);
      return bmp;
    } catch (e) {
      console.warn('[page-turn] createImageBitmap failed', url, e);
      return null;
    }
  }
}
