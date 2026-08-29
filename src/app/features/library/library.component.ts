import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface BookItem {
  id: string;
  title: string;
  type: 'manga' | 'epub';
  cover: string;
  chaptersOrPages: string;
  progress: number;
  lastRead: string;
}

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <!-- Top Action Bar -->
      <div class="px-8 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold tracking-tight text-slate-100">Sua Prateleira de Leitura</h2>
          <p class="text-xs text-slate-400 mt-0.5">Gerencie e leia seus mangás, HQs e ebooks offline</p>
        </div>

        <!-- Add Button -->
        <button 
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/25 flex items-center gap-2 cursor-pointer">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Adicionar Novo Arquivo
        </button>
      </div>

      <!-- Filters & Content -->
      <main class="flex-1 overflow-y-auto px-8 pb-8">
        <!-- Tabs -->
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <button 
              (click)="activeTab.set('all')"
              [class.bg-indigo-600]="activeTab() === 'all'"
              [class.text-white]="activeTab() === 'all'"
              class="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-400 transition-all cursor-pointer">
              Todos os Itens
            </button>
            <button 
              (click)="activeTab.set('manga')"
              [class.bg-indigo-600]="activeTab() === 'manga'"
              [class.text-white]="activeTab() === 'manga'"
              class="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-400 transition-all cursor-pointer">
              Mangás / HQs
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

        <!-- Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          @for (book of filteredBooks(); track book.id) {
            <div 
              [routerLink]="book.type === 'manga' ? ['/reader-image', book.id] : ['/reader-text', book.id]" 
              class="group relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800/80 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 cursor-pointer flex flex-col">
              
              <!-- Cover Placeholder -->
              <div class="relative aspect-[3/4] bg-slate-950 overflow-hidden flex items-center justify-center">
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10 opacity-60"></div>
                <div class="text-slate-600 font-bold text-base group-hover:scale-105 transition-transform duration-300">
                  {{ book.type === 'manga' ? 'HQ / Mangá' : 'Ebook' }}
                </div>
                <span class="absolute top-3 right-3 z-20 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-slate-900/90 text-indigo-400 backdrop-blur border border-indigo-500/30">
                  {{ book.type }}
                </span>
              </div>

              <!-- Details -->
              <div class="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 class="font-bold text-xs text-slate-200 line-clamp-1 group-hover:text-indigo-400 transition-colors">{{ book.title }}</h3>
                  <p class="text-[11px] text-slate-400 mt-1">{{ book.chaptersOrPages }}</p>
                </div>

                <!-- Progress Bar -->
                <div class="mt-4">
                  <div class="flex justify-between text-[10px] text-slate-400 mb-1 font-medium">
                    <span>Progresso</span>
                    <span>{{ book.progress }}%</span>
                  </div>
                  <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div class="h-full bg-indigo-500 rounded-full" [style.width.%]="book.progress"></div>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      </main>
    </div>
  `
})
export class LibraryComponent {
  activeTab = signal<'all' | 'manga' | 'epub'>('all');

  books = signal<BookItem[]>([
    {
      id: '1',
      title: 'Solo Leveling - Vol. 01',
      type: 'manga',
      cover: '',
      chaptersOrPages: 'Capítulo 12 / 45',
      progress: 25,
      lastRead: 'Há 2 horas'
    },
    {
      id: '2',
      title: 'O Problema dos Três Corpos',
      type: 'epub',
      cover: '',
      chaptersOrPages: 'Página 140 / 410',
      progress: 34,
      lastRead: 'Ontem'
    },
    {
      id: '3',
      title: 'Chainsaw Man - Vol. 05',
      type: 'manga',
      cover: '',
      chaptersOrPages: 'Capítulo 38 / 38',
      progress: 100,
      lastRead: 'Há 3 dias'
    }
  ]);

  filteredBooks = () => {
    const tab = this.activeTab();
    if (tab === 'all') return this.books();
    return this.books().filter(b => b.type === tab);
  };
}
