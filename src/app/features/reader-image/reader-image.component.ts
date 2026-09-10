import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewChecked,
  inject,
  signal,
  computed,
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
import { Manga, MangaAnnotation, MangaFitMode, MangaScrollingMode, PAGE_TRANSITION_LABELS_PT, PAGE_TRANSITION_OPTIONS, PageTransitionType, prefersReducedMotion, isMangaDualMode, isMangaHorizontalMode, isMangaLongStripMode, isMangaRtlMode, isMangaVerticalMode, Kanjax, Vocabulary } from '../../core/models';
import { ReaderTouchOverlayComponent } from '../reader-shared/reader-touch-overlay.component';
import { ReaderTouchConfigComponent } from '../reader-shared/reader-touch-config.component';
import { handleReaderTouchTap, TouchActionHandlers } from '../reader-shared/touch-action.util';
import {
  MangaPageTurnLayerComponent,
  type TurnLayerPage
} from '../reader-shared/page-transition/manga-page-turn-layer.component';
import type { TurnAxis, TurnDir } from '../../core/models/enums/page-transition.enums';
import { PagesLinkOverlayComponent } from './pages-link/pages-link-overlay.component';
import { LinkedFile } from '../../core/models/entities/linked-file.model';
import { PAGE_EMPTY } from '../../core/models/enums/page-link-enums';
import { MangaSpreadViewportComponent } from './manga-spread-viewport.component';
import { MangaDualSpreadViewportComponent } from './dual/manga-dual-spread-viewport.component';
import {
  buildSpreads,
  isWideSpreadPage,
  nextSpreadIndex,
  prevSpreadIndex,
  primaryPageOfSpread,
  spreadIndexForPage,
  visualOrder,
  type MangaSpread
} from './dual/manga-dual-spread';
import { fromReaderIndex, toReaderIndex } from '../../core/utils/reading-progress.util';
import { type PageLand } from './manga-reader-navigation';
import { MangaSubtitlePanelComponent } from './subtitle/manga-subtitle-panel.component';
import { chaptersForLanguage, findSubtitlePage } from './subtitle/subtitle-match.util';
import {
  emptySubtitleCatalog,
  NormalizedSubtitleText,
  SubtitleCatalog
} from '../../core/utils/subtitle-normalize';
import { VocabularyDetailDialogComponent } from '../vocabulary/components/vocabulary-detail-dialog.component';
import { KanjaxDetailDialogComponent } from '../vocabulary/components/kanjax-detail-dialog.component';
import { ReadingAssistantPanelComponent } from '../assistant/reading-assistant-panel.component';
import { ReadingSummaryDialogComponent } from '../assistant/reading-summary-dialog.component';
import { AssistantContextItem } from '../assistant/assistant-context.util';

import {
  buildPageCssFilter,
  buildTintOverlays,
  blueLightPercent,
  DEFAULT_MANGA_COLOR_FILTER,
  MANGA_COLOR_FILTER_KEYS,
  MANGA_USE_MAGNIFIER_TYPE_KEY,
  type MangaColorFilterState
} from './manga-color-filters';

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP_WHEEL = 0.1;
const ZOOM_STEP_BUTTON = 0.25;
const ZOOM_DOUBLE_TAP = 2;
const MAGNIFIER_SCALE = 2.5;
const MAGNIFIER_CIRCLE_PX = 120;
const MAGNIFIER_SQUARE_PX = 250;

