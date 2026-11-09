import { Component, inject, signal, computed, OnInit, AfterViewInit, DestroyRef, effect, untracked, ViewChild, ElementRef, NgZone } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../services/language.service';
import { ElectronService } from '../services/electron.service';
import { SettingsService } from '../services/settings.service';
import { LibraryStateService } from '../services/library-state.service';
import { HistoryUiStateService } from '../services/history-ui-state.service';
import { AnnotationsUiStateService } from '../services/annotations-ui-state.service';
import { VocabularyUiStateService } from '../services/vocabulary-ui-state.service';
import { HomeDashboardService } from '../services/home-dashboard.service';
import { NavigationStackService } from '../services/navigation-stack.service';
import { LibrarySearchService } from '../services/library-search.service';
import { MangaLibraryService } from '../services/manga-library.service';
import { BookLibraryService } from '../services/book-library.service';
import { LibraryViewType } from '../models';
import { SearchSuggestFieldComponent } from '../../shared/search-suggest-field/search-suggest-field.component';
import { SocialShareService } from '../services/social-share.service';
import { LibrarySearchScope } from '../models/library-search.model';
import { LibraryFilterModalComponent } from '../../features/library/components/library-filter-modal/library-filter-modal.component';
import { HistoryFilterModalComponent } from '../../features/history/components/history-filter-modal/history-filter-modal.component';

interface NavLibrary {
  id: string;
  name: string;
  type: 'manga' | 'book';
  icon: string;
  count: number;
}

