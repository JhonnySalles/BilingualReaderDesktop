import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

@Component({
  selector: 'app-reader-text',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <!-- Toolbar Top -->
      <header class="h-14 px-6 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex items-center justify-between z-20">
        <div class="flex items-center gap-3">
          <a routerLink="/" class="p-2 text-slate-400 hover:text-slate-200 rounded-lg transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </a>
          <div>
            <h1 class="text-sm font-bold">Leitor de Ebook EPUB</h1>
            <p class="text-[10px] text-slate-400">ID do Livro: {{ bookId }}</p>
          </div>
        </div>
      </header>

      <!-- Reader Container -->
      <main class="flex-1 overflow-y-auto flex items-center justify-center p-8">
        <div class="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl text-center">
          <div class="w-16 h-16 mx-auto rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
          </div>
          <h2 class="text-lg font-bold text-slate-200 mb-2">Visualizador EPUB (epubjs)</h2>
          <p class="text-xs text-slate-400 leading-relaxed mb-6">
            Preparado para renderizar arquivos EPUB via epubjs no Angular com suporte a temas dinâmicos (Dark / Sepia / Light), controle de tamanho de fontes e paginação suave.
          </p>
        </div>
      </main>
    </div>
  `
})
export class ReaderTextComponent {
  private route = inject(ActivatedRoute);
  bookId = this.route.snapshot.paramMap.get('id');
}
