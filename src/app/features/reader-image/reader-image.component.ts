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
import {
  TOUCH_DOUBLE_CLICK_MS,
  TouchZoneService
} from '../../core/services/touch-zone.service';
import { Manga, MangaAnnotation, MangaFitMode, MangaScrollingMode } from '../../core/models';
import { ReaderTouchOverlayComponent } from '../reader-shared/reader-touch-overlay.component';
import { ReaderTouchConfigComponent } from '../reader-shared/reader-touch-config.component';
import { handleReaderTouchTap, TouchActionHandlers } from '../reader-shared/touch-action.util';
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

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP_WHEEL = 0.1;
const ZOOM_STEP_BUTTON = 0.25;
const ZOOM_DOUBLE_TAP = 2;
const WHEEL_PAGE_THRESHOLD = 200;
const PROGRAMMATIC_SCROLL_FALLBACK_MS = 1000;

@Component({
  selector: 'app-reader-image',
  standalone: true,
  imports: [CommonModule, FormsModule, ReaderTouchOverlayComponent, ReaderTouchConfigComponent],
  host: { class: 'block h-screen w-screen' },
  styles: [`
    .reader-zoom-img {
      -webkit-user-drag: none;
      user-drag: none;
    }
    /* Layout-affecting zoom so the page slot gets real overflow for pan/columns. */
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
    .reader-viewport.is-panning {
      scroll-behavior: auto !important;
      scroll-snap-type: none !important;
    }
    /* Track → dots → thumb. Inset ≈ half thumb so 0%/100% align with min/max. */
    .reader-seek {
      height: 1.25rem;
      display: flex;
      align-items: center;
    }
    .reader-seek-track {
      left: 0.5rem;
      right: 0.5rem;
      height: 0.375rem;
      border-radius: 9999px;
      background: #334155;
      z-index: 0;
    }
    .reader-seek-dots {
      left: 0.5rem;
      right: 0.5rem;
      height: 0.375rem;
      z-index: 1;
    }
    .reader-seek-dot {
      width: 0.375rem;
      height: 0.375rem;
      margin: 0;
      border-radius: 9999px;
      background: #fbbf24;
      pointer-events: none;
    }
    .reader-seek-input {
      -webkit-appearance: none;
      appearance: none;
      background: transparent;
      height: 1.25rem;
      margin: 0;
    }
    .reader-seek-input::-webkit-slider-runnable-track {
      height: 0.375rem;
      background: transparent;
      border: none;
    }
    .reader-seek-input::-moz-range-track {
      height: 0.375rem;
      background: transparent;
      border: none;
    }
    .reader-seek-input::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 1rem;
      height: 1rem;
      margin-top: -0.3125rem;
      border-radius: 9999px;
      background: #6366f1;
      cursor: pointer;
      border: none;
    }
    .reader-seek-input::-moz-range-thumb {
      width: 1rem;
      height: 1rem;
      border-radius: 9999px;
      background: #6366f1;
      cursor: pointer;
      border: none;
    }
  `],
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
          <div class="reader-zoom-strip flex flex-col items-center mx-auto"
            [class.gap-6]="scrollingMode() === MangaScrollingMode.LongStripGap"
            [style.--reader-zoom]="zoom()">
            @for (url of pages(); track $index; let i = $index) {
              @if (scrollingMode() === MangaScrollingMode.LongStripGap && i > 0) {
                <div class="text-[10px] uppercase tracking-wider text-slate-500 py-2">{{ i }} / {{ pageCount() }}</div>
              }
              <img
                [attr.data-page]="i"
                [src]="url"
                [alt]="'Página ' + (i + 1)"
                [loading]="eagerNear(i) ? 'eager' : 'lazy'"
                draggable="false"
                [class]="pageImageClasses()"
                (dragstart)="$event.preventDefault()"
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
                draggable="false"
                [class]="pageImageClasses()"
                [style.width.%]="zoomWidthPercent()"
                [style.height.%]="zoomHeightPercent()"
                [style.--reader-zoom]="zoom()"
                (dragstart)="$event.preventDefault()"
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
        [class.pointer-events-none]="!chromeVisible()"
        (click)="$event.stopPropagation()">
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

            <div class="relative">
              <button type="button" (click)="toggleTouchMenu()"
                class="p-2 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Mais opções">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                </svg>
              </button>
              @if (touchMenuOpen()) {
                <div class="absolute right-0 top-full mt-1 w-56 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl py-1 z-50">
                  <button type="button" (click)="showTouchDemoManual()"
                    class="w-full px-3 py-2.5 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer">
                    Ver funções de clique
                  </button>
                  <button type="button" (click)="openTouchConfig()"
                    class="w-full px-3 py-2.5 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer">
                    Configurar funções de clique
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      </header>

      <!-- Progress seek -->
      <div
        class="absolute inset-x-0 bottom-20 z-30 px-14 sm:px-20 transition-all duration-300"
        [class.opacity-0]="!chromeVisible()"
        [class.translate-y-4]="!chromeVisible()"
        [class.pointer-events-none]="!chromeVisible()"
        (click)="$event.stopPropagation()">
        <div class="mx-auto max-w-3xl bg-slate-900/70 backdrop-blur-md border border-slate-800/50 rounded-xl px-4 pt-2 pb-3">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] font-semibold text-slate-300 tabular-nums">
              {{ seekBarPage() + 1 }} / {{ pageCount() }}
            </span>
            <button type="button" (click)="toggleChapters()"
              class="text-[10px] font-semibold text-indigo-300 hover:text-indigo-200 cursor-pointer">
              Capítulos
            </button>
          </div>
          <div class="reader-seek relative">
            <div class="reader-seek-track absolute top-1/2 -translate-y-1/2 pointer-events-none"></div>
            <div class="reader-seek-dots absolute top-1/2 -translate-y-1/2 pointer-events-none">
              @for (ch of chapters(); track ch) {
                <span
                  class="reader-seek-dot absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                  [style.left.%]="chapterDotPercent(ch)"></span>
              }
            </div>
            <input
              type="range"
              min="0"
              [max]="Math.max(0, pageCount() - 1)"
              [value]="seekBarPage()"
              (change)="onSeekCommit($event)"
              class="reader-seek-input relative z-10 w-full cursor-pointer" />
          </div>
        </div>
      </div>

      <!-- Bottom toolbar -->
      <footer
        class="absolute bottom-0 inset-x-0 z-30 transition-all duration-300"
        [class.opacity-0]="!chromeVisible()"
        [class.translate-y-full]="!chromeVisible()"
        [class.pointer-events-none]="!chromeVisible()"
        (click)="$event.stopPropagation()">
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

          <button type="button" (click)="toggleChapters()"
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
          bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-3"
          (click)="$event.stopPropagation()">
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

      <app-reader-touch-overlay
        [open]="showTouchDemo()"
        type="manga"
        (dismiss)="showTouchDemo.set(false)" />

      <app-reader-touch-config
        [open]="showTouchConfig()"
        type="manga"
        [coverUrl]="coverUrl()"
        (close)="showTouchConfig.set(false)" />

      @if (stubToast()) {
        <div class="absolute bottom-20 left-1/2 -translate-x-1/2 z-[65] px-3 py-1.5 rounded-lg bg-slate-800/95 border border-slate-600 text-[11px] text-slate-200 pointer-events-none">
          {{ stubToast() }}
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
  private touchZones = inject(TouchZoneService);

  MangaScrollingMode = MangaScrollingMode;
  MangaFitMode = MangaFitMode;
  Math = Math;

  mangaId = Number(this.route.snapshot.paramMap.get('id'));
  title = signal('Leitor de Mangá');
  pages = signal<string[]>([]);
  pageCount = signal(0);
  currentPage = signal(0);
  /** Progress UI mark (thumb + seek counter); may lead currentPage during smooth scroll. */
  seekBarPage = signal(0);
  chapters = signal<number[]>([]);
  favorite = signal(false);
  annotations = signal<MangaAnnotation[]>([]);
  readonly marked = computed(() =>
    this.annotations().some(
      a => (a.markType || '') === 'PageMark' && a.page === this.currentPage()
    )
  );
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
  showTouchDemo = signal(false);
  showTouchConfig = signal(false);
  touchMenuOpen = signal(false);
  stubToast = signal<string | null>(null);
  coverUrl = signal<string | null>(null);

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
  private scrollEndHandler: (() => void) | null = null;
  private mangaMeta: Manga | null = null;
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
  /** When true, this gesture only pans the page slot (zoom / remaining overflow). */
  private lockToPagePan = false;
  /** When true, this gesture scrubs the viewport for page turns (anchor on release). */
  private pagerDragActive = false;
  /** Gesture mode not chosen until drag passes DRAG_THRESHOLD_PX. */
  private gestureModePending = false;
  private clickTimer: ReturnType<typeof setTimeout> | null = null;
  private stubToastTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPageLand: PageLand = 'start';

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
    this.clearProgrammaticScrollListeners();
    if (this.clickTimer) clearTimeout(this.clickTimer);
    if (this.stubToastTimer) clearTimeout(this.stubToastTimer);
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
    const pan = this.panning() ? ' is-panning' : '';
    const base = 'reader-viewport absolute inset-0 outline-none touch-none';
    if (this.isHorizontal()) {
      return this.isRtl()
        ? `${base} overflow-x-auto overflow-y-hidden flex flex-row-reverse snap-x snap-mandatory scroll-smooth${pan}`
        : `${base} overflow-x-auto overflow-y-hidden flex snap-x snap-mandatory scroll-smooth${pan}`;
    }
    if (this.scrollingMode() === MangaScrollingMode.Vertical) {
      return `${base} overflow-y-auto overflow-x-hidden flex flex-col snap-y snap-mandatory scroll-smooth${pan}`;
    }
    return `${base} overflow-y-auto overflow-x-hidden scroll-smooth${pan}`;
  }

  pagedSlotClasses(): string {
    const zoomed = this.zoom() !== 1;
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
    const fit = this.fitMode();
    if (fit === MangaFitMode.FitHeight) {
      return `${base} w-auto max-w-full`;
    }
    if (fit === MangaFitMode.Original) {
      // CSS zoom grows layout box so the slot gets real overflow (unlike transform:scale).
      return `${base} reader-zoom-original w-auto h-auto`;
    }
    // FitWidth — width set via zoomWidthPercent() for layout-affecting zoom
    return `${base} h-auto max-w-none`;
  }

  /** Layout zoom for FitWidth (null = leave CSS class width). */
  zoomWidthPercent(): number | null {
    if (this.isLongStrip()) return null;
    if (this.fitMode() !== MangaFitMode.FitWidth) return null;
    return 100 * this.zoom();
  }

  /** Layout zoom for FitHeight. */
  zoomHeightPercent(): number | null {
    if (this.isLongStrip()) return null;
    if (this.fitMode() !== MangaFitMode.FitHeight) return null;
    return 100 * this.zoom();
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
    // Mirror Kotlin setViewMode → scale(): changing fit always resets user zoom.
    this.zoom.set(1);
    const slot = this.currentPageSlot();
    if (slot) {
      slot.scrollTop = 0;
      slot.scrollLeft = 0;
    }
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
    if (this.showTouchDemo() || this.showTouchConfig()) return;
    if (this.touchMenuOpen()) {
      this.touchMenuOpen.set(false);
      return;
    }

    const el = this.viewportRef?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const localX = ev.clientX - rect.left;
    const localY = ev.clientY - rect.top;

    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
      this.clickTimer = null;
      // Double click: toggle zoom (image)
      this.setZoom(this.zoom() === 1 ? ZOOM_DOUBLE_TAP : 1);
      return;
    }

    this.clickTimer = setTimeout(() => {
      this.clickTimer = null;
      this.dispatchTouchTap(localX, localY, rect.width, rect.height);
    }, TOUCH_DOUBLE_CLICK_MS);
  }

  private dispatchTouchTap(localX: number, localY: number, width: number, height: number): void {
    const handlers: TouchActionHandlers = {
      showChrome: () => this.chromeVisible.set(true),
      hideChrome: () => {
        this.chromeVisible.set(false);
        this.showChapters.set(false);
        this.touchMenuOpen.set(false);
      },
      isChromeVisible: () => this.chromeVisible(),
      goPrevPage: () => this.goPrev(),
      goNextPage: () => this.goNext(),
      openChapters: () => {
        this.chromeVisible.set(true);
        this.showChapters.set(true);
      },
      markPage: () => void this.markPage(),
      fitWidth: () => this.setFitMode(MangaFitMode.FitWidth),
      aspectFit: () => this.setFitMode(MangaFitMode.FitHeight),
      previousFile: () => this.showStub('Arquivo anterior (em breve)'),
      nextFile: () => this.showStub('Próximo arquivo (em breve)'),
      shareImage: () => this.showStub('Compartilhar imagem (em breve)')
    };
    handleReaderTouchTap(this.touchZones, 'manga', localX, localY, width, height, handlers);
  }

  showTouchDemoManual(): void {
    this.touchMenuOpen.set(false);
    this.showTouchDemo.set(true);
  }

  openTouchConfig(): void {
    this.touchMenuOpen.set(false);
    this.showTouchConfig.set(true);
  }

  toggleTouchMenu(): void {
    this.touchMenuOpen.update(v => !v);
  }

  toggleChapters(): void {
    this.showChapters.update(v => !v);
  }

  private showStub(message: string): void {
    this.stubToast.set(message);
    if (this.stubToastTimer) clearTimeout(this.stubToastTimer);
    this.stubToastTimer = setTimeout(() => this.stubToast.set(null), 2000);
  }

  private maybeShowFirstTouchDemo(): void {
    if (this.touchZones.isDemoShown('manga')) return;
    this.touchZones.markDemoShown('manga');
    // After cover/chrome settle
    setTimeout(() => this.showTouchDemo.set(true), 500);
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
    if (slot && canScrollSlot(slot, 'y', ev.deltaY > 0 ? 1 : -1)) {
      slot.scrollTop += ev.deltaY;
      this.wheelAccum = 0;
      return;
    }

    this.wheelAccum += ev.deltaY;
    if (Math.abs(this.wheelAccum) < WHEEL_PAGE_THRESHOLD) return;

    const forward = this.wheelAccum > 0;
    this.wheelAccum = 0;
    if (this.isRtl()) {
      forward ? this.seekTo(this.currentPage() - 1, 'end') : this.seekTo(this.currentPage() + 1, 'start');
    } else {
      forward ? this.seekTo(this.currentPage() + 1, 'start') : this.seekTo(this.currentPage() - 1, 'end');
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
    this.panStartX = ev.clientX;
    this.panStartY = ev.clientY;
    this.panStartTime = performance.now();
    this.panStartPage = this.currentPage();
    this.panStartScrollLeft = el.scrollLeft;
    this.panStartScrollTop = el.scrollTop;
    this.panTarget = this.currentPageSlot() || el;
    this.lockToPagePan = false;
    this.pagerDragActive = false;
    this.gestureModePending = !this.isLongStrip();

    ev.preventDefault();
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

    const totalDx = ev.clientX - this.panStartX;
    const totalDy = ev.clientY - this.panStartY;
    if (Math.abs(totalDx) + Math.abs(totalDy) > DRAG_THRESHOLD_PX) {
      this.didDrag = true;
    }

    const slot = this.panTarget;
    const viewport = this.viewportRef?.nativeElement;
    if (!viewport) return;

    // Long strip: 1:1 viewport pan (is-panning disables scroll-smooth).
    if (this.isLongStrip()) {
      viewport.scrollTop -= dy;
      viewport.scrollLeft -= dx;
      return;
    }

    // Decide page-pan vs pager after slop, using dominant axis + direction.
    if (this.gestureModePending && this.didDrag) {
      this.gestureModePending = false;
      const dominantX = Math.abs(totalDx) >= Math.abs(totalDy);
      const slotEl = slot && slot !== viewport ? slot : this.currentPageSlot();
      if (slotEl) {
        if (dominantX) {
          const dir = (totalDx < 0 ? 1 : -1) as 1 | -1; // finger left → content scrolls right
          this.lockToPagePan = canScrollSlot(slotEl, 'x', dir);
          // Meaningful cross-axis remaining scroll keeps the gesture on the page.
          if (!this.lockToPagePan && Math.abs(totalDy) > DRAG_THRESHOLD_PX) {
            this.lockToPagePan = canScrollSlot(slotEl, 'y', totalDy < 0 ? 1 : -1);
          }
        } else {
          const dir = (totalDy < 0 ? 1 : -1) as 1 | -1; // finger up → content scrolls down
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

    // Pager drag (viewport scrub; commit/snap on release).
    this.pagerDragActive = true;
    if (this.isHorizontal()) {
      viewport.scrollLeft -= dx;
    } else {
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

    const wasDrag = this.didDrag;
    const wasPager = this.pagerDragActive && wasDrag && !this.isLongStrip();
    const startPage = this.panStartPage;
    const startLeft = this.panStartScrollLeft;
    const startTop = this.panStartScrollTop;
    const startTime = this.panStartTime;

    this.panPointerId = null;
    this.panTarget = null;
    this.lockToPagePan = false;
    this.pagerDragActive = false;
    this.gestureModePending = false;
    this.panning.set(false);

    if (!wasPager || !el) return;

    const elapsed = Math.max(1, performance.now() - startTime) / 1000;
    if (this.isHorizontal()) {
      const delta = el.scrollLeft - startLeft;
      const pageW = el.clientWidth || 1;
      const velocity = delta / elapsed;
      // scrollLeft -= dx: finger left → positive delta → next page (LTR and RTL zones agree).
      const target = resolvePagerDragTarget({
        startPage,
        delta,
        pageSize: pageW,
        pageCount: this.pageCount(),
        velocityPxPerS: velocity
      });
      const land: PageLand = target > startPage ? 'start' : target < startPage ? 'end' : 'start';
      this.pendingPageLand = land;
      this.scrollToPage(target, true, land);
    } else if (this.scrollingMode() === MangaScrollingMode.Vertical) {
      const delta = el.scrollTop - startTop;
      const pageH = el.clientHeight || 1;
      const velocity = delta / elapsed;
      const target = resolvePagerDragTarget({
        startPage,
        delta,
        pageSize: pageH,
        pageCount: this.pageCount(),
        velocityPxPerS: velocity
      });
      const land: PageLand = target > startPage ? 'start' : target < startPage ? 'end' : 'start';
      this.pendingPageLand = land;
      this.scrollToPage(target, true, land);
    }
  }

  onViewportScroll(): void {
    if (this.scrollSyncLock || this.loading()) return;
    this.syncCurrentPageFromDom();
  }

  /** Navigate previous with column scroll first (zones + keyboard + buttons). */
  goPrev(): void {
    if (this.tryScrollCurrentPage(-1)) return;
    this.seekTo(this.currentPage() - 1, 'end');
  }

  /** Navigate next with column scroll first (zones + keyboard + buttons). */
  goNext(): void {
    if (this.tryScrollCurrentPage(1)) return;
    this.seekTo(this.currentPage() + 1, 'start');
  }

  onSeekCommit(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const target = Number(input.value);
    // Keep thumb on the selected page; currentPage still updates when smooth scroll ends.
    this.seekTo(target, target >= this.currentPage() ? 'start' : 'end');
  }

  seekTo(page: number, land: PageLand = 'start'): void {
    const max = Math.max(0, this.pageCount() - 1);
    const next = Math.min(Math.max(0, Number(page) || 0), max);
    this.seekBarPage.set(next);
    this.pendingPageLand = land;
    this.scrollToPage(next, true, land);
  }

  async markPage(): Promise<void> {
    if (!this.mangaId) return;
    const page = this.currentPage();
    const existing = this.annotations().find(
      a => (a.markType || '') === 'PageMark' && a.page === page
    );

    if (existing?.id) {
      const ok = await this.electron.deleteMangaAnnotation(existing.id);
      if (ok) {
        this.annotations.update(list => list.filter(a => a.id !== existing.id));
        this.showStub(`Página ${page + 1} desmarcada`);
      }
      return;
    }

    const chapterPages = this.chapters();
    const chapterStart =
      [...chapterPages].reverse().find(c => c <= page) ?? 0;
    const chapter =
      chapterPages.length > 0
        ? `Cap. ${chapterPages.indexOf(chapterStart) + 1}`
        : '';
    const folder = this.pages()[page] || '';

    const saved = await this.electron.saveMangaAnnotation({
      fkManga: this.mangaId,
      page,
      pages: this.pageCount(),
      markType: 'PageMark',
      chapter,
      folder,
      note: ''
    });
    if (saved) {
      this.annotations.update(list => [saved, ...list.filter(a => a.id !== saved.id)]);
      this.showStub(`Página ${page + 1} marcada`);
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
        this.coverUrl.set(manga.coverPath ? `local-cover:///${manga.coverPath}` : null);
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
      this.seekBarPage.set(opened.bookMark);
      this.pendingJump = opened.bookMark;
      this.brokenPages.set(0);
      this.zoom.set(1);

      try {
        this.annotations.set(await this.electron.listMangaAnnotations(this.mangaId));
      } catch (e) {
        console.warn('[reader-image] list annotations failed', e);
        this.annotations.set([]);
      }

      this.historySessionId = await this.electron.startHistorySession({
        fkLibrary: manga?.fkLibrary ?? 0,
        fkReference: this.mangaId,
        type: 'MANGA',
        pageStart: opened.bookMark,
        pages: opened.pageCount,
        volume: manga?.volume || ''
      });

      setTimeout(() => this.chromeVisible.set(false), 400);
      this.maybeShowFirstTouchDemo();
    } catch (e: any) {
      console.error(e);
      this.error.set(e?.message || 'Erro ao abrir o mangá');
    } finally {
      this.loading.set(false);
    }
  }

  private beginProgrammaticScroll(smooth: boolean): void {
    this.scrollSyncLock = true;
    this.clearProgrammaticScrollListeners();

    const el = this.viewportRef?.nativeElement;
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
    const el = this.viewportRef?.nativeElement;
    if (el && this.scrollEndHandler) {
      el.removeEventListener('scrollend', this.scrollEndHandler);
      this.scrollEndHandler = null;
    }
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
    this.seekBarPage.set(index);
    if (index !== this.currentPage()) {
      this.currentPage.set(index);
      this.scheduleProgressUpdate();
    }
  }

  private scrollToPage(page: number, smooth: boolean, land: PageLand = this.pendingPageLand): void {
    const el = this.viewportRef?.nativeElement;
    if (!el) {
      this.pendingJump = page;
      this.pendingPageLand = land;
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

    // Land at start/end of the page slot after the page change settles.
    const delay = smooth ? PROGRAMMATIC_SCROLL_FALLBACK_MS : 0;
    setTimeout(() => {
      const slot = el.querySelector(`[data-page="${page}"]`) as HTMLElement | null;
      if (!slot || this.isLongStrip()) return;
      const offsets = pageLandOffsets(slot, land, this.isRtl());
      slot.scrollTop = offsets.top;
      slot.scrollLeft = offsets.left;
    }, delay);
  }

  private currentPageSlot(): HTMLElement | null {
    const el = this.viewportRef?.nativeElement;
    if (!el) return null;
    return el.querySelector(`[data-page="${this.currentPage()}"]`) as HTMLElement | null;
  }

  /** @returns true if scrolled within the current page (column reading). */
  private tryScrollCurrentPage(dir: 1 | -1): boolean {
    if (this.isLongStrip()) return false;
    if (!this.isHorizontal() && this.scrollingMode() !== MangaScrollingMode.Vertical) {
      return false;
    }
    const slot = this.currentPageSlot();
    if (!slot) return false;

    const overflow = readSlotOverflow(slot);
    const action = planColumnStep({
      overflow,
      dir,
      rtl: this.isRtl(),
      allowHorizontalColumns: this.isHorizontal() || this.zoom() !== 1,
      clientWidth: slot.clientWidth,
      clientHeight: slot.clientHeight
    });
    return applyColumnAction(slot, action);
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
