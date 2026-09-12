import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Track, TrackerLibraryOption } from '../../core/models';
import { TrackerService } from '../../core/services/tracker.service';
import { TrackerConfigDialogComponent } from '../../shared/tracker-config-dialog/tracker-config-dialog.component';

@Component({
  selector: 'app-tracker-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TrackerConfigDialogComponent],
  template: `
    <div class="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      
      <!-- Top Actions Bar / Filters -->
      <div class="p-5 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <!-- Title & Subtitle -->
        <div>
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <div>
              <h2 class="text-base font-bold text-slate-100 flex items-center gap-2">
                Rastreadores de Leitura (Trackers)
                <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                  {{ filteredTracks().length }}
                </span>
              </h2>
              <p class="text-xs text-slate-400">
                Gerencie os vínculos automáticos com MyAnimeList e AniList para suas bibliotecas
              </p>
            </div>
          </div>
        </div>

        <!-- Controls: Search, Library Filter, New Tracker Button -->
        <div class="flex items-center gap-3 flex-wrap">
          <!-- Search input -->
          <div class="relative w-48 sm:w-64">
            <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              [(ngModel)]="searchQuery"
              placeholder="Buscar rastreador ou regex..."
              class="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-all" />
          </div>

          <!-- Library Filter -->
          <select
            [(ngModel)]="selectedLibraryFilter"
            class="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/80 cursor-pointer">
            <option [ngValue]="null">Todas as Bibliotecas</option>
            @for (lib of libraries(); track lib.id) {
              <option [ngValue]="lib.id">{{ lib.displayName }}</option>
            }
          </select>

          <!-- Status Filter -->
          <select
            [(ngModel)]="selectedStatusFilter"
            class="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/80 cursor-pointer">
            <option value="ALL">Todos os Status</option>
            <option value="READING">Lendo</option>
            <option value="COMPLETED">Completo</option>
            <option value="ON_HOLD">Em Espera</option>
            <option value="DROPPED">Abandonado</option>
            <option value="PLAN_TO_READ">Planejo Ler</option>
          </select>

          <!-- New Tracker Button -->
          <button
            type="button"
            (click)="openNewTrackerDialog()"
            class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition-all cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Novo Rastreador</span>
          </button>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="flex-1 min-h-0 overflow-y-auto p-5 custom-scrollbar space-y-5">
        
        <!-- Summary KPI Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div class="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <div class="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Rastreados</span>
              <p class="text-lg font-extrabold text-slate-100 font-mono leading-tight">{{ tracks().length }}</p>
            </div>
          </div>

          <div class="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <div class="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Em Leitura</span>
              <p class="text-lg font-extrabold text-sky-300 font-mono leading-tight">{{ readingCount() }}</p>
            </div>
          </div>

          <div class="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <div class="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Concluídos</span>
              <p class="text-lg font-extrabold text-emerald-300 font-mono leading-tight">{{ completedCount() }}</p>
            </div>
          </div>

          <div class="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <div class="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Arquivos Vinculados</span>
              <p class="text-lg font-extrabold text-amber-300 font-mono leading-tight">{{ totalLinkedCount() }}</p>
            </div>
          </div>
        </div>

        <!-- Trackers List (Line Rows) -->
        <div class="space-y-2">
          @if (isLoading()) {
            <div class="space-y-2">
              @for (i of [1, 2, 3, 4]; track i) {
                <div class="h-20 bg-slate-900/60 border border-slate-800 rounded-2xl animate-pulse"></div>
              }
            </div>
          } @else if (filteredTracks().length > 0) {
            @for (item of filteredTracks(); track item.id) {
              <div
                (click)="openEditTrackerDialog(item)"
                class="group bg-slate-900/70 hover:bg-slate-850 border border-slate-800/90 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                [ngClass]="item.libraryType === 'MANGA'
                  ? 'hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5'
                  : 'hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5'">
                
                <!-- Main Info: Icon, Title, Library, Regex -->
                <div class="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                  <!-- Type Icon -->
                  <div
                    class="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 border"
                    [ngClass]="item.libraryType === 'MANGA' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'">
                    {{ item.libraryType === 'MANGA' ? '🎨' : '📚' }}
                  </div>

                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h3
                        class="text-sm font-bold text-slate-100 transition-colors truncate"
                        [ngClass]="item.libraryType === 'MANGA' ? 'group-hover:text-indigo-300' : 'group-hover:text-amber-300'">
                        {{ item.title || 'Sem título' }}
                      </h3>

                      <!-- Status Badge -->
                      <span
                        class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                        [class]="getStatusClass(item.status)">
                        {{ getStatusLabel(item.status) }}
                      </span>

                      <!-- Score Badge -->
                      @if (item.score) {
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                          <span>★</span> {{ item.score }}
                        </span>
                      }
                    </div>

                    <!-- Subtitle Metadata: Library, Regex, External IDs -->
                    <div class="flex items-center gap-2.5 flex-wrap text-xs text-slate-400 mt-1">
                      <!-- Library Name Tag -->
                      <span class="px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-300 text-[10px] font-medium border border-slate-800 flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full" [ngClass]="item.libraryType === 'MANGA' ? 'bg-indigo-400' : 'bg-amber-400'"></span>
                        {{ item.libraryTitle }}
                      </span>

                      <!-- Regex Badge -->
                      <span
                        class="px-2 py-0.5 rounded-md bg-slate-950/80 font-mono text-[10px] border border-slate-800/80 truncate max-w-[14rem]"
                        [ngClass]="item.libraryType === 'MANGA' ? 'text-indigo-300' : 'text-amber-300'"
                        [title]="item.titleRegex">
                        Regex: {{ item.titleRegex }}
                      </span>

                      <!-- External IDs -->
                      @if (item.malId) {
                        <span class="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">
                          MAL: {{ item.malId }}
                        </span>
                      }
                      @if (item.aniId) {
                        <span class="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 text-[10px] font-bold border border-sky-500/20">
                          AL: {{ item.aniId }}
                        </span>
                      }
                    </div>
                  </div>
                </div>

                <!-- Progress Section: Volumes & Chapters -->
                <div class="flex items-center gap-5 flex-shrink-0 justify-between md:justify-end border-t md:border-t-0 border-slate-800/60 pt-2.5 md:pt-0">
                  
                  <!-- Volumes Info -->
                  <div class="text-right">
                    <span class="text-[10px] uppercase font-bold text-slate-400 block">Volumes</span>
                    <span class="text-xs font-mono font-semibold text-slate-200">
                      {{ item.volumesRead }} / {{ item.totalVolumes || '?' }}
                    </span>
                  </div>

                  <!-- Chapters Info -->
                  <div class="text-right">
                    <span class="text-[10px] uppercase font-bold text-slate-400 block">Capítulos</span>
                    <span class="text-xs font-mono font-semibold text-slate-200">
                      {{ item.chaptersRead }} / {{ item.totalChapters || '?' }}
                    </span>
                  </div>

                  <!-- Matched Items Counter Badge -->
                  <div class="text-right min-w-[7rem]">
                    <span class="text-[10px] uppercase font-bold text-slate-400 block">Itens Vinculados</span>
                    <span
                      class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border font-mono"
                      [ngClass]="(item.matchedCount || 0) > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400'">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      {{ item.matchedCount || 0 }} {{ (item.matchedCount || 0) === 1 ? 'item' : 'itens' }}
                    </span>
                  </div>

                  <!-- Edit Action Chevron -->
                  <div
                    class="p-1.5 rounded-lg text-slate-500 transition-colors"
                    [ngClass]="item.libraryType === 'MANGA'
                      ? 'group-hover:text-indigo-400 group-hover:bg-indigo-500/10'
                      : 'group-hover:text-amber-400 group-hover:bg-amber-500/10'">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

              </div>
            }
          } @else {
            <!-- Empty State -->
            <div class="py-16 px-4 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center flex flex-col items-center justify-center">
              <div class="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3 border border-indigo-500/20">
                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <h3 class="text-base font-bold text-slate-200">Nenhum rastreador encontrado</h3>
              <p class="text-xs text-slate-400 mt-1 max-w-sm">
                @if (searchQuery || selectedLibraryFilter || selectedStatusFilter !== 'ALL') {
                  Nenhum rastreador corresponde aos filtros aplicados. Tente limpar a busca.
                } @else {
                  Cadastre seus títulos para que o progresso de leitura seja sincronizado e identificado automaticamente.
                }
              </p>
              <button
                type="button"
                (click)="openNewTrackerDialog()"
                class="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all cursor-pointer">
                + Criar Primeiro Rastreador
              </button>
            </div>
          }
        </div>

      </div>
    </div>

    <!-- Tracker Config Dialog Component -->
    <app-tracker-config-dialog
      [open]="showConfigDialog()"
      [track]="selectedTrack()"
      [fkLibrary]="selectedTrack()?.fkLibrary || 0"
      (saved)="onTrackSaved($event)"
      (deleted)="onTrackDeleted($event)"
      (cancel)="showConfigDialog.set(false)">
    </app-tracker-config-dialog>
  `
})
export class TrackerListComponent implements OnInit {
  private trackerService = inject(TrackerService);

