import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MangaLibraryComponent } from './manga-library/manga-library.component';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule, RouterModule, MangaLibraryComponent],
  template: `
    <div class="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <!-- Tabs Navigation -->
      <div class="px-8 pt-6 pb-2 flex items-center justify-between border-b border-slate-900">
        <div class="flex items-center gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button 
            (click)="activeTab.set('manga')"
            [class.bg-indigo-600]="activeTab() === 'manga'"
            [class.text-white]="activeTab() === 'manga'"
            class="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-400 transition-all cursor-pointer">
            Biblioteca de Mangás
          </button>
          <button 
            (click)="activeTab.set('epub')"
            [class.bg-indigo-600]="activeTab() === 'epub'"
            [class.text-white]="activeTab() === 'epub'"
            class="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-400 transition-all cursor-pointer">
            Livros (EPUB)
          </button>
        </div>
      </div>

      <!-- Tab Content -->
      <div class="flex-1 overflow-y-auto">
        @if (activeTab() === 'manga') {
          <app-manga-library></app-manga-library>
        } @else {
          <div class="flex flex-col items-center justify-center py-20 text-center text-slate-500">
            <h3 class="text-base font-semibold text-slate-400">Módulo de Livros (EPUB)</h3>
            <p class="text-xs mt-1">Biblioteca de livros digitais em desenvolvimento.</p>
          </div>
        }
      </div>
    </div>
  `
})
export class LibraryComponent {
  activeTab = signal<'manga' | 'epub'>('manga');
}
