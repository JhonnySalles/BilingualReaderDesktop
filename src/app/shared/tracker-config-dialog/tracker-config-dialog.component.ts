import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Track, TrackerLibraryOption, TrackerMatchedItem, TrackStatus } from '../../core/models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { TrackerService } from '../../core/services/tracker.service';
import { progressPercent } from '../../core/utils/reading-progress.util';
import {
  TrackerSearchDialogComponent,
  TrackerSearchProvider,
  TrackerSearchResultItem
} from '../tracker-search-dialog/tracker-search-dialog.component';

export interface RegexSuggestion {
  pattern: string;
  label: string;
  description: string;
}

@Component({
  selector: 'app-tracker-config-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TrackerSearchDialogComponent],
  template: `
    @if (open) {
      <div
        class="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
        (click)="onBackdropClick()">
        <div
          class="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
            <div class="flex items-center gap-3">
              <div class="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <div>
                <h3 class="text-sm font-bold text-slate-100">
                  {{ trackId ? 'Editar Rastreador' : 'Novo Rastreador' }}
                </h3>
                <p class="text-[11px] text-slate-400 mt-0.5 truncate max-w-[24rem]" [title]="initialTitle || 'Vínculo com MyAnimeList & AniList'">
                  {{ initialTitle || 'Vincule sua obra para sincronização de leitura automática' }}
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

          <!-- Body Form -->
          <div class="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar text-xs">
            
            <!-- 1. Seleção da Biblioteca -->
            <div>
              <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Biblioteca Vinculada <span class="text-rose-400">*</span>
              </label>
              <select
                [(ngModel)]="selectedLibraryId"
                (ngModelChange)="onLibraryOrRegexChange()"
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 text-xs font-medium cursor-pointer">
                <option [ngValue]="0" disabled>Selecione uma biblioteca...</option>
                @for (lib of libraries(); track lib.id) {
                  <option [ngValue]="lib.id">{{ lib.displayName }}</option>
                }
              </select>
              <p class="text-[10px] text-slate-500 mt-1">
                A biblioteca onde os arquivos de mangás ou livros desta obra estão localizados.
              </p>
            </div>

            <!-- 2. Título Base -->
            <div>
              <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Título da Obra / Série <span class="text-rose-400">*</span>
              </label>
              <input
                type="text"
                [(ngModel)]="title"
                (ngModelChange)="onTitleChange()"
                placeholder="Ex: One Piece, Solo Leveling, O Senhor dos Anéis..."
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60" />
            </div>

            <!-- 3. Regex de Correspondência com Sugestões -->
            <div class="relative">
              <div class="flex items-center justify-between mb-1.5">
                <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Expressão Regular (Regex) de Correspondência <span class="text-rose-400">*</span>
                </label>
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    (click)="toggleSuggestions()"
                    class="text-[10px] font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer">
                    <span>Sugestões</span>
                    <svg class="w-3 h-3 transition-transform" [class.rotate-180]="showSuggestions()" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    (click)="generateDefaultRegex()"
                    class="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 underline cursor-pointer">
                    Auto-gerar
                  </button>
                </div>
              </div>

              <div class="relative">
                <input
                  type="text"
                  [(ngModel)]="titleRegex"
                  (focus)="showSuggestions.set(true)"
                  (ngModelChange)="onLibraryOrRegexChange()"
                  placeholder="Ex: ^One Piece.*"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 font-mono text-[11px]" />
                
                @if (titleRegex) {
                  <button
                    type="button"
                    (click)="titleRegex = ''; onLibraryOrRegexChange()"
                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                    title="Limpar regex">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                }
              </div>

              <!-- Menu Popover de Sugestões de Regex -->
              @if (showSuggestions()) {
                <div
                  class="absolute left-0 right-0 top-full mt-1.5 z-30 bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl overflow-hidden py-1 divide-y divide-slate-850 animate-fade-in max-h-56 overflow-y-auto custom-scrollbar">
                  <div class="px-3 py-1.5 bg-slate-900/80 flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    <span>Sugestões de Regex {{ titleRegex ? '(baseadas no texto)' : '(exemplos)' }}</span>
                    <button
                      type="button"
                      (click)="showSuggestions.set(false)"
                      class="text-slate-500 hover:text-slate-300 cursor-pointer">
                      ✕
                    </button>
                  </div>
                  @for (sug of computedRegexSuggestions(); track sug.pattern) {
                    <button
                      type="button"
                      (click)="applySuggestion(sug.pattern)"
                      class="w-full px-3.5 py-2 text-left hover:bg-slate-800/80 transition-colors flex flex-col gap-0.5 group cursor-pointer">
                      <span class="font-mono text-[11px] text-indigo-400 group-hover:text-indigo-300 font-semibold truncate">
                        {{ sug.pattern }}
                      </span>
                      <span class="text-[10px] text-slate-400 group-hover:text-slate-300">
                        {{ sug.description }}
                      </span>
                    </button>
                  }
                </div>
              }

              <p class="text-[10px] text-slate-500 mt-1">
                Expressão regular para identificar automaticamente todos os arquivos de volumes e capítulos desta obra.
              </p>
            </div>

            <!-- 4. IDs Externos (MAL & AniList com busca) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <!-- Campo MyAnimeList -->
              <div>
                <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  ID MyAnimeList (MAL)
                </label>
                <div class="relative flex items-center">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 uppercase">MAL:</span>
                  <input
                    type="text"
                    [(ngModel)]="malId"
                    placeholder="Ex: 13 ou clique na lupa"
                    class="w-full pl-12 pr-10 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 font-mono text-xs" />
                  <button
                    type="button"
                    (click)="openSearch('myanimelist')"
                    title="Pesquisar no MyAnimeList"
                    class="absolute right-1.5 p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors cursor-pointer">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Campo AniList -->
              <div>
                <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  ID AniList
                </label>
                <div class="relative flex items-center">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 uppercase">AL:</span>
                  <input
                    type="text"
                    [(ngModel)]="aniId"
                    placeholder="Ex: 30013 ou clique na lupa"
                    class="w-full pl-10 pr-10 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 font-mono text-xs" />
                  <button
                    type="button"
                    (click)="openSearch('anilist')"
                    title="Pesquisar no AniList"
                    class="absolute right-1.5 p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors cursor-pointer">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- 5. Status & Nota -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Status de Leitura
                </label>
                <select
                  [(ngModel)]="status"
                  class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500/60 cursor-pointer">
                  <option value="READING">Lendo (Reading)</option>
                  <option value="COMPLETED">Completo (Completed)</option>
                  <option value="ON_HOLD">Em Espera (On Hold)</option>
                  <option value="DROPPED">Abandonado (Dropped)</option>
                  <option value="PLAN_TO_READ">Planejo Ler (Plan to Read)</option>
                </select>
              </div>
              <div>
                <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Nota / Score (0 - 10)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="10"
                  [(ngModel)]="score"
                  placeholder="Ex: 9.5"
                  class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
              </div>
            </div>

            <!-- 6. Progresso de Capítulos & Volumes -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <!-- Capítulos -->
              <div class="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <span class="block text-[11px] font-semibold text-indigo-300">Capítulos</span>
                <div class="flex items-center gap-2">
                  <div class="flex-1">
                    <label class="block text-[9px] uppercase font-bold text-slate-500 mb-0.5">Lidos</label>
                    <input
                      type="number"
                      min="0"
                      [(ngModel)]="chaptersRead"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs" />
                  </div>
                  <span class="text-slate-500 mt-3 font-bold">/</span>
                  <div class="flex-1">
                    <label class="block text-[9px] uppercase font-bold text-slate-500 mb-0.5">Total</label>
                    <input
                      type="number"
                      min="0"
                      [(ngModel)]="totalChapters"
                      placeholder="?"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs" />
                  </div>
                </div>
              </div>

              <!-- Volumes -->
              <div class="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <span class="block text-[11px] font-semibold text-amber-300">Volumes</span>
                <div class="flex items-center gap-2">
                  <div class="flex-1">
                    <label class="block text-[9px] uppercase font-bold text-slate-500 mb-0.5">Lidos</label>
                    <input
                      type="number"
                      min="0"
                      [(ngModel)]="volumesRead"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs" />
                  </div>
                  <span class="text-slate-500 mt-3 font-bold">/</span>
                  <div class="flex-1">
                    <label class="block text-[9px] uppercase font-bold text-slate-500 mb-0.5">Total</label>
                    <input
                      type="number"
                      min="0"
                      [(ngModel)]="totalVolumes"
                      placeholder="?"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs" />
                  </div>
                </div>
              </div>
            </div>

            <!-- 7. Lista de Itens Correspondentes da Biblioteca (com Exclusão e Swipe) -->
            <div class="pt-2 border-t border-slate-800 space-y-2.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Itens Correspondentes da Biblioteca
                  </span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                    {{ visibleMatchedItems().length }} {{ visibleMatchedItems().length === 1 ? 'item' : 'itens' }}
                  </span>
                  @if (ignoredItemIds().length > 0) {
                    <button
                      type="button"
                      (click)="restoreAllItems()"
                      class="text-[10px] font-semibold text-amber-400 hover:text-amber-300 underline ml-1 cursor-pointer">
                      Restaurar {{ ignoredItemIds().length }} excluído(s)
                    </button>
                  }
                </div>
                @if (isLoadingMatches()) {
                  <span class="text-[10px] text-indigo-400 animate-pulse">Buscando itens…</span>
                }
              </div>

              <!-- Dica de swipe / exclusão -->
              <p class="text-[10px] text-slate-500">
                Arraste um item para a direita/esquerda ou clique no botão de lixeira para removê-lo deste rastreador.
              </p>

              <!-- Lista Linha a Linha com suporte a Swipe e Delete -->
              <div class="max-h-60 overflow-y-auto space-y-1.5 custom-scrollbar pr-1 overflow-x-hidden">
                @if (visibleMatchedItems().length > 0) {
                  @for (item of visibleMatchedItems(); track item.id) {
                    <div
                      class="relative group bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between gap-3 transition-transform duration-200 select-none cursor-grab active:cursor-grabbing"
                      [style.transform]="getSwipeTransform(item.id)"
                      (touchstart)="onTouchStart($event, item.id)"
                      (touchmove)="onTouchMove($event, item.id)"
                      (touchend)="onTouchEnd(item)"
                      (mousedown)="onMouseDown($event, item.id)"
                      (mousemove)="onMouseMove($event, item.id)"
                      (mouseup)="onMouseUp(item)"
                      (mouseleave)="onMouseUp(item)">
                      
                      <!-- Thumbnail & Info -->
                      <div class="flex items-center gap-3 min-w-0 flex-1 pointer-events-none">
                        <div class="w-8 h-11 bg-slate-900 rounded-lg overflow-hidden flex-shrink-0 border border-slate-700/50 flex items-center justify-center text-[9px] font-bold text-slate-500">
                          @if (item.coverPath) {
                            <img [src]="'local-cover:///' + item.coverPath" [alt]="item.title" class="w-full h-full object-cover" />
                          } @else {
                            <span>{{ item.fileType || (item.type === 'MANGA' ? 'CBZ' : 'EPUB') }}</span>
                          }
                        </div>

                        <div class="min-w-0 flex-1">
                          <h4 class="text-xs font-semibold text-slate-200 truncate" [title]="item.title">
                            {{ item.title }}
                          </h4>
                          <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-400 mt-0.5">
                            <span class="px-1.5 py-0.2 rounded bg-slate-900 text-indigo-300 font-mono text-[9px] border border-slate-700 uppercase">
                              {{ item.fileType || 'MEDIA' }}
                            </span>
                            @if (item.series) {
                              <span class="truncate max-w-[12rem] text-slate-400">
                                <strong class="text-slate-500 font-normal">Série:</strong> {{ item.series }}
                              </span>
                            }
                            @if (item.author) {
                              <span class="truncate max-w-[10rem] text-slate-400">
                                <strong class="text-slate-500 font-normal">Autor:</strong> {{ item.author }}
                              </span>
                            }
                          </div>
                        </div>
                      </div>

                      <!-- Progress & Actions -->
                      <div class="flex items-center gap-3 flex-shrink-0">
                        <div class="w-24 hidden sm:block pointer-events-none">
                          <div class="flex justify-between text-[9px] text-slate-400 mb-0.5 font-mono">
                            <span>{{ item.bookMark }}/{{ item.pages }}p</span>
                            <span>{{ getProgressPercentage(item) }}%</span>
                          </div>
                          <div class="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              class="h-full bg-indigo-500 rounded-full"
                              [style.width.%]="getProgressPercentage(item)">
                            </div>
                          </div>
                        </div>

                        <div class="text-right text-[10px] text-slate-400 w-14 font-mono hidden md:block pointer-events-none">
                          {{ formatSize(item.fileSize) }}
                        </div>

                        @if (item.completed) {
                          <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 pointer-events-none">
                            Lido
                          </span>
                        }

                        <!-- Botão de Excluir da Lista -->
                        <button
                          type="button"
                          (click)="removeItem(item, $event)"
                          class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Remover este item do rastreador">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  }
                } @else {
                  <div class="p-6 rounded-xl bg-slate-950/40 border border-dashed border-slate-800 text-center">
                    <p class="text-slate-400 text-xs font-medium">
                      Nenhum item correspondente encontrado na biblioteca selecionada.
                    </p>
                    <p class="text-slate-500 text-[10px] mt-1">
                      Verifique se a biblioteca e a Expressão Regular (Regex) estão corretas.
                    </p>
                  </div>
                }
              </div>
            </div>

          </div>

          <!-- Footer Actions -->
          <div class="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
            @if (trackId) {
              <button
                type="button"
                (click)="onDelete()"
                class="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors cursor-pointer">
                Excluir Rastreador
              </button>
            } @else {
              <div></div>
            }

            <div class="flex items-center gap-2.5">
              <button
                type="button"
                (click)="cancel.emit()"
                class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button
                type="button"
                (click)="onSave()"
                [disabled]="!title || !selectedLibraryId"
                class="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white shadow-lg shadow-indigo-600/25 transition-all cursor-pointer">
                Salvar Rastreador
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal de Busca de Tracker Externo (MAL/AniList) -->
      <app-tracker-search-dialog
        [open]="searchPopupOpen()"
        [provider]="searchProvider"
        [initialQuery]="title"
        (selected)="onSearchSelected($event)"
        (cancel)="searchPopupOpen.set(false)" />
    }
  `
})
export class TrackerConfigDialogComponent implements OnInit, OnChanges {
  private trackerService = inject(TrackerService);
  private confirmDialog = inject(ConfirmDialogService);

