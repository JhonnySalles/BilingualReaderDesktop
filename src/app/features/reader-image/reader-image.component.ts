import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewChecked,
  inject,
  signal,
  computed,
  ElementRef,
  ViewChild,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ElectronService } from '../../core/services/electron.service';
import { NavigationStackService } from '../../core/services/navigation-stack.service';
import { SettingsService } from '../../core/services/settings.service';
import { Manga, MangaFitMode, MangaScrollingMode } from '../../core/models';

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP_WHEEL = 0.1;
const ZOOM_STEP_BUTTON = 0.25;
const WHEEL_PAGE_THRESHOLD = 200;
const PROGRAMMATIC_SCROLL_MS = 420;
const DRAG_THRESHOLD_PX = 5;

@Component({
  selector: 'app-reader-image',
  standalone: true,
  imports: [CommonModule, FormsModule],
  host: { class: 'block h-screen w-screen' },
  template: `
    <div class="h-screen w-screen relative bg-black text-slate-100 overflow-hidden select-none">
      <!-- Loading overlay -->
      @if (loading()) {
        <div class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 gap-4">
          <div class="w-12 h-12 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin"></div>
          <p class="text-sm font-semibold text-slate-200">Preparando páginas…</p>
          @if (extractTotal() > 0) {
            <p class="text-xs text-slate-400 tabular-nums">{{ extractCurrent() }} / {{ extractTotal() }}</p>
            <div class="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full bg-indigo-500 transition-all duration-200"
                [style.width.%]="extractPercent()"></div>
            </div>
          }
        </div>
      }

      @if (error()) {
        <div class="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950 gap-3 p-8 text-center">
          <p class="text-sm font-semibold text-red-300">{{ error() }}</p>
          <button type="button" (click)="goBack()"
            class="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer">
            Voltar
          </button>
        </div>
      }

      <!-- Page load warning -->
      @if (brokenPages() > 0 && !loading()) {
        <div class="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-200">
          {{ brokenPages() }} página(s) falharam ao carregar
        </div>
      }

      <!-- Page viewport -->
      <div
        #viewport
        class="outline-none"
        [class]="viewportClasses()"
        [class.cursor-grab]="!panning()"
        [class.cursor-grabbing]="panning()"
        (scroll)="onViewportScroll()"
        (click)="onViewportClick($event)"
        (wheel)="onViewportWheel($event)"
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp($event)"
        (pointercancel)="onPointerUp($event)">
        @if (isLongStrip()) {
            <div class="flex flex-col items-center w-full mx-auto"
            [class.gap-6]="scrollingMode() === MangaScrollingMode.LongStripGap"
            [class.max-w-5xl]="fitMode() !== MangaFitMode.Original"
            [style.zoom]="zoom()">
            @for (url of pages(); track $index; let i = $index) {
              @if (scrollingMode() === MangaScrollingMode.LongStripGap && i > 0) {
                <div class="text-[10px] uppercase tracking-wider text-slate-500 py-2">{{ i }} / {{ pageCount() }}</div>
              }
              <img
                [attr.data-page]="i"
                [src]="url"
                [alt]="'Página ' + (i + 1)"
                [loading]="eagerNear(i) ? 'eager' : 'lazy'"
                class="block object-contain"
                [class]="pageImageClasses()"
                (error)="onPageImageError(url, $event)" />
            }
          </div>
        } @else {
          @for (url of pages(); track $index; let i = $index) {
            <div
              class="reader-page snap-center shrink-0 flex items-center justify-center"
              [attr.data-page]="i"
              [class]="pagedSlotClasses()">
              <img
                [src]="url"
                [alt]="'Página ' + (i + 1)"
                [loading]="eagerNear(i) ? 'eager' : 'lazy'"
                class="block object-contain"
                [class]="pageImageClasses()"
                [style.zoom]="zoom()"
                (error)="onPageImageError(url, $event)" />
            </div>
          }
        }
      </div>

      <!-- Chrome: top -->
      <header
        class="absolute top-0 inset-x-0 z-30 transition-all duration-300"
        [class.opacity-0]="!chromeVisible()"
        [class.-translate-y-full]="!chromeVisible()"
        [class.pointer-events-none]="!chromeVisible()">
        <div class="h-14 px-4 sm:px-6 flex items-center justify-between gap-3 bg-slate-900/70 backdrop-blur-md border-b border-slate-800/50">
          <div class="flex items-center gap-2 min-w-0">
            <button type="button" (click)="goBack()"
              class="p-2 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
              title="Voltar">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <div class="min-w-0">
              <h1 class="text-sm font-bold truncate">{{ title() }}</h1>
              <p class="text-[10px] text-slate-400 tabular-nums">
                Página {{ currentPage() + 1 }} / {{ pageCount() || '—' }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button type="button" (click)="markPage()"
              class="p-2 rounded-lg transition-colors cursor-pointer"
              [class.text-amber-400]="marked()"
              [class.text-slate-300]="!marked()"
              title="Marcar página">
              <svg class="w-5 h-5" [attr.fill]="marked() ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
              </svg>
            </button>

            <button type="button" (click)="toggleFavorite()"
              class="p-2 rounded-lg transition-colors cursor-pointer"
              [class.text-rose-400]="favorite()"
              [class.text-slate-300]="!favorite()"
              title="Favorito">
              <svg class="w-5 h-5" [attr.fill]="favorite() ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
              </svg>
            </button>

            <select
              class="hidden sm:block bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 max-w-[14rem]"
              [ngModel]="scrollingMode()"
              (ngModelChange)="setScrollingMode($event)"
              title="Modo de rolagem">
              <option [ngValue]="MangaScrollingMode.Horizontal">Horizontal (Esquerda para direita)</option>
              <option [ngValue]="MangaScrollingMode.HorizontalRtl">Horizontal (Direita para esquerda)</option>
              <option [ngValue]="MangaScrollingMode.Vertical">Vertical</option>
              <option [ngValue]="MangaScrollingMode.LongStrip">Tira longa</option>
              <option [ngValue]="MangaScrollingMode.LongStripGap">Tira + gap</option>
            </select>

            <select
              class="hidden md:block bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-200"
              [ngModel]="fitMode()"
              (ngModelChange)="setFitMode($event)"
              title="Encaixe">
              <option [ngValue]="MangaFitMode.FitWidth">Largura</option>
              <option [ngValue]="MangaFitMode.FitHeight">Altura</option>
              <option [ngValue]="MangaFitMode.Original">Original</option>
            </select>

            <div class="hidden sm:flex items-center gap-0.5 bg-slate-950/80 border border-slate-700 rounded-lg px-1">
              <button type="button" (click)="zoomOut()"
                class="p-1.5 text-slate-300 hover:text-white rounded cursor-pointer" title="Diminuir zoom">
                <span class="text-sm font-bold leading-none">−</span>
              </button>
              <span class="text-[10px] tabular-nums text-slate-400 min-w-[2.5rem] text-center">{{ zoomPercent() }}%</span>
              <button type="button" (click)="zoomIn()"
                class="p-1.5 text-slate-300 hover:text-white rounded cursor-pointer" title="Aumentar zoom">
                <span class="text-sm font-bold leading-none">+</span>
              </button>
            </div>

            <button type="button" (click)="toggleFullscreen()"
              class="p-2 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Tela cheia">
              @if (isFullscreen()) {
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 9V4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>
                </svg>
              } @else {
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 8V4h4M20 8V4h-4M4 16v4h4m12-4v4h-4"/>
                </svg>
              }
            </button>
          </div>
        </div>
      </header>

      <!-- Progress seek -->
      <div
        class="absolute inset-x-0 bottom-20 z-30 px-14 sm:px-20 transition-all duration-300"
        [class.opacity-0]="!chromeVisible()"
        [class.translate-y-4]="!chromeVisible()"
        [class.pointer-events-none]="!chromeVisible()">
        <div class="mx-auto max-w-3xl bg-slate-900/70 backdrop-blur-md border border-slate-800/50 rounded-xl px-4 pt-2 pb-3">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] font-semibold text-slate-300 tabular-nums">
              {{ currentPage() + 1 }} / {{ pageCount() }}
            </span>
            <button type="button" (click)="showChapters.set(!showChapters())"
              class="text-[10px] font-semibold text-indigo-300 hover:text-indigo-200 cursor-pointer">
              Capítulos
            </button>
          </div>
          <div class="relative">
            <input
              type="range"
              min="0"
              [max]="Math.max(0, pageCount() - 1)"
              [ngModel]="currentPage()"
              [ngModelOptions]="{ updateOn: 'change' }"
              (ngModelChange)="seekTo($event)"
              class="w-full accent-indigo-500 cursor-pointer" />
            @for (ch of chapters(); track ch) {
              <span
                class="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 pointer-events-none"
                [style.left.%]="chapterDotPercent(ch)"></span>
            }
          </div>
        </div>
      </div>

      <!-- Bottom toolbar -->
      <footer
        class="absolute bottom-0 inset-x-0 z-30 transition-all duration-300"
        [class.opacity-0]="!chromeVisible()"
        [class.translate-y-full]="!chromeVisible()"
        [class.pointer-events-none]="!chromeVisible()">
        <div class="h-14 px-3 sm:px-6 flex items-center justify-center gap-1 sm:gap-2 bg-slate-900/70 backdrop-blur-md border-t border-slate-800/50">
          <button type="button" disabled title="Arquivo anterior (em breve)"
            class="p-2.5 rounded-xl text-slate-600 cursor-not-allowed opacity-50">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
            </svg>
          </button>

          <button type="button" (click)="goPrev()"
            class="p-2.5 rounded-xl text-slate-200 hover:bg-slate-800 cursor-pointer" title="Página anterior">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>

          <button type="button" (click)="showChapters.set(!showChapters())"
            class="p-2.5 rounded-xl text-slate-200 hover:bg-slate-800 cursor-pointer" title="Capítulos">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 6h16M4 10h16M4 14h10M4 18h10"/>
            </svg>
          </button>

          <button type="button" disabled title="Anotações (em breve)"
            class="p-2.5 rounded-xl text-slate-600 cursor-not-allowed opacity-50">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 8h10M7 12h6m-6 8l-4-4V6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H7z"/>
            </svg>
          </button>

          <button type="button" disabled title="OCR (em breve)"
            class="p-2.5 rounded-xl text-slate-600 cursor-not-allowed opacity-50">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </button>

          <button type="button" (click)="goNext()"
            class="p-2.5 rounded-xl text-slate-200 hover:bg-slate-800 cursor-pointer" title="Próxima página">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>

          <button type="button" disabled title="Próximo arquivo (em breve)"
            class="p-2.5 rounded-xl text-slate-600 cursor-not-allowed opacity-50">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </footer>

      <!-- Chapters panel -->
      @if (showChapters() && chromeVisible()) {
        <div class="absolute bottom-16 left-1/2 -translate-x-1/2 z-40 w-[min(90vw,28rem)] max-h-64 overflow-y-auto
          bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-3">
          <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Capítulos</p>
          @if (chapters().length === 0) {
            <p class="text-xs text-slate-500 py-4 text-center">Nenhum capítulo detectado neste arquivo</p>
          } @else {
            <div class="grid grid-cols-4 gap-2">
              @for (ch of chapters(); track ch; let i = $index) {
                <button type="button"
                  (click)="seekTo(ch); showChapters.set(false)"
                  class="px-2 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-indigo-600 text-slate-200 cursor-pointer">
                  {{ i + 1 }} · p.{{ ch + 1 }}
                </button>
              }
            </div>
          }
        </div>
      }
    </div>
  `
})
export class ReaderImageComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('viewport') viewportRef?: ElementRef<HTMLElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private electron = inject(ElectronService);
  private nav = inject(NavigationStackService);
  private settings = inject(SettingsService);

  MangaScrollingMode = MangaScrollingMode;
  MangaFitMode = MangaFitMode;
  Math = Math;

  mangaId = Number(this.route.snapshot.paramMap.get('id'));
  title = signal('Leitor de Mangá');
  pages = signal<string[]>([]);
  pageCount = signal(0);
  currentPage = signal(0);
  chapters = signal<number[]>([]);
  favorite = signal(false);
  marked = signal(false);
  loading = signal(true);
  error = signal<string | null>(null);
  extractCurrent = signal(0);
  extractTotal = signal(0);
  chromeVisible = signal(false);
  isFullscreen = signal(false);
  showChapters = signal(false);
  brokenPages = signal(0);
  zoom = signal(1);
  panning = signal(false);

  scrollingMode = signal<MangaScrollingMode>(this.settings.mangaScrollingMode());
  fitMode = signal<MangaFitMode>(this.settings.mangaFitMode());

  private sessionId: string | null = null;
  private historySessionId: number | null = null;
  private updateTimer: ReturnType<typeof setTimeout> | null = null;
  private ended = false;
  private unsubProgress: (() => void) | null = null;
  private pendingJump: number | null = null;
  private scrollSyncLock = false;
  private scrollLockTimer: ReturnType<typeof setTimeout> | null = null;
  private mangaMeta: Manga | null = null;
  private wheelAccum = 0;
  private didDrag = false;
  private panPointerId: number | null = null;
  private panLastX = 0;
  private panLastY = 0;
  private panTarget: HTMLElement | null = null;

  readonly extractPercent = computed(() => {
    const t = this.extractTotal();
    if (t <= 0) return 0;
    return Math.round((this.extractCurrent() / t) * 100);
  });

  readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));

  readonly isLongStrip = computed(() => {
    const m = this.scrollingMode();
    return m === MangaScrollingMode.LongStrip || m === MangaScrollingMode.LongStripGap;
  });

  readonly isRtl = computed(() => this.scrollingMode() === MangaScrollingMode.HorizontalRtl);

  readonly isHorizontal = computed(() => {
    const m = this.scrollingMode();
    return m === MangaScrollingMode.Horizontal || m === MangaScrollingMode.HorizontalRtl;
  });

  ngOnInit(): void {
    this.unsubProgress = this.electron.onExtractProgress(p => {
      this.extractCurrent.set(p.current);
      this.extractTotal.set(p.total);
    });
    document.addEventListener('fullscreenchange', this.onFsChange);
    void this.openReader();
  }

  ngAfterViewChecked(): void {
    if (this.pendingJump != null && this.viewportRef?.nativeElement && !this.loading()) {
      const page = this.pendingJump;
      this.pendingJump = null;
      this.scrollToPage(page, false);
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('fullscreenchange', this.onFsChange);
    if (this.scrollLockTimer) clearTimeout(this.scrollLockTimer);
    this.unsubProgress?.();
    void this.cleanup();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (this.loading()) return;
    const key = ev.key;
    const horizontal = this.isHorizontal();

    if (key === 'ArrowLeft') {
      if (!horizontal) return;
      ev.preventDefault();
      this.isRtl() ? this.goNext() : this.goPrev();
    } else if (key === 'ArrowRight') {
      if (!horizontal) return;
      ev.preventDefault();
      this.isRtl() ? this.goPrev() : this.goNext();
    } else if (key === 'ArrowUp') {
      if (horizontal) return;
      ev.preventDefault();
      this.goPrev();
    } else if (key === 'ArrowDown') {
      if (horizontal) return;
      ev.preventDefault();
      this.goNext();
    } else if (key === 'PageUp') {
      ev.preventDefault();
      if (horizontal) {
        this.isRtl() ? this.goNext() : this.goPrev();
      } else {
        this.goPrev();
      }
    } else if (key === 'PageDown' || key === ' ') {
      ev.preventDefault();
      if (horizontal) {
        this.isRtl() ? this.goPrev() : this.goNext();
      } else {
        this.goNext();
      }
    } else if (key === 'Home') {
      ev.preventDefault();
      this.seekTo(0);
    } else if (key === 'End') {
      ev.preventDefault();
      this.seekTo(this.pageCount() - 1);
    } else if (key === 'f' || key === 'F') {
      this.toggleFullscreen();
    } else if (key === '+' || key === '=') {
      ev.preventDefault();
      this.zoomIn();
    } else if (key === '-' || key === '_') {
      ev.preventDefault();
      this.zoomOut();
    }
  }

  viewportClasses(): string {
    const grab = ' touch-none';
    if (this.isHorizontal()) {
      return this.isRtl()
        ? 'absolute inset-0 overflow-x-auto overflow-y-hidden flex flex-row-reverse snap-x snap-mandatory scroll-smooth' + grab
        : 'absolute inset-0 overflow-x-auto overflow-y-hidden flex snap-x snap-mandatory scroll-smooth' + grab;
    }
    if (this.scrollingMode() === MangaScrollingMode.Vertical) {
      return 'absolute inset-0 overflow-y-auto overflow-x-hidden flex flex-col snap-y snap-mandatory scroll-smooth' + grab;
    }
    return 'absolute inset-0 overflow-y-auto overflow-x-hidden scroll-smooth' + grab;
  }

  pagedSlotClasses(): string {
    if (this.isHorizontal()) {
      return 'w-full h-full min-w-full overflow-y-auto overflow-x-hidden';
    }
    return 'w-full min-h-full h-full overflow-y-auto overflow-x-hidden';
  }

  pageImageClasses(): string {
    const fit = this.fitMode();
    if (fit === MangaFitMode.FitHeight) {
      return 'h-full w-auto max-w-full';
    }
    if (fit === MangaFitMode.Original) {
      return 'w-auto h-auto';
    }
    return 'w-full h-auto';
  }

  eagerNear(index: number): boolean {
    const cur = this.currentPage();
    return Math.abs(index - cur) <= 2;
  }

  onPageImageError(url: string, _event: Event): void {
    console.warn('[reader-image] page load failed', url);
    this.brokenPages.update(n => n + 1);
  }

  chapterDotPercent(page: number): number {
    const max = Math.max(1, this.pageCount() - 1);
    return (page / max) * 100;
  }

  setScrollingMode(mode: MangaScrollingMode): void {
    this.scrollingMode.set(mode);
    this.settings.mangaScrollingMode.set(mode);
    this.pendingJump = this.currentPage();
    this.wheelAccum = 0;
  }

  setFitMode(mode: MangaFitMode): void {
    this.fitMode.set(mode);
    this.settings.mangaFitMode.set(mode);
  }

  zoomIn(): void {
    this.setZoom(this.zoom() + ZOOM_STEP_BUTTON);
  }

  zoomOut(): void {
    this.setZoom(this.zoom() - ZOOM_STEP_BUTTON);
  }

  onViewportClick(ev: MouseEvent): void {
    if (this.didDrag) {
      this.didDrag = false;
      return;
    }
    const el = this.viewportRef?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (ev.clientX - rect.left) / rect.width;
    if (x < 0.28) {
      this.isRtl() ? this.goNext() : this.goPrev();
    } else if (x > 0.72) {
      this.isRtl() ? this.goPrev() : this.goNext();
    } else {
      this.chromeVisible.update(v => !v);
    }
  }

  onViewportWheel(ev: WheelEvent): void {
    if (this.loading()) return;

    if (ev.ctrlKey) {
      ev.preventDefault();
      const dir = ev.deltaY > 0 ? -1 : 1;
      this.setZoom(this.zoom() + dir * ZOOM_STEP_WHEEL);
      return;
    }

    if (!this.isHorizontal()) {
      return; // native scroll for vertical / long strip
    }

    ev.preventDefault();
    const slot = this.currentPageSlot();
    if (slot && this.canScrollSlot(slot, ev.deltaY)) {
      slot.scrollTop += ev.deltaY;
      this.wheelAccum = 0;
      return;
    }

    this.wheelAccum += ev.deltaY;
    if (Math.abs(this.wheelAccum) < WHEEL_PAGE_THRESHOLD) return;

    const forward = this.wheelAccum > 0;
    this.wheelAccum = 0;
    if (this.isRtl()) {
      forward ? this.seekTo(this.currentPage() - 1) : this.seekTo(this.currentPage() + 1);
    } else {
      forward ? this.seekTo(this.currentPage() + 1) : this.seekTo(this.currentPage() - 1);
    }
  }

  onPointerDown(ev: PointerEvent): void {
    if (ev.button !== 0 || this.loading()) return;
    const el = this.viewportRef?.nativeElement;
    if (!el) return;

    this.didDrag = false;
    this.panning.set(true);
    this.panPointerId = ev.pointerId;
    this.panLastX = ev.clientX;
    this.panLastY = ev.clientY;
    this.panTarget = this.currentPageSlot() || el;
    try {
      el.setPointerCapture(ev.pointerId);
    } catch { /* ignore */ }
  }

  onPointerMove(ev: PointerEvent): void {
    if (this.panPointerId !== ev.pointerId || !this.panning()) return;
    const dx = ev.clientX - this.panLastX;
    const dy = ev.clientY - this.panLastY;
    this.panLastX = ev.clientX;
    this.panLastY = ev.clientY;

    if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD_PX) {
      this.didDrag = true;
    }

    const slot = this.panTarget;
    const viewport = this.viewportRef?.nativeElement;
    if (!viewport) return;

    if (this.isHorizontal()) {
      if (slot) {
        slot.scrollTop -= dy;
        if (this.zoom() !== 1) {
          slot.scrollLeft -= dx;
        }
      }
      // Horizontal page scrub / pan when slot has no horizontal overflow
      if (this.zoom() === 1 || !slot || slot.scrollWidth <= slot.clientWidth + 1) {
        viewport.scrollLeft -= dx;
      }
    } else {
      viewport.scrollLeft -= dx;
      viewport.scrollTop -= dy;
    }
  }

  onPointerUp(ev: PointerEvent): void {
    if (this.panPointerId !== ev.pointerId) return;
    const el = this.viewportRef?.nativeElement;
    if (el && this.panPointerId != null) {
      try {
        el.releasePointerCapture(this.panPointerId);
      } catch { /* ignore */ }
    }
    this.panPointerId = null;
    this.panTarget = null;
    this.panning.set(false);
  }

  onViewportScroll(): void {
    if (this.scrollSyncLock || this.loading()) return;
    this.syncCurrentPageFromDom();
  }

  /** Navigate previous with internal page scroll first. */
  goPrev(): void {
    if (this.tryScrollCurrentPage(-1)) return;
    this.seekTo(this.currentPage() - 1);
  }

  /** Navigate next with internal page scroll first. */
  goNext(): void {
    if (this.tryScrollCurrentPage(1)) return;
    this.seekTo(this.currentPage() + 1);
  }

  seekTo(page: number): void {
    const max = Math.max(0, this.pageCount() - 1);
    const next = Math.min(Math.max(0, Number(page) || 0), max);
    // Do not set currentPage here — bar updates only after programmatic scroll ends / user scroll
    this.scrollToPage(next, true);
  }

  async markPage(): Promise<void> {
    if (!this.mangaId) return;
    const page = this.currentPage();
    const updated = await this.electron.setMangaBookmark(this.mangaId, page);
    if (updated) {
      this.mangaMeta = updated;
      this.marked.set(true);
      setTimeout(() => this.marked.set(false), 1200);
    }
  }

  async toggleFavorite(): Promise<void> {
    if (!this.mangaId) return;
    const updated = await this.electron.toggleMangaFavorite(this.mangaId);
    if (updated) {
      this.mangaMeta = updated;
      this.favorite.set(!!updated.favorite);
    }
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
      this.chromeVisible.set(false);
    } else {
      void document.exitFullscreen();
    }
  }

  async goBack(): Promise<void> {
    await this.cleanup();
    this.nav.goBack(this.router);
  }

  private setZoom(value: number): void {
    const next = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)) * 100) / 100;
    this.zoom.set(next);
  }

  private onFsChange = (): void => {
    this.isFullscreen.set(!!document.fullscreenElement);
  };

  private async openReader(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      if (!this.mangaId || Number.isNaN(this.mangaId)) {
        throw new Error('ID de mangá inválido');
      }

      const manga = await this.electron.getManga(this.mangaId);
      this.mangaMeta = manga;
      if (manga) {
        this.title.set(manga.title || manga.name || 'Mangá');
        this.favorite.set(!!manga.favorite);
      }

      const opened = await this.electron.openMangaReader(this.mangaId);
      if (!opened) {
        throw new Error('Falha ao abrir o leitor (Electron indisponível)');
      }

      this.sessionId = opened.sessionId;
      this.title.set(opened.title);
      this.pages.set(opened.pages);
      this.pageCount.set(opened.pageCount);
      this.chapters.set(opened.chapters || []);
      this.favorite.set(opened.favorite);
      this.currentPage.set(opened.bookMark);
      this.pendingJump = opened.bookMark;
      this.brokenPages.set(0);
      this.zoom.set(1);

      this.historySessionId = await this.electron.startHistorySession({
        fkLibrary: manga?.fkLibrary ?? 0,
        fkReference: this.mangaId,
        type: 'MANGA',
        pageStart: opened.bookMark,
        pages: opened.pageCount,
        volume: manga?.volume || ''
      });

      setTimeout(() => this.chromeVisible.set(false), 400);
    } catch (e: any) {
      console.error(e);
      this.error.set(e?.message || 'Erro ao abrir o mangá');
    } finally {
      this.loading.set(false);
    }
  }

  private beginProgrammaticScroll(smooth: boolean): void {
    this.scrollSyncLock = true;
    if (this.scrollLockTimer) clearTimeout(this.scrollLockTimer);
    this.scrollLockTimer = setTimeout(() => {
      this.endProgrammaticScroll();
    }, smooth ? PROGRAMMATIC_SCROLL_MS : 50);
  }

  private endProgrammaticScroll(): void {
    this.scrollSyncLock = false;
    this.scrollLockTimer = null;
    this.syncCurrentPageFromDom();
  }

  private syncCurrentPageFromDom(): void {
    const el = this.viewportRef?.nativeElement;
    if (!el) return;

    let index = this.currentPage();
    if (this.isHorizontal()) {
      if (this.isRtl()) {
        index = this.nearestPageFromDom(el);
      } else {
        const pageW = el.clientWidth || 1;
        index = Math.round(el.scrollLeft / pageW);
      }
    } else if (this.scrollingMode() === MangaScrollingMode.Vertical) {
      const pageH = el.clientHeight || 1;
      index = Math.round(el.scrollTop / pageH);
    } else {
      index = this.nearestPageFromDom(el);
    }

    index = Math.min(Math.max(0, index), Math.max(0, this.pageCount() - 1));
    if (index !== this.currentPage()) {
      this.currentPage.set(index);
      this.scheduleProgressUpdate();
    }
  }

  private scrollToPage(page: number, smooth: boolean): void {
    const el = this.viewportRef?.nativeElement;
    if (!el) {
      this.pendingJump = page;
      return;
    }

    this.beginProgrammaticScroll(smooth);
    const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto';

    if (this.isHorizontal() && !this.isRtl()) {
      const pageW = el.clientWidth;
      el.scrollTo({ left: page * pageW, behavior });
    } else if (this.scrollingMode() === MangaScrollingMode.Vertical) {
      const pageH = el.clientHeight;
      el.scrollTo({ top: page * pageH, behavior });
    } else {
      const target = el.querySelector(`[data-page="${page}"]`) as HTMLElement | null;
      target?.scrollIntoView({ behavior, block: 'nearest', inline: 'center' });
    }

    // Reset vertical scroll of target slot after page change settles
    setTimeout(() => {
      const slot = el.querySelector(`[data-page="${page}"]`) as HTMLElement | null;
      if (slot) slot.scrollTop = 0;
    }, smooth ? PROGRAMMATIC_SCROLL_MS : 0);
  }

  private currentPageSlot(): HTMLElement | null {
    const el = this.viewportRef?.nativeElement;
    if (!el) return null;
    return el.querySelector(`[data-page="${this.currentPage()}"]`) as HTMLElement | null;
  }

  /** @returns true if scrolled within the current page slot */
  private tryScrollCurrentPage(dir: 1 | -1): boolean {
    if (!this.isHorizontal() && this.scrollingMode() !== MangaScrollingMode.Vertical) {
      return false;
    }
    const slot = this.currentPageSlot();
    if (!slot) return false;

    const maxScroll = slot.scrollHeight - slot.clientHeight;
    if (maxScroll <= 2) return false;

    if (dir > 0 && slot.scrollTop + slot.clientHeight < slot.scrollHeight - 2) {
      slot.scrollBy({ top: slot.clientHeight * 0.9, behavior: 'smooth' });
      return true;
    }
    if (dir < 0 && slot.scrollTop > 2) {
      slot.scrollBy({ top: -slot.clientHeight * 0.9, behavior: 'smooth' });
      return true;
    }
    return false;
  }

  private canScrollSlot(slot: HTMLElement, deltaY: number): boolean {
    const maxScroll = slot.scrollHeight - slot.clientHeight;
    if (maxScroll <= 2) return false;
    if (deltaY > 0 && slot.scrollTop < maxScroll - 1) return true;
    if (deltaY < 0 && slot.scrollTop > 1) return true;
    return false;
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

  private scheduleProgressUpdate(): void {
    if (this.historySessionId == null) return;
    if (this.updateTimer) clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => {
      if (this.historySessionId == null) return;
      void this.electron.updateHistorySession({
        id: this.historySessionId,
        pageEnd: this.currentPage(),
        pages: this.pageCount()
      });
      void this.electron.setMangaBookmark(this.mangaId, this.currentPage());
    }, 1500);
  }

  private async cleanup(): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    if (this.updateTimer) clearTimeout(this.updateTimer);

    if (this.historySessionId != null) {
      await this.electron.endHistorySession({
        id: this.historySessionId,
        pageEnd: this.currentPage(),
        pages: this.pageCount(),
        type: 'MANGA',
        fkReference: this.mangaId
      });
      this.historySessionId = null;
    }

    if (this.sessionId) {
      await this.electron.closeMangaReader(this.sessionId);
      this.sessionId = null;
    }

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch { /* ignore */ }
    }
  }
}
