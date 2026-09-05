import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HistoryStatisticsItem } from '../../../core/models';
import { formatShortDuration } from '../../../core/services/statistics.service';

@Component({
  selector: 'app-history-stats-list-item',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      (click)="open.emit(item)"
      class="group bg-slate-800/40 backdrop-blur-md rounded-lg p-2.5 border border-slate-700/40 hover:bg-slate-800/80 transition-all duration-200 cursor-pointer flex items-center justify-between gap-4"
      [ngClass]="item.type === 'MANGA' ? 'hover:border-indigo-500/40' : 'hover:border-amber-500/40'">

      <!-- Thumbnail & Info -->
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <div class="w-10 h-14 bg-slate-900 rounded overflow-hidden flex-shrink-0 relative border border-slate-700/50 flex items-center justify-center">
          @if (item.coverPath) {
            <img [src]="'local-cover:///' + item.coverPath" [alt]="item.title" class="w-full h-full object-cover" />
          } @else {
            <span
              class="text-[10px] font-bold uppercase"
              [ngClass]="item.type === 'MANGA' ? 'text-indigo-400' : 'text-amber-400'">
              {{ item.type === 'MANGA' ? 'Manga' : 'Livro' }}
            </span>
          }
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <h4
              class="text-sm font-medium text-slate-200 truncate transition-colors"
              [ngClass]="item.type === 'MANGA' ? 'group-hover:text-indigo-400' : 'group-hover:text-amber-400'"
              [title]="item.title">
              {{ item.title }}
            </h4>
            @if (item.favorite) {
              <span class="text-amber-400 text-xs">★</span>
            }
          </div>

          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
            <span
              class="px-1.5 py-0.5 rounded bg-slate-900/80 font-mono text-[10px] border border-slate-700/60 uppercase"
              [ngClass]="item.type === 'MANGA' ? 'text-indigo-300' : 'text-amber-300'">
              {{ item.type === 'MANGA' ? 'Manga' : 'Livro' }}
            </span>

            @if (item.series) {
              <span class="flex items-center gap-1 text-slate-300">
                <span class="text-slate-500 font-medium">Série:</span> {{ item.series }}
              </span>
            }
            @if (item.author) {
              <span class="flex items-center gap-1 text-slate-300">
                <span class="text-slate-500 font-medium">Autor:</span> {{ item.author }}
              </span>
            }
            @if (item.publisher) {
              <span class="flex items-center gap-1 text-slate-400">
                <span class="text-slate-500 font-medium">Editora:</span> {{ item.publisher }}
              </span>
            }

            <span class="text-slate-500">·</span>
            <span class="text-emerald-400 font-medium">
              +{{ item.pagesRead }} pág.
            </span>
            <span class="text-slate-400">
              ({{ formatTime(item.timeRead) }})
            </span>
            @if (item.libraryName) {
              <span class="text-slate-500">· {{ item.libraryName }}</span>
            }
          </div>
        </div>
      </div>

      <!-- Reading Progress & Time -->
      <div class="flex items-center gap-6 flex-shrink-0">
        <div class="w-32 hidden sm:block">
          <div class="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>{{ item.bookMark }}/{{ item.pages }} págs</span>
            <span>{{ progressPercent() }}%</span>
          </div>
          <div class="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-300 bg-gradient-to-r"
              [ngClass]="item.type === 'MANGA' ? 'from-indigo-500 to-purple-500' : 'from-amber-500 to-orange-500'"
              [style.width.%]="progressPercent()"></div>
          </div>
        </div>

        <div class="text-right text-xs text-slate-400 w-20 font-mono">
          {{ formatClock(item.lastAccess) || item.sessionDate }}
        </div>
      </div>

    </div>
  `
})
export class HistoryStatsListItemComponent {
  @Input({ required: true }) item!: HistoryStatisticsItem;
  @Output() open = new EventEmitter<HistoryStatisticsItem>();

  progressPercent(): number {
    if (!this.item.pages || this.item.pages <= 0) return 0;
    return Math.min(100, Math.round((this.item.bookMark / this.item.pages) * 100));
  }

  formatTime(seconds: number): string {
    return formatShortDuration(seconds);
  }

  formatClock(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
}