type HeaderMode = 'home' | 'library' | 'history' | 'annotations' | 'vocabulary' | 'settings' | 'help' | 'about' | 'titleOnly';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslatePipe, SearchSuggestFieldComponent, LibraryFilterModalComponent, HistoryFilterModalComponent],
  template: `
    <div class="h-screen w-screen flex bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <aside
        [class.w-64]="isExpanded()"
        [class.w-16]="!isExpanded() && !hasSidebarScroll()"
        [class.w-20]="!isExpanded() && hasSidebarScroll()"
        class="h-full shrink-0 bg-slate-900/90 backdrop-blur border-r border-slate-800 flex flex-col transition-all duration-300 z-30 select-none">

        <!-- Top Header (Fixed) -->
        <div class="px-4 border-b border-slate-800 shrink-0 transition-all duration-300 ease-in-out relative overflow-hidden"
             [class.h-16]="isExpanded()"
             [class.h-24]="!isExpanded()">
          
          <button
            (click)="isExpanded.set(!isExpanded())"
            class="absolute p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all duration-300 ease-in-out cursor-pointer z-20 shrink-0"
            [style.left]="isExpanded() ? '212px' : (hasSidebarScroll() ? '24px' : '16px')"
            [style.top]="isExpanded() ? '14px' : '10px'"
            [title]="'nav.expandMenu' | translate">
            <svg class="w-5 h-5 transition-transform duration-300 ease-in-out" [class.rotate-180]="!isExpanded()" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          <div class="absolute flex items-center gap-3 min-w-0 pointer-events-none transition-all"
               [style.left]="isExpanded() || !hasSidebarScroll() ? '14px' : '22px'"
               [ngClass]="isExpanded() ? 'top-3.5 delay-150 duration-300 ease-out' : 'top-12 delay-0 duration-200 ease-in'">
            <img
              src="assets/icons/icon.png"
              alt="Bilingual Reader"
              class="w-9 h-9 min-w-[2.25rem] rounded-xl object-contain shrink-0 filter drop-shadow-[0_4px_10px_rgb(var(--accent-500)/0.35)] transition-all duration-300"
              [class.scale-105]="!isExpanded()" />
            <div class="truncate transition-all overflow-hidden whitespace-nowrap"
                 [ngClass]="isExpanded() ? 'opacity-100 max-w-[160px] translate-x-0 duration-300 delay-150 ease-out' : 'opacity-0 max-w-0 -translate-x-3 duration-150 delay-0 ease-in'">
              <h1 class="text-sm font-bold tracking-wide leading-none text-slate-100">Bilingual Reader</h1>
              <span class="text-[10px] text-primary-400 font-semibold tracking-wider uppercase">Desktop v{{ appVersion() }}</span>
            </div>
          </div>
        </div>

        <!-- Middle Navigation (Scrollable on demand) -->
        <nav #navElement class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 space-y-1 custom-sidebar-scroll">
          <a
            routerLink="/"
            [queryParams]="{ lib: 'home' }"
            [ngClass]="isHomeActive() ? 'bg-primary-600/15 text-primary-400 font-semibold border-r-2 border-primary-500' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'"
            class="flex items-center px-3 py-2.5 rounded-lg text-xs transition-all cursor-pointer">
            <svg class="w-5 h-5 min-w-[1.25rem] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span class="overflow-hidden whitespace-nowrap transition-all"
                  [ngClass]="isExpanded() ? 'opacity-100 max-w-[200px] translate-x-0 ml-3 duration-300 delay-100 ease-out' : 'opacity-0 max-w-0 -translate-x-2 ml-0 duration-150 delay-0 ease-in'">
              {{ 'nav.home' | translate }}
            </span>
          </a>

          <div class="my-2 border-t border-slate-800"></div>
          <div class="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 overflow-hidden whitespace-nowrap transition-all flex items-center justify-between"
               [ngClass]="isExpanded() ? 'opacity-100 max-h-[20px] translate-x-0 pt-1 pb-1 duration-300 delay-100 ease-out' : 'opacity-0 max-h-0 -translate-x-2 pt-0 pb-0 duration-150 delay-0 ease-in'">
            <span>{{ 'nav.mangasAndComics' | translate }}</span>
          </div>

          <button
            (click)="selectLibrary(defaultMangaLibrary())"
            [title]="defaultMangaLibrary().name + ' (' + defaultMangaLibrary().count + ' ' + (defaultMangaLibrary().count === 1 ? ('common.item' | translate) : ('common.items' | translate)) + ')'"
            [ngClass]="getNavMangaButtonClass(defaultMangaLibrary().id)"
            class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all duration-300 cursor-pointer">
            <div class="flex items-center overflow-hidden">
              <div class="flex flex-col items-center justify-center shrink-0 min-w-[1.5rem]">
                <span class="text-base text-center leading-none select-none">🎨</span>
                <span
                  class="text-[9px] font-bold leading-none tracking-tight text-center truncate max-w-[36px] transition-all select-none"
                  [ngClass]="!isExpanded()
                    ? 'opacity-100 max-h-4 mt-1 scale-100 duration-300 delay-100 ease-out'
                    : 'opacity-0 max-h-0 mt-0 scale-75 duration-150 delay-0 ease-in pointer-events-none overflow-hidden'"
                  [class.text-manga-400]="isLibActive(defaultMangaLibrary().id)"
                  [class.text-slate-400]="!isLibActive(defaultMangaLibrary().id)">
                  {{ defaultMangaLibrary().count }}
                </span>
              </div>
              <span
                class="overflow-hidden whitespace-nowrap truncate font-medium transition-all"
                [ngClass]="isExpanded() ? 'opacity-100 max-w-[150px] translate-x-0 ml-3 duration-300 delay-100 ease-out' : 'opacity-0 max-w-0 -translate-x-2 ml-0 duration-150 delay-0 ease-in'">
                {{ defaultMangaLibrary().name }}
              </span>
            </div>
            <span
              class="text-[10px] rounded overflow-hidden whitespace-nowrap flex items-center justify-center transition-all duration-300"
              [ngClass]="[
                getNavMangaBadgeClass(defaultMangaLibrary().id),
                isExpanded() ? 'opacity-100 max-w-[40px] translate-x-0 px-1.5 py-0.5 delay-100 ease-out' : 'opacity-0 max-w-0 -translate-x-1 px-0 py-0 delay-0 ease-in pointer-events-none'
              ]">
              {{ defaultMangaLibrary().count }}
            </span>
          </button>

          @for (lib of customMangaLibraries(); track lib.id) {
            <button
              (click)="selectLibrary(lib)"
              [title]="lib.name + ' (' + lib.count + ' ' + (lib.count === 1 ? ('common.item' | translate) : ('common.items' | translate)) + ')'"
              [ngClass]="getNavMangaButtonClass(lib.id)"
              class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all duration-300 cursor-pointer">
              <div class="flex items-center overflow-hidden">
                <div class="flex flex-col items-center justify-center shrink-0 min-w-[1.5rem]">
                  <span class="text-base text-center leading-none select-none">🎨</span>
                  <span
                    class="text-[9px] font-bold leading-none tracking-tight text-center truncate max-w-[36px] transition-all select-none"
                    [ngClass]="!isExpanded()
                      ? 'opacity-100 max-h-4 mt-1 scale-100 duration-300 delay-100 ease-out'
                      : 'opacity-0 max-h-0 mt-0 scale-75 duration-150 delay-0 ease-in pointer-events-none overflow-hidden'"
                    [class.text-manga-400]="isLibActive(lib.id)"
                    [class.text-slate-400]="!isLibActive(lib.id)">
                    {{ lib.count }}
                  </span>
                </div>
                <span
                  class="overflow-hidden whitespace-nowrap truncate transition-all"
                  [ngClass]="isExpanded() ? 'opacity-100 max-w-[150px] translate-x-0 ml-3 duration-300 delay-100 ease-out' : 'opacity-0 max-w-0 -translate-x-2 ml-0 duration-150 delay-0 ease-in'">
                  {{ lib.name }}
                </span>
              </div>
              <span
                class="text-[10px] rounded overflow-hidden whitespace-nowrap flex items-center justify-center transition-all duration-300"
                [ngClass]="[
                  getNavMangaBadgeClass(lib.id),
                  isExpanded() ? 'opacity-100 max-w-[40px] translate-x-0 px-1.5 py-0.5 delay-100 ease-out' : 'opacity-0 max-w-0 -translate-x-1 px-0 py-0 delay-0 ease-in pointer-events-none'
                ]">
                {{ lib.count }}
              </span>
            </button>
          }

          <div class="my-2 border-t border-slate-800"></div>
          <div class="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 overflow-hidden whitespace-nowrap transition-all flex items-center justify-between"
               [ngClass]="isExpanded() ? 'opacity-100 max-h-[20px] translate-x-0 pt-1 pb-1 duration-300 delay-100 ease-out' : 'opacity-0 max-h-0 -translate-x-2 pt-0 pb-0 duration-150 delay-0 ease-in'">
            <span>{{ 'nav.booksAndEpubs' | translate }}</span>
          </div>

          <button
            (click)="selectLibrary(defaultBookLibrary())"
            [title]="defaultBookLibrary().name + ' (' + defaultBookLibrary().count + ' ' + (defaultBookLibrary().count === 1 ? ('common.book' | translate) : ('common.books' | translate)) + ')'"
            [ngClass]="getNavBookButtonClass(defaultBookLibrary().id)"
            class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all duration-300 cursor-pointer">
            <div class="flex items-center overflow-hidden">
              <div class="flex flex-col items-center justify-center shrink-0 min-w-[1.5rem]">
                <span class="text-base text-center leading-none select-none">📚</span>
                <span
                  class="text-[9px] font-bold leading-none tracking-tight text-center truncate max-w-[36px] transition-all select-none"
                  [ngClass]="!isExpanded()
                    ? 'opacity-100 max-h-4 mt-1 scale-100 duration-300 delay-100 ease-out'
                    : 'opacity-0 max-h-0 mt-0 scale-75 duration-150 delay-0 ease-in pointer-events-none overflow-hidden'"
                  [class.text-book-400]="isLibActive(defaultBookLibrary().id)"
                  [class.text-slate-400]="!isLibActive(defaultBookLibrary().id)">
                  {{ defaultBookLibrary().count }}
                </span>
              </div>
              <span
                class="overflow-hidden whitespace-nowrap truncate font-medium transition-all"
                [ngClass]="isExpanded() ? 'opacity-100 max-w-[150px] translate-x-0 ml-3 duration-300 delay-100 ease-out' : 'opacity-0 max-w-0 -translate-x-2 ml-0 duration-150 delay-0 ease-in'">
                {{ defaultBookLibrary().name }}
              </span>
            </div>
            <span
              class="text-[10px] rounded overflow-hidden whitespace-nowrap flex items-center justify-center transition-all duration-300"
              [ngClass]="[
                getNavBookBadgeClass(defaultBookLibrary().id),
                isExpanded() ? 'opacity-100 max-w-[40px] translate-x-0 px-1.5 py-0.5 delay-100 ease-out' : 'opacity-0 max-w-0 -translate-x-1 px-0 py-0 delay-0 ease-in pointer-events-none'
              ]">
              {{ defaultBookLibrary().count }}
            </span>
          </button>

          @for (lib of customBookLibraries(); track lib.id) {
            <button
              (click)="selectLibrary(lib)"
              [title]="lib.name + ' (' + lib.count + ' ' + (lib.count === 1 ? ('common.item' | translate) : ('common.items' | translate)) + ')'"
              [ngClass]="getNavBookButtonClass(lib.id)"
              class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all duration-300 cursor-pointer">
              <div class="flex items-center overflow-hidden">
                <div class="flex flex-col items-center justify-center shrink-0 min-w-[1.5rem]">
                  <span class="text-base text-center leading-none select-none">📚</span>
                  <span
                    class="text-[9px] font-bold leading-none tracking-tight text-center truncate max-w-[36px] transition-all select-none"
                    [ngClass]="!isExpanded()
                      ? 'opacity-100 max-h-4 mt-1 scale-100 duration-300 delay-100 ease-out'
                      : 'opacity-0 max-h-0 mt-0 scale-75 duration-150 delay-0 ease-in pointer-events-none overflow-hidden'"
                    [class.text-book-400]="isLibActive(lib.id)"
                    [class.text-slate-400]="!isLibActive(lib.id)">
                    {{ lib.count }}
                  </span>
                </div>
                <span
                  class="overflow-hidden whitespace-nowrap truncate transition-all"
                  [ngClass]="isExpanded() ? 'opacity-100 max-w-[150px] translate-x-0 ml-3 duration-300 delay-100 ease-out' : 'opacity-0 max-w-0 -translate-x-2 ml-0 duration-150 delay-0 ease-in'">
                  {{ lib.name }}
                </span>
              </div>
              <span
                class="text-[10px] rounded overflow-hidden whitespace-nowrap flex items-center justify-center transition-all duration-300"
                [ngClass]="[
                  getNavBookBadgeClass(lib.id),
                  isExpanded() ? 'opacity-100 max-w-[40px] translate-x-0 px-1.5 py-0.5 delay-100 ease-out' : 'opacity-0 max-w-0 -translate-x-1 px-0 py-0 delay-0 ease-in pointer-events-none'
                ]">
                {{ lib.count }}
              </span>
            </button>
          }

          <div class="my-2 border-t border-slate-800"></div>
          <div class="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 overflow-hidden whitespace-nowrap transition-all"
               [ngClass]="isExpanded() ? 'opacity-100 max-h-[20px] translate-x-0 pt-1 pb-1 duration-300 delay-100 ease-out' : 'opacity-0 max-h-0 -translate-x-2 pt-0 pb-0 duration-150 delay-0 ease-in'">
            <span>{{ 'nav.readerMenu' | translate }}</span>
          </div>

          <a
            routerLink="/history"
            routerLinkActive="bg-primary-600/15 text-primary-400 font-semibold border-r-2 border-primary-500"
            class="flex items-center px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
            <svg class="w-5 h-5 min-w-[1.25rem] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="overflow-hidden whitespace-nowrap transition-all"
                  [ngClass]="isExpanded() ? 'opacity-100 max-w-[200px] translate-x-0 ml-3 duration-300 delay-100 ease-out' : 'opacity-0 max-w-0 -translate-x-2 ml-0 duration-150 delay-0 ease-in'">
              {{ 'nav.readingHistory' | translate }}
            </span>
          </a>

          <a
            routerLink="/annotations"
            routerLinkActive="bg-primary-600/15 text-primary-400 font-semibold border-r-2 border-primary-500"
            class="flex items-center px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
            <svg class="w-5 h-5 min-w-[1.25rem] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 8h10M7 12h6m-6 8l-4-4V6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H7z" />
            </svg>
            <span class="overflow-hidden whitespace-nowrap transition-all"
                  [ngClass]="isExpanded() ? 'opacity-100 max-w-[200px] translate-x-0 ml-3 duration-300 delay-100 ease-out' : 'opacity-0 max-w-0 -translate-x-2 ml-0 duration-150 delay-0 ease-in'">
              {{ 'nav.annotations' | translate }}
            </span>
          </a>

          <a
            routerLink="/vocabulary"
            routerLinkActive="bg-primary-600/15 text-primary-400 font-semibold border-r-2 border-primary-500"
            class="flex items-center px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
            <svg class="w-5 h-5 min-w-[1.25rem] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span class="overflow-hidden whitespace-nowrap transition-all"
                  [ngClass]="isExpanded() ? 'opacity-100 max-w-[200px] translate-x-0 ml-3 duration-300 delay-100 ease-out' : 'opacity-0 max-w-0 -translate-x-2 ml-0 duration-150 delay-0 ease-in'">
              {{ 'nav.vocabulary' | translate }}
            </span>
          </a>

          <a
            routerLink="/trackers"
            routerLinkActive="bg-primary-600/15 text-primary-400 font-semibold border-r-2 border-primary-500"
            class="flex items-center px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
            <svg class="w-5 h-5 min-w-[1.25rem] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span class="overflow-hidden whitespace-nowrap transition-all"
                  [ngClass]="isExpanded() ? 'opacity-100 max-w-[200px] translate-x-0 ml-3 duration-300 delay-100 ease-out' : 'opacity-0 max-w-0 -translate-x-2 ml-0 duration-150 delay-0 ease-in'">
              {{ 'nav.trackers' | translate }}
            </span>
          </a>

          <a
            routerLink="/statistics"
            routerLinkActive="bg-primary-600/15 text-primary-400 font-semibold border-r-2 border-primary-500"
            [routerLinkActiveOptions]="{ exact: false }"
            class="flex items-center px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
            <svg class="w-5 h-5 min-w-[1.25rem] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span class="overflow-hidden whitespace-nowrap transition-all"
                  [ngClass]="isExpanded() ? 'opacity-100 max-w-[200px] translate-x-0 ml-3 duration-300 delay-100 ease-out' : 'opacity-0 max-w-0 -translate-x-2 ml-0 duration-150 delay-0 ease-in'">
              {{ 'nav.statistics' | translate }}
            </span>
          </a>
        </nav>

        <!-- Bottom Footer (Fixed) -->
        <div class="shrink-0 p-2 border-t border-slate-800 space-y-1">
          <a
            routerLink="/settings"
            (click)="onSettingsClick()"
            routerLinkActive="bg-primary-600/15 text-primary-400 font-semibold border-r-2 border-primary-500"
            class="group flex items-center px-3 py-2.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
            <svg class="w-5 h-5 min-w-[1.25rem] shrink-0 transition-transform duration-300 group-hover:rotate-45"
                 [class.animate-gear-spin]="isSettingsSpinning()"
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span class="overflow-hidden whitespace-nowrap transition-all"
                  [ngClass]="isExpanded() ? 'opacity-100 max-w-[200px] translate-x-0 ml-3 duration-300 delay-100 ease-out' : 'opacity-0 max-w-0 -translate-x-2 ml-0 duration-150 delay-0 ease-in'">
              {{ 'nav.settings' | translate }}
            </span>
          </a>
          <a
            routerLink="/help"
            routerLinkActive="bg-primary-600/15 text-primary-400 font-semibold border-r-2 border-primary-500"
            class="flex items-center px-3 py-2.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
            <svg class="w-5 h-5 min-w-[1.25rem] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="overflow-hidden whitespace-nowrap transition-all"
                  [ngClass]="isExpanded() ? 'opacity-100 max-w-[200px] translate-x-0 ml-3 duration-300 delay-100 ease-out' : 'opacity-0 max-w-0 -translate-x-2 ml-0 duration-150 delay-0 ease-in'">
              {{ 'nav.help' | translate }}
            </span>
          </a>
          <a
            routerLink="/about"
            routerLinkActive="bg-primary-600/15 text-primary-400 font-semibold border-r-2 border-primary-500"
            class="flex items-center px-3 py-2.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
            <svg class="w-5 h-5 min-w-[1.25rem] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="overflow-hidden whitespace-nowrap transition-all"
                  [ngClass]="isExpanded() ? 'opacity-100 max-w-[200px] translate-x-0 ml-3 duration-300 delay-100 ease-out' : 'opacity-0 max-w-0 -translate-x-2 ml-0 duration-150 delay-0 ease-in'">
              {{ 'nav.about' | translate }}
            </span>
          </a>
        </div>
      </aside>

      <div class="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <header class="absolute top-0 left-0 right-0 z-40 h-20 px-6 flex items-center justify-between gap-4 select-none overflow-visible pointer-events-none">
          <div class="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/70 to-transparent backdrop-blur-md pointer-events-auto border-b border-slate-800/20"></div>

          <div class="relative z-10 flex items-center gap-3 min-w-0 pointer-events-auto">
            @if (headerMode() === 'history' && historyUi.fromStatistics()) {
              <a routerLink="/statistics" class="p-2 text-slate-400 hover:text-slate-200 rounded-lg transition-colors shrink-0">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                </svg>
              </a>
            }
            @if (headerMode() === 'settings') {
              <div class="flex items-center gap-3 min-w-0">
                <h2 class="text-lg font-bold text-slate-100 truncate">{{ 'nav.readerSettings' | translate }}</h2>
                <span class="text-xs text-slate-400 truncate hidden sm:inline">{{ 'nav.portedFromAndroid' | translate }}</span>
              </div>
            } @else {
              <h2 class="text-lg font-bold text-slate-100 truncate">
                {{ headerTitle() }}
              </h2>
            }
          </div>

          @if (headerMode() === 'home') {
            <div class="relative z-10 flex items-center gap-3 shrink-0 pointer-events-auto">
              <button
                type="button"
                (click)="onContinueReading()"
                [disabled]="!home.continueItem()"
                class="max-w-[16rem] sm:max-w-xs text-left px-3 py-1.5 rounded-xl border transition-all cursor-pointer
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-slate-800
                  bg-primary-600/15 border-primary-500/40 hover:bg-primary-600/25 hover:border-primary-400/60
                  flex items-center gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-primary-300">{{ 'nav.continue' | translate }}</span>
                    @if (home.continueItem(); as item) {
                      <span class="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-slate-950/60 text-slate-300 border border-slate-700">
                        {{ item.fileType }}
                      </span>
                    }
                  </div>
                  <p class="text-[10px] text-slate-400 truncate mt-0.5">
                    @if (home.continueItem(); as item) {
                      {{ item.title }}
                    } @else {
                      {{ 'nav.noRecentReading' | translate }}
                    }
                  </p>
                </div>
                <svg class="w-4 h-4 shrink-0 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </button>
            </div>
          }

          @if (headerMode() === 'library') {
            <div class="relative z-10 flex items-center gap-3 shrink-0 pointer-events-auto">
              <app-search-suggest-field
                [value]="libraryStateService.searchQuery()"
                [scope]="librarySearchScope()"
                [placeholder]="'nav.searchPlaceholder' | translate"
                (rawChange)="onLibrarySearchRaw($event)"
                (valueChange)="onLibrarySearchCommit($event)" />

              <button
                (pointerdown)="onButtonPointerDown('view', $event)"
                (pointerup)="onButtonPointerUp('view', $event)"
                (pointercancel)="onButtonPointerCancel()"
                (pointerleave)="onButtonPointerCancel()"
                (click)="onButtonClick('view', $event)"
                (contextmenu)="onButtonContextMenu($event)"
                class="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-90 active:rotate-12 rounded-xl text-slate-300 hover:text-white transition-all duration-200 flex items-center justify-center cursor-pointer shadow-sm hover:shadow-primary-500/10"
                [title]="'nav.currentMode' | translate:{ mode: getViewLabel(libraryStateService.getView(currentLibraryType())) }">
                @switch (libraryStateService.getView(currentLibraryType())) {
                  @case (LibraryViewType.GRID_BIG) {
                    <!-- Grid Big: 4 large tiles -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1h-5a1 1 0 01-1-1V5zM4 14a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zM14 14a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1h-5a1 1 0 01-1-1v-5z" />
                    </svg>
                  }
                  @case (LibraryViewType.GRID_MEDIUM) {
                    <!-- Grid Medium: 9 smaller grid blocks -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  }
                  @case (LibraryViewType.GRID_SMALL) {
                    <!-- Grid Small: 9 small grid blocks -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4h3v3H4zm6 0h3v3h-3zm6 0h3v3h-3zM4 10h3v3H4zm6 0h3v3h-3zm6 0h3v3h-3zM4 16h3v3H4zm6 0h3v3h-3zm6 0h3v3h-3z" />
                    </svg>
                  }
                  @case (LibraryViewType.GRID_OVERLAY) {
                    <!-- Grid Blur / Overlay: Card with blur layer / image icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                  @case (LibraryViewType.CAROUSEL) {
                    <!-- Carousel: 3 horizontal cards side-by-side -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h4v14H3zm7 0h4v14h-4zm7 0h4v14h-4z" />
                    </svg>
                  }
                  @case (LibraryViewType.CAROUSEL_SMALL) {
                    <!-- Carousel Small: 4 narrower horizontal cards -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 6h3v12H2zm5 0h3v12H7zm5 0h3v12h-3zm5 0h3v12h-3z" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_BIG) {
                    <!-- Big with Separator: Header bar on top + large grid blocks -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M4 9h6v10H4zm10 0h6v10h-6z" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_MEDIUM) {
                    <!-- Medium with Separator: Header bar on top + 4 grid blocks -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M4 8h5v5H4zm11 0h5v5h-5zM4 15h5v5H4zm11 0h5v5h-5z" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_SMALL) {
                    <!-- Small with Separator: Header bar on top + small grid blocks -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M4 7h3v3H4zm6 0h3v3h-3zm6 0h3v3h-3zM4 12h3v3H4zm6 0h3v3h-3zm6 0h3v3h-3zM4 17h3v3H4zm6 0h3v3h-3zm6 0h3v3h-3z" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_OVERLAY) {
                    <!-- Blur with Separator: Header bar + image overlay card -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M4 8h16v12H4zM4 16h16" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_CAROUSEL) {
                    <!-- Separator Carousel: Header line on top + horizontal cards -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M3 8h4v12H3zm7 0h4v12h-4zm7 0h4v12h-4z" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_CAROUSEL_SMALL) {
                    <!-- Separator Carousel Small: Header line + 4 narrower cards -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 3h20M2 7h3v13H2zm5 0h3v13H7zm5 0h3v13h-3zm5 0h3v13h-3z" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_LINE) {
                    <!-- Line with Separator: Header bar + horizontal items -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M4 9h16M4 14h16M4 19h16" />
                    </svg>
                  }
                  @case (LibraryViewType.LINE) {
                    <!-- Line: clean list lines -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  }
                  @default {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  }
                }
              </button>

              <button
                (pointerdown)="onButtonPointerDown('sort', $event)"
                (pointerup)="onButtonPointerUp('sort', $event)"
                (pointercancel)="onButtonPointerCancel()"
                (pointerleave)="onButtonPointerCancel()"
                (click)="onButtonClick('sort', $event)"
                (contextmenu)="onButtonContextMenu($event)"
                class="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-80 active:-rotate-12 rounded-xl text-slate-300 hover:text-white transition-all duration-200 flex items-center justify-center cursor-pointer shadow-sm hover:shadow-primary-500/10"
                [title]="(libraryStateService.getIsAscending(currentLibraryType()) ? ('nav.sortAscending' | translate) : ('nav.sortDescending' | translate))">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 sort-arrow-transition" [class.rotate-180]="!libraryStateService.getIsAscending(currentLibraryType())" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
              </button>

                            <button
                type="button"
                (click)="openLibrarySocialShare()"
                class="p-2 bg-slate-900 border border-slate-800 hover:border-primary-500/50 hover:bg-primary-950/30 rounded-xl text-primary-400 hover:text-primary-300 transition-all flex items-center justify-center cursor-pointer shadow-sm hover:shadow-primary-500/10"
                [title]="'nav.shareLibraryReadings' | translate">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>

<button
                (click)="libraryStateService.showFilterModal.set(true)"
                class="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-300 hover:text-white transition-all flex items-center justify-center cursor-pointer"
                [title]="'nav.filtersAndOptions' | translate">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </button>
            </div>
          }

          @if (headerMode() === 'history') {
            <div class="relative z-10 flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap justify-end pointer-events-auto">
              <app-search-suggest-field
                [value]="historyUi.search()"
                scope="history"
                [placeholder]="'nav.searchPlaceholder' | translate"
                (rawChange)="onHistorySearchRaw($event)"
                (valueChange)="onHistorySearchCommit($event)" />

              <select
                class="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200"
                [ngModel]="historyUi.year()"
                (ngModelChange)="historyUi.setYear($event)">
                <option [ngValue]="null">{{ 'nav.allYears' | translate }}</option>
                @for (y of historyUi.years(); track y) {
                  <option [ngValue]="y">{{ y }}</option>
                }
              </select>

              <select
                class="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 max-w-[10rem]"
                [ngModel]="historyUi.libraryId()"
                (ngModelChange)="historyUi.setLibrary($event)">
                <option [ngValue]="null">{{ 'nav.allLibraries' | translate }}</option>
                @for (lib of historyUi.libraries(); track lib.id) {
                  <option [ngValue]="lib.id">{{ lib.title }}</option>
                }
              </select>

              <div class="flex items-center gap-1 bg-slate-950/60 border border-slate-800 rounded-xl p-1">
                <button
                  type="button"
                  (click)="historyUi.setType('MANGA')"
                  class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  [class.manga-pill-active]="historyUi.activeType() === 'MANGA'"
                  [class.text-slate-400]="historyUi.activeType() !== 'MANGA'">
                  {{ 'nav.manga' | translate }}
                </button>
                <button
                  type="button"
                  (click)="historyUi.setType('BOOK')"
                  class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  [class.book-pill-active]="historyUi.activeType() === 'BOOK'"
                  [class.text-white]="historyUi.activeType() === 'BOOK'"
                  [class.text-slate-400]="historyUi.activeType() !== 'BOOK'">
                  {{ 'nav.book' | translate }}
                </button>
              </div>

              <button
                (pointerdown)="onButtonPointerDown('view', $event)"
                (pointerup)="onButtonPointerUp('view', $event)"
                (pointercancel)="onButtonPointerCancel()"
                (pointerleave)="onButtonPointerCancel()"
                (click)="onButtonClick('view', $event)"
                (contextmenu)="onButtonContextMenu($event)"
                class="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-90 active:rotate-12 rounded-xl text-slate-300 hover:text-white transition-all duration-200 flex items-center justify-center cursor-pointer shadow-sm hover:shadow-primary-500/10"
                [title]="'nav.currentMode' | translate:{ mode: getViewLabel(libraryStateService.currentView()) }">
                @switch (libraryStateService.currentView()) {
                  @case (LibraryViewType.GRID_BIG) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1h-5a1 1 0 01-1-1V5zM4 14a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zM14 14a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1h-5a1 1 0 01-1-1v-5z" />
                    </svg>
                  }
                  @case (LibraryViewType.GRID_MEDIUM) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  }
                  @case (LibraryViewType.GRID_SMALL) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4h3v3H4zm6 0h3v3h-3zm6 0h3v3h-3zM4 10h3v3H4zm6 0h3v3h-3zm6 0h3v3h-3zM4 16h3v3H4zm6 0h3v3h-3zm6 0h3v3h-3z" />
                    </svg>
                  }
                  @case (LibraryViewType.GRID_OVERLAY) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                  @case (LibraryViewType.CAROUSEL) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h4v14H3zm7 0h4v14h-4zm7 0h4v14h-4z" />
                    </svg>
                  }
                  @case (LibraryViewType.CAROUSEL_SMALL) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 6h3v12H2zm5 0h3v12H7zm5 0h3v12h-3zm5 0h3v12h-3z" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_BIG) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M4 9h6v10H4zm10 0h6v10h-6z" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_MEDIUM) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M4 8h5v5H4zm11 0h5v5h-5zM4 15h5v5H4zm11 0h5v5h-5z" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_SMALL) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M4 7h3v3H4zm6 0h3v3h-3zm6 0h3v3h-3zM4 12h3v3H4zm6 0h3v3h-3zm6 0h3v3h-3zM4 17h3v3H4zm6 0h3v3h-3zm6 0h3v3h-3z" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_OVERLAY) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M4 8h16v12H4zM4 16h16" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_CAROUSEL) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M3 8h4v12H3zm7 0h4v12h-4zm7 0h4v12h-4z" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_CAROUSEL_SMALL) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 3h20M2 7h3v13H2zm5 0h3v13H7zm5 0h3v13h-3zm5 0h3v13h-3z" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_LINE) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M4 9h16M4 14h16M4 19h16" />
                    </svg>
                  }
                  @case (LibraryViewType.LINE) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  }
                  @default {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400 animate-icon-swap" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  }
                }
              </button>

              <button
                (pointerdown)="onButtonPointerDown('sort', $event)"
                (pointerup)="onButtonPointerUp('sort', $event)"
                (pointercancel)="onButtonPointerCancel()"
                (pointerleave)="onButtonPointerCancel()"
                (click)="onButtonClick('sort', $event)"
                (contextmenu)="onButtonContextMenu($event)"
                class="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-80 active:-rotate-12 rounded-xl text-slate-300 hover:text-white transition-all duration-200 flex items-center justify-center cursor-pointer shadow-sm hover:shadow-primary-500/10"
                [title]="(libraryStateService.isAscending() ? ('nav.sortAscendingSimple' | translate) : ('nav.sortDescendingSimple' | translate))">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 sort-arrow-transition" [class.rotate-180]="!libraryStateService.isAscending()" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
              </button>

              <button
                type="button"
                (click)="socialShare.open({ initialMediaType: historyUi.activeType(), initialYear: historyUi.year(), initialLibraryId: null })"
                class="p-2 bg-slate-900 border border-slate-800 hover:border-primary-500/50 hover:bg-primary-950/30 rounded-xl text-primary-400 hover:text-primary-300 transition-all flex items-center justify-center cursor-pointer shadow-sm hover:shadow-primary-500/10"
                [title]="'nav.shareSocialStudio' | translate">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>

<button
                (click)="libraryStateService.showFilterModal.set(true)"
                class="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-300 hover:text-white transition-all flex items-center justify-center cursor-pointer"
                [title]="'nav.filtersAndOptions' | translate">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </button>
            </div>
          }

          @if (headerMode() === 'annotations') {
            <div class="relative z-10 flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap justify-end pointer-events-auto">
              <div class="relative w-40 sm:w-56">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  [ngModel]="annotationsUi.search()"
                  (ngModelChange)="onAnnotationsSearch($event)"
                  [placeholder]="'nav.searchAnnotations' | translate"
                  class="w-full pl-9 pr-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary-500/80 transition-all" />
              </div>

              <div class="flex items-center gap-1 bg-slate-950/60 border border-slate-800 rounded-xl p-1">
                <button
                  type="button"
                  (click)="annotationsUi.setType(null)"
                  class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  [class.bg-primary-600]="annotationsUi.type() === null"
                  [class.text-white]="annotationsUi.type() === null"
                  [class.text-slate-400]="annotationsUi.type() !== null">
                  {{ 'common.all' | translate }}
                </button>
                <button
                  type="button"
                  (click)="annotationsUi.setType('BOOK')"
                  class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  [class.bg-book-600]="annotationsUi.type() === 'BOOK'"
                  [class.text-white]="annotationsUi.type() === 'BOOK'"
                  [class.text-slate-400]="annotationsUi.type() !== 'BOOK'">
                  {{ 'nav.books' | translate }}
                </button>
                <button
                  type="button"
                  (click)="annotationsUi.setType('MANGA')"
                  class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  [class.manga-pill-active]="annotationsUi.type() === 'MANGA'"
                  [class.text-slate-400]="annotationsUi.type() !== 'MANGA'">
                  {{ 'nav.mangas' | translate }}
                </button>
              </div>

              <button
                type="button"
                (click)="annotationsUi.showFilterPopup.set(true)"
                class="p-2 bg-slate-900 border rounded-xl transition-all flex items-center justify-center cursor-pointer"
                [class.border-primary-500]="annotationsUi.hasAdvancedFilters()"
                [class.text-primary-300]="annotationsUi.hasAdvancedFilters()"
                [class.border-slate-800]="!annotationsUi.hasAdvancedFilters()"
                [class.text-slate-300]="!annotationsUi.hasAdvancedFilters()"
                [class.hover:border-slate-700]="!annotationsUi.hasAdvancedFilters()"
                [title]="'common.filter' | translate">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </button>
            </div>
          }

          @if (headerMode() === 'vocabulary') {
            <div class="relative z-10 flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap justify-end pointer-events-auto">
              <div class="relative w-40 sm:w-56">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  [ngModel]="vocabularyUi.search()"
                  (ngModelChange)="onVocabularySearch($event)"
                  [placeholder]="'nav.searchWords' | translate"
                  class="w-full pl-9 pr-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary-500/80 transition-all" />
              </div>

              <button
                type="button"
                (click)="vocabularyUi.toggleFavoriteOnly()"
                class="p-2 bg-slate-900 border rounded-xl transition-all flex items-center justify-center cursor-pointer"
                [class.border-amber-500]="vocabularyUi.favoriteOnly()"
                [class.text-amber-300]="vocabularyUi.favoriteOnly()"
                [class.border-slate-800]="!vocabularyUi.favoriteOnly()"
                [class.text-slate-300]="!vocabularyUi.favoriteOnly()"
                [title]="'nav.onlyFavorites' | translate">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" [attr.fill]="vocabularyUi.favoriteOnly() ? 'currentColor' : 'none'" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                </svg>
              </button>

              <button
                type="button"
                (click)="vocabularyUi.cycleOrder()"
                (contextmenu)="vocabularyUi.showOrderPopup.set(true); $event.preventDefault()"
                class="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-80 active:-rotate-12 rounded-xl text-slate-300 hover:text-white transition-all duration-200 flex items-center justify-center cursor-pointer shadow-sm hover:shadow-primary-500/10"
                [title]="'nav.orderBy' | translate:{ order: vocabularyUi.order() }">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 sort-arrow-transition" [class.rotate-180]="vocabularyUi.desc()" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
              </button>
            </div>
          }

          @if (headerMode() === 'settings') {
            <div class="relative z-10 flex items-center gap-2 shrink-0 pointer-events-auto">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {{ 'nav.settingsSaved' | translate }}
              </span>
            </div>
          }
        </header>

        <main class="flex-1 overflow-hidden relative" style="view-transition-name: main-content;">
          
        <router-outlet />

        @if (libraryStateService.showFilterModal()) {
          @if (headerMode() === 'history') {
            <app-history-filter-modal (close)="libraryStateService.showFilterModal.set(false)" />
          } @else {
            <app-library-filter-modal
              [context]="currentLibraryType()"
              (close)="libraryStateService.showFilterModal.set(false)" />
          }
        }
        </main>
      </div>
    </div>
  `
})
export class MainLayoutComponent implements OnInit, AfterViewInit {
  private router = inject(Router);
  public socialShare = inject(SocialShareService);
  private destroyRef = inject(DestroyRef);
  private settingsService = inject(SettingsService);
  private electronService = inject(ElectronService);
  private nav = inject(NavigationStackService);
  public libraryStateService = inject(LibraryStateService);
  public historyUi = inject(HistoryUiStateService);
  public annotationsUi = inject(AnnotationsUiStateService);
  public vocabularyUi = inject(VocabularyUiStateService);
  public home = inject(HomeDashboardService);
  private librarySearch = inject(LibrarySearchService);
  public mangaLibraryService = inject(MangaLibraryService);
  public bookLibraryService = inject(BookLibraryService);
  public languageService = inject(LanguageService);
  private ngZone = inject(NgZone);

