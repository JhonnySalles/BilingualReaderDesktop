import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MangaLibraryService } from '../../../core/services/manga-library.service';
import { SettingsService } from '../../../core/services/settings.service';
import { MangaCardComponent } from './components/manga-card/manga-card.component';
import { MangaListItemComponent } from './components/manga-list-item/manga-list-item.component';
import { MangaFilterModalComponent } from './components/manga-filter-modal/manga-filter-modal.component';
import { LibraryViewType, OrderType } from '../../../core/models';

@Component({
  selector: 'app-manga-library',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MangaCardComponent,
    MangaListItemComponent,
    MangaFilterModalComponent
  ],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-6">
      
      <!-- Top Navigation & Controls Header -->
      <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Biblioteca de Mangás
          </h1>
          <p class="text-sm text-slate-400 mt-1">Gerencie e leia sua coleção local de mangás e quadrinhos</p>
        </div>

        <div class="flex items-center gap-3 w-full md:w-auto">
          
          <!-- Search Bar -->
          <div class="relative flex-1 md:w-64">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              [ngModel]="libraryService.searchQuery()" 
              (ngModelChange)="libraryService.searchQuery.set($event)"
              placeholder="Pesquisar título, autor..." 
              class="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/80 transition-all" />
          </div>

          <!-- Options & Filter Button -->
          <button 
            (click)="showModal.set(true)" 
            class="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-300 hover:text-white transition-all flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>

          <!-- Scan Folder Button -->
          <button 
            (click)="onScanClick()" 
            [disabled]="libraryService.isScanning()"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 flex-shrink-0">
            @if (libraryService.isScanning()) {
              <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Escaneando...
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Escanear Pasta
            }
          </button>

        </div>
      </header>

      <!-- Main Library Content -->
      <main class="flex-1">
        
        <!-- Empty State -->
        @if (filteredMangas().length === 0 && !libraryService.isScanning()) {
          <div class="flex flex-col items-center justify-center py-20 text-center">
            <div class="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-slate-200">Nenhum mangá encontrado</h3>
            <p class="text-sm text-slate-500 max-w-sm mt-1 mb-6">
              Sua biblioteca está vazia ou nenhum item corresponde ao filtro de busca.
            </p>
            <button (click)="libraryService.selectAndScanDirectory()" class="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-all">
              Selecionar pasta de mangás
            </button>
          </div>
        }

        <!-- Skeleton Loading State -->
        @if (libraryService.isScanning() && filteredMangas().length === 0) {
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5 animate-pulse">
            @for (i of [1,2,3,4,5,6]; track i) {
              <div class="bg-slate-900 rounded-xl overflow-hidden aspect-[2/3] border border-slate-800"></div>
            }
          </div>
        }

        <!-- Grid View Mode -->
        @if (filteredMangas().length > 0 && libraryService.currentView() !== LibraryViewType.LINE) {
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-5">
            @for (manga of filteredMangas(); track manga.id || manga.path) {
              <app-manga-card [manga]="manga"></app-manga-card>
            }
          </div>
        }

        <!-- List View Mode -->
        @if (filteredMangas().length > 0 && libraryService.currentView() === LibraryViewType.LINE) {
          <div class="flex flex-col gap-2">
            @for (manga of filteredMangas(); track manga.id || manga.path) {
              <app-manga-list-item [manga]="manga"></app-manga-list-item>
            }
          </div>
        }

      </main>

      <!-- Filter/Order Modal -->
      @if (showModal()) {
        <app-manga-filter-modal (close)="showModal.set(false)"></app-manga-filter-modal>
      }

    </div>
  `
})
export class MangaLibraryComponent implements OnInit {
  showModal = signal<boolean>(false);
  LibraryViewType = LibraryViewType;
  public settingsService = inject(SettingsService);

  constructor(public libraryService: MangaLibraryService) {}

  ngOnInit(): void {
    const basePath = this.settingsService.mangaBasePath();
    this.libraryService.loadMangas(basePath);
  }

  onScanClick(): void {
    const basePath = this.settingsService.mangaBasePath();
    this.libraryService.scanFolder(basePath);
  }

  // Computed Signal for Filtering and Sorting
  filteredMangas = computed(() => {
    let list = [...this.libraryService.mangas()];
    const query = this.libraryService.searchQuery().toLowerCase().trim();
    const order = this.libraryService.currentOrder();
    const isAsc = this.libraryService.isAscending();

    // Filter
    if (query) {
      list = list.filter(m => 
        m.title.toLowerCase().includes(query) ||
        m.author.toLowerCase().includes(query) ||
        m.series.toLowerCase().includes(query) ||
        m.genre.toLowerCase().includes(query)
      );
    }

    // Sort
    list.sort((a, b) => {
      let comparison = 0;
      switch (order) {
        case OrderType.Name:
          comparison = a.title.localeCompare(b.title);
          break;
        case OrderType.Date:
          comparison = (a.dateCreate || '').localeCompare(b.dateCreate || '');
          break;
        case OrderType.LastAccess:
          comparison = (a.lastAccess || '').localeCompare(b.lastAccess || '');
          break;
        case OrderType.Favorite:
          comparison = (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
          break;
        case OrderType.Author:
          comparison = a.author.localeCompare(b.author);
          break;
        case OrderType.Genre:
          comparison = a.genre.localeCompare(b.genre);
          break;
      }
      return isAsc ? comparison : -comparison;
    });

    return list;
  });
}
