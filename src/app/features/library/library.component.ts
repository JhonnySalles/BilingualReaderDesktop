import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LibraryStateService } from '../../core/services/library-state.service';
import { MangaLibraryService } from '../../core/services/manga-library.service';
import { BookLibraryService } from '../../core/services/book-library.service';
import { SettingsService } from '../../core/services/settings.service';
import { NavigationStackService } from '../../core/services/navigation-stack.service';
import { SharedListComponent } from './components/shared-list/shared-list.component';
import { MangaFilterModalComponent } from './manga-library/components/manga-filter-modal/manga-filter-modal.component';
import { Manga, Book, OrderType } from '../../core/models';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SharedListComponent,
    MangaFilterModalComponent
  ],
  template: `
    <div class="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden p-6 relative">
      
      <!-- Filter Modal -->
      @if (libraryStateService.showFilterModal()) {
        <app-manga-filter-modal (close)="libraryStateService.showFilterModal.set(false)"></app-manga-filter-modal>
      }

      <!-- HOME DASHBOARD VIEW (when no library selected or lib === 'home') -->
      @if (activeLibId() === 'home') {
        <div class="flex-1 overflow-y-auto space-y-8">
          
          <!-- Hero Banner -->
          <div class="relative rounded-2xl bg-gradient-to-r from-indigo-900/40 via-slate-900 to-purple-900/30 p-8 border border-slate-800 shadow-xl overflow-hidden">
            <div class="relative z-10 max-w-xl">
              <h2 class="text-2xl font-extrabold text-white tracking-tight">Bem-vindo ao Bilingual Reader</h2>
              <p class="text-sm text-slate-300 mt-2 leading-relaxed">
                Selecione uma biblioteca no menu lateral ou abaixo para gerenciar e ler sua coleção de mangás, quadrinhos e livros digitais.
              </p>
            </div>
            <div class="absolute -right-6 -bottom-6 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
          </div>

          <!-- Section: Active Libraries Overview -->
          <div>
            <h3 class="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
              Suas Bibliotecas Cadastradas
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <!-- Default Manga Card -->
              <a [routerLink]="['/']" [queryParams]="{ lib: 'manga-default' }" class="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all cursor-pointer flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    🎨
                  </div>
                  <div>
                    <h4 class="text-base font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">Biblioteca de Mangás</h4>
                    <p class="text-xs text-slate-400 mt-0.5">{{ mangaLibraryService.mangas().length }} itens cadastrados</p>
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </a>

              <!-- Default Book Card -->
              <a [routerLink]="['/']" [queryParams]="{ lib: 'book-default' }" class="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/80 transition-all cursor-pointer flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    📚
                  </div>
                  <div>
                    <h4 class="text-base font-bold text-slate-100 group-hover:text-amber-400 transition-colors">Biblioteca de Livros</h4>
                    <p class="text-xs text-slate-400 mt-0.5">{{ bookLibraryService.books().length }} itens cadastrados</p>
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </a>

              <!-- Custom Libraries -->
              @for (lib of settingsService.libraries(); track lib.id) {
                <a [routerLink]="['/']" [queryParams]="{ lib: lib.id }" class="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all cursor-pointer flex items-center justify-between">
                  <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                      {{ lib.type === 'manga' ? '🎨' : '📚' }}
                    </div>
                    <div>
                      <h4 class="text-base font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">{{ lib.title }}</h4>
                      <p class="text-xs text-slate-400 mt-0.5">Biblioteca Personalizada</p>
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              }
            </div>
          </div>
        </div>
      }

      <!-- LIBRARY CONTENT VIEW -->
      @if (activeLibId() !== 'home') {
        <div class="flex-1 flex flex-col min-h-0 overflow-y-auto">
          
          <!-- Library Actions Bar -->
          <div class="flex justify-between items-center mb-6">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
                {{ filteredItems().length }} itens encontrados
              </span>
            </div>

            <button 
              (click)="onScanClick()" 
              [disabled]="isCurrentlyScanning()"
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2">
              @if (isCurrentlyScanning()) {
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

          <!-- Empty State -->
          @if (filteredItems().length === 0 && !isCurrentlyScanning()) {
            <div class="flex flex-col items-center justify-center py-20 text-center flex-1">
              <div class="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-slate-200">Nenhum item encontrado</h3>
              <p class="text-sm text-slate-500 max-w-sm mt-1 mb-6">
                Sua biblioteca está vazia ou nenhum item corresponde ao termo pesquisado.
              </p>
            </div>
          } @else {
            <app-shared-list 
              [items]="filteredItems()" 
              [type]="activeLibType()"
              [isLoading]="isCurrentlyScanning() && filteredItems().length === 0"
              (reordered)="onReordered($event)"
              (open)="onOpenItem($event)"
              (openDetail)="onOpenDetail($event)">
            </app-shared-list>
          }
        </div>
      }

      <!-- FOOTER INDETERMINATE PROGRESS BAR -->
      @if (isCurrentlyScanning()) {
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 overflow-hidden z-50">
          <div class="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-indeterminate"></div>
        </div>
      }

    </div>
  `
})
export class LibraryComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private nav = inject(NavigationStackService);
  public libraryStateService = inject(LibraryStateService);
  public mangaLibraryService = inject(MangaLibraryService);
  public bookLibraryService = inject(BookLibraryService);
  public settingsService = inject(SettingsService);

  activeLibId = signal<string>('home');
  activeLibType = signal<'manga' | 'book'>('manga');
  customOrderItems = signal<(Manga | Book)[] | null>(null);

  isCurrentlyScanning = computed(() => {
    return this.mangaLibraryService.isScanning() || this.bookLibraryService.isScanning();
  });

  ngOnInit(): void {
    this.route.queryParams.subscribe(async params => {
      const libId = params['lib'] || 'home';
      this.activeLibId.set(libId);
      this.customOrderItems.set(null); // Reset manual reorder on lib change
      this.nav.rememberLibrary(libId);

      let pathToScan = '';

      if (libId === 'home') {
        this.libraryStateService.activeContext.set('manga');
        this.libraryStateService.activeLibrary.set({
          id: 'home',
          name: 'Início',
          type: 'manga',
          count: 0
        });
        this.mangaLibraryService.loadMangas();
        this.bookLibraryService.loadBooks();
      } else if (libId === 'manga-default') {
        this.activeLibType.set('manga');
        this.libraryStateService.activeContext.set('manga');
        pathToScan = this.settingsService.mangaBasePath();
        this.libraryStateService.activeLibrary.set({
          id: 'manga-default',
          name: 'Biblioteca de Mangás',
          type: 'manga',
          count: this.mangaLibraryService.mangas().length
        });
        await this.mangaLibraryService.loadMangas(pathToScan);
        this.onScanClick();
      } else if (libId === 'book-default') {
        this.activeLibType.set('book');
        this.libraryStateService.activeContext.set('book');
        pathToScan = this.settingsService.bookBasePath();
        this.libraryStateService.activeLibrary.set({
          id: 'book-default',
          name: 'Biblioteca de Livros',
          type: 'book',
          count: this.bookLibraryService.books().length
        });
        await this.bookLibraryService.loadBooks(pathToScan);
        this.onScanClick();
      } else {
        const found = this.settingsService.libraries().find(l => l.id === libId);
        if (found) {
          this.activeLibType.set(found.type);
          this.libraryStateService.activeContext.set(found.type);
          pathToScan = found.path;
          this.libraryStateService.activeLibrary.set({
            id: found.id,
            name: found.title,
            type: found.type,
            count: 0
          });
          if (found.type === 'manga') {
            await this.mangaLibraryService.loadMangas(pathToScan);
          } else {
            await this.bookLibraryService.loadBooks(pathToScan);
          }
          this.onScanClick();
        }
      }
    });
  }

  onScanClick(): void {
    let pathToScan = '';
    const libId = this.activeLibId();

    if (libId === 'manga-default') {
      pathToScan = this.settingsService.mangaBasePath();
    } else if (libId === 'book-default') {
      pathToScan = this.settingsService.bookBasePath();
    } else {
      const found = this.settingsService.libraries().find(l => l.id === libId);
      if (found) {
        pathToScan = found.path;
      }
    }

    if (this.activeLibType() === 'manga') {
      this.mangaLibraryService.scanFolder(pathToScan);
    } else {
      this.bookLibraryService.scanFolder(pathToScan);
    }
  }

  filteredItems = computed(() => {
    if (this.customOrderItems()) {
      return this.customOrderItems()!;
    }

    let list: (Manga | Book)[] = this.activeLibType() === 'manga'
      ? [...this.mangaLibraryService.mangas()]
      : [...this.bookLibraryService.books()];

    const query = this.libraryStateService.searchQuery().toLowerCase().trim();
    const order = this.libraryStateService.currentOrder();
    const isAsc = this.libraryStateService.isAscending();

    if (query) {
      list = list.filter(item => 
        item.title.toLowerCase().includes(query) ||
        (item.author && item.author.toLowerCase().includes(query)) ||
        (item.series && item.series.toLowerCase().includes(query))
      );
    }

    list.sort((a, b) => {
      let comparison = 0;
      switch (order) {
        case OrderType.Name:
          comparison = a.title.localeCompare(b.title);
          break;
        case OrderType.Date:
          comparison = ((a as any).dateCreate || '').localeCompare((b as any).dateCreate || '');
          break;
        case OrderType.LastAccess:
          comparison = ((a as any).lastAccess || '').localeCompare((b as any).lastAccess || '');
          break;
        case OrderType.Favorite:
          comparison = (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
          break;
        case OrderType.Author:
          comparison = (a.author || '').localeCompare(b.author || '');
          break;
      }
      return isAsc ? comparison : -comparison;
    });

    return list;
  });

  onReordered(newOrder: (Manga | Book)[]) {
    this.customOrderItems.set(newOrder);
  }

  onOpenItem(item: Manga | Book): void {
    if (!item.id) return;
    if (this.activeLibType() === 'manga') {
      this.nav.openReader(this.router, 'image', item.id);
    } else {
      this.nav.openReader(this.router, 'text', item.id);
    }
  }

  onOpenDetail(item: Manga | Book): void {
    if (!item.id) return;
    if (this.activeLibType() === 'manga') {
      this.nav.openDetail(this.router, 'manga', item.id);
    } else {
      this.nav.openDetail(this.router, 'book', item.id);
    }
  }
}