  @ViewChild('navElement', { static: false }) navRef?: ElementRef<HTMLElement>;

  isExpanded = signal<boolean>(true);
  hasSidebarScroll = signal<boolean>(false);
  private navResizeObserver: ResizeObserver | null = null;
  private navScrollTimer: ReturnType<typeof setTimeout> | null = null;
  private isUpdatingCounts = false;
  LibraryViewType = LibraryViewType;
  headerMode = signal<HeaderMode>('home');
  appVersion = signal('…');
  currentPath = signal<string>('/');
  currentLibId = signal<string>('home');
  isSettingsSpinning = signal<boolean>(false);


  defaultMangaLibrary = signal<NavLibrary>({ id: 'manga-default', name: 'Biblioteca de Mangás', type: 'manga', icon: 'ico_manga', count: 0 });
  defaultBookLibrary = signal<NavLibrary>({ id: 'book-default', name: 'Biblioteca de Livros', type: 'book', icon: 'ico_book', count: 0 });
  customMangaLibraries = signal<NavLibrary[]>([]);
  customBookLibraries = signal<NavLibrary[]>([]);

  readonly currentLibraryType = computed<'manga' | 'book'>(() => {
    const id = this.currentLibId();
    if (id === 'book-default' || this.customBookLibraries().some(c => c.id === id)) {
      return 'book';
    }
    return 'manga';
  });

