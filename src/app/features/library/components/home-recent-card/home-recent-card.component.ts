import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeRecentItem } from '../../../../core/models';

@Component({
  selector: 'app-home-recent-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      (click)="open.emit(item)"
      class="group w-full text-left bg-slate-800/60 backdrop-blur-md rounded-xl overflow-hidden border border-slate-700/50
        hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1
        transition-all duration-300 cursor-pointer flex flex-col h-full">
      <div class="relative aspect-[2/3] w-full overflow-hidden bg-slate-900">
        @if (item.coverPath) {
          <img
            [src]="'local-cover:///' + item.coverPath"
            [alt]="item.title"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        } @else {
          <div class="w-full h-full flex flex-col items-center justify-center p-4 text-slate-500 bg-gradient-to-br from-slate-900 to-slate-800">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span class="text-[10px] uppercase tracking-wider font-semibold opacity-75">{{ item.fileType }}</span>
          </div>
        }

        <div class="absolute top-2 left-2 right-2 flex justify-between items-center z-10 pointer-events-none">
          <span
            class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-950/80 backdrop-blur-md border uppercase tracking-wider shadow"
            [ngClass]="item.type === 'MANGA'
              ? 'text-indigo-300 border-indigo-500/30'
              : 'text-amber-300 border-amber-500/30'">
            {{ item.fileType }}
          </span>
        </div>

        <div class="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent">
          <div class="h-1.5 rounded-full bg-slate-700/80 overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              [ngClass]="item.type === 'MANGA' ? 'bg-indigo-500' : 'bg-amber-500'"
              [style.width.%]="progressPercent()"></div>
          </div>
          <p class="text-[10px] text-slate-300 font-semibold mt-1 tabular-nums">
            {{ progressLabel() }}
          </p>
        </div>
      </div>

      <div class="p-3 flex flex-col gap-0.5 min-h-[3.5rem]">
        <h4 class="text-sm font-bold text-slate-100 line-clamp-2 group-hover:text-indigo-300 transition-colors leading-snug">
          {{ item.title }}
        </h4>
        <p class="text-[10px] text-slate-500 uppercase tracking-wider">
          {{ item.type === 'MANGA' ? 'Mangá' : 'Livro' }}
        </p>
      </div>
    </button>
  `
})
export class HomeRecentCardComponent {
  @Input({ required: true }) item!: HomeRecentItem;
  @Output() open = new EventEmitter<HomeRecentItem>();

  progressPercent(): number {
    const pages = Math.max(1, this.item.pages || 1);
    const mark = Math.max(0, this.item.bookMark || 0);
    return Math.min(100, Math.round((mark / pages) * 100));
  }

  progressLabel(): string {
    const pages = Math.max(1, this.item.pages || 1);
    const mark = Math.max(0, this.item.bookMark || 0);
    if (this.item.completed || mark >= pages) return 'Concluído';
    if (mark <= 0) return 'Não iniciado';
    return `${mark + 1} / ${pages} · ${this.progressPercent()}%`;
  }
}
