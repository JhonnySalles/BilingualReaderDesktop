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
    <div class="turn-underlay" aria-hidden="true">
      <div class="turn-content"
        [class.turn-content-centered]="underlayView().offsetX == null"
        [style.left.px]="underlayView().offsetX"
        [style.top.px]="underlayView().offsetY"
        [style.--reader-zoom]="zoom">
        <div [class]="wrapperClass()"
          [style.width.%]="widthPercent()"
          [style.height.%]="heightPercent()">
          @for (u of underlayPage().urls; track $index) {
            <img [src]="u" alt="" draggable="false" [class]="imgClass()"
              [style.filter]="cssFilter || null" />
          }
        </div>
      </div>
    </div>

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
  @Input() dir: TurnDir = 1;
  @Input() fitMode: MangaFitMode = MangaFitMode.FitHeight;
  @Input() zoom = 1;
  @Input() cssFilter = '';
  /** View state of the page that is leaving (FROM slot). */
  @Input() outgoingView: TurnSlotView = EMPTY_VIEW;
  /** View state of the page that is entering (usually land start → zeros). */
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

  /** Static page under the animated leaves — destination on next, current on prev. */
  underlayPage(): TurnLayerPage {
    return this.dir > 0 ? this.incoming : this.outgoing;
  }

  underlayView(): TurnSlotView {
    return this.dir > 0 ? this.incomingView : this.outgoingView;
  }

  wrapperClass(): string {
    return pageWrapperClasses(this.zoom);
  }

  imgClass(): string {
    return pageImageClasses(this.fitMode, this.zoom);
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
      this.driver.setPosition(progressToTurnPosition(this.progress, this.dir));
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
        return;
      }
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

    this.driver = new PageTurnDriver({
      outgoing: out,
      incoming: inn,
      effect: this.effect,
      axis: this.axis,
      dir: this.dir,
      size,
      variant: 'manga'
    });

    if (this.progress != null) {
      this.driver.setPosition(progressToTurnPosition(this.progress, this.dir));
      return;
    }

    this.abort = new AbortController();
    await this.driver.animateTo(-this.dir, PAGE_TURN_DURATION_MS);
    this.emitFinished();
  }

  private async finishCssTurn(commit: boolean): Promise<void> {
    if (!this.driver) {
      this.emitFinished();
      return;
    }
    this.finishing = true;
    const target = commit ? -this.dir : 0;
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

    const leaf = curlFoldingLeaf(this.dir);
    const foldBmp = leaf === 'outgoing' ? outBmp : inBmp ?? outBmp;
    const underBmp = leaf === 'outgoing' ? inBmp ?? outBmp : outBmp;
    // Verso = opposite page (not a mirror of the folding leaf)
    const backBmp = underBmp;
    const curlPos = progressToCurlPosition(progress, this.dir);

    const foldView = leaf === 'outgoing' ? this.outgoingView : this.incomingView;
    const underView = leaf === 'outgoing' ? this.incomingView : this.outgoingView;

    // Convert captured viewport offsets into scroll deltas relative to centered fit
    const foldScrollLeft =
      foldView.offsetX == null ? foldView.scrollLeft : 0;
    const foldScrollTop =
      foldView.offsetY == null ? foldView.scrollTop : 0;
    // When we have absolute offsets, pass them via scrolled helper by
    // computing delta from a synthetic center — drawCurl uses scroll as subtract.
    // Prefer absolute: encode as scrollLeft/Top from centered rect after size known inside drawCurl.
    // Here we pass scrollLeft/Top from the slot when offsets are null; when offsets
    // are set we pass negative offsets as the draw position via scroll fields paired
    // with zero-centered path — see drawCurl scrollLeft = -offset means draw at offset
    // only if base.x is 0. So pass explicit scroll from slot:
    const useFoldAbs = foldView.offsetX != null && foldView.offsetY != null;
    const useUnderAbs = underView.offsetX != null && underView.offsetY != null;

    drawCurl(ctx, {
      front: foldBmp,
      back: backBmp,
      under: underBmp,
      curl: positionToCurl(curlPos),
      mode: this.effect === PageTransitionType.Curl3DPage ? '3d' : '2d',
      surfaceColor: '#0f172a',
      dir: this.dir,
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