  @Input() open = false;
  @Input() track: Track | null = null;
  @Input() fkLibrary: number = 0;
  @Input() initialTitle: string = '';
  @Input() initialFilename: string = '';

  @Output() saved = new EventEmitter<Track>();
  @Output() deleted = new EventEmitter<number>();
  @Output() cancel = new EventEmitter<void>();

  libraries = signal<TrackerLibraryOption[]>([]);
  matchedItems = signal<TrackerMatchedItem[]>([]);
  ignoredItemIds = signal<number[]>([]);
  isLoadingMatches = signal<boolean>(false);

  // Suggestions & Swipe
  showSuggestions = signal<boolean>(false);
  private swipeOffsets = signal<Record<number, number>>({});
  private activeSwipeItemId: number | null = null;
  private swipeStartX: number = 0;
  private isSwiping: boolean = false;

  visibleMatchedItems = computed(() => {
    const ignored = new Set(this.ignoredItemIds());
    return this.matchedItems().filter(item => !ignored.has(item.id));
  });

  // Search Dialog Signal
  searchPopupOpen = signal<boolean>(false);
  searchProvider: TrackerSearchProvider = 'myanimelist';

  trackId: number | undefined = undefined;
  selectedLibraryId: number = 0;
  title: string = '';
  titleRegex: string = '';
  malId: string | number | null = null;
  aniId: string | number | null = null;
  status: TrackStatus = 'READING';
  score: number | null = null;
  chaptersRead: number = 0;
  totalChapters: number | null = null;
  volumesRead: number = 0;
  totalVolumes: number | null = null;

