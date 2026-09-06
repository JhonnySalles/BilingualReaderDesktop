import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ElectronService } from '../services/electron.service';
import { SettingsService } from '../services/settings.service';
import { LibraryStateService } from '../services/library-state.service';
import { HistoryUiStateService } from '../services/history-ui-state.service';
import { HomeDashboardService } from '../services/home-dashboard.service';
import { NavigationStackService } from '../services/navigation-stack.service';
import { LibraryViewType } from '../models';

interface NavLibrary {
  id: string;
  name: string;
  type: 'manga' | 'book';
  icon: string;
  count: number;
}

type HeaderMode = 'home' | 'library' | 'history' | 'settings' | 'titleOnly';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="h-screen w-screen flex bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <aside
        [class.w-64]="isExpanded()"
        [class.w-16]="!isExpanded()"
        class="h-full shrink-0 bg-slate-900/90 backdrop-blur border-r border-slate-800 flex flex-col justify-between transition-all duration-300 z-30 select-none">

        <div class="flex flex-col">
          <div class="h-16 px-4 flex items-center justify-between border-b border-slate-800">
            <div class="flex items-center gap-3 overflow-hidden">
              <div class="w-9 h-9 min-w-[2.25rem] rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-600/30">
                B
              </div>
              @if (isExpanded()) {
                <div class="truncate">
                  <h1 class="text-sm font-bold tracking-wide leading-none text-slate-100">Bilingual Reader</h1>
                  <span class="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">Desktop v1.0</span>
                </div>
              }
            </div>

            <button
              (click)="isExpanded.set(!isExpanded())"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Expandir / Recolher Menu">
              <svg class="w-5 h-5 transition-transform duration-300" [class.rotate-180]="!isExpanded()" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>

          <nav class="p-2 space-y-1">
            <a
              routerLink="/"
              [queryParams]="{ lib: 'home' }"
              routerLinkActive="bg-indigo-600/15 text-indigo-400 font-semibold border-r-2 border-indigo-500"
              [routerLinkActiveOptions]="{exact: true}"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
              <svg class="w-5 h-5 min-w-[1.25rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              @if (isExpanded()) { <span>Início</span> }
            </a>

            <div class="my-2 border-t border-slate-800"></div>
            @if (isExpanded()) {
              <div class="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Mangás & Comics</span>
              </div>
            }

            <button
              (click)="selectLibrary(defaultMangaLibrary())"
              class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
              <div class="flex items-center gap-3 overflow-hidden">
                <span class="text-base min-w-[1.25rem] text-center">🎨</span>
                @if (isExpanded()) { <span class="truncate font-medium">{{ defaultMangaLibrary().name }}</span> }
              </div>
              @if (isExpanded()) {
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{{ defaultMangaLibrary().count }}</span>
              }
            </button>

            @for (lib of customMangaLibraries(); track lib.id) {
              <button
                (click)="selectLibrary(lib)"
                class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
                <div class="flex items-center gap-3 overflow-hidden">
                  <span class="text-base min-w-[1.25rem] text-center">🎨</span>
                  @if (isExpanded()) { <span class="truncate">{{ lib.name }}</span> }
                </div>
                @if (isExpanded()) {
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{{ lib.count }}</span>
                }
              </button>
            }

            <div class="my-2 border-t border-slate-800"></div>
            @if (isExpanded()) {
              <div class="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Livros & EPUBs</span>
              </div>
            }

            <button
              (click)="selectLibrary(defaultBookLibrary())"
              class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
              <div class="flex items-center gap-3 overflow-hidden">
                <span class="text-base min-w-[1.25rem] text-center">📚</span>
                @if (isExpanded()) { <span class="truncate font-medium">{{ defaultBookLibrary().name }}</span> }
              </div>
              @if (isExpanded()) {
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{{ defaultBookLibrary().count }}</span>
              }
            </button>

            @for (lib of customBookLibraries(); track lib.id) {
              <button
                (click)="selectLibrary(lib)"
                class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
                <div class="flex items-center gap-3 overflow-hidden">
                  <span class="text-base min-w-[1.25rem] text-center">📚</span>
                  @if (isExpanded()) { <span class="truncate">{{ lib.name }}</span> }
                </div>
                @if (isExpanded()) {
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{{ lib.count }}</span>
                }
              </button>
            }

            <div class="my-2 border-t border-slate-800"></div>
            @if (isExpanded()) {
              <div class="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span>Menu do Leitor</span>
              </div>
            }

            <a
              routerLink="/history"
              routerLinkActive="bg-indigo-600/15 text-indigo-400 font-semibold border-r-2 border-indigo-500"
              class="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
              <svg class="w-5 h-5 min-w-[1.25rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              @if (isExpanded()) { <span>Histórico de Leitura</span> }
            </a>

            <a
              routerLink="/vocabulary"
              routerLinkActive="bg-indigo-600/15 text-indigo-400 font-semibold border-r-2 border-indigo-500"
              class="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
              <svg class="w-5 h-5 min-w-[1.25rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              @if (isExpanded()) { <span>Vocabulário & Anotações</span> }
            </a>

            <a
              routerLink="/statistics"
              routerLinkActive="bg-indigo-600/15 text-indigo-400 font-semibold border-r-2 border-indigo-500"
              [routerLinkActiveOptions]="{ exact: false }"
              class="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
              <svg class="w-5 h-5 min-w-[1.25rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              @if (isExpanded()) { <span>Estatísticas de Uso</span> }
            </a>
          </nav>
        </div>

        <div class="p-2 border-t border-slate-800">
          <a
            routerLink="/settings"
            routerLinkActive="bg-indigo-600/15 text-indigo-400 font-semibold border-r-2 border-indigo-500"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
            <svg class="w-5 h-5 min-w-[1.25rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            @if (isExpanded()) { <span>Configurações</span> }
          </a>
        </div>
      </aside>

      <div class="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header class="h-16 px-6 bg-slate-900/60 backdrop-blur border-b border-slate-800/80 flex items-center justify-between gap-4 select-none">

          <div class="flex items-center gap-3 min-w-0">
            @if (headerMode() === 'history' && historyUi.fromStatistics()) {
              <a routerLink="/statistics" class="p-2 text-slate-400 hover:text-slate-200 rounded-lg transition-colors shrink-0">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                </svg>
              </a>
            }
            @if (headerMode() === 'settings') {
              <div class="flex items-center gap-3 min-w-0">
                <h2 class="text-lg font-bold text-slate-100 truncate">Configurações do Leitor</h2>
                <span class="text-xs text-slate-400 truncate hidden sm:inline">Portado do aplicativo nativo Android</span>
              </div>
            } @else {
              <h2 class="text-lg font-bold text-slate-100 truncate">
                {{ headerTitle() }}
              </h2>
            }
          </div>

          @if (headerMode() === 'home') {
            <div class="flex items-center gap-3 shrink-0">
              <button
                type="button"
                (click)="onContinueReading()"
                [disabled]="!home.continueItem()"
                class="max-w-[16rem] sm:max-w-xs text-left px-3 py-1.5 rounded-xl border transition-all cursor-pointer
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-slate-800
                  bg-indigo-600/15 border-indigo-500/40 hover:bg-indigo-600/25 hover:border-indigo-400/60
                  flex items-center gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-indigo-300">Continuar</span>
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
                      Nenhuma leitura recente
                    }
                  </p>
                </div>
                <svg class="w-4 h-4 shrink-0 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </button>
            </div>
          }

          @if (headerMode() === 'library') {
            <div class="flex items-center gap-3 shrink-0">
              <div class="relative w-48 sm:w-64">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  [ngModel]="libraryStateService.searchQuery()"
                  (ngModelChange)="libraryStateService.searchQuery.set($event)"
                  placeholder="Pesquisar..."
                  class="w-full pl-9 pr-4 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/80 transition-all" />
              </div>

              <button
                (click)="libraryStateService.toggleViewMode()"
                class="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-90 active:rotate-12 rounded-xl text-slate-300 hover:text-white transition-all duration-200 flex items-center justify-center cursor-pointer shadow-sm hover:shadow-indigo-500/10"
                [title]="'Modo Atual: ' + getViewLabel(libraryStateService.currentView())">
                @switch (libraryStateService.currentView()) {
                  @case (LibraryViewType.GRID_BIG) {
                    <!-- Grid Big: 4 large tiles -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1h-5a1 1 0 01-1-1V5zM4 14a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zM14 14a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1h-5a1 1 0 01-1-1v-5z" />
                    </svg>
                  }
                  @case (LibraryViewType.GRID_MEDIUM) {
                    <!-- Grid Medium: 9 smaller grid blocks -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  }
                  @case (LibraryViewType.GRID_OVERLAY) {
                    <!-- Grid Blur / Overlay: Card with blur layer / image icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_BIG) {
                    <!-- Big with Separator: Header bar on top + large grid blocks -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M4 9h6v10H4zm10 0h6v10h-6z" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_MEDIUM) {
                    <!-- Medium with Separator: Header bar on top + 4 grid blocks -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M4 8h5v5H4zm11 0h5v5h-5zM4 15h5v5H4zm11 0h5v5h-5z" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_OVERLAY) {
                    <!-- Blur with Separator: Header bar + image overlay card -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M4 8h16v12H4zM4 16h16" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_LINE) {
                    <!-- Line with Separator: Header bar + horizontal items -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M4 9h16M4 14h16M4 19h16" />
                    </svg>
                  }
                  @case (LibraryViewType.LINE) {
                    <!-- Line: clean list lines -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  }
                  @default {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  }
                }
              </button>

              <button
                (click)="libraryStateService.toggleSortDirection()"
                class="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-300 hover:text-white transition-all flex items-center justify-center cursor-pointer"
                [title]="libraryStateService.isAscending() ? 'Ordem Crescente (A-Z)' : 'Ordem Decrescente (Z-A)'">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 transition-transform duration-300" [class.rotate-180]="!libraryStateService.isAscending()" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
              </button>

              <button
                (click)="libraryStateService.showFilterModal.set(true)"
                class="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-300 hover:text-white transition-all flex items-center justify-center cursor-pointer"
                title="Filtros e Opções">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </button>
            </div>
          }

          @if (headerMode() === 'history') {
            <div class="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap justify-end">
              <div class="relative w-40 sm:w-52">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  [ngModel]="historyUi.search()"
                  (ngModelChange)="onHistorySearch($event)"
                  placeholder="Pesquisar..."
                  class="w-full pl-9 pr-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-all" />
              </div>

              <select
                class="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200"
                [ngModel]="historyUi.year()"
                (ngModelChange)="historyUi.setYear($event)">
                <option [ngValue]="null">Todos os anos</option>
                @for (y of historyUi.years(); track y) {
                  <option [ngValue]="y">{{ y }}</option>
                }
              </select>

              <select
                class="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 max-w-[10rem]"
                [ngModel]="historyUi.libraryId()"
                (ngModelChange)="historyUi.setLibrary($event)">
                <option [ngValue]="null">Todas as bibliotecas</option>
                @for (lib of historyUi.libraries(); track lib.id) {
                  <option [ngValue]="lib.id">{{ lib.title }}</option>
                }
              </select>

              <div class="flex items-center gap-1 bg-slate-950/60 border border-slate-800 rounded-xl p-1">
                <button
                  type="button"
                  (click)="historyUi.setType('MANGA')"
                  class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  [class.bg-indigo-600]="historyUi.activeType() === 'MANGA'"
                  [class.text-white]="historyUi.activeType() === 'MANGA'"
                  [class.text-slate-400]="historyUi.activeType() !== 'MANGA'">
                  Mangá
                </button>
                <button
                  type="button"
                  (click)="historyUi.setType('BOOK')"
                  class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  [class.bg-amber-600]="historyUi.activeType() === 'BOOK'"
                  [class.text-white]="historyUi.activeType() === 'BOOK'"
                  [class.text-slate-400]="historyUi.activeType() !== 'BOOK'">
                  Livro
                </button>
              </div>

              <button
                (click)="libraryStateService.toggleViewMode()"
                (contextmenu)="libraryStateService.showFilterModal.set(true); $event.preventDefault()"
                class="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-90 active:rotate-12 rounded-xl text-slate-300 hover:text-white transition-all duration-200 flex items-center justify-center cursor-pointer shadow-sm hover:shadow-indigo-500/10"
                [title]="'Modo Atual: ' + getViewLabel(libraryStateService.currentView())">
                @switch (libraryStateService.currentView()) {
                  @case (LibraryViewType.GRID_BIG) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1h-5a1 1 0 01-1-1V5zM4 14a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zM14 14a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1h-5a1 1 0 01-1-1v-5z" />
                    </svg>
                  }
                  @case (LibraryViewType.GRID_MEDIUM) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  }
                  @case (LibraryViewType.GRID_OVERLAY) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_BIG) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M4 9h6v10H4zm10 0h6v10h-6z" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_MEDIUM) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M4 8h5v5H4zm11 0h5v5h-5zM4 15h5v5H4zm11 0h5v5h-5z" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_OVERLAY) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M4 8h16v12H4zM4 16h16" />
                    </svg>
                  }
                  @case (LibraryViewType.SEPARATOR_LINE) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M4 9h16M4 14h16M4 19h16" />
                    </svg>
                  }
                  @case (LibraryViewType.LINE) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  }
                  @default {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  }
                }
              </button>

              <button
                (click)="libraryStateService.toggleSortDirection()"
                (contextmenu)="libraryStateService.showFilterModal.set(true); $event.preventDefault()"
                class="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-300 hover:text-white transition-all flex items-center justify-center cursor-pointer"
                [title]="libraryStateService.isAscending() ? 'Ordem Crescente' : 'Ordem Decrescente'">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 transition-transform duration-300" [class.rotate-180]="!libraryStateService.isAscending()" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
              </button>
            </div>
          }

          @if (headerMode() === 'settings') {
            <div class="flex items-center gap-2 shrink-0">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Configurações Salvas
              </span>
            </div>
          }
        </header>

        <main class="flex-1 overflow-hidden relative">
          <router-outlet />
        </main>
      </div>
    </div>
  `
})
export class MainLayoutComponent implements OnInit {
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private settingsService = inject(SettingsService);
  private electronService = inject(ElectronService);
  private nav = inject(NavigationStackService);
  public libraryStateService = inject(LibraryStateService);
  public historyUi = inject(HistoryUiStateService);
  public home = inject(HomeDashboardService);

  isExpanded = signal<boolean>(true);
  LibraryViewType = LibraryViewType;
  headerMode = signal<HeaderMode>('home');

  defaultMangaLibrary = signal<NavLibrary>({ id: 'manga-default', name: 'Biblioteca de Mangás', type: 'manga', icon: 'ico_manga', count: 0 });
  defaultBookLibrary = signal<NavLibrary>({ id: 'book-default', name: 'Biblioteca de Livros', type: 'book', icon: 'ico_book', count: 0 });
  customMangaLibraries = signal<NavLibrary[]>([]);
  customBookLibraries = signal<NavLibrary[]>([]);

  readonly headerTitle = computed(() => {
    const mode = this.headerMode();
    if (mode === 'home') return 'Início';
    if (mode === 'library') return this.libraryStateService.activeLibrary().name;
    if (mode === 'history') return this.historyUi.pageTitle();
    if (mode === 'settings') return 'Configurações do Leitor';
    return this.titleOnlyLabel();
  });

  private titleOnlyLabel = signal('Início');

  readonly isLineView = computed(() => {
    const view = this.libraryStateService.currentView();
    return view === LibraryViewType.LINE || view === LibraryViewType.SEPARATOR_LINE;
  });

  constructor() {
    this.updateCounts();
  }

  ngOnInit(): void {
    this.applyRoute(this.router.url);
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(e => this.applyRoute(e.urlAfterRedirects || e.url));
  }

  private applyRoute(url: string): void {
    const path = url.split('?')[0];
    const query = url.includes('?') ? url.split('?')[1] : '';
    const params = new URLSearchParams(query);
    const lib = params.get('lib') || 'home';

    if (path === '/' || path === '') {
      if (lib === 'home') {
        this.headerMode.set('home');
        void this.home.refresh();
      } else {
        this.headerMode.set('library');
      }
      this.libraryStateService.activeContext.set(
        this.libraryStateService.activeLibrary().type === 'book' ? 'book' : 'manga'
      );
      return;
    }
    if (path === '/history' || path.startsWith('/statistics/history')) {
      this.headerMode.set('history');
      this.historyUi.fromStatistics.set(path.startsWith('/statistics/history'));
      this.libraryStateService.activeContext.set(
        this.historyUi.activeType() === 'BOOK' ? 'history-book' : 'history-manga'
      );
      return;
    }
    if (path.startsWith('/settings')) {
      this.headerMode.set('settings');
      return;
    }
    this.headerMode.set('titleOnly');
    if (path.startsWith('/statistics')) this.titleOnlyLabel.set('Estatísticas de Uso');
    else if (path.startsWith('/vocabulary')) this.titleOnlyLabel.set('Vocabulário e Anotações');
    else if (path.startsWith('/detail')) this.titleOnlyLabel.set('Detalhe');
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

  onHistorySearch(value: string): void {
    this.historyUi.setSearch(value);
  }

  async updateCounts(): Promise<void> {
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
  }

  selectLibrary(lib: NavLibrary) {
    this.router.navigate(['/'], { queryParams: { lib: lib.id } });
  }

  getViewLabel(view: LibraryViewType): string {
    switch (view) {
      case LibraryViewType.GRID_BIG: return 'Grid Grande';
      case LibraryViewType.GRID_MEDIUM: return 'Grid Médio';
      case LibraryViewType.GRID_OVERLAY: return 'Grid Blur (Overlay)';
      case LibraryViewType.SEPARATOR_BIG: return 'Grande c/ Separador';
      case LibraryViewType.SEPARATOR_MEDIUM: return 'Médio c/ Separador';
      case LibraryViewType.SEPARATOR_OVERLAY: return 'Grid Blur c/ Separador';
      case LibraryViewType.SEPARATOR_LINE: return 'Linha c/ Separador';
      case LibraryViewType.LINE: return 'Linha Detalhada';
      default: return 'Grade';
    }
  }
}
