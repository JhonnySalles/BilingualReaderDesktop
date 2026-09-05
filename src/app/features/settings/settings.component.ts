import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../core/services/electron.service';
import { ThemeService, ThemeMode, AccentColor } from '../../core/services/theme.service';
import { SettingsService, CustomLibrary } from '../../core/services/settings.service';
import { MangaFitMode, MangaScrollingMode } from '../../core/models';
export type { CustomLibrary };

type SettingTab = 'manga' | 'book' | 'system' | 'ai';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      <!-- Settings Layout (Left Navigation, Right Scrollable Content) -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Categories Side Nav -->
        <div class="w-64 shrink-0 bg-slate-900/50 border-r border-slate-800 p-4 space-y-1">
          <button 
            (click)="activeTab.set('manga')"
            [class.bg-indigo-600]="activeTab() === 'manga'"
            [class.text-white]="activeTab() === 'manga'"
            [class.text-slate-400]="activeTab() !== 'manga'"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer hover:bg-slate-800/60">
            <span class="text-base">🎨</span>
            <span class="truncate">Mangás & Comics</span>
          </button>

          <button 
            (click)="activeTab.set('book')"
            [class.bg-indigo-600]="activeTab() === 'book'"
            [class.text-white]="activeTab() === 'book'"
            [class.text-slate-400]="activeTab() !== 'book'"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer hover:bg-slate-800/60">
            <span class="text-base">📚</span>
            <span class="truncate">Livros & EPUBs</span>
          </button>

          <button 
            (click)="activeTab.set('system')"
            [class.bg-indigo-600]="activeTab() === 'system'"
            [class.text-white]="activeTab() === 'system'"
            [class.text-slate-400]="activeTab() !== 'system'"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer hover:bg-slate-800/60">
            <span class="text-base">⚙️</span>
            <span class="truncate">Sistema & Banco de Dados</span>
          </button>

          <button 
            (click)="activeTab.set('ai')"
            [class.bg-indigo-600]="activeTab() === 'ai'"
            [class.text-white]="activeTab() === 'ai'"
            [class.text-slate-400]="activeTab() !== 'ai'"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer hover:bg-slate-800/60">
            <span class="text-base">🤖</span>
            <span class="truncate">Inteligência Artificial (OpenRouter)</span>
          </button>
        </div>

        <!-- Scrollable Details Panel -->
        <div class="flex-1 min-w-0 overflow-y-auto p-8 space-y-8">
          
          <!-- ================= TAB: MANGA / COMIC ================= -->
          @if (activeTab() === 'manga') {
            <section class="space-y-6">
              <div class="border-b border-slate-800 pb-3">
                <h2 class="text-lg font-bold text-indigo-400">Configurações de Mangá & Comic (CBZ/CBR)</h2>
                <p class="text-xs text-slate-400 mt-1">Diretório padrão, gerenciamento de bibliotecas, exibição e leitura</p>
              </div>

              <!-- Base Directory Section -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Diretório Padrão Principal</h3>
                <div>
                  <label class="block text-xs text-slate-300 mb-1 font-medium">Pasta Base de Armazenamento de Mangás</label>
                  <div class="flex gap-2">
                    <input type="text" readonly [value]="mangaBasePath()" class="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                    <button 
                      (click)="browseMangaBasePath()"
                      class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer flex items-center gap-2">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                      Procurar...
                    </button>
                  </div>
                </div>
              </div>

              <!-- Custom Manga Libraries List -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Lista de Bibliotecas de Mangás & HQs</h3>
                    <p class="text-[11px] text-slate-500 mt-0.5">Cadastre pastas adicionais especificando título e idioma para exibição rápida</p>
                  </div>
                  <button 
                    (click)="openAddLibraryModal('manga')"
                    class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold rounded-lg text-indigo-400 transition-colors cursor-pointer flex items-center gap-1.5">
                    <span>+ Adicionar Biblioteca</span>
                  </button>
                </div>

                <div class="space-y-2">
                  @for (lib of mangaLibraries(); track lib.id) {
                    <div (click)="openEditLibraryModal(lib)" class="flex items-center justify-between bg-slate-950 hover:bg-slate-900/60 transition-colors p-3 rounded-lg border border-slate-800 cursor-pointer group">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                          🎨
                        </div>
                        <div>
                          <h4 class="text-xs font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">{{ lib.title }}</h4>
                          <p class="text-[10px] text-slate-400">{{ lib.path }} • <span class="text-indigo-400">{{ lib.language }}</span></p>
                        </div>
                      </div>
                      <div class="flex items-center gap-2">
                        <button (click)="deleteLibrary(lib.id, $event)" class="p-2 text-[10px] font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 transition-colors cursor-pointer" title="Remover Biblioteca">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </div>

              <!-- Display & Subtitle Options -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Preferências de Exibição e Legenda</h3>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Ordem de Exibição Padrão</label>
                    <select class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                      <option>Nome do Arquivo (A-Z)</option>
                      <option>Últimos Lidos</option>
                      <option>Data de Modificação</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Idioma de Legenda Padrão</label>
                    <select class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                      <option>Japonês (Original)</option>
                      <option>Inglês</option>
                      <option>Português (Brasil)</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Tradução da Legenda</label>
                    <select class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                      <option>Português (Brasil)</option>
                      <option>Inglês</option>
                      <option>Desativado</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Modo de Visualizador HQ/Comic</label>
                    <select
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="settingsService.mangaFitMode()"
                      (ngModelChange)="settingsService.mangaFitMode.set($event)">
                      <option [ngValue]="MangaFitMode.FitWidth">Ajustar à Largura (Fit Width)</option>
                      <option [ngValue]="MangaFitMode.FitHeight">Ajustar à Altura (Fit Height)</option>
                      <option [ngValue]="MangaFitMode.Original">Tamanho Real (Original)</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Reading Controls & Switches -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Controles do Leitor & Comportamento</h3>
                
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Sentido da Leitura</label>
                    <select
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="settingsService.mangaScrollingMode()"
                      (ngModelChange)="settingsService.mangaScrollingMode.set($event)">
                      <option [ngValue]="MangaScrollingMode.Horizontal">Horizontal (Esquerda para direita)</option>
                      <option [ngValue]="MangaScrollingMode.HorizontalRtl">Horizontal (Direita para esquerda)</option>
                      <option [ngValue]="MangaScrollingMode.Vertical">Vertical (página a página)</option>
                      <option [ngValue]="MangaScrollingMode.LongStrip">Tira longa (rolagem contínua)</option>
                      <option [ngValue]="MangaScrollingMode.LongStripGap">Tira longa com espaçamento</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Tipo de Paginação</label>
                    <select class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                      <option>Página Única</option>
                      <option>Página Dupla (Smart Fit)</option>
                      <option>Automático segundo a Orientação</option>
                    </select>
                  </div>
                </div>

                <!-- Switches -->
                <div class="pt-3 border-t border-slate-800/80 space-y-3">
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Exibir Relógio e Indicador de Bateria na Leitura</span>
                    <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Manter Nível de Zoom ao Trocar de Página</span>
                    <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Habilitar Lupa Magnificadora em Balões de Fala</span>
                    <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Extrair e Processar Vocabulário Automaticamente</span>
                    <input type="checkbox" class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Usar Nome da Pasta para Vincular Capítulos</span>
                    <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Calcular Páginas Duplas Vinculadas</span>
                    <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                </div>
              </div>
            </section>
          }

          <!-- ================= TAB: BOOK / EPUB ================= -->
          @if (activeTab() === 'book') {
            <section class="space-y-6">
              <div class="border-b border-slate-800 pb-3">
                <h2 class="text-lg font-bold text-indigo-400">Configurações de Livros (EPUB)</h2>
                <p class="text-xs text-slate-400 mt-1">Diretórios, fontes, vozes TTS, Furigana e leitorEPUB</p>
              </div>

              <!-- Base Directory -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Diretório Padrão Principal</h3>
                <div>
                  <label class="block text-xs text-slate-300 mb-1 font-medium">Pasta Base dos Livros</label>
                  <div class="flex gap-2">
                    <input type="text" readonly [value]="bookBasePath()" class="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                    <button 
                      (click)="browseBookBasePath()"
                      class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer flex items-center gap-2">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                      Procurar...
                    </button>
                  </div>
                </div>
              </div>

              <!-- Custom Book Libraries List -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Lista de Bibliotecas de Livros & EPUBs</h3>
                    <p class="text-[11px] text-slate-500 mt-0.5">Cadastre pastas organizadas para romances, ebooks e materiais de estudo</p>
                  </div>
                  <button 
                    (click)="openAddLibraryModal('book')"
                    class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold rounded-lg text-indigo-400 transition-colors cursor-pointer flex items-center gap-1.5">
                    <span>+ Adicionar Biblioteca</span>
                  </button>
                </div>

                <div class="space-y-2">
                  @for (lib of bookLibraries(); track lib.id) {
                    <div (click)="openEditLibraryModal(lib)" class="flex items-center justify-between bg-slate-950 hover:bg-slate-900/60 transition-colors p-3 rounded-lg border border-slate-800 cursor-pointer group">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                          📚
                        </div>
                        <div>
                          <h4 class="text-xs font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">{{ lib.title }}</h4>
                          <p class="text-[10px] text-slate-400">{{ lib.path }} • <span class="text-indigo-400">{{ lib.language }}</span></p>
                        </div>
                      </div>
                      <div class="flex items-center gap-2">
                        <button (click)="deleteLibrary(lib.id, $event)" class="p-2 text-[10px] font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 transition-colors cursor-pointer" title="Remover Biblioteca">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </div>

              <!-- Japanese & Text Processing -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Processamento de Texto & Furigana</h3>
                <div class="space-y-3">
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Processar Texto em Japonês (Tokenizer MeCab / Kuromoji)</span>
                    <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Exibir Lectura Furigana Acima dos Kanjis</span>
                    <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Extração Automática de Palavras do Vocabulário</span>
                    <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Habilitar Modo de Escrita Vertical Japonês (Tate-gaki)</span>
                    <input type="checkbox" class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                </div>
              </div>

              <!-- TTS Audio Reading -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Voz e Leitura em Áudio (TTS)</h3>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Voz Padrão (Português/Inglês)</label>
                    <select class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                      <option>Microsoft Daniel (Portuguese)</option>
                      <option>Microsoft Zira (English)</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Voz em Japonês</label>
                    <select class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                      <option>Microsoft Haruka (Japanese)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div class="flex justify-between text-xs text-slate-300 mb-1 font-medium">
                    <span>Velocidade de Leitura (TTS Speed)</span>
                    <span class="text-indigo-400 font-bold">{{ ttsSpeed() }}x</span>
                  </div>
                  <input type="range" min="0.5" max="2.0" step="0.1" [value]="ttsSpeed()" (input)="updateTtsSpeed($event)" class="w-full accent-indigo-600 cursor-pointer">
                </div>
              </div>

              <!-- Fonts & Typography -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Tipografia & Tamanho da Fonte</h3>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Fonte para Textos Ocidentais</label>
                    <select class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                      <option>Inter / System Sans</option>
                      <option>Roboto</option>
                      <option>Merriweather (Serif)</option>
                      <option>Fira Code (Mono)</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Fonte para Textos Japoneses</label>
                    <select class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                      <option>Noto Sans JP</option>
                      <option>Yu Gothic / Meiryo</option>
                      <option>Sawarabi Mincho</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div class="flex justify-between text-xs text-slate-300 mb-1 font-medium">
                    <span>Tamanho Base da Fonte</span>
                    <span class="text-indigo-400 font-bold">{{ fontSize() }}px</span>
                  </div>
                  <input type="range" min="12" max="32" step="1" [value]="fontSize()" (input)="updateFontSize($event)" class="w-full accent-indigo-600 cursor-pointer">
                </div>
              </div>
            </section>
          }

          <!-- ================= TAB: SYSTEM & THEMES ================= -->
          @if (activeTab() === 'system') {
            <section class="space-y-6">
              <div class="border-b border-slate-800 pb-3">
                <h2 class="text-lg font-bold text-indigo-400">Sistema & Banco de Dados</h2>
                <p class="text-xs text-slate-400 mt-1">Gerenciamento visual de temas, SQLite, backup e sincronização</p>
              </div>

              <!-- Theme & Accent Selection -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-5">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Tema & Aparência</h3>
                
                <div>
                  <label class="block text-xs text-slate-300 mb-2 font-medium">Modo de Exibição & Tema</label>
                  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <button 
                      (click)="selectTheme('dark')"
                      [class.border-indigo-500]="themeMode() === 'dark'"
                      [class.bg-indigo-950]="themeMode() === 'dark'"
                      [class.ring-2]="themeMode() === 'dark'"
                      [class.ring-indigo-500]="themeMode() === 'dark'"
                      class="p-4 bg-slate-950 rounded-xl border border-slate-800 text-left transition-all cursor-pointer hover:border-slate-700 flex flex-col justify-between min-h-[90px]">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-lg">🌙</span>
                        <span class="text-xs font-bold text-slate-100">Modo Escuro</span>
                      </div>
                      <span class="text-[10px] text-slate-400">Recomendado para leitura</span>
                    </button>

                    <button 
                      (click)="selectTheme('light')"
                      [class.border-indigo-500]="themeMode() === 'light'"
                      [class.bg-indigo-950]="themeMode() === 'light'"
                      [class.ring-2]="themeMode() === 'light'"
                      [class.ring-indigo-500]="themeMode() === 'light'"
                      class="p-4 bg-slate-950 rounded-xl border border-slate-800 text-left transition-all cursor-pointer hover:border-slate-700 flex flex-col justify-between min-h-[90px]">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-lg">☀️</span>
                        <span class="text-xs font-bold text-slate-100">Modo Claro</span>
                      </div>
                      <span class="text-[10px] text-slate-400">Ambientes iluminados</span>
                    </button>

                    <button 
                      (click)="selectTheme('win-mica-dark')"
                      [class.border-indigo-500]="themeMode() === 'win-mica-dark'"
                      [class.bg-indigo-950]="themeMode() === 'win-mica-dark'"
                      [class.ring-2]="themeMode() === 'win-mica-dark'"
                      [class.ring-indigo-500]="themeMode() === 'win-mica-dark'"
                      class="p-4 bg-slate-950 rounded-xl border border-slate-800 text-left transition-all cursor-pointer hover:border-slate-700 flex flex-col justify-between min-h-[90px]">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-lg">🪟</span>
                        <span class="text-xs font-bold text-slate-100">Windows 11 Mica (Escuro)</span>
                      </div>
                      <span class="text-[10px] text-slate-400">Translúcido com desfoque de capa</span>
                    </button>

                    <button 
                      (click)="selectTheme('win-mica-light')"
                      [class.border-indigo-500]="themeMode() === 'win-mica-light'"
                      [class.bg-indigo-950]="themeMode() === 'win-mica-light'"
                      [class.ring-2]="themeMode() === 'win-mica-light'"
                      [class.ring-indigo-500]="themeMode() === 'win-mica-light'"
                      class="p-4 bg-slate-950 rounded-xl border border-slate-800 text-left transition-all cursor-pointer hover:border-slate-700 flex flex-col justify-between min-h-[90px]">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-lg">🪟</span>
                        <span class="text-xs font-bold text-slate-100">Windows 11 Mica (Claro)</span>
                      </div>
                      <span class="text-[10px] text-slate-400">Claro translúcido com desfoque</span>
                    </button>

                    <button 
                      (click)="selectTheme('system')"
                      [class.border-indigo-500]="themeMode() === 'system'"
                      [class.bg-indigo-950]="themeMode() === 'system'"
                      [class.ring-2]="themeMode() === 'system'"
                      [class.ring-indigo-500]="themeMode() === 'system'"
                      class="p-4 bg-slate-950 rounded-xl border border-slate-800 text-left transition-all cursor-pointer hover:border-slate-700 flex flex-col justify-between min-h-[90px]">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-lg">💻</span>
                        <span class="text-xs font-bold text-slate-100">Padrão do Sistema</span>
                      </div>
                      <span class="text-[10px] text-slate-400">Sincroniza com o SO</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label class="block text-xs text-slate-300 mb-2 font-medium">Paleta & Cor de Destaque</label>
                  <div class="flex gap-3">
                    <button 
                      (click)="selectAccent('indigo')" 
                      [class.ring-2]="accentColor() === 'indigo'"
                      class="flex-1 p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-center ring-indigo-500 transition-all cursor-pointer">
                      <div class="w-6 h-6 rounded-full bg-indigo-600 mx-auto mb-1"></div>
                      <span class="text-[10px] font-semibold text-slate-300">Indigo Classic</span>
                    </button>

                    <button 
                      (click)="selectAccent('oled')" 
                      [class.ring-2]="accentColor() === 'oled'"
                      class="flex-1 p-2.5 bg-black rounded-xl border border-slate-800 text-center ring-slate-400 transition-all cursor-pointer">
                      <div class="w-6 h-6 rounded-full bg-slate-950 border border-slate-700 mx-auto mb-1"></div>
                      <span class="text-[10px] font-semibold text-slate-300">OLED Pitch Black</span>
                    </button>

                    <button 
                      (click)="selectAccent('emerald')" 
                      [class.ring-2]="accentColor() === 'emerald'"
                      class="flex-1 p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-center ring-emerald-500 transition-all cursor-pointer">
                      <div class="w-6 h-6 rounded-full bg-emerald-600 mx-auto mb-1"></div>
                      <span class="text-[10px] font-semibold text-slate-300">Emerald Forest</span>
                    </button>

                    <button 
                      (click)="selectAccent('purple')" 
                      [class.ring-2]="accentColor() === 'purple'"
                      class="flex-1 p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-center ring-purple-500 transition-all cursor-pointer">
                      <div class="w-6 h-6 rounded-full bg-purple-600 mx-auto mb-1"></div>
                      <span class="text-[10px] font-semibold text-slate-300">Deep Purple</span>
                    </button>
                  </div>
                </div>

                <div class="pt-3 border-t border-slate-800/80 space-y-3">
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Habilitar Efeito Glassmorphism (Desfocagem Transparente)</span>
                    <input type="checkbox" [(ngModel)]="enableGlassmorphism" class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Renderizar Capas com Efeito 3D na Prateleira</span>
                    <input type="checkbox" [(ngModel)]="enable3DCovers" class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                </div>
              </div>

              <!-- General Options & Date Formatting -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Preferências Gerais de Sistema</h3>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Formato de Exibição de Datas</label>
                    <select class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                      <option>DD/MM/YYYY (29/08/2026)</option>
                      <option>YYYY-MM-DD (2026-08-29)</option>
                      <option>Relativo (Há 2 horas, Ontem)</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Sincronização em Nuvem (Google Drive / Mark)</label>
                    <select class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                      <option>Ativado (Automático)</option>
                      <option>Apenas via Wi-Fi</option>
                      <option>Desativado (Offline)</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Database Backup & Operations -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Banco de Dados SQLite & Manutenção</h3>
                <p class="text-xs text-slate-400">Gere cópias de segurança (.db) ou execute limpeza de arquivos temporários</p>
                
                <div class="flex flex-wrap gap-3">
                  <button class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer">
                    💾 Criar Backup (.db)
                  </button>
                  <button class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-300 border border-slate-700 transition-colors cursor-pointer">
                    📥 Restaurar Backup
                  </button>
                  <button class="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold rounded-lg transition-colors cursor-pointer">
                    🗑️ Limpar Capas em Cache
                  </button>
                </div>
              </div>
            </section>
          }

          <!-- ================= TAB: AI ================= -->
          @if (activeTab() === 'ai') {
            <section class="space-y-6">
              <div class="border-b border-slate-800 pb-3">
                <h2 class="text-lg font-bold text-indigo-400">Inteligência Artificial & Tradução</h2>
                <p class="text-xs text-slate-400 mt-1">Conexão com OpenRouter API para tradução contextual e explicações de gramática</p>
              </div>

              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <label class="flex items-center justify-between text-xs text-slate-200 font-bold cursor-pointer">
                  <span>Ativar Recursos de IA no Leitor</span>
                  <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                </label>

                <div>
                  <label class="block text-xs text-slate-300 mb-1 font-medium">Chave API do OpenRouter</label>
                  <input type="password" value="sk-or-v1-demo-key-placeholder" class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Modelo para Tradução de Mangá</label>
                    <select class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                      <option>google/gemini-2.5-flash</option>
                      <option>anthropic/claude-3.5-sonnet</option>
                      <option>openai/gpt-4o-mini</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Modelo para Resumo de Ebooks</label>
                    <select class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                      <option>google/gemini-2.5-flash</option>
                      <option>deepseek/deepseek-r1</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>
          }
        </div>
      </div>

      <!-- ================= MODAL: ADD/EDIT LIBRARY ================= -->
      @if (showLibraryModal()) {
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div class="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 class="text-sm font-bold text-slate-100">
                {{ modalMode() === 'add' ? 'Adicionar Nova Biblioteca' : 'Editar Biblioteca' }}
              </h3>
              <button (click)="closeLibraryModal()" class="text-slate-400 hover:text-slate-200 text-lg leading-none cursor-pointer">&times;</button>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-xs text-slate-300 mb-1 font-medium">Título da Biblioteca</label>
                <input 
                  type="text" 
                  [(ngModel)]="libraryForm.title" 
                  placeholder="Ex: Mangás Principais, Romances EPUB" 
                  class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
              </div>

              <div>
                <label class="block text-xs text-slate-300 mb-1 font-medium">Idioma Padrão</label>
                <select 
                  [(ngModel)]="libraryForm.language" 
                  class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                  <option>Japonês (JA)</option>
                  <option>Inglês (EN)</option>
                  <option>Português (PT-BR)</option>
                  <option>Japonês / Português (Bilíngue)</option>
                </select>
              </div>

              <div>
                <label class="block text-xs text-slate-300 mb-1 font-medium">Caminho do Diretório</label>
                <div class="flex gap-2">
                  <input 
                    type="text" 
                    [(ngModel)]="libraryForm.path" 
                    placeholder="C:\\Caminho\\Da\\Pasta" 
                    class="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                  <button 
                    (click)="browseModalLibraryPath()"
                    class="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer flex items-center gap-1.5">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                    Procurar
                  </button>
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button 
                (click)="closeLibraryModal()" 
                class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-300 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button 
                (click)="saveLibrary()" 
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer">
                Salvar Biblioteca
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class SettingsComponent {
  private electronService = inject(ElectronService);
  themeService = inject(ThemeService);
  settingsService = inject(SettingsService);

  MangaFitMode = MangaFitMode;
  MangaScrollingMode = MangaScrollingMode;

  activeTab = signal<SettingTab>('manga');

  // Base Directory Signals
  mangaBasePath = computed(() => this.settingsService.mangaBasePath());
  bookBasePath = computed(() => this.settingsService.bookBasePath());

  // Custom Libraries State
  libraries = computed(() => this.settingsService.libraries());

  // Filtered Libraries by Group
  mangaLibraries = computed(() => this.settingsService.libraries().filter(l => l.type === 'manga'));
  bookLibraries = computed(() => this.settingsService.libraries().filter(l => l.type === 'book'));

  // Theme & Visual Signals
  themeMode = computed(() => this.themeService.themeMode());
  accentColor = computed(() => this.themeService.accentColor());
  enableGlassmorphism = true;
  enable3DCovers = true;

  selectTheme(mode: ThemeMode): void {
    this.themeService.setTheme(mode);
  }

  selectAccent(accent: AccentColor): void {
    this.themeService.setAccent(accent);
  }

  // EPUB / TTS Signals
  ttsSpeed = signal<number>(1.0);
  fontSize = signal<number>(18);

  // Modal State
  showLibraryModal = signal<boolean>(false);
  modalMode = signal<'add' | 'edit'>('add');
  libraryForm: CustomLibrary = {
    id: '',
    title: '',
    language: 'Japonês (JA)',
    path: '',
    type: 'manga'
  };

  // Browse Directory Actions
  async browseMangaBasePath(): Promise<void> {
    const selected = await this.electronService.selectDirectory();
    if (selected) {
      this.settingsService.mangaBasePath.set(selected);
    }
  }

  async browseBookBasePath(): Promise<void> {
    const selected = await this.electronService.selectDirectory();
    if (selected) {
      this.settingsService.bookBasePath.set(selected);
    }
  }

  async browseModalLibraryPath(): Promise<void> {
    const selected = await this.electronService.selectDirectory();
    if (selected) {
      this.libraryForm.path = selected;
    }
  }

  // Modal Actions
  openAddLibraryModal(type: 'manga' | 'book'): void {
    this.modalMode.set('add');
    this.libraryForm = {
      id: Date.now().toString(),
      title: '',
      language: 'Japonês (JA)',
      path: '',
      type: type
    };
    this.showLibraryModal.set(true);
  }

  openEditLibraryModal(library: CustomLibrary): void {
    this.modalMode.set('edit');
    this.libraryForm = { ...library };
    this.showLibraryModal.set(true);
  }

  closeLibraryModal(): void {
    this.showLibraryModal.set(false);
  }

  saveLibrary(): void {
    if (!this.libraryForm.title || !this.libraryForm.path) {
      alert('Por favor, preencha o título e o caminho da biblioteca.');
      return;
    }

    if (this.modalMode() === 'add') {
      this.settingsService.addLibrary({ ...this.libraryForm });
    } else {
      this.settingsService.updateLibrary({ ...this.libraryForm });
    }

    this.closeLibraryModal();
  }

  deleteLibrary(id: string, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    if (confirm('Deseja remover esta biblioteca da lista?')) {
      this.settingsService.deleteLibrary(id);
    }
  }

  // Range Slider Handlers
  updateTtsSpeed(event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    this.ttsSpeed.set(val);
  }

  updateFontSize(event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    this.fontSize.set(val);
  }
}
