import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ElectronService } from '../../core/services/electron.service';

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
    <div class="h-full flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
      <!-- Header / Bar -->
      <header class="h-16 px-6 bg-slate-800/80 backdrop-blur border-b border-slate-700/60 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-600/30">
            B
          </div>
          <div>
            <h1 class="text-lg font-bold tracking-wide">Bilingual Reader</h1>
            <p class="text-xs text-slate-400">Desktop & Offline Library</p>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <!-- IPC Status -->
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-2"></span>
            {{ ipcStatus() }}
          </span>

          <button 
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-white text-sm font-medium rounded-lg shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Adicionar Mídia
          </button>
        </div>
      </header>

      <!-- Main Content -->
      <main class="flex-1 overflow-y-auto p-6">
        <!-- Tabs & Filters -->
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700/50">
            <button 
              (click)="activeTab.set('all')"
              [class.bg-indigo-600]="activeTab() === 'all'"
              [class.text-white]="activeTab() === 'all'"
              class="px-4 py-1.5 rounded-md text-xs font-semibold text-slate-400 transition-colors cursor-pointer">
              Todos
            </button>
            <button 
              (click)="activeTab.set('manga')"
              [class.bg-indigo-600]="activeTab() === 'manga'"
              [class.text-white]="activeTab() === 'manga'"
              class="px-4 py-1.5 rounded-md text-xs font-semibold text-slate-400 transition-colors cursor-pointer">
              Mangás / HQ (CBZ/CBR)
            </button>
            <button 
              (click)="activeTab.set('epub')"
              [class.bg-indigo-600]="activeTab() === 'epub'"
              [class.text-white]="activeTab() === 'epub'"
              class="px-4 py-1.5 rounded-md text-xs font-semibold text-slate-400 transition-colors cursor-pointer">
              Ebooks (EPUB)
            </button>
          </div>

          <a routerLink="/settings" class="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Configurações
          </a>
        </div>

        <!-- Grid of Books/Mangas -->
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          @for (book of filteredBooks(); track book.id) {
            <div [routerLink]="book.type === 'manga' ? ['/reader-image', book.id] : ['/reader-text', book.id]" class="group relative bg-slate-800 rounded-xl overflow-hidden border border-slate-700/50 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 cursor-pointer flex flex-col">
              <!-- Cover Image Placeholder -->
              <div class="relative aspect-[3/4] bg-slate-950 overflow-hidden flex items-center justify-center">
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent z-10"></div>
                <div class="text-slate-600 font-bold text-lg group-hover:scale-105 transition-transform duration-300">
                  {{ book.type === 'manga' ? 'HQ / Mangá' : 'Ebook' }}
                </div>
                <span class="absolute top-2 right-2 z-20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-900/80 text-indigo-400 backdrop-blur border border-indigo-500/30">
                  {{ book.type }}
                </span>
              </div>

              <!-- Metadata -->
              <div class="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <h3 class="font-semibold text-sm line-clamp-1 group-hover:text-indigo-400 transition-colors">{{ book.title }}</h3>
                  <p class="text-xs text-slate-400 mt-0.5">{{ book.chaptersOrPages }}</p>
                </div>

                <!-- Progress Bar -->
                <div class="mt-3">
                  <div class="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Progresso</span>
                    <span>{{ book.progress }}%</span>
                  </div>
                  <div class="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
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
export class LibraryComponent implements OnInit {
  private electronService = inject(ElectronService);

  ipcStatus = signal<string>('Conectando IPC...');
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

  async ngOnInit() {
    const res = await this.electronService.ping();
    this.ipcStatus.set(res);
  }
}
