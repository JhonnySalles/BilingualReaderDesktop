import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface TrackerSearchResultItem {
  id: string | number;
  title: string;
  romajiTitle?: string;
  englishTitle?: string;
  coverImage?: string;
  mediaType?: string;
  status?: string;
  totalChapters?: number | null;
  totalVolumes?: number | null;
  score?: number | null;
  year?: number | null;
  synopsis?: string;
}

export type TrackerSearchProvider = 'myanimelist' | 'anilist';

@Component({
  selector: 'app-tracker-search-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (open) {
      <div
        class="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in"
        (click)="cancel.emit()">
        <div
          class="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
          (click)="$event.stopPropagation()">
          
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
            <div class="flex items-center gap-3">
              <div
                class="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shadow-md text-white"
                [class.bg-blue-600]="provider === 'myanimelist'"
                [class.bg-sky-500]="provider === 'anilist'">
                {{ provider === 'myanimelist' ? 'MAL' : 'AL' }}
              </div>
              <div>
                <h3 class="text-sm font-bold text-slate-100 flex items-center gap-2">
                  Buscar no {{ provider === 'myanimelist' ? 'MyAnimeList' : 'AniList' }}
                  @if (provider === 'myanimelist') {
                    <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      MyAnimeList API
                    </span>
                  } @else {
                    <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
                      AniList GraphQL
                    </span>
                  }
                </h3>
                <p class="text-[11px] text-slate-400 mt-0.5">
                  Pesquise por títulos de mangás, manwhas ou novels para obter o ID e dados oficiais
                </p>
              </div>
            </div>
            
            <button
              type="button"
              (click)="cancel.emit()"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fechar">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Search Bar -->
          <div class="p-5 border-b border-slate-800/80 bg-slate-950/40">
            <form (ngSubmit)="performSearch()" class="flex items-center gap-2.5">
              <div class="relative flex-1">
                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </div>
                <input
                  type="text"
                  [(ngModel)]="searchQuery"
                  name="query"
                  [placeholder]="'Digite o nome da obra no ' + (provider === 'myanimelist' ? 'MyAnimeList' : 'AniList') + '...'"
                  class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/80"
                  autofocus />
              </div>
              <button
                type="submit"
                [disabled]="!searchQuery.trim() || isSearching()"
                class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5 shrink-0">
                @if (isSearching()) {
                  <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Buscando...</span>
                } @else {
                  <span>Pesquisar</span>
                }
              </button>
            </form>
          </div>

          <!-- Results List -->
          <div class="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-2.5">
            @if (results().length > 0) {
              <div class="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1 mb-1">
                <span>Resultados encontrados ({{ results().length }})</span>
                <span class="text-[10px] text-slate-500">Clique no item desejado para selecionar</span>
              </div>

              @for (item of results(); track item.id) {
                <div
                  (click)="selectItem(item)"
                  class="group flex items-start gap-3.5 p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-indigo-500/40 transition-all cursor-pointer">
                  
                  <!-- Cover / Thumbnail -->
                  <div class="w-12 h-16 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center text-slate-600 font-bold text-[10px]">
                    @if (item.coverImage) {
                      <img [src]="item.coverImage" [alt]="item.title" class="w-full h-full object-cover" />
                    } @else {
                      <span>{{ provider === 'myanimelist' ? 'MAL' : 'AL' }}</span>
                    }
                  </div>

                  <!-- Details -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <h4 class="text-xs font-bold text-slate-200 group-hover:text-indigo-300 transition-colors truncate">
                        {{ item.title }}
                      </h4>
                      <span class="px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800 text-[9px] font-mono shrink-0">
                        ID: {{ item.id }}
                      </span>
                    </div>

                    @if (item.romajiTitle || item.englishTitle) {
                      <p class="text-[10px] text-slate-400 truncate mt-0.5">
                        {{ item.romajiTitle || item.englishTitle }}
                      </p>
                    }

                    <div class="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 mt-1.5">
                      @if (item.mediaType) {
                        <span class="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/20 text-[9px]">
                          {{ item.mediaType }}
                        </span>
                      }
                      @if (item.year) {
                        <span>{{ item.year }}</span>
                      }
                      @if (item.totalChapters) {
                        <span>• {{ item.totalChapters }} caps</span>
                      }
                      @if (item.totalVolumes) {
                        <span>• {{ item.totalVolumes }} vols</span>
                      }
                      @if (item.score) {
                        <span class="text-amber-400 font-semibold">• ★ {{ item.score }}</span>
                      }
                    </div>

                    @if (item.synopsis) {
                      <p class="text-[10px] text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                        {{ item.synopsis }}
                      </p>
                    }
                  </div>

                  <!-- Select Button -->
                  <div class="shrink-0 self-center">
                    <button
                      type="button"
                      (click)="selectItem(item); $event.stopPropagation()"
                      class="px-3 py-1.5 rounded-lg bg-indigo-600/15 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-[11px] font-semibold transition-all cursor-pointer">
                      Selecionar
                    </button>
                  </div>
                </div>
              }
            } @else if (hasSearched()) {
              <div class="p-8 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800">
                <div class="w-10 h-10 mx-auto rounded-full bg-slate-800/60 flex items-center justify-center text-slate-500 mb-2.5">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <p class="text-xs font-semibold text-slate-300">Nenhum resultado encontrado</p>
                <p class="text-[11px] text-slate-500 mt-1">Tente pesquisar com termos mais simples ou em inglês/romaji.</p>
              </div>
            } @else {
              <div class="p-8 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800">
                <div class="w-10 h-10 mx-auto rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-2.5">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </div>
                <p class="text-xs font-semibold text-slate-300">Digite o título para iniciar a busca</p>
                <p class="text-[11px] text-slate-500 mt-1">Pesquise por títulos para encontrar a correspondência exata no {{ provider === 'myanimelist' ? 'MyAnimeList' : 'AniList' }}.</p>
              </div>
            }
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end px-6 py-3.5 border-t border-slate-800 bg-slate-900/90">
            <button
              type="button"
              (click)="cancel.emit()"
              class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer">
              Fechar
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class TrackerSearchDialogComponent {
  @Input() open = false;
  @Input() provider: TrackerSearchProvider = 'myanimelist';
  @Input() initialQuery: string = '';

  @Output() selected = new EventEmitter<TrackerSearchResultItem>();
  @Output() cancel = new EventEmitter<void>();

  searchQuery = '';
  isSearching = signal<boolean>(false);
  hasSearched = signal<boolean>(false);
  results = signal<TrackerSearchResultItem[]>([]);

  ngOnChanges(): void {
    if (this.open) {
      this.searchQuery = this.initialQuery || '';
      if (this.searchQuery.trim()) {
        this.performSearch();
      } else {
        this.results.set([]);
        this.hasSearched.set(false);
      }
    }
  }

  async performSearch(): Promise<void> {
    const q = this.searchQuery.trim();
    if (!q) return;

    this.isSearching.set(true);
    this.hasSearched.set(true);

    try {
      // Placeholder / Mock structure ready for future backend integration
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // We produce sample mock items if needed, or query backend when available
      this.results.set([
        {
          id: this.provider === 'myanimelist' ? 13 : 30013,
          title: q,
          romajiTitle: `${q} (Manga)`,
          englishTitle: q,
          mediaType: 'Manga',
          status: 'Publishing',
          totalChapters: null,
          totalVolumes: null,
          score: 8.95,
          year: 2020,
          synopsis: `Obra correspondente encontrada no ${this.provider === 'myanimelist' ? 'MyAnimeList' : 'AniList'} para "${q}".`
        }
      ]);
    } catch {
      this.results.set([]);
    } finally {
      this.isSearching.set(false);
    }
  }

  selectItem(item: TrackerSearchResultItem): void {
    this.selected.emit(item);
  }
}
