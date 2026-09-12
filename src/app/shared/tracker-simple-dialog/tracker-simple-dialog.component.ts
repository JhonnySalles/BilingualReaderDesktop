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
import { Track, TrackStatus } from '../../core/models';
import { TrackerService } from '../../core/services/tracker.service';

@Component({
  selector: 'app-tracker-simple-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (open) {
      <div
        class="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
        (click)="cancel.emit()">
        <div
          class="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
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
                  Rastreamento de Leitura
                </h3>
                <p class="text-[11px] text-slate-400 mt-0.5 truncate max-w-[18rem]" [title]="mediaTitle || mediaFilename">
                  {{ mediaTitle || mediaFilename || 'Vincular com MyAnimeList / AniList' }}
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

          <!-- Body -->
          <div class="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar text-xs">
            
            <!-- 1. Seleção e Busca de Rastreador na Biblioteca -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Rastreador Vinculado <span class="text-rose-400">*</span>
                </label>
                @if (selectedTrack()) {
                  <button
                    type="button"
                    (click)="onOpenFullConfig()"
                    class="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 underline cursor-pointer">
                    Editar Configurações
                  </button>
                }
              </div>

              <!-- Input de filtro se houver múltiplos trackers -->
              @if (availableTracks().length > 5) {
                <div class="relative mb-2">
                  <input
                    type="text"
                    [(ngModel)]="searchQuery"
                    placeholder="Filtrar rastreadores por título..."
                    class="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 text-xs focus:outline-none focus:border-indigo-500/60" />
                  <svg class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </div>
              }

              <select
                [ngModel]="selectedTrackId()"
                (ngModelChange)="onTrackSelected($event)"
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 text-xs font-medium cursor-pointer">
                <option [ngValue]="null">-- Nenhum rastreador selecionado --</option>
                @for (t of filteredTracks(); track t.id) {
                  <option [ngValue]="t.id">
                    {{ t.title || 'Sem título' }} {{ t.malId ? '[MAL: ' + t.malId + ']' : '' }} {{ t.aniId ? '[AL: ' + t.aniId + ']' : '' }}
                  </option>
                }
              </select>

              @if (availableTracks().length === 0 && !isLoading()) {
                <p class="text-[10px] text-amber-400/90 mt-1.5">
                  Nenhum rastreador cadastrado nesta biblioteca.
                  <button type="button" (click)="onOpenFullConfig()" class="underline font-bold ml-1 cursor-pointer">Criar novo</button>
                </p>
              }
            </div>

            <!-- 2. Detalhes e Status do Rastreador Selecionado -->
            @if (selectedTrack(); as track) {
              <!-- Badge IDs externos -->
              <div class="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-bold text-slate-200 truncate max-w-[14rem]" [title]="track.title || ''">
                    {{ track.title }}
                  </span>
                  <div class="flex items-center gap-1.5">
                    @if (track.malId) {
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25">
                        MAL: {{ track.malId }}
                      </span>
                    }
                    @if (track.aniId) {
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/25">
                        AniList: {{ track.aniId }}
                      </span>
                    }
                  </div>
                </div>

                <!-- Status de Leitura & Nota -->
                <div class="grid grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label class="block text-[9px] uppercase font-bold text-slate-500 mb-0.5">Status</label>
                    <select
                      [(ngModel)]="status"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs">
                      <option value="READING">Lendo (Reading)</option>
                      <option value="COMPLETED">Completo (Completed)</option>
                      <option value="ON_HOLD">Em Espera (On Hold)</option>
                      <option value="DROPPED">Abandonado (Dropped)</option>
                      <option value="PLAN_TO_READ">Planejo Ler (Plan to Read)</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[9px] uppercase font-bold text-slate-500 mb-0.5">Nota (0 - 10)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="10"
                      [(ngModel)]="score"
                      placeholder="Sem nota"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs" />
                  </div>
                </div>

                <!-- Capítulos & Volumes -->
                <div class="grid grid-cols-2 gap-2.5 pt-1">
                  <!-- Capítulos -->
                  <div class="p-2 rounded-lg bg-slate-900/90 border border-slate-750">
                    <span class="block text-[10px] font-semibold text-indigo-300 mb-1">Capítulos</span>
                    <div class="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        [(ngModel)]="chaptersRead"
                        class="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 font-mono text-xs text-center" />
                      <span class="text-slate-500 font-bold">/</span>
                      <span class="text-slate-400 font-mono text-xs px-1">
                        {{ track.totalChapters || '?' }}
                      </span>
                    </div>
                  </div>

                  <!-- Volumes -->
                  <div class="p-2 rounded-lg bg-slate-900/90 border border-slate-750">
                    <span class="block text-[10px] font-semibold text-amber-300 mb-1">Volumes</span>
                    <div class="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        [(ngModel)]="volumesRead"
                        class="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 font-mono text-xs text-center" />
                      <span class="text-slate-500 font-bold">/</span>
                      <span class="text-slate-400 font-mono text-xs px-1">
                        {{ track.totalVolumes || '?' }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Botão Sincronizar -->
                <div class="pt-2">
                  <button
                    type="button"
                    (click)="syncExternalServices()"
                    [disabled]="isSyncing()"
                    class="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-indigo-300 hover:text-indigo-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50">
                    @if (isSyncing()) {
                      <div class="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                      <span>Sincronizando com MAL / AniList...</span>
                    } @else {
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                      </svg>
                      <span>Sincronizar Agora (MAL & AniList)</span>
                    }
                  </button>

                  <!-- Mensagens de Sync -->
                  @if (syncFeedback()) {
                    <p class="text-[10px] mt-1.5 text-center font-medium"
                      [class.text-emerald-400]="syncFeedback()!.success"
                      [class.text-rose-400]="!syncFeedback()!.success">
                      {{ syncFeedback()!.message }}
                    </p>
                  }
                </div>

              </div>
            }

          </div>

          <!-- Footer Actions -->
          <div class="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
            <button
              type="button"
              (click)="onOpenFullConfig()"
              class="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer">
              Configurações Avançadas
            </button>

            <div class="flex items-center gap-2.5">
              <button
                type="button"
                (click)="cancel.emit()"
                class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button
                type="button"
                (click)="onConfirm()"
                [disabled]="!selectedTrack()"
                class="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white shadow-lg shadow-indigo-600/25 transition-all cursor-pointer">
                Confirmar
              </button>
            </div>
          </div>

        </div>
      </div>
    }
  `
})
export class TrackerSimpleDialogComponent implements OnInit, OnChanges {
  private trackerService = inject(TrackerService);

  @Input() open = false;
  @Input() libraryId: number = 0;
  @Input() mediaTitle: string = '';
  @Input() mediaFilename: string = '';
  @Input() initialVolume?: number | null = null;
  @Input() initialChapter?: number | null = null;

  @Output() confirmed = new EventEmitter<Track>();
  @Output() cancel = new EventEmitter<void>();
  @Output() openFullConfig = new EventEmitter<Track | null>();

  availableTracks = signal<Track[]>([]);
  selectedTrackId = signal<number | null>(null);
  selectedTrack = signal<Track | null>(null);
  isLoading = signal<boolean>(false);
  isSyncing = signal<boolean>(false);
  syncFeedback = signal<{ success: boolean; message: string } | null>(null);

  searchQuery = '';
  status: TrackStatus = 'READING';
  score: number | null = null;
  chaptersRead: number = 0;
  volumesRead: number = 0;

  filteredTracks = computed(() => {
    const q = this.searchQuery.trim().toLowerCase();
    const list = this.availableTracks();
    if (!q) return list;
    return list.filter(t => (t.title || '').toLowerCase().includes(q));
  });

  async ngOnInit(): Promise<void> {
    if (this.open && this.libraryId) {
      await this.loadLibraryTracks();
    }
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['open'] && this.open) {
      this.searchQuery = '';
      this.syncFeedback.set(null);
      await this.loadLibraryTracks();
    }
  }

  private async loadLibraryTracks(): Promise<void> {
    if (!this.libraryId) return;

    this.isLoading.set(true);
    try {
      const tracks = await this.trackerService.getTracksByLibrary(this.libraryId);
      this.availableTracks.set(tracks || []);

      // Auto-match track if possible
      const matchRes = await this.trackerService.matchTrack({
        libraryId: this.libraryId,
        title: this.mediaTitle || '',
        filename: this.mediaFilename || ''
      });

      if (matchRes?.track) {
        this.selectTrack(matchRes.track);
      } else if (tracks && tracks.length > 0) {
        // Fallback: select first track if none matched
        this.selectTrack(tracks[0]);
      } else {
        this.selectedTrackId.set(null);
        this.selectedTrack.set(null);
      }
    } catch (e) {
      console.warn('[TrackerSimpleDialog] Erro ao carregar trackers:', e);
      this.availableTracks.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  onTrackSelected(trackId: number | null): void {
    this.selectedTrackId.set(trackId);
    if (!trackId) {
      this.selectedTrack.set(null);
      return;
    }
    const track = this.availableTracks().find(t => t.id === trackId);
    if (track) {
      this.selectTrack(track);
    }
  }

  private selectTrack(track: Track): void {
    this.selectedTrackId.set(track.id ?? null);
    this.selectedTrack.set(track);
    this.status = (track.status as TrackStatus) || 'READING';
    this.score = track.score ?? null;
    this.chaptersRead = track.chaptersRead ?? this.initialChapter ?? 0;
    this.volumesRead = track.volumesRead ?? this.initialVolume ?? 0;
  }

  async syncExternalServices(): Promise<void> {
    const track = this.selectedTrack();
    if (!track) return;

    this.isSyncing.set(true);
    this.syncFeedback.set(null);

    try {
      const updatedTrack: Track = {
        ...track,
        chaptersRead: Number(this.chaptersRead) || 0,
        volumesRead: Number(this.volumesRead) || 0,
        status: this.status,
        score: this.score
      };

      const syncResult = await this.trackerService.syncTrackWithExternalServices(updatedTrack);
      if (syncResult.error) {
        this.syncFeedback.set({
          success: false,
          message: `Sincronização com avisos: ${syncResult.error}`
        });
      } else {
        this.syncFeedback.set({
          success: true,
          message: 'Sincronizado com sucesso com MAL e/ou AniList!'
        });
      }
    } catch (e: any) {
      this.syncFeedback.set({
        success: false,
        message: `Falha ao sincronizar: ${e?.message || e}`
      });
    } finally {
      this.isSyncing.set(false);
    }
  }

  async onConfirm(): Promise<void> {
    const current = this.selectedTrack();
    if (!current?.id) return;

    const payload: Partial<Track> = {
      ...current,
      chaptersRead: Number(this.chaptersRead) || 0,
      volumesRead: Number(this.volumesRead) || 0,
      status: this.status,
      score: this.score,
      scoreDate: this.score ? new Date().toISOString() : current.scoreDate
    };

    const saved = await this.trackerService.saveTrack(payload);
    if (saved) {
      this.confirmed.emit(saved);
    }
  }

  onOpenFullConfig(): void {
    this.openFullConfig.emit(this.selectedTrack());
  }
}
