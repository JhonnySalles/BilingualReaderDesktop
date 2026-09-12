import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../core/services/electron.service';
import { ThemeService, ThemeMode, AccentColor } from '../../core/services/theme.service';
import { SettingsService, CustomLibrary, LlmProviderSetting, LlmLocalKind, normalizeEbookConvertMode, EBOOK_CONVERT_MODE_KEY } from '../../core/services/settings.service';
import { ShareMarkUiService } from '../../core/services/sharemark/share-mark-ui.service';
import { ShareMarkCloud } from '../../core/models/enums/sharemark.enum';
import { MangaFitMode, MangaScrollingMode, OrderType, ReaderTouchType, Languages, PAGE_TRANSITION_LABELS_PT, PAGE_TRANSITION_OPTIONS, PageTransitionType, LLM_MANGA_MODEL_OPTIONS } from '../../core/models';
import {
  TextSpeech,
  activeTextSpeechVoices,
  textSpeechDefault,
  parseTextSpeech,
  formatTtsSpeedLabel
} from '../../core/models/enums/tts-enums';
import { ReaderTouchConfigComponent } from '../reader-shared/reader-touch-config.component';
import { japaneseFontOptions, westernFontOptions } from '../reader-text/book-fonts';
import { LibraryStateService } from '../../core/services/library-state.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
export type { CustomLibrary };

const TTS_VOICE_NORMAL_KEY = 'BOOK_READER_TTS_VOICE_NORMAL';
const TTS_VOICE_JAPANESE_KEY = 'BOOK_READER_TTS_VOICE_JAPANESE';
const TTS_SPEED_KEY = 'BOOK_READER_TTS_SPEED';
const TTS_SPEED_DEFAULT = 0;