  readonly librarySearchScope = computed<LibrarySearchScope>(() =>
    this.currentLibraryType()
  );

  isHomeActive(): boolean {
    const p = this.currentPath();
    return (p === '/' || p === '') && this.currentLibId() === 'home';
  }

  isLibActive(libId: string): boolean {
    const p = this.currentPath();
    return (p === '/' || p === '') && this.currentLibId() === libId;
  }

  getNavMangaButtonClass(libId: string): string {
    return this.isLibActive(libId)
      ? 'manga-nav-active'
      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60';
  }

  getNavMangaBadgeClass(libId: string): string {
    return this.isLibActive(libId)
      ? 'manga-nav-badge-active'
      : 'bg-slate-800 text-slate-400';
  }

  getNavBookButtonClass(libId: string): string {
    return this.isLibActive(libId)
      ? 'book-nav-active'
      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60';
  }

  getNavBookBadgeClass(libId: string): string {
    return this.isLibActive(libId)
      ? 'book-nav-badge-active'
      : 'bg-slate-800 text-slate-400';
  }

  readonly headerTitle = computed(() => {
    const mode = this.headerMode();
    this.languageService.currentLang();
    if (mode === 'home') return this.languageService.t('nav.home');
    if (mode === 'library') return this.libraryStateService.activeLibrary().name;
    if (mode === 'history') return this.historyUi.pageTitle();
    if (mode === 'annotations') return this.annotationsUi.pageTitle();
    if (mode === 'vocabulary') return this.vocabularyUi.pageTitle();
    if (mode === 'settings') return this.languageService.t('nav.readerSettings');
    if (mode === 'help') return this.languageService.t('nav.help');
    if (mode === 'about') return this.languageService.t('nav.about');
    return this.titleOnlyLabel();
  });

