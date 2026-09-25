import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  inject,
  signal,
  computed,
  effect,
  untracked,
  ElementRef,
  ViewChild,
  HostListener,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import ePub, { Book as EpubBook, NavItem, Rendition } from 'epubjs';
import { ElectronService } from '../../core/services/electron.service';
import { NavigationStackService } from '../../core/services/navigation-stack.service';
import { SettingsService } from '../../core/services/settings.service';
import { BookUnlockService } from '../../core/services/book-unlock.service';
import { bookNeedsUnlock, bookPasswordMatches } from '../../core/utils/book-password.util';
import {
  TOUCH_DOUBLE_CLICK_MS,
  TouchZoneService
} from '../../core/services/touch-zone.service';
import {
  Book,
  BookAlign,
  BookAnnotation,
  BookAnnotationColor,
  BOOK_ANNOTATION_COLOR_HEX,
  BookConfiguration,
  BookLayout,
  BookMarginSize,
  BookPageSize,
  BOOK_PAGE_SIZE_LABELS,
  getBookPageVirtualDimensions,
  BookScrollingMode,
  BookSearchHistory,
  BookSearchListItem,
  BookSpacingSize,
  Kanjax,
  Languages,
  PAGE_TRANSITION_LABELS_PT,
  PAGE_TRANSITION_OPTIONS,
  PageTransitionType,
  Vocabulary,
  isPageTransitionType,
  prefersReducedMotion,
  Track
} from '../../core/models';
import { TrackerSimpleDialogComponent } from '../../shared/tracker-simple-dialog/tracker-simple-dialog.component';
import { TrackerConfigDialogComponent } from '../../shared/tracker-config-dialog/tracker-config-dialog.component';
import type { TurnAxis, TurnDir } from '../../core/models/enums/page-transition.enums';
import { reconcileAnnotationPageAndCfi } from '../../core/utils/share-annotation-reconcile';
import { fromReaderIndex, toReaderIndex } from '../../core/utils/reading-progress.util';
import { ReaderTouchOverlayComponent } from '../reader-shared/reader-touch-overlay.component';
import { ReaderTouchConfigComponent } from '../reader-shared/reader-touch-config.component';
import { handleReaderTouchTap, TouchActionHandlers } from '../reader-shared/touch-action.util';
import {
  cancelActivePageTurns,
  playPageTurn
} from '../reader-shared/page-transition/page-transition.player';
import {
  cancelBookCurlTurns,
  paintBookCurlFreeze,
  paintBookCurlProgress,
  playBookCurlTurn
} from '../reader-shared/page-transition/book-curl.player';
import {
  pairBookCurlBitmaps,
  dataUrlToOpaqueBitmap,
  type BookCurlBitmaps
} from '../reader-shared/page-transition/book-curl.capture';
import { isBookNavLocked } from './book-turn-lock.util';
import { PageTurnDriver } from '../reader-shared/page-transition/page-transition.driver';
import { PAGE_TURN_DURATION_MS } from '../../core/models/enums/page-transition.enums';
import { AnnotationPopupComponent } from '../annotations/components/annotation-popup.component';
import { AnnotationListOverlayComponent } from './annotation-list-overlay.component';
import { TextSelectPopupComponent } from './text-select-popup.component';
import { BookTtsBarComponent } from './book-tts-bar.component';
import { BookTtsPopupComponent } from './book-tts-popup.component';
import { VocabularyDetailDialogComponent } from '../vocabulary/components/vocabulary-detail-dialog.component';
import { KanjaxDetailDialogComponent } from '../vocabulary/components/kanjax-detail-dialog.component';
import { ReadingAssistantPanelComponent } from '../assistant/reading-assistant-panel.component';
import { ReadingSummaryDialogComponent } from '../assistant/reading-summary-dialog.component';
import { AssistantContextItem } from '../assistant/assistant-context.util';
import {
  splitTtsSentences,
  findSentenceIndexContaining,
  extractContentsText,
  cfiForSentence,
  TtsSentence
} from './book-tts.util';
import {
  AudioStatus,
  TextSpeech,
  textSpeechDefault,
  parseTextSpeech,
  textSpeechAzureName
} from '../../core/models/enums/tts-enums';
import { AnnotationItem } from '../../core/models';
import { BookFontOption, babelStoneFontFaceCss, japaneseFontOptions, westernFontOptions, resolveFontFamilyForTate } from './book-fonts';
import { JapaneseTextUtil } from '../../core/services/japanese/japanese-text.util';
import { runBookSearch } from './book-search.util';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface TocEntry {
  label: string;
  href: string;
  location: number;
}

interface TextSelectPos {
  left: number;
  top: number;
}

interface PendingSelectShow {
  cfiRange: string;
  text: string;
  range?: number[];
  contents: any;
  domRange: Range | null;
}

const MARGIN_PX: Record<BookMarginSize, number> = {
  small: 16,
  medium: 32,
  large: 56
};

const SPACING_LH: Record<BookSpacingSize, number> = {
  small: 1.4,
  medium: 1.6,
  large: 1.8
};

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP_WHEEL = 0.1;
const ZOOM_STEP_BUTTON = 0.25;
const WHEEL_PAGE_THRESHOLD = 200;
const DRAG_THRESHOLD_PX = 5;
/** Unified page / iframe / host background (avoids color flash on overscroll). */
const PAGE_BG = '#0f172a';
/** Commit page turn when |accum| ≥ this fraction of viewport side (~1/4 screen). */
const OVERSCROLL_COMMIT_RATIO = 0.22;
/** Minimum commit distance (px) so short drags never turn the page. */
const OVERSCROLL_COMMIT_MIN_PX = 80;
/** Fling velocity (px/s) that commits even below the distance threshold (manga parity). */
const OVERSCROLL_FLING_PX_PER_S = 600;
/** Start loading adjacent-page peek after this much overscroll (px). */
const OVERSCROLL_PEEK_REVEAL_PX = 8;
/** Dedupe window for click + touchend on the same gesture (ms). */
const TAP_DEDUPE_MS = 350;

