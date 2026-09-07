import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
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
import { drawCurl, positionToCurl } from './page-curl.canvas';
import { playPageTurn } from './page-transition.player';

export interface TurnLayerPage {
  urls: string[];
}

@Component({
  selector: 'app-manga-page-turn-layer',
  standalone: true,
  imports: [CommonModule],
  host: { class: 'absolute inset-0 z-20 pointer-events-none overflow-hidden' },
  styles: [`
    .turn-page {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f172a;
      will-change: transform, opacity;
    }
    .turn-page img {
      -webkit-user-drag: none;
      user-drag: none;
      object-fit: contain;
      max-height: 100%;
      max-width: 100%;
    }
    .turn-canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
  `],
  template: `
    <div #outgoingEl class="turn-page" [style.zIndex]="2">
      @if (isCurl()) {
        <canvas #outCanvas class="turn-canvas"></canvas>
      } @else {
        <div class="flex items-center justify-center gap-0.5 h-full w-full" [style.--reader-zoom]="zoom">
          @for (u of outgoing.urls; track $index) {
            <img [src]="u" alt="" draggable="false" [class]="imgClass()"
              [style.filter]="cssFilter || null"
              [style.height.%]="heightPercent()"
              [style.width.%]="widthPercent()" />
          }
        </div>
      }
    </div>
    <div #incomingEl class="turn-page" [style.zIndex]="1">
      <div class="flex items-center justify-center gap-0.5 h-full w-full" [style.--reader-zoom]="zoom">
        @for (u of incoming.urls; track $index) {
          <img [src]="u" alt="" draggable="false" [class]="imgClass()"
            [style.filter]="cssFilter || null"
            [style.height.%]="heightPercent()"
            [style.width.%]="widthPercent()" />
        }
      </div>
    </div>
  `
})
export class MangaPageTurnLayerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('outgoingEl') outgoingRef?: ElementRef<HTMLElement>;
  @ViewChild('incomingEl') incomingRef?: ElementRef<HTMLElement>;
  @ViewChild('outCanvas') outCanvasRef?: ElementRef<HTMLCanvasElement>;

  @Input({ required: true }) outgoing!: TurnLayerPage;
  @Input({ required: true }) incoming!: TurnLayerPage;
  @Input() effect: PageTransitionType = PageTransitionType.Default;
  @Input() axis: TurnAxis = 'x';
  @Input() dir: TurnDir = 1;
  @Input() fitMode: MangaFitMode = MangaFitMode.FitHeight;
  @Input() zoom = 1;
  @Input() cssFilter = '';
  /**
   * Interactive curl while dragging (-1..0).
   * null = auto-play full animation on mount.
   * When set, parent drives painting; set curlCommit to finish.
   */
  @Input() curlFactor: number | null = null;
  /** When non-null with curl, animate remaining curl then emit finished. */
  @Input() curlCommit: boolean | null = null;

  @Output() finished = new EventEmitter<void>();

  private abort?: AbortController;
  private bitmaps = new Map<string, ImageBitmap>();
  private started = false;
  private finishing = false;

  isCurl(): boolean {
    return (
      this.effect === PageTransitionType.CurlPage ||
      this.effect === PageTransitionType.Curl3DPage
    );
  }

  imgClass(): string {
    const base = 'block object-contain';
    if (this.fitMode === MangaFitMode.FitHeight) return `${base} w-auto h-full`;
    if (this.fitMode === MangaFitMode.Original) return `${base} reader-zoom-original w-auto h-auto`;
    return `${base} h-auto w-full`;
  }

  heightPercent(): number | null {
    return this.fitMode === MangaFitMode.FitHeight ? 100 * this.zoom : null;
  }

  widthPercent(): number | null {
    return this.fitMode === MangaFitMode.FitWidth ? 100 * this.zoom : null;
  }

  ngAfterViewInit(): void {
    void this.begin();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['curlFactor'] && this.isCurl() && this.curlFactor != null && !this.finishing) {
      void this.paintCurl(this.curlFactor);
    }
    if (changes['curlCommit'] && this.curlCommit != null && this.isCurl() && !this.finishing) {
      void this.finishCurl(this.curlCommit);
    }
  }

  ngOnDestroy(): void {
    this.abort?.abort();
    for (const bmp of this.bitmaps.values()) {
      try {
        bmp.close();
      } catch {
        /* ignore */
      }
    }
    this.bitmaps.clear();
  }

  private async begin(): Promise<void> {
    if (this.started) return;
    this.started = true;

    const out = this.outgoingRef?.nativeElement;
    const inn = this.incomingRef?.nativeElement;
    if (!out || !inn) {
      this.finished.emit();
      return;
    }

    const size =
      this.axis === 'x'
        ? out.clientWidth || window.innerWidth
        : out.clientHeight || window.innerHeight;

    if (this.isCurl() && this.curlFactor != null) {
      await this.paintCurl(this.curlFactor);
      return;
    }

    if (this.isCurl()) {
      await this.playCurlAnimation();
      this.finished.emit();
      return;
    }

    this.abort = new AbortController();
    await playPageTurn({
      outgoing: out,
      incoming: inn,
      effect: this.effect,
      axis: this.axis,
      dir: this.dir,
      size,
      durationMs: PAGE_TURN_DURATION_MS,
      signal: this.abort.signal
    });
    this.finished.emit();
  }

  private async finishCurl(commit: boolean): Promise<void> {
    this.finishing = true;
    const start = this.curlFactor ?? 0;
    const end = commit ? -1 : 0;
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      await this.paintCurl(start + (end - start) * eased);
      await new Promise(r => setTimeout(r, PAGE_TURN_DURATION_MS / steps));
    }
    this.finished.emit();
  }

  private async playCurlAnimation(): Promise<void> {
    const steps = 16;
    const stepMs = PAGE_TURN_DURATION_MS / steps;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      await this.paintCurl(-eased);
      await new Promise(r => setTimeout(r, stepMs));
    }
  }

  private async paintCurl(curl: number): Promise<void> {
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

    const url = this.outgoing.urls[0];
    if (!url) return;
    const bmp = await this.getBitmap(url);
    if (!bmp) return;

    drawCurl(ctx, {
      front: bmp,
      back: bmp,
      curl: positionToCurl(curl <= 0 ? curl : -Math.abs(curl)),
      mode: this.effect === PageTransitionType.Curl3DPage ? '3d' : '2d',
      surfaceColor: '#0f172a'
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
