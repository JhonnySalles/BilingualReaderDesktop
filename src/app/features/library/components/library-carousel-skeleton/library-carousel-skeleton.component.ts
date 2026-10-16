import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-library-carousel-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full my-6 first:mt-1 animate-pulse">
      <!-- Skeleton Header -->
      <div class="flex items-center gap-3 mb-3">
        <div class="h-6 w-32 rounded-lg bg-slate-800"></div>
        <div class="h-4 w-16 rounded bg-slate-800/60"></div>
        <div class="h-px bg-slate-800/80 flex-1"></div>
      </div>

      <!-- Skeleton Shelf Track -->
      <div class="flex gap-4 overflow-hidden py-1">
        @for (item of dummyCards; track $index) {
          <div class="flex-none w-36 sm:w-40 rounded-xl bg-slate-900 border border-slate-800/80 overflow-hidden flex flex-col">
            <!-- Cover box -->
            <div class="aspect-[2/3] w-full bg-slate-800/70 relative">
              <div class="absolute top-2 left-2 w-10 h-4 rounded bg-slate-700/60"></div>
            </div>
            <!-- Title & text boxes -->
            <div class="p-2.5 flex flex-col gap-2">
              <div class="h-3.5 w-3/4 rounded bg-slate-800"></div>
              <div class="h-2.5 w-1/2 rounded bg-slate-800/60"></div>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class LibraryCarouselSkeletonComponent {
  dummyCards = Array(7).fill(0);
}
