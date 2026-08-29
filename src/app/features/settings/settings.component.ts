import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="h-full flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
      <!-- Header -->
      <header class="h-16 px-6 bg-slate-800/80 backdrop-blur border-b border-slate-700/60 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <a routerLink="/" class="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </a>
          <h1 class="text-lg font-bold">Configurações</h1>
        </div>
      </header>

      <!-- Main Content -->
      <main class="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
        <!-- Section: Diretórios -->
        <div class="bg-slate-800 rounded-xl p-5 border border-slate-700/60 shadow-lg">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-indigo-400 mb-4">Pastas da Biblioteca</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-xs text-slate-400 mb-1">Caminho da pasta local de Mangás/Ebooks</label>
              <div class="flex gap-3">
                <input type="text" readonly value="C:\Users\Jhonny\Documents\BilingualReader" class="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none">
                <button class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-xs font-semibold rounded-lg transition-colors cursor-pointer">
                  Alterar Pasta
                </button>
              </div>
            </div>
            <div class="flex items-center justify-between pt-2">
              <div>
                <span class="text-sm font-medium">Sincronização em Tempo Real (Chokidar)</span>
                <p class="text-xs text-slate-400">Detecta novos arquivos adicionados à pasta automaticamente</p>
              </div>
              <input type="checkbox" checked class="w-5 h-5 accent-indigo-600 rounded cursor-pointer">
            </div>
          </div>
        </div>

        <!-- Section: Leitor de Imagem (Mangá / Comic) -->
        <div class="bg-slate-800 rounded-xl p-5 border border-slate-700/60 shadow-lg">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-indigo-400 mb-4">Leitor de Imagens (CBZ / CBR)</h2>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-medium">Modo de Leitura Preferencial</span>
                <p class="text-xs text-slate-400">Sentido de exibição e rolagem das páginas</p>
              </div>
              <select class="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300">
                <option>Webtoon (Rolagem Vertical Contínua)</option>
                <option>Página Dupla (Mangá Orientação Direita->Esquerda)</option>
                <option>Página Única (Esquerda->Direita)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Section: Banco de Dados -->
        <div class="bg-slate-800 rounded-xl p-5 border border-slate-700/60 shadow-lg">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-indigo-400 mb-4">Banco de Dados Local (SQLite)</h2>
          <div class="flex items-center justify-between">
            <div>
              <span class="text-sm font-medium">Estado da Base de Dados</span>
              <p class="text-xs text-slate-400">SQLite síncrono via better-sqlite3</p>
            </div>
            <span class="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/20">
              Conectado
            </span>
          </div>
        </div>
      </main>
    </div>
  `
})
export class SettingsComponent {}
