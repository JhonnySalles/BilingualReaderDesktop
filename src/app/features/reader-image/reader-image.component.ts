import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

@Component({
  selector: 'app-reader-image',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="h-full flex flex-col bg-black text-slate-100 overflow-hidden">
      <!-- Toolbar Top -->
      <header class="h-14 px-6 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex items-center justify-between z-20">
        <div class="flex items-center gap-3">
          <a routerLink="/" class="p-2 text-slate-400 hover:text-slate-200 rounded-lg transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </a>
          <div>
            <h1 class="text-sm font-bold">Leitor de Mangá / CBZ</h1>
            <p class="text-[10px] text-slate-400">ID da Obra: {{ bookId }}</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs text-slate-400">Página 1 de 24</span>
        </div>
      </header>

      <!-- Reader Canvas Container -->
      <main class="flex-1 overflow-y-auto flex items-center justify-center p-4">
        <div class="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-lg p-12 text-center shadow-2xl">
          <div class="w-20 h-20 mx-auto rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
            <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          </div>
          <h2 class="text-lg font-bold text-slate-200 mb-2">Visualizador de Imagens (CBZ/CBR/ZIP)</h2>
          <p class="text-xs text-slate-400 max-w-md mx-auto">
            Integração pronta com descompactador Node.js em memória (adm-zip / yauzl). As páginas descompactadas serão renderizadas aqui em alta performance.
          </p>
        </div>
      </main>
    </div>
  `
})
export class ReaderImageComponent {
  private route = inject(ActivatedRoute);
  bookId = this.route.snapshot.paramMap.get('id');
}
