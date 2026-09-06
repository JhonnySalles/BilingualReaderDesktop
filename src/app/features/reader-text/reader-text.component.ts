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
  BookMarginSize,
  BookScrollingMode,
  BookSpacingSize
} from '../../core/models';
import { ReaderTouchOverlayComponent } from '../reader-shared/reader-touch-overlay.component';
import { ReaderTouchConfigComponent } from '../reader-shared/reader-touch-config.component';
import { handleReaderTouchTap, TouchActionHandlers } from '../reader-shared/touch-action.util';
import { AnnotationPopupComponent } from './annotation-popup.component';
import { TextSelectPopupComponent } from './text-select-popup.component';
import { BOOK_FONT_OPTIONS, BookFontOption } from './book-fonts';

interface TocEntry {
  label: string;
  href: string;
  location: number;
}

interface TextSelectPos {
  left: number;
  top: number;
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
/** Rubber-band / page-turn threshold when dragging past page edge (px). */
const OVERSCROLL_PAGE_THRESHOLD = 200;
/** Fraction of viewport used as alternate overscroll threshold. */
const OVERSCROLL_VIEWPORT_FRACTION = 0.3;
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
    TextSelectPopupComponent
  ],
  host: { class: 'block h-screen w-screen' },
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

      <!-- EPUB viewport (clicks/pan via iframe hooks — does not bubble to Angular) -->
      <div
        #viewerHost
        class="absolute inset-0 outline-none z-0 touch-none"
        [class.cursor-grab]="!panning()"
        [class.cursor-grabbing]="panning()">
        <div
          #viewer
          class="w-full h-full origin-top will-change-transform"
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

            <button type="button" disabled title="Busca (em breve)"
              class="hidden sm:block p-2 rounded-lg text-slate-600 cursor-not-allowed opacity-50">
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
          <div class="relative">
            <input
              type="range"
              min="0"
              [max]="Math.max(0, pageCount() - 1)"
              [ngModel]="currentPage()"
              [ngModelOptions]="{ updateOn: 'change' }"
              (ngModelChange)="seekTo($event)"
              class="w-full accent-indigo-500 cursor-pointer" />
            @for (ch of toc(); track ch.href) {
              @if (ch.location >= 0) {
                <span
                  class="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 pointer-events-none"
                  [style.left.%]="chapterDotPercent(ch.location)"></span>
              }
            }
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

          <button type="button" disabled title="Anotações (em breve)"
            class="p-2.5 rounded-xl text-slate-600 cursor-not-allowed opacity-50">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 8h10M7 12h6m-6 8l-4-4V6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H7z"/>
            </svg>
          </button>

          <button type="button" disabled title="TTS (em breve)"
            class="p-2.5 rounded-xl text-slate-600 cursor-not-allowed opacity-50">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15.536 8.464a5 5 0 010 7.072M17.657 6.343a8 8 0 010 11.314M11 5l-5 4H3v6h3l5 4V5z"/>
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
            @for (font of bookFonts; track font.id) {
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

      <app-text-select-popup
        [visible]="textSelectVisible()"
        [left]="textSelectPos().left"
        [top]="textSelectPos().top"
        (color)="onTextSelectColor($event)"
        (erase)="onTextSelectErase()"
        (copy)="onTextSelectCopy()"
        (selectAll)="onTextSelectAll()"
        (dismiss)="dismissTextSelect()" />

      @if (editingAnnotation(); as draft) {
        <app-annotation-popup
          [annotation]="draft"
          (save)="onAnnotationSave($event)"
          (delete)="onAnnotationDelete()"
          (cancel)="onAnnotationCancel()" />
      }
    </div>
  `
})
export class ReaderTextComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('viewer') viewerRef?: ElementRef<HTMLElement>;
  @ViewChild('viewerHost') viewerHostRef?: ElementRef<HTMLElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private electron = inject(ElectronService);
  private nav = inject(NavigationStackService);
  private settings = inject(SettingsService);
  private touchZones = inject(TouchZoneService);

  BookScrollingMode = BookScrollingMode;
  Math = Math;
  bookFonts: BookFontOption[] = BOOK_FONT_OPTIONS;

  bookId = Number(this.route.snapshot.paramMap.get('id'));
  title = signal('Leitor de Livro');
  author = signal('');
  chapterTitle = signal('');
  pageCount = signal(0);
  currentPage = signal(0);
  currentCfi = signal('');
  favorite = signal(false);
  marked = signal(false);
  loading = signal(true);
  loadingMessage = signal('Abrindo arquivo…');
  error = signal<string | null>(null);
  chromeVisible = signal(false);
  isFullscreen = signal(false);
  showToc = signal(false);
  showTypography = signal(false);
  toc = signal<TocEntry[]>([]);
  zoom = signal(1);
  panning = signal(false);
  showTouchDemo = signal(false);
  showTouchConfig = signal(false);
  touchMenuOpen = signal(false);
  stubToast = signal<string | null>(null);
  coverUrl = signal<string | null>(null);
  adjacentPrev = signal<Book | null>(null);
  adjacentNext = signal<Book | null>(null);
  switchConfirm = signal<{ direction: 'prev' | 'next'; book: Book; title: string; fileName: string } | null>(null);
  annotations = signal<BookAnnotation[]>([]);
  editingAnnotation = signal<BookAnnotation | null>(null);
  textSelectVisible = signal(false);
  textSelectPos = signal<TextSelectPos>({ left: 0, top: 0 });
  pendingSelection = signal<BookAnnotation | null>(null);

  scrollingMode = signal<BookScrollingMode>(this.settings.bookScrollingMode());
  fontSize = signal<number>(this.settings.bookFontSize());
  fontFamily = signal<string>(this.settings.bookFontFamily());
  align = signal<BookAlign>(this.settings.bookAlign());
  margin = signal<BookMarginSize>(this.settings.bookMargin());
  spacing = signal<BookSpacingSize>(this.settings.bookSpacing());

  private readerSessionId: string | null = null;
  private historySessionId: number | null = null;
  private updateTimer: ReturnType<typeof setTimeout> | null = null;
  private configTimer: ReturnType<typeof setTimeout> | null = null;
  private ended = false;
  private bookMeta: Book | null = null;
  private epubBook: EpubBook | null = null;
  private rendition: Rendition | null = null;
  private viewReady = false;
  private pendingOpen: { epubUrl: string; bookMark: number; bookMarkCfi: string } | null = null;
  private relocating = false;
  private wheelAccum = 0;
  private didDrag = false;
  private panPointerId: number | null = null;
  private panLastX = 0;
  private panLastY = 0;
  /** Accumulated overscroll while dragging past page edge (paginated). */
  private overscrollX = 0;
  private overscrollY = 0;
  private overscrollAnimating = false;
  private contentCleanups: Array<() => void> = [];
  private pendingSelectContents: any | null = null;
  private textSelectPageAtOpen = -1;
  private clickTimer: ReturnType<typeof setTimeout> | null = null;
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
    if (this.pendingOpen) {
      const pending = this.pendingOpen;
      this.pendingOpen = null;
      void this.mountEpub(pending.epubUrl, pending.bookMark, pending.bookMarkCfi);
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('fullscreenchange', this.onFsChange);
    window.removeEventListener('wheel', this.onWindowWheel);
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
    if (this.textSelectVisible()) return;
    const target = ev.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
      return;
    }
    const key = ev.key;
    const paginated = this.isPaginatedMode();
    const continuous = this.isContinuousScrollMode();

    if (key === 'ArrowLeft') {
      if (!paginated) return;
      ev.preventDefault();
      this.isRtl() ? this.goNext() : this.goPrev();
    } else if (key === 'ArrowRight') {
      if (!paginated) return;
      ev.preventDefault();
      this.isRtl() ? this.goPrev() : this.goNext();
    } else if (key === 'ArrowUp') {
      if (paginated) {
        ev.preventDefault();
        this.goPrev();
      } else if (continuous) {
        ev.preventDefault();
        this.scrollContinuousBy(-1);
      }
    } else if (key === 'ArrowDown') {
      if (paginated) {
        ev.preventDefault();
        this.goNext();
      } else if (continuous) {
        ev.preventDefault();
        this.scrollContinuousBy(1);
      }
    } else if (key === 'PageUp') {
      ev.preventDefault();
      if (paginated) {
        this.isRtl() && this.isHorizontalMode() ? this.goNext() : this.goPrev();
      } else {
        this.scrollContinuousBy(-1);
      }
    } else if (key === 'PageDown' || key === ' ') {
      ev.preventDefault();
      if (paginated) {
        this.isRtl() && this.isHorizontalMode() ? this.goPrev() : this.goNext();
      } else {
        this.scrollContinuousBy(1);
      }
    } else if (key === 'Home') {
      ev.preventDefault();
      void this.goToFirstPage();
    } else if (key === 'End') {
      ev.preventDefault();
      void this.goToLastPage();
    } else if (key === 'Escape') {
      if (this.showTypography() || this.showToc()) {
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
    if (this.showTypography() || this.showToc()) {
      this.showTypography.set(false);
      this.showToc.set(false);
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

  private showStub(message: string): void {
    this.stubToast.set(message);
    if (this.stubToastTimer) clearTimeout(this.stubToastTimer);
    this.stubToastTimer = setTimeout(() => this.stubToast.set(null), 2000);
  }

  /** Ask to open previous/next book in the library (Android confirmSwitch). */
  requestAdjacentFile(direction: 'prev' | 'next'): void {
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

  /** Navigate previous with continuous scroll or internal page scroll first. */
  goPrev(): void {
    if (this.isContinuousScrollMode()) {
      this.scrollContinuousBy(-1);
      return;
    }
    if (this.tryScrollContents(-1)) return;
    this.prevPage();
  }

  /** Navigate next with continuous scroll or internal page scroll first. */
  goNext(): void {
    if (this.isContinuousScrollMode()) {
      this.scrollContinuousBy(1);
      return;
    }
    if (this.tryScrollContents(1)) return;
    this.nextPage();
  }

  prevPage(): void {
    if (!this.rendition) return;
    void this.rendition.prev();
  }

  nextPage(): void {
    if (!this.rendition) return;
    void this.rendition.next();
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
    const updated = await this.persistBookmark(true);
    if (updated) {
      this.marked.set(true);
      setTimeout(() => this.marked.set(false), 1200);
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

  setFontSize(size: number): void {
    const next = Math.min(32, Math.max(12, Number(size) || 18));
    this.fontSize.set(next);
    this.settings.bookFontSize.set(next);
    this.applyTypography();
    this.scheduleConfigSave();
  }

  adjustFontSize(delta: number): void {
    this.setFontSize(this.fontSize() + delta);
  }

  private setZoom(value: number): void {
    const next = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)) * 100) / 100;
    this.zoom.set(next);
  }

  setFontFamily(family: string): void {
    this.fontFamily.set(family);
    this.settings.bookFontFamily.set(family);
    this.applyTypography();
    this.scheduleConfigSave();
  }

  setAlign(align: BookAlign): void {
    this.align.set(align);
    this.settings.bookAlign.set(align);
    this.applyTypography();
    this.scheduleConfigSave();
  }

  setMargin(margin: BookMarginSize): void {
    this.margin.set(margin);
    this.settings.bookMargin.set(margin);
    this.applyTypography();
    this.scheduleConfigSave();
  }

  setSpacing(spacing: BookSpacingSize): void {
    this.spacing.set(spacing);
    this.settings.bookSpacing.set(spacing);
    this.applyTypography();
    this.scheduleConfigSave();
  }

  async goBack(): Promise<void> {
    await this.cleanup();
    this.nav.goBack(this.router);
  }

  private onFsChange = (): void => {
    this.isFullscreen.set(!!document.fullscreenElement);
  };

  private onWindowWheel = (ev: WheelEvent): void => {
    this.handleWheel(ev);
  };

  private handleWheel(ev: WheelEvent): void {
    if (this.loading() || this.error() || this.ended) return;

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

    if (this.isHorizontalMode() && this.isRtl()) {
      forward ? this.goPrev() : this.goNext();
    } else {
      forward ? this.goNext() : this.goPrev();
    }
  }

  private onRenditionClick = (event: MouseEvent): void => {
    if (this.editingAnnotation()) return;
    if (this.textSelectVisible()) {
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
    this.loadingMessage.set('Abrindo arquivo…');
    try {
      if (!this.bookId || Number.isNaN(this.bookId)) {
        throw new Error('ID de livro inválido');
      }

      const book = await this.electron.getBook(this.bookId);
      this.bookMeta = book;
      if (book) {
        this.title.set(book.title || book.name || 'Livro');
        this.author.set(book.author || '');
        this.favorite.set(!!book.favorite);
        this.coverUrl.set(book.coverPath ? `local-cover:///${book.coverPath}` : null);
      }

      this.loadingMessage.set('Preparando EPUB…');
      const opened = await this.electron.openBookReader(this.bookId);
      if (!opened) {
        throw new Error('Falha ao abrir o leitor (Electron indisponível)');
      }

      this.readerSessionId = opened.sessionId;
      this.title.set(opened.title);
      this.author.set(opened.author || '');
      this.favorite.set(opened.favorite);
      this.applyConfiguration(opened.configuration);

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
  }

  private async mountEpub(epubUrl: string, bookMark: number, bookMarkCfi: string): Promise<void> {
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
    this.applyAnnotations();

    const startCfi = bookMarkCfi
      || (bookMark > 0 ? book.locations.cfiFromLocation(bookMark) : undefined)
      || undefined;

    if (startCfi) {
      await this.rendition!.display(startCfi);
      this.currentPage.set(Math.min(bookMark, locationCount - 1));
      this.currentCfi.set(startCfi);
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
      pageStart: this.currentPage(),
      pages: locationCount,
      volume: this.bookMeta?.volume || ''
    });

    void this.electron.setBookBookmark({
      id: this.bookId,
      bookMark: this.currentPage(),
      bookMarkCfi: this.currentCfi() || undefined,
      pages: locationCount
    });

    this.loading.set(false);
    void this.loadAdjacentBooks();
    // Brief chrome flash so controls are discoverable, then immersive
    this.chromeVisible.set(true);
    setTimeout(() => {
      if (!this.showToc() && !this.showTypography()) {
        this.chromeVisible.set(false);
      }
    }, 1200);
    this.maybeShowFirstTouchDemo();
  }

  private createRendition(el: HTMLElement): void {
    if (!this.epubBook) return;
    const mode = this.scrollingMode();
    // Only Tira uses continuous manager; Vertical is paginated (ViewPager2 parity)
    const continuous = mode === BookScrollingMode.Continuous;

    const rendition = this.epubBook.renderTo(el, continuous
      ? {
          width: '100%',
          height: '100%',
          manager: 'continuous',
          flow: 'scrolled',
          allowScriptedContent: false
        }
      : {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          allowScriptedContent: false,
          defaultDirection: mode === BookScrollingMode.PaginationRtl ? 'rtl' : 'ltr'
        });
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
    });

    rendition.on('relocated', (location: any) => {
      if (this.relocating) return;
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
    });
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

    this.showTextSelectPopup(cfiRange, text, range, contents, domRange);
  };

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
      if (!Number.isNaN(loc)) page = Math.max(0, loc);
    } catch { /* keep current */ }

    return {
      fkBook: this.bookId,
      page,
      pages: this.pageCount(),
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

    let selLeft = 0;
    let selTop = 0;
    let selBottom = 40;
    let selWidth = 40;

    try {
      if (domRange && contents?.document) {
        const r = domRange.getBoundingClientRect();
        const iframe = contents.document.defaultView?.frameElement as HTMLElement | null;
        const iframeRect = iframe?.getBoundingClientRect();
        const ox = iframeRect?.left ?? 0;
        const oy = iframeRect?.top ?? 0;
        selLeft = ox + r.left;
        selTop = oy + r.top;
        selBottom = oy + r.bottom;
        selWidth = Math.max(r.width, 1);
      }
    } catch { /* fallback below */ }

    if (!hostRect) {
      return { left: pad, top: pad };
    }

    // Convert viewport coords → host-local
    let left = selLeft - hostRect.left + selWidth / 2 - popupW / 2;
    let top = selTop - hostRect.top - popupH - pad;
    if (top < pad) {
      top = selBottom - hostRect.top + pad;
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
      const sel = contents?.window?.getSelection?.();
      if (sel && !sel.isCollapsed && (sel.toString() || '').trim()) return true;
    } catch { /* ignore */ }
    return false;
  }

  private attachContentPan(contents: any): void {
    const doc: Document | undefined = contents?.document;
    const win: Window | undefined = contents?.window;
    if (!doc || !win) return;

    try {
      doc.body.style.cursor = 'grab';
    } catch { /* ignore */ }

    const onDown = (ev: PointerEvent) => {
      if (ev.button !== 0 || this.loading()) return;
      this.didDrag = false;
      this.overscrollX = 0;
      this.overscrollY = 0;
      this.syncOverscrollSignals(false);
      this.panning.set(true);
      this.panPointerId = ev.pointerId;
      this.panLastX = ev.clientX;
      this.panLastY = ev.clientY;
      try {
        doc.body.style.cursor = 'grabbing';
      } catch { /* ignore */ }
    };

    const onMove = (ev: PointerEvent) => {
      if (this.panPointerId !== ev.pointerId || !this.panning()) return;
      const dx = ev.clientX - this.panLastX;
      const dy = ev.clientY - this.panLastY;
      this.panLastX = ev.clientX;
      this.panLastY = ev.clientY;
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
            // Horizontal overscroll toward next/prev page
            const towardNext = this.isRtl() ? dx > 0 : dx < 0;
            const towardPrev = this.isRtl() ? dx < 0 : dx > 0;
            if (towardNext || towardPrev) {
              // Dampen rubber-band
              this.overscrollX += dx * 0.45;
              this.overscrollY = 0;
              this.syncOverscrollSignals(false);
              return;
            }
          } else {
            // Vertical pagination
            if (this.canScrollContents(dy > 0 ? 1 : -1)) {
              win.scrollBy(0, -dy);
              this.overscrollX = 0;
              this.overscrollY = 0;
              this.syncOverscrollSignals(false);
              return;
            }
            this.overscrollY += dy * 0.45;
            this.overscrollX = 0;
            this.syncOverscrollSignals(false);
            return;
          }
        }

        // Zoom pan fallback
        win.scrollBy(-dx, -dy);
      } catch { /* ignore */ }
    };

    const onUp = (ev: PointerEvent) => {
      if (this.panPointerId !== ev.pointerId) return;
      this.panPointerId = null;
      this.panning.set(false);
      try {
        doc.body.style.cursor = 'grab';
      } catch { /* ignore */ }

      if (this.isPaginatedMode() && this.didDrag) {
        this.commitOrSnapOverscroll();
      } else {
        this.resetOverscroll(true);
      }
    };

    doc.addEventListener('pointerdown', onDown);
    doc.addEventListener('pointermove', onMove);
    doc.addEventListener('pointerup', onUp);
    doc.addEventListener('pointercancel', onUp);

    this.contentCleanups.push(() => {
      doc.removeEventListener('pointerdown', onDown);
      doc.removeEventListener('pointermove', onMove);
      doc.removeEventListener('pointerup', onUp);
      doc.removeEventListener('pointercancel', onUp);
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

  /** On pointerup: turn page if past threshold, else snap back (anchor). */
  private commitOrSnapOverscroll(): void {
    const host = this.viewerHostRef?.nativeElement;
    const viewportSize = this.isHorizontalMode()
      ? (host?.clientWidth || window.innerWidth)
      : (host?.clientHeight || window.innerHeight);
    const threshold = Math.max(
      OVERSCROLL_PAGE_THRESHOLD,
      viewportSize * OVERSCROLL_VIEWPORT_FRACTION
    );

    if (this.isHorizontalMode()) {
      const amount = this.overscrollX;
      if (Math.abs(amount) >= threshold) {
        // Finger dragged right → content moves right → previous (LTR)
        const forward = this.isRtl() ? amount > 0 : amount < 0;
        this.resetOverscroll(false);
        if (forward) this.goNext();
        else this.goPrev();
        return;
      }
    } else {
      const amount = this.overscrollY;
      if (Math.abs(amount) >= threshold) {
        // Finger dragged up → content moves up → next
        const forward = amount < 0;
        this.resetOverscroll(false);
        if (forward) this.goNext();
        else this.goPrev();
        return;
      }
    }
    this.resetOverscroll(true);
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
   */
  private scrollContinuousBy(dir: 1 | -1): void {
    const viewportH = this.viewerRef?.nativeElement?.clientHeight || window.innerHeight;
    const step = viewportH * 0.9;
    const container = this.continuousScrollContainer();

    if (container) {
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      const top = container.scrollTop;
      if (dir > 0 && top >= maxScroll - 2) return;
      if (dir < 0 && top <= 2) return;
      container.scrollBy({ top: dir * step, behavior: 'smooth' });
      return;
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
      if (dir > 0 && scrollTop >= maxScroll - 2) return;
      if (dir < 0 && scrollTop <= 2) return;
      win.scrollBy({ top: dir * step, behavior: 'smooth' });
    }
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

  private applyTypography(): void {
    if (!this.rendition) return;
    const pad = MARGIN_PX[this.margin()];
    const lh = SPACING_LH[this.spacing()] ?? this.settings.bookLineHeight();
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
    this.rendition.themes.default({
      body: {
        'font-family': this.fontFamily() + ' !important',
        'font-size': this.fontSize() + 'px !important',
        'line-height': lh + ' !important',
        'text-align': textAlign + ' !important',
        'padding': pad + 'px !important',
        'background': '#0f172a !important',
        'color': '#e2e8f0 !important'
      },
      p: {
        'text-align': textAlign + ' !important',
        'line-height': lh + ' !important'
      },
      a: {
        color: '#a5b4fc !important'
      },
      'img, svg, image, video': {
        'max-width': '100% !important',
        'width': 'auto !important',
        'height': 'auto !important',
        'display': 'block !important',
        'margin-left': imgMl,
        'margin-right': imgMr,
        'object-fit': 'contain'
      },
      figure: {
        'max-width': '100% !important',
        'margin-left': imgMl,
        'margin-right': imgMr,
        'margin-top': '0.5em !important',
        'margin-bottom': '0.5em !important',
        'display': 'block !important'
      },
      'p img, div img, figure img': {
        'width': 'auto !important',
        'max-width': '100% !important',
        'height': 'auto !important',
        'display': 'block !important',
        'margin-left': imgMl,
        'margin-right': imgMr
      }
    });
    this.rendition.themes.fontSize(Math.round((this.fontSize() / 16) * 100) + '%');
  }

  private async buildToc(book: EpubBook): Promise<void> {
    try {
      const nav = await book.loaded.navigation;
      const flat: TocEntry[] = [];
      const walk = (items: NavItem[]) => {
        for (const item of items || []) {
          if (item.href) {
            let location = -1;
            try {
              const section = (book as any).spine?.get(item.href);
              const cfiBase = section?.cfiBase;
              if (cfiBase) {
                const loc = book.locations.locationFromCfi(cfiBase);
                location = typeof loc === 'number' ? loc : Number(loc) || -1;
              }
            } catch {
              location = -1;
            }
            flat.push({
              label: item.label?.trim() || 'Capítulo',
              href: item.href,
              location
            });
          }
          if (item.subitems?.length) walk(item.subitems);
        }
      };
      walk(nav?.toc || []);
      this.toc.set(flat);
    } catch (e) {
      console.warn('[reader-text] TOC failed', e);
      this.toc.set([]);
    }
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

  private async persistBookmark(_force: boolean): Promise<Book | null> {
    if (!this.bookId) return null;
    if (this.historySessionId != null) {
      await this.electron.updateHistorySession({
        id: this.historySessionId,
        pageEnd: this.currentPage(),
        pages: this.pageCount()
      });
    }
    return await this.electron.setBookBookmark({
      id: this.bookId,
      bookMark: this.currentPage(),
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
      pagination: 'Default',
      fontType: this.fontFamily(),
      fontSize: this.fontSize()
    };
    await this.electron.saveBookConfiguration(config);
  }

  private destroyEpub(): void {
    try {
      this.rendition?.off?.('click', this.onRenditionClick);
      this.rendition?.off?.('dblclick', this.onRenditionDblClick);
      this.rendition?.off?.('selected', this.onRenditionSelected);
      this.rendition?.off?.('touchend', this.onRenditionTouchEnd);
    } catch {}
    this.clearContentPanListeners();
    this.resetOverscroll(false);
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

    await this.persistBookmark(true);
    await this.persistConfiguration();

    if (this.historySessionId != null) {
      await this.electron.endHistorySession({
        id: this.historySessionId,
        pageEnd: this.currentPage(),
        pages: this.pageCount(),
        type: 'BOOK',
        fkReference: this.bookId
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