type SettingTab = 'manga' | 'book' | 'system' | 'ai' | 'tracker';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReaderTouchConfigComponent],
  template: `
    <div class="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none relative">
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

          <button 
            (click)="activeTab.set('tracker')"
            [class.bg-indigo-600]="activeTab() === 'tracker'"
            [class.text-white]="activeTab() === 'tracker'"
            [class.text-slate-400]="activeTab() !== 'tracker'"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer hover:bg-slate-800/60">
            <span class="text-base">🎯</span>
            <span class="truncate">Rastreadores (MAL / AniList)</span>
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
                  <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer mt-2">
                    <input type="checkbox"
                      class="w-4 h-4 accent-indigo-600 rounded"
                      [ngModel]="settingsService.mangaBasePathExternalHd()"
                      (ngModelChange)="settingsService.mangaBasePathExternalHd.set($event)">
                    <span>HD Externo</span>
                    <span class="text-[10px] text-slate-500">(protege contra exclusão quando desconectado)</span>
                  </label>
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
                    <select
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="settingsService.libraryDefaultOrder()"
                      (ngModelChange)="onLibraryDefaultOrder($event)">
                      <option [ngValue]="OrderType.Name">Nome do Arquivo (A-Z)</option>
                      <option [ngValue]="OrderType.LastAccess">Últimos Lidos</option>
                      <option [ngValue]="OrderType.Date">Data de Modificação</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Idioma de Legenda Padrão</label>
                    <select
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="settingsService.subtitleLanguage()"
                      (ngModelChange)="settingsService.subtitleLanguage.set($event)">
                      <option value="JAPANESE">Japonês (Original)</option>
                      <option value="ENGLISH">Inglês</option>
                      <option value="PORTUGUESE">Português (Brasil)</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Idioma OCR (Tesseract)</label>
                    <select
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="settingsService.ocrLanguage()"
                      (ngModelChange)="settingsService.ocrLanguage.set($event)">
                      <option value="jpn">Japonês (jpn)</option>
                      <option value="jpn_vert">Japonês vertical</option>
                      <option value="eng">Inglês</option>
                      <option value="por">Português</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Tradução da Legenda / OCR</label>
                    <select
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="settingsService.subtitleTranslate()"
                      (ngModelChange)="settingsService.subtitleTranslate.set($event)">
                      <option value="PORTUGUESE">Português (Brasil)</option>
                      <option value="ENGLISH">Inglês</option>
                      <option value="OFF">Desativado</option>
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
                  <div class="col-span-2">
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Sentido da Leitura</label>
                    <select
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="settingsService.mangaScrollingMode()"
                      (ngModelChange)="settingsService.mangaScrollingMode.set($event)">
                      <option [ngValue]="MangaScrollingMode.Horizontal">Horizontal (Esquerda para direita)</option>
                      <option [ngValue]="MangaScrollingMode.HorizontalRtl">Horizontal (Direita para esquerda)</option>
                      <option [ngValue]="MangaScrollingMode.HorizontalDual">Horizontal Dupla (Esquerda para direita)</option>
                      <option [ngValue]="MangaScrollingMode.HorizontalDualRtl">Horizontal Dupla (Direita para esquerda)</option>
                      <option [ngValue]="MangaScrollingMode.Vertical">Vertical (página a página)</option>
                      <option [ngValue]="MangaScrollingMode.VerticalDual">Vertical Dupla</option>
                      <option [ngValue]="MangaScrollingMode.LongStrip">Tira longa (rolagem contínua)</option>
                      <option [ngValue]="MangaScrollingMode.LongStripGap">Tira longa com espaçamento</option>
                    </select>
                  </div>

                  <div class="col-span-2">
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Animação de transição de página</label>
                    <select
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="settingsService.mangaPageTransition()"
                      (ngModelChange)="settingsService.mangaPageTransition.set($event)">
                      @for (opt of pageTransitionOptions; track opt) {
                        <option [ngValue]="opt">{{ pageTransitionLabels[opt] }}</option>
                      }
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
                    <input type="checkbox"
                      class="w-4 h-4 accent-indigo-600 rounded"
                      [ngModel]="settingsService.mangaProcessVocabulary()"
                      (ngModelChange)="settingsService.mangaProcessVocabulary.set($event)">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Usar Nome da Pasta para Vincular Capítulos</span>
                    <input type="checkbox"
                      class="w-4 h-4 accent-indigo-600 rounded"
                      [ngModel]="settingsService.mangaUsePagePathForLinked()"
                      (ngModelChange)="settingsService.mangaUsePagePathForLinked.set($event)">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Calcular Páginas Duplas Vinculadas</span>
                    <input type="checkbox"
                      class="w-4 h-4 accent-indigo-600 rounded"
                      [ngModel]="settingsService.mangaDualPageCalculate()"
                      (ngModelChange)="settingsService.mangaDualPageCalculate.set($event)">
                  </label>
                </div>
              </div>

              <!-- Reading Speed & Batch Recalculate (Manga) -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <div class="border-b border-slate-800 pb-2">
                  <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Tempo Médio de Leitura (Mangá)</h3>
                  <p class="text-[11px] text-slate-500 mt-0.5">Estimativa em segundos por página para calcular automaticamente tempos de leitura</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Tempo Médio por Página (segundos)</label>
                    <div class="flex items-center gap-2">
                      <input
                        type="number"
                        min="10"
                        max="600"
                        step="5"
                        class="w-32 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                        [ngModel]="settingsService.mangaAvgTimePerPage()"
                        (ngModelChange)="settingsService.mangaAvgTimePerPage.set(+$event || 120)">
                      <span class="text-xs text-slate-400">({{ (settingsService.mangaAvgTimePerPage() / 60).toFixed(1) }} min/pág)</span>
                    </div>
                  </div>

                  <div class="flex flex-col justify-end gap-2">
                    <div class="flex flex-wrap gap-2">
                      <button
                        type="button"
                        (click)="startRecalculateBatch('MANGA', false)"
                        [disabled]="recalculating()"
                        class="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        <span>Recalcular Todos</span>
                      </button>

                      <button
                        type="button"
                        (click)="startRecalculateBatch('MANGA', true)"
                        [disabled]="recalculating()"
                        class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-indigo-300 border border-indigo-500/30 transition-colors cursor-pointer flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                        <span>Calcular Novos</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Touch / click zones -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-3">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Funções de Clique do Leitor</h3>
                <p class="text-[11px] text-slate-500">Configure as ações das zonas 3×3 (topo, centro e rodapé) usadas no leitor de mangá.</p>
                <button type="button" (click)="openTouchConfig('manga')"
                  class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer inline-flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/>
                  </svg>
                  Configurar funções de clique
                </button>
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
                  <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer mt-2">
                    <input type="checkbox"
                      class="w-4 h-4 accent-indigo-600 rounded"
                      [ngModel]="settingsService.bookBasePathExternalHd()"
                      (ngModelChange)="settingsService.bookBasePathExternalHd.set($event)">
                    <span>HD Externo</span>
                    <span class="text-[10px] text-slate-500">(protege contra exclusão quando desconectado)</span>
                  </label>
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
                    <span>Processar Texto em Japonês (Sudachi / Kuromoji)</span>
                    <input type="checkbox"
                      class="w-4 h-4 accent-indigo-600 rounded"
                      [ngModel]="settingsService.bookProcessJapaneseText()"
                      (ngModelChange)="settingsService.bookProcessJapaneseText.set($event)">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Exibir Lectura Furigana Acima dos Kanjis</span>
                    <input type="checkbox"
                      class="w-4 h-4 accent-indigo-600 rounded"
                      [ngModel]="settingsService.bookGenerateFurigana()"
                      (ngModelChange)="settingsService.bookGenerateFurigana.set($event)">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Extração Automática de Palavras do Vocabulário</span>
                    <input type="checkbox"
                      class="w-4 h-4 accent-indigo-600 rounded"
                      [ngModel]="settingsService.bookProcessVocabulary()"
                      (ngModelChange)="settingsService.bookProcessVocabulary.set($event)">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer gap-3">
                    <span class="min-w-0">
                      <span class="block">Habilitar Modo de Escrita Vertical Japonês (Tate-gaki)</span>
                      <span class="block text-[10px] text-slate-500 font-normal mt-0.5">
                        CSS writing-mode no EPUB; furigana permanece sobre o kanji
                      </span>
                    </span>
                    <input type="checkbox"
                      class="w-4 h-4 accent-indigo-600 rounded shrink-0"
                      [ngModel]="settingsService.bookFontJapaneseStyle()"
                      (ngModelChange)="settingsService.bookFontJapaneseStyle.set($event)">
                  </label>
                </div>
              </div>

              <!-- TTS Audio Reading -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Voz e Leitura em Áudio (TTS)</h3>
                <p class="text-[11px] text-slate-500">Vozes neurais gratuitas (Edge / Azure Neural), sem chave de API.</p>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Voz padrão (PT / EN)</label>
                    <select
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 cursor-pointer"
                      [ngModel]="ttsVoiceNormal()"
                      (ngModelChange)="onTtsVoiceNormal($event)">
                      @for (v of ttsVoicesNormal; track v.id) {
                        <option [ngValue]="v.id">{{ v.label }}</option>
                      }
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Voz em japonês</label>
                    <select
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 cursor-pointer"
                      [ngModel]="ttsVoiceJapanese()"
                      (ngModelChange)="onTtsVoiceJapanese($event)">
                      @for (v of ttsVoicesJapanese; track v.id) {
                        <option [ngValue]="v.id">{{ v.label }}</option>
                      }
                    </select>
                  </div>
                </div>

                <div>
                  <div class="flex justify-between text-xs text-slate-300 mb-1 font-medium">
                    <span>Velocidade de leitura</span>
                    <span class="text-indigo-400 font-bold tabular-nums">{{ ttsSpeedLabel() }}</span>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    step="5"
                    [value]="ttsSpeed()"
                    (input)="updateTtsSpeed($event)"
                    class="w-full accent-indigo-600 cursor-pointer">
                  <div class="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>−50%</span>
                    <span>0</span>
                    <span>+50%</span>
                  </div>
                </div>
              </div>

              <!-- Fonts & Typography -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Tipografia & Tamanho da Fonte</h3>
                <div>
                  <label class="block text-xs text-slate-300 mb-1 font-medium">Animação de transição de página</label>
                  <select
                    class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                    [ngModel]="settingsService.bookPageTransition()"
                    (ngModelChange)="settingsService.bookPageTransition.set($event)">
                    @for (opt of pageTransitionOptions; track opt) {
                      <option [ngValue]="opt">{{ pageTransitionLabels[opt] }}</option>
                    }
                  </select>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Fonte para Textos Ocidentais</label>
                    <select
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 cursor-pointer"
                      [ngModel]="settingsService.bookFontFamily()"
                      (ngModelChange)="settingsService.bookFontFamily.set($event)">
                      @for (f of westernFonts; track f.id) {
                        <option [ngValue]="f.css">{{ f.label }}</option>
                      }
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Fonte para Textos Japoneses</label>
                    <select
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 cursor-pointer"
                      [ngModel]="settingsService.bookFontFamilyJapanese()"
                      (ngModelChange)="settingsService.bookFontFamilyJapanese.set($event)">
                      @for (f of japaneseFonts; track f.id) {
                        <option [ngValue]="f.css">{{ f.label }}</option>
                      }
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

              <!-- Reading Speed & Batch Recalculate (Book) -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <div class="border-b border-slate-800 pb-2">
                  <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Velocidade Média de Leitura (Livro)</h3>
                  <p class="text-[11px] text-slate-500 mt-0.5">Estimativa em segundos por palavra para calcular automaticamente tempos de leitura</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Tempo por Palavra (segundos)</label>
                    <div class="flex items-center gap-2">
                      <input
                        type="number"
                        min="0.05"
                        max="2.0"
                        step="0.01"
                        class="w-32 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                        [ngModel]="settingsService.bookAvgTimePerWord()"
                        (ngModelChange)="settingsService.bookAvgTimePerWord.set(+$event || 0.24)">
                      <span class="text-xs text-slate-400">
                        (~{{ Math.round(60 / (settingsService.bookAvgTimePerWord() || 0.24)) }} palavras/min)
                      </span>
                    </div>
                  </div>

                  <div class="flex flex-col justify-end gap-2">
                    <div class="flex flex-wrap gap-2">
                      <button
                        type="button"
                        (click)="startRecalculateBatch('BOOK', false)"
                        [disabled]="recalculating()"
                        class="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        <span>Recalcular Todos</span>
                      </button>

                      <button
                        type="button"
                        (click)="startRecalculateBatch('BOOK', true)"
                        [disabled]="recalculating()"
                        class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-indigo-300 border border-indigo-500/30 transition-colors cursor-pointer flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                        <span>Calcular Novos</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Touch / click zones -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-3">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Funções de Clique do Leitor</h3>
                <p class="text-[11px] text-slate-500">Configure as ações das zonas 3×3 usadas no leitor de livros (EPUB).</p>
                <button type="button" (click)="openTouchConfig('book')"
                  class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer inline-flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/>
                  </svg>
                  Configurar funções de clique
                </button>
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
                    <input type="checkbox"
                      class="w-4 h-4 accent-indigo-600 rounded"
                      [ngModel]="settingsService.themeGlassmorphism()"
                      (ngModelChange)="settingsService.themeGlassmorphism.set($event)">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Renderizar Capas com Efeito 3D na Prateleira</span>
                    <input type="checkbox"
                      class="w-4 h-4 accent-indigo-600 rounded"
                      [ngModel]="settingsService.theme3DCovers()"
                      (ngModelChange)="settingsService.theme3DCovers.set($event)">
                  </label>
                </div>
              </div>

              <!-- ShareMark Cloud Sync -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Sincronização de Bookmarks (ShareMark)</h3>
                    <p class="text-[11px] text-slate-500 mt-0.5">Mesmos arquivos/coleções do app Android — progresso, favoritos, histórico e anotações</p>
                  </div>
                  <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer shrink-0">
                    <span>Ativar</span>
                    <input
                      type="checkbox"
                      class="w-4 h-4 accent-indigo-600 rounded"
                      [checked]="shareMark.status().enabled"
                      (change)="onShareMarkEnabled($event)">
                  </label>
                </div>

                @if (!shareMark.status().oauthConfigured) {
                  <div class="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                    Configure <code class="text-amber-100">GOOGLE_OAUTH_CLIENT_ID</code> e
                    <code class="text-amber-100">GOOGLE_OAUTH_CLIENT_SECRET</code> no arquivo
                    <code class="text-amber-100">.env</code> na raiz do projeto (veja <code class="text-amber-100">.env.example</code>).
                  </div>
                }

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Provedor na nuvem</label>
                    <select
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="shareMark.status().cloud"
                      (ngModelChange)="onShareMarkCloud($event)"
                      [disabled]="!shareMark.status().enabled">
                      <option value="GOOGLE_DRIVE">Google Drive</option>
                      <option value="FIRESTORE">Firestore (Firebase)</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Conta Google</label>
                    @if (shareMark.status().signedIn) {
                      <div class="flex gap-2">
                        <button
                          type="button"
                          class="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-indigo-300 text-left truncate"
                          [title]="shareMark.status().email || ''">
                          {{ shareMark.status().email || 'Conta conectada' }}
                        </button>
                        <button
                          type="button"
                          (click)="shareMark.signOut()"
                          class="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold rounded-lg text-slate-300 transition-colors cursor-pointer">
                          Sair
                        </button>
                      </div>
                    } @else {
                      <button
                        type="button"
                        (click)="shareMark.signIn()"
                        [disabled]="shareMark.signingIn() || !shareMark.status().oauthConfigured"
                        class="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer flex items-center justify-center gap-2">
                        @if (shareMark.signingIn()) {
                          <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Abrindo navegador...
                        } @else {
                          Entrar com Google
                        }
                      </button>
                    }
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    (click)="shareMark.clearLastSync('MANGA')"
                    class="flex items-center justify-between px-3 py-2.5 bg-slate-950 hover:bg-slate-900/80 border border-slate-800 rounded-lg text-left transition-colors cursor-pointer">
                    <div>
                      <div class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Última sync — Mangás</div>
                      <div class="text-xs text-slate-300 mt-0.5">{{ formatLastSync(shareMark.status().lastSyncManga) }}</div>
                    </div>
                    <span class="text-[10px] text-slate-500">Limpar</span>
                  </button>
                  <button
                    type="button"
                    (click)="shareMark.clearLastSync('BOOK')"
                    class="flex items-center justify-between px-3 py-2.5 bg-slate-950 hover:bg-slate-900/80 border border-slate-800 rounded-lg text-left transition-colors cursor-pointer">
                    <div>
                      <div class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Última sync — Livros</div>
                      <div class="text-xs text-slate-300 mt-0.5">{{ formatLastSync(shareMark.status().lastSyncBook) }}</div>
                    </div>
                    <span class="text-[10px] text-slate-500">Limpar</span>
                  </button>
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
                </div>
              </div>

              <!-- Database Backup & Operations -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Banco de Dados SQLite & Manutenção</h3>
                <p class="text-xs text-slate-400">Gere cópias de segurança (.db) ou execute limpeza de arquivos temporários</p>
                
                <div class="flex flex-wrap gap-3">
                  <button type="button" (click)="onCreateBackup()"
                    class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer">
                    💾 Criar Backup (.db)
                  </button>
                  <button type="button" (click)="onRestoreBackup()"
                    class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-300 border border-slate-700 transition-colors cursor-pointer">
                    📥 Restaurar Backup
                  </button>
                  <button type="button" (click)="onExportDataJson()"
                    class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer">
                    📤 Exportar Dados (JSON)
                  </button>
                  <button type="button" (click)="onImportDataJson()"
                    class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-300 border border-slate-700 transition-colors cursor-pointer">
                    📥 Importar Dados (JSON)
                  </button>
                  <button type="button" (click)="onClearCoverCache()"
                    class="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold rounded-lg transition-colors cursor-pointer">
                    🗑️ Limpar Capas em Cache
                  </button>
                  <button type="button" (click)="onClearStatisticsHistory()"
                    class="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold rounded-lg transition-colors cursor-pointer">
                    📊 Limpar Histórico de Estatísticas
                  </button>
                </div>
              </div>

              <!-- Ebook conversion tools -->
              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <div>
                  <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Conversão de livros</h3>
                  <p class="text-xs text-slate-400 mt-1">
                    Status das ferramentas detectadas e prioridade ao converter formatos para EPUB
                  </p>
                </div>

                <div>
                  <label class="block text-xs text-slate-300 mb-1 font-medium">Modo de conversão</label>
                  <select
                    class="w-full max-w-md bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                    [ngModel]="settingsService.ebookConvertMode()"
                    (ngModelChange)="onEbookConvertModeChange($event)">
                    <option value="auto">Auto (Calibre → nativo)</option>
                    <option value="calibre">Calibre</option>
                    <option value="native">Nativo</option>
                  </select>
                  <p class="text-[11px] text-slate-500 mt-1.5">
                    Auto tenta o Calibre primeiro (melhor qualidade) e, se indisponível ou falhar, usa os converters embutidos.
                    Calibre força só o ebook-convert. Nativo usa apenas libmobi, documentos JS e FB2 (sem Calibre/Pandoc).
                  </p>
                </div>

                <div class="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400 space-y-1">
                  <div class="font-semibold text-slate-300">Ferramentas no sistema</div>
                  @if (converterAdapters().length) {
                    @for (a of converterAdapters(); track a.id) {
                      <div>
                        {{ a.label }}:
                        <span [class.text-emerald-400]="a.available" [class.text-amber-400]="!a.available">
                          {{ a.available ? 'disponível' : 'indisponível' }}
                        </span>
                        @if (a.detail) {
                          <span class="text-slate-500"> — {{ a.detail }}</span>
                        }
                      </div>
                    }
                  } @else {
                    <div>
                      Pandoc:
                      <span [class.text-emerald-400]="converterTools()?.pandoc" [class.text-amber-400]="!converterTools()?.pandoc">
                        {{ converterTools()?.pandoc ? 'detectado' : 'não encontrado' }}
                      </span>
                    </div>
                    <div>
                      Calibre (ebook-convert):
                      <span [class.text-emerald-400]="converterTools()?.calibre" [class.text-amber-400]="!converterTools()?.calibre">
                        {{ converterTools()?.calibre ? 'detectado' : 'não encontrado' }}
                      </span>
                    </div>
                  }
                </div>
              </div>
            </section>
          }

          <!-- ================= TAB: AI ================= -->
          @if (activeTab() === 'ai') {
            <section class="space-y-6">
              <div class="border-b border-slate-800 pb-3">
                <h2 class="text-lg font-bold text-indigo-400">Inteligência Artificial & Tradução</h2>
                <p class="text-xs text-slate-400 mt-1">
                  OpenRouter (nuvem) ou assistente local via Ollama / LM Studio (API OpenAI-compatible)
                </p>
              </div>

              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <label class="flex items-center justify-between text-xs text-slate-200 font-bold cursor-pointer">
                  <span>Ativar Recursos de IA no Leitor</span>
                  <input
                    type="checkbox"
                    class="w-4 h-4 accent-indigo-600 rounded"
                    [ngModel]="settingsService.llmEnabled()"
                    (ngModelChange)="settingsService.llmEnabled.set($event)" />
                </label>

                <div>
                  <label class="block text-xs text-slate-300 mb-1 font-medium">Provedor ativo</label>
                  <select
                    class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                    [ngModel]="settingsService.llmProvider()"
                    (ngModelChange)="onLlmProviderChange($event)">
                    <option value="openrouter">OpenRouter (nuvem)</option>
                    <option value="ollama">Ollama (local)</option>
                    <option value="lm_studio">LM Studio (local)</option>
                  </select>
                </div>
              </div>

              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-sm font-bold text-slate-100">OpenRouter</h3>

                <div>
                  <label class="block text-xs text-slate-300 mb-1 font-medium">Chave API do OpenRouter</label>
                  <input
                    type="password"
                    autocomplete="off"
                    placeholder="sk-or-v1-… (vazio = usar .env)"
                    class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                    [ngModel]="settingsService.llmOpenRouterApiKey()"
                    (ngModelChange)="settingsService.llmOpenRouterApiKey.set($event)" />
                  <p class="text-[10px] text-slate-500 mt-1">
                    Preferência do app; se vazia, usa OPENROUTER_API_KEY do ambiente.
                  </p>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Modelo para Tradução OCR (mangá)</label>
                    <select
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="settingsService.llmMangaTranslateModel()"
                      (ngModelChange)="settingsService.llmMangaTranslateModel.set($event)">
                      @for (m of llmMangaModels; track m) {
                        <option [value]="m">{{ m }}</option>
                      }
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Modelo para Interpretação OCR</label>
                    <select
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="settingsService.llmMangaInterpretModel()"
                      (ngModelChange)="settingsService.llmMangaInterpretModel.set($event)">
                      @for (m of llmMangaModels; track m) {
                        <option [value]="m">{{ m }}</option>
                      }
                    </select>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Modelo Q&amp;A (livro)</label>
                    <select
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="settingsService.llmBookQaModel()"
                      (ngModelChange)="settingsService.llmBookQaModel.set($event)">
                      @for (m of llmMangaModels; track m) {
                        <option [value]="m">{{ m }}</option>
                      }
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Modelo resumo (livro)</label>
                    <select
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="settingsService.llmBookSummaryModel()"
                      (ngModelChange)="settingsService.llmBookSummaryModel.set($event)">
                      @for (m of llmMangaModels; track m) {
                        <option [value]="m">{{ m }}</option>
                      }
                    </select>
                  </div>
                </div>

                <div class="pt-2">
                  <button type="button" (click)="onTestAiConnection('openrouter')" [disabled]="aiTesting()"
                    class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer">
                    {{ aiTesting() ? 'Testando…' : 'Testar conexão OpenRouter' }}
                  </button>
                </div>
              </div>

              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-sm font-bold text-slate-100">Assistente local (Ollama / LM Studio)</h3>
                <p class="text-[10px] text-slate-500">
                  API OpenAI-compatible em <code class="text-slate-400">/v1/chat/completions</code>.
                  Modelos locais não sobrescrevem os IDs do OpenRouter.
                </p>

                <div>
                  <label class="block text-xs text-slate-300 mb-1 font-medium">Backend local</label>
                  <select
                    class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                    [ngModel]="settingsService.llmLocalKind()"
                    (ngModelChange)="onLocalKindChange($event)">
                    <option value="ollama">Ollama</option>
                    <option value="lm_studio">LM Studio</option>
                  </select>
                </div>

                <div>
                  <label class="block text-xs text-slate-300 mb-1 font-medium">Base URL</label>
                  <input
                    type="text"
                    class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                    [ngModel]="localBaseUrl()"
                    (ngModelChange)="setLocalBaseUrl($event)"
                    [placeholder]="settingsService.llmLocalKind() === 'ollama' ? 'http://127.0.0.1:11434/v1' : 'http://127.0.0.1:1234/v1'" />
                </div>

                <div>
                  <label class="block text-xs text-slate-300 mb-1 font-medium">API key (opcional)</label>
                  <input
                    type="password"
                    autocomplete="off"
                    placeholder="vazio na maioria dos casos; LM Studio às vezes usa lm-studio"
                    class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                    [ngModel]="localApiKey()"
                    (ngModelChange)="setLocalApiKey($event)" />
                </div>

                <div class="flex flex-wrap gap-2">
                  <button type="button" (click)="onTestLocalConnection()" [disabled]="localTesting()"
                    class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer">
                    {{ localTesting() ? 'Testando…' : 'Testar conexão' }}
                  </button>
                  <button type="button" (click)="onRefreshLocalModels()" [disabled]="localModelsLoading()"
                    class="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold rounded-lg text-slate-200 transition-colors cursor-pointer">
                    {{ localModelsLoading() ? 'Atualizando…' : 'Atualizar modelos' }}
                  </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Modelo Q&amp;A (livro)</label>
                    <input list="local-llm-models" type="text"
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="settingsService.llmBookLocalModel()"
                      (ngModelChange)="settingsService.llmBookLocalModel.set($event)" />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Modelo resumo (livro)</label>
                    <input list="local-llm-models" type="text"
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="settingsService.llmBookLocalModelSummary()"
                      (ngModelChange)="settingsService.llmBookLocalModelSummary.set($event)" />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Modelo mangá / OCR</label>
                    <input list="local-llm-models" type="text"
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="settingsService.llmMangaLocalModel()"
                      (ngModelChange)="settingsService.llmMangaLocalModel.set($event)" />
                  </div>
                </div>
                <datalist id="local-llm-models">
                  @for (m of localModelIds(); track m) {
                    <option [value]="m"></option>
                  }
                </datalist>
              </div>

              <div class="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-sm font-bold text-slate-100">Limites e temperatura</h3>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Máx. contexto (chars)</label>
                    <input type="number" min="2000" max="100000" step="500"
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="settingsService.llmMaxContextChars()"
                      (ngModelChange)="settingsService.llmMaxContextChars.set(+$event || 12000)" />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Máx. histórico (chars)</label>
                    <input type="number" min="100" max="8000" step="50"
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="settingsService.llmMaxHistoryChars()"
                      (ngModelChange)="settingsService.llmMaxHistoryChars.set(+$event || 600)" />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Máx. capítulos (livro)</label>
                    <input type="number" min="1" max="20" step="1"
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="settingsService.llmMaxBookChapters()"
                      (ngModelChange)="settingsService.llmMaxBookChapters.set(+$event || 5)" />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Máx. páginas (mangá)</label>
                    <input type="number" min="1" max="50" step="1"
                      class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200"
                      [ngModel]="settingsService.llmMaxMangaPages()"
                      (ngModelChange)="settingsService.llmMaxMangaPages.set(+$event || 10)" />
                  </div>
                </div>

                <div>
                  <label class="block text-xs text-slate-300 mb-1 font-medium">
                    Temperatura ({{ settingsService.llmTemperature() }})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    class="w-full accent-indigo-600"
                    [ngModel]="settingsService.llmTemperature()"
                    (ngModelChange)="settingsService.llmTemperature.set(+$event)" />
                </div>

                <label class="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
                  <span>Traduzir automaticamente após OCR</span>
                  <input
                    type="checkbox"
                    class="w-4 h-4 accent-indigo-600 rounded"
                    [ngModel]="settingsService.ocrAutoTranslate()"
                    (ngModelChange)="settingsService.ocrAutoTranslate.set($event)" />
                </label>

                <label class="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
                  <span>Interpretar automaticamente após OCR</span>
                  <input
                    type="checkbox"
                    class="w-4 h-4 accent-indigo-600 rounded"
                    [ngModel]="settingsService.ocrAutoInterpret()"
                    (ngModelChange)="settingsService.ocrAutoInterpret.set($event)" />
                </label>
              </div>
            </section>
          }

          <!-- ================= TAB: TRACKER (MAL / ANILIST) ================= -->
          @if (activeTab() === 'tracker') {
            <section class="space-y-6">
              <div class="border-b border-slate-800 pb-3">
                <h2 class="text-lg font-bold text-indigo-400">Rastreadores & Sincronização Externa</h2>
                <p class="text-xs text-slate-400 mt-1">
                  Gerencie contas, credenciais de acesso e sincronização de progresso com MyAnimeList e AniList
                </p>
              </div>

              <!-- Two Main Tracker Cards Grid -->
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                
                <!-- CARD 1: MyAnimeList (MAL) -->
                <div class="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-slate-700/80 transition-all">
                  <div class="space-y-4">
                    <!-- Top header of card -->
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-[#2e51a2] flex items-center justify-center text-white font-black text-xs shadow-lg shadow-[#2e51a2]/30 shrink-0">
                          MAL
                        </div>
                        <div>
                          <h3 class="text-sm font-bold text-slate-100 flex items-center gap-2">
                            MyAnimeList
                          </h3>
                          <span class="text-[10px] text-slate-400">myanimelist.net</span>
                        </div>
                      </div>

                      @if (malStatus().connected) {
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Conectado
                        </span>
                      } @else {
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          Não Conectado
                        </span>
                      }
                    </div>

                    <p class="text-[11px] text-slate-400 leading-relaxed">
                      Sincronize automaticamente capítulos e volumes de mangás lidos com a sua lista pessoal do MyAnimeList.
                    </p>

                    <!-- Info Items -->
                    <div class="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 text-xs">
                      <div class="flex items-center justify-between text-[11px]">
                        <span class="text-slate-400 font-medium">Usuário Conectado:</span>
                        <span class="font-semibold" [class.text-indigo-300]="malStatus().connected" [class.text-slate-500]="!malStatus().connected">
                          {{ malStatus().username || 'Nenhum' }}
                        </span>
                      </div>
                      <div class="flex items-center justify-between text-[11px]">
                        <span class="text-slate-400 font-medium">Última Sincronização:</span>
                        <span class="text-slate-300 font-mono text-[10px]">
                          {{ malStatus().lastSync || 'Nunca' }}
                        </span>
                      </div>
                      <div class="flex items-center justify-between text-[11px]">
                        <span class="text-slate-400 font-medium">Escopo de Mídia:</span>
                        <span class="text-slate-300">Mangás, Manhwas & Novels</span>
                      </div>
                    </div>

                    <!-- Config Options -->
                    <div class="pt-1 space-y-2.5 text-xs text-slate-300">
                      <label class="flex items-center justify-between cursor-pointer">
                        <span class="text-[11px]">Sincronizar ao terminar leitura de capítulo</span>
                        <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                      </label>
                      <label class="flex items-center justify-between cursor-pointer">
                        <span class="text-[11px]">Atualizar pontuação (score) no MAL</span>
                        <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                      </label>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="pt-3 border-t border-slate-800 flex items-center justify-between gap-2.5">
                    @if (malStatus().connected) {
                      <button
                        type="button"
                        (click)="onLogoutMal()"
                        class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer">
                        Desconectar
                      </button>
                      <button
                        type="button"
                        (click)="onSyncMal()"
                        class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/20">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        <span>Sincronizar Agora</span>
                      </button>
                    } @else {
                      <button
                        type="button"
                        (click)="onLoginMal()"
                        class="w-full py-2.5 rounded-xl bg-[#2e51a2] hover:bg-[#254285] text-white text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#2e51a2]/25">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
                        <span>Conectar MyAnimeList</span>
                      </button>
                    }
                  </div>
                </div>

                <!-- CARD 2: AniList (AL) -->
                <div class="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-slate-700/80 transition-all">
                  <div class="space-y-4">
                    <!-- Top header of card -->
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-[#02a9ff] flex items-center justify-center text-white font-black text-xs shadow-lg shadow-[#02a9ff]/30 shrink-0">
                          AL
                        </div>
                        <div>
                          <h3 class="text-sm font-bold text-slate-100 flex items-center gap-2">
                            AniList
                          </h3>
                          <span class="text-[10px] text-slate-400">anilist.co</span>
                        </div>
                      </div>

                      @if (aniListStatus().connected) {
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Conectado
                        </span>
                      } @else {
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          Não Conectado
                        </span>
                      }
                    </div>

                    <p class="text-[11px] text-slate-400 leading-relaxed">
                      Conecte sua conta do AniList via GraphQL para rastreamento em tempo real de suas leituras e pontuações.
                    </p>

                    <!-- Info Items -->
                    <div class="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 text-xs">
                      <div class="flex items-center justify-between text-[11px]">
                        <span class="text-slate-400 font-medium">Usuário Conectado:</span>
                        <span class="font-semibold" [class.text-sky-300]="aniListStatus().connected" [class.text-slate-500]="!aniListStatus().connected">
                          {{ aniListStatus().username || 'Nenhum' }}
                        </span>
                      </div>
                      <div class="flex items-center justify-between text-[11px]">
                        <span class="text-slate-400 font-medium">Última Sincronização:</span>
                        <span class="text-slate-300 font-mono text-[10px]">
                          {{ aniListStatus().lastSync || 'Nunca' }}
                        </span>
                      </div>
                      <div class="flex items-center justify-between text-[11px]">
                        <span class="text-slate-400 font-medium">Escopo de Mídia:</span>
                        <span class="text-slate-300">Mangás, Manhwas & Light Novels</span>
                      </div>
                    </div>

                    <!-- Config Options -->
                    <div class="pt-1 space-y-2.5 text-xs text-slate-300">
                      <label class="flex items-center justify-between cursor-pointer">
                        <span class="text-[11px]">Sincronizar ao terminar leitura de capítulo</span>
                        <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                      </label>
                      <label class="flex items-center justify-between cursor-pointer">
                        <span class="text-[11px]">Atualizar formato de notas avançado (AniList)</span>
                        <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                      </label>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="pt-3 border-t border-slate-800 flex items-center justify-between gap-2.5">
                    @if (aniListStatus().connected) {
                      <button
                        type="button"
                        (click)="onLogoutAniList()"
                        class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer">
                        Desconectar
                      </button>
                      <button
                        type="button"
                        (click)="onSyncAniList()"
                        class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/20">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        <span>Sincronizar Agora</span>
                      </button>
                    } @else {
                      <button
                        type="button"
                        (click)="onLoginAniList()"
                        class="w-full py-2.5 rounded-xl bg-[#02a9ff] hover:bg-[#0092dd] text-white text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#02a9ff]/25">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
                        <span>Conectar AniList</span>
                      </button>
                    }
                  </div>
                </div>

              </div>

              <!-- General Tracker Config -->
              <div class="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Preferências Gerais de Rastreamento</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Provedor Principal Preferencial</label>
                    <select class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 cursor-pointer">
                      <option value="myanimelist">MyAnimeList</option>
                      <option value="anilist">AniList</option>
                      <option value="both">Ambos (Sincronização Dupla)</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs text-slate-300 mb-1 font-medium">Modo de Correspondência Automática</label>
                    <select class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 cursor-pointer">
                      <option value="cascade">Cascata: ID > Título > Regex</option>
                      <option value="strict">Apenas Correspondência Exata (ID/Regex)</option>
                    </select>
                  </div>
                </div>

                <div class="pt-3 border-t border-slate-800/80 space-y-3">
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Exibir notificações no aplicativo ao sincronizar status</span>
                    <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                  <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                    <span>Rastrear capítulos lidos em modo offline e sincronizar ao reconectar</span>
                    <input type="checkbox" checked class="w-4 h-4 accent-indigo-600 rounded">
                  </label>
                </div>
              </div>
            </section>
          }

          @if (shareMark.toastMessage() || localToast()) {
            <div
              class="fixed bottom-6 right-8 z-50 max-w-sm px-4 py-3 rounded-xl border shadow-xl text-xs font-medium flex items-center gap-3"
              [ngClass]="{
                'bg-slate-900 border-slate-700 text-slate-200': (localToast()?.kind || shareMark.toastKind()) === 'info',
                'bg-emerald-950 border-emerald-700/50 text-emerald-200': (localToast()?.kind || shareMark.toastKind()) === 'success',
                'bg-red-950 border-red-700/50 text-red-200': (localToast()?.kind || shareMark.toastKind()) === 'error'
              }">
              <span class="flex-1">{{ localToast()?.message || shareMark.toastMessage() }}</span>
              <button type="button" (click)="dismissLocalToast(); shareMark.dismissToast()" class="text-[10px] uppercase tracking-wider opacity-70 hover:opacity-100 cursor-pointer">
                Fechar
              </button>
            </div>
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

              <div>
                <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input type="checkbox"
                    class="w-4 h-4 accent-indigo-600 rounded"
                    [(ngModel)]="libraryForm.externalHd">
                  <span>HD Externo</span>
                  <span class="text-[10px] text-slate-500">(protege contra exclusão quando desconectado)</span>
                </label>
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

      <app-reader-touch-config
        [open]="showTouchConfig()"
        [type]="touchConfigType()"
        [coverUrl]="null"
        (close)="showTouchConfig.set(false)" />

      <!-- Progress Modal for Reading Time Batch Recalculation -->
      @if (recalculating()) {
        <div class="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 flex flex-col items-center text-center space-y-4">
            <div class="w-12 h-12 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <svg class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-100">Calculando tempos de leitura</h3>
              <p class="text-xs text-slate-400 mt-1 truncate max-w-[18rem]">{{ recalculateTitle() || 'Processando registros...' }}</p>
            </div>
            <div class="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                class="h-full bg-indigo-600 transition-all duration-200"
                [style.width.%]="recalculatePercent()"></div>
            </div>
            <p class="text-[11px] text-slate-500 font-medium">
              {{ recalculateCurrent() }} de {{ recalculateTotal() }} registros ({{ recalculatePercent() }}%)
            </p>
          </div>
        </div>
      }
    </div>
  `
})
export class SettingsComponent implements OnInit {
  private electronService = inject(ElectronService);
  themeService = inject(ThemeService);
  settingsService = inject(SettingsService);
  shareMark = inject(ShareMarkUiService);
  private libraryState = inject(LibraryStateService);
  private confirmDialog = inject(ConfirmDialogService);