  private searchDebounceTimer: any = null;

  computedRegexSuggestions = computed<RegexSuggestion[]>(() => {
    const raw = (this.titleRegex || this.title || this.initialTitle || this.initialFilename || '').trim();
    if (!raw) {
      return [
        { pattern: '^.*', label: '^.*', description: 'Corresponder a todos os arquivos da biblioteca' },
        { pattern: '^.+\\s*(?:Vol\\.?|Volume|v)\\s*\\d+.*', label: '^.+\\s*(?:Vol|v)...', description: 'Arquivos contendo identificador de Volume (ex: Obra Vol. 01)' },
        { pattern: '^.+\\s*(?:Cap\\.?|Capitulo|Chapter|Ch\\.?|c)\\s*\\d+.*', label: '^.+\\s*(?:Cap|Ch)...', description: 'Arquivos contendo identificador de Capítulo (ex: Obra Ch. 01)' },
        { pattern: '^(?!.*(?:Extra|Omake|Special)).*', label: '^(?!.*(?:Extra)).*', description: 'Ignorar arquivos marcados como Extra ou Omake' }
      ];
    }
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [
      { pattern: `^${escaped}.*`, label: `^${raw}.*`, description: 'Começa exatamente com o título' },
      { pattern: `.*${escaped}.*`, label: `.*${raw}.*`, description: 'Contém o título em qualquer posição do nome' },
      { pattern: `^${escaped}\\s*-\\s*(?:Vol\\.?|Volume|v)\\s*\\d+.*`, label: `^${raw} - Vol. ...`, description: 'Título com hífen seguido de Volume (ex: Obra - Vol. 01)' },
      { pattern: `^${escaped}\\s*(?:Cap\\.?|Chapter|Ch\\.?|c)\\s*\\d+.*`, label: `^${raw} Cap. ...`, description: 'Título seguido de Capítulo (ex: Obra Cap. 01)' },
      { pattern: `^${escaped}\\s*-\\s*\\d+.*`, label: `^${raw} - 01...`, description: 'Título com hífen e numeração direta (ex: Obra - 01)' }
    ];
  });

