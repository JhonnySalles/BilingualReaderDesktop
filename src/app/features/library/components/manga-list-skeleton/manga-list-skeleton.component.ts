import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-manga-list-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-slate-800/40 backdrop-blur-md rounded-lg p-2.5 border border-slate-700/40 flex items-center justify-between gap-4 animate-pulse">
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <div class="w-10 h-14 bg-slate-700/40 rounded flex-shrink-0"></div>
        <div class="space-y-2 min-w-0 flex-1">
          <div class="h-4 bg-slate-700/60 rounded w-1/3"></div>
          <div class="h-3 bg-slate-700/40 rounded w-1/4"></div>
        </div>
      </div>
      <div class="w-32 hidden sm:block space-y-1.5">
        <div class="h-2.5 bg-slate-700/40 rounded w-full"></div>
        <div class="h-1.5 bg-slate-700/50 rounded-full"></div>
      </div>
      <div class="w-16 h-3 bg-slate-700/40 rounded"></div>
    </div>
  `
})
export class MangaListSkeletonComponent {}