  private titleOnlyLabel = signal('');

  readonly isLineView = computed(() => {
    const view = this.libraryStateService.currentView();
    return view === LibraryViewType.LINE || view === LibraryViewType.SEPARATOR_LINE;
  });

  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private isLongPressTriggered = false;

  onButtonPointerDown(action: 'view' | 'sort', event: PointerEvent): void {
    if (event.button !== 0) return;
    this.isLongPressTriggered = false;
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
    }
    this.longPressTimer = setTimeout(() => {
      this.isLongPressTriggered = true;
      this.libraryStateService.showFilterModal.set(true);
    }, 400);
  }

  onButtonPointerUp(action: 'view' | 'sort', event: PointerEvent): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  onButtonPointerCancel(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  onButtonClick(action: 'view' | 'sort', event: MouseEvent): void {
    if (this.isLongPressTriggered) {
      this.isLongPressTriggered = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (action === 'view') {
      const ctx = this.headerMode() === 'history'
        ? (this.historyUi.activeType() === 'BOOK' ? 'history-book' : 'history-manga')
        : this.currentLibraryType();
      this.libraryStateService.toggleViewMode(ctx);
    } else if (action === 'sort') {
      const ctx = this.headerMode() === 'history'
        ? (this.historyUi.activeType() === 'BOOK' ? 'history-book' : 'history-manga')
        : this.currentLibraryType();
      this.libraryStateService.toggleSortDirection(ctx);
    }
  }

  onButtonContextMenu(event: MouseEvent): void {
    event.preventDefault();
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.isLongPressTriggered = false;
    this.libraryStateService.showFilterModal.set(true);
  }

  onSettingsClick(): void {
    this.isSettingsSpinning.set(true);
    setTimeout(() => {
      this.isSettingsSpinning.set(false);
    }, 600);
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
      }
      if (this.navScrollTimer) {
        clearTimeout(this.navScrollTimer);
      }
    });

    effect(() => {
      this.languageService.currentLang();
      this.defaultMangaLibrary.update(l => ({ ...l, name: this.languageService.t('nav.mangaLibrary') }));
      this.defaultBookLibrary.update(l => ({ ...l, name: this.languageService.t('nav.bookLibrary') }));
    });

    // Efeito 1: Atualiza contagens quando configurações ou bibliotecas primárias mudarem
    effect(() => {
      this.settingsService.libraries();
      this.settingsService.mangaBasePath();
      this.settingsService.bookBasePath();
      this.mangaLibraryService.mangas();
      this.bookLibraryService.books();
      untracked(() => {
        void this.updateCounts();
      });
    });

    // Efeito 2: Ajuste de scroll da navegação lateral APENAS quando o estado de expansão mudar
    effect(() => {
      this.isExpanded();
      untracked(() => {
        this.checkNavScroll();
        if (this.navScrollTimer) {
          clearTimeout(this.navScrollTimer);
        }
        this.navScrollTimer = setTimeout(() => this.checkNavScroll(), 320);
      });
    });
  }

  ngOnInit(): void {
    void this.electronService.appGetInfo().then(info => {
      this.appVersion.set(info.version || '0.0.0');
    });

    if (window.electronAPI?.on) {
      window.electronAPI.on('manga:scan-status', (data: { status: string }) => {
        if (data?.status === 'FINISHED') {
          void this.updateCounts();
        }
      });
      window.electronAPI.on('book:scan-status', (data: { status: string }) => {
        if (data?.status === 'FINISHED') {
          void this.updateCounts();
        }
      });
    }

    this.applyRoute(this.router.url);
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(e => this.applyRoute(e.urlAfterRedirects || e.url));
  }

  ngAfterViewInit(): void {
    if (typeof ResizeObserver !== 'undefined' && this.navRef?.nativeElement) {
      this.navResizeObserver = new ResizeObserver(() => {
        this.ngZone.run(() => {
          this.checkNavScroll();
        });
      });
      this.navResizeObserver.observe(this.navRef.nativeElement);
    }

    const onWindowResize = () => {
      this.ngZone.run(() => {
        this.checkNavScroll();
      });
    };
    window.addEventListener('resize', onWindowResize, { passive: true });

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('resize', onWindowResize);
      if (this.navResizeObserver) {
        this.navResizeObserver.disconnect();
        this.navResizeObserver = null;
      }
    });

    setTimeout(() => this.checkNavScroll(), 50);
  }

  checkNavScroll(): void {
    const el = this.navRef?.nativeElement;
    if (!el) {
      this.hasSidebarScroll.set(false);
      return;
    }
    const overflows = el.scrollHeight > el.clientHeight + 1;
    if (this.hasSidebarScroll() !== overflows) {
      this.hasSidebarScroll.set(overflows);
    }
  }

  private applyRoute(url: string): void {
    const path = url.split('?')[0];
    const query = url.includes('?') ? url.split('?')[1] : '';
    const params = new URLSearchParams(query);
    const lib = params.get('lib') || 'home';

    const previousLib = this.currentLibId();
    this.currentPath.set(path);
    this.currentLibId.set(lib);

    if (previousLib !== lib) {
      this.libraryStateService.clearSearch();
    }

    if (path === '/' || path === '') {
      if (lib === 'home') {
        this.headerMode.set('home');
        void this.home.refresh();
      } else {
        this.headerMode.set('library');
      }
      this.libraryStateService.activeContext.set(this.currentLibraryType());
      return;
    }
    if (path === '/history' || path.startsWith('/statistics/history')) {
      this.headerMode.set('history');
      this.historyUi.fromStatistics.set(path.startsWith('/statistics/history'));
      this.libraryStateService.activeContext.set(
        this.historyUi.activeType() === 'BOOK' ? 'history-book' : 'history-manga'
      );
      this.librarySearch.historyContentType.set(this.historyUi.activeType());
      return;
    }
    if (path.startsWith('/annotations')) {
      this.headerMode.set('annotations');
      this.annotationsUi.bumpReload();
      return;
    }
    if (path.startsWith('/vocabulary')) {
      this.headerMode.set('vocabulary');
      this.vocabularyUi.bumpReload();
      return;
    }
    if (path.startsWith('/help')) {
      this.headerMode.set('help');
      return;
    }
    if (path.startsWith('/about')) {
      this.headerMode.set('about');
      return;
    }
    if (path.startsWith('/settings')) {
      this.headerMode.set('settings');
      return;
    }
    this.headerMode.set('titleOnly');
    if (path.startsWith('/trackers')) this.titleOnlyLabel.set(this.languageService.t('nav.trackers'));
    else if (path.startsWith('/statistics')) this.titleOnlyLabel.set(this.languageService.t('nav.statistics'));
    else if (path.startsWith('/detail')) this.titleOnlyLabel.set(this.languageService.t('nav.detail'));
    else this.titleOnlyLabel.set('Bilingual Reader');
  }

  onContinueReading(): void {
    const item = this.home.continueItem();
    if (!item?.fkReference) return;
    this.nav.openReader(
      this.router,
      item.type === 'MANGA' ? 'image' : 'text',
      item.fkReference
    );
  }

  onLibrarySearchRaw(value: string): void {
    this.libraryStateService.searchQuery.set(value);
  }

  onLibrarySearchCommit(value: string): void {
    this.libraryStateService.filterQuery.set(value);
  }

  onHistorySearchRaw(value: string): void {
    this.historyUi.setSearch(value);
  }

  onHistorySearchCommit(value: string): void {
    this.historyUi.setCommittedSearch(value);
  }

  onAnnotationsSearch(value: string): void {
    this.annotationsUi.setSearch(value);
  }

  onVocabularySearch(value: string): void {
    this.vocabularyUi.setSearch(value);
  }

  async updateCounts(): Promise<void> {
    if (this.isUpdatingCounts) return;
    this.isUpdatingCounts = true;
    try {
      const mangaPath = this.settingsService.mangaBasePath();
      const mangaDefCount = await this.electronService.getLibraryCount(mangaPath as any, 'MANGA');
      this.defaultMangaLibrary.update(l => ({ ...l, count: mangaDefCount }));

      const bookPath = this.settingsService.bookBasePath();
      const bookDefCount = await this.electronService.getLibraryCount(bookPath as any, 'BOOK');
      this.defaultBookLibrary.update(l => ({ ...l, count: bookDefCount }));

      const allCustom = this.settingsService.libraries();

      const customMangas: NavLibrary[] = [];
      for (const l of allCustom.filter(c => c.type === 'manga')) {
        const count = await this.electronService.getLibraryCount(l.path as any, 'MANGA');
        customMangas.push({ id: l.id, name: l.title, type: l.type, icon: 'ico_manga', count });
      }
      this.customMangaLibraries.set(customMangas);

      const customBooks: NavLibrary[] = [];
      for (const l of allCustom.filter(c => c.type === 'book')) {
        const count = await this.electronService.getLibraryCount(l.path as any, 'BOOK');
        customBooks.push({ id: l.id, name: l.title, type: l.type, icon: 'ico_book', count });
      }
      this.customBookLibraries.set(customBooks);

      this.checkNavScroll();
    } finally {
      this.isUpdatingCounts = false;
    }
  }

  async openLibrarySocialShare(): Promise<void> {
    const type = this.currentLibraryType() === 'book' ? 'BOOK' : 'MANGA';
    const libIdStr = this.currentLibId();
    let numericId: number | null = null;

    try {
      const dbLibs = await this.electronService.listLibrariesByType(type);
      if (dbLibs && dbLibs.length > 0) {
        if (libIdStr === 'manga-default' || libIdStr === 'book-default') {
          // Biblioteca padrão: procura a biblioteca com título 'Padrão' ou a primeira daquele tipo
          const defaultLib = dbLibs.find(l => l.title === 'Padrão') || dbLibs[0];
          if (defaultLib) numericId = defaultLib.id;
        } else if (libIdStr && libIdStr !== 'home') {
          // Biblioteca customizada: procura nas settings pelo ID para obter o path e cruzar com dbLibs
          const customLib = this.settingsService.libraries().find(l => l.id === libIdStr);
          if (customLib) {
            const matched = dbLibs.find(
              l => (l.path && customLib.path && l.path.toLowerCase().replace(/[\\/]/g, '/') === customLib.path.toLowerCase().replace(/[\\/]/g, '/')) ||
                   l.title === customLib.title
            );
            if (matched) numericId = matched.id;
          }
          if (numericId == null) {
            const parsed = parseInt(libIdStr, 10);
            if (!isNaN(parsed) && dbLibs.some(l => l.id === parsed)) {
              numericId = parsed;
            }
          }
        }
      }
    } catch (e) {
      console.error('Erro ao resolver ID da biblioteca para compartilhamento:', e);
    }

    this.socialShare.open({
      initialMediaType: type,
      initialLibraryId: numericId
    });
  }

  selectLibrary(lib: NavLibrary) {
    this.libraryStateService.clearSearch();
    this.currentPath.set('/');
    this.currentLibId.set(lib.id);
    this.libraryStateService.activeContext.set(lib.type === 'book' ? 'book' : 'manga');
    this.router.navigate(['/'], { queryParams: { lib: lib.id } });
  }

  getViewLabel(view: LibraryViewType): string {
    if (this.headerMode() === 'history') {
      switch (view) {
        case LibraryViewType.SEPARATOR_BIG: return this.languageService.t('enums.view.gridBig');
        case LibraryViewType.SEPARATOR_MEDIUM: return this.languageService.t('enums.view.gridMedium');
        case LibraryViewType.SEPARATOR_SMALL: return this.languageService.t('enums.view.gridSmall');
        case LibraryViewType.SEPARATOR_OVERLAY: return this.languageService.t('enums.view.gridOverlay');
        case LibraryViewType.SEPARATOR_CAROUSEL: return this.languageService.t('enums.view.carousel');
        case LibraryViewType.SEPARATOR_CAROUSEL_SMALL: return this.languageService.t('enums.view.carouselSmall');
        case LibraryViewType.SEPARATOR_LINE: return this.languageService.t('enums.view.lineDetailed');
        default: return this.languageService.t('enums.view.grid');
      }
    }

    switch (view) {
      case LibraryViewType.GRID_BIG: return this.languageService.t('enums.view.gridBig');
      case LibraryViewType.GRID_MEDIUM: return this.languageService.t('enums.view.gridMedium');
      case LibraryViewType.GRID_SMALL: return this.languageService.t('enums.view.gridSmall');
      case LibraryViewType.GRID_OVERLAY: return this.languageService.t('enums.view.gridOverlay');
      case LibraryViewType.CAROUSEL: return this.languageService.t('enums.view.carousel');
      case LibraryViewType.CAROUSEL_SMALL: return this.languageService.t('enums.view.carouselSmall');
      case LibraryViewType.SEPARATOR_BIG: return this.languageService.t('enums.view.separatorBig');
      case LibraryViewType.SEPARATOR_MEDIUM: return this.languageService.t('enums.view.separatorMedium');
      case LibraryViewType.SEPARATOR_SMALL: return this.languageService.t('enums.view.separatorSmall');
      case LibraryViewType.SEPARATOR_OVERLAY: return this.languageService.t('enums.view.separatorOverlay');
      case LibraryViewType.SEPARATOR_CAROUSEL: return this.languageService.t('enums.view.separatorCarousel');
      case LibraryViewType.SEPARATOR_CAROUSEL_SMALL: return this.languageService.t('enums.view.separatorCarouselSmall');
      case LibraryViewType.SEPARATOR_LINE: return this.languageService.t('enums.view.separatorLine');
      case LibraryViewType.LINE: return this.languageService.t('enums.view.lineDetailed');
      default: return this.languageService.t('enums.view.grid');
    }
  }
}
