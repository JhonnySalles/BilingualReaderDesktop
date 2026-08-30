import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ElectronService } from '../services/electron.service';
import { SettingsService } from '../services/settings.service';

interface NavLibrary {
  id: string;
  name: string;
  type: 'manga' | 'book';
  icon: string;
  count: number;
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="h-screen w-screen flex bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <!-- Sidebar Navigation -->
      <aside 
        [class.w-64]="isExpanded()" 
        [class.w-16]="!isExpanded()" 
        class="h-full shrink-0 bg-slate-900/90 backdrop-blur border-r border-slate-800 flex flex-col justify-between transition-all duration-300 z-30 select-none">
        
        <!-- Sidebar Top -->
        <div class="flex flex-col">
          <!-- Logo & Toggle -->
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

          <!-- Main Nav Links -->
          <nav class="p-2 space-y-1">
            <a 
              routerLink="/" 
              routerLinkActive="bg-indigo-600/15 text-indigo-400 font-semibold border-r-2 border-indigo-500" 
              [routerLinkActiveOptions]="{exact: true}"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
              <svg class="w-5 h-5 min-w-[1.25rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              @if (isExpanded()) { <span>Início / Biblioteca</span> }
            </a>

            <!-- Section 1: Manga Libraries -->
            <div class="my-2 border-t border-slate-800"></div>
            @if (isExpanded()) {
              <div class="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Mangás & Comics</span>
              </div>
            }

            <!-- Default Manga Library -->
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

            <!-- Custom Manga Libraries -->
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

            <!-- Section 2: Book Libraries -->
            <div class="my-2 border-t border-slate-800"></div>
            @if (isExpanded()) {
              <div class="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Livros & EPUBs</span>
              </div>
            }

            <!-- Default Book Library -->
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

            <!-- Custom Book Libraries -->
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

            <!-- Section 3: Navigation Sections (Reader Menu) -->
            <div class="my-2 border-t border-slate-800"></div>
            @if (isExpanded()) {
              <div class="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span>Menu do Leitor</span>
              </div>
            }

            <a 
              routerLink="/history"
              class="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
              <svg class="w-5 h-5 min-w-[1.25rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              @if (isExpanded()) { <span>Histórico de Leitura</span> }
            </a>

            <a 
              routerLink="/vocabulary"
              class="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
              <svg class="w-5 h-5 min-w-[1.25rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              @if (isExpanded()) { <span>Vocabulário & Anotações</span> }
            </a>

            <a 
              routerLink="/statistics"
              class="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer">
              <svg class="w-5 h-5 min-w-[1.25rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              @if (isExpanded()) { <span>Estatísticas de Uso</span> }
            </a>
          </nav>
        </div>

        <!-- Sidebar Bottom Settings -->
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

      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <!-- Top Header Bar -->
        <header class="h-16 px-6 bg-slate-900/60 backdrop-blur border-b border-slate-800/80 flex items-center justify-between select-none">
          <div class="flex items-center gap-4">
            <h2 class="text-base font-bold text-slate-100">Bilingual Reader Desktop</h2>
          </div>

          <!-- Right Status Bar -->
          <div class="flex items-center gap-4">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-2"></span>
              SQLite & Electron OK
            </span>
          </div>
        </header>

        <!-- Router Outlet Container -->
        <main class="flex-1 overflow-hidden relative">
          <router-outlet />
        </main>
      </div>
    </div>
  `
})
export class MainLayoutComponent {
  private router = inject(Router);
  private settingsService = inject(SettingsService);

  isExpanded = signal<boolean>(true);

  // Default Libraries
  defaultMangaLibrary = signal<NavLibrary>({ id: 'manga-default', name: 'Biblioteca', type: 'manga', icon: 'ico_manga', count: 0 });
  defaultBookLibrary = signal<NavLibrary>({ id: 'book-default', name: 'Biblioteca', type: 'book', icon: 'ico_book', count: 0 });

  // Dynamic Custom Libraries mapped from SettingsService
  customMangaLibraries = computed<NavLibrary[]>(() => {
    return this.settingsService.libraries()
      .filter(l => l.type === 'manga')
      .map(l => ({
        id: l.id,
        name: l.title,
        type: l.type,
        icon: 'ico_manga',
        count: 0
      }));
  });

  customBookLibraries = computed<NavLibrary[]>(() => {
    return this.settingsService.libraries()
      .filter(l => l.type === 'book')
      .map(l => ({
        id: l.id,
        name: l.title,
        type: l.type,
        icon: 'ico_book',
        count: 0
      }));
  });

  selectLibrary(lib: NavLibrary) {
    this.router.navigate(['/'], { queryParams: { lib: lib.id } });
  }
}
