import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
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
  playCssCurlTurn,
  playPageTurn
} from '../reader-shared/page-transition/page-transition.player';
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
        <div
          #viewerPeek
          class="absolute inset-0 origin-top pointer-events-none will-change-transform"
          [style.background]="pageBg"
          [style.zoom]="zoom()"
          [style.transform]="peekTransform()"
          [style.transition]="viewerTransition()"
          [style.visibility]="peekLayerActive() ? 'visible' : 'hidden'"></div>
        <div
          #viewer
          class="absolute inset-0 origin-top will-change-transform"
          [style.background]="pageBg"
          [style.zoom]="zoom()"
          [style.transform]="viewerTransform()"
          [style.transition]="viewerTransition()"></div>
      </div>

      <!-- Always-visible progress track + marker (full book width) -->
      @if (!loading() && !error()) {
        <div class="absolute bottom-0 inset-x-0 z-20 pointer-events-none">
          <div class="relative h-0.5 bg-slate-800">
            <div
              class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-indigo-400 shadow-sm transition-[left] duration-200"
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
                <div class="absolute right-0 top-full mt-1 w-56 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl py-1 z-50">
                  <button type="button" (click)="openTracker(); touchMenuOpen.set(false)"
                    class="w-full px-3 py-2.5 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center gap-2">
                    <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                    </svg>
                    Rastreamento (MAL / AniList)
                  </button>
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

      <!-- Seek (chrome) -->
      <div
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
            </div>
            <input
              type="range"
              min="0"
              [max]="Math.max(0, pageCount() - 1)"
              [ngModel]="currentPage()"
              [ngModelOptions]="{ updateOn: 'change' }"
              (ngModelChange)="seekTo($event)"
              class="reader-seek-input relative z-10 w-full cursor-pointer" />
          </div>
        </div>
      </div>

      <!-- Bottom toolbar -->
      <footer
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
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
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
    </div>
  `
})
export class ReaderTextComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('viewer') viewerRef?: ElementRef<HTMLElement>;
  @ViewChild('viewerHost') viewerHostRef?: ElementRef<HTMLElement>;
  @ViewChild('viewerPeek') viewerPeekRef?: ElementRef<HTMLElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private electron = inject(ElectronService);
  private nav = inject(NavigationStackService);
  settings = inject(SettingsService);
  private touchZones = inject(TouchZoneService);
  private sanitizer = inject(DomSanitizer);
  private bookUnlock = inject(BookUnlockService);

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
  zoom = signal(1);
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
  private viewReady = false;
  private pendingOpen: { epubUrl: string; bookMark: number; bookMarkCfi: string } | null = null;
  private relocating = false;
  private wheelAccum = 0;
  private didDrag = false;
  private panPointerId: number | null = null;
  private panLastX = 0;
  private panLastY = 0;
  private panLastMoveAt = 0;
  private panVelocityX = 0;
  private panVelocityY = 0;
  /** When true, this pointer gesture is text selection — skip pan/overscroll. */
  private panSelectMode = false;
  /** Accumulated overscroll while dragging past page edge (paginated), 1:1 with pointer. */
  private overscrollX = 0;
  private overscrollY = 0;
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
  private lastTapSource: 'click' | 'touch' | null = null;
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
    const x = this.overscrollXSignal();
    const y = this.overscrollYSignal();
    if (x === 0 && y === 0) return 'none';
    return `translate(${x}px, ${y}px)`;
  });

  /** Adjacent page offset (ViewPager): enters from the edge, slides with current. */
  readonly peekTransform = computed(() => {
    const x = this.overscrollXSignal();
    const y = this.overscrollYSignal();
    if (x === 0 && y === 0) return 'none';

    if (this.isHorizontalMode()) {
      const w = this.peekViewportW() || window.innerWidth;
      if (x === 0) return 'none';
      // LTR next (x<0): +w; LTR prev (x>0): -w; RTL inverts
      const dir = this.usesRtlPageKeys() ? (x > 0 ? 1 : -1) : (x < 0 ? 1 : -1);
      const side = this.usesRtlPageKeys() ? -dir : dir;
      return `translate(${x + side * w}px, 0)`;
    }

    const h = this.peekViewportH() || window.innerHeight;
    const dir = y < 0 ? 1 : -1;
    return `translate(0, ${y + dir * h}px)`;
  });

  readonly viewerTransition = computed(() =>
    this.overscrollAnimatingSignal() ? 'transform 180ms ease-out' : 'none'
  );

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
      } else {
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
    return (location / max) * 100;
  }

  /**
   * Tap zones from epub.js iframe events.
   * Prefer host-local coords (already mapped from iframe); otherwise treat as viewport coords.
   */
  handleReaderTap(clientX: number, clientY?: number, alreadyHostLocal = false): void {
    if (this.loading() || this.error()) return;
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

  /** Ingest tap from click or touchend; ignore cross-type duplicates (Windows). */
  private ingestMappedTap(source: 'click' | 'touch', mapped: { x: number; y: number }): void {
    const now = Date.now();
    if (
      this.lastTapSource &&
      this.lastTapSource !== source &&
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

  /** Navigate previous with continuous scroll or internal page scroll first. */
  goPrev(): void {
    if (this.isContinuousScrollMode()) {
      this.scrollContinuousBy(-1);
      return;
    }
    if (this.tryScrollContents(-1)) return;
    void this.turnWithEffect(-1);
  }

  /** Navigate next with continuous scroll or internal page scroll first. */
  goNext(): void {
    if (this.isContinuousScrollMode()) {
      if (!this.scrollContinuousBy(1) && this.isAtBookEnd()) {
        this.requestAdjacentFile('next');
      }
      return;
    }
    if (this.tryScrollContents(1)) return;
    void this.turnWithEffect(1);
  }

  prevPage(): void {
    if (!this.rendition) return;
    void this.rendition.prev();
  }

  nextPage(): void {
    if (!this.rendition) return;
    if (this.isAtBookEnd()) {
      this.requestAdjacentFile('next');
      return;
    }
    void this.rendition.next();
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

  seekTo(page: number): void {
    if (!this.epubBook) return;
    const max = Math.max(0, this.pageCount() - 1);
    const next = Math.min(Math.max(0, Number(page) || 0), max);
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
      let startCfi: string | undefined;
      try {
        startCfi = this.epubBook.locations.cfiFromPercentage(0) as string;
      } catch { /* ignore */ }
      if (!startCfi) {
        try {
          startCfi = this.epubBook.locations.cfiFromLocation(0) as string;
        } catch { /* ignore */ }
      }
      const spineFirst = (this.epubBook as any).spine?.first?.();
      const target = startCfi || spineFirst?.href || undefined;
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
    this.isFullscreen.set(!!document.fullscreenElement);
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
      !!this.switchConfirm()
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
      this.chromeVisible.update(v => !v);
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

    let iframe: HTMLElement | null = null;
    try {
      const view = (event as any).view as Window | undefined;
      iframe = (view?.frameElement as HTMLElement | null)
        || ((event.target as Node | null)?.ownerDocument?.defaultView?.frameElement as HTMLElement | null)
        || (this.activeContents()?.document?.defaultView?.frameElement as HTMLElement | null)
        || null;
    } catch { /* ignore */ }

    if (!iframe) {
      // Already viewport-relative (host-level event)
      return {
        x: event.clientX - hostRect.left,
        y: event.clientY - hostRect.top
      };
    }

    const iframeRect = iframe.getBoundingClientRect();
    // If view is the top window, client coords are already viewport-relative
    const isTopView = !!(event as any).view && (event as any).view === window;
    if (isTopView) {
      return {
        x: event.clientX - hostRect.left,
        y: event.clientY - hostRect.top
      };
    }

    const screenX = iframeRect.left + event.clientX;
    const screenY = iframeRect.top + event.clientY;
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

    const book = ePub(epubUrl);
    this.epubBook = book;

    await book.ready;
    this.loadingMessage.set('Gerando índice de progresso…');
    await book.locations.generate(1600);
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

    let resolvedCfi = startCfi || undefined;
    if (!resolvedCfi && startMark > 0) {
      try {
        resolvedCfi = book.locations.cfiFromLocation(startMark) as string;
      } catch { /* ignore */ }
    }

    if (resolvedCfi) {
      await this.rendition!.display(resolvedCfi);
      this.currentPage.set(Math.min(startMark, locationCount - 1));
      this.currentCfi.set(resolvedCfi);
    } else {
      // Same path as Home — display() alone does not guarantee first page in continuous
      this.forceStartPageUntil = Date.now() + 800;
      try {
        let firstCfi: string | undefined;
        try {
          firstCfi = book.locations.cfiFromPercentage(0) as string;
        } catch { /* ignore */ }
        if (!firstCfi) {
          try {
            firstCfi = book.locations.cfiFromLocation(0) as string;
          } catch { /* ignore */ }
        }
        const spineFirst = (book as any).spine?.first?.();
        const target = firstCfi || spineFirst?.href;
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
      bookMarkCfi: this.currentCfi() || undefined,
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

    // Pan + wheel/keydown inside iframe documents
    rendition.hooks.content.register((contents: any) => {
      this.bindContentsInput(contents);
      this.attachContentPan(contents);
      void this.enhanceJapaneseContents(contents);
    });

    rendition.on('relocated', (location: any) => {
      if (this.relocating) return;
      this.invalidatePeek();
      const cfi = location?.start?.cfi || '';
      this.currentCfi.set(cfi);
      let loc = this.locationFromCfiSafe(cfi, location);
      if (Date.now() < this.forceStartPageUntil && loc > 0) {
        // Keep page 0 until CFI after Home/open stabilizes
        loc = 0;
      } else if (Date.now() >= this.forceStartPageUntil) {
        this.forceStartPageUntil = 0;
      }
      loc = Math.min(Math.max(0, loc), Math.max(0, this.pageCount() - 1));
      this.currentPage.set(loc);
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

  private buildRenditionOptions(): Record<string, unknown> {
    const mode = this.scrollingMode();
    const continuous = mode === BookScrollingMode.Continuous;
    if (continuous) {
      return {
        width: '100%',
        height: '100%',
        manager: 'continuous',
        flow: 'scrolled',
        allowScriptedContent: false
      };
    }
    const opts: Record<string, unknown> = {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      allowScriptedContent: false,
      defaultDirection: mode === BookScrollingMode.PaginationRtl ? 'rtl' : 'ltr',
      // Explicit spread — epub.js otherwise auto-enables two columns above minSpreadWidth
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
    if (this.loading() || this.error() || this.editingAnnotation()) return;
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

  private deactivatePeekLayer(): void {
    this.peekLayerActive.set(false);
  }

  private attachContentPan(contents: any): void {
    const doc: Document | undefined = contents?.document;
    const win: Window | undefined = contents?.window;
    if (!doc || !win) return;

    try {
      doc.body.style.cursor = 'grab';
    } catch { /* ignore */ }

    const onSelectionChange = (): void => {
      if (this.panPointerId == null || this.panSelectMode) return;
      if (this.hasSelectionInWindow(win)) {
        this.abortPanForSelect();
      }
    };

    const onDown = (ev: PointerEvent) => {
      if (ev.button !== 0 || this.loading()) return;
      this.didDrag = false;
      this.panSelectMode = false;
      this.overscrollX = 0;
      this.overscrollY = 0;
      this.panVelocityX = 0;
      this.panVelocityY = 0;
      this.panLastMoveAt = performance.now();
      this.syncOverscrollSignals(false);

      // Existing selection — let the user extend/clear it; do not start pan
      if (this.hasSelectionInWindow(win)) {
        this.panSelectMode = true;
        this.panning.set(false);
        this.panPointerId = ev.pointerId;
        this.panLastX = ev.screenX;
        this.panLastY = ev.screenY;
        return;
      }

      this.panning.set(true);
      this.panPointerId = ev.pointerId;
      // screenX/Y = 1:1 with physical drag (iframe zoom does not shrink accum)
      this.panLastX = ev.screenX;
      this.panLastY = ev.screenY;
      try {
        doc.body.style.cursor = 'grabbing';
      } catch { /* ignore */ }
    };

    const onMove = (ev: PointerEvent) => {
      if (this.panPointerId !== ev.pointerId) return;
      if (this.panSelectMode) return;
      if (!this.panning()) return;

      const dx = ev.screenX - this.panLastX;
      const dy = ev.screenY - this.panLastY;
      this.panLastX = ev.screenX;
      this.panLastY = ev.screenY;
      const now = performance.now();
      const dt = Math.max(1, now - this.panLastMoveAt) / 1000;
      this.panVelocityX = dx / dt;
      this.panVelocityY = dy / dt;
      this.panLastMoveAt = now;

      // Selection started during this gesture — abort pan before stealing it
      if (this.hasSelectionInWindow(win)) {
        this.abortPanForSelect();
        return;
      }

      if (Math.abs(dx) + Math.abs(dy) <= DRAG_THRESHOLD_PX && !this.didDrag) {
        return; // allow native text selection until drag threshold
      }
      this.didDrag = true;

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
            this.syncOverscrollSignals(false);
            if (this.overscrollX !== 0) {
              this.peekLayerActive.set(true);
              this.ensurePeekForOverscroll();
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
            this.peekLayerActive.set(true);
            this.ensurePeekForOverscroll();
          }
          return;
        }

        // Zoom pan fallback
        win.scrollBy(-dx, -dy);
      } catch { /* ignore */ }
    };

    const onUp = (ev: PointerEvent) => {
      if (this.panPointerId !== ev.pointerId) return;
      const wasSelect = this.panSelectMode || this.hasSelectionInWindow(win);
      this.panPointerId = null;
      this.panSelectMode = false;
      this.panning.set(false);
      try {
        doc.body.style.cursor = 'grab';
      } catch { /* ignore */ }

      if (wasSelect) {
        this.resetOverscroll(false);
        this.deactivatePeekLayer();
        // Flush deferred popup after drag ends (selected may have queued while pointer was down)
        this.flushPendingSelectShow(contents);
        return;
      }

      if (this.isPaginatedMode() && this.didDrag) {
        this.commitOrSnapOverscroll();
      } else {
        this.resetOverscroll(true);
        this.deactivatePeekLayer();
      }
    };

    doc.addEventListener('pointerdown', onDown);
    doc.addEventListener('pointermove', onMove);
    doc.addEventListener('pointerup', onUp);
    doc.addEventListener('pointercancel', onUp);
    doc.addEventListener('selectionchange', onSelectionChange);

    this.contentCleanups.push(() => {
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

  private async loadPeek(dir: 1 | -1): Promise<void> {
    if (!this.epubBook || !this.rendition || !this.isPaginatedMode()) return;
    const peekEl = this.viewerPeekRef?.nativeElement;
    if (!peekEl) return;

    // Visual page edge — not locations index (±1 char chunk)
    const mainLoc = this.rendition.location;
    if (dir > 0 && mainLoc?.atEnd) return;
    if (dir < 0 && mainLoc?.atStart) return;

    const cfi = this.currentCfi() || mainLoc?.start?.cfi;
    if (!cfi) return;

    this.destroyPeekRendition(false);
    this.peekDirection = dir;
    this.peekStale = false;
    const token = ++this.peekLoadToken;

    try {
      // Do NOT use book.renderTo — it overwrites book.rendition and breaks the main viewer
      const peekOpts = this.buildRenditionOptions();
      // Peek is always paginated (never continuous)
      delete peekOpts['manager'];
      peekOpts['flow'] = 'paginated';
      const peek = new Rendition(this.epubBook, peekOpts as any);
      await peek.attachTo(peekEl);
      if (token !== this.peekLoadToken) {
        try {
          peek.destroy();
        } catch { /* ignore */ }
        return;
      }
      this.peekRendition = peek;
      this.applyTypography(peek);
      await peek.display(cfi);
      if (token !== this.peekLoadToken) return;

      // Same visual step as nextPage() / prevPage()
      if (dir > 0) await peek.next();
      else await peek.prev();
      if (token !== this.peekLoadToken) return;

      const afterCfi = peek.location?.start?.cfi;
      if (!afterCfi || afterCfi === cfi) {
        this.destroyPeekRendition(false);
      }
    } catch (e) {
      console.warn('[reader-text] peek load failed', e);
      this.destroyPeekRendition(false);
    }
  }

  /** @param hideLayer when false, keep ViewPager layer visible (reload mid-gesture). */
  private destroyPeekRendition(hideLayer = true): void {
    this.peekLoadToken++;
    try {
      this.peekRendition?.destroy();
    } catch { /* ignore */ }
    this.peekRendition = null;
    this.peekDirection = 0;
    this.peekStale = true;
    const peekEl = this.viewerPeekRef?.nativeElement;
    if (peekEl) {
      try {
        peekEl.innerHTML = '';
      } catch { /* ignore */ }
    }
    if (hideLayer) this.deactivatePeekLayer();
  }

  private invalidatePeek(): void {
    this.destroyPeekRendition(true);
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
      this.resetOverscroll(false);
      void this.finishOverscrollWithEffect(dir);
      return;
    }

    this.resetOverscroll(true);
    setTimeout(() => {
      if (!this.panning() && this.overscrollX === 0 && this.overscrollY === 0) {
        this.deactivatePeekLayer();
      }
    }, 200);
  }

  private async finishOverscrollWithEffect(dir: 1 | -1): Promise<void> {
    const effect = this.effectiveBookTransition();
    if (effect === PageTransitionType.Default || this.turningPage) {
      this.invalidatePeek();
      if (dir > 0) this.nextPage();
      else this.prevPage();
      return;
    }
    // Peek should already be loaded from the drag; ensure it exists
    if (this.peekDirection !== dir || this.peekStale) {
      await this.loadPeek(dir);
    }
    this.peekLayerActive.set(true);
    await this.animateViewerTurn(dir, effect);
    if (dir > 0) this.nextPage();
    else this.prevPage();
    this.destroyPeekRendition(true);
    this.clearViewerAnimStyles();
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
          'margin-left': imgMl,
          'margin-right': imgMr,
          'object-fit': 'contain'
        }
      : {
          'max-width': '100% !important',
          'width': 'auto !important',
          'height': 'auto !important',
          'display': 'block !important',
          'margin-left': imgMl,
          'margin-right': imgMr,
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
    if (!host || typeof ResizeObserver === 'undefined') return;
    this.teardownViewerResizeObserver();
    this.resizeObserver = new ResizeObserver(() => this.scheduleRenditionResize());
    this.resizeObserver.observe(host);
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
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      void this.reflowAtCfi();
    }, 150);
  }

  private scheduleTypographyReflow(): void {
    this.applyTypography();
    if (this.typographyTimer) clearTimeout(this.typographyTimer);
    this.typographyTimer = setTimeout(() => {
      void this.reflowAtCfi();
    }, 200);
  }

  private async reflowAtCfi(): Promise<void> {
    if (!this.rendition || this.relocating) return;
    const cfi = this.currentCfi();
    const host = this.viewerHostRef?.nativeElement;
    const z = this.zoom() || 1;
    try {
      if (host) {
        const w = Math.max(1, host.clientWidth / z);
        const h = Math.max(1, host.clientHeight / z);
        this.rendition.resize(w, h);
        if (this.peekRendition) {
          try {
            this.peekRendition.resize(w, h);
          } catch {
            /* ignore */
          }
        }
      } else {
        this.rendition.resize(window.innerWidth / z, window.innerHeight / z);
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
      console.warn('[reader-text] reflow failed', e);
      this.relocating = false;
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

  private async turnWithEffect(dir: 1 | -1): Promise<void> {
    if (!this.rendition || this.turningPage) {
      if (dir > 0) this.nextPage();
      else this.prevPage();
      return;
    }
    const effect = this.effectiveBookTransition();
    if (effect === PageTransitionType.Default) {
      if (dir > 0) this.nextPage();
      else this.prevPage();
      return;
    }

    this.turningPage = true;
    try {
      await this.loadPeek(dir);
      this.peekLayerActive.set(true);
      await this.animateViewerTurn(dir, effect);
      if (dir > 0) this.nextPage();
      else this.prevPage();
    } finally {
      this.destroyPeekRendition(true);
      this.clearViewerAnimStyles();
      this.turningPage = false;
    }
  }

  private async animateViewerTurn(dir: 1 | -1, effect: PageTransitionType): Promise<void> {
    const viewer = this.viewerRef?.nativeElement;
    const peek = this.viewerPeekRef?.nativeElement;
    if (!viewer || !peek) return;

    this.overscrollAnimatingSignal.set(false);
    // Clear overscroll translates so WAAPI owns the transform
    this.overscrollXSignal.set(0);
    this.overscrollYSignal.set(0);

    const host = this.viewerHostRef?.nativeElement;
    const axis: TurnAxis = this.isHorizontalMode() ? 'x' : 'y';
    const size =
      axis === 'x'
        ? host?.clientWidth || window.innerWidth
        : host?.clientHeight || window.innerHeight;
    const turnDir = dir as TurnDir;

    const isCurl =
      effect === PageTransitionType.CurlPage || effect === PageTransitionType.Curl3DPage;

    if (isCurl && this.isHorizontalMode()) {
      // CSS 3D fold — iframe can't be cheaply rasterized for canvas curl
      await playCssCurlTurn(viewer, turnDir);
      return;
    }

    const playEffect = isCurl ? PageTransitionType.Fade : effect;
    await playPageTurn({
      outgoing: viewer,
      incoming: peek,
      effect: playEffect,
      axis,
      dir: turnDir,
      size
    });
  }

  private clearViewerAnimStyles(): void {
    const viewer = this.viewerRef?.nativeElement;
    const peek = this.viewerPeekRef?.nativeElement;
    for (const el of [viewer, peek]) {
      if (!el) continue;
      el.style.transform = '';
      el.style.opacity = '';
      el.style.boxShadow = '';
      el.style.zIndex = '';
      el.style.transformOrigin = '';
    }
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

      // Drop consecutive duplicates (nested TOC pointing at the same spine item).
      const deduped: TocEntry[] = [];
      for (const entry of flat) {
        const prev = deduped[deduped.length - 1];
        if (prev && prev.location >= 0 && entry.location === prev.location) continue;
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

    const cfi = section.cfiBase as string | undefined;
    if (cfi) {
      const fromCfi = this.locationFromCfiValue(book, cfi);
      if (fromCfi >= 0) return fromCfi;
    }

    // Fallback: map spine index proportionally onto the locations timeline.
    try {
      const spineLen = Number((book as any).spine?.length) || 0;
      const idx = typeof section.index === 'number' ? section.index : -1;
      const locLen = Math.max(1, book.locations.length() - 1);
      if (idx === 0) return 0;
      if (idx > 0 && spineLen > 1) {
        return Math.min(locLen, Math.max(0, Math.round((idx / (spineLen - 1)) * locLen)));
      }
    } catch { /* ignore */ }
    return -1;
  }

  private resolveSpineSection(book: EpubBook, href: string): any | null {
    const spine = (book as any).spine;
    if (!spine?.get) return null;

    const raw = (href || '').trim();
    if (!raw) return null;
    const noHash = raw.split('#')[0];
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
      const canon = typeof (book as any).canonical === 'function'
        ? (book as any).canonical(noHash)
        : null;
      if (canon) candidates.add(String(canon));
    } catch { /* ignore */ }

    for (const c of candidates) {
      try {
        const section = spine.get(c);
        if (section) return section;
      } catch { /* try next */ }
    }
    return null;
  }

  private locationFromCfiValue(book: EpubBook, cfi: string): number {
    if (!cfi || !book.locations) return -1;
    try {
      const raw = book.locations.locationFromCfi(cfi) as unknown;
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isFinite(n) && n >= 0) return Math.round(n);
    } catch { /* try percentage */ }
    try {
      const pctRaw = book.locations.percentageFromCfi(cfi) as unknown;
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
    return await this.electron.setBookBookmark({
      id: this.bookId,
      bookMark,
      bookMarkCfi: this.currentCfi() || undefined,
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
    this.destroyPeekRendition();
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
