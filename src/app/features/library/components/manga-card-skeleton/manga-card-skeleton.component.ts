import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-manga-card-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-slate-800/40 backdrop-blur-md rounded-xl overflow-hidden border border-slate-700/30 flex flex-col h-full animate-pulse">
      <!-- Cover Container Skeleton -->
      <div class="aspect-[2/3] w-full bg-slate-700/40 relative">
        <div class="absolute top-2 left-2 w-12 h-4 bg-slate-600/50 rounded-md"></div>
      </div>
      
      <!-- Content Skeleton -->
      <div class="p-3 flex flex-col flex-1 justify-between gap-3">
        <div class="space-y-2">
          <div class="h-4 bg-slate-700/60 rounded w-3/4"></div>
          <div class="h-3 bg-slate-700/40 rounded w-1/2"></div>
        </div>

        <!-- Progress Skeleton -->
        <div class="space-y-1.5 mt-2">
          <div class="flex justify-between">
            <div class="h-2.5 bg-slate-700/40 rounded w-1/3"></div>
            <div class="h-2.5 bg-slate-700/40 rounded w-1/6"></div>
          </div>
          <div class="w-full h-1.5 bg-slate-700/50 rounded-full"></div>
        </div>
      </div>
    </div>
  `
})
export class MangaCardSkeletonComponent {}