@Component({
  selector: 'app-reader-text',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReaderTouchOverlayComponent,
    ReaderTouchConfigComponent,
    AnnotationPopupComponent,
    AnnotationListOverlayComponent,
    TextSelectPopupComponent,
    BookTtsBarComponent,
    BookTtsPopupComponent,
    VocabularyDetailDialogComponent,
    KanjaxDetailDialogComponent,
    ReadingAssistantPanelComponent,
    ReadingSummaryDialogComponent,
    TrackerSimpleDialogComponent,
    TrackerConfigDialogComponent
  ],
  host: { class: 'block h-screen w-screen' },
  styles: [`
    :host ::ng-deep mark.br-search-mark {
      background: #facc15;
      color: #0f172a;
      border-radius: 2px;
      padding: 0 1px;
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
      background: rgb(var(--accent-500));
      cursor: pointer;
      border: none;
    }
    .reader-seek-input::-moz-range-thumb {
      width: 1rem;
      height: 1rem;
      border-radius: 9999px;
      background: rgb(var(--accent-500));
      cursor: pointer;
      border: none;
    }

    @keyframes thumb-pop {
      0% { transform: scale(0.92); filter: brightness(1.3); }
      50% { transform: scale(1.08); filter: brightness(1.15); }
      100% { transform: scale(1); filter: brightness(1); }
    }
    .animate-thumb-pop {
      animation: thumb-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    @keyframes card-enter-left {
      0% {
        transform: translate3d(-140%, 0, 0) scale(0.82);
        opacity: 0;
      }
      70% {
        transform: translate3d(6%, 0, 0) scale(1.03);
        opacity: 1;
      }
      100% {
        transform: translate3d(0, 0, 0) scale(1);
        opacity: 1;
      }
    }

    @keyframes card-enter-right {
      0% {
        transform: translate3d(140%, 0, 0) scale(0.82);
        opacity: 0;
      }
      70% {
        transform: translate3d(-6%, 0, 0) scale(1.03);
        opacity: 1;
      }
      100% {
        transform: translate3d(0, 0, 0) scale(1);
        opacity: 1;
      }
    }

    @keyframes card-exit-left {
      0% {
        transform: translate3d(0, 0, 0) scale(1);
        opacity: 1;
      }
      100% {
        transform: translate3d(-140%, 0, 0) scale(0.85);
        opacity: 0;
      }
    }

    @keyframes card-exit-right {
      0% {
        transform: translate3d(0, 0, 0) scale(1);
        opacity: 1;
      }
      100% {
        transform: translate3d(140%, 0, 0) scale(0.85);
        opacity: 0;
      }
    }

    .last-page-card {
      will-change: transform, opacity;
    }
    .last-page-card.is-hidden {
      display: none;
    }
    .last-page-card.is-left.is-entering {
      animation: card-enter-left 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    .last-page-card.is-left.is-visible {
      transform: translate3d(0, 0, 0) scale(1);
      opacity: 1;
    }
    .last-page-card.is-left.is-exiting {
      animation: card-exit-left 0.32s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      pointer-events: none;
    }
    .last-page-card.is-right.is-entering {
      animation: card-enter-right 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    .last-page-card.is-right.is-visible {
      transform: translate3d(0, 0, 0) scale(1);
      opacity: 1;
    }
    .last-page-card.is-right.is-exiting {
      animation: card-exit-right 0.32s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      pointer-events: none;
    }
  `],
  template: `
    <div class="h-screen w-screen relative bg-slate-950 text-slate-100 overflow-hidden select-none">
      @if (loading()) {
        <div class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 gap-4">
          <div class="w-12 h-12 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin"></div>
          <p class="text-sm font-semibold text-slate-200">Preparando livro…</p>
          <p class="text-xs text-slate-400">{{ loadingMessage() }}</p>
        </div>
      }

      @if (error()) {
        <div class="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950 gap-3 p-8 text-center">
          <p class="text-sm font-semibold text-red-300 max-w-md">{{ error() }}</p>
          <button type="button" (click)="goBack()"
            class="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer">
            Voltar
          </button>
        </div>
      }

      @if (unlockRequired()) {
        <div class="absolute inset-0 z-[55] flex items-center justify-center bg-slate-950/95 p-4">
          <div class="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 space-y-3">
            <h2 class="text-sm font-semibold text-slate-100">Livro protegido</h2>
            <p class="text-xs text-slate-400">Digite a senha para abrir “{{ title() }}”.</p>
            <input type="password" autocomplete="off"
              class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
              [(ngModel)]="unlockAttempt"
              (keydown.enter)="confirmUnlock()" />
            @if (unlockError()) {
              <p class="text-[11px] text-rose-300">{{ unlockError() }}</p>
            }
            <div class="flex justify-end gap-2">
              <button type="button" (click)="goBack()"
                class="px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer">
                Cancelar
              </button>
              <button type="button" (click)="confirmUnlock()"
                class="px-3 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer">
                Abrir
              </button>
            </div>
          </div>
        </div>
      }

      <!-- EPUB viewport (clicks/pan via iframe hooks — does not bubble to Angular) -->
      <div
        #viewerHost
        data-br-viewer-host
        class="absolute inset-0 outline-none z-0 touch-none overflow-hidden"
        [style.background]="pageBg"
        [class.cursor-grab]="!panning()"
        [class.cursor-grabbing]="panning()">
        <!-- Opaque surface mask during turns (Depth/Zoom/Fade holes) — no destination bitmap. -->
        <div
          class="absolute inset-0 pointer-events-none"
          [style.background]="pageBg"
          [style.visibility]="turningSignal() || driverActive() ? 'visible' : 'hidden'"
          aria-hidden="true"></div>
        <!--
          Turn shells receive PageTurnDriver transforms.
          Inner nodes keep Angular overscroll bindings — returning null from those
          bindings must NOT clear the driver's transform (Zone CD vs rAF fight).
        -->
        <div
          #peekShell
          class="absolute inset-0 origin-top pointer-events-none will-change-transform"
          [style.visibility]="peekLayerActive() ? 'visible' : 'hidden'">
          <div
            #viewerPeek
            class="absolute inset-0 origin-top pointer-events-none"
            [style.background]="pageBg"
            [style.zoom]="peekLayerActive() ? effectiveZoom() : null"
            [style.transform]="peekTransform()"
            [style.transition]="viewerTransition()"
            [style.visibility]="peekLayerActive() ? 'visible' : 'hidden'"></div>
        </div>
        <div #viewerShell class="absolute inset-0 origin-top will-change-transform">
          <div
            #viewer
            class="absolute inset-0 origin-top"
            [style.background]="pageBg"
            [style.zoom]="effectiveZoom()"
            [style.transform]="viewerTransform()"
            [style.transition]="viewerTransition()"></div>
        </div>
      </div>

      <!-- Always-visible progress track + marker (full book width) -->
      @if (!loading() && !error()) {
        <div data-br-chrome="progress" class="absolute bottom-0 inset-x-0 z-20 pointer-events-none">
          <div class="relative z-10 h-0.5 bg-slate-800">
            <div
              class="absolute top-0 bottom-0 left-0 bg-slate-400 transition-[width] duration-200"
              [style.width.%]="progressMarkerPercent()"></div>
            <div
              class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-slate-300 shadow-sm transition-[left] duration-200 z-10"
              [style.left.%]="progressMarkerPercent()"></div>
          </div>
          <div class="flex items-center justify-between px-4 py-1 bg-slate-950/50 backdrop-blur-sm">
            <span class="text-[10px] text-slate-400 truncate max-w-[60%]">{{ chapterTitle() || title() }}</span>
            <span class="text-[10px] text-slate-400 tabular-nums">{{ progressPercent() }}%</span>
          </div>
        </div>
      }

      <!-- Chrome: top -->
      <header
        data-br-chrome="header"
        class="absolute top-0 inset-x-0 z-40 transition-all duration-300"
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
              <p class="text-[10px] text-slate-400 truncate">
                {{ chapterTitle() || author() || ('Página ' + (currentPage() + 1) + ' / ' + (pageCount() || '—')) }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button type="button" (click)="toggleToc()"
              class="p-2 rounded-lg transition-colors cursor-pointer"
              [class.text-indigo-300]="showToc()"
              [class.text-slate-300]="!showToc()"
              title="Capítulos">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 6h16M4 10h16M4 14h10M4 18h10"/>
              </svg>
            </button>

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

            <button type="button" (click)="toggleTypography()"
              class="p-2 rounded-lg transition-colors cursor-pointer"
              [class.text-indigo-300]="showTypography()"
              [class.text-slate-300]="!showTypography()"
              title="Tipografia">
              <span class="text-xs font-bold tracking-wide px-0.5">Aa</span>
            </button>

            <div class="hidden sm:flex items-center gap-0.5 bg-slate-950/80 border border-slate-700 rounded-lg px-1">
              <button type="button" (click)="zoomOut()"
                class="p-1.5 text-slate-300 hover:text-white rounded cursor-pointer" title="Diminuir zoom">
                <span class="text-sm font-bold leading-none">−</span>
              </button>
              <span class="text-[10px] tabular-nums text-slate-400 min-w-[2.75rem] text-center">{{ zoomPercent() }}%</span>
              <button type="button" (click)="zoomIn()"
                class="p-1.5 text-slate-300 hover:text-white rounded cursor-pointer" title="Aumentar zoom">
                <span class="text-sm font-bold leading-none">+</span>
              </button>
            </div>

            <select
              class="hidden md:block bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 max-w-[14rem]"
              [ngModel]="scrollingMode()"
              (ngModelChange)="setScrollingMode($event)"
              title="Modo de leitura">
              <option [ngValue]="BookScrollingMode.Pagination">Horizontal (Esquerda para direita)</option>
              <option [ngValue]="BookScrollingMode.PaginationRtl">Horizontal (Direita para esquerda)</option>
              <option [ngValue]="BookScrollingMode.PaginationVertical">Vertical</option>
              <option [ngValue]="BookScrollingMode.Continuous">Tira contínua</option>
            </select>

            <button type="button" (click)="openSearch()"
              class="hidden sm:block p-2 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              [class.text-indigo-300]="showSearch()"
              title="Buscar no livro">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/>
              </svg>
            </button>

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
                <div class="absolute right-0 top-full mt-1 w-64 max-h-[80vh] overflow-y-auto rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl py-1.5 z-50 divide-y divide-slate-800">
                  <!-- Navigation section -->
                  <div class="py-1">
                    <p class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Navegação</p>
                    <button type="button" (click)="requestAdjacentFile('prev'); touchMenuOpen.set(false)"
                      class="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center gap-2.5">
                      <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
                      </svg>
                      Arquivo anterior
                    </button>
                    <button type="button" (click)="goPrev(); touchMenuOpen.set(false)"
                      class="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center gap-2.5">
                      <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                      </svg>
                      Página anterior
                    </button>
                    <button type="button" (click)="goNext(); touchMenuOpen.set(false)"
                      class="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center gap-2.5">
                      <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                      </svg>
                      Próxima página
                    </button>
                    <button type="button" (click)="requestAdjacentFile('next'); touchMenuOpen.set(false)"
                      class="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center gap-2.5">
                      <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
                      </svg>
                      Próximo arquivo
                    </button>
                  </div>

                  <!-- Tools and Panels section -->
                  <div class="py-1">
                    <p class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Recursos &amp; Painéis</p>
                    <button type="button" (click)="toggleToc(); touchMenuOpen.set(false)"
                      class="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center gap-2.5">
                      <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h10M4 18h10"/>
                      </svg>
                      Capítulos / Sumário
                    </button>
                    <button type="button" (click)="toggleTypography(); touchMenuOpen.set(false)"
                      class="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center gap-2.5">
                      <span class="w-4 text-center text-xs font-bold text-indigo-300">Aa</span>
                      Tipografia &amp; Layout
                    </button>
                    <button type="button" (click)="openAnnotations(); touchMenuOpen.set(false)"
                      class="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center gap-2.5">
                      <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h6m-6 8l-4-4V6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H7z"/>
                      </svg>
                      Anotações
                    </button>
                    <button type="button" (click)="toggleTts(); touchMenuOpen.set(false)"
                      class="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center gap-2.5">
                      <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.121-9.193a8 8 0 010 11.314M11 5L6 9H3v6h3l5 4V5z"/>
                      </svg>
                      Leitura em Áudio (TTS)
                    </button>
                    <button type="button" (click)="openAssistant(); touchMenuOpen.set(false)"
                      class="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center gap-2.5">
                      <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                      </svg>
                      Assistente de Leitura (IA)
                    </button>
                    <button type="button" (click)="openSearch(); touchMenuOpen.set(false)"
                      class="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center gap-2.5">
                      <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/>
                      </svg>
                      Buscar no Livro
                    </button>
                    <button type="button" (click)="openTracker(); touchMenuOpen.set(false)"
                      class="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center gap-2.5">
                      <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                      </svg>
                      Rastreamento (MAL / AniList)
                    </button>
                  </div>

                  <!-- Touch section -->
                  <div class="py-1">
                    <p class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Toque &amp; Gestos</p>
                    <button type="button" (click)="showTouchDemoManual(); touchMenuOpen.set(false)"
                      class="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center gap-2.5">
                      <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/>
                      </svg>
                      Ver funções de clique
                    </button>
                    <button type="button" (click)="openTouchConfig(); touchMenuOpen.set(false)"
                      class="w-full px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center gap-2.5">
                      <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      </svg>
                      Configurar funções de clique
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </header>

      <!-- Seek (chrome) -->
      <div
        data-br-chrome="seek"
        class="absolute inset-x-0 bottom-[5.5rem] z-40 px-10 sm:px-20 transition-all duration-300"
        [class.opacity-0]="!chromeVisible()"
        [class.translate-y-4]="!chromeVisible()"
        [class.pointer-events-none]="!chromeVisible()"
        (click)="$event.stopPropagation()">
        <div class="mx-auto max-w-3xl bg-slate-900/70 backdrop-blur-md border border-slate-800/50 rounded-xl px-4 pt-2 pb-3">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] font-semibold text-slate-300 tabular-nums">
              {{ currentPage() + 1 }} / {{ pageCount() || '—' }}
              <span class="text-slate-500 ml-1">({{ progressPercent() }}%)</span>
            </span>
            <button type="button" (click)="toggleToc()"
              class="text-[10px] font-semibold text-indigo-300 hover:text-indigo-200 cursor-pointer">
              Capítulos
            </button>
          </div>
          <div class="reader-seek relative">
            <div class="reader-seek-track absolute top-1/2 -translate-y-1/2 pointer-events-none"></div>
            <div class="reader-seek-dots absolute top-1/2 -translate-y-1/2 pointer-events-none">
              @for (ch of toc(); track ch.href) {
                @if (ch.location >= 0) {
                  <span
                    class="reader-seek-dot absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                    [style.left.%]="chapterDotPercent(ch.location)"></span>
                }
              }
              @for (lp of lastPageDots(); track lp.page) {
                <span
                  class="reader-seek-dot !bg-sky-400 !w-2 !h-2 border border-slate-900 shadow-sm absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                  [style.left.%]="lp.percent"
                  [title]="'Página ' + (lp.page + 1)"></span>
              }
            </div>
            <input
              type="range"
              min="0"
              [max]="Math.max(0, pageCount() - 1)"
              [value]="displayedSeekPage()"
              (pointerdown)="onSeekStart()"
              (input)="onSeekInput($event)"
              (change)="onSeekCommit($event)"
              class="reader-seek-input relative z-10 w-full cursor-pointer" />
          </div>
        </div>
      </div>

      <!-- Bottom toolbar -->
      <footer
        data-br-chrome="footer"
        class="absolute bottom-6 inset-x-0 z-40 transition-all duration-300"
        [class.opacity-0]="!chromeVisible()"
        [class.translate-y-full]="!chromeVisible()"
        [class.pointer-events-none]="!chromeVisible()"
        (click)="$event.stopPropagation()">
        <div class="h-14 px-3 sm:px-6 flex items-center justify-center gap-1 sm:gap-2 bg-slate-900/70 backdrop-blur-md border-t border-slate-800/50">
          <button type="button" (click)="requestAdjacentFile('prev')"
            class="p-2.5 rounded-xl text-slate-200 hover:bg-slate-800 cursor-pointer"
            title="Arquivo anterior">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
            </svg>
          </button>

          <button type="button" (click)="goPrev()"
            [disabled]="isAtBookStart()"
            [class.opacity-40]="isAtBookStart()"
            [class.cursor-not-allowed]="isAtBookStart()"
            class="p-2.5 rounded-xl text-slate-200 hover:bg-slate-800 cursor-pointer" title="Anterior">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>

          <button type="button" (click)="toggleToc()"
            class="p-2.5 rounded-xl text-slate-200 hover:bg-slate-800 cursor-pointer"
            [class.bg-slate-800]="showToc()"
            title="Capítulos">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 6h16M4 10h16M4 14h10M4 18h10"/>
            </svg>
          </button>

          <button type="button" (click)="toggleTypography()"
            class="p-2.5 rounded-xl text-slate-200 hover:bg-slate-800 cursor-pointer"
            [class.bg-slate-800]="showTypography()"
            title="Tipografia">
            <span class="text-xs font-bold tracking-wide">Aa</span>
          </button>

          <select
            class="sm:hidden bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 max-w-[7rem]"
            [ngModel]="scrollingMode()"
            (ngModelChange)="setScrollingMode($event)"
            title="Modo">
            <option [ngValue]="BookScrollingMode.Pagination">L→R</option>
            <option [ngValue]="BookScrollingMode.PaginationRtl">R→L</option>
            <option [ngValue]="BookScrollingMode.PaginationVertical">Vert</option>
            <option [ngValue]="BookScrollingMode.Continuous">Cont.</option>
          </select>

          <button type="button" (click)="openAnnotations()"
            class="p-2.5 rounded-xl text-slate-200 hover:bg-slate-800 cursor-pointer"
            [class.text-indigo-300]="showAnnotations()"
            title="Anotações">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 8h10M7 12h6m-6 8l-4-4V6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H7z"/>
            </svg>
          </button>

          <button type="button" (click)="toggleTts()"
            class="p-2.5 rounded-xl text-slate-200 hover:bg-slate-800 cursor-pointer"
            [class.text-indigo-300]="ttsActive()"
            title="Leitura em áudio (TTS)">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15.536 8.464a5 5 0 010 7.072m2.121-9.193a8 8 0 010 11.314M11 5L6 9H3v6h3l5 4V5z"/>
            </svg>
          </button>

          <button type="button" (click)="openAssistant()"
            class="p-2.5 rounded-xl text-slate-200 hover:bg-slate-800 cursor-pointer"
            [class.text-indigo-300]="showAssistant()"
            title="Assistente de leitura">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
            </svg>
          </button>

          <button type="button" (click)="openTracker()"
            class="p-2.5 rounded-xl cursor-pointer hover:bg-slate-800 text-slate-200"
            title="Rastreador (MAL / AniList)">
            <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </button>

          <button type="button" (click)="goNext()"
            class="p-2.5 rounded-xl text-slate-200 hover:bg-slate-800 cursor-pointer" title="Próxima">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>

          <button type="button" (click)="requestAdjacentFile('next')"
            class="p-2.5 rounded-xl text-slate-200 hover:bg-slate-800 cursor-pointer"
            title="Próximo arquivo">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </footer>

      <!-- TOC panel -->
      @if (showToc() && chromeVisible()) {
        <div
          data-br-panel="toc"
          class="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 w-[min(90vw,28rem)] max-h-72 overflow-y-auto
            bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-3"
          (click)="$event.stopPropagation()">
          <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Capítulos</p>
          @if (toc().length === 0) {
            <p class="text-xs text-slate-500 py-4 text-center">Nenhum capítulo no sumário</p>
          } @else {
            <div class="flex flex-col gap-1">
              @for (ch of toc(); track ch.href) {
                <button type="button"
                  (click)="goToToc(ch)"
                  class="text-left px-3 py-2 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-indigo-600 text-slate-200 cursor-pointer truncate">
                  {{ ch.label }}
                </button>
              }
            </div>
          }
        </div>
      }

      <!-- Typography side sheet -->
      @if (showTypography() && chromeVisible()) {
        <aside
          data-br-panel="typography"
          class="absolute top-14 right-0 bottom-20 z-50 w-[min(90vw,22rem)]
            bg-slate-900/95 backdrop-blur-md border-l border-slate-700 shadow-2xl p-4 overflow-y-auto"
          (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between mb-3">
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tipografia</p>
            <button type="button" (click)="showTypography.set(false)"
              class="p-1 text-slate-400 hover:text-slate-200 cursor-pointer rounded-lg" title="Fechar">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <label class="block text-[11px] text-slate-400 mb-2">Fonte</label>
          <div class="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1 snap-x">
            @for (font of typographyFonts(); track font.id) {
              <button type="button" (click)="setFontFamily(font.css)"
                class="snap-start shrink-0 w-[4.5rem] flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2 cursor-pointer transition-colors hover:border-slate-500"
                [class.border-indigo-400]="fontFamily() === font.css"
                [class.bg-indigo-500]="fontFamily() === font.css"
                [class.bg-opacity-20]="fontFamily() === font.css"
                [class.text-indigo-200]="fontFamily() === font.css"
                [class.border-slate-700]="fontFamily() !== font.css"
                [class.bg-slate-950]="fontFamily() !== font.css"
                [class.text-slate-300]="fontFamily() !== font.css"
                [attr.title]="font.label">
                <span class="text-2xl leading-none pt-1" [style.fontFamily]="font.css">{{ font.sample }}</span>
                <span class="text-[9px] font-medium truncate w-full text-center">{{ font.label }}</span>
              </button>
            }
          </div>

          <div class="h-px bg-slate-700/80 mx-1 mb-4"></div>

          <label class="block text-[11px] text-slate-400 mb-1">Tamanho ({{ fontSize() }}px)</label>
          <div class="flex items-center gap-2 mb-4">
            <button type="button" (click)="adjustFontSize(-1)"
              class="px-3 py-1.5 rounded-lg bg-slate-800 text-sm cursor-pointer hover:bg-slate-700"
              title="Diminuir">A−</button>
            <input type="range" min="12" max="32" [ngModel]="fontSize()" (ngModelChange)="setFontSize($event)"
              class="flex-1 accent-indigo-500 cursor-pointer" />
            <button type="button" (click)="adjustFontSize(1)"
              class="px-3 py-1.5 rounded-lg bg-slate-800 text-sm cursor-pointer hover:bg-slate-700"
              title="Aumentar">A+</button>
          </div>

          <div class="h-px bg-slate-700/80 mx-1 mb-4"></div>

          <label class="block text-[11px] text-slate-400 mb-2">Margem</label>
          <div class="flex justify-between gap-2 mb-4">
            <button type="button" (click)="setMargin('small')" title="Pequena"
              class="flex-1 aspect-square max-h-14 rounded-xl border flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-800 border-slate-700 bg-slate-950"
              [class.border-indigo-400]="margin() === 'small'"
              [class.bg-indigo-500]="margin() === 'small'"
              [class.bg-opacity-20]="margin() === 'small'">
              <svg class="w-7 h-7 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="12" height="16" rx="1" stroke-width="1.5"/>
                <path stroke-width="1.5" d="M8 7h8M8 10h8M8 13h5"/>
              </svg>
            </button>
            <button type="button" (click)="setMargin('medium')" title="Média"
              class="flex-1 aspect-square max-h-14 rounded-xl border flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-800 border-slate-700 bg-slate-950"
              [class.border-indigo-400]="margin() === 'medium'"
              [class.bg-indigo-500]="margin() === 'medium'"
              [class.bg-opacity-20]="margin() === 'medium'">
              <svg class="w-7 h-7 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="4" y="4" width="16" height="16" rx="1" stroke-width="1.5"/>
                <path stroke-width="1.5" d="M7 8h10M7 11h10M7 14h7"/>
              </svg>
            </button>
            <button type="button" (click)="setMargin('large')" title="Grande"
              class="flex-1 aspect-square max-h-14 rounded-xl border flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-800 border-slate-700 bg-slate-950"
              [class.border-indigo-400]="margin() === 'large'"
              [class.bg-indigo-500]="margin() === 'large'"
              [class.bg-opacity-20]="margin() === 'large'">
              <svg class="w-7 h-7 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="2" y="4" width="20" height="16" rx="1" stroke-width="1.5"/>
                <path stroke-width="1.5" d="M6 8h12M6 11h12M6 14h8"/>
              </svg>
            </button>
          </div>

          <label class="block text-[11px] text-slate-400 mb-2">Espaçamento</label>
          <div class="flex justify-between gap-2 mb-4">
            <button type="button" (click)="setSpacing('small')" title="Compacto"
              class="flex-1 aspect-square max-h-14 rounded-xl border flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-800 border-slate-700 bg-slate-950"
              [class.border-indigo-400]="spacing() === 'small'"
              [class.bg-indigo-500]="spacing() === 'small'"
              [class.bg-opacity-20]="spacing() === 'small'">
              <svg class="w-7 h-7 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-width="1.75" stroke-linecap="round" d="M5 8h14M5 11h14M5 14h14"/>
              </svg>
            </button>
            <button type="button" (click)="setSpacing('medium')" title="Normal"
              class="flex-1 aspect-square max-h-14 rounded-xl border flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-800 border-slate-700 bg-slate-950"
              [class.border-indigo-400]="spacing() === 'medium'"
              [class.bg-indigo-500]="spacing() === 'medium'"
              [class.bg-opacity-20]="spacing() === 'medium'">
              <svg class="w-7 h-7 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-width="1.75" stroke-linecap="round" d="M5 7h14M5 12h14M5 17h14"/>
              </svg>
            </button>
            <button type="button" (click)="setSpacing('large')" title="Amplo"
              class="flex-1 aspect-square max-h-14 rounded-xl border flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-800 border-slate-700 bg-slate-950"
              [class.border-indigo-400]="spacing() === 'large'"
              [class.bg-indigo-500]="spacing() === 'large'"
              [class.bg-opacity-20]="spacing() === 'large'">
              <svg class="w-7 h-7 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-width="1.75" stroke-linecap="round" d="M5 6h14M5 12h14M5 18h14"/>
              </svg>
            </button>
          </div>

          <label class="block text-[11px] text-slate-400 mb-2">Alinhamento</label>
          <div class="flex justify-between gap-2 mb-4">
            <button type="button" (click)="setAlign('justify')" title="Justificado"
              class="flex-1 aspect-square max-h-12 rounded-xl border flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-800 border-slate-700 bg-slate-950"
              [class.border-indigo-400]="align() === 'justify'"
              [class.bg-indigo-500]="align() === 'justify'"
              [class.bg-opacity-20]="align() === 'justify'">
              <svg class="w-5 h-5 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-width="2" stroke-linecap="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
              </svg>
            </button>
            <button type="button" (click)="setAlign('left')" title="Esquerda"
              class="flex-1 aspect-square max-h-12 rounded-xl border flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-800 border-slate-700 bg-slate-950"
              [class.border-indigo-400]="align() === 'left'"
              [class.bg-indigo-500]="align() === 'left'"
              [class.bg-opacity-20]="align() === 'left'">
              <svg class="w-5 h-5 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-width="2" stroke-linecap="round" d="M4 6h16M4 10h12M4 14h16M4 18h10"/>
              </svg>
            </button>
            <button type="button" (click)="setAlign('center')" title="Centro"
              class="flex-1 aspect-square max-h-12 rounded-xl border flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-800 border-slate-700 bg-slate-950"
              [class.border-indigo-400]="align() === 'center'"
              [class.bg-indigo-500]="align() === 'center'"
              [class.bg-opacity-20]="align() === 'center'">
              <svg class="w-5 h-5 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-width="2" stroke-linecap="round" d="M4 6h16M7 10h10M4 14h16M8 18h8"/>
              </svg>
            </button>
            <button type="button" (click)="setAlign('right')" title="Direita"
              class="flex-1 aspect-square max-h-12 rounded-xl border flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-800 border-slate-700 bg-slate-950"
              [class.border-indigo-400]="align() === 'right'"
              [class.bg-indigo-500]="align() === 'right'"
              [class.bg-opacity-20]="align() === 'right'">
              <svg class="w-5 h-5 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-width="2" stroke-linecap="round" d="M4 6h16M8 10h12M4 14h16M10 18h10"/>
              </svg>
            </button>
          </div>

          <div class="h-px bg-slate-700/80 mx-1 mb-4"></div>

          <label class="block text-[11px] text-slate-400 mb-1">Modo de leitura</label>
          <select class="w-full mb-2 bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-200"
            [ngModel]="scrollingMode()" (ngModelChange)="setScrollingMode($event)">
            <option [ngValue]="BookScrollingMode.Pagination">Horizontal (Esquerda para direita)</option>
            <option [ngValue]="BookScrollingMode.PaginationRtl">Horizontal (Direita para esquerda)</option>
            <option [ngValue]="BookScrollingMode.PaginationVertical">Vertical</option>
            <option [ngValue]="BookScrollingMode.Continuous">Tira contínua</option>
          </select>

          <label class="block text-[11px] text-slate-400 mb-1">Layout de página</label>
          <select class="w-full mb-2 bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-200"
            [ngModel]="bookLayout()" (ngModelChange)="setBookLayout($event)"
            [disabled]="isContinuousScrollMode()">
            <option [ngValue]="BookLayout.SINGLE_PAGE">Página única</option>
            <option [ngValue]="BookLayout.DOUBLE_PAGE">Página dupla</option>
          </select>

          <label class="block text-[11px] text-slate-400 mb-1">Animação de transição de página</label>
          <select class="w-full mb-2 bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-200"
            [ngModel]="pageTransition()" (ngModelChange)="setPageTransition($event)"
            [disabled]="isContinuousScrollMode()">
            @for (opt of pageTransitionOptions; track opt) {
              <option [ngValue]="opt">{{ pageTransitionLabels[opt] }}</option>
            }
          </select>

          <label class="block text-[11px] text-slate-400 mb-1">Tamanho da página virtual</label>
          <select class="w-full mb-2 bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-200"
            [ngModel]="bookPageSize()" (ngModelChange)="setBookPageSize($event)"
            [disabled]="isContinuousScrollMode()">
            @for (opt of bookPageSizeOptions; track opt) {
              <option [ngValue]="opt">{{ bookPageSizeLabels[opt] }}</option>
            }
          </select>

          @if (isJapaneseBook()) {
            <div class="h-px bg-slate-700/80 mx-1 my-4"></div>
            <label class="flex items-center justify-between text-[11px] text-slate-300 cursor-pointer gap-3">
              <span class="min-w-0">
                <span class="block">Tate-gaki (texto vertical)</span>
                <span class="block text-[10px] text-slate-500 font-normal mt-0.5">
                  CSS writing-mode; funciona com furigana
                </span>
              </span>
              <input type="checkbox" class="w-4 h-4 accent-indigo-600 rounded shrink-0"
                [ngModel]="settings.bookFontJapaneseStyle()"
                (ngModelChange)="setTateGaki($event)" />
            </label>
          }
        </aside>
      }

      <!-- Adjacent file switch confirmation -->
      @if (switchConfirm(); as conf) {
        <div class="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          (click)="cancelSwitchFile()">
          <div class="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5"
            (click)="$event.stopPropagation()">
            <h2 class="text-sm font-semibold text-slate-100 mb-2">{{ conf.title }}</h2>
            <p class="text-xs text-slate-400 mb-1">Abrir:</p>
            <p class="text-sm text-slate-200 font-medium break-all mb-5">{{ conf.fileName }}</p>
            <div class="flex justify-end gap-2">
              <button type="button" (click)="cancelSwitchFile()"
                class="px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer">
                Cancelar
              </button>
              <button type="button" (click)="confirmSwitchFile()"
                class="px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer">
                Abrir
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Search overlay -->
      @if (showSearch()) {
        <div data-br-panel="search"
          class="absolute inset-0 z-[70] flex flex-col bg-slate-950/95 backdrop-blur-md"
          (click)="$event.stopPropagation()">
          <div class="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800 shrink-0">
            <button type="button" (click)="closeSearch()"
              class="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer" title="Fechar">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <input
              type="search"
              class="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              placeholder="Buscar no livro…"
              [ngModel]="searchQuery()"
              (ngModelChange)="onSearchQueryChange($event)"
              (keydown.enter)="submitSearch()"
              autofocus />
            @if (searching()) {
              <button type="button" (click)="stopSearch()"
                class="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-600/90 hover:bg-rose-500 text-white cursor-pointer"
                title="Parar">
                Parar
              </button>
            } @else {
              <button type="button" (click)="submitSearch()"
                class="px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer disabled:opacity-40"
                [disabled]="!searchQuery().trim()"
                title="Buscar">
                Buscar
              </button>
            }
          </div>

          <div class="flex-1 overflow-y-auto px-3 py-3">
            @if (searchError()) {
              <p class="text-xs text-rose-300 mb-3">{{ searchError() }}</p>
            }

            @if (searching() || searchRan()) {
              @if (searching() && searchResults().length === 0) {
                <p class="text-xs text-slate-400 py-6 text-center">Buscando…</p>
              } @else if (!searching() && searchResults().length === 0) {
                <p class="text-xs text-slate-500 py-8 text-center">Nenhum resultado</p>
              } @else {
                <div class="flex flex-col">
                  @for (item of searchResults(); track searchResultTrack(item, $index)) {
                    @if (item.kind === 'chapter') {
                      <p class="sticky top-0 z-[1] text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-slate-950/95 py-2 mt-1 first:mt-0 border-b border-slate-800">
                        {{ item.title }}
                      </p>
                    } @else {
                      <button type="button" (click)="goToSearchHit(item)"
                        class="text-left w-full px-2 py-3 border-b border-slate-800/80 hover:bg-slate-900 cursor-pointer group">
                        <p class="text-sm text-slate-200 leading-snug group-hover:text-white"
                          [innerHTML]="safeSearchHtml(item.excerptHtml)"></p>
                        <p class="text-[11px] text-slate-500 mt-1.5">Página {{ item.page + 1 }}</p>
                      </button>
                    }
                  }
                </div>
              }
            } @else {
              <div class="flex items-center justify-between mb-2">
                <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Histórico</p>
                @if (searchHistory().length) {
                  <button type="button" (click)="clearSearchHistory()"
                    class="text-[11px] text-slate-400 hover:text-rose-300 cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-900">
                    Limpar
                  </button>
                }
              </div>
              @if (searchHistory().length === 0) {
                <p class="text-xs text-slate-500 py-8 text-center">Nenhuma busca recente</p>
              } @else {
                <div class="flex flex-col gap-0.5">
                  @for (h of searchHistory(); track h.id ?? h.search) {
                    <div class="flex items-center gap-1 rounded-xl hover:bg-slate-900 group">
                      <button type="button" (click)="runHistorySearch(h.search)"
                        class="flex-1 min-w-0 text-left px-3 py-2.5 cursor-pointer">
                        <p class="text-sm text-slate-200 truncate">{{ h.search }}</p>
                        @if (h.date) {
                          <p class="text-[10px] text-slate-500 mt-0.5">{{ formatSearchDate(h.date) }}</p>
                        }
                      </button>
                      <button type="button" (click)="deleteSearchHistoryItem(h, $event)"
                        class="p-2 mr-1 text-slate-500 hover:text-rose-300 opacity-0 group-hover:opacity-100 cursor-pointer rounded-lg"
                        title="Remover">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  }
                </div>
              }
            }
          </div>
        </div>
      }

      @if (showAnnotations()) {
        <app-annotation-list-overlay
          [annotations]="annotations()"
          [bookId]="bookId"
          [bookTitle]="title()"
          (close)="closeAnnotations()"
          (open)="onAnnotationListOpen($event)"
          (toggleFavorite)="onAnnotationListFavorite($event)"
          (changeColor)="onAnnotationListColor($event)"
          (remove)="onAnnotationListRemove($event)"
          (save)="onAnnotationListSave($event)" />
      }

      <app-reader-touch-overlay
        [open]="showTouchDemo()"
        type="book"
        (dismiss)="showTouchDemo.set(false)" />

      <app-reader-touch-config
        [open]="showTouchConfig()"
        type="book"
        [coverUrl]="coverUrl()"
        (close)="showTouchConfig.set(false)" />

      @if (stubToast()) {
        <div class="absolute bottom-24 left-1/2 -translate-x-1/2 z-[65] px-3 py-1.5 rounded-lg bg-slate-800/95 border border-slate-600 text-[11px] text-slate-200 pointer-events-none">
          {{ stubToast() }}
        </div>
      }

      @if (vocabDetail(); as d) {
        <app-vocabulary-detail-dialog
          [item]="d"
          (close)="vocabDetail.set(null)"
          (openKanji)="vocabKanji.set($event)" />
      }
      @if (vocabKanji(); as k) {
        <app-kanjax-detail-dialog [item]="k" (close)="vocabKanji.set(null)" />
      }

      @if (showAssistant()) {
        <app-reading-assistant-panel
          type="BOOK"
          [referenceId]="bookId"
          [title]="title()"
          [items]="assistantItems()"
          [currentPage]="currentPage()"
          [pageCount]="pageCount()"
          [maxContextChars]="assistantMaxContext()"
          [preloadSystem]="assistantPreload()"
          (close)="showAssistant.set(false)"
          (openSummary)="prepareAssistantSummary()" />
      }
      @if (showAssistantSummary()) {
        <app-reading-summary-dialog
          type="BOOK"
          [referenceId]="bookId"
          [title]="title()"
          [items]="assistantItems()"
          [selectedIds]="assistantSelectedForSummary()"
          [maxContextChars]="assistantMaxContext()"
          (close)="showAssistantSummary.set(false)"
          (openInChat)="onAssistantSummaryToChat($event)" />
      }

      <app-text-select-popup
        [visible]="textSelectVisible()"
        [left]="textSelectPos().left"
        [top]="textSelectPos().top"
        (color)="onTextSelectColor($event)"
        (erase)="onTextSelectErase()"
        (copy)="onTextSelectCopy()"
        (selectAll)="onTextSelectAll()"
        (search)="onTextSelectSearch()"
        (translate)="onTextSelectTranslate()"
        (vocabulary)="onTextSelectVocabulary()"
        (tts)="onTextSelectTts()"
        (dismiss)="dismissTextSelect()" />

      <app-book-tts-bar
        [visible]="ttsActive()"
        [status]="ttsStatus()"
        [canPrev]="ttsCanPrev()"
        [canNext]="ttsCanNext()"
        [error]="ttsError()"
        (config)="showTtsPopup.set(true)"
        (previous)="ttsPrevious()"
        (next)="ttsNext()"
        (togglePlay)="ttsTogglePlay()"
        (stop)="stopTts()"
        (close)="stopTts()" />

      <app-book-tts-popup
        [open]="showTtsPopup()"
        [voice]="ttsVoice()"
        [speed]="ttsSpeed()"
        [japaneseBook]="isJapaneseBook()"
        (dismiss)="showTtsPopup.set(false)"
        (apply)="onTtsConfigApply($event)" />

      @if (editingAnnotation(); as draft) {
        <app-annotation-popup
          [annotation]="draft"
          (save)="onAnnotationSave($event)"
          (delete)="onAnnotationDelete()"
          (cancel)="onAnnotationCancel()" />
      }
      <app-tracker-simple-dialog
        [open]="showTrackerSimple()"
        [libraryId]="book()?.fkLibrary || 0"
        [mediaTitle]="book()?.title || ''"
        [mediaFilename]="book()?.name || ''"
        (confirmed)="showTrackerSimple.set(false)"
        (cancel)="showTrackerSimple.set(false)"
        (openFullConfig)="onOpenFullConfigFromSimple($event)" />

      <app-tracker-config-dialog
        [open]="showTrackerConfig()"
        [track]="selectedTrackForConfig()"
        [fkLibrary]="book()?.fkLibrary || 0"
        [initialTitle]="book()?.title || book()?.series || ''"
        [initialFilename]="book()?.name || ''"
        (saved)="showTrackerConfig.set(false); showTrackerSimple.set(true)"
        (deleted)="showTrackerConfig.set(false)"
        (cancel)="showTrackerConfig.set(false)" />

      <!-- Last Page Thumbnail (Floating Return History) -->
      @if (displayedLastPage(); as lastPage) {
        <div
          class="absolute bottom-24 sm:bottom-28 z-40 last-page-card"
          [class.left-6]="renderedLastPageIsLeft()"
          [class.right-6]="!renderedLastPageIsLeft()"
          [class.is-left]="renderedLastPageIsLeft()"
          [class.is-right]="!renderedLastPageIsLeft()"
          [class.is-hidden]="lastPageAnimState() === 'hidden'"
          [class.is-entering]="lastPageAnimState() === 'entering'"
          [class.is-visible]="lastPageAnimState() === 'visible'"
          [class.is-exiting]="lastPageAnimState() === 'exiting'">
          <div
            (click)="onLastPageClick()"
            class="relative group flex flex-col items-center p-2 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700/80 shadow-[0_12px_36px_rgba(15,23,42,0.8),0_0_20px_rgba(99,102,241,0.15)] hover:border-indigo-500/90 hover:shadow-[0_16px_40px_rgba(99,102,241,0.3)] hover:scale-105 transition-all duration-300 cursor-pointer max-w-[7.5rem] sm:max-w-[8.5rem]"
            [title]="'Retornar para a página ' + (lastPage.page + 1)">
            
            <button
              type="button"
              (click)="dismissLastPage($event)"
              class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 border border-slate-600 text-slate-300 hover:text-white hover:bg-rose-600 hover:border-rose-500 flex items-center justify-center text-xs shadow-md transition-all z-10 cursor-pointer"
              title="Fechar">
              ✕
            </button>

            @if (lastPage.thumbUrl) {
              <div
                class="w-20 sm:w-24 aspect-[3/4] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner relative"
                [class.animate-thumb-pop]="thumbUpdated()">
                <img
                  [src]="lastPage.thumbUrl"
                  [alt]="'Página ' + (lastPage.page + 1)"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
              </div>
            } @else {
              <div
                class="w-20 sm:w-24 aspect-[3/4] rounded-xl flex flex-col items-center justify-center bg-slate-950 border border-slate-800 text-slate-400 p-2 text-center shadow-inner group-hover:border-indigo-500/40 transition-colors"
                [class.animate-thumb-pop]="thumbUpdated()">
                <svg class="w-6 h-6 mb-1 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span class="text-[9px] line-clamp-2 text-slate-300 font-medium leading-tight">
                  {{ lastPage.chapter || 'Página' }}
                </span>
              </div>
            }

            <div class="mt-1.5 flex items-center gap-1 text-indigo-300 group-hover:text-indigo-200">
              <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <span class="text-[11px] font-bold tabular-nums">Pág. {{ lastPage.page + 1 }}</span>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class ReaderTextComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('viewer') viewerRef?: ElementRef<HTMLElement>;
  @ViewChild('viewerHost') viewerHostRef?: ElementRef<HTMLElement>;
  @ViewChild('viewerPeek') viewerPeekRef?: ElementRef<HTMLElement>;
  @ViewChild('viewerShell') viewerShellRef?: ElementRef<HTMLElement>;
  @ViewChild('peekShell') peekShellRef?: ElementRef<HTMLElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private electron = inject(ElectronService);
  private nav = inject(NavigationStackService);
  settings = inject(SettingsService);
  private touchZones = inject(TouchZoneService);
  private sanitizer = inject(DomSanitizer);
  private bookUnlock = inject(BookUnlockService);
  private ngZone = inject(NgZone);
  private elementRef = inject(ElementRef);

  BookScrollingMode = BookScrollingMode;
  Math = Math;
  readonly pageBg = PAGE_BG;

  bookId = Number(this.route.snapshot.paramMap.get('id'));
  book = signal<Book | null>(null);
  title = signal('Leitor de Livro');
  author = signal('');
  chapterTitle = signal('');
  pageCount = signal(0);
  currentPage = signal(0);
  currentCfi = signal('');
  displayedSeekPage = signal<number>(0);
  private isScrubbingSeek = false;
  private scrubOriginPage: number | null = null;
  lastPages = signal<{ page: number; chapter?: string; thumbUrl?: string }[]>([]);
  displayedLastPage = signal<{ page: number; chapter?: string; thumbUrl?: string } | null>(null);
  lastPageAnimState = signal<'hidden' | 'entering' | 'visible' | 'exiting'>('hidden');
  renderedLastPageIsLeft = signal<boolean>(true);
  thumbUpdated = signal<boolean>(false);
  private lastPageTransitionTimer: ReturnType<typeof setTimeout> | null = null;
  private thumbUpdateTimer: ReturnType<typeof setTimeout> | null = null;
  readonly lastPageDots = computed(() => {
    const max = Math.max(1, this.pageCount() - 1);
    return this.lastPages().map(lp => ({
      page: lp.page,
      percent: Math.min(100, Math.max(0, (lp.page / max) * 100))
    }));
  });
  readonly lastPageItem = computed(() => this.lastPages()[0] ?? null);
  readonly lastPageIsLeft = computed(() => {
    const first = this.lastPageItem();
    if (!first) return true;
    return first.page < this.currentPage();
  });
  favorite = signal(false);
  loading = signal(true);
  loadingMessage = signal('Abrindo arquivo…');
  error = signal<string | null>(null);
  unlockRequired = signal(false);
  unlockError = signal<string | null>(null);
  unlockAttempt = '';
  private pendingBookPassword = '';
  chromeVisible = signal(false);
  isFullscreen = signal(false);
  showToc = signal(false);
  showTypography = signal(false);
  showSearch = signal(false);
  showAnnotations = signal(false);
  searchQuery = signal('');
  searchHistory = signal<BookSearchHistory[]>([]);
  searchResults = signal<BookSearchListItem[]>([]);
  searching = signal(false);
  searchRan = signal(false);
  searchError = signal<string | null>(null);
  toc = signal<TocEntry[]>([]);
  autoScale = signal(1);
  zoom = signal(1);
  readonly effectiveZoom = computed(() => Math.round(this.autoScale() * this.zoom() * 100) / 100);
  panning = signal(false);
  showTouchDemo = signal(false);
  showTouchConfig = signal(false);
  touchMenuOpen = signal(false);
  showTrackerSimple = signal(false);
  showTrackerConfig = signal(false);
  selectedTrackForConfig = signal<Track | null>(null);
  stubToast = signal<string | null>(null);
  vocabDetail = signal<Vocabulary | null>(null);
  vocabKanji = signal<Kanjax | null>(null);
  showAssistant = signal(false);
  showAssistantSummary = signal(false);
  assistantItems = signal<AssistantContextItem[]>([]);
  assistantPreload = signal<string | null>(null);
  assistantMaxContext = signal(12000);
  assistantSelectedForSummary = signal<string[]>([]);
  coverUrl = signal<string | null>(null);
  adjacentPrev = signal<Book | null>(null);
  adjacentNext = signal<Book | null>(null);
  switchConfirm = signal<{ direction: 'prev' | 'next'; book: Book; title: string; fileName: string } | null>(null);
  annotations = signal<BookAnnotation[]>([]);
  readonly marked = computed(() =>
    this.annotations().some(
      a => (a.markType || '') === 'PageMark' && a.page === this.currentPage()
    )
  );
  editingAnnotation = signal<BookAnnotation | null>(null);
  textSelectVisible = signal(false);
  textSelectPos = signal<TextSelectPos>({ left: 0, top: 0 });
  pendingSelection = signal<BookAnnotation | null>(null);

  ttsActive = signal(false);
  ttsStatus = signal<AudioStatus>(AudioStatus.STOP);
  ttsError = signal<string | null>(null);
  ttsVoice = signal<TextSpeech>(textSpeechDefault(false));
  ttsSpeed = signal(0);
  showTtsPopup = signal(false);
  ttsCanPrev = computed(() => this.ttsActive() && (this.ttsLineIndex > 0 || this.currentPage() > 0));
  ttsCanNext = computed(() => this.ttsActive());

  scrollingMode = signal<BookScrollingMode>(this.settings.bookScrollingMode());
  bookLayout = signal<BookLayout>(BookLayout.SINGLE_PAGE);
  pageTransition = signal<PageTransitionType>(this.settings.bookPageTransition());
  pageTransitionOptions = PAGE_TRANSITION_OPTIONS;
  pageTransitionLabels = PAGE_TRANSITION_LABELS_PT;
  bookPageSize = signal<BookPageSize>(this.settings.bookPageSize());
  bookPageSizeOptions = Object.values(BookPageSize);
  bookPageSizeLabels = BOOK_PAGE_SIZE_LABELS;
  BookLayout = BookLayout;
  fontSize = signal<number>(this.settings.bookFontSize());
  fontFamily = signal<string>(this.settings.bookFontFamily());
  align = signal<BookAlign>(this.settings.bookAlign());
  margin = signal<BookMarginSize>(this.settings.bookMargin());
  spacing = signal<BookSpacingSize>(this.settings.bookSpacing());

  private readerSessionId: string | null = null;
  private historySessionId: number | null = null;
  private historyUsedTts = false;
  private updateTimer: ReturnType<typeof setTimeout> | null = null;
  private configTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private typographyTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private turningPage = false;
  /** Signal mirror of turningPage so transform bindings can suspend during WAAPI. */
  readonly turningSignal = signal(false);
  /** Interactive drag is feeding PageTurnDriver (suppress Angular transforms). */
  readonly driverActive = signal(false);
  private readonly MAX_SNAPSHOT_CACHE = 20;
  private lastObservedW = 0;
  private lastObservedH = 0;
  private lastReflowWidth = 0;
  private lastReflowHeight = 0;
  private lastReflowScale = 0;
  private turnDriver: PageTurnDriver | null = null;
  private turnDriverDir: 1 | -1 = 1;
  private ended = false;
  private bookMeta: Book | null = null;
  private epubBook: EpubBook | null = null;
  private rendition: Rendition | null = null;
  private ttsLines: TtsSentence[] = [];
  private ttsLineIndex = 0;
  private ttsAudio: HTMLAudioElement | null = null;
  private ttsHighlightCfi: string | null = null;
  private ttsPlayToken = 0;
  /** Second rendition for adjacent-page peek during overscroll (same EpubBook). */
  private peekRendition: Rendition | null = null;
  /** 1 = next page, -1 = previous page, 0 = none. */
  private peekDirection: 1 | -1 | 0 = 0;
  private peekStale = true;
  private peekLoadToken = 0;
  private peekPreloadTimer: ReturnType<typeof setTimeout> | number | null = null;
  /** Serialize interactive drag driver setup (avoid peekLoadToken thrash on every move). */
  private dragDriverPromise: Promise<boolean> | null = null;
  private dragDriverPendingDir: 1 | -1 | 0 = 0;
  /** Captured front/under bitmaps for manga-style book curl. */
  private bookCurlBitmaps: BookCurlBitmaps | null = null;
  private bookCurlCanvas: HTMLCanvasElement | null = null;
  /** True while drag is scrubbing manga-style canvas curl. */
  private bookCurlDragActive = false;
  /** Tracks sequential page navigation (+1 for next, -1 for prev) to guarantee continuity. */
  private sequentialNavDirection: 1 | -1 | 0 = 0;
  /** True while curl animation / drag is active to prevent reflow, resize and repaint jitter. */
  private curlAnimating = false;
  /** Background cache of pre-rendered page bitmaps (location index -> ImageBitmap). */
  private pageBitmapCache = new Map<
    string,
    { bitmap: ImageBitmap; width: number; height: number; timestamp: number }
  >();
  private backgroundPreloadBusy = false;
  private bitmapPreloadToken = 0;
  private bitmapPreloadPromise: Promise<void> | null = null;
  private bitmapScheduleTimer: ReturnType<typeof setTimeout> | null = null;
  /** EPUB URL for the open book (local-book://) — offscreen capture. */
  private epubUrl: string | null = null;
  private viewReady = false;
  private pendingOpen: { epubUrl: string; bookMark: number; bookMarkCfi: string } | null = null;
  private relocating = false;
  private wheelAccum = 0;
  private didDrag = false;
  private panPointerId: number | null = null;
  private panStartX = 0;
  private panStartY = 0;
  private panStartTime = 0;
  private panLastX = 0;
  private panLastY = 0;
  private panLastClientY = 0;
  private panLastMoveAt = 0;
  private panVelocityX = 0;
  private panVelocityY = 0;
  /** When true, this pointer gesture is text selection — skip pan/overscroll. */
  private panSelectMode = false;
  /** Accumulated overscroll while dragging past page edge (paginated), 1:1 with pointer. */
  private overscrollX = 0;
  private overscrollY = 0;
  private panGlobalCleanup: (() => void) | null = null;
  private contentCleanups: Array<() => void> = [];
  private pendingSelectContents: any | null = null;
  private pendingSelectShow: PendingSelectShow | null = null;
  private textSelectPageAtOpen = -1;
  private clickTimer: ReturnType<typeof setTimeout> | null = null;
  private searchAbort: AbortController | null = null;
  private searchHighlightCfi: string | null = null;
  private searchHighlightTimer: ReturnType<typeof setTimeout> | null = null;
  /** Skip clearing search highlight for the next N relocated events after jump. */
  private searchHighlightIgnoreRelocate = 0;
  private stubToastTimer: ReturnType<typeof setTimeout> | null = null;
  /** Last tap timestamp for click/touchend dedupe. */
  private lastTapAt = 0;
  private lastTapSource: 'click' | 'touch' | 'pointer' | null = null;
  /** After Home/open to start, ignore relocated until CFI stabilizes. */
  private forceStartPageUntil = 0;

  /** Signals driving rubber-band transform (kept separate from private fields for template). */
  private overscrollXSignal = signal(0);
  private overscrollYSignal = signal(0);
  private overscrollAnimatingSignal = signal(false);
  /** Host size for ViewPager peek offset (updated while overscrolling). */
  private peekViewportW = signal(0);
  private peekViewportH = signal(0);
  /** Peek layer visible during overscroll (no opacity fade). */
  peekLayerActive = signal(false);

  readonly progressPercent = computed(() => {
    const total = this.pageCount();
    if (total <= 0) return 0;
    return Math.min(100, Math.round(((this.currentPage() + 1) / total) * 100));
  });

  /** Marker position on full-width track (0–100). */
  readonly progressMarkerPercent = computed(() => {
    const total = this.pageCount();
    if (total <= 1) return 0;
    return Math.min(100, Math.max(0, (this.currentPage() / (total - 1)) * 100));
  });

  readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));

  readonly isRtl = computed(() => this.scrollingMode() === BookScrollingMode.PaginationRtl);

  /** Left/right page keys behave like RTL when RTL mode or tate-gaki is on. */
  usesRtlPageKeys(): boolean {
    return this.isRtl() || this.tateGakiEnabled();
  }

  readonly isHorizontalMode = computed(() => {
    const m = this.scrollingMode();
    return m === BookScrollingMode.Pagination || m === BookScrollingMode.PaginationRtl;
  });

  /** Paginated modes (H LTR/RTL + Vertical) — wheel/keys turn pages with threshold. */
  readonly isPaginatedMode = computed(() => {
    const m = this.scrollingMode();
    return (
      m === BookScrollingMode.Pagination ||
      m === BookScrollingMode.PaginationRtl ||
      m === BookScrollingMode.PaginationVertical
    );
  });

  /** Wheel page-turn for all paginated modes including Vertical. */
  readonly isPaginatedWheelMode = computed(() => this.isPaginatedMode());

  /** Tira contínua only — not Vertical. */
  readonly isContinuousScrollMode = computed(
    () => this.scrollingMode() === BookScrollingMode.Continuous
  );

  readonly viewerTransform = computed(() => {
    if (this.turningSignal() || this.driverActive()) return null;
    // Curl: overscroll is progress only — never translate the live iframe
    if (this.isCurlOverscrollMode()) return 'none';
    const x = this.overscrollXSignal();
    const y = this.overscrollYSignal();
    if (x === 0 && y === 0) return 'none';
    return `translate(${x}px, ${y}px)`;
  });

  /** Adjacent page offset (ViewPager): enters from the edge, slides with current. */
  readonly peekTransform = computed(() => {
    if (this.turningSignal() || this.driverActive()) return null;
    // Curl: keep peek parked off-screen; canvas owns the wave
    if (this.isCurlOverscrollMode()) {
      const w = this.peekViewportW() || window.innerWidth;
      if (this.peekLayerActive()) {
        const parkedDir = this.peekDirection || 1;
        const side = this.usesRtlPageKeys() ? -parkedDir : parkedDir;
        return `translate(${side * w}px, 0)`;
      }
      return 'none';
    }
    const x = this.overscrollXSignal();
    const y = this.overscrollYSignal();

    if (this.isHorizontalMode()) {
      const w = this.peekViewportW() || window.innerWidth;
      if (x === 0) {
        // Keep peek parked OFF-SCREEN while active to avoid text overlap flash
        if (this.peekLayerActive()) {
          const parkedDir = this.peekDirection || 1;
          const side = this.usesRtlPageKeys() ? -parkedDir : parkedDir;
          return `translate(${side * w}px, 0)`;
        }
        return 'none';
      }
      // LTR next (x<0): +w; LTR prev (x>0): -w; RTL inverts
      const dir = this.usesRtlPageKeys() ? (x > 0 ? 1 : -1) : (x < 0 ? 1 : -1);
      const side = this.usesRtlPageKeys() ? -dir : dir;
      return `translate(${x + side * w}px, 0)`;
    }

    const h = this.peekViewportH() || window.innerHeight;
    if (y === 0) {
      if (this.peekLayerActive()) {
        const parkedDir = this.peekDirection || 1;
        return `translate(0, ${parkedDir * h}px)`;
      }
      return 'none';
    }
    const dir = y < 0 ? 1 : -1;
    return `translate(0, ${y + dir * h}px)`;
  });

  readonly viewerTransition = computed(() => {
    if (this.turningSignal() || this.driverActive()) return null;
    return this.overscrollAnimatingSignal() ? 'transform 180ms ease-out' : 'none';
  });

  constructor() {
    effect(() => {
      const visible = this.chromeVisible();
      untracked(() => {
        if (!visible) {
          this.updateLastPageUi(null, this.renderedLastPageIsLeft());
        } else {
          const item = this.lastPages()[0] ?? null;
          if (item) {
            const isLeft = item.page < this.currentPage();
            this.updateLastPageUi(item, isLeft);
          }
        }
      });
    });
  }

  ngOnInit(): void {
    document.addEventListener('fullscreenchange', this.onFsChange);
    window.addEventListener('wheel', this.onWindowWheel, { passive: false });
    void this.openReader();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.setupViewerResizeObserver();
    if (this.pendingOpen) {
      const pending = this.pendingOpen;
      this.pendingOpen = null;
      void this.mountEpub(pending.epubUrl, pending.bookMark, pending.bookMarkCfi);
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('fullscreenchange', this.onFsChange);
    window.removeEventListener('wheel', this.onWindowWheel);
    this.teardownViewerResizeObserver();
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    if (this.typographyTimer) clearTimeout(this.typographyTimer);
    if (this.clickTimer) clearTimeout(this.clickTimer);
    if (this.stubToastTimer) clearTimeout(this.stubToastTimer);
    if (this.lastPageTransitionTimer) clearTimeout(this.lastPageTransitionTimer);
    if (this.thumbUpdateTimer) clearTimeout(this.thumbUpdateTimer);
    this.cancelAdjacentPeekPreload();
    void this.cleanup();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (this.loading() || this.error()) return;
    if (this.editingAnnotation()) return;
    if (ev.key === 'Escape' && this.textSelectVisible()) {
      ev.preventDefault();
      this.dismissTextSelect();
      return;
    }
    if (ev.key === 'Escape' && this.showAnnotations()) {
      ev.preventDefault();
      this.closeAnnotations();
      return;
    }
    if (this.textSelectVisible() || this.showAnnotations()) return;
    const target = ev.target as HTMLElement | null;
    const inFormField =
      !!target &&
      (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA');
    if (inFormField) {
      if (ev.key === 'Escape' && this.showSearch()) {
        if (this.searching()) this.stopSearch();
        else this.closeSearch();
      }
      return;
    }
    const key = ev.key;
    const paginated = this.isPaginatedMode();
    const continuous = this.isContinuousScrollMode();
    const isPageNavKey =
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'PageUp' ||
      key === 'PageDown' ||
      key === ' ';

    // Drop page-nav while a turn animation owns the viewport (avoids skip of 5–7 pages).
    if (isPageNavKey && this.isBookTurnBusy()) {
      ev.preventDefault();
      return;
    }

    if (key === 'ArrowLeft') {
      if (!paginated) return;
      ev.preventDefault();
      this.usesRtlPageKeys() ? this.goNext() : this.goPrev();
    } else if (key === 'ArrowRight') {
      if (!paginated) return;
      ev.preventDefault();
      this.usesRtlPageKeys() ? this.goPrev() : this.goNext();
    } else if (key === 'ArrowUp') {
      if (paginated) {
        ev.preventDefault();
        this.goPrev();
      } else if (continuous) {
        ev.preventDefault();
        this.goPrev();
      }
    } else if (key === 'ArrowDown') {
      if (paginated) {
        ev.preventDefault();
        this.goNext();
      } else if (continuous) {
        ev.preventDefault();
        this.goNext();
      }
    } else if (key === 'PageUp') {
      ev.preventDefault();
      if (paginated) {
        this.usesRtlPageKeys() && this.isHorizontalMode() ? this.goNext() : this.goPrev();
      } else {
        this.goPrev();
      }
    } else if (key === 'PageDown' || key === ' ') {
      ev.preventDefault();
      if (paginated) {
        this.usesRtlPageKeys() && this.isHorizontalMode() ? this.goPrev() : this.goNext();
      } else {
        this.goNext();
      }
    } else if (key === 'Home') {
      ev.preventDefault();
      void this.goToFirstPage();
    } else if (key === 'End') {
      ev.preventDefault();
      void this.goToLastPage();
    } else if (key === 'Escape') {
      if (this.showSearch()) {
        if (this.searching()) {
          this.stopSearch();
        } else {
          this.closeSearch();
        }
      } else if (this.showTypography() || this.showToc()) {
        this.showTypography.set(false);
        this.showToc.set(false);
      } else if (!this.isBookTurnBusy()) {
        this.chromeVisible.update(v => !v);
      }
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

  chapterDotPercent(location: number): number {
    const max = Math.max(1, this.pageCount() - 1);
    const pct = (location / max) * 100;
    return Math.min(100, Math.max(0, pct));
  }

  /**
   * Tap zones from epub.js iframe events.
   * Prefer host-local coords (already mapped from iframe); otherwise treat as viewport coords.
   */
  handleReaderTap(clientX: number, clientY?: number, alreadyHostLocal = false): void {
    if (this.loading() || this.error()) return;
    if (this.isBookTurnBusy()) return;
    if (this.editingAnnotation()) return;
    if (this.textSelectVisible()) {
      this.dismissTextSelect();
      return;
    }
    if (this.showTouchDemo() || this.showTouchConfig()) return;
    if (this.didDrag) {
      this.didDrag = false;
      return;
    }
    if (this.hasActiveTextSelection()) return;

    if (this.touchMenuOpen()) {
      this.touchMenuOpen.set(false);
      return;
    }
    if (this.showTypography() || this.showToc() || this.showSearch() || this.showAnnotations()) {
      this.showTypography.set(false);
      this.showToc.set(false);
      if (this.showSearch()) this.closeSearch();
      if (this.showAnnotations()) this.closeAnnotations();
      return;
    }
    const el = this.viewerHostRef?.nativeElement;
    if (!el) {
      this.chromeVisible.update(v => !v);
      return;
    }
    const rect = el.getBoundingClientRect();
    let localX: number;
    let localY: number;
    if (alreadyHostLocal) {
      localX = clientX;
      localY = typeof clientY === 'number' ? clientY : rect.height / 2;
    } else {
      localX = clientX - rect.left;
      localY = typeof clientY === 'number' ? clientY - rect.top : rect.height / 2;
    }
    // Clamp to visible host (never scrollHeight of iframe document)
    localX = Math.min(Math.max(0, localX), rect.width);
    localY = Math.min(Math.max(0, localY), rect.height);

    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
      this.clickTimer = null;
      this.setZoom(1);
      return;
    }

    this.clickTimer = setTimeout(() => {
      this.clickTimer = null;
      this.dispatchTouchTap(localX, localY, rect.width, rect.height);
    }, TOUCH_DOUBLE_CLICK_MS);
  }

  /** Ingest tap from click, touch, or pointer; ignore duplicates on the same gesture (Windows). */
  private ingestMappedTap(source: 'click' | 'touch' | 'pointer', mapped: { x: number; y: number }): void {
    const now = Date.now();
    if (
      this.lastTapAt &&
      now - this.lastTapAt < TAP_DEDUPE_MS
    ) {
      return;
    }
    this.lastTapSource = source;
    this.lastTapAt = now;
    this.handleReaderTap(mapped.x, mapped.y, true);
  }

  private dispatchTouchTap(localX: number, localY: number, width: number, height: number): void {
    const handlers: TouchActionHandlers = {
      showChrome: () => this.chromeVisible.set(true),
      hideChrome: () => {
        this.chromeVisible.set(false);
        this.showToc.set(false);
        this.showTypography.set(false);
        this.touchMenuOpen.set(false);
      },
      isChromeVisible: () => this.chromeVisible(),
      goPrevPage: () => this.goPrev(),
      goNextPage: () => this.goNext(),
      openChapters: () => {
        this.chromeVisible.set(true);
        this.showTypography.set(false);
        this.showToc.set(true);
      },
      markPage: () => void this.markPage(),
      previousFile: () => this.requestAdjacentFile('prev'),
      nextFile: () => this.requestAdjacentFile('next')
    };
    handleReaderTouchTap(this.touchZones, 'book', localX, localY, width, height, handlers);
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

  openTracker(): void {
    this.showToc.set(false);
    this.showTypography.set(false);
    this.showAnnotations.set(false);
    if (this.showSearch()) this.closeSearch();
    this.touchMenuOpen.set(false);
    this.showTrackerSimple.set(true);
  }

  onOpenFullConfigFromSimple(track: Track | null): void {
    this.showTrackerSimple.set(false);
    this.selectedTrackForConfig.set(track);
    this.showTrackerConfig.set(true);
  }

  private showStub(message: string): void {
    this.stubToast.set(message);
    if (this.stubToastTimer) clearTimeout(this.stubToastTimer);
    this.stubToastTimer = setTimeout(() => this.stubToast.set(null), 2000);
  }

  /** Ask to open previous/next book in the library (Android confirmSwitch). */
  requestAdjacentFile(direction: 'prev' | 'next'): void {
    if (this.switchConfirm()) return;
    const book = direction === 'prev' ? this.adjacentPrev() : this.adjacentNext();
    if (!book?.id) {
      this.showStub(direction === 'prev' ? 'Não há arquivo anterior' : 'Não há próximo arquivo');
      return;
    }
    this.switchConfirm.set({
      direction,
      book,
      title: direction === 'prev' ? 'Abrir arquivo anterior?' : 'Abrir próximo arquivo?',
      fileName: book.name || book.title || `Livro #${book.id}`
    });
  }

  cancelSwitchFile(): void {
    this.switchConfirm.set(null);
  }

  async confirmSwitchFile(): Promise<void> {
    const conf = this.switchConfirm();
    if (!conf?.book?.id) {
      this.switchConfirm.set(null);
      return;
    }
    const nextId = conf.book.id;
    this.switchConfirm.set(null);
    await this.cleanup();
    this.ended = false;
    this.bookId = nextId;
    await this.router.navigate(['/reader-text', nextId], { replaceUrl: true });
    await this.openReader();
  }

  private async loadAdjacentBooks(): Promise<void> {
    if (!this.bookId) {
      this.adjacentPrev.set(null);
      this.adjacentNext.set(null);
      return;
    }
    try {
      const adj = await this.electron.getAdjacentBooks(this.bookId);
      this.adjacentPrev.set(adj.prev);
      this.adjacentNext.set(adj.next);
    } catch (e) {
      console.warn('[reader-text] adjacent books failed', e);
      this.adjacentPrev.set(null);
      this.adjacentNext.set(null);
    }
  }

  private maybeShowFirstTouchDemo(): void {
    if (this.touchZones.isDemoShown('book')) return;
    this.touchZones.markDemoShown('book');
    setTimeout(() => this.showTouchDemo.set(true), 1400);
  }

  toggleToc(): void {
    this.chromeVisible.set(true);
    this.showTypography.set(false);
    this.showToc.update(v => !v);
  }

  toggleTypography(): void {
    this.chromeVisible.set(true);
    this.showToc.set(false);
    this.showTypography.update(v => !v);
  }

  async openSearch(): Promise<void> {
    this.showToc.set(false);
    this.showTypography.set(false);
    this.showSearch.set(true);
    this.searchError.set(null);
    if (!this.searchRan() && !this.searching()) {
      this.searchResults.set([]);
    }
    try {
      const history = await this.electron.listBookSearchHistory(this.bookId);
      this.searchHistory.set(history || []);
    } catch (e) {
      console.warn('[reader-text] search history failed', e);
      this.searchHistory.set([]);
    }
  }

  closeSearch(): void {
    this.stopSearch();
    this.showSearch.set(false);
    this.searchError.set(null);
  }

  openAnnotations(): void {
    this.showToc.set(false);
    this.showTypography.set(false);
    if (this.showSearch()) this.closeSearch();
    this.dismissTextSelect();
    this.showAnnotations.set(true);
  }

  closeAnnotations(): void {
    this.showAnnotations.set(false);
  }

  onAnnotationListOpen(item: AnnotationItem): void {
    this.closeAnnotations();
    if (item.cfiRange && this.rendition) {
      void this.rendition.display(item.cfiRange);
      return;
    }
    if (this.epubBook?.locations && this.rendition) {
      try {
        const cfi = this.epubBook.locations.cfiFromLocation(item.page);
        if (cfi) {
          void this.rendition.display(cfi);
          return;
        }
      } catch { /* fall through */ }
    }
  }

  async onAnnotationListFavorite(item: AnnotationItem): Promise<void> {
    const saved = await this.electron.saveBookAnnotation({
      ...item,
      favorite: !item.favorite,
      markType: item.markType || 'Annotation',
      fkBook: this.bookId
    });
    if (!saved) return;
    this.patchAnnotation(saved);
  }

  async onAnnotationListColor(ev: { item: AnnotationItem; color: string }): Promise<void> {
    const saved = await this.electron.saveBookAnnotation({
      ...ev.item,
      color: ev.color,
      markType: ev.item.markType || 'Annotation',
      fkBook: this.bookId
    });
    if (!saved) return;
    if (saved.cfiRange) {
      this.removeHighlight(saved.cfiRange);
      this.addHighlight(saved);
    }
    this.patchAnnotation(saved);
  }

  async onAnnotationListSave(item: AnnotationItem): Promise<void> {
    const previous = this.annotations().find(a => a.id === item.id);
    const saved = await this.electron.saveBookAnnotation({
      ...item,
      markType: item.markType || 'Annotation',
      fkBook: this.bookId
    });
    if (!saved) return;
    if (previous?.cfiRange && previous.cfiRange !== saved.cfiRange) {
      this.removeHighlight(previous.cfiRange);
    }
    if (saved.cfiRange) {
      this.removeHighlight(saved.cfiRange);
      this.addHighlight(saved);
    }
    this.patchAnnotation(saved);
  }

  async onAnnotationListRemove(item: AnnotationItem): Promise<void> {
    if (!item.id) return;
    const ok = await this.electron.deleteBookAnnotation(item.id);
    if (!ok) return;
    if (item.cfiRange) this.removeHighlight(item.cfiRange);
    this.annotations.update(list => list.filter(a => a.id !== item.id));
  }

  private patchAnnotation(saved: BookAnnotation): void {
    this.annotations.update(list => {
      const idx = list.findIndex(a => a.id === saved.id);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = saved;
        return next;
      }
      return [saved, ...list];
    });
  }

  onSearchQueryChange(value: string): void {
    this.searchQuery.set(value ?? '');
    if (!(value || '').trim()) {
      this.searchRan.set(false);
      this.searchResults.set([]);
      this.searchError.set(null);
    }
  }

  submitSearch(): void {
    void this.runSearch(this.searchQuery());
  }

  runHistorySearch(term: string): void {
    this.searchQuery.set(term);
    void this.runSearch(term);
  }

  stopSearch(): void {
    if (this.searchAbort) {
      this.searchAbort.abort();
      this.searchAbort = null;
    }
    this.searching.set(false);
  }

  async clearSearchHistory(): Promise<void> {
    try {
      await this.electron.deleteAllBookSearchHistory(this.bookId);
      this.searchHistory.set([]);
    } catch (e) {
      console.warn('[reader-text] clear search history failed', e);
    }
  }

  async deleteSearchHistoryItem(item: BookSearchHistory, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    if (!item.id) return;
    try {
      await this.electron.deleteBookSearchHistory(item.id);
      this.searchHistory.set(this.searchHistory().filter(h => h.id !== item.id));
    } catch (e) {
      console.warn('[reader-text] delete search history failed', e);
    }
  }

  searchResultTrack(item: BookSearchListItem, index: number): string {
    if (item.kind === 'chapter') return `ch-${item.chapterIndex}-${item.title}`;
    return `hit-${index}-${item.cfi}`;
  }

  safeSearchHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  formatSearchDate(iso: string): string {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  }

  async goToSearchHit(hit: Extract<BookSearchListItem, { kind: 'hit' }>): Promise<void> {
    if (!this.rendition || !hit?.cfi) return;
    this.closeSearch();
    this.chromeVisible.set(false);
    try {
      await this.rendition.display(hit.cfi);
    } catch (e) {
      console.warn('[reader-text] display search hit failed', e);
      return;
    }
    this.applyTemporarySearchHighlight(hit.cfi);
  }

  private async runSearch(rawQuery: string): Promise<void> {
    const query = (rawQuery || '').trim();
    if (!query || !this.epubBook) return;

    this.stopSearch();
    const abort = new AbortController();
    this.searchAbort = abort;
    this.searching.set(true);
    this.searchRan.set(true);
    this.searchError.set(null);
    this.searchResults.set([]);

    try {
      const saved = await this.electron.saveBookSearchHistory(this.bookId, query);
      if (saved) {
        const rest = this.searchHistory().filter(
          h => (h.search || '').toLowerCase() !== query.toLowerCase()
        );
        this.searchHistory.set([saved, ...rest]);
      }
    } catch (e) {
      console.warn('[reader-text] save search history failed', e);
    }

    try {
      await runBookSearch({
        book: this.epubBook,
        query,
        toc: this.toc(),
        signal: abort.signal,
        onProgress: items => {
          if (!abort.signal.aborted) this.searchResults.set(items);
        }
      });
    } catch (e) {
      if (!abort.signal.aborted) {
        console.warn('[reader-text] search failed', e);
        this.searchError.set('Falha na busca');
      }
    } finally {
      if (this.searchAbort === abort) this.searchAbort = null;
      this.searching.set(false);
    }
  }

  private applyTemporarySearchHighlight(cfi: string): void {
    this.clearTemporarySearchHighlight();
    if (!this.rendition || !cfi) return;
    try {
      this.rendition.annotations.highlight(
        cfi,
        { id: 'br-search-temp' },
        undefined,
        'br-search-hit',
        {
          fill: '#facc15',
          'fill-opacity': '0.45',
          'mix-blend-mode': 'multiply'
        }
      );
      this.searchHighlightCfi = cfi;
      this.searchHighlightIgnoreRelocate = 2;
      this.searchHighlightTimer = setTimeout(() => {
        this.clearTemporarySearchHighlight();
      }, 4000);
    } catch (e) {
      console.warn('[reader-text] search highlight failed', e);
    }
  }

  private clearTemporarySearchHighlight(): void {
    if (this.searchHighlightTimer) {
      clearTimeout(this.searchHighlightTimer);
      this.searchHighlightTimer = null;
    }
    this.searchHighlightIgnoreRelocate = 0;
    if (this.searchHighlightCfi && this.rendition) {
      try {
        this.rendition.annotations.remove(this.searchHighlightCfi, 'highlight');
      } catch { /* ignore */ }
    }
    this.searchHighlightCfi = null;
  }

  /** True while a page-turn animation or interactive driver owns the viewport. */
  private isBookTurnBusy(): boolean {
    return isBookNavLocked(this.turningPage, this.driverActive());
  }

  /** Navigate previous with continuous scroll or internal page scroll first. */
  goPrev(): void {
    if (this.isBookTurnBusy()) return;
    if (this.isAtBookStart()) return;
    if (this.isContinuousScrollMode()) {
      this.scrollContinuousBy(-1);
      return;
    }
    if (this.tryScrollContents(-1)) return;
    void this.turnWithEffect(-1);
  }

  /** Navigate next with continuous scroll or internal page scroll first. */
  goNext(): void {
    if (this.isBookTurnBusy()) return;
    if (this.isContinuousScrollMode()) {
      if (!this.scrollContinuousBy(1) && this.isAtBookEnd()) {
        this.requestAdjacentFile('next');
      }
      return;
    }
    if (this.tryScrollContents(1)) return;
    void this.turnWithEffect(1);
  }

  prevPage(): Promise<void> {
    if (!this.rendition) return Promise.resolve();
    if (this.isAtBookStart()) return Promise.resolve();
    this.sequentialNavDirection = -1;
    return Promise.resolve(this.rendition.prev()).then(() => undefined);
  }

  nextPage(): Promise<void> {
    if (!this.rendition) return Promise.resolve();
    if (this.isAtBookEnd()) {
      this.requestAdjacentFile('next');
      return Promise.resolve();
    }
    this.sequentialNavDirection = 1;
    return Promise.resolve(this.rendition.next()).then(() => undefined);
  }

  /**
   * Navigate one page and wait for relocated (or a short timeout) so the
   * animation layer can release its last frame over the new content.
   */
  private async turnPageAndSettle(dir: 1 | -1): Promise<void> {
    if (!this.rendition) return;
    const beforeCfi = this.currentCfi() || this.rendition.location?.start?.cfi || '';
    await new Promise<void>(resolve => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          this.rendition?.off?.('relocated', onRelocated);
        } catch {
          /* ignore */
        }
        resolve();
      };
      const onRelocated = (location: any) => {
        const cfi = location?.start?.cfi || '';
        if (!beforeCfi || cfi !== beforeCfi) done();
      };
      const timer = setTimeout(done, Math.max(120, PAGE_TURN_DURATION_MS));
      try {
        this.rendition?.on?.('relocated', onRelocated);
      } catch {
        /* ignore */
      }
      void (dir > 0 ? this.nextPage() : this.prevPage()).then(() => {
        // If next/prev resolved synchronously without relocated, still wait briefly
      });
    });
    this.didDrag = false;
  }

  /** True when EPUB location reports start or current page is 0 (or at the first spine item). */
  isAtBookStart(): boolean {
    if (this.currentPage() <= 0) return true;
    if (this.rendition?.location?.atStart) return true;
    const spineFirstHref = (this.epubBook as any)?.spine?.first?.()?.href?.split('#')[0];
    const currentHref = this.rendition?.location?.start?.href?.split('#')[0];
    if (
      (spineFirstHref && currentHref && (currentHref === spineFirstHref || currentHref.endsWith(spineFirstHref) || spineFirstHref.endsWith(currentHref))) ||
      (currentHref && /(cover|titlepage)\.x?html?$/i.test(currentHref))
    ) {
      return true;
    }
    return false;
  }

  /** True when EPUB location reports end or current page is the last location. */
  private isAtBookEnd(): boolean {
    if (this.rendition?.location?.atEnd) return true;
    const max = Math.max(0, this.pageCount() - 1);
    return this.currentPage() >= max;
  }

  zoomIn(): void {
    this.setZoom(this.zoom() + ZOOM_STEP_BUTTON);
  }

  zoomOut(): void {
    this.setZoom(this.zoom() - ZOOM_STEP_BUTTON);
  }

  private updateLastPageUi(newItem: { page: number; chapter?: string; thumbUrl?: string } | null, targetIsLeft: boolean): void {
    if (this.lastPageTransitionTimer) {
      clearTimeout(this.lastPageTransitionTimer);
      this.lastPageTransitionTimer = null;
    }

    if (!newItem || !this.chromeVisible() || this.isFullscreen()) {
      if (this.lastPageAnimState() === 'visible' || this.lastPageAnimState() === 'entering') {
        this.lastPageAnimState.set('exiting');
        this.lastPageTransitionTimer = setTimeout(() => {
          this.lastPageAnimState.set('hidden');
          this.displayedLastPage.set(null);
        }, 320);
      } else if (this.lastPageAnimState() !== 'exiting') {
        this.lastPageAnimState.set('hidden');
        this.displayedLastPage.set(null);
      }
      return;
    }

    const currentSide = this.renderedLastPageIsLeft();
    const isCurrentlyActive = this.lastPageAnimState() === 'visible' || this.lastPageAnimState() === 'entering';

    if (!isCurrentlyActive) {
      this.displayedLastPage.set(newItem);
      this.renderedLastPageIsLeft.set(targetIsLeft);
      this.lastPageAnimState.set('entering');
      this.lastPageTransitionTimer = setTimeout(() => {
        if (this.lastPageAnimState() === 'entering') {
          this.lastPageAnimState.set('visible');
        }
      }, 450);
      return;
    }

    if (currentSide !== targetIsLeft) {
      this.lastPageAnimState.set('exiting');
      this.lastPageTransitionTimer = setTimeout(() => {
        this.displayedLastPage.set(null);
        this.lastPageAnimState.set('hidden');
        requestAnimationFrame(() => {
          this.displayedLastPage.set(newItem);
          this.renderedLastPageIsLeft.set(targetIsLeft);
          this.lastPageAnimState.set('entering');
          this.lastPageTransitionTimer = setTimeout(() => {
            if (this.lastPageAnimState() === 'entering') {
              this.lastPageAnimState.set('visible');
            }
          }, 450);
        });
      }, 320);
    } else {
      this.displayedLastPage.set(newItem);
      this.triggerThumbUpdate();
    }
  }

  private triggerThumbUpdate(): void {
    if (this.thumbUpdateTimer) clearTimeout(this.thumbUpdateTimer);
    this.thumbUpdated.set(false);
    requestAnimationFrame(() => {
      this.thumbUpdated.set(true);
      this.thumbUpdateTimer = setTimeout(() => {
        this.thumbUpdated.set(false);
      }, 450);
    });
  }

  recordLastPage(page: number, targetPage?: number): void {
    if (page < 0 || (this.pageCount() > 0 && page >= this.pageCount())) return;
    const list = [...this.lastPages()];
    if (list.some(p => p.page === page)) return;
    if (list.length >= 3) {
      list.pop();
    }
    const newItem: { page: number; chapter?: string; thumbUrl?: string } = {
      page,
      chapter: this.chapterTitle() || undefined
    };
    list.unshift(newItem);
    this.lastPages.set(list);

    const dest = targetPage !== undefined ? targetPage : this.currentPage();
    const targetIsLeft = page < dest;
    this.updateLastPageUi(newItem, targetIsLeft);

    // Carrega/gera a miniatura de forma assíncrona
    void this.generateBookThumbnail(page).then(thumb => {
      if (!thumb) return;
      const updated = this.lastPages().map(lp => (lp.page === page ? { ...lp, thumbUrl: thumb } : lp));
      this.lastPages.set(updated);
      const cur = this.displayedLastPage();
      if (cur && cur.page === page) {
        this.displayedLastPage.set({ ...cur, thumbUrl: thumb });
        this.triggerThumbUpdate();
      }
    });
  }

  onLastPageClick(): void {
    const pages = [...this.lastPages()];
    if (pages.length === 0) return;
    const old = pages.shift()!;
    this.lastPages.set(pages);

    const nextItem = pages[0] ?? null;
    const targetIsLeft = nextItem ? nextItem.page < old.page : this.renderedLastPageIsLeft();
    this.updateLastPageUi(nextItem, targetIsLeft);

    this.seekTo(old.page, false);
  }

  dismissLastPage(ev: Event): void {
    ev.stopPropagation();
    const pages = [...this.lastPages()];
    pages.shift();
    this.lastPages.set(pages);

    const nextItem = pages[0] ?? null;
    const targetIsLeft = nextItem ? nextItem.page < this.currentPage() : this.renderedLastPageIsLeft();
    this.updateLastPageUi(nextItem, targetIsLeft);
  }

  onSeekStart(): void {
    if (this.scrubOriginPage === null) {
      this.scrubOriginPage = this.currentPage();
    }
    this.isScrubbingSeek = true;
  }

  onSeekInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const target = Number(input.value);
    this.displayedSeekPage.set(target);
    if (this.scrubOriginPage === null) {
      this.scrubOriginPage = this.currentPage();
    }
    this.isScrubbingSeek = true;

    // Atualiza lado do card em tempo real enquanto arrasta para frente e para trás
    const active = this.displayedLastPage();
    if (active) {
      const isLeft = active.page < target;
      if (isLeft !== this.renderedLastPageIsLeft()) {
        this.updateLastPageUi(active, isLeft);
      }
    }
  }

  onSeekCommit(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const target = Number(input.value);
    const origin = this.scrubOriginPage !== null ? this.scrubOriginPage : this.currentPage();
    this.scrubOriginPage = null;
    this.isScrubbingSeek = false;
    this.displayedSeekPage.set(target);

    if (target !== origin) {
      this.recordLastPage(origin, target);
    }
    this.seekTo(target, false);
  }

  seekTo(page: number, recordHistory = false): void {
    if (!this.epubBook) return;
    const max = Math.max(0, this.pageCount() - 1);
    const next = Math.min(Math.max(0, Number(page) || 0), max);
    const from = this.currentPage();
    if (recordHistory && next !== from) {
      this.recordLastPage(from, next);
    }
    this.displayedSeekPage.set(next);
    if (next === 0) {
      void this.goToFirstPage();
      return;
    }
    if (next === max) {
      void this.goToLastPage();
      return;
    }
    try {
      const cfi = this.epubBook.locations.cfiFromLocation(next);
      if (cfi) {
        void this.rendition?.display(cfi);
      }
    } catch (e) {
      console.warn('[reader-text] seek failed', e);
    }
    this.scheduleProgressUpdate();
  }

  /** Home — first spine / location 0; continuous scrollTop = 0. */
  async goToFirstPage(): Promise<void> {
    if (!this.rendition || !this.epubBook) return;
    this.forceStartPageUntil = Date.now() + 800;
    this.currentPage.set(0);
    try {
      // Prefer spine.first — locations.cfiFromLocation(0) skips image-only covers.
      const spineFirst = (this.epubBook as any).spine?.first?.();
      let target: string | undefined = spineFirst?.href || undefined;
      if (!target) {
        try {
          target = this.epubBook.locations.cfiFromPercentage(0) as string;
        } catch { /* ignore */ }
      }
      if (!target) {
        try {
          target = this.epubBook.locations.cfiFromLocation(0) as string;
        } catch { /* ignore */ }
      }
      if (target) {
        await this.rendition.display(target);
      } else {
        await this.rendition.display();
      }
      this.currentPage.set(0);
      const container = this.continuousScrollContainer();
      if (container) container.scrollTop = 0;
    } catch (e) {
      console.warn('[reader-text] goToFirstPage failed', e);
    }
    this.scheduleProgressUpdate();
  }

  /** End — last location; continuous scroll to bottom. */
  async goToLastPage(): Promise<void> {
    if (!this.rendition || !this.epubBook) return;
    const max = Math.max(0, this.pageCount() - 1);
    this.forceStartPageUntil = 0;
    try {
      let endCfi: string | undefined;
      try {
        endCfi = this.epubBook.locations.cfiFromLocation(max) as string;
      } catch { /* ignore */ }
      if (!endCfi) {
        try {
          endCfi = this.epubBook.locations.cfiFromPercentage(1) as string;
        } catch { /* ignore */ }
      }
      const spineLast = (this.epubBook as any).spine?.last?.();
      const target = endCfi || spineLast?.href || undefined;
      if (target) {
        await this.rendition.display(target);
      }
      this.currentPage.set(max);
      const container = this.continuousScrollContainer();
      if (container) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    } catch (e) {
      console.warn('[reader-text] goToLastPage failed', e);
    }
    this.scheduleProgressUpdate();
  }

  goToToc(entry: TocEntry): void {
    this.showToc.set(false);
    if (!this.rendition) return;
    const dest = entry.location >= 0 ? entry.location : this.currentPage();
    if (dest !== this.currentPage()) {
      this.recordLastPage(this.currentPage(), dest);
    }
    void this.rendition.display(entry.href);
  }

  async markPage(): Promise<void> {
    if (!this.bookId) return;
    const page = this.currentPage();
    const existing = this.annotations().find(
      a => (a.markType || '') === 'PageMark' && a.page === page
    );

    if (existing?.id) {
      const ok = await this.electron.deleteBookAnnotation(existing.id);
      if (ok) {
        this.annotations.update(list => list.filter(a => a.id !== existing.id));
        this.showStub(`Página ${page + 1} desmarcada`);
      }
      return;
    }

    const chapter = this.chapterTitle() || '';
    const tocEntry = this.toc().find(e => e.label === chapter);
    const saved = await this.electron.saveBookAnnotation({
      fkBook: this.bookId,
      page,
      pages: this.pageCount(),
      text: chapter ? `${chapter} — Página ${page + 1}` : `Página ${page + 1}`,
      note: '',
      color: 'None',
      chapter,
      chapterNumber: tocEntry?.location ?? 0,
      markType: 'PageMark',
      favorite: false,
      cfiRange: this.currentCfi() || '',
      fontSize: this.fontSize()
    });
    if (saved) {
      this.annotations.update(list => [saved, ...list.filter(a => a.id !== saved.id)]);
      this.showStub(`Página ${page + 1} marcada`);
    }
  }

  async toggleFavorite(): Promise<void> {
    if (!this.bookId) return;
    const updated = await this.electron.toggleBookFavorite(this.bookId);
    if (updated) {
      this.bookMeta = updated;
      this.favorite.set(!!updated.favorite);
    }
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
      this.chromeVisible.set(false);
      this.showToc.set(false);
      this.showTypography.set(false);
      this.updateLastPageUi(null, this.renderedLastPageIsLeft());
    } else {
      void document.exitFullscreen();
    }
  }

  async setScrollingMode(mode: BookScrollingMode): Promise<void> {
    this.scrollingMode.set(mode);
    this.settings.bookScrollingMode.set(mode);
    this.wheelAccum = 0;
    this.scheduleConfigSave();
    const cfi = this.currentCfi();
    const page = this.currentPage();
    await this.rebuildRendition(cfi || page);
  }

  setBookLayout(layout: BookLayout): void {
    this.bookLayout.set(layout);
    this.scheduleConfigSave();
    const cfi = this.currentCfi();
    const page = this.currentPage();
    void this.rebuildRendition(cfi || page);
  }

  setPageTransition(effect: PageTransitionType): void {
    this.pageTransition.set(effect);
    this.settings.bookPageTransition.set(effect);
    this.scheduleConfigSave();
  }

  setBookPageSize(size: BookPageSize): void {
    this.bookPageSize.set(size);
    this.settings.bookPageSize.set(size);
    this.scheduleConfigSave();
    this.clearPageBitmapCache();
    void this.regenerateBookLocations();
    this.scheduleRenditionResize();
  }

  setFontSize(size: number): void {
    const next = Math.min(32, Math.max(12, Number(size) || 18));
    this.fontSize.set(next);
    this.settings.bookFontSize.set(next);
    this.scheduleTypographyReflow();
    this.scheduleConfigSave();
  }

  adjustFontSize(delta: number): void {
    this.setFontSize(this.fontSize() + delta);
  }

  private setZoom(value: number): void {
    const next = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)) * 100) / 100;
    this.zoom.set(next);
    this.scheduleRenditionResize();
  }

  setFontFamily(family: string): void {
    this.fontFamily.set(family);
    if (this.isJapaneseBook()) {
      this.settings.bookFontFamilyJapanese.set(family);
    } else {
      this.settings.bookFontFamily.set(family);
    }
    this.scheduleTypographyReflow();
    this.scheduleConfigSave();
  }

  setAlign(align: BookAlign): void {
    this.align.set(align);
    this.settings.bookAlign.set(align);
    this.scheduleTypographyReflow();
    this.scheduleConfigSave();
  }

  setMargin(margin: BookMarginSize): void {
    this.margin.set(margin);
    this.settings.bookMargin.set(margin);
    this.scheduleTypographyReflow();
    this.scheduleConfigSave();
  }

  setSpacing(spacing: BookSpacingSize): void {
    this.spacing.set(spacing);
    this.settings.bookSpacing.set(spacing);
    this.scheduleTypographyReflow();
    this.scheduleConfigSave();
  }

  async goBack(): Promise<void> {
    await this.cleanup();
    this.nav.goBack(this.router);
  }

  private onFsChange = (): void => {
    const fs = !!document.fullscreenElement;
    this.isFullscreen.set(fs);
    if (fs) {
      this.updateLastPageUi(null, this.renderedLastPageIsLeft());
    } else {
      const item = this.lastPages()[0] ?? null;
      if (item) {
        const isLeft = item.page < this.currentPage();
        this.updateLastPageUi(item, isLeft);
      }
    }
    this.scheduleRenditionResize();
  };

  @HostListener('window:resize')
  onWindowResize(): void {
    this.scheduleRenditionResize();
  }

  private onWindowWheel = (ev: WheelEvent): void => {
    this.handleWheel(ev);
  };

  private handleWheel(ev: WheelEvent): void {
    if (this.loading() || this.error() || this.ended) return;
    if (this.shouldDeferWheelToUi(ev)) return;

    if (ev.ctrlKey) {
      ev.preventDefault();
      const dir = ev.deltaY > 0 ? -1 : 1;
      this.setZoom(this.zoom() + dir * ZOOM_STEP_WHEEL);
      return;
    }

    // Continuous strip: let native scroll work
    if (!this.isPaginatedMode()) return;

    ev.preventDefault();

    if (this.isBookTurnBusy()) {
      this.wheelAccum = 0;
      return;
    }

    if (this.canScrollContents(ev.deltaY)) {
      this.scrollContentsBy(ev.deltaY);
      this.wheelAccum = 0;
      return;
    }

    this.wheelAccum += ev.deltaY;
    if (Math.abs(this.wheelAccum) < WHEEL_PAGE_THRESHOLD) return;

    const forward = this.wheelAccum > 0;
    this.wheelAccum = 0;

    if (this.isHorizontalMode() && this.usesRtlPageKeys()) {
      forward ? this.goPrev() : this.goNext();
    } else {
      forward ? this.goNext() : this.goPrev();
    }
  }

  /** True when an overlay/popup is open and the pointer is not over the EPUB viewport. */
  private shouldDeferWheelToUi(ev: WheelEvent): boolean {
    if (!this.hasBlockingReaderOverlay()) return false;

    // Wheel from epub.js iframe contents = pointer is over the book
    const target = ev.target;
    if (target instanceof Node) {
      const doc = target.nodeType === Node.DOCUMENT_NODE
        ? (target as Document)
        : target.ownerDocument;
      if (doc && doc !== document) return false;
    }

    try {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      if (el?.closest?.('[data-br-viewer-host]')) return false;
    } catch { /* ignore */ }

    return true;
  }

  private hasBlockingReaderOverlay(): boolean {
    return (
      this.showSearch() ||
      this.showAnnotations() ||
      this.showTypography() ||
      this.showToc() ||
      !!this.editingAnnotation() ||
      this.showTouchDemo() ||
      this.showTouchConfig() ||
      !!this.switchConfirm() ||
      this.showAssistant() ||
      this.showAssistantSummary() ||
      this.showTrackerSimple() ||
      this.showTrackerConfig() ||
      this.showTtsPopup() ||
      !!this.vocabDetail() ||
      !!this.vocabKanji()
    );
  }

  private onRenditionClick = (event: MouseEvent): void => {
    if (this.editingAnnotation()) return;
    const vocabEl = (event.target as Element | null)?.closest?.('.br-vocab') as HTMLElement | null;
    if (vocabEl) {
      void this.openVocabularyFromElement(vocabEl);
      return;
    }
    if (this.textSelectVisible()) {
      // Keep toolbar while native selection remains (mouseup after drag must not clear it)
      if (this.hasActiveTextSelection()) return;
      this.dismissTextSelect();
      return;
    }
    if (this.didDrag) {
      this.didDrag = false;
      return;
    }
    if (this.hasActiveTextSelection()) return;
    const mapped = this.iframeEventToHostLocal(event);
    if (!mapped) {
      if (!this.isBookTurnBusy()) this.chromeVisible.update(v => !v);
      return;
    }
    this.ingestMappedTap('click', mapped);
  };

  private onRenditionTouchEnd = (event: TouchEvent): void => {
    if (this.editingAnnotation()) return;
    if (this.textSelectVisible()) {
      if (this.hasActiveTextSelection()) return;
      this.dismissTextSelect();
      return;
    }
    if (this.didDrag) {
      this.didDrag = false;
      return;
    }
    if (this.hasActiveTextSelection()) return;
    const touch = event?.changedTouches?.[0];
    if (!touch) return;
    const mapped = this.iframeEventToHostLocal(touch);
    if (!mapped) return;
    this.ingestMappedTap('touch', mapped);
  };

  private onRenditionDblClick = (_event: MouseEvent): void => {
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
      this.clickTimer = null;
    }
    this.setZoom(1);
  };

  /**
   * Map iframe-local client coords → host-local (visible viewport).
   * epub.js click/touch events report clientX/Y relative to the iframe document.
   */
  private iframeEventToHostLocal(
    event: { clientX: number; clientY: number; target?: EventTarget | null; view?: Window | null }
  ): { x: number; y: number } | null {
    const host = this.viewerHostRef?.nativeElement;
    if (!host || typeof event?.clientX !== 'number') return null;
    const hostRect = host.getBoundingClientRect();

    // Check if the event was already fired from the top window / host level
    const eventView = (event as any).view as Window | undefined;
    if (eventView === window) {
      return {
        x: event.clientX - hostRect.left,
        y: event.clientY - hostRect.top
      };
    }

    let iframe: HTMLIFrameElement | null = null;
    try {
      iframe = (eventView?.frameElement as HTMLIFrameElement | null)
        || ((event.target as Node | null)?.ownerDocument?.defaultView?.frameElement as HTMLIFrameElement | null)
        || (this.activeContents()?.document?.defaultView?.frameElement as HTMLIFrameElement | null)
        || null;
    } catch { /* ignore */ }

    if (!iframe) {
      return {
        x: event.clientX - hostRect.left,
        y: event.clientY - hostRect.top
      };
    }

    const iframeRect = iframe.getBoundingClientRect();
    const docW = iframe.contentWindow?.innerWidth || iframe.clientWidth || iframeRect.width || 1;
    const docH = iframe.contentWindow?.innerHeight || iframe.clientHeight || iframeRect.height || 1;
    const scaleX = iframeRect.width / docW;
    const scaleY = iframeRect.height / docH;

    const screenX = iframeRect.left + (event.clientX * scaleX);
    const screenY = iframeRect.top + (event.clientY * scaleY);
    return {
      x: screenX - hostRect.left,
      y: screenY - hostRect.top
    };
  }

  private async openReader(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.unlockRequired.set(false);
    this.unlockError.set(null);
    this.loadingMessage.set('Abrindo arquivo…');
    try {
      if (!this.bookId || Number.isNaN(this.bookId)) {
        throw new Error('ID de livro inválido');
      }

      const book = await this.electron.getBook(this.bookId);
      this.bookMeta = book;
      this.book.set(book);
      if (book) {
        this.title.set(book.title || book.name || 'Livro');
        this.author.set(book.author || '');
        this.favorite.set(!!book.favorite);
        this.coverUrl.set(book.coverPath ? `local-cover:///${book.coverPath}` : null);
      }

      if (bookNeedsUnlock(book?.password) && !this.bookUnlock.isUnlocked(this.bookId)) {
        this.pendingBookPassword = book?.password || '';
        this.unlockRequired.set(true);
        this.loading.set(false);
        return;
      }

      await this.continueOpenReader();
    } catch (e: any) {
      console.error(e);
      this.error.set(e?.message || 'Erro ao abrir o livro');
      this.loading.set(false);
    }
  }

  confirmUnlock(): void {
    if (!bookPasswordMatches(this.pendingBookPassword, this.unlockAttempt)) {
      this.unlockError.set('Senha incorreta');
      return;
    }
    this.bookUnlock.markUnlocked(this.bookId);
    this.unlockRequired.set(false);
    this.unlockAttempt = '';
    this.unlockError.set(null);
    this.loading.set(true);
    void this.continueOpenReader();
  }

  private async continueOpenReader(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.loadingMessage.set('Preparando EPUB…');
    try {
      const opened = await this.electron.openBookReader(this.bookId);
      if (!opened) {
        throw new Error('Falha ao abrir o leitor (Electron indisponível)');
      }

      this.readerSessionId = opened.sessionId;
      this.title.set(opened.title);
      this.author.set(opened.author || '');
      this.favorite.set(opened.favorite);
      this.applyConfiguration(opened.configuration);
      if (this.isJapaneseBook()) {
        if (!opened.configuration?.fontType) {
          this.fontFamily.set(this.settings.bookFontFamilyJapanese());
        }
        void this.electron.japaneseInit();
      }

      try {
        this.annotations.set(await this.electron.listBookAnnotations(this.bookId));
      } catch (e) {
        console.warn('[reader-text] list annotations failed', e);
        this.annotations.set([]);
      }

      if (this.viewReady) {
        await this.mountEpub(opened.epubUrl, opened.bookMark, opened.bookMarkCfi);
      } else {
        this.pendingOpen = {
          epubUrl: opened.epubUrl,
          bookMark: opened.bookMark,
          bookMarkCfi: opened.bookMarkCfi
        };
      }
    } catch (e: any) {
      console.error(e);
      this.error.set(e?.message || 'Erro ao abrir o livro');
      this.loading.set(false);
    }
  }

  private applyConfiguration(config: BookConfiguration | null): void {
    if (!config) return;
    if (config.fontSize) this.fontSize.set(config.fontSize);
    if (config.fontType) this.fontFamily.set(config.fontType);
    if (config.alignment) this.align.set(config.alignment as BookAlign);
    if (config.margin) this.margin.set(config.margin as BookMarginSize);
    if (config.spacing) this.spacing.set(config.spacing as BookSpacingSize);
    if (config.scrolling && Object.values(BookScrollingMode).includes(config.scrolling as BookScrollingMode)) {
      this.scrollingMode.set(config.scrolling as BookScrollingMode);
    }
    if (isPageTransitionType(config.pagination)) {
      this.pageTransition.set(config.pagination);
      this.settings.bookPageTransition.set(config.pagination);
    }
  }

  private async mountEpub(epubUrl: string, bookMark: number, bookMarkCfi: string): Promise<void> {
    const qp = this.route.snapshot.queryParamMap;
    const jumpCfi = qp.get('cfi') || '';
    const jumpPageRaw = qp.get('page');
    const jumpPage = jumpPageRaw != null ? Number(jumpPageRaw) : NaN;
    const startCfi = jumpCfi || bookMarkCfi;
    this.loadingMessage.set('Carregando páginas…');
    const el = this.viewerRef?.nativeElement;
    if (!el) {
      this.pendingOpen = { epubUrl, bookMark, bookMarkCfi };
      return;
    }

    this.destroyEpub();
    el.innerHTML = '';
    this.zoom.set(1);
    this.lastPages.set([]);
    this.updateLastPageUi(null, true);

    const book = ePub(epubUrl);
    this.epubBook = book;
    this.epubUrl = epubUrl;

    await book.ready;
    this.loadingMessage.set('Gerando índice de progresso…');
    const charsPerPage = this.calculateCharsPerPage();
    await book.locations.generate(charsPerPage);
    this.augmentBookLocations(book);
    const locationCount = Math.max(1, book.locations.length());
    this.pageCount.set(locationCount);

    await this.buildToc(book);
    this.createRendition(el);
    await this.hydrateAnnotationCfis();
    this.applyAnnotations();

    // Query `page` is a 0-based reader index; stored bookMark is 1-based.
    const startMark =
      !Number.isNaN(jumpPage) && jumpPage >= 0
        ? Math.min(Math.floor(jumpPage), locationCount - 1)
        : toReaderIndex(bookMark, locationCount);

    // Page 1 (cover): always spine.first — ignore stale bookMarkCfi that may point at body.
    // Explicit query `cfi` still wins.
    const openAtCover = (startMark <= 0 || (bookMark != null && bookMark <= 1)) && !jumpCfi;

    let resolvedCfi = openAtCover ? undefined : (jumpCfi || startCfi || undefined);
    if (!resolvedCfi && startMark > 0) {
      try {
        resolvedCfi = book.locations.cfiFromLocation(startMark) as string;
      } catch { /* ignore */ }
    }

    if (resolvedCfi && !openAtCover) {
      await this.rendition!.display(resolvedCfi);
      this.currentPage.set(Math.min(startMark, locationCount - 1));
      this.currentCfi.set(resolvedCfi);
    } else {
      // Same path as Home — spine.first so image-only covers are not skipped
      this.forceStartPageUntil = Date.now() + 1000;
      try {
        const spineFirst = (book as any).spine?.first?.();
        let target: string | undefined = spineFirst?.href;
        if (!target) {
          try {
            target = book.locations.cfiFromPercentage(0) as string;
          } catch { /* ignore */ }
        }
        if (!target) {
          try {
            target = book.locations.cfiFromLocation(0) as string;
          } catch { /* ignore */ }
        }
        if (target) {
          await this.rendition!.display(target);
        } else {
          await this.rendition!.display();
        }
      } catch {
        await this.rendition!.display();
      }
      this.currentPage.set(0);
      const container = this.continuousScrollContainer();
      if (container) container.scrollTop = 0;
    }

    this.historySessionId = await this.electron.startHistorySession({
      fkLibrary: this.bookMeta?.fkLibrary ?? 0,
      fkReference: this.bookId,
      type: 'BOOK',
      pageStart: fromReaderIndex(this.currentPage(), locationCount),
      pages: locationCount,
      volume: this.bookMeta?.volume || ''
    });

    void this.electron.setBookBookmark({
      id: this.bookId,
      bookMark: fromReaderIndex(this.currentPage(), locationCount),
      // Opening at cover: do not re-persist a stale body CFI from the library row
      bookMarkCfi: openAtCover ? undefined : this.currentCfi() || undefined,
      pages: locationCount
    });

    this.loading.set(false);
    void this.loadAdjacentBooks();
    // Brief chrome flash so controls are discoverable, then immersive
    this.chromeVisible.set(true);
    setTimeout(() => {
      if (!this.showToc() && !this.showTypography() && !this.showSearch()) {
        this.chromeVisible.set(false);
      }
    }, 1200);
    this.maybeShowFirstTouchDemo();
    this.scheduleAdjacentBookBitmaps();
  }

  private createRendition(el: HTMLElement): void {
    if (!this.epubBook) return;
    const rendition = this.epubBook.renderTo(el, this.buildRenditionOptions() as any);
    this.rendition = rendition;
    this.applyTypography();

    // epub.js iframes swallow DOM clicks — listen via rendition passEvents
    rendition.on('click', this.onRenditionClick);
    rendition.on('dblclick', this.onRenditionDblClick);
    rendition.on('selected', this.onRenditionSelected);
    rendition.on('touchend', this.onRenditionTouchEnd);

    // Pan + wheel/keydown inside iframe documents (main viewer only — not peek).
    rendition.hooks.content.register((contents: any) => {
      if (this.isPeekContents(contents)) {
        this.sizeContentImages(contents);
        void this.enhanceJapaneseContents(contents);
        return;
      }
      this.bindContentsInput(contents);
      this.attachContentPan(contents);
      this.sizeContentImages(contents);
      void this.enhanceJapaneseContents(contents);
    });

    rendition.on('relocated', (location: any) => {
      if (this.relocating) return;
      if (!this.turningPage) {
        this.invalidatePeek();
        this.scheduleAdjacentPeekPreload();
        this.scheduleAdjacentBookBitmaps();
      }
      const cfi = location?.start?.cfi || '';
      this.currentCfi.set(cfi);
      // Image-only covers sit before locations[0]; atStart means real page 1 (cover).
      const spineFirstHref = (this.epubBook as any)?.spine?.first?.()?.href?.split('#')[0];
      const currentHref = location?.start?.href?.split('#')[0];
      const isRealCover = !!(
        (spineFirstHref && currentHref && (currentHref === spineFirstHref || currentHref.endsWith(spineFirstHref) || spineFirstHref.endsWith(currentHref))) ||
        (currentHref && /(cover|titlepage)\.x?html?$/i.test(currentHref))
      );
      let loc: number;
      if (location?.atStart || isRealCover) {
        loc = 0;
        this.sequentialNavDirection = 0;
      } else if (this.sequentialNavDirection !== 0) {
        const expected = this.currentPage() + this.sequentialNavDirection;
        this.sequentialNavDirection = 0;
        const max = Math.max(0, this.pageCount() - 1);
        loc = Math.min(Math.max(0, expected), max);
      } else {
        loc = this.locationFromCfiSafe(cfi, location);
      }
      if (Date.now() < this.forceStartPageUntil && loc > 0) {
        // Keep page 0 until CFI after Home/open stabilizes
        loc = 0;
      } else if (Date.now() >= this.forceStartPageUntil) {
        this.forceStartPageUntil = 0;
      }
      loc = Math.min(Math.max(0, loc), Math.max(0, this.pageCount() - 1));
      this.currentPage.set(loc);
      if (cfi) {
        this.adjacentScreenCfiMap.set(loc, cfi);
      }
      if (!this.isScrubbingSeek) {
        this.displayedSeekPage.set(loc);
      }
      const activeLast = this.displayedLastPage();
      if (activeLast) {
        const isLeft = activeLast.page < loc;
        if (isLeft !== this.renderedLastPageIsLeft()) {
          this.updateLastPageUi(activeLast, isLeft);
        }
      }
      this.updateChapterFromHref(location?.start?.href);
      this.scheduleProgressUpdate();
      if (this.textSelectVisible() && this.textSelectPageAtOpen >= 0 && loc !== this.textSelectPageAtOpen) {
        this.dismissTextSelect();
      }
      if (this.searchHighlightCfi) {
        if (this.searchHighlightIgnoreRelocate > 0) {
          this.searchHighlightIgnoreRelocate--;
        } else {
          this.clearTemporarySearchHighlight();
        }
      }
    });

    // Match column math to zoomed CSS box
    queueMicrotask(() => this.scheduleRenditionResize());
  }

  /** Size iframe images to reduce LayoutImageUnsized and center image-only pages. */
  private sizeContentImages(contents: any): void {
    const doc: Document | undefined = contents?.document;
    if (!doc) return;
    const imgs = Array.from(doc.querySelectorAll('img')) as HTMLImageElement[];
    for (const img of imgs) {
      const apply = () => {
        if (img.naturalWidth > 1 && img.naturalHeight > 1) {
          if (!img.getAttribute('width')) img.setAttribute('width', String(img.naturalWidth));
          if (!img.getAttribute('height')) img.setAttribute('height', String(img.naturalHeight));
          img.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
        }
      };
      if (img.complete) apply();
      else img.addEventListener('load', apply, { once: true });
    }

    try {
      const body = doc.body;
      if (body) {
        const textLen = (body.textContent || '').trim().length;
        const totalImgs = imgs.length;
        const hasImgOrSvg = totalImgs > 0 || !!doc.querySelector('svg, image');
        if (hasImgOrSvg && textLen < 40) {
          const maxPct = totalImgs > 1 ? Math.floor(96 / totalImgs) : 96;
          body.style.display = 'flex';
          body.style.flexDirection = 'column';
          body.style.justifyContent = 'center';
          body.style.alignItems = 'center';
          body.style.minHeight = '100vh';
          body.style.boxSizing = 'border-box';
          for (const img of imgs) {
            img.style.setProperty('max-height', `calc(${maxPct}vh - 12px)`, 'important');
            img.style.setProperty('max-width', '100%', 'important');
            img.style.setProperty('object-fit', 'contain', 'important');
          }
          for (const p of Array.from(body.querySelectorAll('p, div, figure'))) {
            const el = p as HTMLElement;
            if (el.querySelector('img, svg, image')) {
              el.style.display = 'flex';
              el.style.justifyContent = 'center';
              el.style.alignItems = 'center';
              el.style.width = '100%';
              el.style.margin = '0 auto';
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  private buildRenditionOptions(): Record<string, unknown> {
    const mode = this.scrollingMode();
    const continuous = mode === BookScrollingMode.Continuous;
    if (continuous) {
      this.autoScale.set(1);
      return {
        width: '100%',
        height: '100%',
        manager: 'continuous',
        flow: 'scrolled',
        allowScriptedContent: false
      };
    }
    const dims = this.getEffectiveVirtualDimensions();
    this.autoScale.set(dims.autoScale);
    this.lastReflowWidth = dims.width;
    this.lastReflowHeight = dims.height;
    this.lastReflowScale = dims.autoScale;
    const opts: Record<string, unknown> = {
      width: dims.width,
      height: dims.height,
      flow: 'paginated',
      allowScriptedContent: false,
      defaultDirection: mode === BookScrollingMode.PaginationRtl ? 'rtl' : 'ltr',
      spread: this.bookLayout() === BookLayout.DOUBLE_PAGE ? 'auto' : 'none'
    };
    if (mode === BookScrollingMode.PaginationVertical) {
      opts['axis'] = 'vertical';
    }
    return opts;
  }

  /** Resolve location index from CFI with percentage fallback. */
  private locationFromCfiSafe(cfi: string, location?: any): number {
    const max = Math.max(0, this.pageCount() - 1);
    if (cfi && this.epubBook?.locations) {
      try {
        const raw = this.epubBook.locations.locationFromCfi(cfi) as unknown;
        const loc = typeof raw === 'number' ? raw : Number(raw);
        if (typeof loc === 'number' && !Number.isNaN(loc)) {
          return Math.min(Math.max(0, loc), max);
        }
      } catch { /* fall through */ }
      try {
        const pct = this.epubBook.locations.percentageFromCfi(cfi) as unknown;
        const p = typeof pct === 'number' ? pct : Number(pct);
        if (typeof p === 'number' && !Number.isNaN(p) && max > 0) {
          return Math.min(Math.max(0, Math.round(p * max)), max);
        }
      } catch { /* fall through */ }
    }
    const fallback = location?.start?.location ?? 0;
    return Math.min(Math.max(0, Number(fallback) || 0), max);
  }

  /** Wheel + keydown on iframe contents (paginated iframes swallow host listeners). */
  private bindContentsInput(contents: any): void {
    const doc: Document | undefined = contents?.document;
    const win: Window | undefined = contents?.window;
    if (!doc) return;

    const onWheel = (ev: WheelEvent) => this.handleWheel(ev);
    const onKey = (ev: KeyboardEvent) => this.onKeydown(ev);

    doc.addEventListener('wheel', onWheel, { passive: false });
    doc.addEventListener('keydown', onKey);
    win?.addEventListener?.('wheel', onWheel, { passive: false } as AddEventListenerOptions);

    this.contentCleanups.push(() => {
      doc.removeEventListener('wheel', onWheel);
      doc.removeEventListener('keydown', onKey);
      try {
        win?.removeEventListener?.('wheel', onWheel);
      } catch { /* ignore */ }
    });
  }

  private onRenditionSelected = (cfiRange: string, contents: any): void => {
    if (this.loading() || this.error() || this.editingAnnotation() || this.didDrag) return;
    const sel = contents?.window?.getSelection?.();
    const text = (sel?.toString() || '').trim();
    if (!text || !cfiRange) return;

    let range: number[] | undefined;
    let domRange: Range | null = null;
    try {
      if (sel?.rangeCount && contents?.document) {
        domRange = sel.getRangeAt(0);
        if (domRange) {
          range = this.charRange(contents.document, domRange);
        }
      }
    } catch { /* ignore */ }

    const pending: PendingSelectShow = { cfiRange, text, range, contents, domRange };

    // Defer until pointer is up so the toolbar never sits under an active drag
    if (this.panPointerId != null || this.isSelectPointerDown(contents)) {
      this.pendingSelectShow = pending;
      return;
    }

    this.pendingSelectShow = null;
    this.showTextSelectPopup(cfiRange, text, range, contents, domRange);
  };

  private isSelectPointerDown(contents: any): boolean {
    try {
      const buttons = contents?.document?.defaultView?.event?.buttons;
      if (typeof buttons === 'number' && buttons !== 0) return true;
    } catch { /* ignore */ }
    return false;
  }

  private flushPendingSelectShow(_contents?: any): void {
    const pending = this.pendingSelectShow;
    if (!pending) return;
    this.pendingSelectShow = null;

    let domRange = pending.domRange;
    try {
      const sel = pending.contents?.window?.getSelection?.();
      if (sel?.rangeCount) {
        domRange = sel.getRangeAt(0);
        const text = (sel.toString() || '').trim();
        if (text) {
          pending.text = text;
          if (pending.contents?.document && domRange) {
            pending.range = this.charRange(pending.contents.document, domRange);
          }
        }
      }
    } catch { /* keep pending */ }

    this.showTextSelectPopup(
      pending.cfiRange,
      pending.text,
      pending.range,
      pending.contents,
      domRange
    );
  }

  private charRange(doc: Document, r: Range): number[] {
    const pre = doc.createRange();
    pre.selectNodeContents(doc.body);
    pre.setEnd(r.startContainer, r.startOffset);
    const start = pre.toString().length;
    return [start, start + r.toString().length];
  }

  private buildDraftAnnotation(cfiRange: string, text: string, range?: number[]): BookAnnotation {
    let page = this.currentPage();
    try {
      const raw = this.epubBook?.locations.locationFromCfi(cfiRange) as unknown;
      const loc = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isNaN(loc)) page = Math.max(0, Math.floor(loc));
    } catch { /* keep current */ }

    const pages = Math.max(1, this.pageCount() || 1);

    return {
      fkBook: this.bookId,
      page,
      pages,
      text,
      note: '',
      color: BookAnnotationColor.Yellow,
      chapter: this.chapterTitle() || '',
      chapterNumber: 0,
      range,
      markType: 'Annotation',
      favorite: false,
      cfiRange,
      fontSize: this.fontSize()
    };
  }

  private showTextSelectPopup(
    cfiRange: string,
    text: string,
    range: number[] | undefined,
    contents: any,
    domRange: Range | null
  ): void {
    this.showToc.set(false);
    this.showTypography.set(false);
    this.chromeVisible.set(false);

    const draft = this.buildDraftAnnotation(cfiRange, text, range);
    this.pendingSelection.set(draft);
    this.pendingSelectContents = contents;
    this.textSelectPageAtOpen = draft.page;
    this.textSelectPos.set(this.computeTextSelectPos(contents, domRange));
    this.textSelectVisible.set(true);
  }

  private computeTextSelectPos(contents: any, domRange: Range | null): TextSelectPos {
    const host = this.viewerHostRef?.nativeElement;
    const hostRect = host?.getBoundingClientRect();
    const popupW = 220;
    const popupH = 92;
    const pad = 8;

    let startLeft = 0;
    let startTop = 0;
    let startWidth = 40;
    let fullBottom = 40;

    try {
      if (domRange && contents?.document) {
        const iframe = contents.document.defaultView?.frameElement as HTMLElement | null;
        const iframeRect = iframe?.getBoundingClientRect();
        const ox = iframeRect?.left ?? 0;
        const oy = iframeRect?.top ?? 0;

        const full = domRange.getBoundingClientRect();
        fullBottom = oy + full.bottom;

        let startRect: DOMRect | null = null;
        const clientRects = domRange.getClientRects();
        if (clientRects.length > 0) {
          startRect = clientRects[0];
        } else {
          const collapsed = domRange.cloneRange();
          collapsed.collapse(true);
          startRect = collapsed.getBoundingClientRect();
        }

        startLeft = ox + startRect.left;
        startTop = oy + startRect.top;
        startWidth = Math.max(startRect.width, 1);
      }
    } catch { /* fallback below */ }

    if (!hostRect) {
      return { left: pad, top: pad };
    }

    // Anchor to selection start (viewport → host-local)
    let left = startLeft - hostRect.left + startWidth / 2 - popupW / 2;
    let top = startTop - hostRect.top - popupH - pad;
    if (top < pad) {
      // No room above start — place below the full selection
      top = fullBottom - hostRect.top + pad;
    }

    const maxLeft = Math.max(pad, hostRect.width - popupW - pad);
    const maxTop = Math.max(pad, hostRect.height - popupH - pad);
    left = Math.min(Math.max(pad, left), maxLeft);
    top = Math.min(Math.max(pad, top), maxTop);
    return { left, top };
  }

  dismissTextSelect(): void {
    this.textSelectVisible.set(false);
    this.pendingSelection.set(null);
    this.pendingSelectShow = null;
    this.textSelectPageAtOpen = -1;
    try {
      this.pendingSelectContents?.window?.getSelection?.()?.removeAllRanges?.();
    } catch { /* ignore */ }
    this.pendingSelectContents = null;
  }

  async onTextSelectColor(color: BookAnnotationColor): Promise<void> {
    const pending = this.pendingSelection();
    if (!pending?.cfiRange) {
      this.dismissTextSelect();
      return;
    }
    const saved = await this.electron.saveBookAnnotation({
      ...pending,
      color,
      note: '',
      markType: 'Annotation',
      fkBook: this.bookId
    });
    this.dismissTextSelect();
    if (!saved) return;

    const list = [...this.annotations()];
    const idx = list.findIndex(a => a.id === saved.id);
    if (idx >= 0) list[idx] = saved;
    else list.unshift(saved);
    this.annotations.set(list);

    if (saved.cfiRange) {
      this.removeHighlight(saved.cfiRange);
      this.addHighlight(saved);
    }
  }

  async onTextSelectErase(): Promise<void> {
    const pending = this.pendingSelection();
    if (!pending) {
      this.dismissTextSelect();
      return;
    }

    const targets = this.annotations().filter(a => this.annotationOverlapsSelection(a, pending));
    for (const a of targets) {
      if (a.id) {
        await this.electron.deleteBookAnnotation(a.id);
      }
      if (a.cfiRange) this.removeHighlight(a.cfiRange);
    }
    if (targets.length) {
      const removed = new Set(targets.map(t => t.id));
      this.annotations.set(this.annotations().filter(a => !removed.has(a.id)));
    }
    this.dismissTextSelect();
  }

  private annotationOverlapsSelection(a: BookAnnotation, pending: BookAnnotation): boolean {
    if (a.cfiRange && pending.cfiRange && a.cfiRange === pending.cfiRange) return true;
    if (
      a.range &&
      a.range.length >= 2 &&
      pending.range &&
      pending.range.length >= 2 &&
      a.page === pending.page
    ) {
      const [as, ae] = a.range;
      const [ps, pe] = pending.range;
      if (as < pe && ps < ae) return true;
    }
    if (a.text && pending.text && pending.text.includes(a.text)) return true;
    return false;
  }

  async onTextSelectCopy(): Promise<void> {
    const text = this.pendingSelection()?.text || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.showStub('Texto copiado');
    } catch {
      this.showStub('Falha ao copiar');
    }
  }

  onTextSelectAll(): void {
    const contents = this.pendingSelectContents;
    const doc: Document | undefined = contents?.document;
    const win: Window | undefined = contents?.window;
    if (!doc?.body || !win) return;
    try {
      const sel = win.getSelection();
      if (!sel) return;
      sel.removeAllRanges();
      const r = doc.createRange();
      r.selectNodeContents(doc.body);
      sel.addRange(r);
      const text = (sel.toString() || '').trim();
      if (!text) return;

      const range = this.charRange(doc, r);
      let cfiRange = this.pendingSelection()?.cfiRange || '';
      try {
        if (typeof contents.cfiFromRange === 'function') {
          cfiRange = contents.cfiFromRange(r) || cfiRange;
        }
      } catch { /* keep previous */ }

      const draft = this.buildDraftAnnotation(cfiRange, text, range);
      this.pendingSelection.set(draft);
      this.textSelectPos.set(this.computeTextSelectPos(contents, r));
      this.textSelectVisible.set(true);
    } catch (e) {
      console.warn('[reader-text] select all failed', e);
    }
  }

  onTextSelectTts(): void {
    const text = (this.pendingSelection()?.text || '').trim();
    this.dismissTextSelect();
    void this.startTtsFromSelection(text);
  }

  async onTextSelectSearch(): Promise<void> {
    const text = (this.pendingSelection()?.text || '').trim();
    this.dismissTextSelect();
    if (!text) {
      this.showStub('Nada selecionado');
      return;
    }
    await this.openSearch();
    this.searchQuery.set(text);
    void this.runSearch(text);
  }

  async onTextSelectTranslate(): Promise<void> {
    const text = (this.pendingSelection()?.text || '').trim();
    this.dismissTextSelect();
    if (!text) {
      this.showStub('Nada selecionado');
      return;
    }
    const url =
      'https://translate.google.com/?sl=auto&tl=pt&text=' + encodeURIComponent(text);
    const ok = await this.electron.openExternal(url);
    if (!ok) this.showStub('Não foi possível abrir o tradutor');
  }

  async onTextSelectVocabulary(): Promise<void> {
    const text = (this.pendingSelection()?.text || '').trim();
    this.dismissTextSelect();
    await this.openVocabularyFromText(text);
  }

  async openAssistant(): Promise<void> {
    const status = await this.electron.assistantStatus();
    if (!status.enabled) {
      this.showStub('Ative a IA em Configurações');
      return;
    }
    if (status.ready === false) {
      this.showStub(
        status.readyReason ||
          (status.provider === 'openrouter'
            ? 'Configure a chave OpenRouter'
            : 'Provedor local offline — inicie Ollama/LM Studio')
      );
      return;
    }
    if (status.provider === 'openrouter' && !status.hasApiKey) {
      this.showStub('Configure a chave OpenRouter');
      return;
    }
    if (status.provider === 'ollama' || status.provider === 'lm_studio') {
      const probe = await this.electron.aiTestConnection(status.provider);
      if (!probe.ok) {
        this.showStub(probe.error || 'Provedor local offline — inicie Ollama/LM Studio');
        return;
      }
    }
    this.assistantMaxContext.set(status.maxContextChars || 12000);
    this.showStub('Preparando capítulos…');
    try {
      this.assistantItems.set(await this.buildBookAssistantItems());
    } catch (e) {
      console.warn('[reader-text] assistant context failed', e);
      this.assistantItems.set([]);
    }
    this.assistantPreload.set(null);
    this.showAssistant.set(true);
    this.chromeVisible.set(true);
  }

  private async buildBookAssistantItems(): Promise<AssistantContextItem[]> {
    const book = this.epubBook;
    const toc = this.toc();
    if (!book || !toc.length) {
      return [
        {
          id: 'c:current',
          label: 'Trecho atual',
          text: ''
        }
      ];
    }
    const items: AssistantContextItem[] = [];
    const limit = Math.min(toc.length, 40);
    for (let i = 0; i < limit; i++) {
      const entry = toc[i];
      let text = '';
      try {
        const href = (entry.href || '').split('#')[0];
        const section = book.spine.get(href) || book.spine.get(i);
        if (section) {
          await section.load(book.load.bind(book));
          const doc: Document | undefined = section.document;
          text = (doc?.body?.innerText || doc?.body?.textContent || '').replace(/\s+\n/g, '\n').trim();
          try {
            section.unload?.();
          } catch {
            /* ignore */
          }
        }
      } catch {
        text = '';
      }
      items.push({
        id: `c:${i}:${entry.href || i}`,
        label: entry.label || `Capítulo ${i + 1}`,
        text: text || `(Sem texto extraído: ${entry.label || i + 1})`
      });
    }
    return items;
  }

  prepareAssistantSummary(): void {
    const items = this.assistantItems();
    this.assistantSelectedForSummary.set(items.slice(-3).map(i => i.id));
    this.showAssistantSummary.set(true);
  }

  onAssistantSummaryToChat(summary: string): void {
    this.showAssistantSummary.set(false);
    this.assistantPreload.set(summary);
    this.showAssistant.set(true);
  }

  private async openVocabularyFromElement(el: HTMLElement): Promise<void> {
    const surface = (el.getAttribute('data-surface') || el.textContent || '').trim();
    const basic = (el.getAttribute('data-basic') || '').trim();
    const query = basic && basic !== surface ? `${surface}` : surface;
    await this.openVocabularyFromText(query || surface, basic || undefined);
  }

  private async openVocabularyFromText(text: string, basicForm?: string): Promise<void> {
    const q = (text || '').trim();
    if (!q) {
      this.showStub('Nada selecionado');
      return;
    }
    try {
      let hit = await this.electron.lookupVocabulary({
        text: basicForm ? basicForm : q,
        bookId: this.bookId || null
      });
      if (!hit && basicForm && basicForm !== q) {
        hit = await this.electron.lookupVocabulary({ text: q, bookId: this.bookId || null });
      }
      if (!hit) {
        this.showStub('Nenhum vocabulário encontrado');
        return;
      }
      this.vocabKanji.set(null);
      this.vocabDetail.set(hit);
    } catch (e) {
      console.warn('[reader-text] vocabulary lookup failed', e);
      this.showStub('Falha ao buscar vocabulário');
    }
  }

  isJapaneseBook(): boolean {
    const lang = (this.bookMeta?.language || '').toLowerCase();
    return lang.startsWith('ja') || lang.includes('japan') || lang === Languages.JAPANESE;
  }

  typographyFonts(): BookFontOption[] {
    return this.isJapaneseBook()
      ? [...japaneseFontOptions(), ...westernFontOptions()]
      : westernFontOptions();
  }

  furiganaEnabled(): boolean {
    return (
      this.isJapaneseBook() &&
      this.settings.bookProcessJapaneseText() &&
      this.settings.bookGenerateFurigana()
    );
  }

  /** Vertical Japanese writing — settings toggle and Japanese-language books only. */
  tateGakiEnabled(): boolean {
    return this.isJapaneseBook() && this.settings.bookFontJapaneseStyle();
  }

  setTateGaki(enabled: boolean): void {
    this.settings.bookFontJapaneseStyle.set(!!enabled);
    this.scheduleTypographyReflow();
  }

  async toggleTts(): Promise<void> {
    if (this.ttsActive()) {
      this.stopTts();
      return;
    }
    await this.startTts(0);
  }

  async onTtsConfigApply(cfg: { voice: TextSpeech; speed: number }): Promise<void> {
    this.ttsVoice.set(cfg.voice);
    this.ttsSpeed.set(cfg.speed);
    this.showTtsPopup.set(false);
    const key = this.isJapaneseBook()
      ? 'BOOK_READER_TTS_VOICE_JAPANESE'
      : 'BOOK_READER_TTS_VOICE_NORMAL';
    await this.electron.setSetting(key, cfg.voice);
    await this.electron.setSetting('BOOK_READER_TTS_SPEED', cfg.speed);
    if (this.ttsActive() && this.ttsStatus() !== AudioStatus.PAUSE) {
      void this.playCurrentTtsLine();
    }
  }

  ttsTogglePlay(): void {
    if (!this.ttsActive()) {
      void this.startTts(0);
      return;
    }
    if (this.ttsStatus() === AudioStatus.PLAY && this.ttsAudio) {
      this.ttsAudio.pause();
      this.ttsStatus.set(AudioStatus.PAUSE);
      return;
    }
    if (this.ttsStatus() === AudioStatus.PAUSE && this.ttsAudio) {
      void this.ttsAudio.play();
      this.ttsStatus.set(AudioStatus.PLAY);
      return;
    }
    void this.playCurrentTtsLine();
  }

  ttsPrevious(): void {
    if (!this.ttsActive()) return;
    if (this.ttsLineIndex > 0) {
      this.ttsLineIndex -= 1;
      void this.playCurrentTtsLine();
      return;
    }
    if (this.currentPage() <= 0) return;
    this.prevPage();
    void this.afterPageChangeForTts('end');
  }

  ttsNext(): void {
    if (!this.ttsActive()) return;
    void this.advanceTtsLine();
  }

  stopTts(): void {
    this.ttsPlayToken += 1;
    this.clearTtsAudio();
    this.clearTtsHighlight();
    this.ttsActive.set(false);
    this.ttsStatus.set(AudioStatus.STOP);
    this.ttsError.set(null);
    this.ttsLines = [];
    this.ttsLineIndex = 0;
    this.showTtsPopup.set(false);
  }

  private async startTtsFromSelection(selectedText: string): Promise<void> {
    await this.loadTtsPrefs();
    this.reloadTtsLines();
    const idx = findSentenceIndexContaining(this.ttsLines, selectedText);
    await this.startTts(idx);
  }

  private async startTts(startIndex: number): Promise<void> {
    await this.loadTtsPrefs();
    this.reloadTtsLines();
    if (this.ttsLines.length === 0) {
      this.ttsError.set('Nenhum texto legível nesta página');
      this.ttsActive.set(true);
      this.ttsStatus.set(AudioStatus.ERROR);
      return;
    }
    this.historyUsedTts = true;
    if (this.historySessionId != null) {
      void this.electron.updateHistorySession({
        id: this.historySessionId,
        pageEnd: this.storedBookMark(),
        pages: this.pageCount(),
        useTTS: true
      });
    }
    this.ttsActive.set(true);
    this.ttsError.set(null);
    this.ttsLineIndex = Math.max(0, Math.min(startIndex, this.ttsLines.length - 1));
    this.chromeVisible.set(true);
    await this.playCurrentTtsLine();
  }

  private async loadTtsPrefs(): Promise<void> {
    const isJp = this.isJapaneseBook();
    const voiceKey = isJp ? 'BOOK_READER_TTS_VOICE_JAPANESE' : 'BOOK_READER_TTS_VOICE_NORMAL';
    const voiceRaw = await this.electron.getSetting(voiceKey, textSpeechDefault(isJp));
    const speedRaw = await this.electron.getSetting('BOOK_READER_TTS_SPEED', 0);
    this.ttsVoice.set(parseTextSpeech(voiceRaw, textSpeechDefault(isJp)));
    const n = Number(speedRaw);
    this.ttsSpeed.set(Number.isFinite(n) ? Math.max(-50, Math.min(50, Math.round(n / 5) * 5)) : 0);
  }

  private reloadTtsLines(): void {
    const text = extractContentsText(this.activeContents());
    this.ttsLines = splitTtsSentences(text);
  }

  private async playCurrentTtsLine(): Promise<void> {
    if (!this.ttsActive()) return;
    const token = ++this.ttsPlayToken;
    const line = this.ttsLines[this.ttsLineIndex];
    if (!line?.text) {
      await this.advanceTtsLine();
      return;
    }

    this.ttsStatus.set(AudioStatus.PREPARE);
    this.ttsError.set(null);
    this.applyTtsHighlight(line.text);
    this.prefetchUpcoming();

    try {
      const result = await this.electron.ttsSynthesize({
        text: line.text,
        voice: textSpeechAzureName(this.ttsVoice()),
        rate: this.ttsSpeed()
      });
      if (token !== this.ttsPlayToken) return;
      if (!result?.audioUrl) {
        throw new Error('Áudio TTS indisponível');
      }
      this.clearTtsAudio();
      const audio = new Audio(result.audioUrl);
      this.ttsAudio = audio;
      audio.onended = () => {
        if (token !== this.ttsPlayToken) return;
        void this.advanceTtsLine();
      };
      audio.onerror = () => {
        if (token !== this.ttsPlayToken) return;
        this.ttsStatus.set(AudioStatus.ERROR);
        this.ttsError.set('Falha ao reproduzir áudio');
      };
      await audio.play();
      if (token !== this.ttsPlayToken) return;
      this.ttsStatus.set(AudioStatus.PLAY);
    } catch (e: any) {
      if (token !== this.ttsPlayToken) return;
      console.warn('[reader-text] TTS failed', e);
      this.ttsStatus.set(AudioStatus.ERROR);
      this.ttsError.set(e?.message || 'Falha ao sintetizar TTS (verifique a rede)');
    }
  }

  private prefetchUpcoming(): void {
    const voice = textSpeechAzureName(this.ttsVoice());
    const rate = this.ttsSpeed();
    const items = this.ttsLines
      .slice(this.ttsLineIndex + 1, this.ttsLineIndex + 4)
      .map(s => ({ text: s.text, voice, rate }));
    if (items.length) {
      void this.electron.ttsPrefetch(items);
    }
  }

  private async advanceTtsLine(): Promise<void> {
    if (!this.ttsActive()) return;
    if (this.ttsLineIndex < this.ttsLines.length - 1) {
      this.ttsLineIndex += 1;
      await this.playCurrentTtsLine();
      return;
    }

    const before = this.currentPage();
    if (before >= Math.max(0, this.pageCount() - 1)) {
      this.ttsStatus.set(AudioStatus.ENDING);
      this.stopTts();
      return;
    }

    this.nextPage();
    await this.afterPageChangeForTts('start');
  }

  private async afterPageChangeForTts(position: 'start' | 'end'): Promise<void> {
    await new Promise(r => setTimeout(r, 180));
    this.reloadTtsLines();
    if (this.ttsLines.length === 0) {
      this.ttsError.set('Sem texto nesta página');
      this.ttsStatus.set(AudioStatus.ERROR);
      return;
    }
    this.ttsLineIndex = position === 'end' ? Math.max(0, this.ttsLines.length - 1) : 0;
    await this.playCurrentTtsLine();
  }

  private applyTtsHighlight(text: string): void {
    this.clearTtsHighlight();
    const contents = this.activeContents();
    const cfi = cfiForSentence(contents, text);
    if (!cfi || !this.rendition) return;
    try {
      this.rendition.annotations.highlight(
        cfi,
        {},
        undefined,
        'br-tts-hit',
        {
          fill: '#818cf8',
          'fill-opacity': '0.4',
          'mix-blend-mode': 'multiply'
        }
      );
      this.ttsHighlightCfi = cfi;
    } catch (e) {
      console.warn('[reader-text] TTS highlight failed', e);
    }
  }

  private clearTtsHighlight(): void {
    if (this.ttsHighlightCfi && this.rendition) {
      try {
        this.rendition.annotations.remove(this.ttsHighlightCfi, 'highlight');
      } catch {}
    }
    this.ttsHighlightCfi = null;
  }

  private clearTtsAudio(): void {
    if (this.ttsAudio) {
      try {
        this.ttsAudio.onended = null;
        this.ttsAudio.onerror = null;
        this.ttsAudio.pause();
        this.ttsAudio.src = '';
      } catch {}
      this.ttsAudio = null;
    }
  }

  private openAnnotationPopup(annotation: BookAnnotation): void {
    this.dismissTextSelect();
    this.showToc.set(false);
    this.showTypography.set(false);
    this.chromeVisible.set(false);
    this.editingAnnotation.set(annotation);
  }

  async onAnnotationSave(updated: BookAnnotation): Promise<void> {
    const previousCfi = this.editingAnnotation()?.cfiRange || updated.cfiRange;
    const saved = await this.electron.saveBookAnnotation({
      ...updated,
      markType: updated.markType || 'Annotation',
      fkBook: this.bookId
    });
    this.editingAnnotation.set(null);
    if (!saved) return;

    const list = [...this.annotations()];
    const idx = list.findIndex(a => a.id === saved.id);
    if (idx >= 0) {
      list[idx] = saved;
    } else {
      list.unshift(saved);
    }
    this.annotations.set(list);

    if (previousCfi && previousCfi !== saved.cfiRange) {
      this.removeHighlight(previousCfi);
    }
    if (saved.cfiRange) {
      this.removeHighlight(saved.cfiRange);
      this.addHighlight(saved);
    }
  }

  async onAnnotationDelete(): Promise<void> {
    const current = this.editingAnnotation();
    this.editingAnnotation.set(null);
    if (!current?.id) return;

    const ok = await this.electron.deleteBookAnnotation(current.id);
    if (!ok) return;

    this.annotations.set(this.annotations().filter(a => a.id !== current.id));
    if (current.cfiRange) this.removeHighlight(current.cfiRange);
  }

  onAnnotationCancel(): void {
    this.editingAnnotation.set(null);
  }

  private annotationColorHex(color?: string): string {
    const key = (color as BookAnnotationColor) || BookAnnotationColor.Yellow;
    return BOOK_ANNOTATION_COLOR_HEX[key] || BOOK_ANNOTATION_COLOR_HEX[BookAnnotationColor.Yellow];
  }

  /**
   * After locations.generate: fill missing cfiRange from page, and reconcile
   * page vs CFI when they diverge by >= ANNOTATION_PAGE_CFI_DIFF_THRESHOLD.
   */
  private async hydrateAnnotationCfis(): Promise<void> {
    const book = this.epubBook;
    if (!book?.locations) return;

    const localPages = Math.max(1, book.locations.length());
    const list = [...this.annotations()];
    let changedAny = false;

    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.id) continue;

      const cfi = (a.cfiRange || '').trim();
      let pageFromCfi: number | null = null;
      let cfiFromPage: string | null = null;

      if (cfi) {
        try {
          const raw = book.locations.locationFromCfi(cfi) as unknown;
          const loc = typeof raw === 'number' ? raw : Number(raw);
          if (!Number.isNaN(loc)) pageFromCfi = Math.max(0, Math.floor(loc));
        } catch { /* ignore */ }
      }

      if (!cfi || pageFromCfi == null) {
        try {
          const page = Math.min(Math.max(0, a.page ?? 0), Math.max(0, localPages - 1));
          const generated = book.locations.cfiFromLocation(page) as string;
          if (typeof generated === 'string' && generated.trim()) {
            cfiFromPage = generated.trim();
          }
        } catch { /* ignore */ }
      }

      const result = reconcileAnnotationPageAndCfi({
        page: a.page ?? 0,
        pages: a.pages ?? localPages,
        cfiRange: cfi,
        pageFromCfi,
        cfiFromPage,
        localPages
      });

      if (!result.changed) continue;

      const saved = await this.electron.saveBookAnnotation({
        ...a,
        page: result.page,
        pages: result.pages,
        cfiRange: result.cfiRange
      });
      if (saved) {
        list[i] = saved;
        changedAny = true;
      }
    }

    if (changedAny) {
      this.annotations.set(list);
    }
  }

  private applyAnnotations(): void {
    if (!this.rendition) return;
    for (const a of this.annotations()) {
      if (a.cfiRange) this.addHighlight(a);
    }
  }

  private addHighlight(annotation: BookAnnotation): void {
    if (!this.rendition || !annotation.cfiRange) return;
    try {
      this.rendition.annotations.highlight(
        annotation.cfiRange,
        { id: annotation.id },
        () => {
          const found =
            this.annotations().find(a => a.id === annotation.id) ||
            this.annotations().find(a => a.cfiRange === annotation.cfiRange) ||
            annotation;
          this.openAnnotationPopup({ ...found });
        },
        'br-annotation',
        {
          fill: this.annotationColorHex(annotation.color),
          'fill-opacity': '0.35',
          'mix-blend-mode': 'multiply'
        }
      );
    } catch (e) {
      console.warn('[reader-text] highlight failed', e);
    }
  }

  private removeHighlight(cfiRange: string): void {
    if (!this.rendition || !cfiRange) return;
    try {
      this.rendition.annotations.remove(cfiRange, 'highlight');
    } catch { /* ignore */ }
  }

  private hasActiveTextSelection(): boolean {
    try {
      const contents = this.activeContents();
      return this.hasSelectionInWindow(contents?.window);
    } catch { /* ignore */ }
    return false;
  }

  private hasSelectionInWindow(win?: Window | null): boolean {
    try {
      const sel = win?.getSelection?.();
      if (sel && !sel.isCollapsed && (sel.toString() || '').trim()) return true;
    } catch { /* ignore */ }
    return false;
  }

  private abortPanForSelect(): void {
    this.panSelectMode = true;
    this.didDrag = false;
    this.overscrollX = 0;
    this.overscrollY = 0;
    this.syncOverscrollSignals(false);
    this.panning.set(false);
    this.deactivatePeekLayer();
  }

  private activatePeekLayer(): void {
    this.peekLayerActive.set(true);
    const peek = this.viewerPeekRef?.nativeElement;
    if (peek) peek.style.visibility = 'visible';
    const shell = this.peekShellRef?.nativeElement;
    if (shell) {
      shell.style.visibility = 'visible';
      shell.style.opacity = '1';
    }
  }

  private deactivatePeekLayer(): void {
    this.peekLayerActive.set(false);
    const peek = this.viewerPeekRef?.nativeElement;
    if (peek) peek.style.visibility = '';
    const shell = this.peekShellRef?.nativeElement;
    if (shell) {
      shell.style.visibility = '';
      shell.style.opacity = '';
    }
  }

  /** RTL horizontal: mirror slide/fold edge without swapping logical next/prev. */
  private turnMirror(): boolean {
    return this.isRtl() && this.isHorizontalMode();
  }

  private visualTurnDir(logical: 1 | -1): TurnDir {
    return (this.turnMirror() ? -logical : logical) as TurnDir;
  }

  private markBookTurn(
    phase: 'start' | 'paint' | 'commit' | 'end' | 'peek-miss'
  ): void {
    try {
      performance.mark(`book-turn:${phase}`);
    } catch {
      /* ignore */
    }
  }

  private async doubleRaf(): Promise<void> {
    await new Promise<void>(r => requestAnimationFrame(() => r()));
    await new Promise<void>(r => requestAnimationFrame(() => r()));
  }

  /** True when epub.js contents belong to the peek iframe (shared spine hooks). */
  private isPeekContents(contents: any): boolean {
    try {
      const peekEl = this.viewerPeekRef?.nativeElement;
      if (!peekEl) return false;
      const iframe = contents?.document?.defaultView?.frameElement as HTMLElement | null;
      return !!iframe && peekEl.contains(iframe);
    } catch {
      return false;
    }
  }

  /** Wait until peek host/iframe has non-zero layout before peek.next/prev. */
  private async waitForPeekLayout(peekEl: HTMLElement): Promise<void> {
    for (let i = 0; i < 12; i++) {
      const iframe = peekEl.querySelector('iframe') as HTMLIFrameElement | null;
      if (
        peekEl.clientWidth > 0 &&
        peekEl.clientHeight > 0 &&
        (!iframe || iframe.clientWidth > 0)
      ) {
        await this.doubleRaf();
        return;
      }
      await this.doubleRaf();
    }
  }

  /** Warm peek rendition after navigation so the next turn is less likely to miss. */
  private scheduleAdjacentPeekPreload(): void {
    if (!this.isPaginatedMode() || prefersReducedMotion() || this.isContinuousScrollMode()) {
      return;
    }
    // Curl uses offscreen bitmaps — do not navigate peek iframes in the visible window.
    if (this.isCurlOverscrollMode()) return;
    this.cancelAdjacentPeekPreload();
    const run = () => {
      this.peekPreloadTimer = null;
      if (this.turningPage || this.driverActive() || !this.rendition || this.ended) return;
      void (async () => {
        try {
          await this.loadPeek(1);
          if (this.turningPage || this.driverActive()) return;
          await this.loadPeek(-1);
        } finally {
          // Never hide an in-flight interactive turn's peek.
          if (!this.turningPage && !this.driverActive()) {
            this.peekStale = true;
            this.peekDirection = 0;
            this.deactivatePeekLayer();
          }
        }
      })();
    };
    const ric = (window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (typeof ric === 'function') {
      this.peekPreloadTimer = ric(() => run(), { timeout: 1200 });
    } else {
      this.peekPreloadTimer = setTimeout(run, 500);
    }
  }

  private cancelAdjacentPeekPreload(): void {
    if (this.peekPreloadTimer != null) {
      clearTimeout(this.peekPreloadTimer as number);
      this.peekPreloadTimer = null;
    }
  }

  private attachContentPan(contents: any): void {
    const doc: Document | undefined = contents?.document;
    const win: Window | undefined = contents?.window;
    if (!doc || !win) return;

    try {
      doc.body.style.cursor = 'grab';
    } catch { /* ignore */ }

    const setDocUserSelect = (enabled: boolean): void => {
      try {
        const val = enabled ? '' : 'none';
        doc.documentElement.style.userSelect = val;
        doc.documentElement.style.webkitUserSelect = val;
        if (doc.body) {
          doc.body.style.userSelect = val;
          doc.body.style.webkitUserSelect = val;
        }
      } catch { /* ignore */ }
    };

    const onSelectionChange = (): void => {
      if (this.panPointerId == null || this.panSelectMode) return;
      // Se já está arrastando a página, desconsidera alterações espúrias de seleção nativa
      if (this.didDrag) {
        try {
          win.getSelection()?.removeAllRanges();
        } catch { /* ignore */ }
        return;
      }
      if (this.hasSelectionInWindow(win)) {
        this.abortPanForSelect();
      }
    };

    const cleanupGlobalWindowListeners = () => {
      if (this.panGlobalCleanup) {
        try {
          this.panGlobalCleanup();
        } catch { /* ignore */ }
        this.panGlobalCleanup = null;
      }
    };

    const onDown = (ev: PointerEvent) => {
      if (ev.button !== 0 || this.loading()) return;
      cleanupGlobalWindowListeners();
      this.didDrag = false;
      this.panSelectMode = false;
      this.overscrollX = 0;
      this.overscrollY = 0;
      this.panVelocityX = 0;
      this.panVelocityY = 0;
      this.panStartTime = performance.now();
      this.panLastMoveAt = this.panStartTime;
      this.panPointerId = ev.pointerId;
      this.panStartX = ev.screenX;
      this.panStartY = ev.screenY;
      this.panLastX = ev.screenX;
      this.panLastY = ev.screenY;
      this.panLastClientY = ev.clientY;
      this.syncOverscrollSignals(false);

      // Existing selection — let the user extend/clear it; do not start pan
      if (this.hasSelectionInWindow(win)) {
        this.panSelectMode = true;
        this.panning.set(false);
        return;
      }

      this.panning.set(true);
      try {
        doc.body.style.cursor = 'grabbing';
      } catch { /* ignore */ }

      // Listen on top window so drag scrubbing continues smoothly even when
      // Curl hides the iframe (viewer.style.visibility = 'hidden') and presents canvas.
      const onGlobalMove = (e: PointerEvent) => onMove(e);
      const onGlobalUp = (e: PointerEvent) => onUp(e);

      window.addEventListener('pointermove', onGlobalMove, { capture: true });
      window.addEventListener('pointerup', onGlobalUp, { capture: true });
      window.addEventListener('pointercancel', onGlobalUp, { capture: true });

      this.panGlobalCleanup = () => {
        window.removeEventListener('pointermove', onGlobalMove, { capture: true });
        window.removeEventListener('pointerup', onGlobalUp, { capture: true });
        window.removeEventListener('pointercancel', onGlobalUp, { capture: true });
      };
    };

    const onMove = (ev: PointerEvent) => {
      if (this.panPointerId !== ev.pointerId) return;
      if (this.panSelectMode) return;
      if (!this.panning()) return;

      const dx = ev.screenX - this.panLastX;
      const dy = ev.screenY - this.panLastY;
      this.panLastX = ev.screenX;
      this.panLastY = ev.screenY;
      this.panLastClientY = ev.clientY;
      const now = performance.now();
      const dt = Math.max(1, now - this.panLastMoveAt) / 1000;
      this.panVelocityX = dx / dt;
      this.panVelocityY = dy / dt;
      this.panLastMoveAt = now;

      if (!this.didDrag) {
        if (this.hasSelectionInWindow(win) || this.hasActiveTextSelection()) {
          this.abortPanForSelect();
          return;
        }
        const totalDistance = Math.hypot(ev.screenX - this.panStartX, ev.screenY - this.panStartY);
        if (totalDistance <= DRAG_THRESHOLD_PX) {
          return;
        }
        this.didDrag = true;
        setDocUserSelect(false);
      }

      try {
        if (this.isContinuousScrollMode()) {
          const container = this.continuousScrollContainer();
          if (container) {
            container.scrollBy(-dx, -dy);
          } else {
            win.scrollBy(-dx, -dy);
          }
          return;
        }

        // Paginated: scroll internal content first; at edge, rubber-band overscroll
        if (this.isPaginatedMode()) {
          const host = this.viewerHostRef?.nativeElement;
          const horizontal = this.isHorizontalMode();
          if (horizontal) {
            // Prefer vertical scroll inside page when content overflows
            if (Math.abs(dy) >= Math.abs(dx) && this.canScrollContents(dy > 0 ? 1 : -1)) {
              win.scrollBy(0, -dy);
              this.overscrollX = 0;
              this.overscrollY = 0;
              this.syncOverscrollSignals(false);
              return;
            }
            const maxX = host?.clientWidth || window.innerWidth;
            this.peekViewportW.set(maxX);
            this.peekViewportH.set(host?.clientHeight || window.innerHeight);
            this.overscrollX = Math.max(-maxX, Math.min(maxX, this.overscrollX + dx));
            this.overscrollY = 0;
            // Curl: do not slide the live iframe — progress drives the canvas only
            if (this.isCurlOverscrollMode()) {
              this.overscrollXSignal.set(0);
              this.overscrollYSignal.set(0);
              this.overscrollAnimatingSignal.set(false);
            } else {
              this.syncOverscrollSignals(false);
            }
            if (this.overscrollX !== 0) {
              if (!this.isCurlOverscrollMode()) {
                this.activatePeekLayer();
              }
              this.ensurePeekForOverscroll();
              const dir = this.overscrollPageDirection();
              if (dir && !prefersReducedMotion()) {
                this.queueDragDriverScrub(dir, maxX);
              }
            }
            return;
          }

          // Vertical pagination
          if (this.canScrollContents(dy > 0 ? 1 : -1)) {
            win.scrollBy(0, -dy);
            this.overscrollX = 0;
            this.overscrollY = 0;
            this.syncOverscrollSignals(false);
            return;
          }
          const maxY = host?.clientHeight || window.innerHeight;
          this.peekViewportW.set(host?.clientWidth || window.innerWidth);
          this.peekViewportH.set(maxY);
          this.overscrollY = Math.max(-maxY, Math.min(maxY, this.overscrollY + dy));
          this.overscrollX = 0;
          this.syncOverscrollSignals(false);
          if (this.overscrollY !== 0) {
            this.activatePeekLayer();
            this.ensurePeekForOverscroll();
            const dir = this.overscrollPageDirection();
            if (dir && !prefersReducedMotion()) {
              this.queueDragDriverScrub(dir, maxY);
            }
          }
          return;
        }

        // Zoom pan fallback
        win.scrollBy(-dx, -dy);
      } catch { /* ignore */ }
    };

    const onUp = (ev: PointerEvent) => {
      if (this.panPointerId !== ev.pointerId) return;
      cleanupGlobalWindowListeners();
      const hadDrag = this.didDrag;
      const wasSelect = this.panSelectMode || (!hadDrag && this.hasSelectionInWindow(win));
      this.panPointerId = null;
      this.panSelectMode = false;
      this.panning.set(false);
      setDocUserSelect(true);

      try {
        doc.body.style.cursor = 'grab';
      } catch { /* ignore */ }

      if (hadDrag) {
        // Se arrastou a página, descarta qualquer seleção acidental e executa transição
        try {
          win.getSelection()?.removeAllRanges();
        } catch { /* ignore */ }
        this.pendingSelectShow = null;

        if (this.isPaginatedMode()) {
          this.commitOrSnapOverscroll();
        } else {
          this.resetOverscroll(true);
          this.deactivatePeekLayer();
          this.didDrag = false;
        }
        return;
      }

      // Não arrastou: sempre garante flag de arraste zerada para cliques subsequentes
      this.didDrag = false;

      if (wasSelect) {
        this.resetOverscroll(false);
        this.deactivatePeekLayer();
        // Flush deferred popup after drag ends (selected may have queued while pointer was down)
        this.flushPendingSelectShow(contents);
        return;
      }

      this.resetOverscroll(true);
      this.deactivatePeekLayer();

      // Clique simples e rápido (sem movimento significativo e sem seleção):
      // Garante despacho confiável mesmo se o evento click do iframe atrasar ou sofrer jitter.
      const elapsed = performance.now() - this.panStartTime;
      const totalDist = Math.hypot(ev.screenX - this.panStartX, ev.screenY - this.panStartY);
      if (elapsed <= 300 && totalDist <= DRAG_THRESHOLD_PX && !this.hasActiveTextSelection()) {
        const mapped = this.iframeEventToHostLocal(ev);
        if (mapped) {
          this.ingestMappedTap('pointer', mapped);
        }
      }
    };

    doc.addEventListener('pointerdown', onDown);
    doc.addEventListener('pointermove', onMove);
    doc.addEventListener('pointerup', onUp);
    doc.addEventListener('pointercancel', onUp);
    doc.addEventListener('selectionchange', onSelectionChange);

    this.contentCleanups.push(() => {
      cleanupGlobalWindowListeners();
      setDocUserSelect(true);
      doc.removeEventListener('pointerdown', onDown);
      doc.removeEventListener('pointermove', onMove);
      doc.removeEventListener('pointerup', onUp);
      doc.removeEventListener('pointercancel', onUp);
      doc.removeEventListener('selectionchange', onSelectionChange);
    });
  }

  private syncOverscrollSignals(animating: boolean): void {
    this.overscrollAnimatingSignal.set(animating);
    this.overscrollXSignal.set(this.overscrollX);
    this.overscrollYSignal.set(this.overscrollY);
  }

  private resetOverscroll(animate: boolean): void {
    this.overscrollX = 0;
    this.overscrollY = 0;
    this.syncOverscrollSignals(animate);
    if (animate) {
      setTimeout(() => this.overscrollAnimatingSignal.set(false), 200);
    }
  }

  /** Resolve overscroll direction: 1 = next page, -1 = previous. */
  private overscrollPageDirection(): 1 | -1 | 0 {
    if (this.isHorizontalMode()) {
      const amount = this.overscrollX;
      if (amount === 0) return 0;
      if (this.usesRtlPageKeys()) return amount > 0 ? 1 : -1;
      return amount < 0 ? 1 : -1;
    }
    const amount = this.overscrollY;
    if (amount === 0) return 0;
    return amount < 0 ? 1 : -1;
  }

  /** Load adjacent visual page for ViewPager-style peek (no mid-gesture hide). */
  private ensurePeekForOverscroll(): void {
    const amount = this.isHorizontalMode() ? this.overscrollX : this.overscrollY;
    if (Math.abs(amount) < OVERSCROLL_PEEK_REVEAL_PX) return;
    const dir = this.overscrollPageDirection();
    if (!dir) return;
    // Already loaded or in-flight for this direction
    if (this.peekDirection === dir && !this.peekStale) return;
    void this.loadPeek(dir);
  }

  /**
   * Load adjacent visual page for ViewPager-style peek.
   * Reuses a single peek Rendition to avoid leaking spine.hooks.content handlers.
   * @returns true when peek shows a distinct page from the main viewer.
   */
  private async loadPeek(dir: 1 | -1): Promise<boolean> {
    if (!this.epubBook || !this.rendition || !this.isPaginatedMode()) return false;
    const peekEl = this.viewerPeekRef?.nativeElement;
    if (!peekEl) return false;

    const mainLoc = this.rendition.location;
    if (dir > 0 && mainLoc?.atEnd) return false;
    if (dir < 0 && mainLoc?.atStart) return false;

    const cfi = this.currentCfi() || mainLoc?.start?.cfi;
    if (!cfi) return false;

    this.peekDirection = dir;
    this.peekStale = false;
    const token = ++this.peekLoadToken;

    try {
      let peek = await this.ensurePeekRendition();
      if (!peek || token !== this.peekLoadToken) return false;

      await peek.display(cfi);
      if (token !== this.peekLoadToken) return false;

      // Paginated epub.js needs a non-zero iframe before next/prev or it can
      // jump multiple columns / an entire chapter.
      await this.waitForPeekLayout(peekEl);
      if (token !== this.peekLoadToken) return false;

      // Paginated epub.js often keeps the same start.cfi across column pages and
      // does not change iframe scrollX/Y — do not require CFI/scroll deltas.
      if (dir > 0) await peek.next();
      else await peek.prev();
      if (token !== this.peekLoadToken) return false;

      // Ensure the iframe has rendered the new page before resolving
      await this.waitForPeekLayout(peekEl);
      await this.doubleRaf();
      if (token !== this.peekLoadToken) return false;

      const peekCfi = (peek as any)?.location?.start?.cfi;
      if (peekCfi) {
        const targetPage = this.currentPage() + dir;
        if (targetPage >= 0 && targetPage < this.pageCount()) {
          this.adjacentScreenCfiMap.set(targetPage, peekCfi);
        }
      }

      return true;
    } catch (e) {
      console.warn('[reader-text] peek load failed', e);
      this.markBookTurn('peek-miss');
      this.peekStale = true;
      this.peekDirection = 0;
      return false;
    }
  }

  /**
   * Soft-invalidate peek state without destroying the Rendition (keeps hooks).
   * @param hideLayer when true, hide the peek layer visually.
   * @param destroy when true, fully destroy the peek Rendition (book close only).
   */
  private destroyPeekRendition(hideLayer = true, destroy = false): void {
    this.peekLoadToken++;
    this.peekDirection = 0;
    this.peekStale = true;
    if (destroy) {
      try {
        this.peekRendition?.destroy();
      } catch {
        /* ignore */
      }
      this.peekRendition = null;
      const peekEl = this.viewerPeekRef?.nativeElement;
      if (peekEl) {
        try {
          peekEl.innerHTML = '';
        } catch {
          /* ignore */
        }
      }
    }
    if (hideLayer) this.deactivatePeekLayer();
  }

  private invalidatePeek(): void {
    // Soft invalidate — keep the reusable peek rendition alive
    this.destroyPeekRendition(true, false);
  }

  /** On pointerup: turn page if past threshold / fling, else snap back (anchor). */
  private commitOrSnapOverscroll(): void {
    const host = this.viewerHostRef?.nativeElement;
    const viewportSize = this.isHorizontalMode()
      ? (host?.clientWidth || window.innerWidth)
      : (host?.clientHeight || window.innerHeight);
    const threshold = Math.max(
      OVERSCROLL_COMMIT_MIN_PX,
      viewportSize * OVERSCROLL_COMMIT_RATIO
    );

    const amount = this.isHorizontalMode() ? this.overscrollX : this.overscrollY;
    const velocity = this.isHorizontalMode() ? this.panVelocityX : this.panVelocityY;
    const dir = this.overscrollPageDirection();
    const fling =
      dir !== 0 &&
      Math.abs(velocity) >= OVERSCROLL_FLING_PX_PER_S &&
      Math.sign(velocity) === Math.sign(amount);

    if (dir !== 0 && (Math.abs(amount) >= threshold || fling)) {
      void this.commitDriverTurn(dir, viewportSize);
      return;
    }

    // Snap back — hide peek synchronously to avoid overlap flash
    void this.cancelDriverTurn();
  }

  /**
   * Scrub the page-turn driver from the current overscroll.
   * Serializes ensureDragDriver so every pointermove does not cancel peek loads.
   */
  private queueDragDriverScrub(dir: 1 | -1, viewportSize: number): void {
    if (
      (this.turnDriver || this.bookCurlDragActive) &&
      this.turnDriverDir === dir
    ) {
      this.scrubDriverFromOverscroll(viewportSize);
      return;
    }
    void this.ensureDragDriver(dir, viewportSize).then(ok => {
      if (!ok) return;
      // Pointer may have been released while peek was loading.
      if (this.panPointerId == null && !this.turningPage) return;
      this.scrubDriverFromOverscroll(viewportSize);
    });
  }

  private async ensureDragDriver(dir: 1 | -1, viewportSize: number): Promise<boolean> {
    if (
      (this.turnDriver || this.bookCurlDragActive) &&
      this.turnDriverDir === dir
    ) {
      return true;
    }
    if (this.dragDriverPromise && this.dragDriverPendingDir === dir) {
      return this.dragDriverPromise;
    }

    this.dragDriverPendingDir = dir;
    this.dragDriverPromise = this.createDragDriver(dir, viewportSize).finally(() => {
      if (this.dragDriverPendingDir === dir) {
        this.dragDriverPromise = null;
        this.dragDriverPendingDir = 0;
      }
    });
    return this.dragDriverPromise;
  }

  private async createDragDriver(dir: 1 | -1, viewportSize: number): Promise<boolean> {
    const viewer = this.viewerShellRef?.nativeElement || this.viewerRef?.nativeElement;
    const peek = this.peekShellRef?.nativeElement || this.viewerPeekRef?.nativeElement;
    if (!viewer || !peek) return false;

    if (
      (this.turnDriver || this.bookCurlDragActive) &&
      this.turnDriverDir === dir
    ) {
      return true;
    }

    this.turnDriver?.release();
    this.turnDriver = null;
    this.bookCurlDragActive = false;
    this.driverActive.set(false);

    this.cancelAdjacentPeekPreload();

    const effect = this.effectiveBookTransition();
    const axis: TurnAxis = this.isHorizontalMode() ? 'x' : 'y';
    const isCurl =
      (effect === PageTransitionType.CurlPage ||
        effect === PageTransitionType.Curl3DPage) &&
      this.isHorizontalMode();

    if (!isCurl) {
      // Reuse peek already loaded for this direction during the gesture.
      if (!(this.peekDirection === dir && !this.peekStale && this.peekRendition)) {
        const peekOk = await this.loadPeek(dir);
        if (!peekOk) return false;
      }
    }
    // Aborted or direction flipped while awaiting peek / bitmaps.
    if (this.dragDriverPendingDir !== dir) return false;
    if (this.panPointerId != null && this.overscrollPageDirection() !== dir) {
      return false;
    }

    if (isCurl) {
      // Offscreen bitmaps only — never navigate peek iframes in the visible window.
      this.turnDriverDir = dir;
      const bitmaps = await this.ensureBookCurlBitmaps(dir as TurnDir);
      if (this.dragDriverPendingDir !== dir) return false;
      if (bitmaps) {
        this.bookCurlDragActive = true;
        this.turnDriverDir = dir;
        const canvas = this.ensureBookCurlCanvas();
        if (canvas) {
          viewer.style.visibility = 'hidden';
          peek.style.visibility = 'hidden';
          this.scrubDriverFromOverscroll(viewportSize);
          this.driverActive.set(true);
          this.overscrollXSignal.set(0);
          this.overscrollYSignal.set(0);
          this.markBookTurn('paint');
          return true;
        }
      }
      // Bitmaps unavailable — Fade stand-in needs peek
      if (!(this.peekDirection === dir && !this.peekStale && this.peekRendition)) {
        const peekOk = await this.loadPeek(dir);
        if (!peekOk) return false;
      }
      this.activatePeekLayer();
      await this.doubleRaf();
    } else {
      this.activatePeekLayer();
      await this.doubleRaf();
    }

    const playEffect = isCurl ? PageTransitionType.Fade : effect;
    const visualDir = this.visualTurnDir(dir);
    this.turnDriver = new PageTurnDriver({
      outgoing: viewer,
      incoming: peek,
      effect: playEffect,
      axis,
      dir: visualDir,
      size: viewportSize,
      variant: 'book'
    });
    this.turnDriverDir = dir;
    this.scrubDriverFromOverscroll(viewportSize);
    this.driverActive.set(true);
    this.overscrollXSignal.set(0);
    this.overscrollYSignal.set(0);
    this.markBookTurn('paint');
    return true;
  }

  private scrubDriverFromOverscroll(viewportSize: number): void {
    const amount = this.isHorizontalMode() ? this.overscrollX : this.overscrollY;
    const progress = Math.min(1, Math.abs(amount) / Math.max(viewportSize, 1));

    if (this.bookCurlDragActive && this.bookCurlBitmaps && this.bookCurlCanvas) {
      const effect = this.effectiveBookTransition();
      const mode = effect === PageTransitionType.Curl3DPage ? '3d' : '2d';
      const logicalDir = this.turnDriverDir as TurnDir;
      const host = this.viewerHostRef?.nativeElement;
      const hostRect = host?.getBoundingClientRect();
      const pointerY = hostRect ? this.panLastClientY - hostRect.top : undefined;
      this.ngZone.runOutsideAngular(() => {
        paintBookCurlProgress(
          this.bookCurlCanvas!,
          this.bookCurlBitmaps!,
          progress,
          logicalDir,
          this.turnMirror(),
          mode,
          pointerY
        );
      });
      return;
    }

    if (!this.turnDriver) return;
    const visualDir = this.visualTurnDir(this.turnDriverDir);
    const position = -visualDir * progress;
    this.ngZone.runOutsideAngular(() => {
      this.turnDriver?.setPosition(position);
    });
  }

  private async commitDriverTurn(dir: 1 | -1, viewportSize: number): Promise<void> {
    const effect = this.effectiveBookTransition();
    const isCurl =
      (effect === PageTransitionType.CurlPage || effect === PageTransitionType.Curl3DPage) &&
      this.isHorizontalMode();

    const amount = this.isHorizontalMode() ? this.overscrollX : this.overscrollY;
    const fromProgress = Math.min(1, Math.abs(amount) / Math.max(viewportSize, 1));

    // Ensure peek + driver / curl bitmaps exist
    if (
      (!this.turnDriver && !this.bookCurlDragActive) ||
      this.turnDriverDir !== dir
    ) {
      const ok = await this.ensureDragDriver(dir, viewportSize);
      if (!ok) {
        this.resetOverscroll(false);
        this.deactivatePeekLayer();
        this.markBookTurn('peek-miss');
        await this.turnPageAndSettle(dir);
        return;
      }
    }

    this.turningPage = true;
    this.turningSignal.set(true);
    this.markBookTurn('start');
    this.cancelAdjacentPeekPreload();
    this.resetOverscroll(false);

    try {
      if (isCurl) {
        this.turnDriver?.release();
        this.turnDriver = null;
        this.driverActive.set(false);
        const host = this.viewerHostRef?.nativeElement;
        const viewer =
          this.viewerShellRef?.nativeElement || this.viewerRef?.nativeElement;
        const peek =
          this.peekShellRef?.nativeElement || this.viewerPeekRef?.nativeElement;
        if (host && viewer && peek) {
          const bitmaps =
            this.bookCurlBitmaps || (await this.ensureBookCurlBitmaps(dir as TurnDir));
          // Reuse drag canvas — do NOT teardown before play (avoids blank+chrome frame)
          const reuseCanvas = this.bookCurlCanvas;
          if (bitmaps) {
            await this.ngZone.runOutsideAngular(() =>
              playBookCurlTurn({
                host,
                viewerShell: viewer,
                peekShell: peek,
                bitmaps,
                dir: dir as TurnDir,
                mirror: this.turnMirror(),
                mode: effect === PageTransitionType.Curl3DPage ? '3d' : '2d',
                fromProgress,
                surfaceColor: PAGE_BG,
                canvas: reuseCanvas,
                bottomInsetCss: this.bookCurlCanvasBottomInsetCss(viewer),
                commit: () =>
                  this.ngZone.run(async () => {
                    this.markBookTurn('commit');
                    await this.turnPageAndSettle(dir);
                  }),
                owner: 'book-reader'
              })
            );
          } else {
            this.activatePeekLayer();
            // Capture miss — finish with Fade (same effect as drag stand-in).
            const axis: TurnAxis = this.isHorizontalMode() ? 'x' : 'y';
            await this.ngZone.runOutsideAngular(() =>
              playPageTurn({
                outgoing: viewer,
                incoming: peek,
                effect: PageTransitionType.Fade,
                axis,
                dir: dir as TurnDir,
                mirror: this.turnMirror(),
                size: viewportSize,
                variant: 'book',
                commit: () =>
                  this.ngZone.run(async () => {
                    this.markBookTurn('commit');
                    await this.turnPageAndSettle(dir);
                  }),
                owner: 'book-reader'
              })
            );
          }
        } else {
          this.markBookTurn('commit');
          await this.turnPageAndSettle(dir);
        }
      } else {
        const visualDir = this.visualTurnDir(dir);
        const driver = this.turnDriver!;
        await this.ngZone.runOutsideAngular(() =>
          driver.animateTo(-visualDir, PAGE_TURN_DURATION_MS, () =>
            this.ngZone.run(async () => {
              this.markBookTurn('commit');
              await this.turnPageAndSettle(dir);
            })
          )
        );
      }
    } finally {
      this.turnDriver = null;
      this.dragDriverPromise = null;
      this.dragDriverPendingDir = 0;
      this.bookCurlDragActive = false;
      this.curlAnimating = false;
      this.releaseBookCurlBitmaps();
      this.teardownBookCurlCanvas();
      this.driverActive.set(false);
      this.turningPage = false;
      this.turningSignal.set(false);
      this.deactivatePeekLayer();
      this.peekStale = true;
      this.peekDirection = 0;
      this.clearViewerAnimStyles();
      this.didDrag = false;
      this.resetOverscroll(false);
      this.markBookTurn('end');
      this.scheduleAdjacentPeekPreload();
      this.scheduleAdjacentBookBitmaps();
    }
  }

  private async cancelDriverTurn(): Promise<void> {
    if (this.bookCurlDragActive && this.bookCurlBitmaps && this.bookCurlCanvas) {
      this.turningSignal.set(true);
      this.driverActive.set(true);
      try {
        await this.ngZone.runOutsideAngular(
          () =>
            new Promise<void>(resolve => {
              const start = performance.now();
              const from = (() => {
                const host = this.viewerHostRef?.nativeElement;
                const size = this.isHorizontalMode()
                  ? host?.clientWidth || window.innerWidth
                  : host?.clientHeight || window.innerHeight;
                const amount = this.isHorizontalMode()
                  ? this.overscrollX
                  : this.overscrollY;
                return Math.min(1, Math.abs(amount) / Math.max(size, 1));
              })();
              const mode =
                this.effectiveBookTransition() === PageTransitionType.Curl3DPage
                  ? '3d'
                  : '2d';
              const tick = (now: number) => {
                const t = Math.min(1, (now - start) / 180);
                const p = from * (1 - t);
                paintBookCurlProgress(
                  this.bookCurlCanvas!,
                  this.bookCurlBitmaps!,
                  p,
                  this.turnDriverDir as TurnDir,
                  this.turnMirror(),
                  mode
                );
                if (t >= 1) {
                  resolve();
                  return;
                }
                requestAnimationFrame(tick);
              };
              requestAnimationFrame(tick);
            })
        );
      } finally {
        this.bookCurlDragActive = false;
        this.curlAnimating = false;
        this.releaseBookCurlBitmaps();
        this.teardownBookCurlCanvas();
        this.driverActive.set(false);
        this.turningSignal.set(false);
      }
      this.resetOverscroll(false);
      this.deactivatePeekLayer();
      this.clearViewerAnimStyles();
      this.didDrag = false;
      return;
    }

    if (this.turnDriver) {
      this.turningSignal.set(true);
      this.driverActive.set(true);
      try {
        await this.ngZone.runOutsideAngular(() =>
          this.turnDriver!.animateTo(0, Math.min(180, PAGE_TURN_DURATION_MS))
        );
      } finally {
        this.turnDriver = null;
        this.dragDriverPromise = null;
        this.dragDriverPendingDir = 0;
        this.driverActive.set(false);
        this.turningSignal.set(false);
      }
    }
    this.resetOverscroll(false);
    this.deactivatePeekLayer();
    this.clearViewerAnimStyles();
    this.didDrag = false;
  }

  /** Active epub.js Contents for the visible view (if any). */
  private activeContents(): any | null {
    if (!this.rendition) return null;
    try {
      const list = this.rendition.getContents();
      if (Array.isArray(list) && list.length > 0) return list[0];
      return list || null;
    } catch {
      return null;
    }
  }

  /** Scroll container used by continuous manager (Tira). */
  private continuousScrollContainer(): HTMLElement | null {
    try {
      const container = (this.rendition as any)?.manager?.container as HTMLElement | undefined;
      return container ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Scroll ~90% of viewport in continuous (tira) mode.
   * Does NOT call rendition.prev/next at edges (avoids bounce to page 3/4).
   * @returns false when already at the scroll edge in that direction.
   */
  private scrollContinuousBy(dir: 1 | -1): boolean {
    const viewportH = this.viewerRef?.nativeElement?.clientHeight || window.innerHeight;
    const step = viewportH * 0.9;
    const container = this.continuousScrollContainer();

    if (container) {
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      const top = container.scrollTop;
      if (dir > 0 && top >= maxScroll - 2) return false;
      if (dir < 0 && top <= 2) return false;
      container.scrollBy({ top: dir * step, behavior: 'smooth' });
      return true;
    }

    const contents = this.activeContents();
    const win: Window | undefined = contents?.window;
    if (win) {
      const docEl = win.document.documentElement;
      const body = win.document.body;
      const scrollTop = win.scrollY || docEl.scrollTop || body?.scrollTop || 0;
      const scrollHeight = Math.max(
        contents.scrollHeight?.() ?? 0,
        docEl.scrollHeight,
        body?.scrollHeight ?? 0
      );
      const clientHeight = win.innerHeight || docEl.clientHeight;
      const maxScroll = scrollHeight - clientHeight;
      if (dir > 0 && scrollTop >= maxScroll - 2) return false;
      if (dir < 0 && scrollTop <= 2) return false;
      win.scrollBy({ top: dir * step, behavior: 'smooth' });
      return true;
    }
    return false;
  }

  private canScrollContents(deltaY: number): boolean {
    const contents = this.activeContents();
    const win: Window | undefined = contents?.window;
    if (!win) return false;
    const docEl = win.document.documentElement;
    const body = win.document.body;
    const scrollTop = win.scrollY || docEl.scrollTop || body?.scrollTop || 0;
    const scrollHeight = Math.max(
      contents.scrollHeight?.() ?? 0,
      docEl.scrollHeight,
      body?.scrollHeight ?? 0
    );
    const clientHeight = win.innerHeight || docEl.clientHeight;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll <= 2) return false;
    if (deltaY > 0 && scrollTop < maxScroll - 1) return true;
    if (deltaY < 0 && scrollTop > 1) return true;
    return false;
  }

  private scrollContentsBy(deltaY: number): void {
    const contents = this.activeContents();
    const win: Window | undefined = contents?.window;
    if (!win) return;
    win.scrollBy(0, deltaY);
  }

  /** @returns true if scrolled within the current page contents */
  private tryScrollContents(dir: 1 | -1): boolean {
    if (!this.isPaginatedMode()) return false;
    const contents = this.activeContents();
    const win: Window | undefined = contents?.window;
    if (!win) return false;

    const docEl = win.document.documentElement;
    const body = win.document.body;
    const scrollTop = win.scrollY || docEl.scrollTop || body?.scrollTop || 0;
    const scrollHeight = Math.max(
      contents.scrollHeight?.() ?? 0,
      docEl.scrollHeight,
      body?.scrollHeight ?? 0
    );
    const clientHeight = win.innerHeight || docEl.clientHeight;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll <= 2) return false;

    const step = clientHeight * 0.9;
    if (dir > 0 && scrollTop + clientHeight < scrollHeight - 2) {
      win.scrollBy({ top: step, behavior: 'smooth' });
      return true;
    }
    if (dir < 0 && scrollTop > 2) {
      win.scrollBy({ top: -step, behavior: 'smooth' });
      return true;
    }
    return false;
  }

  private clearContentPanListeners(): void {
    if (this.panGlobalCleanup) {
      try {
        this.panGlobalCleanup();
      } catch { /* ignore */ }
      this.panGlobalCleanup = null;
    }
    for (const cleanup of this.contentCleanups) {
      try {
        cleanup();
      } catch { /* ignore */ }
    }
    this.contentCleanups = [];
  }

  private async rebuildRendition(resume: string | number): Promise<void> {
    const el = this.viewerRef?.nativeElement;
    if (!el || !this.epubBook) return;
    const cfi = typeof resume === 'string' && resume
      ? resume
      : this.epubBook.locations.cfiFromLocation(typeof resume === 'number' ? resume : this.currentPage());

    this.relocating = true;
    try {
      this.invalidatePeek();
      try {
        this.rendition?.off?.('click', this.onRenditionClick);
        this.rendition?.off?.('dblclick', this.onRenditionDblClick);
        this.rendition?.off?.('selected', this.onRenditionSelected);
        this.rendition?.off?.('touchend', this.onRenditionTouchEnd);
      } catch {}
      this.clearContentPanListeners();
      this.rendition?.destroy();
      this.rendition = null;
      el.innerHTML = '';
      this.createRendition(el);
      this.applyAnnotations();
      if (cfi) {
        await this.rendition!.display(cfi);
      } else {
        await this.rendition!.display();
      }
    } finally {
      this.relocating = false;
    }
  }

  private applyTypography(target?: Rendition | null): void {
    const targets: Rendition[] = [];
    if (target) {
      targets.push(target);
    } else {
      if (this.rendition) targets.push(this.rendition);
      if (this.peekRendition) targets.push(this.peekRendition);
    }
    if (!targets.length) return;

    const tate = this.tateGakiEnabled();
    const furigana = this.furiganaEnabled();
    const pad = MARGIN_PX[this.margin()];
    let lh = SPACING_LH[this.spacing()] ?? this.settings.bookLineHeight();
    if (furigana) {
      // Extra column gap when furigana sits on the "over" side in vertical-rl.
      const bump = tate ? 1.45 : 1.25;
      const cap = tate ? 2.8 : 2.4;
      lh = Math.max(lh, Math.min(cap, lh * bump));
    } else if (tate) {
      lh = Math.max(lh, Math.min(2.2, lh * 1.1));
    }
    const textAlign = this.align();
    let imgMarginLeft = '0';
    let imgMarginRight = 'auto';
    if (textAlign === 'center') {
      imgMarginLeft = 'auto';
      imgMarginRight = 'auto';
    } else if (textAlign === 'right') {
      imgMarginLeft = 'auto';
      imgMarginRight = '0';
    }
    const imgMl = imgMarginLeft + ' !important';
    const imgMr = imgMarginRight + ' !important';
    let family = this.isJapaneseBook()
      ? (this.fontFamily() || this.settings.bookFontFamilyJapanese())
      : this.fontFamily();
    if (tate && this.isJapaneseBook()) {
      family = resolveFontFamilyForTate(family);
    }

    const imgRules: Record<string, string> = tate
      ? {
          'max-width': '100% !important',
          'max-height': '100% !important',
          'width': 'auto !important',
          'height': 'auto !important',
          'display': 'block !important',
          'margin-left': 'auto !important',
          'margin-right': 'auto !important',
          'object-fit': 'contain'
        }
      : {
          'max-width': '100% !important',
          'max-height': '100% !important',
          'width': 'auto !important',
          'height': 'auto !important',
          'display': 'block !important',
          'margin-left': 'auto !important',
          'margin-right': 'auto !important',
          'object-fit': 'contain'
        };

    const rubyRules: Record<string, string> = {
      'ruby-position': 'over',
      'ruby-align': 'center'
    };
    const rtRules: Record<string, string> = furigana && tate
      ? {
          'font-size': '0.6em',
          'line-height': '1',
          'text-orientation': 'upright',
          '-webkit-text-orientation': 'upright',
          color: '#cbd5e1'
        }
      : {
          'font-size': '0.75em',
          'line-height': '1.1',
          color: '#cbd5e1'
        };

    const theme: Record<string, Record<string, string>> = {
      html: {
        background: PAGE_BG + ' !important',
        ...(tate
          ? {
              'writing-mode': 'vertical-rl',
              '-webkit-writing-mode': 'vertical-rl',
              'text-orientation': 'mixed',
              height: '100%',
              'max-height': '100%',
              overflow: 'hidden'
            }
          : {
              'writing-mode': 'horizontal-tb',
              '-webkit-writing-mode': 'horizontal-tb',
              'text-orientation': 'mixed'
            })
      },
      body: {
        'font-family': family + ' !important',
        'font-size': this.fontSize() + 'px !important',
        'line-height': lh + ' !important',
        'text-align': textAlign + ' !important',
        'padding': pad + 'px !important',
        'background': PAGE_BG + ' !important',
        'color': '#e2e8f0 !important',
        ...(tate
          ? {
              'writing-mode': 'vertical-rl',
              '-webkit-writing-mode': 'vertical-rl',
              'text-orientation': 'mixed',
              height: '100%',
              'max-height': '100%',
              'overflow-y': 'hidden',
              'overflow-x': 'auto'
            }
          : {
              'writing-mode': 'horizontal-tb',
              '-webkit-writing-mode': 'horizontal-tb'
            })
      },
      p: {
        'text-align': textAlign + ' !important',
        'line-height': lh + ' !important'
      },
      a: {
        color: '#a5b4fc !important'
      },
      ruby: rubyRules,
      rt: rtRules,
      'img, svg, image, video': imgRules,
      figure: {
        'max-width': '100% !important',
        ...(tate ? { 'max-height': '100% !important' } : {}),
        'margin-left': imgMl,
        'margin-right': imgMr,
        'margin-top': '0.5em !important',
        'margin-bottom': '0.5em !important',
        'display': 'block !important'
      },
      'p img, div img, figure img': {
        ...imgRules
      }
    };
    for (const r of targets) {
      r.themes.default(theme);
      // Single source of truth: body font-size in px above — do NOT also call themes.fontSize
      // (that would accumulate with the CSS rule).
    }
  }

  private setupViewerResizeObserver(): void {
    const host = this.viewerHostRef?.nativeElement;
    const target = host?.parentElement || host;
    if (!target || typeof ResizeObserver === 'undefined') return;
    this.teardownViewerResizeObserver();
    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const newW = Math.round(entry.contentRect.width);
      const newH = Math.round(entry.contentRect.height);
      if (Math.abs(newW - this.lastObservedW) < 2 && Math.abs(newH - this.lastObservedH) < 2) {
        return;
      }
      this.lastObservedW = newW;
      this.lastObservedH = newH;
      this.scheduleRenditionResize();
    });
    this.resizeObserver.observe(target);
  }

  private teardownViewerResizeObserver(): void {
    try {
      this.resizeObserver?.disconnect();
    } catch {
      /* ignore */
    }
    this.resizeObserver = null;
  }

  private scheduleRenditionResize(): void {
    if (this.curlAnimating || this.turningPage || this.driverActive()) return;
    const dims = this.getEffectiveVirtualDimensions();
    if (
      this.lastReflowWidth === dims.width &&
      this.lastReflowHeight === dims.height &&
      Math.abs(this.lastReflowScale - dims.autoScale) < 0.005
    ) {
      return;
    }
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this.clearPageBitmapCache();
      void this.reflowAtCfi().then(() => this.scheduleAdjacentBookBitmaps());
    }, 150);
  }

  private scheduleTypographyReflow(): void {
    if (this.curlAnimating || this.turningPage || this.driverActive()) return;
    this.applyTypography();
    this.lastReflowWidth = 0;
    this.lastReflowHeight = 0;
    this.lastReflowScale = 0;
    if (this.typographyTimer) clearTimeout(this.typographyTimer);
    this.typographyTimer = setTimeout(() => {
      this.clearPageBitmapCache();
      void this.reflowAtCfi().then(() => this.scheduleAdjacentBookBitmaps());
    }, 200);
  }

  private getEffectiveVirtualDimensions(): { width: number; height: number; autoScale: number } {
    const host = this.viewerHostRef?.nativeElement;
    const parent = host?.parentElement;
    const hostW = parent?.clientWidth || host?.clientWidth || window.innerWidth;
    const hostH = parent?.clientHeight || host?.clientHeight || window.innerHeight;
    const sizeSetting = this.bookPageSize();

    if (sizeSetting === BookPageSize.DYNAMIC) {
      return { width: hostW, height: hostH, autoScale: 1 };
    }

    const baseDims = getBookPageVirtualDimensions(sizeSetting);
    const autoScale = Math.max(0.1, hostW / baseDims.width);
    const maxVirtualHeight = Math.floor(hostH / autoScale);
    const cappedHeight = Math.max(200, Math.min(baseDims.height, maxVirtualHeight));

    return {
      width: baseDims.width,
      height: cappedHeight,
      autoScale
    };
  }

  private async reflowAtCfi(): Promise<void> {
    if (!this.rendition || this.relocating || this.curlAnimating || this.turningPage || this.driverActive()) return;
    const dims = this.getEffectiveVirtualDimensions();
    if (
      this.lastReflowWidth === dims.width &&
      this.lastReflowHeight === dims.height &&
      Math.abs(this.lastReflowScale - dims.autoScale) < 0.005
    ) {
      return;
    }
    this.lastReflowWidth = dims.width;
    this.lastReflowHeight = dims.height;
    this.lastReflowScale = dims.autoScale;

    const cfi = this.currentCfi();
    this.autoScale.set(dims.autoScale);
    try {
      const w = dims.width;
      const h = dims.height;
      this.rendition.resize(w, h);
      if (this.peekRendition) {
        try {
          this.peekRendition.resize(w, h);
        } catch {
          /* ignore */
        }
      }
      if (cfi) {
        this.relocating = true;
        try {
          await this.rendition.display(cfi);
        } finally {
          this.relocating = false;
        }
      }
    } catch (e) {
      console.warn('[reader-text] reflowAtCfi failed', e);
    }
  }

  /** Effective page transition for book — forced Default when FX should not run. */
  private effectiveBookTransition(): PageTransitionType {
    if (prefersReducedMotion()) return PageTransitionType.Default;
    if (this.isContinuousScrollMode()) return PageTransitionType.Default;
    const t = this.pageTransition();
    // Android disables curl on vertical pagination
    if (
      (t === PageTransitionType.CurlPage || t === PageTransitionType.Curl3DPage) &&
      this.scrollingMode() === BookScrollingMode.PaginationVertical
    ) {
      return PageTransitionType.Default;
    }
    return t;
  }

  /** Curl/Curl3D horizontal — overscroll drives canvas, not iframe translate. */
  private isCurlOverscrollMode(): boolean {
    if (!this.isHorizontalMode()) return false;
    const t = this.effectiveBookTransition();
    return t === PageTransitionType.CurlPage || t === PageTransitionType.Curl3DPage;
  }


  /** CSS height of the page area above the always-visible progress strip. */
  private bookCurlCaptureHeightCss(viewer: HTMLElement): number {
    const hostRect = viewer.getBoundingClientRect();
    const fullH = Math.max(1, hostRect.height);
    const root = this.elementRef.nativeElement as HTMLElement | undefined;
    const progress = root?.querySelector<HTMLElement>('[data-br-chrome="progress"]');
    if (!progress) return fullH;
    const progressTop = progress.getBoundingClientRect().top;
    return Math.max(8, Math.min(fullH, Math.round(progressTop - hostRect.top)));
  }

  /** Bottom inset so the curl canvas does not cover the progress strip. */
  private bookCurlCanvasBottomInsetCss(viewer: HTMLElement): number {
    const hostRect = viewer.getBoundingClientRect();
    const captureH = this.bookCurlCaptureHeightCss(viewer);
    return Math.max(0, Math.round(hostRect.height - captureH));
  }

  private async turnWithEffect(dir: 1 | -1): Promise<void> {
    // Never extra-advance while a turn is in flight (was skipping 5–7 pages).
    if (!this.rendition || this.turningPage || this.driverActive()) {
      return;
    }
    if (dir < 0 && this.isAtBookStart()) {
      return;
    }
    if (dir > 0 && this.isAtBookEnd()) {
      this.requestAdjacentFile('next');
      return;
    }
    if (prefersReducedMotion() || this.isContinuousScrollMode()) {
      await this.turnPageAndSettle(dir);
      return;
    }
    const effect = this.effectiveBookTransition();

    this.cancelAdjacentPeekPreload();
    this.turningPage = true;
    this.turningSignal.set(true);
    this.markBookTurn('start');
    try {
      const isCurl =
        (effect === PageTransitionType.CurlPage ||
          effect === PageTransitionType.Curl3DPage) &&
        this.isHorizontalMode();

      if (isCurl) {
        const bitmaps = await this.ensureBookCurlBitmaps(dir as TurnDir);
        if (!bitmaps) {
          this.markBookTurn('peek-miss');
          await this.turnPageAndSettle(dir);
          return;
        }
      } else {
        const peekOk = await this.loadPeek(dir);
        if (!peekOk) {
          this.markBookTurn('peek-miss');
          await this.turnPageAndSettle(dir);
          return;
        }
        this.activatePeekLayer();
      }
      await this.animateViewerTurn(dir, effect, async () => {
        this.markBookTurn('commit');
        await this.turnPageAndSettle(dir);
      });
    } finally {
      // Hide peek only after player released the last frame.
      this.turningPage = false;
      this.turningSignal.set(false);
      this.bookCurlDragActive = false;
      this.curlAnimating = false;
      this.releaseBookCurlBitmaps();
      this.teardownBookCurlCanvas();
      this.deactivatePeekLayer();
      this.peekStale = true;
      this.peekDirection = 0;
      this.clearViewerAnimStyles();
      this.markBookTurn('end');
      this.scheduleAdjacentPeekPreload();
      this.scheduleAdjacentBookBitmaps();
    }
  }

  private async animateViewerTurn(
    dir: 1 | -1,
    effect: PageTransitionType,
    commit?: () => void | Promise<void>
  ): Promise<void> {
    const viewer =
      this.viewerShellRef?.nativeElement || this.viewerRef?.nativeElement;
    const peek =
      this.peekShellRef?.nativeElement || this.viewerPeekRef?.nativeElement;
    if (!viewer || !peek) {
      if (commit) await commit();
      return;
    }

    this.overscrollAnimatingSignal.set(false);
    // Clear overscroll translates so the driver owns the transform on the shells
    this.overscrollXSignal.set(0);
    this.overscrollYSignal.set(0);

    const host = this.viewerHostRef?.nativeElement;
    const axis: TurnAxis = this.isHorizontalMode() ? 'x' : 'y';
    const size =
      axis === 'x'
        ? host?.clientWidth || window.innerWidth
        : host?.clientHeight || window.innerHeight;
    const logicalDir = dir as TurnDir;
    const mirror = this.turnMirror();

    const isCurl =
      effect === PageTransitionType.CurlPage || effect === PageTransitionType.Curl3DPage;

    // Non-curl: show peek under the outgoing page. Curl waits for freeze canvas.
    if (!(isCurl && this.isHorizontalMode())) {
      this.activatePeekLayer();
      await this.doubleRaf();
    }
    this.markBookTurn('paint');

    // Zone.js patches rAF — run the turn outside Angular so CD cannot clear
    // driver transforms mid-animation (even on shell, keep CD noise low).
    const run = async () => {
      if (isCurl && this.isHorizontalMode()) {
        const bitmaps = await this.ensureBookCurlBitmaps(logicalDir);
        if (bitmaps) {
          const mode = effect === PageTransitionType.Curl3DPage ? '3d' : '2d';
          const reuseCanvas = this.bookCurlCanvas;
          const hostRect = host?.getBoundingClientRect();
          const pointerY = hostRect && this.panLastClientY > 0 ? this.panLastClientY - hostRect.top : undefined;
          await playBookCurlTurn({
            host: host!,
            viewerShell: viewer,
            peekShell: peek,
            bitmaps,
            dir: logicalDir,
            mirror,
            mode,
            surfaceColor: PAGE_BG,
            canvas: reuseCanvas,
            pointerY,
            bottomInsetCss: this.bookCurlCanvasBottomInsetCss(viewer),
            commit: commit
              ? () => this.ngZone.run(() => Promise.resolve(commit()))
              : undefined,
            owner: 'book-reader'
          });
          this.releaseBookCurlBitmaps();
          this.teardownBookCurlCanvas();
          return;
        }
        // Capture unavailable — Fade only (never CSS clip-path on the live iframe).
        this.activatePeekLayer();
        await this.doubleRaf();
      }

      const playEffect = isCurl ? PageTransitionType.Fade : effect;
      await playPageTurn({
        outgoing: viewer,
        incoming: peek,
        effect: playEffect,
        axis,
        dir: logicalDir,
        mirror,
        size,
        variant: 'book',
        commit: commit
          ? () => this.ngZone.run(() => Promise.resolve(commit()))
          : undefined,
        owner: 'book-reader'
      });
    };

    await this.ngZone.runOutsideAngular(() => run());
  }

  private clearViewerAnimStyles(): void {
    cancelActivePageTurns('book-reader');
    cancelBookCurlTurns('book-reader');
    this.teardownBookCurlCanvas();
    if (this.turningSignal()) return;
    const els = [
      this.viewerShellRef?.nativeElement,
      this.peekShellRef?.nativeElement,
      this.viewerRef?.nativeElement,
      this.viewerPeekRef?.nativeElement
    ];
    for (const el of els) {
      if (!el) continue;
      el.style.transform = '';
      el.style.opacity = '';
      el.style.boxShadow = '';
      el.style.zIndex = '';
      el.style.transformOrigin = '';
      el.style.willChange = '';
      el.style.clipPath = '';
      el.style.visibility = '';
    }
  }

  private releaseBookCurlBitmaps(): void {
    if (this.bookCurlBitmaps) {
      try {
        this.bookCurlBitmaps.front.close();
      } catch {
        /* ignore */
      }
      try {
        this.bookCurlBitmaps.under.close();
      } catch {
        /* ignore */
      }
      this.bookCurlBitmaps = null;
    }
    this.peekStale = true;
  }

  private teardownBookCurlCanvas(): void {
    if (this.bookCurlCanvas) {
      const canvas = this.bookCurlCanvas;
      this.bookCurlCanvas = null;
      // Delay removal by two animation frames to allow Chromium to composite the EPUB iframe behind it
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            canvas.remove();
          } catch {
            /* ignore */
          }
        });
      });
    }
  }

  private clearPageBitmapCache(): void {
    this.bitmapPreloadToken++;
    this.bitmapPreloadPromise = null;
    this.backgroundPreloadBusy = false;
    this.pendingBitmapPreloadPage = null;
    if (this.bitmapScheduleTimer) {
      clearTimeout(this.bitmapScheduleTimer);
      this.bitmapScheduleTimer = null;
    }
    for (const entry of this.pageBitmapCache.values()) {
      try {
        entry.bitmap.close();
      } catch {
        /* ignore */
      }
    }
    this.pageBitmapCache.clear();
    this.adjacentScreenCfiMap.clear();
  }

  private pendingBitmapPreloadPage: number | null = null;
  /** Exact CFIs captured from peek/live screens for accurate adjacent curl snapshots. */
  private adjacentScreenCfiMap = new Map<number, string>();

  /**
   * Ensures every spine item in the EPUB (including image-only covers or illustrations with 0 text nodes)
   * has at least one valid entry in book.locations._locations.
   */
  private augmentBookLocations(book: any): void {
    if (!book?.locations || !book?.spine) return;
    try {
      const rawLocs: string[] = Array.isArray(book.locations._locations)
        ? book.locations._locations.slice()
        : [];
      const spineItems: any[] = book.spine.spineItems || (Array.isArray(book.spine) ? book.spine : []);
      if (!spineItems.length) return;

      const augmented: string[] = [];
      for (let i = 0; i < spineItems.length; i++) {
        const section = spineItems[i];
        const cfiBase = section.cfiBase;
        const sectionLocs = cfiBase
          ? rawLocs.filter(cfi => typeof cfi === 'string' && (cfi.includes(cfiBase + '!') || cfi.includes(cfiBase + '[')))
          : [];
        if (sectionLocs.length === 0) {
          // Image-only section or section with no text nodes: create canonical base CFI
          const baseCfi = cfiBase ? `epubcfi(${cfiBase}!/4/1:0)` : (section.href || '');
          if (baseCfi) augmented.push(baseCfi);
        } else {
          // If first spine item (cover) has locations starting deeper in text, ensure cover page is at index 0
          if (i === 0 && cfiBase) {
            const coverBase = `epubcfi(${cfiBase}!/4/1:0)`;
            if (!sectionLocs.includes(coverBase)) {
              augmented.push(coverBase);
            }
          }
          augmented.push(...sectionLocs);
        }
      }

      if (augmented.length > 0) {
        book.locations._locations = augmented;
        book.locations.total = augmented.length - 1;
      }
    } catch (e) {
      console.warn('[reader-text] augmentBookLocations failed', e);
    }
  }

  /**
   * Calculates estimated characters per page based on the fixed page dimensions
   * and current typography settings, so that 1 synthetic location slice closely
   * matches 1 visual screen column.
   */
  private calculateCharsPerPage(): number {
    const dims = this.getEffectiveVirtualDimensions();
    const pad = MARGIN_PX[this.margin()] ?? 32;
    const fontSize = this.fontSize() || 18;
    const tate = this.tateGakiEnabled();
    const furigana = this.furiganaEnabled();
    let lh = SPACING_LH[this.spacing()] ?? this.settings.bookLineHeight() ?? 1.6;
    if (furigana) {
      const bump = tate ? 1.45 : 1.25;
      const cap = tate ? 2.8 : 2.4;
      lh = Math.max(lh, Math.min(cap, lh * bump));
    } else if (tate) {
      lh = Math.max(lh, Math.min(2.2, lh * 1.1));
    }

    const contentWidth = Math.max(200, dims.width - 2 * pad);
    const contentHeight = Math.max(200, dims.height - 2 * pad);

    const lineBoxHeight = fontSize * lh;
    const linesPerPage = Math.max(1, Math.floor(contentHeight / lineBoxHeight));

    // Western proportional fonts average ~0.52 * fontSize width. CJK is full-width (~1.0).
    const charWidthRatio = this.isJapaneseBook() ? 1.0 : 0.52;
    const charsPerLine = Math.max(1, Math.floor(contentWidth / (fontSize * charWidthRatio)));

    // Density factor (~88% of full text block) accounts for paragraph breaks and indentations.
    const density = 0.88;
    const estimated = Math.round(linesPerPage * charsPerLine * density);

    return Math.max(1000, Math.min(estimated, 8000));
  }

  private async regenerateBookLocations(): Promise<void> {
    if (!this.epubBook?.locations) return;
    try {
      const chars = this.calculateCharsPerPage();
      await this.epubBook.locations.generate(chars);
      this.augmentBookLocations(this.epubBook);
      const locationCount = Math.max(1, this.epubBook.locations.length());
      this.pageCount.set(locationCount);
    } catch (e) {
      console.warn('[reader-text] regenerateBookLocations failed', e);
    }
  }

  /**
   * Capture size must match live rendition.resize (virtual resolution),
   * not the progress-cropped CSS height used only for canvas bottom inset.
   */
  private bookCurlCaptureSizeCss(): { width: number; height: number } | null {
    const dims = this.getEffectiveVirtualDimensions();
    const width = Math.round(dims.width);
    const height = Math.round(dims.height);
    if (width < 8 || height < 8) return null;
    return { width, height };
  }

  private cfiForLocation(index: number): string | null {
    if (!this.epubBook) return null;
    if (index === this.currentPage()) {
      const live = this.currentCfi();
      if (live) return live;
    }
    const cachedAdjacent = this.adjacentScreenCfiMap.get(index);
    if (cachedAdjacent) return cachedAdjacent;

    if (index === 0) {
      const spineFirst = (this.epubBook as any).spine?.first?.();
      if (spineFirst?.href) return spineFirst.href as string;
      const live = this.currentCfi();
      if (live && this.currentPage() === 0) return live;
    }
    if (!this.epubBook.locations) return null;
    try {
      const cfi = this.epubBook.locations.cfiFromLocation(index) as string;
      if (cfi) return cfi;
    } catch {
      /* ignore */
    }

    // Fallback: se locations não tiver gerado CFI para este índice (ex: seções curtas ou imagens),
    // mapeia proporcionalmente para o spine item correspondente.
    try {
      const spine = (this.epubBook as any).spine;
      const items: any[] = spine?.spineItems || spine?.items || (Array.isArray(spine) ? spine : []);
      const spineLen = items.length;
      const totalPages = Math.max(1, this.pageCount());
      if (spineLen > 0 && totalPages > 1) {
        const spineIdx = Math.min(spineLen - 1, Math.max(0, Math.floor((index / (totalPages - 1)) * (spineLen - 1))));
        const item = items[spineIdx];
        if (item?.href) return item.href as string;
      }
    } catch {
      /* ignore */
    }

    return null;
  }

  private async ensurePeekRendition(): Promise<Rendition | null> {
    if (!this.epubBook) return null;
    const peekEl = this.viewerPeekRef?.nativeElement;
    if (!peekEl) return null;
    if (this.peekRendition) return this.peekRendition;

    const peekOpts = this.buildRenditionOptions();
    delete peekOpts['manager'];
    peekOpts['flow'] = 'paginated';
    const peek = new Rendition(this.epubBook, peekOpts as any);
    await peek.attachTo(peekEl);
    this.peekRendition = peek;
    this.applyTypography(peek);
    peek.hooks.content.register((contents: any) => {
      this.sizeContentImages(contents);
      void this.enhanceJapaneseContents(contents);
    });
    const size = this.bookCurlCaptureSizeCss();
    if (size) {
      try {
        peek.resize(size.width, size.height);
      } catch {
        /* ignore */
      }
    }
    return peek;
  }

  private savePageBitmap(
    index: number,
    bitmap: ImageBitmap,
    width: number,
    height: number
  ): void {
    const key = String(index);
    const existing = this.pageBitmapCache.get(key);
    if (existing) {
      try {
        existing.bitmap.close();
      } catch {
        /* ignore */
      }
    }
    this.pageBitmapCache.set(key, {
      bitmap,
      width,
      height,
      timestamp: Date.now()
    });

    if (this.pageBitmapCache.size > this.MAX_SNAPSHOT_CACHE) {
      const current = this.currentPage();
      const entries = [...this.pageBitmapCache.entries()].map(([k, v]) => ({
        key: k,
        entry: v,
        dist: Math.abs(Number(k) - current)
      }));
      entries.sort((a, b) => b.dist - a.dist);
      const toRemove = entries.slice(0, entries.length - this.MAX_SNAPSHOT_CACHE);
      for (const item of toRemove) {
        try {
          item.entry.bitmap.close();
        } catch {
          /* ignore */
        }
        this.pageBitmapCache.delete(item.key);
      }
    }

    // Se houver algum item de lastPages correspondente a esta página sem thumbUrl, gera e preenche a miniatura
    for (const item of this.lastPages()) {
      if (item.page === index && !item.thumbUrl) {
        void this.generateBookThumbnail(index).then(thumb => {
          if (!thumb) return;
          const updated = this.lastPages().map(lp => (lp.page === index ? { ...lp, thumbUrl: thumb } : lp));
          this.lastPages.set(updated);
          const currentDisp = this.displayedLastPage();
          if (currentDisp && currentDisp.page === index && !currentDisp.thumbUrl) {
            this.displayedLastPage.set({ ...currentDisp, thumbUrl: thumb });
            this.triggerThumbUpdate();
          }
        });
      }
    }
  }

  private async generateBookThumbnail(page: number): Promise<string | null> {
    try {
      let entry = this.pageBitmapCache.get(String(page));
      if (!entry) {
        await this.capturePriorityBookBitmaps([page], 1000);
        entry = this.pageBitmapCache.get(String(page));
      }
      if (!entry?.bitmap) return null;

      const targetW = 96;
      const aspect = entry.height > 0 ? entry.width / entry.height : 0.75;
      const targetH = Math.round(targetW / (aspect || 0.75));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(entry.bitmap, 0, 0, targetW, targetH);
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch (e) {
      console.warn('[reader-text] generateBookThumbnail failed for page', page, e);
      return null;
    }
  }

  private scheduleAdjacentBookBitmaps(page?: number): void {
    if (!this.isCurlOverscrollMode()) return;
    if (!this.epubUrl || !this.epubBook || !this.electron.isElectron) return;
    const target = page ?? this.currentPage();
    if (this.bitmapScheduleTimer) clearTimeout(this.bitmapScheduleTimer);
    this.bitmapScheduleTimer = setTimeout(() => {
      this.bitmapScheduleTimer = null;
      void this.preloadAdjacentBookBitmaps(target);
    }, 60);
  }

  /** Theme payload for the hidden capture window (mirrors applyTypography). */
  private bookCaptureTheme(): Record<string, unknown> {
    const tate = this.tateGakiEnabled();
    const furigana = this.furiganaEnabled();
    const pad = MARGIN_PX[this.margin()];
    let lh = SPACING_LH[this.spacing()] ?? this.settings.bookLineHeight();
    if (furigana) {
      const bump = tate ? 1.45 : 1.25;
      const cap = tate ? 2.8 : 2.4;
      lh = Math.max(lh, Math.min(cap, lh * bump));
    } else if (tate) {
      lh = Math.max(lh, Math.min(2.2, lh * 1.1));
    }
    let family = this.isJapaneseBook()
      ? this.fontFamily() || this.settings.bookFontFamilyJapanese()
      : this.fontFamily();
    if (tate && this.isJapaneseBook()) {
      family = resolveFontFamilyForTate(family);
    }
    return {
      background: PAGE_BG,
      color: '#e2e8f0',
      fontFamily: family,
      fontSizePx: this.fontSize(),
      lineHeight: lh,
      textAlign: this.align(),
      paddingPx: pad,
      writingMode: tate ? 'vertical-rl' : 'horizontal-tb',
      direction: this.usesRtlPageKeys() ? 'rtl' : 'ltr',
      spread: 'none'
    };
  }

  private async ingestCapturedBookBitmaps(
    pages: Array<{ index: number; cfi?: string }>,
    width: number,
    height: number,
    token: number
  ): Promise<void> {
    if (!pages.length || !this.epubUrl || !this.electron.isElectron) return;
    const result = await this.electron.captureBookSpread({
      bookUrl: this.epubUrl,
      width,
      height,
      theme: this.bookCaptureTheme(),
      pages
    });
    if (token !== this.bitmapPreloadToken) return;

    for (const [key, data] of Object.entries(result)) {
      if (!data) continue;
      const bitmap = await dataUrlToOpaqueBitmap(data, width, height, PAGE_BG);
      if (!bitmap || token !== this.bitmapPreloadToken) {
        try {
          bitmap?.close();
        } catch {
          /* ignore */
        }
        continue;
      }
      this.savePageBitmap(Number(key), bitmap, width, height);
    }
  }

  /**
   * Pre-render locations [page-2 .. page+2] in the hidden background Electron worker.
   * Never touches the visible reader DOM. Does not block the curl gesture.
   */
  private async preloadAdjacentBookBitmaps(page: number): Promise<void> {
    if (!this.isCurlOverscrollMode()) return;
    if (!this.epubUrl || !this.electron.isElectron) return;
    if (this.backgroundPreloadBusy) {
      this.pendingBitmapPreloadPage = page;
      return;
    }

    const size = this.bookCurlCaptureSizeCss();
    if (!size) return;
    const { width, height } = size;

    const max = Math.max(0, this.pageCount() - 1);
    // Ascending order [page-2 .. page+2] for sequential backend rendition navigation
    const targets = [page - 2, page - 1, page, page + 1, page + 2].filter(
      (i, n, arr) => i >= 0 && i <= max && arr.indexOf(i) === n
    );

    const missing: Array<{ index: number; cfi?: string }> = [];
    for (const idx of targets) {
      const key = String(idx);
      const cached = this.pageBitmapCache.get(key);
      if (
        cached &&
        Math.abs(cached.width - width) <= 2 &&
        Math.abs(cached.height - height) <= 2
      ) {
        continue;
      }
      if (cached) {
        try {
          cached.bitmap.close();
        } catch {
          /* ignore */
        }
        this.pageBitmapCache.delete(key);
      }
      const cfi = this.cfiForLocation(idx);
      missing.push({ index: idx, ...(cfi ? { cfi } : {}) });
    }

    // Evict far pages outside the window (LRU threshold > 5 distance)
    for (const key of [...this.pageBitmapCache.keys()]) {
      const idx = Number(key);
      if (Math.abs(idx - page) > 5) {
        const entry = this.pageBitmapCache.get(key);
        try {
          entry?.bitmap.close();
        } catch {
          /* ignore */
        }
        this.pageBitmapCache.delete(key);
      }
    }

    if (!missing.length) return;

    const token = ++this.bitmapPreloadToken;
    this.backgroundPreloadBusy = true;
    const run = (async () => {
      try {
        await this.ingestCapturedBookBitmaps(missing, width, height, token);
      } catch (e) {
        console.warn('[reader-text] background bitmap preload failed', e);
      } finally {
        this.backgroundPreloadBusy = false;
        const pending = this.pendingBitmapPreloadPage;
        this.pendingBitmapPreloadPage = null;
        if (pending != null && token === this.bitmapPreloadToken) {
          void this.preloadAdjacentBookBitmaps(pending);
        }
      }
    })();
    this.bitmapPreloadPromise = run;
    await run;
  }

  /** Capture only the listed indices (gesture priority path). */
  private async capturePriorityBookBitmaps(
    indices: number[],
    timeoutMs = 800
  ): Promise<void> {
    if (!this.epubUrl || !this.electron.isElectron) return;
    const size = this.bookCurlCaptureSizeCss();
    if (!size) return;
    const { width, height } = size;
    const max = Math.max(0, this.pageCount() - 1);
    const missing: Array<{ index: number; cfi?: string }> = [];
    for (const idx of indices) {
      if (idx < 0 || idx > max) continue;
      const key = String(idx);
      const cached = this.pageBitmapCache.get(key);
      if (
        cached &&
        Math.abs(cached.width - width) <= 2 &&
        Math.abs(cached.height - height) <= 2
      ) {
        continue;
      }
      if (cached) {
        try {
          cached.bitmap.close();
        } catch {
          /* ignore */
        }
        this.pageBitmapCache.delete(key);
      }
      const cfi = this.cfiForLocation(idx);
      missing.push({ index: idx, ...(cfi ? { cfi } : {}) });
    }
    if (!missing.length) return;

    // If a background preload is already running, wait briefly for cache hits.
    if (this.backgroundPreloadBusy) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (missing.every(m => this.pageBitmapCache.has(String(m.index)))) return;
        await new Promise(r => setTimeout(r, 40));
      }
      return;
    }

    const token = ++this.bitmapPreloadToken;
    this.backgroundPreloadBusy = true;
    const run = (async () => {
      try {
        await Promise.race([
          this.ingestCapturedBookBitmaps(missing, width, height, token),
          new Promise<void>(resolve => setTimeout(resolve, timeoutMs))
        ]);
      } catch (e) {
        console.warn('[reader-text] priority bitmap capture failed', e);
      } finally {
        this.backgroundPreloadBusy = false;
        const pending = this.pendingBitmapPreloadPage;
        this.pendingBitmapPreloadPage = null;
        if (pending != null && token === this.bitmapPreloadToken) {
          void this.preloadAdjacentBookBitmaps(pending);
        }
      }
    })();
    this.bitmapPreloadPromise = run;
    await run;
  }

  private async ensureBookCurlBitmaps(
    logicalDir: TurnDir = 1
  ): Promise<BookCurlBitmaps | null> {
    if (this.bookCurlBitmaps) return this.bookCurlBitmaps;
    const viewer = this.viewerShellRef?.nativeElement;
    if (!viewer) return null;

    this.curlAnimating = true;
    const current = this.currentPage();
    const underIndex = logicalDir > 0 ? current + 1 : current - 1;
    const max = Math.max(0, this.pageCount() - 1);
    if (underIndex < 0 || underIndex > max) {
      this.curlAnimating = false;
      return null;
    }

    let frontSrc = this.pageBitmapCache.get(String(current))?.bitmap ?? null;
    let underSrc = this.pageBitmapCache.get(String(underIndex))?.bitmap ?? null;

    if (!underSrc && !this.adjacentScreenCfiMap.has(underIndex)) {
      try {
        await this.loadPeek(logicalDir);
      } catch {
        /* ignore */
      }
    }

    // Gesture: only wait for current ±1 (short timeout). Full ±2 stays in background.
    if (!frontSrc || !underSrc) {
      await this.capturePriorityBookBitmaps([current, underIndex], 800);
      frontSrc = this.pageBitmapCache.get(String(current))?.bitmap ?? frontSrc;
      underSrc = this.pageBitmapCache.get(String(underIndex))?.bitmap ?? underSrc;
    }
    void this.preloadAdjacentBookBitmaps(current);

    if (!frontSrc || !underSrc) {
      this.curlAnimating = false;
      return null;
    }

    // Clone so releaseBookCurlBitmaps can close without touching the cache.
    let front: ImageBitmap;
    let under: ImageBitmap;
    try {
      front = await createImageBitmap(frontSrc);
      under = await createImageBitmap(underSrc);
    } catch (e) {
      console.warn('[reader-text] clone curl bitmaps failed', e);
      this.curlAnimating = false;
      return null;
    }

    const captured = pairBookCurlBitmaps(front, under, PAGE_BG);
    this.bookCurlBitmaps = captured;

    const canvas = this.ensureBookCurlCanvas();
    if (canvas) {
      paintBookCurlFreeze(canvas, front, captured.width, captured.height, PAGE_BG);
      paintBookCurlProgress(
        canvas,
        captured,
        0,
        logicalDir,
        this.turnMirror(),
        this.effectiveBookTransition() === PageTransitionType.Curl3DPage ? '3d' : '2d'
      );
      viewer.style.visibility = 'hidden';
      const peek = this.peekShellRef?.nativeElement;
      if (peek) peek.style.visibility = 'hidden';
    }
    return captured;
  }

  private ensureBookCurlCanvas(): HTMLCanvasElement | null {
    const host = this.viewerHostRef?.nativeElement;
    const viewer = this.viewerShellRef?.nativeElement;
    if (!host) return null;
    const bottomInset = viewer ? this.bookCurlCanvasBottomInsetCss(viewer) : 0;
    if (this.bookCurlCanvas && this.bookCurlCanvas.isConnected) {
      this.bookCurlCanvas.style.bottom = `${bottomInset}px`;
      this.bookCurlCanvas.style.height = bottomInset > 0 ? 'auto' : '100%';
      return this.bookCurlCanvas;
    }
    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      `position:absolute;top:0;left:0;right:0;bottom:${bottomInset}px;` +
      `width:100%;height:${bottomInset > 0 ? 'auto' : '100%'};` +
      'z-index:50;pointer-events:none;';
    host.appendChild(canvas);
    this.bookCurlCanvas = canvas;
    return canvas;
  }

  /** Inject BabelStone @font-face + optional furigana/vocab ruby rewrite. */
  private async enhanceJapaneseContents(contents: any): Promise<void> {
    const doc: Document | undefined = contents?.document;
    if (!doc?.head || !doc.body) return;

    this.injectJapaneseFontFaces(doc);

    if (!this.japaneseProcessingEnabled()) return;
    if (doc.documentElement.getAttribute('data-br-furigana') === '1') return;

    try {
      await this.electron.japaneseInit();
      await this.applyFuriganaToDocument(doc);
      doc.documentElement.setAttribute('data-br-furigana', '1');
      // Re-apply themes so vertical ruby/rt rules land after DOM rewrite.
      this.applyTypography();
    } catch (e) {
      console.warn('[reader-text] furigana apply failed', e);
    }
  }

  private japaneseProcessingEnabled(): boolean {
    return this.isJapaneseBook() && this.settings.bookProcessJapaneseText();
  }

  private injectJapaneseFontFaces(doc: Document): void {
    if (doc.getElementById('br-jp-fonts')) return;
    const style = doc.createElement('style');
    style.id = 'br-jp-fonts';
    style.textContent =
      babelStoneFontFaceCss('assets/fonts') +
      '\n.br-vocab{cursor:pointer;}\n.br-vocab:hover{background:rgba(99,102,241,0.18);border-radius:2px;}';
    doc.head.appendChild(style);
  }

  private async applyFuriganaToDocument(doc: Document): Promise<void> {
    const skip = new Set(['SCRIPT', 'STYLE', 'RUBY', 'RT', 'RP', 'CODE', 'PRE', 'SVG', 'MATH', 'TEXTAREA']);
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node: Node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (skip.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('ruby, rt, rp, script, style, code, pre, .br-vocab, .br-furigana')) {
          return NodeFilter.FILTER_REJECT;
        }
        const text = node.textContent || '';
        if (!text.trim() || !JapaneseTextUtil.isJapanese(text)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    } as any);

    const nodes: Text[] = [];
    let current: Node | null;
    while ((current = walker.nextNode())) {
      nodes.push(current as Text);
    }

    const withFurigana = this.settings.bookGenerateFurigana();
    const BATCH = 8;
    for (let i = 0; i < nodes.length; i += BATCH) {
      const slice = nodes.slice(i, i + BATCH);
      await Promise.all(
        slice.map(async textNode => {
          if (!textNode.isConnected) return;
          const raw = textNode.textContent || '';
          const html = await this.electron.japaneseToRubyHtml(raw, withFurigana);
          if (!html || !html.includes('br-vocab')) return;
          const wrap = doc.createElement('span');
          wrap.className = 'br-furigana';
          wrap.innerHTML = html;
          textNode.parentNode?.replaceChild(wrap, textNode);
        })
      );
    }
  }

  private async buildToc(book: EpubBook): Promise<void> {
    try {
      const nav = await book.loaded.navigation;
      const flat: TocEntry[] = [];
      const walk = (items: NavItem[]) => {
        for (const item of items || []) {
          if (item.href) {
            flat.push({
              label: item.label?.trim() || 'Capítulo',
              href: item.href,
              location: this.locationFromTocHref(book, item.href)
            });
          }
          if (item.subitems?.length) walk(item.subitems);
        }
      };
      walk(nav?.toc || []);

      // If any items have invalid locations, try to extrapolate from valid neighbouring items
      const maxLoc = Math.max(0, this.pageCount() - 1);
      for (let i = 0; i < flat.length; i++) {
        if (flat[i].location < 0) {
          // If first item has no location, default to 0
          if (i === 0) {
            flat[i].location = 0;
          } else {
            // Find next valid
            let nextValid = -1;
            for (let j = i + 1; j < flat.length; j++) {
              if (flat[j].location >= 0) {
                nextValid = flat[j].location;
                break;
              }
            }
            const prevValid = flat[i - 1].location >= 0 ? flat[i - 1].location : 0;
            if (nextValid >= 0 && nextValid >= prevValid) {
              flat[i].location = Math.min(maxLoc, prevValid);
            } else {
              flat[i].location = Math.min(maxLoc, prevValid);
            }
          }
        }
      }

      // Drop consecutive duplicates (nested TOC pointing at the same spine item/location with identical label).
      const deduped: TocEntry[] = [];
      for (const entry of flat) {
        const prev = deduped[deduped.length - 1];
        if (prev && prev.location >= 0 && entry.location === prev.location && prev.label === entry.label) {
          continue;
        }
        deduped.push(entry);
      }
      this.toc.set(deduped);
    } catch (e) {
      console.warn('[reader-text] TOC failed', e);
      this.toc.set([]);
    }
  }

  /** Resolve epub.js location index for a TOC href (after locations.generate). */
  private locationFromTocHref(book: EpubBook, href: string): number {
    const section = this.resolveSpineSection(book, href);
    if (!section) return -1;

    const locs: string[] = (book.locations as any)?._locations;
    const cfiBase: string = (section.cfiBase || '').replace(/^epubcfi\(|\)$/g, '');

    // 1. Direct lookup in generated locations list by section's cfiBase
    if (cfiBase && Array.isArray(locs) && locs.length > 0) {
      const idx = locs.findIndex(loc => loc && loc.includes(cfiBase));
      if (idx >= 0) return idx;
    }

    // 2. Try CFI resolution via epub.js Locations API
    if (cfiBase) {
      const fromCfi = this.locationFromCfiValue(book, cfiBase);
      if (fromCfi >= 0) return fromCfi;
    }

    // 3. Fallback: map spine index proportionally onto the locations timeline.
    try {
      const spine = (book as any).spine;
      const items: any[] = spine?.spineItems || spine?.items || (Array.isArray(spine) ? spine : []);
      const spineLen = Math.max(Number(spine?.length) || 0, items.length);
      const idx = typeof section.index === 'number' ? section.index : items.indexOf(section);
      const locLen = Math.max(1, (book.locations?.length?.() ?? this.pageCount()) - 1);

      if (idx === 0) return 0;
      if (idx > 0 && spineLen > 1) {
        return Math.min(locLen, Math.max(0, Math.round((idx / (spineLen - 1)) * locLen)));
      }
      if (idx > 0 && spineLen === 1) {
        return 0;
      }
    } catch { /* ignore */ }

    return -1;
  }

  private resolveSpineSection(book: EpubBook, href: string): any | null {
    const spine = (book as any).spine;
    if (!spine) return null;

    const raw = (href || '').trim();
    if (!raw) return null;
    const noHash = raw.split('#')[0].replace(/^\.\//, '');
    let decoded = noHash;
    try {
      decoded = decodeURIComponent(noHash);
    } catch { /* keep noHash */ }

    const candidates = new Set<string>();
    for (const c of [raw, noHash, decoded]) {
      if (c) candidates.add(c);
    }
    const base = noHash.split('/').pop();
    if (base) candidates.add(base);
    try {
      const decodedBase = decodeURIComponent(base || '');
      if (decodedBase) candidates.add(decodedBase);
    } catch { /* ignore */ }

    try {
      const canon = typeof spine.canonical === 'function'
        ? spine.canonical(noHash)
        : null;
      if (canon) candidates.add(String(canon));
    } catch { /* ignore */ }

    // 1. Try spine.get with candidates
    if (typeof spine.get === 'function') {
      for (const c of candidates) {
        try {
          const section = spine.get(c);
          if (section) return section;
        } catch { /* try next */ }
      }
    }

    // 2. Direct search across spine items list
    const items: any[] = spine.spineItems || spine.items || (Array.isArray(spine) ? spine : []);
    if (Array.isArray(items) && items.length > 0) {
      const cleanTarget = noHash.toLowerCase();
      const baseTarget = (base || '').toLowerCase();

      for (const item of items) {
        if (!item) continue;
        const itemHref = String(item.href || '').toLowerCase();
        const itemCanon = String(item.canonical || '').toLowerCase();
        const itemId = String(item.idref || item.id || '').toLowerCase();
        const itemBase = itemHref.split('/').pop() || '';

        if (
          itemHref === cleanTarget ||
          itemCanon === cleanTarget ||
          itemId === cleanTarget ||
          (baseTarget && itemBase === baseTarget) ||
          (cleanTarget && itemHref.endsWith(cleanTarget)) ||
          (cleanTarget && cleanTarget.endsWith(itemHref))
        ) {
          return item;
        }
      }
    }

    return null;
  }

  private locationFromCfiValue(book: EpubBook, cfi: string): number {
    if (!cfi || !book.locations) return -1;
    const cleanCfi = cfi.trim();
    const formattedCfi = cleanCfi.startsWith('epubcfi(') ? cleanCfi : `epubcfi(${cleanCfi})`;

    try {
      const raw = book.locations.locationFromCfi(formattedCfi) as unknown;
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isFinite(n) && n >= 0) return Math.round(n);
    } catch { /* try percentage */ }
    try {
      const pctRaw = book.locations.percentageFromCfi(formattedCfi) as unknown;
      const pct = typeof pctRaw === 'number' ? pctRaw : Number(pctRaw);
      if (Number.isFinite(pct) && pct >= 0) {
        const len = Math.max(1, book.locations.length() - 1);
        return Math.min(len, Math.max(0, Math.round(pct * len)));
      }
    } catch { /* ignore */ }
    return -1;
  }

  private updateChapterFromHref(href?: string): void {
    if (!href) return;
    const entries = this.toc();
    const match = [...entries].reverse().find(e => href.includes(e.href.split('#')[0]));
    if (match) {
      this.chapterTitle.set(match.label);
    }
  }

  private scheduleProgressUpdate(): void {
    if (this.historySessionId == null) return;
    if (this.updateTimer) clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => {
      void this.persistBookmark(false);
    }, 1500);
  }

  private scheduleConfigSave(): void {
    if (this.configTimer) clearTimeout(this.configTimer);
    this.configTimer = setTimeout(() => {
      void this.persistConfiguration();
    }, 800);
  }

  private storedBookMark(): number {
    return fromReaderIndex(this.currentPage(), this.pageCount());
  }

  private async persistBookmark(_force: boolean): Promise<Book | null> {
    if (!this.bookId) return null;
    const bookMark = this.storedBookMark();
    if (this.historySessionId != null) {
      await this.electron.updateHistorySession({
        id: this.historySessionId,
        pageEnd: bookMark,
        pages: this.pageCount()
      });
    }
    // Page 1 with a mid-book CFI is stale (locations skip image covers). Keep cover /
    // first-location CFIs; clear anything that would reopen past page 1.
    let bookMarkCfi = this.currentCfi() || undefined;
    if (bookMark <= 1 && bookMarkCfi) {
      const atStart = !!(this.rendition as any)?.location?.atStart;
      if (!atStart) {
        const loc = this.locationFromCfiSafe(bookMarkCfi);
        if (loc > 0) bookMarkCfi = undefined;
      }
    }
    return await this.electron.setBookBookmark({
      id: this.bookId,
      bookMark,
      bookMarkCfi,
      chapter: this.chapterTitle() || undefined,
      pages: this.pageCount()
    });
  }

  private async persistConfiguration(): Promise<void> {
    if (!this.bookId) return;
    const config: BookConfiguration = {
      fkBook: this.bookId,
      alignment: this.align(),
      margin: this.margin(),
      spacing: this.spacing(),
      scrolling: this.scrollingMode(),
      pagination: this.pageTransition(),
      fontType: this.fontFamily(),
      fontSize: this.fontSize()
    };
    await this.electron.saveBookConfiguration(config);
  }

  private destroyEpub(): void {
    this.stopSearch();
    this.clearTemporarySearchHighlight();
    try {
      this.rendition?.off?.('click', this.onRenditionClick);
      this.rendition?.off?.('dblclick', this.onRenditionDblClick);
      this.rendition?.off?.('selected', this.onRenditionSelected);
      this.rendition?.off?.('touchend', this.onRenditionTouchEnd);
    } catch {}
    this.clearContentPanListeners();
    this.resetOverscroll(false);
    this.turnDriver?.release();
    this.turnDriver = null;
    this.driverActive.set(false);
    this.destroyPeekRendition(true, true);
    this.clearPageBitmapCache();
    this.epubUrl = null;
    void this.electron.disposeBookCapture();
    try {
      this.rendition?.destroy();
    } catch {}
    try {
      this.epubBook?.destroy();
    } catch {}
    this.rendition = null;
    this.epubBook = null;
  }

  private async cleanup(): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    if (this.updateTimer) clearTimeout(this.updateTimer);
    if (this.configTimer) clearTimeout(this.configTimer);

    this.stopTts();

    await this.persistBookmark(true);
    await this.persistConfiguration();

    if (this.historySessionId != null) {
      await this.electron.endHistorySession({
        id: this.historySessionId,
        pageEnd: this.storedBookMark(),
        pages: this.pageCount(),
        type: 'BOOK',
        fkReference: this.bookId,
        useTTS: this.historyUsedTts
      });
      this.historySessionId = null;
    }

    this.destroyEpub();

    if (this.readerSessionId) {
      await this.electron.closeBookReader(this.readerSessionId);
      this.readerSessionId = null;
    }

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {}
    }
  }
}
