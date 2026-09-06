import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeRecentItem } from '../../../../core/models';

@Component({
  selector: 'app-home-recent-card',
  standalone: true,
  imports: [CommonModule],
  host: {
    class: 'block h-full'
  },
  template: `
    <button
      type="button"
      (click)="open.emit(item)"
      class="group relative w-full h-full min-h-24 text-left rounded-xl overflow-hidden border border-slate-700/50
        bg-slate-800 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10
        transition-all duration-300 cursor-pointer flex">

      <!-- Cover (right half visible) -->
      <div class="absolute inset-0">
        @if (item.coverPath) {
          <img
            [src]="'local-cover:///' + item.coverPath"
            [alt]="item.title"
            class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
        } @else {
          <div class="w-full h-full bg-gradient-to-br from-slate-900 to-slate-800"></div>
        }
      </div>

      <!-- Extension tag on the right (over cover) -->
      <span
        class="absolute top-2 right-2 z-20 px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-950/80
          backdrop-blur-md border uppercase tracking-wider shadow pointer-events-none"
        [ngClass]="item.type === 'MANGA'
          ? 'text-indigo-300 border-indigo-500/30'
          : 'text-amber-300 border-amber-500/30'">
        {{ item.fileType }}
      </span>

      <!-- Left info panel — height driven by full title; siblings stretch via grid -->
      <div
        class="relative z-10 w-1/2 flex flex-col justify-center gap-1.5 px-3 py-3
          bg-slate-800
          after:content-[''] after:absolute after:inset-y-0 after:right-0 after:w-6
          after:bg-gradient-to-r after:from-slate-800 after:to-transparent after:translate-x-full">
        <h4
          class="relative z-10 text-sm font-bold text-slate-100 leading-snug break-words
            group-hover:text-indigo-300 transition-colors">
          {{ item.title }}
        </h4>

        <p class="relative z-10 text-[11px] text-slate-400 font-semibold tabular-nums">
          {{ progressLabel() }}
        </p>
      </div>
    </button>
  `
})
export class HomeRecentCardComponent {
  @Input({ required: true }) item!: HomeRecentItem;
  @Output() open = new EventEmitter<HomeRecentItem>();

  progressLabel(): string {
    const pages = Math.max(1, this.item.pages || 1);
    const mark = Math.max(0, this.item.bookMark || 0);
    if (this.item.completed || mark >= pages) return 'Concluído';
    if (mark <= 0) return 'Não iniciado';
    return `${mark + 1} / ${pages}`;
  }
}