  async ngOnInit(): Promise<void> {
    await this.loadLibraries();
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['open'] && this.open) {
      await this.loadLibraries();
      this.populateForm();
      this.ignoredItemIds.set([]);
      this.triggerMatchedMediaSearch();
    }
  }

  private async loadLibraries(): Promise<void> {
    const list = await this.trackerService.listLibraries();
    this.libraries.set(list || []);
  }

  private populateForm(): void {
    if (this.track) {
      this.trackId = this.track.id;
      this.selectedLibraryId = this.track.fkLibrary || this.fkLibrary || (this.libraries()[0]?.id ?? 0);
      this.title = this.track.title || '';
      this.titleRegex = this.track.titleRegex || '';
      this.malId = this.track.malId ?? null;
      this.aniId = this.track.aniId ?? null;
      this.status = (this.track.status as TrackStatus) || 'READING';
      this.score = this.track.score ?? null;
      this.chaptersRead = this.track.chaptersRead ?? 0;
      this.totalChapters = this.track.totalChapters ?? null;
      this.volumesRead = this.track.volumesRead ?? 0;
      this.totalVolumes = this.track.totalVolumes ?? null;
    } else {
      this.trackId = undefined;
      this.selectedLibraryId = this.fkLibrary || (this.libraries()[0]?.id ?? 0);
      this.title = this.initialTitle || '';
      this.generateDefaultRegex();
      this.malId = null;
      this.aniId = null;
      this.status = 'READING';
      this.score = null;
      this.chaptersRead = 0;
      this.totalChapters = null;
      this.volumesRead = 0;
      this.totalVolumes = null;
    }
  }

  generateDefaultRegex(): void {
    const raw = this.title || this.initialTitle || this.initialFilename;
    if (!raw) return;
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    this.titleRegex = `^${escaped}.*`;
    this.onLibraryOrRegexChange();
  }

  onTitleChange(): void {
    if (!this.trackId && !this.titleRegex) {
      this.generateDefaultRegex();
    }
    this.onLibraryOrRegexChange();
  }

  toggleSuggestions(): void {
    this.showSuggestions.update(v => !v);
  }

  applySuggestion(pattern: string): void {
    this.titleRegex = pattern;
    this.showSuggestions.set(false);
    this.onLibraryOrRegexChange();
  }

  onBackdropClick(): void {
    this.showSuggestions.set(false);
    this.cancel.emit();
  }

  openSearch(provider: TrackerSearchProvider): void {
    this.searchProvider = provider;
    this.searchPopupOpen.set(true);
  }

  onSearchSelected(item: TrackerSearchResultItem): void {
    if (this.searchProvider === 'myanimelist') {
      this.malId = item.id;
    } else {
      this.aniId = item.id;
    }

    if (!this.title.trim()) {
      this.title = item.title;
      this.generateDefaultRegex();
    }

    if (item.totalChapters && !this.totalChapters) {
      this.totalChapters = item.totalChapters;
    }
    if (item.totalVolumes && !this.totalVolumes) {
      this.totalVolumes = item.totalVolumes;
    }

    this.searchPopupOpen.set(false);
    this.onLibraryOrRegexChange();
  }

  onLibraryOrRegexChange(): void {
    // Reseta exclusões manuais ao alterar biblioteca ou regex conforme solicitado
    this.ignoredItemIds.set([]);
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.triggerMatchedMediaSearch();
    }, 250);
  }

  private async triggerMatchedMediaSearch(): Promise<void> {
    if (!this.selectedLibraryId) {
      this.matchedItems.set([]);
      return;
    }

    this.isLoadingMatches.set(true);
    try {
      const numMalId = this.malId ? Number(this.malId) : null;
      const results = await this.trackerService.getMatchedMedia({
        libraryId: this.selectedLibraryId,
        titleRegex: this.titleRegex || `^${this.title}.*`,
        title: this.title,
        malId: isNaN(numMalId as any) ? null : numMalId
      });
      this.matchedItems.set(results || []);
    } catch {
      this.matchedItems.set([]);
    } finally {
      this.isLoadingMatches.set(false);
    }
  }

  /* ================= Swipe & Delete Methods ================= */

  removeItem(item: TrackerMatchedItem, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.ignoredItemIds.update(ids => (ids.includes(item.id) ? ids : [...ids, item.id]));
  }

  restoreAllItems(): void {
    this.ignoredItemIds.set([]);
  }

  getSwipeTransform(itemId: number): string {
    const offset = this.swipeOffsets()[itemId] || 0;
    return `translateX(${offset}px)`;
  }

  onTouchStart(event: TouchEvent, itemId: number): void {
    this.activeSwipeItemId = itemId;
    this.swipeStartX = event.touches[0].clientX;
    this.isSwiping = true;
  }

  onTouchMove(event: TouchEvent, itemId: number): void {
    if (!this.isSwiping || this.activeSwipeItemId !== itemId) return;
    const currentX = event.touches[0].clientX;
    const deltaX = currentX - this.swipeStartX;
    this.swipeOffsets.update(offsets => ({
      ...offsets,
      [itemId]: deltaX
    }));
  }

  onTouchEnd(item: TrackerMatchedItem): void {
    if (!this.isSwiping || this.activeSwipeItemId !== item.id) return;
    const offset = this.swipeOffsets()[item.id] || 0;
    if (Math.abs(offset) > 75) {
      this.removeItem(item);
    }
    this.swipeOffsets.update(offsets => {
      const copy = { ...offsets };
      delete copy[item.id];
      return copy;
    });
    this.isSwiping = false;
    this.activeSwipeItemId = null;
  }

  onMouseDown(event: MouseEvent, itemId: number): void {
    this.activeSwipeItemId = itemId;
    this.swipeStartX = event.clientX;
    this.isSwiping = true;
  }

  onMouseMove(event: MouseEvent, itemId: number): void {
    if (!this.isSwiping || this.activeSwipeItemId !== itemId) return;
    const deltaX = event.clientX - this.swipeStartX;
    this.swipeOffsets.update(offsets => ({
      ...offsets,
      [itemId]: deltaX
    }));
  }

  onMouseUp(item: TrackerMatchedItem): void {
    if (!this.isSwiping || this.activeSwipeItemId !== item.id) return;
    const offset = this.swipeOffsets()[item.id] || 0;
    if (Math.abs(offset) > 75) {
      this.removeItem(item);
    }
    this.swipeOffsets.update(offsets => {
      const copy = { ...offsets };
      delete copy[item.id];
      return copy;
    });
    this.isSwiping = false;
    this.activeSwipeItemId = null;
  }

  getProgressPercentage(item: TrackerMatchedItem): number {
    return progressPercent(item.bookMark ?? 0, item.pages ?? 1, item.completed);
  }

  formatSize(bytes?: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  async onSave(): Promise<void> {
    if (!this.title || !this.selectedLibraryId) return;

    const numMalId = this.malId ? Number(this.malId) : null;
    const numAniId = this.aniId ? Number(this.aniId) : null;

    const payload: Partial<Track> = {
      id: this.trackId,
      fkLibrary: this.selectedLibraryId,
      title: this.title.trim(),
      titleRegex: this.titleRegex.trim() || `^${this.title.trim()}.*`,
      malId: isNaN(numMalId as any) ? null : numMalId,
      aniId: isNaN(numAniId as any) ? null : numAniId,
      status: this.status,
      score: this.score,
      scoreDate: this.score ? new Date().toISOString() : null,
      chaptersRead: Number(this.chaptersRead) || 0,
      totalChapters: this.totalChapters ? Number(this.totalChapters) : null,
      volumesRead: Number(this.volumesRead) || 0,
      totalVolumes: this.totalVolumes ? Number(this.totalVolumes) : null
    };

    const saved = await this.trackerService.saveTrack(payload);
    if (saved) {
      this.saved.emit(saved);
    }
  }

  async onDelete(): Promise<void> {
    if (!this.trackId) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Excluir Rastreador',
      message: `Deseja realmente excluir o rastreador de "${this.title || 'este título'}"?\n\nOs arquivos de mídia não serão alterados.`,
      confirmText: 'Excluir',
      confirmVariant: 'danger',
      icon: 'danger'
    });
    if (!ok) return;
    await this.trackerService.deleteTrack(this.trackId);
    this.deleted.emit(this.trackId);
  }
}


