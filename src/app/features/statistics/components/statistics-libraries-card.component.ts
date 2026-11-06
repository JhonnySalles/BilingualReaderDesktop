import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LibraryStatsItem } from '../../../core/models';
import { formatReadingDuration } from '../../../core/services/statistics.service';

@Component({
  selector: 'app-statistics-libraries-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-sm mb-8 animate-fade-in-up">
      <!-- Header do Card -->
      <div class="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div class="flex items-center gap-3">
          <span class="text-2xl">🏛️</span>
          <div>
            <h2 class="text-sm font-bold tracking-wider text-slate-100 uppercase">
              Estatísticas por Biblioteca
            </h2>
            <p class="text-xs text-slate-400">
              Métricas de leitura, progresso e tempo dedicado por biblioteca
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary-500/10 text-primary-400 border border-primary-500/20">
            {{ stats.manga.length }} {{ stats.manga.length === 1 ? 'Biblioteca de Mangás' : 'Bibliotecas de Mangás' }}
          </span>
          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary-500/10 text-primary-400 border border-primary-500/20">
            {{ stats.book.length }} {{ stats.book.length === 1 ? 'Biblioteca de Livros' : 'Bibliotecas de Livros' }}
          </span>
        </div>
      </div>

      <!-- Separador Estilizado: Mangás -->
      <div class="relative mb-6">
        <div class="absolute inset-0 flex items-center" aria-hidden="true">
          <div class="w-full border-t border-slate-800"></div>
        </div>
        <div class="relative flex justify-center">
          <span class="bg-slate-900 px-4 py-1 text-xs font-medium text-slate-400 rounded-full border border-slate-800 shadow-sm flex items-center gap-2">
            <span>🎨</span> Bibliotecas de Mangás & Comics
          </span>
        </div>
      </div>

      <!-- Seção: Mangás & Comics -->
      <div class="space-y-4">
        <div class="flex items-center gap-2">
          <span class="text-base">🎨</span>
          <h3 class="text-xs font-bold uppercase tracking-wider text-[#818cf8]">
            Bibliotecas de Mangás & Comics
          </h3>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (lib of stats.manga; track lib.id) {
            <div class="rounded-xl bg-slate-800/80 border border-slate-700/80 p-4 space-y-3 hover:border-[#6366f1]/60 hover:bg-slate-800 transition-all duration-200">
              <!-- Topo do Card -->
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-2 h-2 rounded-full bg-[#6366f1] shrink-0"></span>
                  <h4 class="text-sm font-semibold text-slate-200 truncate" [title]="lib.title">{{ lib.title }}</h4>
                </div>
                <span class="text-[11px] font-mono text-slate-400 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-700/60 shrink-0">
                  {{ lib.totalFiles }} {{ lib.totalFiles === 1 ? 'obra' : 'obras' }}
                </span>
              </div>

              <!-- Progresso Geral -->
              <div class="space-y-1">
                <div class="flex justify-between text-[10px] text-slate-400">
                  <span>Progresso Geral</span>
                  <span class="font-medium text-slate-300">{{ calcPercent(lib.completed, lib.totalFiles) }}% ({{ lib.completed }}/{{ lib.totalFiles }})</span>
                </div>
                <div class="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700/40">
                  <div
                    class="h-full bg-gradient-to-r from-[#6366f1] to-[#818cf8] rounded-full transition-all duration-500"
                    [style.width.%]="calcPercent(lib.completed, lib.totalFiles)"></div>
                </div>
              </div>

              <!-- Grade de 5 Métricas -->
              <div class="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-1 border-t border-slate-700/50">
                <div class="text-center p-1.5 rounded bg-slate-900/60">
                  <p class="text-[9px] uppercase font-medium text-slate-400 mb-0.5">Concluído</p>
                  <p class="text-xs font-bold text-primary-600 tabular-nums">{{ lib.completed }}</p>
                </div>
                <div class="text-center p-1.5 rounded bg-slate-900/60">
                  <p class="text-[9px] uppercase font-medium text-slate-400 mb-0.5">Lendo</p>
                  <p class="text-xs font-semibold text-primary-400 tabular-nums">{{ lib.reading }}</p>
                </div>
                <div class="text-center p-1.5 rounded bg-slate-900/60">
                  <p class="text-[9px] uppercase font-medium text-slate-400 mb-0.5">No Mês</p>
                  <p class="text-xs font-semibold text-primary-400 tabular-nums">{{ lib.readThisMonth }}</p>
                </div>
                <div class="text-center p-1.5 rounded bg-slate-900/60">
                  <p class="text-[9px] uppercase font-medium text-slate-400 mb-0.5">Páginas</p>
                  <p class="text-xs font-semibold text-slate-200 tabular-nums">{{ lib.totalPagesRead }}</p>
                </div>
                <div class="text-center p-1.5 rounded bg-slate-900/60 col-span-2 sm:col-span-1">
                  <p class="text-[9px] uppercase font-medium text-slate-400 mb-0.5">Tempo</p>
                  <p class="text-xs font-semibold text-slate-200">{{ formatDuration(lib.totalTimeSeconds) }}</p>
                </div>
              </div>
            </div>
          } @empty {
            <div class="col-span-full py-6 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
              Nenhuma biblioteca de mangás encontrada.
            </div>
          }
        </div>
      </div>

      <!-- Separador Estilizado -->
      <div class="relative my-8">
        <div class="absolute inset-0 flex items-center" aria-hidden="true">
          <div class="w-full border-t border-slate-800"></div>
        </div>
        <div class="relative flex justify-center">
          <span class="bg-slate-900 px-4 py-1 text-xs font-medium text-slate-400 rounded-full border border-slate-800 shadow-sm flex items-center gap-2">
            <span>📚</span> Bibliotecas de Livros & EPUBs
          </span>
        </div>
      </div>

      <!-- Seção: Livros & EPUBs -->
      <div class="space-y-4">
        <div class="flex items-center gap-2">
          <span class="text-base">📚</span>
          <h3 class="text-xs font-bold uppercase tracking-wider text-amber-400">
            Bibliotecas de Livros & EPUBs
          </h3>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (lib of stats.book; track lib.id) {
            <div class="rounded-xl bg-slate-800/80 border border-slate-700/80 p-4 space-y-3 hover:border-amber-500/60 hover:bg-slate-800 transition-all duration-200">
              <!-- Topo do Card -->
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                  <h4 class="text-sm font-semibold text-slate-200 truncate" [title]="lib.title">{{ lib.title }}</h4>
                </div>
                <span class="text-[11px] font-mono text-slate-400 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-700/60 shrink-0">
                  {{ lib.totalFiles }} {{ lib.totalFiles === 1 ? 'obra' : 'obras' }}
                </span>
              </div>

              <!-- Progresso Geral -->
              <div class="space-y-1">
                <div class="flex justify-between text-[10px] text-slate-400">
                  <span>Progresso Geral</span>
                  <span class="font-medium text-slate-300">{{ calcPercent(lib.completed, lib.totalFiles) }}% ({{ lib.completed }}/{{ lib.totalFiles }})</span>
                </div>
                <div class="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700/40">
                  <div
                    class="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                    [style.width.%]="calcPercent(lib.completed, lib.totalFiles)"></div>
                </div>
              </div>

              <!-- Grade de 5 Métricas -->
              <div class="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-1 border-t border-slate-700/50">
                <div class="text-center p-1.5 rounded bg-slate-900/60">
                  <p class="text-[9px] uppercase font-medium text-slate-400 mb-0.5">Concluído</p>
                  <p class="text-xs font-bold text-primary-600 tabular-nums">{{ lib.completed }}</p>
                </div>
                <div class="text-center p-1.5 rounded bg-slate-900/60">
                  <p class="text-[9px] uppercase font-medium text-slate-400 mb-0.5">Lendo</p>
                  <p class="text-xs font-semibold text-primary-400 tabular-nums">{{ lib.reading }}</p>
                </div>
                <div class="text-center p-1.5 rounded bg-slate-900/60">
                  <p class="text-[9px] uppercase font-medium text-slate-400 mb-0.5">No Mês</p>
                  <p class="text-xs font-semibold text-primary-400 tabular-nums">{{ lib.readThisMonth }}</p>
                </div>
                <div class="text-center p-1.5 rounded bg-slate-900/60">
                  <p class="text-[9px] uppercase font-medium text-slate-400 mb-0.5">Páginas</p>
                  <p class="text-xs font-semibold text-slate-200 tabular-nums">{{ lib.totalPagesRead }}</p>
                </div>
                <div class="text-center p-1.5 rounded bg-slate-900/60 col-span-2 sm:col-span-1">
                  <p class="text-[9px] uppercase font-medium text-slate-400 mb-0.5">Tempo</p>
                  <p class="text-xs font-semibold text-slate-200">{{ formatDuration(lib.totalTimeSeconds) }}</p>
                </div>
              </div>
            </div>
          } @empty {
            <div class="col-span-full py-6 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
              Nenhuma biblioteca de livros encontrada.
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class StatisticsLibrariesCardComponent {
  @Input() stats: { manga: LibraryStatsItem[]; book: LibraryStatsItem[] } = { manga: [], book: [] };

  formatDuration(seconds: number): string {
    return formatReadingDuration(seconds);
  }

  calcPercent(completed: number, total: number): number {
    return total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  }
}