  MangaFitMode = MangaFitMode;
  MangaScrollingMode = MangaScrollingMode;
  OrderType = OrderType;
  Math = Math;
  pageTransitionOptions = PAGE_TRANSITION_OPTIONS;
  pageTransitionLabels = PAGE_TRANSITION_LABELS_PT;
  llmMangaModels = [...LLM_MANGA_MODEL_OPTIONS];
  westernFonts = westernFontOptions();
  japaneseFonts = japaneseFontOptions();

  activeTab = signal<SettingTab>('manga');
  showTouchConfig = signal(false);
  touchConfigType = signal<ReaderTouchType>('manga');
  aiTesting = signal(false);
  localTesting = signal(false);
  localModelsLoading = signal(false);
  localModelIds = signal<string[]>([]);
  localToast = signal<{ message: string; kind: 'info' | 'success' | 'error' } | null>(null);
  converterTools = signal<{ pandoc: boolean; calibre: boolean } | null>(null);
  converterAdapters = signal<
    Array<{ id: string; label: string; available: boolean; detail?: string | null }>
  >([]);
  private localToastTimer: ReturnType<typeof setTimeout> | null = null;

  // Reading Time Batch Recalculate State
  recalculating = signal(false);
  recalculateCurrent = signal(0);
  recalculateTotal = signal(0);
  recalculateTitle = signal('');
  recalculatePercent = computed(() => {
    const total = this.recalculateTotal();
    if (total <= 0) return 0;
    return Math.min(100, Math.round((this.recalculateCurrent() / total) * 100));
  });

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