@Component({
  selector: 'app-reader-image',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReaderTouchOverlayComponent,
    ReaderTouchConfigComponent,
    PagesLinkOverlayComponent,
    MangaSpreadViewportComponent,
    MangaDualSpreadViewportComponent,
    MangaPageTurnLayerComponent,
    MangaSubtitlePanelComponent,
    VocabularyDetailDialogComponent,
    KanjaxDetailDialogComponent,
    ReadingAssistantPanelComponent,
    ReadingSummaryDialogComponent
  ],
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
    .reader-viewport.is-panning,
    .reader-viewport.is-turning {
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
    .reader-magnifier {
      position: absolute;
      z-index: 45;
      pointer-events: none;
      border: 2px solid #94a3b8;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
      background-color: #0f172a;
      background-repeat: no-repeat;
    }
    .reader-magnifier.is-circle {
      border-radius: 9999px;
    }
    .reader-magnifier.is-square {
      border-radius: 0.5rem;
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
      @if (useDualSpread()) {
        <div class="absolute inset-0 z-0">
          <app-manga-dual-spread-viewport
            [pages]="pages()"
            [spreads]="spreads()"
            [spreadIndex]="spreadIndex()"
            [rtl]="isRtl()"
            [axis]="isVerticalMode() ? 'vertical' : 'horizontal'"
            [fitMode]="fitMode()"
            [zoom]="zoom()"
            [effect]="effectivePageTransition()"
            [activePage]="activeDualPage()"
            [linkedUrls]="linkedPageMap()"
            [showingLinked]="linkedVisiblePages()"
            [cssFilter]="pageCssFilter()"
            [tintOverlays]="pageTintOverlays()"
            [subtitleTexts]="currentSubtitleTexts()"
            [ocrTexts]="ocrOverlayTexts()"
            [showSubtitleOverlay]="subtitleDrawBoxes() && subtitlePanelOpen()"
            [showOcrOverlay]="ocrDrawBoxes() && ocrPanelOpen() && ocrOverlayTexts().length > 0"
            [selectedSubtitleSeq]="selectedSubtitleSeq()"
            [pageNaturalWidth]="pageNaturalSize(activeDualPage()).w"
            [pageNaturalHeight]="pageNaturalSize(activeDualPage()).h"
            (spreadIndexChange)="onDualSpreadChange($event)"
            (pageActivate)="activeDualPage.set($event)"
            (imageSized)="onDualImageSized($event)"
            (imageError)="onPageImageError($event.url)"
            (viewportClick)="onViewportClick($event)"
            (viewportWheel)="onViewportWheel($event)"
            (shiftMagnify)="onMagnifierStart($event)"
            (selectText)="onSubtitleSelect($event)"
            (curlDrag)="onDualCurlDrag($event)" />
        </div>
      } @else {
        <div class="absolute inset-0 z-0">
          <app-manga-spread-viewport
            [pages]="pages()"
            [currentPage]="currentPage()"
            [scrollingMode]="scrollingMode()"
            [fitMode]="fitMode()"
            [zoom]="zoom()"
            [effect]="effectivePageTransition()"
            [linkedUrls]="linkedPageMap()"
            [showingLinked]="linkedVisiblePages()"
            [cssFilter]="pageCssFilter()"
            [tintOverlays]="pageTintOverlays()"
            [subtitleTexts]="currentSubtitleTexts()"
            [ocrTexts]="ocrOverlayTexts()"
            [showSubtitleOverlay]="subtitleDrawBoxes() && subtitlePanelOpen()"
            [showOcrOverlay]="ocrDrawBoxes() && ocrPanelOpen() && ocrOverlayTexts().length > 0"
            [selectedSubtitleSeq]="selectedSubtitleSeq()"
            [pageNaturals]="pageNaturals()"
            [activeReadPage]="activeReadPage()"
            [turning]="turning"
            [loading]="loading()"
            (pageChange)="onSinglePageChange($event)"
            (pageSync)="onSinglePageSync($event)"
            (viewportClick)="onViewportClick($event)"
            (viewportWheel)="onViewportWheel($event)"
            (shiftMagnify)="onMagnifierStart($event)"
            (imageSized)="onSingleImageSized($event)"
            (imageError)="onPageImageError($event.url)"
            (linkedImageLoad)="onLinkedImageLoad($event)"
            (selectText)="onSubtitleSelect($event)"
            (dragFlag)="onDragFlag($event)"
            (curlDrag)="onSingleCurlDrag($event)" />
        </div>
      }

      @if (turnLayer(); as turn) {
        <app-manga-page-turn-layer
          [outgoing]="turn.outgoing"
          [incoming]="turn.incoming"
          [effect]="turn.effect"
          [axis]="turn.axis"
          [dir]="turn.dir"
          [fitMode]="fitMode()"
          [zoom]="zoom()"
          [cssFilter]="pageCssFilter()"
          [curlFactor]="turn.curlFactor"
          [curlCommit]="turn.curlCommit"
          (finished)="onTurnFinished()" />
      }

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
                {{ pageLabel() }}
                @if (isShowingLinked(activeReadPage())) {
                  <span class="ml-1 text-indigo-300 font-semibold">· Tradução</span>
                }
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

            <button type="button" (click)="openPagesLink()"
              class="p-2 rounded-lg transition-colors cursor-pointer"
              [class.text-indigo-300]="hasFileLink()"
              [class.text-slate-300]="!hasFileLink()"
              title="Vincular páginas">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
              </svg>
            </button>

            <button type="button" (click)="toggleLinkedPage()"
              class="p-2 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              [disabled]="!hasLinkedPage(activeReadPage())"
              [class.text-indigo-300]="isShowingLinked(activeReadPage())"
              [class.text-slate-300]="!isShowingLinked(activeReadPage())"
              title="Trocar imagem vinculada (L)">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
              </svg>
            </button>

            <select
              class="hidden sm:block bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 max-w-[16rem]"
              [ngModel]="scrollingMode()"
              (ngModelChange)="setScrollingMode($event)"
              title="Modo de rolagem">
              <option [ngValue]="MangaScrollingMode.Horizontal">Horizontal (Esquerda para direita)</option>
              <option [ngValue]="MangaScrollingMode.HorizontalRtl">Horizontal (Direita para esquerda)</option>
              <option [ngValue]="MangaScrollingMode.HorizontalDual">Horizontal Dupla (Esquerda para direita)</option>
              <option [ngValue]="MangaScrollingMode.HorizontalDualRtl">Horizontal Dupla (Direita para esquerda)</option>
              <option [ngValue]="MangaScrollingMode.Vertical">Vertical</option>
              <option [ngValue]="MangaScrollingMode.VerticalDual">Vertical Dupla</option>
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

            <select
              class="hidden md:block bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 max-w-[11rem]"
              [ngModel]="pageTransition()"
              (ngModelChange)="setPageTransition($event)"
              title="Animação de transição de página">
              @for (opt of pageTransitionOptions; track opt) {
                <option [ngValue]="opt">{{ pageTransitionLabels[opt] }}</option>
              }
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
                  <button type="button" (click)="openPagesLink(); touchMenuOpen.set(false)"
                    class="w-full px-3 py-2.5 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer">
                    Vincular páginas
                  </button>
                  <button type="button" (click)="toggleLinkedPage(); touchMenuOpen.set(false)"
                    class="w-full px-3 py-2.5 text-left text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer disabled:opacity-40"
                    [disabled]="!hasLinkedPage(activeReadPage())">
                    Trocar imagem vinculada
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
          <button type="button" (click)="requestAdjacentFile('prev')"
            class="p-2.5 rounded-xl text-slate-200 hover:bg-slate-800 cursor-pointer" title="Arquivo anterior">
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

          <button type="button" (click)="toggleAnnotations()"
            class="p-2.5 rounded-xl cursor-pointer hover:bg-slate-800"
            [ngClass]="{
              'text-amber-300 bg-amber-600/20': showAnnotations(),
              'text-slate-200': !showAnnotations()
            }"
            title="Anotações">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 8h10M7 12h6m-6 8l-4-4V6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H7z"/>
            </svg>
          </button>

          <button type="button" (click)="openAssistant()"
            class="p-2.5 rounded-xl cursor-pointer hover:bg-slate-800 text-slate-200"
            [class.text-indigo-300]="showAssistant()"
            title="Assistente de leitura">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
            </svg>
          </button>

          <button type="button" (click)="toggleColorFilters()"
            class="p-2.5 rounded-xl cursor-pointer hover:bg-slate-800"
            [ngClass]="{
              'text-violet-300 bg-violet-600/20': showColorFilters(),
              'text-slate-200': !showColorFilters()
            }"
            title="Filtros de cor">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
          </button>

          <button type="button" (click)="toggleSubtitlePanel()"
            class="p-2.5 rounded-xl cursor-pointer hover:bg-slate-800"
            [ngClass]="{
              'text-indigo-300 bg-indigo-600/20': subtitlePanelOpen(),
              'text-slate-200': !subtitlePanelOpen()
            }"
            title="Legendas">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 8h10M7 12h8m-8 4h6M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"/>
            </svg>
          </button>

          <div class="relative">
            <button type="button" (click)="toggleOcrMenu()"
              class="p-2.5 rounded-xl text-slate-200 hover:bg-slate-800 cursor-pointer"
              [class.text-emerald-300]="ocrMenuOpen() || ocrPanelOpen()"
              title="OCR">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
            </button>
            @if (ocrMenuOpen()) {
              <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-1 z-50">
                <button type="button" (click)="startOcrRegion()"
                  class="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800 cursor-pointer">
                  Tesseract (região)
                </button>
                <button type="button" (click)="runOcrFullPage()"
                  class="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800 cursor-pointer">
                  Página inteira
                </button>
                <div class="px-3 py-2 border-t border-slate-800">
                  <label class="block text-[10px] text-slate-500 mb-1">Idioma OCR</label>
                  <select class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                    [ngModel]="ocrLang()" (ngModelChange)="ocrLang.set($event); persistOcrLang($event)">
                    <option value="jpn">Japonês (jpn)</option>
                    <option value="jpn_vert">Japonês vertical</option>
                    <option value="eng">Inglês</option>
                    <option value="por">Português</option>
                  </select>
                </div>
                <div class="px-3 py-2 border-t border-slate-800">
                  <label class="block text-[10px] text-slate-500 mb-1">Motor (página)</label>
                  <select class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                    [ngModel]="ocrEnginePref()" (ngModelChange)="ocrEnginePref.set($event)">
                    <option value="auto">Automático (SO → Tesseract)</option>
                    <option value="tesseract">Só Tesseract</option>
                    <option value="windows">Preferir Windows OCR</option>
                  </select>
                </div>
              </div>
            }
          </div>

          <button type="button" (click)="goNext()"
            class="p-2.5 rounded-xl text-slate-200 hover:bg-slate-800 cursor-pointer" title="Próxima página">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>

          <button type="button" (click)="requestAdjacentFile('next')"
            class="p-2.5 rounded-xl text-slate-200 hover:bg-slate-800 cursor-pointer" title="Próximo arquivo">
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
                  {{ chapterLabel(ch, i) }}
                </button>
              }
            </div>
          }
        </div>
      }

      <!-- Annotations panel -->
      @if (showAnnotations() && chromeVisible()) {
        <div class="absolute bottom-16 left-1/2 -translate-x-1/2 z-40 w-[min(90vw,32rem)] max-h-72 overflow-y-auto
          bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-3"
          (click)="$event.stopPropagation()">
          <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Anotações</p>
          @if (pageMarkAnnotations().length === 0) {
            <p class="text-xs text-slate-500 py-4 text-center">Nenhuma página marcada</p>
          } @else {
            <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
              @for (ann of pageMarkAnnotations(); track ann.id ?? ann.page) {
                <div class="relative group rounded-lg overflow-hidden bg-slate-800 border border-slate-700">
                  <button type="button"
                    (click)="seekTo(ann.page); showAnnotations.set(false)"
                    class="block w-full cursor-pointer text-left">
                    <img
                      [src]="pages()[ann.page] || ''"
                      [alt]="'Página ' + (ann.page + 1)"
                      class="w-full aspect-[3/4] object-cover bg-slate-950"
                      loading="lazy"
                      draggable="false" />
                    <span class="block px-1.5 py-1 text-[10px] font-semibold text-slate-200 tabular-nums truncate">
                      Página {{ ann.page + 1 }}
                    </span>
                  </button>
                  <button type="button"
                    (click)="deleteAnnotation(ann); $event.stopPropagation()"
                    class="absolute top-1 right-1 p-1 rounded-md bg-slate-950/80 text-slate-300 hover:text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Excluir">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Color filters panel -->
      @if (showColorFilters() && chromeVisible()) {
        <div class="absolute bottom-16 left-1/2 -translate-x-1/2 z-40 w-[min(90vw,22rem)] max-h-[70vh] overflow-y-auto
          bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-4 space-y-3"
          (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between">
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Filtros de cor</p>
            <button type="button" (click)="resetColorFilters()"
              class="text-[10px] font-semibold text-indigo-300 hover:text-indigo-200 cursor-pointer">
              Limpar
            </button>
          </div>

          <label class="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
            <span>Filtro personalizado</span>
            <input type="checkbox" class="w-4 h-4 accent-violet-600 rounded"
              [ngModel]="colorFilters().customFilter"
              (ngModelChange)="patchColorFilter({ customFilter: $event })" />
          </label>
          @if (colorFilters().customFilter) {
            <div class="space-y-2 pl-1 border-l border-slate-700">
              <label class="block text-[10px] text-slate-400">
                R {{ colorFilters().colorRed }}
                <input type="range" min="0" max="255" class="w-full accent-red-500"
                  [ngModel]="colorFilters().colorRed"
                  (ngModelChange)="patchColorFilter({ colorRed: +$event })" />
              </label>
              <label class="block text-[10px] text-slate-400">
                G {{ colorFilters().colorGreen }}
                <input type="range" min="0" max="255" class="w-full accent-emerald-500"
                  [ngModel]="colorFilters().colorGreen"
                  (ngModelChange)="patchColorFilter({ colorGreen: +$event })" />
              </label>
              <label class="block text-[10px] text-slate-400">
                B {{ colorFilters().colorBlue }}
                <input type="range" min="0" max="255" class="w-full accent-blue-500"
                  [ngModel]="colorFilters().colorBlue"
                  (ngModelChange)="patchColorFilter({ colorBlue: +$event })" />
              </label>
              <label class="block text-[10px] text-slate-400">
                A {{ colorFilters().colorAlpha }}
                <input type="range" min="0" max="255" class="w-full accent-slate-400"
                  [ngModel]="colorFilters().colorAlpha"
                  (ngModelChange)="patchColorFilter({ colorAlpha: +$event })" />
              </label>
            </div>
          }

          <label class="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
            <span>Luz azul</span>
            <input type="checkbox" class="w-4 h-4 accent-orange-500 rounded"
              [ngModel]="colorFilters().blueLight"
              (ngModelChange)="patchColorFilter({ blueLight: $event })" />
          </label>
          @if (colorFilters().blueLight) {
            <label class="block text-[10px] text-slate-400 pl-1 border-l border-slate-700">
              Intensidade {{ blueLightPercentLabel() }}%
              <input type="range" min="0" max="200" class="w-full accent-orange-500"
                [ngModel]="colorFilters().blueLightAlpha"
                (ngModelChange)="patchColorFilter({ blueLightAlpha: +$event })" />
            </label>
          }

          <label class="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
            <span>Escala de cinza</span>
            <input type="checkbox" class="w-4 h-4 accent-violet-600 rounded"
              [ngModel]="colorFilters().grayScale"
              (ngModelChange)="patchColorFilter({ grayScale: $event })" />
          </label>
          <label class="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
            <span>Inverter cores</span>
            <input type="checkbox" class="w-4 h-4 accent-violet-600 rounded"
              [ngModel]="colorFilters().invertColor"
              (ngModelChange)="patchColorFilter({ invertColor: $event })" />
          </label>
          <label class="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
            <span>Sépia</span>
            <input type="checkbox" class="w-4 h-4 accent-violet-600 rounded"
              [ngModel]="colorFilters().sepia"
              (ngModelChange)="patchColorFilter({ sepia: $event })" />
          </label>

          <div class="pt-2 border-t border-slate-700">
            <label class="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
              <span>Lupa circular</span>
              <input type="checkbox" class="w-4 h-4 accent-indigo-600 rounded"
                [ngModel]="useCircleMagnifier()"
                (ngModelChange)="setMagnifierType($event)" />
            </label>
            <p class="text-[10px] text-slate-500 mt-1">Shift + clique e arraste para ampliar</p>
          </div>
        </div>
      }

      @if (magnifierActive() && magnifierStyle(); as mag) {
        <div
          class="reader-magnifier"
          [class.is-circle]="useCircleMagnifier()"
          [class.is-square]="!useCircleMagnifier()"
          [style.left.px]="mag.left"
          [style.top.px]="mag.top"
          [style.width.px]="mag.size"
          [style.height.px]="mag.size"
          [style.background-image]="mag.backgroundImage"
          [style.background-size]="mag.backgroundSize"
          [style.background-position]="mag.backgroundPosition"></div>
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
          type="MANGA"
          [referenceId]="mangaId"
          [title]="title()"
          [sessionId]="sessionId || ''"
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
          type="MANGA"
          [referenceId]="mangaId"
          [title]="title()"
          [items]="assistantItems()"
          [selectedIds]="assistantSelectedForSummary()"
          [maxContextChars]="assistantMaxContext()"
          (close)="showAssistantSummary.set(false)"
          (openInChat)="onAssistantSummaryToChat($event)" />
      }

      @if (showPagesLink()) {
        <app-pages-link-overlay
          [mangaId]="mangaId"
          [mangaTitle]="title()"
          [mangaPath]="mangaPath()"
          [pageCount]="pageCount()"
          [pages]="pages()"
          [pageNames]="pageNames()"
          [pagePaths]="pagePaths()"
          (close)="closePagesLink()"
          (saved)="onFileLinkSaved($event)" />
      }

      @if (subtitlePanelOpen()) {
        <app-manga-subtitle-panel
          [languages]="subtitleCatalog().languages"
          [language]="subtitleLanguage()"
          [texts]="currentSubtitleTexts()"
          [drawBoxes]="subtitleDrawBoxes()"
          [selectedSequence]="selectedSubtitleSeq()"
          (close)="subtitlePanelOpen.set(false)"
          (languageChange)="onSubtitleLanguageChange($event)"
          (drawBoxesChange)="subtitleDrawBoxes.set($event)"
          (selectText)="onSubtitleSelect($event)"
          (importJson)="onImportSubtitleJson()" />
      }

      @if (ocrPanelOpen()) {
        <div class="absolute left-0 top-0 bottom-0 w-80 max-w-[90vw] z-40 flex flex-col
                    bg-slate-950/95 border-r border-slate-800 backdrop-blur-md shadow-2xl">
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div>
              <h3 class="text-sm font-bold text-slate-100">OCR</h3>
              <p class="text-[10px] text-slate-500 mt-0.5">
                {{ ocrBusy() ? 'Reconhecendo…' : (ocrEngineUsed() || 'Resultado') }}
              </p>
            </div>
            <button type="button" (click)="ocrPanelOpen.set(false)"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <label class="mx-4 mt-3 flex items-center justify-between text-xs text-slate-300 cursor-pointer">
            <span>Desenhar caixas OCR</span>
            <input type="checkbox" class="w-4 h-4 accent-emerald-600 rounded"
              [ngModel]="ocrDrawBoxes()" (ngModelChange)="ocrDrawBoxes.set($event)" />
          </label>
          <div class="flex-1 overflow-y-auto p-3 space-y-2">
            @if (ocrBusy()) {
              <p class="text-xs text-slate-500 text-center py-8">Processando OCR…</p>
            } @else if (!ocrBlocks().length && !ocrFullText()) {
              <p class="text-xs text-slate-500 text-center py-8">Nenhum texto reconhecido.</p>
            } @else {
              @if (ocrFullText()) {
                <div class="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                  <p class="text-[10px] font-bold text-emerald-400 mb-1">Original</p>
                  <p class="text-xs text-slate-200 whitespace-pre-wrap break-words">{{ ocrFullText() }}</p>
                </div>
              }

              <div class="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-[10px] font-bold text-sky-400">Tradução</p>
                  <button type="button" (click)="runOcrTranslate('literal')"
                    class="px-2 py-1 rounded-md text-[10px] font-semibold bg-sky-700/40 text-sky-100 hover:bg-sky-600/50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    [disabled]="!canRunOcrLlm() || ocrTranslateBusy() || ocrBusy()">
                    {{ ocrTranslateBusy() ? 'Traduzindo…' : 'Traduzir' }}
                  </button>
                </div>
                @if (ocrTranslateError()) {
                  <p class="text-[10px] text-rose-300">{{ ocrTranslateError() }}</p>
                } @else if (ocrTranslation()) {
                  <p class="text-xs text-slate-200 whitespace-pre-wrap break-words">{{ ocrTranslation() }}</p>
                } @else {
                  <p class="text-[10px] text-slate-500">
                    @if (!llmTranslateReady()) {
                      Ative a IA e defina o idioma-alvo em Configurações.
                    } @else {
                      Aguardando tradução…
                    }
                  </p>
                }
              </div>

              <div class="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-[10px] font-bold text-violet-400">Interpretação</p>
                  <button type="button" (click)="runOcrTranslate('interpret')"
                    class="px-2 py-1 rounded-md text-[10px] font-semibold bg-violet-700/40 text-violet-100 hover:bg-violet-600/50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    [disabled]="!canRunOcrLlm() || ocrInterpretBusy() || ocrBusy()">
                    {{ ocrInterpretBusy() ? 'Interpretando…' : 'Interpretar' }}
                  </button>
                </div>
                @if (ocrInterpretError()) {
                  <p class="text-[10px] text-rose-300">{{ ocrInterpretError() }}</p>
                } @else if (ocrInterpretation()) {
                  <p class="text-xs text-slate-200 whitespace-pre-wrap break-words">{{ ocrInterpretation() }}</p>
                } @else {
                  <p class="text-[10px] text-slate-500">Use o botão para gerar uma leitura interpretativa.</p>
                }
              </div>

              @for (b of ocrBlocks(); track $index) {
                <button type="button"
                  class="w-full text-left rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 cursor-pointer hover:border-indigo-700/50"
                  (click)="openVocabularyFromText(b.text)"
                  title="Buscar vocabulário">
                  <p class="text-[10px] text-slate-600 font-mono mb-1">{{ b.x }},{{ b.y }} {{ b.width }}×{{ b.height }}</p>
                  <p class="text-xs text-slate-200 whitespace-pre-wrap break-words">{{ b.text }}</p>
                </button>
              }
            }
          </div>
        </div>
      }

      @if (ocrCropActive()) {
        <div class="ocr-crop-layer absolute inset-0 z-[55] bg-slate-950/40 cursor-crosshair"
          (pointerdown)="onOcrCropPointerDown($event)"
          (pointermove)="onOcrCropPointerMove($event)"
          (pointerup)="onOcrCropPointerUp($event)"
          (dblclick)="confirmOcrCrop()">
          @if (ocrCropRect()) {
            <div class="absolute border-2 border-emerald-400 bg-emerald-400/10 pointer-events-none"
              [style.left.px]="ocrCropRect()!.x"
              [style.top.px]="ocrCropRect()!.y"
              [style.width.px]="ocrCropRect()!.w"
              [style.height.px]="ocrCropRect()!.h"></div>
          }
          <div class="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-2">
            <button type="button" (click)="cancelOcrCrop(); $event.stopPropagation()"
              class="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 cursor-pointer">
              Cancelar
            </button>
            <button type="button" (click)="confirmOcrCrop(); $event.stopPropagation()"
              class="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white cursor-pointer"
              [disabled]="!ocrCropRect() || ocrBusy()">
              Reconhecer
            </button>
          </div>
          <p class="absolute top-20 left-1/2 -translate-x-1/2 text-xs text-emerald-200 bg-slate-900/80 px-3 py-1.5 rounded-lg">
            Arraste para selecionar a região · duplo clique ou “Reconhecer”
          </p>
        </div>
      }
    </div>
  `
})
export class ReaderImageComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild(MangaSpreadViewportComponent) singleViewportRef?: MangaSpreadViewportComponent;
  @ViewChild(MangaDualSpreadViewportComponent) dualViewportRef?: MangaDualSpreadViewportComponent;

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
  chaptersPages = signal<Record<number, string>>({});
  favorite = signal(false);
  annotations = signal<MangaAnnotation[]>([]);
  readonly marked = computed(() =>
    this.annotations().some(
      a => (a.markType || '') === 'PageMark' && a.page === this.activeReadPage()
    )
  );
  loading = signal(true);
  error = signal<string | null>(null);
  extractCurrent = signal(0);
  extractTotal = signal(0);
  chromeVisible = signal(false);
  isFullscreen = signal(false);
  showChapters = signal(false);
  showAnnotations = signal(false);
  showColorFilters = signal(false);
  colorFilters = signal<MangaColorFilterState>({ ...DEFAULT_MANGA_COLOR_FILTER });
  useCircleMagnifier = signal(false);
  magnifierActive = signal(false);
  magnifierStyle = signal<{
    left: number;
    top: number;
    size: number;
    backgroundImage: string;
    backgroundSize: string;
    backgroundPosition: string;
  } | null>(null);
  readonly pageCssFilter = computed(() => buildPageCssFilter(this.colorFilters()));
  readonly pageTintOverlays = computed(() => buildTintOverlays(this.colorFilters()));
  readonly pageMarkAnnotations = computed(() =>
    this.annotations()
      .filter(a => (a.markType || '') === 'PageMark')
      .slice()
      .sort((a, b) => a.page - b.page)
  );
  brokenPages = signal(0);
  zoom = signal(1);
  panning = signal(false);
  showTouchDemo = signal(false);
  showTouchConfig = signal(false);
  touchMenuOpen = signal(false);
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
  adjacentPrev = signal<Manga | null>(null);
  adjacentNext = signal<Manga | null>(null);
  switchConfirm = signal<{ direction: 'prev' | 'next'; manga: Manga; title: string; fileName: string } | null>(null);
  showPagesLink = signal(false);
  mangaPath = signal('');
  pageNames = signal<string[]>([]);
  pagePaths = signal<string[]>([]);
  pageHashes = signal<string[]>([]);
  pageNaturals = signal<Record<number, { w: number; h: number }>>({});

  subtitleCatalog = signal<SubtitleCatalog>(emptySubtitleCatalog());
  subtitleLanguage = signal('JAPANESE');
  subtitlePanelOpen = signal(false);
  subtitleDrawBoxes = signal(true);
  selectedSubtitleSeq = signal<number | null>(null);
  hasSubtitles = computed(() => this.subtitleCatalog().chapters.length > 0);
  currentSubtitleTexts = computed(() => {
    const chapters = chaptersForLanguage(this.subtitleCatalog(), this.subtitleLanguage());
    const page = this.activeReadPage();
    const found = findSubtitlePage(chapters, {
      pageHash: this.pageHashes()[page],
      pageName: this.pageNames()[page],
      pagePath: this.pagePaths()[page]
    });
    return found?.page.texts ?? [];
  });

  ocrOverlayTexts = computed<NormalizedSubtitleText[]>(() =>
    this.ocrBlocks().map((b, i) => ({
      text: b.text,
      sequence: i + 1,
      x1: b.x,
      y1: b.y,
      x2: b.x + b.width,
      y2: b.y + b.height
    }))
  );

  ocrMenuOpen = signal(false);
  ocrPanelOpen = signal(false);
  ocrBusy = signal(false);
  ocrLang = signal('jpn');
  ocrEnginePref = signal<'auto' | 'tesseract' | 'windows'>('auto');
  ocrEngineUsed = signal('');
  ocrFullText = signal('');
  ocrBlocks = signal<Array<{ text: string; x: number; y: number; width: number; height: number }>>([]);
  ocrDrawBoxes = signal(true);
  ocrCropActive = signal(false);
  ocrCropRect = signal<{ x: number; y: number; w: number; h: number } | null>(null);
  private ocrCropStart: { x: number; y: number } | null = null;
  ocrTranslation = signal('');
  ocrInterpretation = signal('');
  ocrTranslateBusy = signal(false);
  ocrInterpretBusy = signal(false);
  ocrTranslateError = signal('');
  ocrInterpretError = signal('');
  /** Cached llm:status — refreshed after OCR / before translate. */
  llmStatusCache = signal<{ enabled: boolean; hasKey: boolean; targetLang: string }>({
    enabled: false,
    hasKey: false,
    targetLang: 'OFF'
  });

  llmTranslateReady = computed(() => {
    const st = this.llmStatusCache();
    const target = this.settings.subtitleTranslate();
    return (
      this.settings.llmEnabled() &&
      st.hasKey &&
      target !== 'OFF' &&
      !!(this.ocrFullText() || this.ocrBlocks().length)
    );
  });

  canRunOcrLlm = computed(() => this.llmTranslateReady());

  hasFileLink = signal(false);
  /** Pages currently showing the linked (translation) image. */
  linkedVisiblePages = signal<Record<number, boolean>>({});
  /** mangaPage index → linked image URL(s). */
  linkedPageMap = signal<Record<number, string[]>>({});

  scrollingMode = signal<MangaScrollingMode>(this.settings.mangaScrollingMode());
  fitMode = signal<MangaFitMode>(this.settings.mangaFitMode());
  pageTransition = signal<PageTransitionType>(this.settings.mangaPageTransition());
  pageTransitionOptions = PAGE_TRANSITION_OPTIONS;
  pageTransitionLabels = PAGE_TRANSITION_LABELS_PT;
  /** Overlay page-turn animation state (null when idle). */
  turnLayer = signal<{
    outgoing: TurnLayerPage;
    incoming: TurnLayerPage;
    effect: PageTransitionType;
    axis: TurnAxis;
    dir: TurnDir;
    curlFactor: number | null;
    curlCommit: boolean | null;
  } | null>(null);
  /** True while a page-turn FX (incl. interactive curl) is in progress. Bound to single viewport. */
  turning = false;
  private turnResolve: (() => void) | null = null;
  spreadIndex = signal(0);
  /** Active page within the current dual spread (for linked toggle). */
  activeDualPage = signal(0);
  /** Natural-size wide flags per page index. */
  wideFlags = signal<boolean[]>([]);

  readonly spreads = computed<MangaSpread[]>(() =>
    buildSpreads(this.pageCount(), this.wideFlags())
  );

  readonly useDualSpread = computed(() => isMangaDualMode(this.scrollingMode()));

  readonly activeReadPage = computed(() =>
    this.useDualSpread() ? this.activeDualPage() : this.currentPage()
  );

  readonly pageLabel = computed(() => {
    const total = this.pageCount() || 0;
    if (!total) return 'Página —';
    if (!this.useDualSpread()) {
      return `Página ${this.currentPage() + 1} / ${total}`;
    }
    const spread = this.spreads()[this.spreadIndex()];
    if (!spread) return `Página ${this.currentPage() + 1} / ${total}`;
    if (spread.right == null) {
      return `Página ${spread.left + 1} / ${total}`;
    }
    return `Páginas ${spread.left + 1}–${spread.right + 1} / ${total}`;
  });

  sessionId: string | null = null;
  private linkedSessionId: string | null = null;
  private pendingScrollRestore: {
    page: number;
    xRatio: number;
    yRatio: number;
    zoom: number;
  } | null = null;
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
  private magnifierPointerId: number | null = null;
  private readonly onMagnifierMoveBound = (ev: PointerEvent) => this.onMagnifierMove(ev);
  private readonly onMagnifierUpBound = (ev: PointerEvent) => this.onMagnifierUp(ev);

  readonly extractPercent = computed(() => {
    const t = this.extractTotal();
    if (t <= 0) return 0;
    return Math.round((this.extractCurrent() / t) * 100);
  });

  readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));

  readonly isLongStrip = computed(() => isMangaLongStripMode(this.scrollingMode()));

  readonly isRtl = computed(() => isMangaRtlMode(this.scrollingMode()));

  readonly isHorizontal = computed(() => isMangaHorizontalMode(this.scrollingMode()));

  readonly isVerticalMode = computed(() => isMangaVerticalMode(this.scrollingMode()));

  ngOnInit(): void {
    this.unsubProgress = this.electron.onExtractProgress(p => {
      this.extractCurrent.set(p.current);
      this.extractTotal.set(p.total);
    });
    document.addEventListener('fullscreenchange', this.onFsChange);
    void this.openReader();
  }

  ngAfterViewChecked(): void {
    if (this.pendingJump != null && !this.loading() && !this.useDualSpread()) {
      const page = this.pendingJump;
      this.pendingJump = null;
      this.singleViewportRef?.scrollToPage(page, false);
    } else {
      this.singleViewportRef?.flushPendingJump();
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('fullscreenchange', this.onFsChange);
    this.stopMagnifier();
    if (this.clickTimer) clearTimeout(this.clickTimer);
    if (this.stubToastTimer) clearTimeout(this.stubToastTimer);
    this.unsubProgress?.();
    void this.cleanup();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.useDualSpread()) {
      this.syncSpreadFromPage(this.currentPage());
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape' && this.magnifierActive()) {
      ev.preventDefault();
      this.stopMagnifier();
      return;
    }
    if (this.loading() || this.showPagesLink()) return;
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
      if (horizontal) {
        if (this.useDualSpread() && this.zoom() > 1) {
          ev.preventDefault();
          this.scrollActiveViewport(0, -80);
        }
        return;
      }
      ev.preventDefault();
      this.goPrev();
    } else if (key === 'ArrowDown') {
      if (horizontal) {
        if (this.useDualSpread() && this.zoom() > 1) {
          ev.preventDefault();
          this.scrollActiveViewport(0, 80);
        }
        return;
      }
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
    } else if (key === 'l' || key === 'L') {
      if (ev.ctrlKey || ev.metaKey) {
        ev.preventDefault();
        this.openPagesLink();
      } else if (!ev.altKey) {
        ev.preventDefault();
        this.toggleLinkedPage();
      }
    } else if (key === 'Escape') {
      if (this.showAnnotations()) {
        this.showAnnotations.set(false);
        return;
      }
      if (this.showColorFilters()) {
        this.showColorFilters.set(false);
        return;
      }
    }
  }

  onPageImageError(url: string, _event?: Event): void {
    console.warn('[reader-image] page load failed', url);
    this.brokenPages.update(n => n + 1);
  }

  chapterDotPercent(page: number): number {
    const max = Math.max(1, this.pageCount() - 1);
    return (page / max) * 100;
  }

  setScrollingMode(mode: MangaScrollingMode): void {
    const page = this.activeReadPage();
    const wasDual = this.useDualSpread();
    this.scrollingMode.set(mode);
    this.settings.mangaScrollingMode.set(mode);
    this.wheelAccum = 0;
    const nowDual = this.useDualSpread();
    if (nowDual) {
      this.syncSpreadFromPage(page);
    } else if (wasDual) {
      this.currentPage.set(page);
      this.seekBarPage.set(page);
      this.pendingJump = page;
    } else {
      this.pendingJump = page;
    }
  }

  setFitMode(mode: MangaFitMode): void {
    this.fitMode.set(mode);
    this.settings.mangaFitMode.set(mode);
    this.zoom.set(1);
    if (this.useDualSpread()) {
      const el = this.activeViewportEl();
      if (el) {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      }
      return;
    }
    this.singleViewportRef?.resetSlotScroll();
  }

  setPageTransition(effect: PageTransitionType): void {
    this.pageTransition.set(effect);
    this.settings.mangaPageTransition.set(effect);
  }

  /** Effective transition — forced to Default when FX should not run. */
  effectivePageTransition(): PageTransitionType {
    if (prefersReducedMotion()) return PageTransitionType.Default;
    if (this.isLongStrip()) return PageTransitionType.Default;
    if (this.zoom() > 1) return PageTransitionType.Default;
    return this.pageTransition();
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

    const el = this.activeViewportEl();
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const localX = ev.clientX - rect.left;
    const localY = ev.clientY - rect.top;

    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
      this.clickTimer = null;
      // Double click: toggle zoom (image)
      const nextZoom = this.zoom() === 1 ? ZOOM_DOUBLE_TAP : 1;
      this.setZoom(nextZoom);
      if (this.useDualSpread() && nextZoom > 1) {
        // Center scroll on the click point after zoom applies.
        requestAnimationFrame(() => {
          const vp = this.activeViewportEl();
          if (!vp) return;
          const maxX = Math.max(0, vp.scrollWidth - vp.clientWidth);
          const maxY = Math.max(0, vp.scrollHeight - vp.clientHeight);
          const ratioX = rect.width > 0 ? localX / rect.width : 0.5;
          const ratioY = rect.height > 0 ? localY / rect.height : 0.5;
          vp.scrollLeft = maxX * ratioX;
          vp.scrollTop = maxY * ratioY;
        });
      }
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
      previousFile: () => this.requestAdjacentFile('prev'),
      nextFile: () => this.requestAdjacentFile('next'),
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
    if (this.showChapters()) {
      this.showAnnotations.set(false);
      this.showColorFilters.set(false);
    }
  }

  toggleAnnotations(): void {
    this.showAnnotations.update(v => !v);
    if (this.showAnnotations()) {
      this.showChapters.set(false);
      this.showColorFilters.set(false);
      this.chromeVisible.set(true);
    }
  }

  toggleColorFilters(): void {
    this.showColorFilters.update(v => !v);
    if (this.showColorFilters()) {
      this.showChapters.set(false);
      this.showAnnotations.set(false);
      this.chromeVisible.set(true);
    }
  }

  blueLightPercentLabel(): number {
    return blueLightPercent(this.colorFilters().blueLightAlpha);
  }

  async patchColorFilter(patch: Partial<MangaColorFilterState>): Promise<void> {
    const next = { ...this.colorFilters(), ...patch };
    this.colorFilters.set(next);
    await this.persistColorFilters(next);
  }

  async resetColorFilters(): Promise<void> {
    const next = { ...DEFAULT_MANGA_COLOR_FILTER };
    this.colorFilters.set(next);
    await this.persistColorFilters(next);
  }

  async setMagnifierType(circle: boolean): Promise<void> {
    this.useCircleMagnifier.set(!!circle);
    await this.electron.setSetting(MANGA_USE_MAGNIFIER_TYPE_KEY, !!circle);
  }

  async deleteAnnotation(ann: MangaAnnotation): Promise<void> {
    if (!ann.id) return;
    const ok = await this.electron.deleteMangaAnnotation(ann.id);
    if (ok) {
      this.annotations.update(list => list.filter(a => a.id !== ann.id));
      this.showStub(`Página ${ann.page + 1} desmarcada`);
    }
  }

  chapterLabel(page: number, index: number): string {
    const map = this.chaptersPages();
    const title = map[page] ?? (map as Record<string, string>)[String(page)];
    if (typeof title === 'string' && title.trim()) return title.trim();
    return `${index + 1} · p.${page + 1}`;
  }

  private normalizeChaptersPages(
    raw: Record<number, string> | Record<string, string> | undefined | null
  ): Record<number, string> {
    const out: Record<number, string> = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [k, v] of Object.entries(raw)) {
      const page = Number(k);
      if (!Number.isFinite(page) || typeof v !== 'string' || !v.trim()) continue;
      out[page] = v.trim();
    }
    return out;
  }

  private showStub(message: string): void {
    this.stubToast.set(message);
    if (this.stubToastTimer) clearTimeout(this.stubToastTimer);
    this.stubToastTimer = setTimeout(() => this.stubToast.set(null), 2000);
  }

  /** Ask to open previous/next manga in the library (book reader parity). */
  requestAdjacentFile(direction: 'prev' | 'next'): void {
    if (this.switchConfirm()) return;
    const manga = direction === 'prev' ? this.adjacentPrev() : this.adjacentNext();
    if (!manga?.id) {
      this.showStub(direction === 'prev' ? 'Não há arquivo anterior' : 'Não há próximo arquivo');
      return;
    }
    this.switchConfirm.set({
      direction,
      manga,
      title: direction === 'prev' ? 'Abrir arquivo anterior?' : 'Abrir próximo arquivo?',
      fileName: manga.name || manga.title || `Mangá #${manga.id}`
    });
  }

  cancelSwitchFile(): void {
    this.switchConfirm.set(null);
  }

  async confirmSwitchFile(): Promise<void> {
    const conf = this.switchConfirm();
    if (!conf?.manga?.id) {
      this.switchConfirm.set(null);
      return;
    }
    const nextId = conf.manga.id;
    this.switchConfirm.set(null);
    await this.cleanup();
    this.ended = false;
    this.mangaId = nextId;
    await this.router.navigate(['/reader-image', nextId], { replaceUrl: true });
    await this.openReader();
  }

  private async loadAdjacentMangas(): Promise<void> {
    if (!this.mangaId) {
      this.adjacentPrev.set(null);
      this.adjacentNext.set(null);
      return;
    }
    try {
      const adj = await this.electron.getAdjacentMangas(this.mangaId);
      this.adjacentPrev.set(adj.prev);
      this.adjacentNext.set(adj.next);
    } catch (e) {
      console.warn('[reader-image] adjacent mangas failed', e);
      this.adjacentPrev.set(null);
      this.adjacentNext.set(null);
    }
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
    }
    // Non-ctrl wheel is owned by MangaSpreadViewport / MangaDualSpreadViewport.
  }

  onDragFlag(flag: boolean): void {
    this.didDrag = flag;
  }

  onSinglePageChange(ev: { page: number; land: PageLand }): void {
    const max = Math.max(0, this.pageCount() - 1);
    const page = Math.min(Math.max(0, ev.page), max);
    if (page === this.currentPage()) {
      this.singleViewportRef?.scrollToPage(page, true, ev.land);
      return;
    }
    if (page > max) {
      this.requestAdjacentFile('next');
      return;
    }
    this.seekTo(page, ev.land);
  }

  onSinglePageSync(page: number): void {
    this.seekBarPage.set(page);
    if (page !== this.currentPage()) {
      this.currentPage.set(page);
      this.scheduleProgressUpdate();
    }
  }

  onSingleImageSized(ev: { page: number; width: number; height: number }): void {
    this.pageNaturals.update(m => ({
      ...m,
      [ev.page]: { w: ev.width, h: ev.height }
    }));
    if (this.isShowingLinked(ev.page)) {
      this.onLinkedImageLoad(ev.page);
    }
  }

  /** Navigate previous with column scroll first (zones + keyboard + buttons). */
  goPrev(): void {
    if (this.useDualSpread()) {
      const next = prevSpreadIndex(this.spreads(), this.spreadIndex());
      if (next !== this.spreadIndex()) this.onDualSpreadChange(next);
      return;
    }
    if (this.singleViewportRef?.tryScrollCurrentPage(-1)) return;
    this.seekTo(this.currentPage() - 1, 'end');
  }

  /** Navigate next with column scroll first (zones + keyboard + buttons). */
  goNext(): void {
    if (this.useDualSpread()) {
      const next = nextSpreadIndex(this.spreads(), this.spreadIndex());
      if (next !== this.spreadIndex()) {
        this.onDualSpreadChange(next);
        return;
      }
      this.requestAdjacentFile('next');
      return;
    }
    if (this.singleViewportRef?.tryScrollCurrentPage(1)) return;
    if (this.currentPage() >= Math.max(0, this.pageCount() - 1)) {
      this.requestAdjacentFile('next');
      return;
    }
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
    if (this.useDualSpread()) {
      this.syncSpreadFromPage(next);
      return;
    }
    this.pendingPageLand = land;
    const from = this.currentPage();
    if (Math.abs(next - from) === 1) {
      void this.turnToPage(next, land);
      return;
    }
    this.singleViewportRef?.scrollToPage(next, true, land);
  }

  onDualSpreadChange(index: number): void {
    void this.turnToSpread(index);
  }

  onTurnFinished(): void {
    this.turnLayer.set(null);
    this.turning = false;
    this.turnResolve?.();
    this.turnResolve = null;
  }

  private applySpreadChange(index: number): void {
    const spreads = this.spreads();
    if (!spreads.length) return;
    const clamped = Math.min(Math.max(0, index), spreads.length - 1);
    const spread = spreads[clamped];
    this.spreadIndex.set(clamped);
    const page = primaryPageOfSpread(spread);
    this.currentPage.set(page);
    this.seekBarPage.set(page);
    this.activeDualPage.set(page);
    this.scheduleProgressUpdate();
  }

  private urlsForPage(page: number): string[] {
    if (this.isShowingLinked(page)) {
      const linked = this.linkedUrlsFor(page);
      if (linked.length) return linked;
    }
    const url = this.pages()[page];
    return url ? [url] : [];
  }

  private urlsForSpread(spread: MangaSpread): string[] {
    const ordered = visualOrder(spread.left, spread.right, this.isRtl());
    return ordered.flatMap(p => this.urlsForPage(p));
  }

  private turnAxis(): TurnAxis {
    return this.isVerticalMode() ? 'y' : 'x';
  }

  private async turnToPage(page: number, land: PageLand): Promise<void> {
    const effect = this.effectivePageTransition();
    if (effect === PageTransitionType.Default || this.turning) {
      this.singleViewportRef?.scrollToPage(page, effect === PageTransitionType.Default, land);
      return;
    }
    const from = this.currentPage();
    const dir: TurnDir = page > from ? 1 : -1;
    const animDir: TurnDir =
      this.isRtl() && this.isHorizontal() ? ((-dir) as TurnDir) : dir;

    this.turning = true;
    this.turnLayer.set({
      outgoing: { urls: this.urlsForPage(from) },
      incoming: { urls: this.urlsForPage(page) },
      effect,
      axis: this.turnAxis(),
      dir: animDir,
      curlFactor: null,
      curlCommit: null
    });
    this.singleViewportRef?.scrollToPage(page, false, land);
    await new Promise<void>(resolve => {
      this.turnResolve = resolve;
    });
  }

  private async turnToSpread(index: number): Promise<void> {
    const spreads = this.spreads();
    if (!spreads.length) return;
    const from = this.spreadIndex();
    const clamped = Math.min(Math.max(0, index), spreads.length - 1);
    const effect = this.effectivePageTransition();
    const adjacent = Math.abs(clamped - from) === 1;

    if (!adjacent || effect === PageTransitionType.Default || this.turning) {
      this.applySpreadChange(clamped);
      return;
    }

    const dir: TurnDir = clamped > from ? 1 : -1;
    const animDir: TurnDir = this.isRtl() ? ((-dir) as TurnDir) : dir;
    const outSpread = spreads[from];
    const inSpread = spreads[clamped];

    this.turning = true;
    this.turnLayer.set({
      outgoing: { urls: this.urlsForSpread(outSpread) },
      incoming: { urls: this.urlsForSpread(inSpread) },
      effect,
      axis: this.turnAxis(),
      dir: animDir,
      curlFactor: null,
      curlCommit: null
    });
    this.applySpreadChange(clamped);
    await new Promise<void>(resolve => {
      this.turnResolve = resolve;
    });
  }

  onDualCurlDrag(
    ev: { factor: number; goingNext: boolean; commit: boolean | null } | null
  ): void {
    if (!ev) {
      this.turnLayer.set(null);
      return;
    }
    const effect = this.effectivePageTransition();
    if (
      effect !== PageTransitionType.CurlPage &&
      effect !== PageTransitionType.Curl3DPage
    ) {
      return;
    }
    const spreads = this.spreads();
    const from = this.spreadIndex();
    const delta = ev.goingNext ? 1 : -1;
    const to = from + delta;
    if (to < 0 || to >= spreads.length) return;
    const animDir: TurnDir = this.isRtl()
      ? ((ev.goingNext ? -1 : 1) as TurnDir)
      : ((ev.goingNext ? 1 : -1) as TurnDir);

    const existing = this.turnLayer();
    if (!existing || existing.curlFactor == null) {
      this.turning = true;
      this.turnLayer.set({
        outgoing: { urls: this.urlsForSpread(spreads[from]) },
        incoming: { urls: this.urlsForSpread(spreads[to]) },
        effect,
        axis: 'x',
        dir: animDir,
        curlFactor: ev.factor,
        curlCommit: ev.commit
      });
    } else {
      this.turnLayer.update(t =>
        t
          ? { ...t, curlFactor: ev.factor, curlCommit: ev.commit, dir: animDir }
          : t
      );
    }
  }

  onSingleCurlDrag(
    ev: { factor: number; goingNext: boolean; commit: boolean | null } | null
  ): void {
    if (!ev) {
      this.turnLayer.set(null);
      return;
    }
    const effect = this.effectivePageTransition();
    if (
      effect !== PageTransitionType.CurlPage &&
      effect !== PageTransitionType.Curl3DPage
    ) {
      return;
    }
    const from = this.currentPage();
    const to = ev.goingNext ? from + 1 : from - 1;
    const max = Math.max(0, this.pageCount() - 1);
    if (to < 0 || to > max) return;
    const animDir: TurnDir = this.isRtl()
      ? ((ev.goingNext ? -1 : 1) as TurnDir)
      : ((ev.goingNext ? 1 : -1) as TurnDir);

    const existing = this.turnLayer();
    if (!existing || existing.curlFactor == null) {
      this.turning = true;
      this.turnLayer.set({
        outgoing: { urls: this.urlsForPage(from) },
        incoming: { urls: this.urlsForPage(to) },
        effect,
        axis: this.turnAxis(),
        dir: animDir,
        curlFactor: ev.factor,
        curlCommit: ev.commit
      });
    } else {
      this.turnLayer.update(t =>
        t
          ? { ...t, curlFactor: ev.factor, curlCommit: ev.commit, dir: animDir }
          : t
      );
    }
    // On commit, pageChange → seekTo → turnToPage sees turning=true and only scrolls.
  }

  onDualImageSized(ev: { page: number; width: number; height: number }): void {
    const wide = isWideSpreadPage(ev.width, ev.height);
    const flags = [...this.wideFlags()];
    while (flags.length < this.pageCount()) flags.push(false);
    if (flags[ev.page] === wide) return;
    flags[ev.page] = wide;
    const page = this.currentPage();
    this.wideFlags.set(flags);
    this.syncSpreadFromPage(page);
  }

  private syncSpreadFromPage(page: number): void {
    const spreads = this.spreads();
    if (!spreads.length) {
      this.spreadIndex.set(0);
      this.activeDualPage.set(page);
      return;
    }
    const idx = spreadIndexForPage(spreads, page);
    this.spreadIndex.set(idx);
    const spread = spreads[idx];
    const primary = primaryPageOfSpread(spread);
    this.currentPage.set(primary);
    this.seekBarPage.set(page);
    // Keep active page if it still belongs to this spread; else primary
    const active = this.activeDualPage();
    const inSpread =
      active === spread.left || (spread.right != null && active === spread.right);
    this.activeDualPage.set(inSpread ? active : primary);
  }

  async markPage(): Promise<void> {
    if (!this.mangaId) return;
    const page = this.activeReadPage();
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

  openPagesLink(): void {
    this.showChapters.set(false);
    this.showAnnotations.set(false);
    this.showColorFilters.set(false);
    this.touchMenuOpen.set(false);
    this.chromeVisible.set(true);
    this.showPagesLink.set(true);
  }

  closePagesLink(): void {
    this.showPagesLink.set(false);
  }

  async onFileLinkSaved(file: LinkedFile | null): Promise<void> {
    if (!file?.path) {
      this.hasFileLink.set(false);
      this.linkedPageMap.set({});
      this.linkedVisiblePages.set({});
      await this.closeLinkedSession();
      return;
    }
    await this.loadFileLinkRuntime(file);
  }

  hasLinkedPage(page: number): boolean {
    const urls = this.linkedPageMap()[page];
    return !!(urls && urls.length > 0);
  }

  isShowingLinked(page: number): boolean {
    return !!this.linkedVisiblePages()[page];
  }

  linkedUrlsFor(page: number): string[] {
    return this.linkedPageMap()[page] || [];
  }

  displayUrl(page: number): string {
    if (this.isShowingLinked(page)) {
      const urls = this.linkedUrlsFor(page);
      if (urls.length) return urls[0];
    }
    return this.pages()[page] || '';
  }

  toggleLinkedPage(): void {
    const page = this.activeReadPage();
    if (!this.hasLinkedPage(page)) {
      this.showStub('Nenhuma página vinculada');
      return;
    }
    this.captureScrollPercent(page);
    const next = !this.isShowingLinked(page);
    this.linkedVisiblePages.update(map => ({ ...map, [page]: next }));
    this.showStub(next ? 'Tradução' : 'Original');
  }

  onLinkedImageLoad(page: number): void {
    if (this.pendingScrollRestore?.page === page) {
      this.restoreScrollPercent(this.pendingScrollRestore);
      this.pendingScrollRestore = null;
    }
  }

  onPageImgLoad(page: number, event?: Event): void {
    const img = event?.target as HTMLImageElement | undefined;
    if (img?.naturalWidth && img?.naturalHeight) {
      this.pageNaturals.update(m => ({
        ...m,
        [page]: { w: img.naturalWidth, h: img.naturalHeight }
      }));
    }
    if (this.isShowingLinked(page)) {
      this.onLinkedImageLoad(page);
    }
  }

  pageNaturalSize(page: number): { w: number; h: number } {
    return this.pageNaturals()[page] || { w: 1, h: 1 };
  }

  toggleSubtitlePanel(): void {
    this.subtitlePanelOpen.update(v => !v);
    if (this.subtitlePanelOpen()) {
      this.ocrMenuOpen.set(false);
    }
  }

  onSubtitleLanguageChange(lang: string): void {
    this.subtitleLanguage.set(lang);
    this.settings.subtitleLanguage.set(lang);
    this.selectedSubtitleSeq.set(null);
  }

  onSubtitleSelect(text: NormalizedSubtitleText): void {
    this.selectedSubtitleSeq.set(text.sequence);
    void this.openVocabularyFromText(text.text || '');
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
    this.assistantItems.set(this.buildMangaAssistantItems());
    this.assistantPreload.set(null);
    this.showAssistant.set(true);
    this.chromeVisible.set(true);
  }

  private buildMangaAssistantItems(): AssistantContextItem[] {
    const count = this.pageCount();
    const chapters = chaptersForLanguage(this.subtitleCatalog(), this.subtitleLanguage());
    const items: AssistantContextItem[] = [];
    for (let i = 0; i < count; i++) {
      const found = findSubtitlePage(chapters, {
        pageHash: this.pageHashes()[i],
        pageName: this.pageNames()[i]
      });
      const text = (found?.page?.texts || []).map(t => t.text).filter(Boolean).join('\n');
      items.push({
        id: `p:${i}`,
        label: `Página ${i + 1}`,
        text: text || `(Página ${i + 1} — sem legenda; use visão/OCR se disponível)`,
        pageIndex: i
      });
    }
    return items;
  }

  onAssistantSummaryToChat(summary: string): void {
    this.showAssistantSummary.set(false);
    this.assistantPreload.set(summary);
    this.showAssistant.set(true);
  }

  /** Called when panel emits openSummary — snapshot selection around current page. */
  prepareAssistantSummary(): void {
    const cur = this.currentPage();
    const ids: string[] = [];
    for (let i = Math.max(0, cur - 2); i <= Math.min(this.pageCount() - 1, cur + 2); i++) {
      ids.push(`p:${i}`);
    }
    this.assistantSelectedForSummary.set(ids);
    this.showAssistantSummary.set(true);
  }

  async openVocabularyFromText(raw: string): Promise<void> {
    const q = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!q) {
      this.showStub('Nada selecionado');
      return;
    }
    try {
      const hit = await this.electron.lookupVocabulary({
        text: q,
        mangaId: this.mangaId || null
      });
      if (!hit) {
        this.showStub('Nenhum vocabulário encontrado');
        return;
      }
      this.vocabKanji.set(null);
      this.vocabDetail.set(hit);
    } catch (e) {
      console.warn('[reader-image] vocabulary lookup failed', e);
      this.showStub('Falha ao buscar vocabulário');
    }
  }

  async onImportSubtitleJson(): Promise<void> {
    if (!this.sessionId) return;
    const catalog = await this.electron.importSubtitleJson(this.sessionId);
    if (!catalog) return;
    this.subtitleCatalog.set(catalog);
    if (catalog.languages.length) {
      this.subtitleLanguage.set(catalog.languages[0]);
    }
    this.selectedSubtitleSeq.set(null);
  }

  toggleOcrMenu(): void {
    this.ocrMenuOpen.update(v => !v);
  }

  persistOcrLang(lang: string): void {
    this.settings.ocrLanguage.set(lang);
  }

  startOcrRegion(): void {
    this.ocrMenuOpen.set(false);
    this.ocrCropActive.set(true);
    this.ocrCropRect.set(null);
    this.ocrCropStart = null;
  }

  cancelOcrCrop(): void {
    this.ocrCropActive.set(false);
    this.ocrCropRect.set(null);
    this.ocrCropStart = null;
  }

  onOcrCropPointerDown(ev: PointerEvent): void {
    const host = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    this.ocrCropStart = { x: ev.clientX - host.left, y: ev.clientY - host.top };
    this.ocrCropRect.set({ x: this.ocrCropStart.x, y: this.ocrCropStart.y, w: 0, h: 0 });
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
  }

  onOcrCropPointerMove(ev: PointerEvent): void {
    if (!this.ocrCropStart) return;
    const host = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ev.clientX - host.left;
    const y = ev.clientY - host.top;
    const left = Math.min(this.ocrCropStart.x, x);
    const top = Math.min(this.ocrCropStart.y, y);
    this.ocrCropRect.set({
      x: left,
      y: top,
      w: Math.abs(x - this.ocrCropStart.x),
      h: Math.abs(y - this.ocrCropStart.y)
    });
  }

  onOcrCropPointerUp(_ev: PointerEvent): void {
    this.ocrCropStart = null;
  }

  async confirmOcrCrop(): Promise<void> {
    const rect = this.ocrCropRect();
    if (!rect || rect.w < 4 || rect.h < 4 || !this.sessionId) return;
    const page = this.activeReadPage();
    const dataUrl = await this.capturePageRegionDataUrl(page, rect);
    if (!dataUrl) {
      // Fallback: full-page OCR if crop capture failed (e.g. dual mode)
      this.ocrCropActive.set(false);
      await this.runOcrRecognize({
        pageIndex: page,
        mode: 'page',
        engine: 'tesseract'
      });
      return;
    }
    this.ocrCropActive.set(false);
    await this.runOcrRecognize({ dataUrl, mode: 'region', engine: 'tesseract' });
  }

  async runOcrFullPage(): Promise<void> {
    this.ocrMenuOpen.set(false);
    if (!this.sessionId) return;
    await this.runOcrRecognize({
      pageIndex: this.activeReadPage(),
      mode: 'page',
      engine: this.ocrEnginePref()
    });
  }

  private async runOcrRecognize(input: {
    dataUrl?: string;
    pageIndex?: number;
    mode: 'region' | 'page';
    engine: 'auto' | 'tesseract' | 'windows';
  }): Promise<void> {
    this.ocrBusy.set(true);
    this.ocrPanelOpen.set(true);
    this.ocrFullText.set('');
    this.ocrBlocks.set([]);
    this.ocrTranslation.set('');
    this.ocrInterpretation.set('');
    this.ocrTranslateError.set('');
    this.ocrInterpretError.set('');
    try {
      const result = await this.electron.ocrRecognize({
        sessionId: this.sessionId!,
        pageIndex: input.pageIndex ?? this.activeReadPage(),
        dataUrl: input.dataUrl,
        lang: this.ocrLang(),
        mode: input.mode,
        engine: input.engine
      });
      if (!result) {
        this.ocrFullText.set('OCR indisponível');
        return;
      }
      this.ocrFullText.set(result.fullText || '');
      this.ocrBlocks.set(result.blocks || []);
      this.ocrEngineUsed.set(result.engine || '');
      await this.refreshLlmStatus();
      const hasText = !!(result.fullText || (result.blocks && result.blocks.length));
      if (hasText && this.settings.llmEnabled() && this.settings.subtitleTranslate() !== 'OFF') {
        if (this.settings.ocrAutoTranslate()) {
          await this.runOcrTranslate('literal');
        }
        if (this.settings.ocrAutoInterpret()) {
          await this.runOcrTranslate('interpret');
        }
      }
    } catch (e: any) {
      this.ocrFullText.set(e?.message || 'Falha no OCR');
    } finally {
      this.ocrBusy.set(false);
    }
  }

  async refreshLlmStatus(): Promise<void> {
    try {
      const st = await this.electron.llmStatus();
      this.llmStatusCache.set(st);
    } catch {
      this.llmStatusCache.set({ enabled: false, hasKey: false, targetLang: 'OFF' });
    }
  }

  async runOcrTranslate(mode: 'literal' | 'interpret'): Promise<void> {
    const text = this.ocrFullText();
    const blocks = this.ocrBlocks().map(b => b.text);
    if (!text && !blocks.length) return;

    await this.refreshLlmStatus();
    if (!this.settings.llmEnabled()) {
      const msg = 'Ative os recursos de IA nas configurações.';
      if (mode === 'literal') this.ocrTranslateError.set(msg);
      else this.ocrInterpretError.set(msg);
      return;
    }
    if (this.settings.subtitleTranslate() === 'OFF') {
      const msg = 'Idioma-alvo de tradução está desativado.';
      if (mode === 'literal') this.ocrTranslateError.set(msg);
      else this.ocrInterpretError.set(msg);
      return;
    }
    if (!this.llmStatusCache().hasKey) {
      const msg = 'Configure a chave OpenRouter (app ou .env).';
      if (mode === 'literal') this.ocrTranslateError.set(msg);
      else this.ocrInterpretError.set(msg);
      return;
    }

    if (mode === 'literal') {
      this.ocrTranslateBusy.set(true);
      this.ocrTranslateError.set('');
    } else {
      this.ocrInterpretBusy.set(true);
      this.ocrInterpretError.set('');
    }

    try {
      const result = await this.electron.llmTranslate({
        text,
        blocks,
        mode,
        sourceLang: this.ocrLang(),
        targetLang: this.settings.subtitleTranslate(),
        model:
          mode === 'literal'
            ? this.settings.llmMangaTranslateModel()
            : this.settings.llmMangaInterpretModel(),
        temperature: this.settings.llmTemperature()
      });
      if (!result || result.ok === false) {
        const err = (result && 'error' in result && result.error) || 'Falha na tradução';
        if (mode === 'literal') this.ocrTranslateError.set(err);
        else this.ocrInterpretError.set(err);
        return;
      }
      if (mode === 'literal') this.ocrTranslation.set(result.text);
      else this.ocrInterpretation.set(result.text);
    } catch (e: any) {
      const msg = e?.message || 'Falha na tradução';
      if (mode === 'literal') this.ocrTranslateError.set(msg);
      else this.ocrInterpretError.set(msg);
    } finally {
      if (mode === 'literal') this.ocrTranslateBusy.set(false);
      else this.ocrInterpretBusy.set(false);
    }
  }

  /** Capture crop from the on-screen page image into a PNG data URL. */
  private async capturePageRegionDataUrl(
    page: number,
    screenRect: { x: number; y: number; w: number; h: number }
  ): Promise<string | null> {
    const img = document.querySelector(
      `img[data-page="${page}"]`
    ) as HTMLImageElement | null;
    if (!img?.naturalWidth) {
      return null;
    }
    const imgRect = img.getBoundingClientRect();
    const host = document.querySelector('.ocr-crop-layer') as HTMLElement | null;
    const hostRect = host?.getBoundingClientRect() || imgRect;
    const absLeft = hostRect.left + screenRect.x;
    const absTop = hostRect.top + screenRect.y;
    const relX = absLeft - imgRect.left;
    const relY = absTop - imgRect.top;
    const scaleX = img.naturalWidth / Math.max(1, imgRect.width);
    const scaleY = img.naturalHeight / Math.max(1, imgRect.height);
    const sx = Math.max(0, Math.floor(relX * scaleX));
    const sy = Math.max(0, Math.floor(relY * scaleY));
    const sw = Math.max(1, Math.floor(screenRect.w * scaleX));
    const sh = Math.max(1, Math.floor(screenRect.h * scaleY));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas.toDataURL('image/png');
  }

  private captureScrollPercent(page: number): void {
    const slot = this.singleViewportRef?.currentPageSlot();
    const viewport = this.singleViewportRef?.viewportEl;
    const el = slot || viewport;
    if (!el) {
      this.pendingScrollRestore = { page, xRatio: 0, yRatio: 0, zoom: this.zoom() };
      return;
    }
    const maxX = Math.max(1, el.scrollWidth - el.clientWidth);
    const maxY = Math.max(1, el.scrollHeight - el.clientHeight);
    this.pendingScrollRestore = {
      page,
      xRatio: el.scrollLeft / maxX,
      yRatio: el.scrollTop / maxY,
      zoom: this.zoom()
    };
  }

  private restoreScrollPercent(state: {
    page: number;
    xRatio: number;
    yRatio: number;
    zoom: number;
  }): void {
    requestAnimationFrame(() => {
      this.zoom.set(state.zoom);
      const slot = this.singleViewportRef?.pageSlotAt(state.page);
      const viewport = this.singleViewportRef?.viewportEl;
      const el = slot || viewport;
      if (!el) return;
      const maxX = Math.max(0, el.scrollWidth - el.clientWidth);
      const maxY = Math.max(0, el.scrollHeight - el.clientHeight);
      el.scrollLeft = state.xRatio * maxX;
      el.scrollTop = state.yRatio * maxY;
    });
  }

  private async loadFileLinkRuntime(file?: LinkedFile | null): Promise<void> {
    try {
      const linked = file ?? (await this.electron.getFileLink(this.mangaId));
      if (!linked?.path || !linked.pagesLink?.length) {
        this.hasFileLink.set(false);
        this.linkedPageMap.set({});
        return;
      }

      await this.closeLinkedSession();
      const opened = await this.electron.openFileLink(linked.path, this.mangaId);
      if (!opened) {
        this.hasFileLink.set(false);
        return;
      }
      this.linkedSessionId = opened.sessionId;
      this.hasFileLink.set(true);

      const map: Record<number, string[]> = {};
      for (const row of linked.pagesLink) {
        if (row.fileLinkLeftPage == null || row.fileLinkLeftPage <= PAGE_EMPTY) continue;
        const urls: string[] = [];
        if (opened.pages[row.fileLinkLeftPage]) {
          urls.push(opened.pages[row.fileLinkLeftPage]);
        }
        if (
          row.isDualImage &&
          row.fileLinkRightPage != null &&
          row.fileLinkRightPage > PAGE_EMPTY &&
          opened.pages[row.fileLinkRightPage]
        ) {
          urls.push(opened.pages[row.fileLinkRightPage]);
        }
        if (urls.length) map[row.mangaPage] = urls;
      }
      this.linkedPageMap.set(map);
    } catch (e) {
      console.warn('[reader-image] load file link failed', e);
      this.hasFileLink.set(false);
      this.linkedPageMap.set({});
    }
  }

  private async closeLinkedSession(): Promise<void> {
    if (this.linkedSessionId) {
      try {
        await this.electron.closeFileLink(this.linkedSessionId);
      } catch {}
      this.linkedSessionId = null;
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

  /** Single or dual viewport element for click/zoom geometry. */
  private activeViewportEl(): HTMLElement | null {
    return this.singleViewportRef?.viewportEl
      ?? this.dualViewportRef?.viewportEl
      ?? null;
  }

  private scrollActiveViewport(dx: number, dy: number): void {
    const el = this.activeViewportEl();
    if (!el) return;
    el.scrollLeft += dx;
    el.scrollTop += dy;
  }

  private onFsChange = (): void => {
    this.isFullscreen.set(!!document.fullscreenElement);
  };

  private async loadReaderDisplayPrefs(): Promise<void> {
    const k = MANGA_COLOR_FILTER_KEYS;
    const d = DEFAULT_MANGA_COLOR_FILTER;
    const [
      customFilter,
      colorRed,
      colorGreen,
      colorBlue,
      colorAlpha,
      blueLight,
      blueLightAlpha,
      grayScale,
      invertColor,
      sepia,
      circleMag
    ] = await Promise.all([
      this.electron.getSetting(k.CUSTOM_FILTER, d.customFilter),
      this.electron.getSetting(k.COLOR_RED, d.colorRed),
      this.electron.getSetting(k.COLOR_GREEN, d.colorGreen),
      this.electron.getSetting(k.COLOR_BLUE, d.colorBlue),
      this.electron.getSetting(k.COLOR_ALPHA, d.colorAlpha),
      this.electron.getSetting(k.BLUE_LIGHT, d.blueLight),
      this.electron.getSetting(k.BLUE_LIGHT_ALPHA, d.blueLightAlpha),
      this.electron.getSetting(k.GRAY_SCALE, d.grayScale),
      this.electron.getSetting(k.INVERT_COLOR, d.invertColor),
      this.electron.getSetting(k.SEPIA, d.sepia),
      this.electron.getSetting(MANGA_USE_MAGNIFIER_TYPE_KEY, false)
    ]);
    this.colorFilters.set({
      customFilter: !!customFilter,
      colorRed: Number(colorRed) || 0,
      colorGreen: Number(colorGreen) || 0,
      colorBlue: Number(colorBlue) || 0,
      colorAlpha: Number(colorAlpha) || 0,
      blueLight: !!blueLight,
      blueLightAlpha: Number(blueLightAlpha) || 0,
      grayScale: !!grayScale,
      invertColor: !!invertColor,
      sepia: !!sepia
    });
    this.useCircleMagnifier.set(!!circleMag);
  }

  private async persistColorFilters(state: MangaColorFilterState): Promise<void> {
    const k = MANGA_COLOR_FILTER_KEYS;
    await Promise.all([
      this.electron.setSetting(k.CUSTOM_FILTER, state.customFilter),
      this.electron.setSetting(k.COLOR_RED, state.colorRed),
      this.electron.setSetting(k.COLOR_GREEN, state.colorGreen),
      this.electron.setSetting(k.COLOR_BLUE, state.colorBlue),
      this.electron.setSetting(k.COLOR_ALPHA, state.colorAlpha),
      this.electron.setSetting(k.BLUE_LIGHT, state.blueLight),
      this.electron.setSetting(k.BLUE_LIGHT_ALPHA, state.blueLightAlpha),
      this.electron.setSetting(k.GRAY_SCALE, state.grayScale),
      this.electron.setSetting(k.INVERT_COLOR, state.invertColor),
      this.electron.setSetting(k.SEPIA, state.sepia)
    ]);
  }

  onMagnifierStart(ev: PointerEvent): void {
    if (this.loading() || ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.didDrag = true;
    this.magnifierPointerId = ev.pointerId;
    this.magnifierActive.set(true);
    this.updateMagnifierFromEvent(ev);
    window.addEventListener('pointermove', this.onMagnifierMoveBound);
    window.addEventListener('pointerup', this.onMagnifierUpBound);
    window.addEventListener('pointercancel', this.onMagnifierUpBound);
  }

  private onMagnifierMove(ev: PointerEvent): void {
    if (!this.magnifierActive()) return;
    if (this.magnifierPointerId != null && ev.pointerId !== this.magnifierPointerId) return;
    this.updateMagnifierFromEvent(ev);
  }

  private onMagnifierUp(ev: PointerEvent): void {
    if (this.magnifierPointerId != null && ev.pointerId !== this.magnifierPointerId) return;
    this.stopMagnifier();
  }

  private stopMagnifier(): void {
    window.removeEventListener('pointermove', this.onMagnifierMoveBound);
    window.removeEventListener('pointerup', this.onMagnifierUpBound);
    window.removeEventListener('pointercancel', this.onMagnifierUpBound);
    this.magnifierPointerId = null;
    this.magnifierActive.set(false);
    this.magnifierStyle.set(null);
  }

  private updateMagnifierFromEvent(ev: PointerEvent): void {
    const img = this.findPageImageAt(ev.clientX, ev.clientY);
    if (!img || !img.naturalWidth) {
      this.magnifierStyle.set(null);
      return;
    }

    const rect = img.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      this.magnifierStyle.set(null);
      return;
    }

    const circle = this.useCircleMagnifier();
    const size = circle ? MAGNIFIER_CIRCLE_PX : MAGNIFIER_SQUARE_PX;
    const host = (ev.target as HTMLElement)?.closest?.('.h-screen') as HTMLElement | null
      ?? document.querySelector('app-reader-image') as HTMLElement | null;
    const hostRect = host?.getBoundingClientRect() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

    let left: number;
    let top: number;
    if (circle) {
      left = ev.clientX - hostRect.left - size / 2;
      top = ev.clientY - hostRect.top - size / 2;
    } else {
      const onLeft = (ev.clientX - hostRect.left) < hostRect.width / 2;
      const onTop = (ev.clientY - hostRect.top) < hostRect.height / 2;
      left = onLeft ? hostRect.width - size - 16 : 16;
      top = onTop ? hostRect.height - size - 96 : 16;
    }

    const relX = (ev.clientX - rect.left) / rect.width;
    const relY = (ev.clientY - rect.top) / rect.height;
    const bgW = rect.width * MAGNIFIER_SCALE;
    const bgH = rect.height * MAGNIFIER_SCALE;
    const posX = size / 2 - relX * bgW;
    const posY = size / 2 - relY * bgH;

    this.magnifierStyle.set({
      left,
      top,
      size,
      backgroundImage: `url("${img.currentSrc || img.src}")`,
      backgroundSize: `${bgW}px ${bgH}px`,
      backgroundPosition: `${posX}px ${posY}px`
    });
  }

  private findPageImageAt(clientX: number, clientY: number): HTMLImageElement | null {
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const el of stack) {
      if (el instanceof HTMLImageElement && el.classList.contains('reader-zoom-img')) {
        return el;
      }
    }
    return null;
  }

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
        this.mangaPath.set(manga.path || '');
      }

      const opened = await this.electron.openMangaReader(this.mangaId);
      if (!opened) {
        throw new Error('Falha ao abrir o leitor (Electron indisponível)');
      }

      this.sessionId = opened.sessionId;
      this.title.set(opened.title);
      this.pages.set(opened.pages);
      this.pageCount.set(opened.pageCount);
      this.pageNames.set((opened as any).pageNames || opened.pages.map((_: string, i: number) => String(i)));
      this.pagePaths.set((opened as any).pagePaths || opened.pages.map(() => ''));
      this.pageHashes.set((opened as any).pageHashes || []);
      const catalog = (opened as any).subtitles || emptySubtitleCatalog();
      this.subtitleCatalog.set(catalog);
      const preferredLang =
        this.settings.subtitleLanguage() ||
        catalog.languages[0] ||
        'JAPANESE';
      this.subtitleLanguage.set(
        catalog.languages.includes(preferredLang) ? preferredLang : (catalog.languages[0] || preferredLang)
      );
      this.ocrLang.set(this.settings.ocrLanguage() || 'jpn');
      this.chapters.set(opened.chapters || []);
      this.chaptersPages.set(this.normalizeChaptersPages(opened.chaptersPages));
      this.favorite.set(opened.favorite);
      const startIndex = toReaderIndex(opened.bookMark, opened.pageCount);
      this.currentPage.set(startIndex);
      this.seekBarPage.set(startIndex);
      this.pendingJump = startIndex;
      this.brokenPages.set(0);
      this.zoom.set(1);
      await this.loadReaderDisplayPrefs();
      this.linkedVisiblePages.set({});
      this.wideFlags.set(new Array(opened.pageCount).fill(false));
      this.activeDualPage.set(startIndex);
      this.syncSpreadFromPage(startIndex);

      try {
        this.annotations.set(await this.electron.listMangaAnnotations(this.mangaId));
      } catch (e) {
        console.warn('[reader-image] list annotations failed', e);
        this.annotations.set([]);
      }

      void this.loadFileLinkRuntime();

      this.historySessionId = await this.electron.startHistorySession({
        fkLibrary: manga?.fkLibrary ?? 0,
        fkReference: this.mangaId,
        type: 'MANGA',
        pageStart: fromReaderIndex(startIndex, opened.pageCount),
        pages: opened.pageCount,
        volume: manga?.volume || ''
      });

      setTimeout(() => this.chromeVisible.set(false), 400);
      this.maybeShowFirstTouchDemo();
      void this.loadAdjacentMangas();
    } catch (e: any) {
      console.error(e);
      this.error.set(e?.message || 'Erro ao abrir o mangá');
    } finally {
      this.loading.set(false);
    }
  }

  private storedBookMark(): number {
    return fromReaderIndex(this.currentPage(), this.pageCount());
  }

  private scheduleProgressUpdate(): void {
    if (this.historySessionId == null) return;
    if (this.updateTimer) clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => {
      if (this.historySessionId == null) return;
      const bookMark = this.storedBookMark();
      void this.electron.updateHistorySession({
        id: this.historySessionId,
        pageEnd: bookMark,
        pages: this.pageCount()
      });
      void this.electron.setMangaBookmark(this.mangaId, bookMark);
    }, 1500);
  }

  private async cleanup(): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    if (this.updateTimer) clearTimeout(this.updateTimer);

    const bookMark = this.storedBookMark();
    if (this.mangaId && this.pageCount() > 0) {
      await this.electron.setMangaBookmark(this.mangaId, bookMark);
    }

    if (this.historySessionId != null) {
      await this.electron.endHistorySession({
        id: this.historySessionId,
        pageEnd: bookMark,
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

    await this.closeLinkedSession();

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch { /* ignore */ }
    }
  }
}