  tracks = signal<Track[]>([]);
  libraries = signal<TrackerLibraryOption[]>([]);
  isLoading = signal<boolean>(true);

  searchQuery = '';
  selectedLibraryFilter: number | null = null;
  selectedStatusFilter = 'ALL';

  showConfigDialog = signal<boolean>(false);
  selectedTrack = signal<Track | null>(null);

  readonly readingCount = computed(() =>
    this.tracks().filter(t => t.status === 'READING').length
  );

  readonly completedCount = computed(() =>
    this.tracks().filter(t => t.status === 'COMPLETED').length
  );

  readonly totalLinkedCount = computed(() =>
    this.tracks().reduce((acc, t) => acc + (t.matchedCount || 0), 0)
  );

  readonly filteredTracks = computed(() => {
    let list = this.tracks();

    if (this.selectedLibraryFilter !== null) {
      list = list.filter(t => t.fkLibrary === this.selectedLibraryFilter);
    }

    if (this.selectedStatusFilter !== 'ALL') {
      list = list.filter(t => t.status === this.selectedStatusFilter);
    }

    const query = this.searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(t =>
        (t.title && t.title.toLowerCase().includes(query)) ||
        (t.titleRegex && t.titleRegex.toLowerCase().includes(query)) ||
        (t.libraryTitle && t.libraryTitle.toLowerCase().includes(query)) ||
        (t.malId && String(t.malId).includes(query)) ||
        (t.aniId && String(t.aniId).includes(query))
      );
    }

    return list;
  });

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  async loadData(): Promise<void> {
    this.isLoading.set(true);
    try {
      const [trackList, libList] = await Promise.all([
        this.trackerService.getAllTracks(),
        this.trackerService.listLibraries()
      ]);
      this.tracks.set(trackList);
      this.libraries.set(libList);
    } catch {
      this.tracks.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  openNewTrackerDialog(): void {
    this.selectedTrack.set(null);
    this.showConfigDialog.set(true);
  }

  openEditTrackerDialog(track: Track): void {
    this.selectedTrack.set(track);
    this.showConfigDialog.set(true);
  }

  onTrackSaved(_savedTrack: Track): void {
    this.showConfigDialog.set(false);
    void this.loadData();
  }

  onTrackDeleted(_deletedId: number): void {
    this.showConfigDialog.set(false);
    void this.loadData();
  }

  getStatusClass(status?: string | null): string {
    switch (status) {
      case 'READING':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'ON_HOLD':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'DROPPED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'PLAN_TO_READ':
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  }

  getStatusLabel(status?: string | null): string {
    switch (status) {
      case 'READING': return 'Lendo';
      case 'COMPLETED': return 'Completo';
      case 'ON_HOLD': return 'Em Espera';
      case 'DROPPED': return 'Abandonado';
      case 'PLAN_TO_READ': return 'Planejo Ler';
      default: return status || 'Lendo';
    }
  }
}
