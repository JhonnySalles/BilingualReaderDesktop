import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LibraryStateService } from '../../core/services/library-state.service';
import { MangaLibraryService } from '../../core/services/manga-library.service';
import { BookLibraryService } from '../../core/services/book-library.service';
import { SettingsService } from '../../core/services/settings.service';
import { ElectronService } from '../../core/services/electron.service';
import { NavigationStackService } from '../../core/services/navigation-stack.service';
import { HomeDashboardService } from '../../core/services/home-dashboard.service';
import { LibrarySearchService } from '../../core/services/library-search.service';
import { ShareMarkUiService } from '../../core/services/sharemark/share-mark-ui.service';
import { SharedListComponent } from './components/shared-list/shared-list.component';
import { MangaFilterModalComponent } from './manga-library/components/manga-filter-modal/manga-filter-modal.component';
import { HomeRecentCardComponent } from './components/home-recent-card/home-recent-card.component';
import { HomeReadingHeatmapComponent } from './components/home-reading-heatmap/home-reading-heatmap.component';
import {
  LibraryBookmarkDialogComponent,
  LibraryBookmarkPayload
} from '../../shared/library-bookmark-dialog/library-bookmark-dialog.component';
import { TrackerSimpleDialogComponent } from '../../shared/tracker-simple-dialog/tracker-simple-dialog.component';
import { TrackerConfigDialogComponent } from '../../shared/tracker-config-dialog/tracker-config-dialog.component';
import { Manga, Book, Track, OrderType, HomeRecentItem } from '../../core/models';
import { ShareMarkType } from '../../core/models/enums/sharemark.enum';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SharedListComponent,
    MangaFilterModalComponent,
    HomeRecentCardComponent,
    HomeReadingHeatmapComponent,
    LibraryBookmarkDialogComponent,
    TrackerSimpleDialogComponent,
    TrackerConfigDialogComponent
  ],
  template: `
    <div class="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden p-6 relative">
      
      @if (libraryStateService.showFilterModal()) {
        <app-manga-filter-modal (close)="libraryStateService.showFilterModal.set(false)"></app-manga-filter-modal>
      }

      <app-library-bookmark-dialog
        [open]="!!bookmarkTarget()"
        [type]="activeLibType()"
        [filePath]="bookmarkTarget()?.path"
        [accent]="activeLibType() === 'book' ? 'amber' : 'indigo'"
        [title]="bookmarkTarget()?.title || ''"
        [maxPages]="bookmarkTarget()?.pages || 1"
        [pageValue]="bookmarkTarget()?.bookMark || 0"
        [lastAccess]="bookmarkTarget()?.lastAccess"
        [completed]="!!bookmarkTarget()?.completed"
        (confirm)="onBookmarkSave($event)"
        (cancel)="bookmarkTarget.set(null)" />

      <app-tracker-simple-dialog
        [open]="showTrackerModal() && !!trackerTarget()"
        [libraryId]="trackerTarget()?.fkLibrary || 0"
        [mediaTitle]="trackerTarget()?.title || trackerTarget()?.series || ''"
        [mediaFilename]="trackerTarget()?.name || ''"
        (confirmed)="showTrackerModal.set(false); trackerTarget.set(null)"
        (cancel)="showTrackerModal.set(false); trackerTarget.set(null)"
        (openFullConfig)="onOpenFullConfigFromSimple($event)" />

      <app-tracker-config-dialog
        [open]="showFullConfigModal()"
        [track]="selectedTrackForConfig()"
        [fkLibrary]="trackerTarget()?.fkLibrary || 0"
        [initialTitle]="trackerTarget()?.title || trackerTarget()?.series || ''"
        [initialFilename]="trackerTarget()?.name || ''"
        (saved)="showFullConfigModal.set(false); showTrackerModal.set(true)"
        (deleted)="showFullConfigModal.set(false); trackerTarget.set(null)"
        (cancel)="showFullConfigModal.set(false); trackerTarget.set(null)" />

      @if (activeLibId() === 'home') {
        <div class="flex-1 overflow-y-auto space-y-8 pb-4">
          
          <div class="relative rounded-2xl bg-gradient-to-r from-indigo-900/40 via-slate-900 to-indigo-950/40 p-8 border border-slate-800 shadow-xl overflow-hidden">
            <div class="relative z-10 max-w-xl">
              <h2 class="text-2xl font-extrabold text-white tracking-tight">Bem-vindo ao Bilingual Reader</h2>
              <p class="text-sm text-slate-300 mt-2 leading-relaxed">
                Continue de onde parou ou escolha uma biblioteca abaixo para ler mangás e livros.
              </p>
            </div>
            <div class="absolute -right-6 -bottom-6 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
          </div>

          <div>
            <h3 class="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
              Últimos arquivos
            </h3>

            @if (home.recentReads().length === 0) {
              <div class="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 px-6 py-10 text-center">
                <p class="text-sm text-slate-400">Comece a ler para ver seus últimos arquivos aqui.</p>
              </div>
            } @else {
              <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-w-5xl items-stretch">
                @for (item of home.recentReads(); track item.type + '-' + item.fkReference) {
                  <app-home-recent-card [item]="item" (open)="onOpenRecent($event)" />
                }
              </div>
            }
          </div>

          <div class="mt-8">
            <app-home-reading-heatmap [days]="home.heatmap()" />
          </div>

          <div class="border-t border-slate-800 pt-8 space-y-6">
            <h3 class="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
              Suas bibliotecas
            </h3>

            <div class="space-y-3">
              <h4 class="text-xs font-semibold text-indigo-400/90 uppercase tracking-wider">Mangás &amp; Comics</h4>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <a [routerLink]="['/']" [queryParams]="{ lib: 'manga-default' }"
                  class="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all cursor-pointer flex items-center justify-between">
                  <div class="flex items-center gap-4 min-w-0">
                    <div class="w-12 h-12 shrink-0 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">🎨</div>
                    <div class="min-w-0">
                      <h4 class="text-base font-bold text-slate-100 group-hover:text-indigo-400 transition-colors truncate">Biblioteca de Mangás</h4>
                      <p class="text-xs text-slate-400 mt-0.5">{{ mangaLibraryService.mangas().length }} itens · padrão</p>
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </a>

                @for (lib of mangaCustomLibraries(); track lib.id) {
                  <a [routerLink]="['/']" [queryParams]="{ lib: lib.id }"
                    class="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all cursor-pointer flex items-center justify-between">
                    <div class="flex items-center gap-4 min-w-0">
                      <div class="w-12 h-12 shrink-0 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">🎨</div>
                      <div class="min-w-0">
                        <h4 class="text-base font-bold text-slate-100 group-hover:text-indigo-400 transition-colors truncate">{{ lib.title }}</h4>
                        <p class="text-xs text-slate-400 mt-0.5 truncate">{{ lib.language || 'Personalizada' }}</p>
                      </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                }
              </div>
            </div>

            <div class="space-y-3">
              <h4 class="text-xs font-semibold text-amber-400/90 uppercase tracking-wider">Livros &amp; EPUBs</h4>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <a [routerLink]="['/']" [queryParams]="{ lib: 'book-default' }"
                  class="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/80 transition-all cursor-pointer flex items-center justify-between">
                  <div class="flex items-center gap-4 min-w-0">
                    <div class="w-12 h-12 shrink-0 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📚</div>
                    <div class="min-w-0">
                      <h4 class="text-base font-bold text-slate-100 group-hover:text-amber-400 transition-colors truncate">Biblioteca de Livros</h4>
                      <p class="text-xs text-slate-400 mt-0.5">{{ bookLibraryService.books().length }} itens · padrão</p>
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </a>

                @for (lib of bookCustomLibraries(); track lib.id) {
                  <a [routerLink]="['/']" [queryParams]="{ lib: lib.id }"
                    class="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/80 transition-all cursor-pointer flex items-center justify-between">
                    <div class="flex items-center gap-4 min-w-0">
                      <div class="w-12 h-12 shrink-0 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📚</div>
                      <div class="min-w-0">
                        <h4 class="text-base font-bold text-slate-100 group-hover:text-amber-400 transition-colors truncate">{{ lib.title }}</h4>
                        <p class="text-xs text-slate-400 mt-0.5 truncate">{{ lib.language || 'Personalizada' }}</p>
                      </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                }
              </div>
            </div>
          </div>
        </div>
      }

      @if (activeLibId() !== 'home') {
        <div class="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div class="flex justify-between items-center mb-6">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
                {{ filteredItems().length }} itens encontrados
              </span>
            </div>

            <div class="flex items-center gap-2">
              <button
                (click)="onSyncClick()"
                [disabled]="!canSyncBookmarks() || shareMark.syncing()"
                class="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition-all flex items-center gap-2 cursor-pointer"
                title="Sincronizar bookmarks com a nuvem">
                @if (shareMark.syncing()) {
                  <svg class="animate-spin h-4 w-4 text-indigo-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sincronizando...
                } @else {
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  Sincronizar bookmarks
                }
              </button>

              @if (isExternalHd()) {
                <div 
                  class="w-8 h-8 rounded-xl flex items-center justify-center border transition-all"
                  [ngClass]="{
                    'bg-emerald-500/10 border-emerald-500/40 text-emerald-400': isPathOnline(),
                    'bg-red-500/10 border-red-500/40 text-red-400': !isPathOnline()
                  }"
                  [title]="isPathOnline() ? 'HD Externo: Conectado (Online)' : 'HD Externo: Desconectado (Offline)'">
                  <span class="w-2.5 h-2.5 rounded-full"
                    [ngClass]="{ 'bg-emerald-400 animate-pulse': isPathOnline(), 'bg-red-500': !isPathOnline() }">
                  </span>
                </div>
              }

              <button 
                (click)="onScanClick()" 
                [disabled]="isCurrentlyScanning() || (isExternalHd() && !isPathOnline())"
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
          </div>

          @if (isExternalHd() && !isPathOnline()) {
            <div class="rounded-2xl border border-red-900/50 bg-red-950/30 p-4 mb-4 flex items-center gap-3 text-red-300 text-xs">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p class="font-bold">HD Externo Desconectado</p>
                <p class="text-slate-400 text-[11px] mt-0.5">O diretório configurado não está acessível no momento. Conecte o dispositivo para escanear ou abrir arquivos.</p>
              </div>
            </div>
          }

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
              (openDetail)="onOpenDetail($event)"
              (setBookmark)="onSetBookmark($event)"
              (openTracker)="onOpenTracker($event)">
            </app-shared-list>
          }
        </div>
      }

      @if (isCurrentlyScanning() || shareMark.syncing()) {
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 overflow-hidden z-50">
          <div class="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-indeterminate"></div>
        </div>
      }

      @if (shareMark.toastMessage()) {
        <div
          class="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md px-4 py-3 rounded-xl border shadow-xl text-xs font-medium flex items-center gap-3"
          [ngClass]="{
            'bg-slate-900 border-slate-700 text-slate-200': shareMark.toastKind() === 'info',
            'bg-emerald-950 border-emerald-700/50 text-emerald-200': shareMark.toastKind() === 'success',
            'bg-red-950 border-red-700/50 text-red-200': shareMark.toastKind() === 'error'
          }">
          <span class="flex-1">{{ shareMark.toastMessage() }}</span>
          <button type="button" (click)="shareMark.dismissToast()" class="text-[10px] uppercase tracking-wider opacity-70 hover:opacity-100 cursor-pointer">
            Fechar
          </button>
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
  public home = inject(HomeDashboardService);
  private librarySearch = inject(LibrarySearchService);
  public shareMark = inject(ShareMarkUiService);
  private electronService = inject(ElectronService);

  activeLibId = signal<string>('home');
  activeLibType = signal<'manga' | 'book'>('manga');
  customOrderItems = signal<(Manga | Book)[] | null>(null);
  bookmarkTarget = signal<Manga | Book | null>(null);
  trackerTarget = signal<Manga | Book | null>(null);
  showTrackerModal = signal<boolean>(false);
  showFullConfigModal = signal<boolean>(false);
  selectedTrackForConfig = signal<Track | null>(null);
  isExternalHd = signal<boolean>(false);
  isPathOnline = signal<boolean>(true);

  isCurrentlyScanning = computed(() => {
    return this.mangaLibraryService.isScanning() || this.bookLibraryService.isScanning();
  });

  mangaCustomLibraries = computed(() =>
    this.settingsService.libraries().filter(l => l.type === 'manga')
  );

  bookCustomLibraries = computed(() =>
    this.settingsService.libraries().filter(l => l.type === 'book')
  );

  private async checkPathAndAutoScan(pathToScan: string, isExternalHd: boolean): Promise<void> {
    this.isExternalHd.set(isExternalHd);
    if (isExternalHd) {
      const online = await this.electronService.checkPathOnline(pathToScan);
      this.isPathOnline.set(online);
      if (online) {
        this.onScanClick();
      }
    } else {
      this.isPathOnline.set(true);
      this.onScanClick();
    }
  }

  ngOnInit(): void {
    void this.shareMark.refreshStatus();
    this.route.queryParams.subscribe(async params => {
      const libId = params['lib'] || 'home';
      this.activeLibId.set(libId);
      this.customOrderItems.set(null);
      this.nav.rememberLibrary(libId);

      let pathToScan = '';

      if (libId === 'home') {
        this.isExternalHd.set(false);
        this.isPathOnline.set(true);
        this.libraryStateService.activeContext.set('manga');
        this.libraryStateService.activeLibrary.set({
          id: 'home',
          name: 'Início',
          type: 'manga',
          count: 0
        });
        this.mangaLibraryService.loadMangas();
        this.bookLibraryService.loadBooks();
        void this.home.refresh();
      } else if (libId === 'manga-default') {
        this.activeLibType.set('manga');
        this.libraryStateService.activeContext.set('manga');
        pathToScan = this.settingsService.mangaBasePath();
        const extHd = !!this.settingsService.mangaBasePathExternalHd();
        this.libraryStateService.activeLibrary.set({
          id: 'manga-default',
          name: 'Biblioteca de Mangás',
          type: 'manga',
          count: this.mangaLibraryService.mangas().length
        });
        await this.mangaLibraryService.loadMangas(pathToScan);
        await this.checkPathAndAutoScan(pathToScan, extHd);
      } else if (libId === 'book-default') {
        this.activeLibType.set('book');
        this.libraryStateService.activeContext.set('book');
        pathToScan = this.settingsService.bookBasePath();
        const extHd = !!this.settingsService.bookBasePathExternalHd();
        this.libraryStateService.activeLibrary.set({
          id: 'book-default',
          name: 'Biblioteca de Livros',
          type: 'book',
          count: this.bookLibraryService.books().length
        });
        await this.bookLibraryService.loadBooks(pathToScan);
        await this.checkPathAndAutoScan(pathToScan, extHd);
      } else {
        const found = this.settingsService.libraries().find(l => l.id === libId);
        if (found) {
          this.activeLibType.set(found.type);
          this.libraryStateService.activeContext.set(found.type);
          pathToScan = found.path;
          const extHd = !!found.externalHd;
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
          await this.checkPathAndAutoScan(pathToScan, extHd);
        }
      }
    });
  }

  canSyncBookmarks = computed(() => {
    const s = this.shareMark.status();
    return s.enabled && s.signedIn && !s.inSync;
  });

  async onSyncClick(): Promise<void> {
    const type = this.activeLibType() === 'book' ? 'BOOK' : 'MANGA';
    const result = await this.shareMark.sync(type);
    if (!result) return;

    const ok =
      result.result === ShareMarkType.SUCCESS ||
      result.result === ShareMarkType.NOT_ALTERATION ||
      result.result === ShareMarkType.NOTIFY_DATA_SET;

    if (ok && (result.receive ?? 0) > 0) {
      // Reload list so received bookmarks appear
      const libId = this.activeLibId();
      let pathToScan = '';
      if (libId === 'manga-default') pathToScan = this.settingsService.mangaBasePath();
      else if (libId === 'book-default') pathToScan = this.settingsService.bookBasePath();
      else {
        const found = this.settingsService.libraries().find(l => l.id === libId);
        if (found) pathToScan = found.path;
      }
      if (type === 'MANGA') {
        await this.mangaLibraryService.loadMangas(pathToScan);
      } else {
        await this.bookLibraryService.loadBooks(pathToScan);
      }
    }
  }

  onScanClick(): void {
    let pathToScan = '';
    let isExternalHd = false;
    const libId = this.activeLibId();

    if (libId === 'manga-default') {
      pathToScan = this.settingsService.mangaBasePath();
      isExternalHd = !!this.settingsService.mangaBasePathExternalHd();
    } else if (libId === 'book-default') {
      pathToScan = this.settingsService.bookBasePath();
      isExternalHd = !!this.settingsService.bookBasePathExternalHd();
    } else {
      const found = this.settingsService.libraries().find(l => l.id === libId);
      if (found) {
        pathToScan = found.path;
        isExternalHd = !!found.externalHd;
      }
    }

    this.isExternalHd.set(isExternalHd);

    if (isExternalHd && !this.isPathOnline()) {
      return;
    }

    if (this.activeLibType() === 'manga') {
      this.mangaLibraryService.scanFolder(pathToScan, isExternalHd);
    } else {
      this.bookLibraryService.scanFolder(pathToScan, isExternalHd);
    }
  }

  filteredItems = computed(() => {
    if (this.customOrderItems()) {
      return this.customOrderItems()!;
    }

    const scope = this.activeLibType();
    let list: (Manga | Book)[] = scope === 'manga'
      ? [...this.mangaLibraryService.mangas()]
      : [...this.bookLibraryService.books()];

    const query = this.libraryStateService.filterQuery();
    const order = this.libraryStateService.currentOrder();
    const isAsc = this.libraryStateService.isAscending();

    if (query.trim()) {
      list = this.librarySearch.filterItems(list, query, scope);
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

  async onOpenRecent(item: HomeRecentItem): Promise<void> {
    if (!item.fkReference) return;
    if (item.type === 'MANGA') {
      const manga = this.mangaLibraryService.mangas().find(m => m.id === item.fkReference) || await this.electronService.getManga(item.fkReference);
      if (manga?.path) {
        const online = await this.electronService.checkPathOnline(manga.path);
        if (!online) {
          this.shareMark.showToast('HD Externo desconectado. Conecte o dispositivo para acessar o arquivo.', 'error');
          return;
        }
      }
    } else {
      const book = this.bookLibraryService.books().find(b => b.id === item.fkReference) || await this.electronService.getBook(item.fkReference);
      if (book?.path) {
        const online = await this.electronService.checkPathOnline(book.path);
        if (!online) {
          this.shareMark.showToast('HD Externo desconectado. Conecte o dispositivo para acessar o arquivo.', 'error');
          return;
        }
      }
    }
    this.nav.openReader(
      this.router,
      item.type === 'MANGA' ? 'image' : 'text',
      item.fkReference
    );
  }

  async onOpenItem(item: Manga | Book): Promise<void> {
    if (!item.id) return;
    if (item.path) {
      const online = await this.electronService.checkPathOnline(item.path);
      if (!online) {
        this.shareMark.showToast('HD Externo desconectado. Conecte o dispositivo para acessar o arquivo.', 'error');
        return;
      }
    }
    if (this.activeLibType() === 'manga') {
      this.nav.openReader(this.router, 'image', item.id);
    } else {
      this.nav.openReader(this.router, 'text', item.id);
    }
  }

  async onOpenDetail(item: Manga | Book): Promise<void> {
    if (!item.id) return;
    if (item.path) {
      const online = await this.electronService.checkPathOnline(item.path);
      if (!online) {
        this.shareMark.showToast('HD Externo desconectado. Conecte o dispositivo para acessar o arquivo.', 'error');
        return;
      }
    }
    if (this.activeLibType() === 'manga') {
      this.nav.openDetail(this.router, 'manga', item.id);
    } else {
      this.nav.openDetail(this.router, 'book', item.id);
    }
  }

  async onSetBookmark(item: Manga | Book): Promise<void> {
    let target = item;
    if (this.activeLibType() === 'book' && item?.id && (!item.pages || item.pages <= 1)) {
      try {
        const updated = await this.electronService.calculateBookPages(item.id);
        if (updated) {
          target = updated;
          this.bookLibraryService.books.update(list =>
            list.map(b => (b.id === updated.id ? { ...b, pages: updated.pages } : b))
          );
        }
      } catch (err) {
        console.error('Falha ao calcular páginas do livro:', err);
      }
    }
    this.bookmarkTarget.set(target);
  }

  async onBookmarkSave(payload: LibraryBookmarkPayload): Promise<void> {
    const item = this.bookmarkTarget();
    if (!item?.id) {
      this.bookmarkTarget.set(null);
      return;
    }
    const updated =
      this.activeLibType() === 'manga'
        ? await this.mangaLibraryService.updateBookmark(item as Manga, payload)
        : await this.bookLibraryService.updateBookmark(item as Book, payload);

    if (updated) {
      this.customOrderItems.update(list => {
        if (!list) return list;
        return list.map(i =>
          i.id === updated.id
            ? { ...i, bookMark: updated.bookMark, completed: updated.completed, lastAccess: updated.lastAccess }
            : i
        );
      });
    }
    this.bookmarkTarget.set(null);
  }

  onOpenTracker(item: Manga | Book): void {
    this.trackerTarget.set(item);
    this.showTrackerModal.set(true);
  }

  onOpenFullConfigFromSimple(track: Track | null): void {
    this.selectedTrackForConfig.set(track);
    this.showTrackerModal.set(false);
    this.showFullConfigModal.set(true);
  }
}
