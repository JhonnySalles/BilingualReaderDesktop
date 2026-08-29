import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type SettingTab = 'manga' | 'book' | 'system' | 'ai';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      <!-- Header Bar -->
      <div class="h-14 px-6 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h1 class="text-base font-bold text-slate-100">Configurações do Leitor</h1>
          <span class="text-xs text-slate-400">Portado do aplicativo nativo Android</span>
        </div>
      </div>

      <!-- Settings Layout (Left Categories, Right Content) -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Categories Side Nav -->
        <div class="w-64 bg-slate-900/50 border-r border-slate-800 p-4 space-y-1">
          <button 
            (click)="activeTab.set('manga')"
            [class.bg-indigo-600]="activeTab() === 'manga'"
            [class.text-white]="activeTab() === 'manga'"
            [class.text-slate-400]="activeTab() !== 'manga'"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer hover:bg-slate-800/60">
            <span class="text-base">🎨</span>
            <span>Mangás & Comics</span>
          </button>

          <button 
            (click)="activeTab.set('book')"
            [class.bg-indigo-600]="activeTab() === 'book'"
            [class.text-white]="activeTab() === 'book'"
            [class.text-slate-400]="activeTab() !== 'book'"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer hover:bg-slate-800/60">
            <span class="text-base">📚</span>
            <span>Livros & EPUBs</span>
          </button>

          <button 
            (click)="activeTab.set('system')"
            [class.bg-indigo-600]="activeTab() === 'system'"
            [class.text-white]="activeTab() === 'system'"
            [class.text-slate-400]="activeTab() !== 'system'"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer hover:bg-slate-800/60">
            <span class="text-base">⚙️</span>
            <span>Sistema & Banco de Dados</span>
          </button>

          <button 
            (click)="activeTab.set('ai')"
            [class.bg-indigo-600]="activeTab() === 'ai'"
            [class.text-white]="activeTab() === 'ai'"
            [class.text-slate-400]="activeTab() !== 'ai'"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer hover:bg-slate-800/60">
            <span class="text-base">🤖</span>
            <span>Inteligência Artificial (OpenRouter)</span>
          </button>
        </div>

        <!-- Scrollable Details Panel -->
        <div class="flex-1 overflow-y-auto p-8 max-w-4xl space-y-8">
          
          <!-- TAB: MANGA / COMIC -->
          @if (activeTab() === 'manga') {
            <section class="space-y-6">
              <div class="border-b border-slate-800 pb-3">
                <h2 class="text-lg font-bold text-indigo-400">Configurações de Mangá & Comic (CBZ/CBR)</h2>
                <p class="text-xs text-slate-400 mt-1">Opções de pastas, modo de leitura e preferências visuais</p>
              </div>

              <!-- Folder & Library -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Biblioteca Local</h3>
                <div>
                  <label class="block text-xs text-slate-300 mb-1 font-medium">Diretório de Armazenamento</label>
                  <div class="flex gap-2">
                    <input type="text" readonly value="C:\Users\Jhonny\Documents\BilingualReader\Mangas" class="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                    <button class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer">Alterar</button>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Ordem de Exibição Padrão</label>
                    <select class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                      <option>Nome (A-Z)</option>
                      <option>Últimos Lidos</option>
                      <option>Data de Adição</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Reading Controls -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Modo de Leitura & Visualizador</h3>
                
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Sentido da Leitura</label>
                    <select class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                      <option>Direita para Esquerda (Mangá Tradicional)</option>
                      <option>Esquerda para Direita (HQ Ocidental)</option>
                      <option>Webtoon (Rolagem Vertical Contínua)</option>
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
                    <span>Manter Nível de Zoom ao Trocar de Página</span>
                    <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Habilitar Lupa Magnificadora em Balões</span>
                    <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Extrair e Processar Vocabulário Automaticamente</span>
                    <input type="checkbox" class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Calcular Páginas Duplas Vinculadas</span>
                    <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                </div>
              </div>
            </section>
          }

          <!-- TAB: BOOK / EPUB -->
          @if (activeTab() === 'book') {
            <section class="space-y-6">
              <div class="border-b border-slate-800 pb-3">
                <h2 class="text-lg font-bold text-indigo-400">Configurações de Livros (EPUB)</h2>
                <p class="text-xs text-slate-400 mt-1">Fontes, leitor Text-To-Speech (TTS) e assistente bilíngue</p>
              </div>

              <!-- Folder -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Biblioteca de Ebooks</h3>
                <div>
                  <label class="block text-xs text-slate-300 mb-1 font-medium">Pasta dos Livros</label>
                  <div class="flex gap-2">
                    <input type="text" readonly value="C:\Users\Jhonny\Documents\BilingualReader\Books" class="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
                    <button class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer">Alterar</button>
                  </div>
                </div>
              </div>

              <!-- Text & Japanese options -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Processamento de Texto & Furigana</h3>
                <div class="space-y-3">
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Processar Texto em Japonês (Tokenizer / MeCab)</span>
                    <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Exibir Leitura Acima dos Kanjis (Furigana)</span>
                    <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                </div>
              </div>

              <!-- TTS -->
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
                    <span>Velocidade da Leitura (TTS Speed)</span>
                    <span>1.0x</span>
                  </div>
                  <input type="range" min="0.5" max="2.0" step="0.1" value="1.0" class="w-full accent-indigo-600">
                </div>
              </div>
            </section>
          }

          <!-- TAB: SYSTEM -->
          @if (activeTab() === 'system') {
            <section class="space-y-6">
              <div class="border-b border-slate-800 pb-3">
                <h2 class="text-lg font-bold text-indigo-400">Sistema & Banco de Dados</h2>
                <p class="text-xs text-slate-400 mt-1">Gerenciamento do SQLite, backup, sincronização e aparência</p>
              </div>

              <!-- Theme & Visuals -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Tema & Efeitos Visuais</h3>
                <div class="space-y-3">
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Habilitar Efeito Glassmorphism (Desfocagem Transparente)</span>
                    <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Renderizar Capas com Efeito 3D na Prateleira</span>
                    <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                </div>
              </div>

              <!-- Database Backup -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Backup & Restauração (SQLite)</h3>
                <p class="text-xs text-slate-400">Gere cópias de segurança do seu progresso, histórico e vocabulário.</p>
                
                <div class="flex gap-3">
                  <button class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer">
                    Gerar Backup (.db)
                  </button>
                  <button class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-300 border border-slate-700 transition-colors cursor-pointer">
                    Restaurar Backup
                  </button>
                </div>
              </div>
            </section>
          }

          <!-- TAB: AI -->
          @if (activeTab() === 'ai') {
            <section class="space-y-6">
              <div class="border-b border-slate-800 pb-3">
                <h2 class="text-lg font-bold text-indigo-400">Inteligência Artificial & Tradução</h2>
                <p class="text-xs text-slate-400 mt-1">Conexão com OpenRouter API para tradução contextual e explicações de gramática</p>
              </div>

              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <label class="flex items-center justify-between text-xs text-slate-200 font-bold cursor-pointer">
                  <span>Ativar Recursos de IA</span>
                  <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                </label>

                <div>
                  <label class="block text-xs text-slate-300 mb-1 font-medium">Chave API do OpenRouter</label>
                  <input type="password" placeholder="sk-or-v1-..." class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200">
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
    </div>
  `
})
export class SettingsComponent {
  activeTab = signal<SettingTab>('manga');
}
