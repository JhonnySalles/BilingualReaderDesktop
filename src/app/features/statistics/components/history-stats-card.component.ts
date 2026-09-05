import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HistoryStatisticsItem } from '../../../core/models';
import { formatShortDuration } from '../../../core/services/statistics.service';

@Component({
  selector: 'app-history-stats-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- STANDARD CARD STYLE -->
    @if (cardStyle === 'STANDARD') {
      <button
        type="button"
        (click)="open.emit(item)"
        class="group relative w-full text-left bg-slate-800/60 backdrop-blur-md rounded-xl overflow-hidden border border-slate-700/50 transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col h-full hover:shadow-xl"
        [ngClass]="cardHoverClass">

        <!-- Cover Image Container -->
        <div class="relative aspect-[2/3] w-full overflow-hidden bg-slate-900">
          @if (item.coverPath) {
            <img
              [src]="'local-cover:///' + item.coverPath"
              [alt]="item.title"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          } @else {
            <div class="w-full h-full flex flex-col items-center justify-center p-4 text-slate-500 bg-gradient-to-br from-slate-900 to-slate-800">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span class="text-xs uppercase tracking-wider opacity-75 font-semibold">{{ item.type === 'MANGA' ? 'Manga' : 'Livro' }}</span>
            </div>
          }

          <!-- Top Badges & Actions -->
          <div class="absolute top-2 left-2 right-2 flex justify-between items-center z-10 pointer-events-none">
            <span
              class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-950/80 backdrop-blur-md border uppercase tracking-wider shadow"
              [ngClass]="badgeClass">
              {{ item.type === 'MANGA' ? 'Manga' : 'Livro' }}
            </span>
            @if (item.favorite) {
              <span class="p-1 rounded-full bg-amber-500/90 text-slate-950 text-xs shadow-md font-bold leading-none">★</span>
            }
          </div>

          <!-- Bottom Session Stats overlay -->
          <div class="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent">
            <div class="flex justify-between text-[10px] text-slate-200 font-semibold">
              <span class="text-emerald-400">+{{ item.pagesRead }} pág.</span>
              <span>{{ formatTime(item.timeRead) }}</span>
            </div>
          </div>
        </div>

        <!-- Content Info -->
        <div class="p-3 flex flex-col flex-1 justify-between gap-2">
          <div>
            <h3
              class="text-sm font-semibold text-slate-100 line-clamp-2 sm:line-clamp-3 md:line-clamp-4 lg:line-clamp-5 transition-colors"
              [ngClass]="titleHoverClass"
              [title]="item.title">
              {{ item.title }}
            </h3>
            <p class="text-xs text-slate-400 line-clamp-1 mt-0.5">
              @if (item.type === 'MANGA') {
                {{ item.series || item.author || 'Desconhecido' }}
              } @else {
                {{ item.author || item.publisher || 'Autor Desconhecido' }}
              }
            </p>
            <p class="text-[10px] text-slate-500 mt-1">
              {{ item.sessionDate }} · {{ formatClock(item.lastAccess) }}
              @if (item.libraryName) {
                · {{ item.libraryName }}
              }
            </p>
          </div>

          <!-- Reading Progress Bar -->
          <div class="mt-1">
            <div class="flex justify-between items-center text-[10px] text-slate-400 mb-1">
              <span>Pág. {{ item.bookMark }} / {{ item.pages }}</span>
              <span>{{ progressPercent() }}%</span>
            </div>
            <div class="w-full h-1 bg-slate-700/60 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-300 bg-gradient-to-r"
                [ngClass]="barClass"
                [style.width.%]="progressPercent()"></div>
            </div>
          </div>
        </div>
      </button>
    }

    <!-- OVERLAY CARD STYLE -->
    @if (cardStyle === 'OVERLAY') {
      <button
        type="button"
        (click)="open.emit(item)"
        class="group relative aspect-[2/3] w-full text-left rounded-xl overflow-hidden border border-slate-700/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer flex flex-col justify-between bg-slate-900"
        [ngClass]="cardHoverClass">

        <!-- Background Cover Image -->
        @if (item.coverPath) {
          <img
            [src]="'local-cover:///' + item.coverPath"
            [alt]="item.title"
            class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        } @else {
          <div class="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-4 text-slate-500 bg-gradient-to-br from-slate-900 to-slate-800">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span class="text-xs uppercase tracking-wider opacity-75 font-semibold">{{ item.type === 'MANGA' ? 'Manga' : 'Livro' }}</span>
          </div>
        }

        <!-- Gradient Backdrop Shadow overlay -->
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>

        <!-- Top Badges & Actions -->
        <div class="relative z-10 p-2.5 flex justify-between items-center pointer-events-none">
          <span
            class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-950/80 backdrop-blur-md border uppercase tracking-wider shadow"
            [ngClass]="badgeClass">
            {{ item.type === 'MANGA' ? 'Manga' : 'Livro' }}
          </span>
          @if (item.favorite) {
            <span class="p-1 rounded-full bg-amber-500/90 text-slate-950 text-xs shadow-md font-bold leading-none">★</span>
          }
        </div>

        <!-- Bottom Blur Details Overlay -->
        <div class="relative z-10 p-3 bg-slate-950/75 backdrop-blur-md border-t border-slate-700/40">
          <div class="flex justify-between text-[10px] text-slate-300 mb-1 font-medium">
            <span class="text-emerald-400 font-semibold">+{{ item.pagesRead }} pág.</span>
            <span>{{ formatTime(item.timeRead) }}</span>
          </div>

          <h3
            class="text-sm font-semibold text-slate-100 line-clamp-2 sm:line-clamp-3 md:line-clamp-4 lg:line-clamp-5 transition-colors"
            [ngClass]="titleHoverClass"
            [title]="item.title">
            {{ item.title }}
          </h3>
          <p class="text-xs text-slate-300 line-clamp-1 mt-0.5 opacity-80">
            @if (item.type === 'MANGA') {
              {{ item.series || item.author || 'Desconhecido' }}
            } @else {
              {{ item.author || item.publisher || 'Autor Desconhecido' }}
            }
          </p>

          <!-- Reading Progress Bar -->
          <div class="mt-2">
            <div class="flex justify-between items-center text-[10px] text-slate-300 mb-1 font-mono opacity-90">
              <span>{{ item.bookMark }}/{{ item.pages }}p</span>
              <span>{{ progressPercent() }}%</span>
            </div>
            <div class="w-full h-1 bg-slate-800/80 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-300 bg-gradient-to-r"
                [ngClass]="barClass"
                [style.width.%]="progressPercent()"></div>
            </div>
          </div>
        </div>
      </button>
    }
  `
})
export class HistoryStatsCardComponent {
  @Input({ required: true }) item!: HistoryStatisticsItem;
  @Input() cardStyle: 'STANDARD' | 'OVERLAY' = 'STANDARD';
  @Output() open = new EventEmitter<HistoryStatisticsItem>();

  get cardHoverClass(): string {
    return this.item.type === 'MANGA'
      ? 'hover:border-indigo-500/50 hover:shadow-indigo-500/10'
      : 'hover:border-amber-500/50 hover:shadow-amber-500/10';
  }

  get badgeClass(): string {
    return this.item.type === 'MANGA'
      ? 'text-indigo-300 border-indigo-500/30'
      : 'text-amber-300 border-amber-500/30';
  }

  get titleHoverClass(): string {
    return this.item.type === 'MANGA' ? 'group-hover:text-indigo-400' : 'group-hover:text-amber-400';
  }

  get barClass(): string {
    return this.item.type === 'MANGA' ? 'from-indigo-500 to-purple-500' : 'from-amber-500 to-orange-500';
  }

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