  showLocalToast(message: string, kind: 'info' | 'success' | 'error' = 'info'): void {
    if (this.localToastTimer) clearTimeout(this.localToastTimer);
    this.localToast.set({ message, kind });
    this.localToastTimer = setTimeout(() => this.localToast.set(null), 4200);
  }

  dismissLocalToast(): void {
    if (this.localToastTimer) clearTimeout(this.localToastTimer);
    this.localToast.set(null);
  }

  onLibraryDefaultOrder(order: OrderType): void {
    this.settingsService.libraryDefaultOrder.set(order);
    this.libraryState.setCurrentOrder(order, 'manga');
    this.libraryState.setCurrentOrder(order, 'book');
  }

  async onCreateBackup(): Promise<void> {
    const result = await this.electronService.dbBackup();
    if (result.canceled) return;
    if (result.ok) {
      this.showLocalToast(`Backup salvo${result.path ? `: ${result.path}` : ''}`, 'success');
    } else {
      this.showLocalToast(result.error || 'Falha ao criar backup', 'error');
    }
  }

  async onRestoreBackup(): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Restaurar Backup',
      message: 'Restaurar um backup substituirá todo o banco de dados atual e reiniciará o aplicativo.\n\nDeseja continuar?',
      confirmText: 'Restaurar',
      confirmVariant: 'warning',
      icon: 'warning'
    });
    if (!ok) return;
    const result = await this.electronService.dbRestore();
    if (result.canceled) return;
    if (!result.ok) {
      this.showLocalToast(result.error || 'Falha ao restaurar backup', 'error');
    }
  }

  async onExportDataJson(): Promise<void> {
    const result = await this.electronService.dataExportJson();
    if (result.canceled) return;
    if (result.ok) {
      this.showLocalToast(`Exportados ${result.count ?? 0} itens para JSON com sucesso!`, 'success');
    } else {
      this.showLocalToast(result.error || 'Falha ao exportar dados em JSON', 'error');
    }
  }

  async onImportDataJson(): Promise<void> {
    const result = await this.electronService.dataImportJson();
    if (result.canceled) return;
    if (result.ok) {
      this.showLocalToast(`Importados ${result.count ?? 0} de ${result.total ?? 0} itens do JSON com sucesso!`, 'success');
    } else {
      this.showLocalToast(result.error || 'Falha ao importar dados do JSON', 'error');
    }
  }

  async onClearCoverCache(): Promise<void> {
    const result = await this.electronService.coversClearCache();
    if (result.ok) {
      this.showLocalToast(
        `Capas limpas (${result.mangaRemoved + result.bookRemoved} arquivos)`,
        'success'
      );
    } else {
      this.showLocalToast('Falha ao limpar capas', 'error');
    }
  }

  async onClearStatisticsHistory(): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Limpar Histórico de Estatísticas',
      message: 'Isso apagará todo o histórico de leitura usado nas estatísticas.\n\nMarcadores e progresso de leitura dos arquivos NÃO serão alterados. Deseja continuar?',
      confirmText: 'Limpar Histórico',
      confirmVariant: 'danger',
      icon: 'danger'
    });
    if (!ok) return;
    const result = await this.electronService.statisticsClearHistory();
    if (result.ok) {
      this.showLocalToast(`Histórico limpo (${result.removed} sessões)`, 'success');
    } else {
      this.showLocalToast('Falha ao limpar histórico', 'error');
    }
  }

  async onTestAiConnection(provider: LlmProviderSetting = 'openrouter'): Promise<void> {
    this.aiTesting.set(true);
    try {
      const result = await this.electronService.aiTestConnection(provider);
      if (result.ok) {
        this.showLocalToast(
          `Conexão OK${typeof result.models === 'number' ? ` (${result.models} modelos)` : ''}`,
          'success'
        );
      } else {
        this.showLocalToast(result.error || 'Falha na conexão', 'error');
      }
    } finally {
      this.aiTesting.set(false);
    }
  }

  onLlmProviderChange(value: string): void {
    const p =
      value === 'ollama' || value === 'lm_studio' || value === 'openrouter'
        ? (value as LlmProviderSetting)
        : 'openrouter';
    this.settingsService.llmProvider.set(p);
    if (p === 'ollama' || p === 'lm_studio') {
      this.settingsService.llmLocalKind.set(p);
    }
  }

  onLocalKindChange(value: string): void {
    const kind: LlmLocalKind = value === 'lm_studio' ? 'lm_studio' : 'ollama';
    this.settingsService.llmLocalKind.set(kind);
  }

  localBaseUrl(): string {
    return this.settingsService.llmLocalKind() === 'lm_studio'
      ? this.settingsService.llmLmStudioBaseUrl()
      : this.settingsService.llmOllamaBaseUrl();
  }

  setLocalBaseUrl(value: string): void {
    if (this.settingsService.llmLocalKind() === 'lm_studio') {
      this.settingsService.llmLmStudioBaseUrl.set(value);
    } else {
      this.settingsService.llmOllamaBaseUrl.set(value);
    }
  }

  localApiKey(): string {
    return this.settingsService.llmLocalKind() === 'lm_studio'
      ? this.settingsService.llmLmStudioApiKey()
      : this.settingsService.llmOllamaApiKey();
  }

  setLocalApiKey(value: string): void {
    if (this.settingsService.llmLocalKind() === 'lm_studio') {
      this.settingsService.llmLmStudioApiKey.set(value);
    } else {
      this.settingsService.llmOllamaApiKey.set(value);
    }
  }

  async onTestLocalConnection(): Promise<void> {
    this.localTesting.set(true);
    try {
      const result = await this.electronService.llmTestLocal({
        baseUrl: this.localBaseUrl(),
        apiKey: this.localApiKey()
      });
      if (result.ok) {
        this.showLocalToast(
          `Local OK${typeof result.models === 'number' ? ` (${result.models} modelos)` : ''}`,
          'success'
        );
      } else {
        this.showLocalToast(result.error || 'Falha na conexão local', 'error');
      }
    } finally {
      this.localTesting.set(false);
    }
  }

  async onRefreshLocalModels(): Promise<void> {
    this.localModelsLoading.set(true);
    try {
      const result = await this.electronService.llmListLocalModels({
        baseUrl: this.localBaseUrl(),
        apiKey: this.localApiKey()
      });
      if (!result.ok) {
        this.showLocalToast(result.error || 'Falha ao listar modelos', 'error');
        return;
      }
      const ids = (result.models || []).map(m => m.id).filter(Boolean);
      this.localModelIds.set(ids);
      if (ids.length && !ids.includes(this.settingsService.llmBookLocalModel())) {
        this.settingsService.llmBookLocalModel.set(ids[0]);
      }
      if (ids.length && !ids.includes(this.settingsService.llmBookLocalModelSummary())) {
        this.settingsService.llmBookLocalModelSummary.set(ids[0]);
      }
      if (ids.length && !ids.includes(this.settingsService.llmMangaLocalModel())) {
        this.settingsService.llmMangaLocalModel.set(ids[0]);
      }
      this.showLocalToast(`${ids.length} modelo(s) local(is)`, 'success');
    } finally {
      this.localModelsLoading.set(false);
    }
  }

  async onShareMarkEnabled(event: Event): Promise<void> {
    const checked = (event.target as HTMLInputElement).checked;
    await this.shareMark.setEnabled(checked);
  }

  async onShareMarkCloud(value: string): Promise<void> {
    const cloud = value === ShareMarkCloud.FIRESTORE ? ShareMarkCloud.FIRESTORE : ShareMarkCloud.GOOGLE_DRIVE;
    await this.shareMark.setCloud(cloud);
  }

  formatLastSync(value: string | null): string {
    if (!value) return 'Nunca';
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return value;
      return d.toLocaleString();
    } catch {
      return value;
    }
  }

  selectTheme(mode: ThemeMode): void {
    this.themeService.setTheme(mode);
  }

  selectAccent(accent: AccentColor): void {
    this.themeService.setAccent(accent);
  }

  openTouchConfig(type: ReaderTouchType): void {
    this.touchConfigType.set(type);
    this.showTouchConfig.set(true);
  }

  // EPUB / TTS Signals
  ttsSpeed = signal<number>(TTS_SPEED_DEFAULT);
  ttsVoiceNormal = signal<TextSpeech>(textSpeechDefault(false));
  ttsVoiceJapanese = signal<TextSpeech>(textSpeechDefault(true));
  ttsSpeedLabel = computed(() => formatTtsSpeedLabel(this.ttsSpeed()));
  readonly ttsVoicesNormal = activeTextSpeechVoices().filter(
    v => v.language !== Languages.JAPANESE
  );
  readonly ttsVoicesJapanese = activeTextSpeechVoices().filter(
    v => v.language === Languages.JAPANESE
  );
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

  ngOnInit(): void {
    void this.shareMark.refreshStatus();
    void this.loadTtsSettings();
    void this.loadConverterTools();
  }

  private async loadConverterTools(): Promise<void> {
    const status = await this.electronService.converterToolsStatus();
    this.converterTools.set({ pandoc: status.pandoc, calibre: status.calibre });
    this.converterAdapters.set(status.adapters || []);
    const mode = await this.electronService.getSetting(EBOOK_CONVERT_MODE_KEY, 'auto');
    this.settingsService.ebookConvertMode.set(normalizeEbookConvertMode(mode));
  }

  onEbookConvertModeChange(value: string): void {
    this.settingsService.ebookConvertMode.set(normalizeEbookConvertMode(value));
  }

  private async loadTtsSettings(): Promise<void> {
    const normal = await this.electronService.getSetting(
      TTS_VOICE_NORMAL_KEY,
      textSpeechDefault(false)
    );
    const japanese = await this.electronService.getSetting(
      TTS_VOICE_JAPANESE_KEY,
      textSpeechDefault(true)
    );
    const speed = await this.electronService.getSetting(TTS_SPEED_KEY, TTS_SPEED_DEFAULT);
    this.ttsVoiceNormal.set(parseTextSpeech(normal, textSpeechDefault(false)));
    this.ttsVoiceJapanese.set(parseTextSpeech(japanese, textSpeechDefault(true)));
    const n = Number(speed);
    this.ttsSpeed.set(Number.isFinite(n) ? Math.max(-50, Math.min(50, Math.round(n / 5) * 5)) : 0);
  }

  async onTtsVoiceNormal(value: TextSpeech): Promise<void> {
    this.ttsVoiceNormal.set(value);
    await this.electronService.setSetting(TTS_VOICE_NORMAL_KEY, value);
  }

  async onTtsVoiceJapanese(value: TextSpeech): Promise<void> {
    this.ttsVoiceJapanese.set(value);
    await this.electronService.setSetting(TTS_VOICE_JAPANESE_KEY, value);
  }

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
      type: type,
      externalHd: false
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
      this.showLocalToast('Por favor, preencha o título e o caminho da biblioteca.', 'error');
      return;
    }

    if (this.modalMode() === 'add') {
      this.settingsService.addLibrary({ ...this.libraryForm });
    } else {
      this.settingsService.updateLibrary({ ...this.libraryForm });
    }

    this.closeLibraryModal();
  }

  async deleteLibrary(id: string, event?: MouseEvent): Promise<void> {
    if (event) {
      event.stopPropagation();
    }
    const ok = await this.confirmDialog.confirm({
      title: 'Remover Biblioteca',
      message: 'Deseja remover esta biblioteca da lista?\n\nOs arquivos no seu disco rígido não serão apagados.',
      confirmText: 'Remover',
      confirmVariant: 'danger',
      icon: 'danger'
    });
    if (ok) {
      this.settingsService.deleteLibrary(id);
    }
  }

  // Range Slider Handlers
  async updateTtsSpeed(event: Event): Promise<void> {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    const n = Number.isFinite(val) ? Math.max(-50, Math.min(50, Math.round(val / 5) * 5)) : 0;
    this.ttsSpeed.set(n);
    await this.electronService.setSetting(TTS_SPEED_KEY, n);
  }

  updateFontSize(event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    this.fontSize.set(val);
  }

  async startRecalculateBatch(type: 'MANGA' | 'BOOK', onlyNew: boolean): Promise<void> {
    const typeLabel = type === 'MANGA' ? 'mangás' : 'livros';
    const actionLabel = onlyNew
      ? `Calcular tempos de leitura para novos registros de ${typeLabel}?`
      : `Recalcular tempos para TODOS os registros de ${typeLabel}?\n\n(Será aplicado apenas se o novo tempo for superior ao atual)`;

    const ok = await this.confirmDialog.confirm({
      title: 'Recalcular Tempos de Leitura',
      message: actionLabel,
      confirmText: 'Recalcular',
      confirmVariant: 'warning',
      icon: 'warning'
    });
    if (!ok) return;

    this.recalculating.set(true);
    this.recalculateCurrent.set(0);
    this.recalculateTotal.set(0);
    this.recalculateTitle.set('Iniciando...');

    const removeListener = this.electronService.onRecalculateProgress(p => {
      this.recalculateCurrent.set(p.current);
      this.recalculateTotal.set(p.total);
      this.recalculateTitle.set(p.title);
    });

    try {
      const result = await this.electronService.recalculateReadingTimeBatch({
        type,
        onlyNew,
        avgTimePerPage: this.settingsService.mangaAvgTimePerPage() || 120,
        avgTimePerWord: this.settingsService.bookAvgTimePerWord() || 0.24
      });

      this.showLocalToast(
        `Recálculo concluído: ${result.updated} de ${result.processed} registros atualizados.`,
        'success'
      );
    } catch (e) {
      console.error('Error recalculating reading time batch', e);
      this.showLocalToast('Erro ao recalcular tempos de leitura.', 'error');
    } finally {
      removeListener();
      this.recalculating.set(false);
    }
  }

  // ================= Tracker Authentication & Sync State =================
  malStatus = signal<{ connected: boolean; username: string | null; lastSync: string | null }>({
    connected: false,
    username: null,
    lastSync: null
  });

  aniListStatus = signal<{ connected: boolean; username: string | null; lastSync: string | null }>({
    connected: false,
    username: null,
    lastSync: null
  });

  onLoginMal(): void {
    this.showLocalToast('Autenticação com MyAnimeList será disponibilizada em breve!', 'info');
  }

  onLogoutMal(): void {
    this.malStatus.set({ connected: false, username: null, lastSync: null });
    this.showLocalToast('Conta do MyAnimeList desconectada.', 'info');
  }

  onSyncMal(): void {
    this.malStatus.update(s => ({ ...s, lastSync: new Date().toLocaleString('pt-BR') }));
    this.showLocalToast('Sincronização com MyAnimeList solicitada com sucesso!', 'success');
  }

  onLoginAniList(): void {
    this.showLocalToast('Autenticação com AniList será disponibilizada em breve!', 'info');
  }

  onLogoutAniList(): void {
    this.aniListStatus.set({ connected: false, username: null, lastSync: null });
    this.showLocalToast('Conta do AniList desconectada.', 'info');
  }

  onSyncAniList(): void {
    this.aniListStatus.update(s => ({ ...s, lastSync: new Date().toLocaleString('pt-BR') }));
    this.showLocalToast('Sincronização com AniList solicitada com sucesso!', 'success');
  }
}
