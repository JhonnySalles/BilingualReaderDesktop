import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../core/services/electron.service';
import {
  PLATFORM_PRESETS,
  SocialImageGeneratorService
} from '../../core/services/social-image-generator.service';
import {
  SocialBackgroundPattern,
  SocialCustomThemeConfig,
  SocialLayoutTemplate,
  SocialPlatformPreset,
  SocialRenderedPage,
  SocialRenderOptions,
  SocialShareItem,
  SocialTheme
} from '../../core/models/social-share.model';
import { SocialShareService } from '../../core/services/social-share.service';
import { LibraryOption } from '../../core/models';
import { TeleportToBodyDirective } from '../directives/teleport-to-body.directive';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-social-share-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TeleportToBodyDirective, TranslatePipe],
  template: `
    @if (isVisible()) {
      <div
        appTeleportToBody
        class="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in select-none"
        (click)="onBackdropClick($event)">
        <div
          class="w-full max-w-6xl h-[92vh] max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden animate-scale-in"
          (click)="$event.stopPropagation()">

          <!-- Header -->
          <header class="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <span class="p-2 rounded-xl bg-primary-500/10 text-primary-400 border border-primary-500/20 text-lg">
                📸
              </span>
              <div>
                <h2 class="text-base font-bold text-slate-100 flex items-center gap-2">
                  {{ 'socialShare.title' | translate }}
                  <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-300">
                    {{ 'socialShare.subtitle' | translate }}
                  </span>
                </h2>
                <p class="text-xs text-slate-400">
                  {{ 'socialShare.tagline' | translate }}
                </p>
              </div>
            </div>
            <button
              type="button"
              (click)="handleClose()"
              class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              [title]="'common.close' | translate">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>

          <!-- Body: Duas Colunas (Opções / Curadoria à esquerda, Preview à direita) -->
          <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
            
            <!-- Coluna Esquerda: Controles de Configuração -->
            <div class="lg:col-span-5 p-6 border-b lg:border-b-0 lg:border-r border-slate-800 overflow-y-auto space-y-6">

              <!-- 1. Período e Tipo de Mídia -->
              <section class="space-y-3">
                <label class="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Período & Conteúdo
                </label>
                
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    (click)="setPeriodPreset('week')"
                    class="py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer"
                    [ngClass]="activePeriod() === 'week' ? 'bg-primary-600 border-primary-500 text-white shadow-lg shadow-primary-600/20' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
                    Últimos 7 Dias
                  </button>
                  <button
                    type="button"
                    (click)="setPeriodPreset('month')"
                    class="py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer"
                    [ngClass]="activePeriod() === 'month' ? 'bg-primary-600 border-primary-500 text-white shadow-lg shadow-primary-600/20' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
                    Este Mês
                  </button>
                  <button
                    type="button"
                    (click)="setPeriodPreset('year')"
                    class="py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer"
                    [ngClass]="activePeriod() === 'year' ? 'bg-primary-600 border-primary-500 text-white shadow-lg shadow-primary-600/20' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
                    Este Ano
                  </button>
                  <button
                    type="button"
                    (click)="setPeriodPreset('custom')"
                    class="py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer"
                    [ngClass]="activePeriod() === 'custom' ? 'bg-primary-600 border-primary-500 text-white shadow-lg shadow-primary-600/20' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
                    Personalizado
                  </button>
                </div>

                @if (activePeriod() === 'custom') {
                  <div class="grid grid-cols-2 gap-2 pt-1 animate-fade-in">
                    <div>
                      <label class="text-[10px] text-slate-400 block mb-1">De</label>
                      <input
                        type="date"
                        [(ngModel)]="startDate"
                        (change)="loadItems()"
                        class="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200" />
                    </div>
                    <div>
                      <label class="text-[10px] text-slate-400 block mb-1">Até</label>
                      <input
                        type="date"
                        [(ngModel)]="endDate"
                        (change)="loadItems()"
                        class="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200" />
                    </div>
                  </div>
                }

                <!-- Filtro de Tipo de Mídia -->
                <div class="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                  <button
                    type="button"
                    (click)="setMediaType('ALL')"
                    class="py-1.5 rounded-lg font-semibold transition-all cursor-pointer"
                    [class.bg-primary-600]="mediaType() === 'ALL'"
                    [class.text-white]="mediaType() === 'ALL'"
                    [class.shadow]="mediaType() === 'ALL'"
                    [class.text-slate-400]="mediaType() !== 'ALL'"
                    [class.hover:text-slate-200]="mediaType() !== 'ALL'">
                    Tudo
                  </button>
                  <button
                    type="button"
                    (click)="setMediaType('MANGA')"
                    class="py-1.5 rounded-lg font-semibold transition-all cursor-pointer"
                    [class.manga-pill-active]="mediaType() === 'MANGA'"
                    [class.shadow]="mediaType() === 'MANGA'"
                    [class.text-slate-400]="mediaType() !== 'MANGA'"
                    [class.hover:text-slate-200]="mediaType() !== 'MANGA'">
                    Mangás
                  </button>
                  <button
                    type="button"
                    (click)="setMediaType('BOOK')"
                    class="py-1.5 rounded-lg font-semibold transition-all cursor-pointer"
                    [class.book-pill-active]="mediaType() === 'BOOK'"
                    [class.shadow]="mediaType() === 'BOOK'"
                    [class.text-slate-400]="mediaType() !== 'BOOK'"
                    [class.hover:text-slate-200]="mediaType() !== 'BOOK'">
                    Livros
                  </button>
                </div>

                <!-- Filtro de Bibliotecas -->
                <div class="space-y-1">
                  <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Biblioteca
                  </label>
                  <div class="relative">
                    <select
                      [ngModel]="selectedLibraryId()"
                      (ngModelChange)="onLibraryChange($event)"
                      class="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-primary-500/80 transition-colors cursor-pointer appearance-none pr-8">
                      <option [ngValue]="null">📚 Todas as bibliotecas</option>
                      @for (lib of filteredLibraries(); track lib.id) {
                        <option [ngValue]="lib.id">
                          {{ lib.type === 'MANGA' ? '📖' : '📚' }} {{ lib.title }}
                        </option>
                      }
                    </select>
                    <div class="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-slate-500">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <label class="flex items-center gap-2 pt-1 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    [(ngModel)]="onlyCompleted"
                    (change)="loadItems()"
                    class="rounded bg-slate-950 border-slate-700 text-primary-600 focus:ring-0" />
                  Apenas obras concluídas no período
                </label>
              </section>

              <!-- 2. Formato da Rede Social (Preset) -->
              <section class="space-y-3">
                <label class="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Rede Social / Proporção
                </label>
                <div class="grid grid-cols-1 gap-2">
                  @for (p of presets; track p.id) {
                    <button
                      type="button"
                      (click)="selectPreset(p.id)"
                      class="p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer"
                      [ngClass]="selectedPreset() === p.id ? 'bg-primary-950/40 border-primary-500/60 ring-1 ring-primary-500/40 text-slate-100' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'">
                      <div>
                        <div class="text-xs font-bold flex items-center gap-2">
                          {{ p.label }}
                          <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            {{ p.aspectRatioLabel }}
                          </span>
                        </div>
                        <div class="text-[11px] text-slate-400">{{ p.sublabel }}</div>
                      </div>
                      <span class="text-xs font-mono text-slate-500">
                        {{ p.id === 'SINGLE_FULL_IMAGE' ? 'Auto' : (p.width + 'x' + p.height) }}
                      </span>
                    </button>
                  }
                </div>
              </section>

              <!-- 3. Layout & Estilo Visual -->
              <section class="space-y-3">
                <label class="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Estilo & Layout
                </label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    (click)="setLayoutTemplate('BENTO_GRID')"
                    class="p-2 rounded-xl border text-center text-xs font-medium transition-all cursor-pointer"
                    [ngClass]="selectedTemplate() === 'BENTO_GRID' ? 'bg-primary-600 border-primary-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
                    🍱 Mosaico Bento
                  </button>
                  <button
                    type="button"
                    (click)="setLayoutTemplate('PERSPECTIVE_SHOWCASE')"
                    class="p-2 rounded-xl border text-center text-xs font-medium transition-all cursor-pointer"
                    [ngClass]="selectedTemplate() === 'PERSPECTIVE_SHOWCASE' ? 'bg-primary-600 border-primary-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
                    📚 Estante 3D
                  </button>
                  <button
                    type="button"
                    (click)="setLayoutTemplate('WRAPPED_STATS')"
                    class="p-2 rounded-xl border text-center text-xs font-medium transition-all cursor-pointer"
                    [ngClass]="selectedTemplate() === 'WRAPPED_STATS' ? 'bg-primary-600 border-primary-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
                    📊 Wrapped Stats
                  </button>
                  <button
                    type="button"
                    (click)="setLayoutTemplate('MINIMALIST_LIST')"
                    class="p-2 rounded-xl border text-center text-xs font-medium transition-all cursor-pointer"
                    [ngClass]="selectedTemplate() === 'MINIMALIST_LIST' ? 'bg-primary-600 border-primary-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
                    📝 Lista Editorial
                  </button>
                  <button
                    type="button"
                    (click)="setLayoutTemplate('MAGAZINE_HERO')"
                    class="p-2 rounded-xl border text-center text-xs font-medium transition-all cursor-pointer"
                    [ngClass]="selectedTemplate() === 'MAGAZINE_HERO' ? 'bg-primary-600 border-primary-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
                    📰 Destaque Magazine
                  </button>
                  <button
                    type="button"
                    (click)="setLayoutTemplate('POLAROID_GALLERY')"
                    class="p-2 rounded-xl border text-center text-xs font-medium transition-all cursor-pointer"
                    [ngClass]="selectedTemplate() === 'POLAROID_GALLERY' ? 'bg-primary-600 border-primary-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
                    🎞️ Mural Polaroid
                  </button>
                  <button
                    type="button"
                    (click)="setLayoutTemplate('PODIUM_RANKING')"
                    class="p-2 rounded-xl border text-center text-xs font-medium transition-all cursor-pointer"
                    [ngClass]="selectedTemplate() === 'PODIUM_RANKING' ? 'bg-primary-600 border-primary-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
                    🏆 Pódio Top 3
                  </button>
                  <button
                    type="button"
                    (click)="setLayoutTemplate('GLASS_CARDS')"
                    class="p-2 rounded-xl border text-center text-xs font-medium transition-all cursor-pointer"
                    [ngClass]="selectedTemplate() === 'GLASS_CARDS' ? 'bg-primary-600 border-primary-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
                    💎 Vitrine Glass
                  </button>
                </div>

                <!-- Capas por Página -->
                @if (selectedPreset() !== 'SINGLE_FULL_IMAGE') {
                  <div class="pt-2 space-y-2 animate-fade-in">
                    <div class="flex items-center justify-between">
                      <label class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        Capas por Página
                      </label>
                      <span class="text-[11px] font-mono text-primary-400">
                        {{ itemsPerPage() }} capas/pág.
                      </span>
                    </div>
                    <div class="flex items-center gap-1.5 flex-wrap">
                      @for (count of pageSizePresets; track count) {
                        <button
                          type="button"
                          (click)="setItemsPerPage(count)"
                          class="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer"
                          [ngClass]="itemsPerPage() === count ? 'bg-primary-600 border-primary-500 text-white shadow' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'">
                          {{ count }}
                        </button>
                      }
                      <input
                        type="number"
                        min="1"
                        max="100"
                        [ngModel]="itemsPerPage()"
                        (ngModelChange)="onItemsPerPageInput($event)"
                        title="Quantidade personalizada de capas por página"
                        class="w-16 bg-slate-950 border border-slate-800 focus:border-primary-500 rounded-lg px-2 py-1 text-xs text-center font-mono text-slate-200 focus:outline-none" />
                    </div>
                  </div>
                } @else {
                  <div class="pt-2">
                    <div class="px-3 py-2 rounded-xl bg-primary-950/30 border border-primary-500/30 text-[11px] text-primary-300 flex items-center gap-2">
                      <span>🖼️</span>
                      <span>Modo Imagem Única ativo: todas as {{ selectedItemsCount() }} capas serão renderizadas em uma só imagem.</span>
                    </div>
                  </div>
                }

                <!-- Tema de Cores / Background -->
                <div class="pt-2 space-y-2">
                  <div class="flex items-center justify-between">
                    <label class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Tema de Fundo
                    </label>
                    <span class="text-[10px] text-slate-500">
                      {{ selectedTheme === 'CUSTOM' ? 'Personalizado' : 'Paleta Pronta' }}
                    </span>
                  </div>

                  <select
                    [(ngModel)]="selectedTheme"
                    (ngModelChange)="triggerRender()"
                    class="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200">
                    <option value="AMBIENT_DYNAMIC">✨ Ambient Dinâmico (Cores das Capas)</option>
                    <option value="COVER_BLUR_MOSAIC">🖼️ Cover Blur Atmosférico</option>
                    <option value="DARK_SLATE">🌑 Dark Slate Oficial</option>
                    <option value="OLED_BLACK">🖤 OLED Pure Black</option>
                    <option value="AURORA_BOREALIS">🌌 Aurora Boreal</option>
                    <option value="SUNSET_SYNTH">🌅 Sunset Horizon</option>
                    <option value="ROYAL_GOLD">👑 Royal Gold & Onyx</option>
                    <option value="MATCHA_BOTANICAL">🍵 Matcha & Sage</option>
                    <option value="CYBER_NEON">🔮 Cyber Neon Pop</option>
                    <option value="WARM_PAPER">📜 Warm Paper (Claro / Tumblr)</option>
                    <option value="SAKURA_DREAM">🌸 Sakura Pastel (Claro)</option>
                    <option value="NORDIC_FROST">❄️ Nordic Frost (Claro)</option>
                    <option value="CUSTOM">🎨 Personalizado (Custom)</option>
                  </select>

                  <!-- Painel de Customização de Cores (Aparece se tema for CUSTOM) -->
                  @if (selectedTheme === 'CUSTOM') {
                    <div class="p-3 bg-slate-950/80 border border-primary-500/30 rounded-xl space-y-3 animate-fade-in">
                      <div class="text-[11px] font-bold text-primary-300 flex items-center gap-1.5">
                        <span>🎨</span>
                        <span>Configuração de Cores Personalizadas</span>
                      </div>

                      <div class="grid grid-cols-3 gap-2">
                        <div class="flex flex-col items-center gap-1">
                          <label class="text-[9px] text-slate-400">Cor Início</label>
                          <input
                            type="color"
                            [(ngModel)]="customPrimaryColor"
                            (ngModelChange)="triggerRender()"
                            class="w-9 h-7 rounded border border-slate-700 bg-transparent cursor-pointer" />
                        </div>
                        <div class="flex flex-col items-center gap-1">
                          <label class="text-[9px] text-slate-400">Cor Fim</label>
                          <input
                            type="color"
                            [(ngModel)]="customSecondaryColor"
                            (ngModelChange)="triggerRender()"
                            class="w-9 h-7 rounded border border-slate-700 bg-transparent cursor-pointer" />
                        </div>
                        <div class="flex flex-col items-center gap-1">
                          <label class="text-[9px] text-slate-400">Acento</label>
                          <input
                            type="color"
                            [(ngModel)]="customAccentColor"
                            (ngModelChange)="triggerRender()"
                            class="w-9 h-7 rounded border border-slate-700 bg-transparent cursor-pointer" />
                        </div>
                      </div>

                      <!-- Modo de Contraste do Texto -->
                      <div class="flex items-center justify-between pt-1">
                        <span class="text-[10px] text-slate-400">Contraste de Texto:</span>
                        <div class="flex items-center gap-1">
                          <button
                            type="button"
                            (click)="setCustomTextMode('AUTO')"
                            class="px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer"
                            [ngClass]="customTextMode === 'AUTO' ? 'bg-primary-600 border-primary-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'">
                            Auto
                          </button>
                          <button
                            type="button"
                            (click)="setCustomTextMode('LIGHT')"
                            class="px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer"
                            [ngClass]="customTextMode === 'LIGHT' ? 'bg-primary-600 border-primary-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'">
                            Claro
                          </button>
                          <button
                            type="button"
                            (click)="setCustomTextMode('DARK')"
                            class="px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer"
                            [ngClass]="customTextMode === 'DARK' ? 'bg-primary-600 border-primary-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'">
                            Escuro
                          </button>
                        </div>
                      </div>
                    </div>
                  }

                  <!-- Padrão Decorativo do Fundo -->
                  <div class="pt-1 flex items-center justify-between">
                    <label class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Textura / Padrão
                    </label>
                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        (click)="setBackgroundPattern('GRID')"
                        class="px-2 py-1 rounded-lg text-[10px] font-semibold border cursor-pointer"
                        [ngClass]="selectedPattern === 'GRID' ? 'bg-primary-600 border-primary-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'">
                        Grade
                      </button>
                      <button
                        type="button"
                        (click)="setBackgroundPattern('DOTS')"
                        class="px-2 py-1 rounded-lg text-[10px] font-semibold border cursor-pointer"
                        [ngClass]="selectedPattern === 'DOTS' ? 'bg-primary-600 border-primary-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'">
                        Pontos
                      </button>
                      <button
                        type="button"
                        (click)="setBackgroundPattern('ORBS')"
                        class="px-2 py-1 rounded-lg text-[10px] font-semibold border cursor-pointer"
                        [ngClass]="selectedPattern === 'ORBS' ? 'bg-primary-600 border-primary-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'">
                        Orbs
                      </button>
                      <button
                        type="button"
                        (click)="setBackgroundPattern('NONE')"
                        class="px-2 py-1 rounded-lg text-[10px] font-semibold border cursor-pointer"
                        [ngClass]="selectedPattern === 'NONE' ? 'bg-primary-600 border-primary-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'">
                        Liso
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <!-- 4. Textos e Opções -->
              <section class="space-y-3">
                <label class="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Personalização de Textos
                </label>
                <div class="space-y-2">
                  <input
                    type="text"
                    [(ngModel)]="cardTitle"
                    (ngModelChange)="triggerRender()"
                    placeholder="Título (Ex: Minhas Leituras da Semana)"
                    class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200" />
                  
                  <input
                    type="text"
                    [(ngModel)]="cardSubtitle"
                    (ngModelChange)="triggerRender()"
                    placeholder="Subtítulo ou Período (Ex: Novembro 2026)"
                    class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200" />

                  <input
                    type="text"
                    [(ngModel)]="userHandle"
                    (ngModelChange)="triggerRender()"
                    placeholder="Seu usuário ou @handle (Opcional)"
                    class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200" />
                </div>

                <div class="space-y-1.5 pt-1 text-xs text-slate-300">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      [(ngModel)]="showStatsBanner"
                      (ngModelChange)="triggerRender()"
                      class="rounded bg-slate-950 border-slate-700 text-primary-600 focus:ring-0" />
                    Exibir resumo numérico (páginas / tempo lido)
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      [(ngModel)]="showCoverTitles"
                      (ngModelChange)="triggerRender()"
                      class="rounded bg-slate-950 border-slate-700 text-primary-600 focus:ring-0" />
                    Exibir nome do arquivo e tempo nas capas
                  </label>
                  @if (showCoverTitles) {
                    <label class="flex items-center gap-2 pl-5 text-slate-300 cursor-pointer animate-fade-in">
                      <input
                        type="checkbox"
                        [(ngModel)]="useCardBlur"
                        (ngModelChange)="triggerRender()"
                        class="rounded bg-slate-950 border-slate-700 text-primary-600 focus:ring-0" />
                      Usar efeito Blur no campo de texto
                    </label>
                  }
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      [(ngModel)]="showProgressBadge"
                      (ngModelChange)="triggerRender()"
                      class="rounded bg-slate-950 border-slate-700 text-primary-600 focus:ring-0" />
                    Exibir badges de concluído / progresso
                  </label>
                </div>
              </section>

              <!-- 5. Curadoria de Obras Encontradas -->
              <section class="space-y-3">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Obras Incluídas ({{ selectedItemsCount() }}/{{ rawItems().length }})
                  </label>
                  <button
                    type="button"
                    (click)="toggleSelectAll()"
                    class="text-[11px] text-primary-400 hover:text-primary-300 cursor-pointer">
                    {{ allSelected() ? 'Desmarcar Todos' : 'Selecionar Todos' }}
                  </button>
                </div>

                @if (rawItems().length === 0) {
                  <div class="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                    Nenhuma leitura encontrada para o período selecionado.
                  </div>
                } @else {
                  <div
                    (wheel)="onCurationWheel($event)"
                    class="flex items-stretch gap-3 overflow-x-auto pb-2.5 pt-1 px-0.5 scroll-smooth">
                    @for (it of rawItems(); track it.fkReference + '-' + it.type) {
                      <div
                        (click)="toggleItem(it)"
                        [title]="it.title"
                        class="group relative w-28 shrink-0 rounded-xl overflow-hidden border transition-all duration-200 flex flex-col select-none cursor-pointer"
                        [ngClass]="isItemSelected(it)
                          ? (it.type === 'MANGA'
                              ? 'bg-slate-900 manga-card-selected hover:-translate-y-0.5'
                              : 'bg-slate-900 border-book-500/70 shadow-md shadow-book-500/10 hover:-translate-y-0.5')
                          : 'bg-slate-950/60 border-slate-800/80 opacity-55 grayscale-[35%] hover:opacity-85 hover:border-slate-700'">

                        <!-- Capa da Obra (Proporção 2:3) -->
                        <div class="relative aspect-[2/3] w-full overflow-hidden bg-slate-950">
                          @if (it.coverPath) {
                            <img
                              [src]="getCoverUrl(it.coverPath)"
                              [alt]="it.title"
                              loading="lazy"
                              class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none" />
                          } @else {
                            <div
                              class="w-full h-full flex flex-col items-center justify-center p-2 text-center"
                              [ngClass]="it.type === 'MANGA'
                                ? 'manga-card-fallback-bg'
                                : 'bg-gradient-to-br from-slate-900 via-slate-950 to-book-950/40 text-book-400'">
                              <span class="text-2xl mb-1">{{ it.type === 'MANGA' ? '📖' : '📚' }}</span>
                              <span class="text-[9px] uppercase font-bold tracking-wider opacity-80">
                                {{ it.fileType || (it.type === 'MANGA' ? 'MANGA' : 'LIVRO') }}
                              </span>
                            </div>
                          }

                          <!-- Check no Canto Superior Direito (Sempre na cor primária verde selecionada) -->
                          <div
                            class="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-lg flex items-center justify-center border transition-all shadow-md backdrop-blur-md"
                            [ngClass]="isItemSelected(it)
                              ? 'bg-primary-600 border-primary-500 text-white shadow-primary-600/30'
                              : 'bg-slate-950/80 border-slate-600/80 text-transparent group-hover:border-slate-400'">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>

                        <!-- Nome abaixo e Quantidade de Páginas -->
                        <div class="p-2 flex-1 flex flex-col justify-between bg-slate-900/95 border-t border-slate-800/70">
                          <p class="text-[11px] font-semibold text-slate-100 line-clamp-2 leading-tight">
                            {{ it.title }}
                          </p>
                          <div class="mt-1.5 flex items-center justify-between text-[10px] font-mono">
                            <span
                              class="font-semibold"
                              [ngClass]="it.type === 'MANGA' ? 'manga-text-accent' : 'text-book-400'">
                              {{ it.pagesReadInPeriod }} pág.
                            </span>
                            @if (it.completed) {
                              <span class="text-primary-500 font-bold" title="Concluído">✓</span>
                            }
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                }
              </section>
            </div>

            <!-- Coluna Direita: Preview em Tempo Real e Ações -->
            <div class="lg:col-span-7 flex flex-col bg-slate-950/70 p-6 overflow-hidden">
              <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {{ 'socialShare.realtimePreview' | translate }}
                  </span>
                  @if (renderedPages().length > 1) {
                    <span class="px-2 py-0.5 rounded-full bg-primary-500/20 border border-primary-500/30 text-[10px] font-bold text-primary-300">
                      {{ 'socialShare.pagesBadge' | translate:{ count: renderedPages().length } }}
                    </span>
                  }
                </div>

                <div class="flex items-center gap-3">
                  <!-- Controles de Zoom -->
                  <div class="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 shadow-sm">
                    <button
                      type="button"
                      (click)="zoomOut()"
                      [disabled]="previewZoom() <= minZoom"
                      class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors cursor-pointer"
                      [title]="'socialShare.zoomOut' | translate">
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      (click)="resetZoom()"
                      class="px-2 h-7 flex items-center justify-center text-xs font-mono font-semibold transition-colors rounded-lg hover:bg-slate-800 cursor-pointer"
                      [class.text-primary-400]="previewZoom() !== 1"
                      [class.text-slate-300]="previewZoom() === 1"
                      [title]="'socialShare.resetZoom' | translate">
                      {{ previewZoomPercent() }}%
                    </button>

                    <button
                      type="button"
                      (click)="zoomIn()"
                      [disabled]="previewZoom() >= maxZoom"
                      class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors cursor-pointer"
                      [title]="'socialShare.zoomIn' | translate">
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>

                    @if (previewZoom() !== 1) {
                      <button
                        type="button"
                        (click)="resetZoom()"
                        class="ml-1 px-2 h-7 flex items-center gap-1 text-[11px] font-medium text-primary-400 hover:text-primary-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        [title]="'socialShare.fitScreen' | translate">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                        <span>{{ 'socialShare.fitScreen' | translate }}</span>
                      </button>
                    }
                  </div>

                  <span class="text-xs text-slate-500 font-mono">
                    {{ activeDimensionsLabel() }}
                  </span>
                </div>
              </div>

              <!-- Galeria de Páginas com Scroll e Zoom/Pan -->
              <div
                #previewScrollContainer
                (wheel)="onPreviewWheel($event)"
                (mousedown)="onPreviewMouseDown($event)"
                (mousemove)="onPreviewMouseMove($event)"
                (mouseup)="onPreviewMouseUp()"
                (mouseleave)="onPreviewMouseUp()"
                class="flex-1 min-h-0 overflow-auto p-4 rounded-2xl bg-slate-950 border border-slate-800/80 relative shadow-inner select-none transition-colors space-y-6"
                [class.cursor-grab]="previewZoom() > 1 && !isDragging()"
                [class.cursor-grabbing]="previewZoom() > 1 && isDragging()">

                @if (isRendering()) {
                  <div class="sticky top-2 z-20 flex items-center justify-center pointer-events-none">
                    <span class="px-3 py-1.5 rounded-full bg-slate-900/90 border border-primary-500/40 text-xs font-semibold text-primary-300 shadow-lg animate-pulse">
                      {{ 'socialShare.rendering' | translate }}
                    </span>
                  </div>
                }

                @for (page of renderedPages(); track page.pageNumber) {
                  <div
                    class="flex flex-col items-center space-y-2.5 bg-slate-900/50 border border-slate-800/70 rounded-2xl p-3 mx-auto transition-all shadow-xl"
                    [class.my-auto]="previewZoom() <= 1 && renderedPages().length === 1"
                    [style.width]="'fit-content'"
                    [style.max-width]="'none'">
                    @if (page.totalPages > 1) {
                      <div
                        class="flex items-center justify-between px-2 py-1 border-b border-slate-800/80 text-xs"
                        [style.width.px]="getPageDimensions(page).width">
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-primary-300">
                            Página {{ page.pageNumber }} de {{ page.totalPages }}
                          </span>
                          <span class="text-[11px] text-slate-400">
                            ({{ page.itemsCount }} {{ page.itemsCount === 1 ? 'capa' : 'capas' }})
                          </span>
                        </div>
                        <div class="flex items-center gap-2">
                          <button
                            type="button"
                            (click)="copyPageDataUrl(page.dataUrl)"
                            class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium transition-colors cursor-pointer">
                            Copiar Pág. {{ page.pageNumber }}
                          </button>
                          <button
                            type="button"
                            (click)="saveSinglePage(page)"
                            class="px-2.5 py-1 rounded-lg bg-primary-600/80 hover:bg-primary-600 text-white text-[11px] font-semibold transition-colors cursor-pointer">
                            Salvar Pág. {{ page.pageNumber }}
                          </button>
                        </div>
                      </div>
                    }
                    <div class="flex items-center justify-center">
                      <img
                        [src]="page.dataUrl"
                        [alt]="'Preview página ' + page.pageNumber"
                        draggable="false"
                        [style.width.px]="getPageDimensions(page).width"
                        [style.height.px]="getPageDimensions(page).height"
                        class="max-w-none max-h-none object-contain rounded-lg shadow-2xl pointer-events-none select-none transition-all duration-75" />
                    </div>
                  </div>
                }

                @if (previewZoom() > 1) {
                  <div class="pointer-events-none sticky bottom-2 left-2 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-700/70 text-[10px] text-slate-400 shadow-lg">
                    <span>💡 Arraste com o mouse para mover</span>
                  </div>
                }
              </div>

              <!-- Botões de Ação na Base -->
              <footer class="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                <div class="text-xs text-slate-400">
                  @if (copySuccess()) {
                    <span class="text-emerald-400 font-semibold animate-fade-in flex items-center gap-1">
                      ✓ {{ 'socialShare.copiedSuccess' | translate }}
                    </span>
                  }
                </div>

                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    (click)="copyToClipboard()"
                    [disabled]="isRendering() || selectedItems().length === 0 || renderedPages().length === 0"
                    class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50">
                    <svg class="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    {{ renderedPages().length > 1 ? ('socialShare.copyFirstPage' | translate) : ('socialShare.copyImage' | translate) }}
                  </button>

                  <button
                    type="button"
                    (click)="saveImage()"
                    [disabled]="isRendering() || selectedItems().length === 0 || renderedPages().length === 0"
                    class="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 active:scale-95 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-primary-600/20 disabled:opacity-50">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {{ renderedPages().length > 1 ? ('socialShare.saveAllPngs' | translate:{ count: renderedPages().length }) : ('socialShare.savePng' | translate) }}
                  </button>
                </div>
              </footer>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class SocialShareDialogComponent implements OnInit {
  @Input() initialMediaType: 'MANGA' | 'BOOK' | 'ALL' = 'ALL';
  @Input() initialYear: number | null = null;
  @Input() initialLibraryId: number | null = null;

  @Output() close = new EventEmitter<void>();

  private electron = inject(ElectronService);
  private generator = inject(SocialImageGeneratorService);
  readonly socialShareService = inject(SocialShareService);

  readonly presets = PLATFORM_PRESETS;
  readonly pageSizePresets = [4, 6, 9, 12, 16, 20, 24];

  // Visibilidade controlada tanto por service quanto por inputs
  isVisible = computed(() => {
    return this.socialShareService.isOpen();
  });

  // Estado
  activePeriod = signal<'week' | 'month' | 'year' | 'custom'>('month');
  mediaType = signal<'MANGA' | 'BOOK' | 'ALL'>('ALL');
  availableLibraries = signal<LibraryOption[]>([]);
  selectedLibraryId = signal<number | null>(null);
  startDate = '';
  endDate = '';
  onlyCompleted = false;

  filteredLibraries = computed(() => {
    const type = this.mediaType();
    const libs = this.availableLibraries();
    if (type === 'MANGA') {
      return libs.filter(l => l.type === 'MANGA');
    }
    if (type === 'BOOK') {
      return libs.filter(l => l.type === 'BOOK');
    }
    return libs;
  });

  selectedPreset = signal<SocialPlatformPreset>('INSTAGRAM_POST');
  selectedTemplate = signal<SocialLayoutTemplate>('BENTO_GRID');
  selectedTheme: SocialTheme = 'AMBIENT_DYNAMIC';
  selectedPattern: SocialBackgroundPattern = 'GRID';
  itemsPerPage = signal<number>(9);

  // Cores customizadas
  customPrimaryColor = '#0f172a';
  customSecondaryColor = '#1e1b4b';
  customAccentColor = '#6366f1';
  customTextMode: 'AUTO' | 'LIGHT' | 'DARK' = 'AUTO';

  cardTitle = 'Minhas Leituras do Mês';
  cardSubtitle = '';
  userHandle = '';

  showStatsBanner = true;
  showCoverTitles = true;
  useCardBlur = false;
  showProgressBadge = true;

  rawItems = signal<SocialShareItem[]>([]);
  excludedIds = signal<Set<string>>(new Set());
  renderedPages = signal<SocialRenderedPage[]>([]);

  isRendering = signal(false);
  copySuccess = signal(false);

  // Zoom e Pan do Preview
  @ViewChild('previewScrollContainer') previewScrollContainer?: ElementRef<HTMLDivElement>;

  readonly minZoom = 0.5;
  readonly maxZoom = 4.0;
  readonly zoomStep = 0.25;
  readonly Math = Math;

  previewZoom = signal<number>(1);
  previewZoomPercent = computed(() => Math.round(this.previewZoom() * 100));

  isDragging = signal<boolean>(false);
  private isPanning = false;
  private startPanX = 0;
  private startPanY = 0;
  private startScrollLeft = 0;
  private startScrollTop = 0;

  activePresetConfig = computed(() => this.generator.getPresetConfig(this.selectedPreset()));

  activeDimensionsLabel = computed(() => {
    const pages = this.renderedPages();
    if (pages.length > 0) {
      return `${pages[0].width} × ${pages[0].height} px`;
    }
    const conf = this.activePresetConfig();
    return `${conf.width} × ${conf.height} px`;
  });

  selectedItems = computed(() => {
    const excluded = this.excludedIds();
    return this.rawItems().filter(it => !excluded.has(`${it.type}-${it.fkReference}`));
  });

  selectedItemsCount = computed(() => this.selectedItems().length);

  allSelected = computed(() => {
    return this.rawItems().length > 0 && this.excludedIds().size === 0;
  });

  ngOnInit(): void {
    const serviceOpts = this.socialShareService.activeOptions();
    if (serviceOpts?.initialMediaType) {
      this.mediaType.set(serviceOpts.initialMediaType);
    } else if (this.initialMediaType) {
      this.mediaType.set(this.initialMediaType);
    }

    if (serviceOpts?.initialYear) {
      this.initialYear = serviceOpts.initialYear;
    }
    const initLib = serviceOpts?.initialLibraryId ?? this.initialLibraryId ?? null;
    this.selectedLibraryId.set(initLib);

    void this.loadLibraries();
    this.setPeriodPreset('month');
  }

  async loadLibraries(): Promise<void> {
    try {
      const [mangaLibs, bookLibs] = await Promise.all([
        this.electron.listLibrariesByType('MANGA'),
        this.electron.listLibrariesByType('BOOK')
      ]);
      const combined = [...(mangaLibs || []), ...(bookLibs || [])];
      this.availableLibraries.set(combined);

      // Se temos uma biblioteca inicial mas ela ainda não foi confirmada
      const currentSelected = this.selectedLibraryId();
      if (currentSelected != null && !combined.some(l => l.id === currentSelected)) {
        // Se a biblioteca inicial não existir na lista combinada, reseta para null
        this.selectedLibraryId.set(null);
      }
    } catch (err) {
      console.error('Erro ao carregar bibliotecas para social share:', err);
    }
  }

  onLibraryChange(id: number | null): void {
    this.selectedLibraryId.set(id);
    void this.loadItems();
  }

  setPeriodPreset(period: 'week' | 'month' | 'year' | 'custom'): void {
    this.activePeriod.set(period);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');

    if (period === 'week') {
      const past = new Date();
      past.setDate(now.getDate() - 7);
      this.startDate = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`;
      this.endDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      this.cardTitle = 'Leituras da Semana';
      this.cardSubtitle = `Últimos 7 dias`;
    } else if (period === 'month') {
      this.startDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      this.endDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(lastDay)}`;
      const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      this.cardTitle = `Leituras de ${monthNames[now.getMonth()]}`;
      this.cardSubtitle = `${now.getFullYear()}`;
    } else if (period === 'year') {
      const serviceOpts = this.socialShareService.activeOptions();
      const year = serviceOpts?.initialYear || this.initialYear || now.getFullYear();
      this.startDate = `${year}-01-01`;
      this.endDate = `${year}-12-31`;
      this.cardTitle = `Resumo Literário ${year}`;
      this.cardSubtitle = `Retrospectiva do Ano`;
    }

    this.loadItems();
  }

  setMediaType(type: 'MANGA' | 'BOOK' | 'ALL'): void {
    this.mediaType.set(type);

    const currentLibId = this.selectedLibraryId();
    if (currentLibId != null && type !== 'ALL') {
      const currentLib = this.availableLibraries().find(l => l.id === currentLibId);
      if (currentLib && currentLib.type !== type) {
        this.selectedLibraryId.set(null);
      }
    }

    this.loadItems();
  }

  async loadItems(): Promise<void> {
    if (!this.startDate || !this.endDate) return;

    this.isRendering.set(true);
    try {
      const libId = this.selectedLibraryId();

      const items = await this.electron.listHistoryForSocialShare({
        startDate: this.startDate,
        endDate: this.endDate,
        type: this.mediaType(),
        onlyCompleted: this.onlyCompleted,
        libraryId: libId
      });
      this.rawItems.set(items || []);
      this.excludedIds.set(new Set());
      await this.triggerRender();
    } finally {
      this.isRendering.set(false);
    }
  }

  selectPreset(preset: SocialPlatformPreset): void {
    this.selectedPreset.set(preset);
    const conf = this.generator.getPresetConfig(preset);
    this.selectedTemplate.set(conf.recommendedTemplate);
    this.triggerRender();
  }

  setLayoutTemplate(template: SocialLayoutTemplate): void {
    this.selectedTemplate.set(template);
    this.triggerRender();
  }

  setItemsPerPage(count: number): void {
    const safe = Math.max(1, Math.min(100, Math.floor(count || 9)));
    this.itemsPerPage.set(safe);
    void this.triggerRender();
  }

  onItemsPerPageInput(value: number | string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    this.setItemsPerPage(parsed);
  }

  setBackgroundPattern(pattern: SocialBackgroundPattern): void {
    this.selectedPattern = pattern;
    this.triggerRender();
  }

  setCustomTextMode(mode: 'AUTO' | 'LIGHT' | 'DARK'): void {
    this.customTextMode = mode;
    this.triggerRender();
  }

  getCoverUrl(coverPath: string | null): string {
    if (!coverPath) return '';
    return 'local-cover:///' + coverPath.replace(/\\/g, '/');
  }

  onCurationWheel(event: WheelEvent): void {
    const container = event.currentTarget as HTMLElement | null;
    if (!container) return;
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      container.scrollLeft += event.deltaY;
    }
  }

  isItemSelected(item: SocialShareItem): boolean {
    return !this.excludedIds().has(`${item.type}-${item.fkReference}`);
  }

  toggleItem(item: SocialShareItem): void {
    const key = `${item.type}-${item.fkReference}`;
    const next = new Set(this.excludedIds());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.excludedIds.set(next);
    this.triggerRender();
  }

  toggleSelectAll(): void {
    if (this.allSelected()) {
      const all = new Set<string>();
      this.rawItems().forEach(it => all.add(`${it.type}-${it.fkReference}`));
      this.excludedIds.set(all);
    } else {
      this.excludedIds.set(new Set());
    }
    this.triggerRender();
  }

  async triggerRender(): Promise<void> {
    this.isRendering.set(true);
    try {
      const customTheme: SocialCustomThemeConfig = {
        primaryColor: this.customPrimaryColor,
        secondaryColor: this.customSecondaryColor,
        accentColor: this.customAccentColor,
        textMode: this.customTextMode
      };

      const options: SocialRenderOptions = {
        preset: this.selectedPreset(),
        template: this.selectedTemplate(),
        theme: this.selectedTheme,
        title: this.cardTitle,
        subtitle: this.cardSubtitle,
        userHandle: this.userHandle,
        showStatsBanner: this.showStatsBanner,
        showCoverTitles: this.showCoverTitles,
        useCardBlur: this.useCardBlur,
        showProgressBadge: this.showProgressBadge,
        showBranding: true,
        itemsPerPage: this.itemsPerPage(),
        backgroundPattern: this.selectedPattern,
        customTheme: this.selectedTheme === 'CUSTOM' ? customTheme : undefined
      };

      const pages = await this.generator.renderPages(
        this.selectedItems(),
        options
      );
      this.renderedPages.set(pages);
    } finally {
      this.isRendering.set(false);
    }
  }

  async copyPageDataUrl(dataUrl: string): Promise<void> {
    if (!dataUrl) return;
    const res = await this.electron.copySocialImage({ dataUrl });
    if (res?.success) {
      this.copySuccess.set(true);
      setTimeout(() => this.copySuccess.set(false), 4000);
    }
  }

  async copyToClipboard(): Promise<void> {
    const firstPage = this.renderedPages()[0];
    if (!firstPage?.dataUrl) return;
    await this.copyPageDataUrl(firstPage.dataUrl);
  }

  async saveSinglePage(page: SocialRenderedPage): Promise<void> {
    if (!page?.dataUrl) return;
    const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const suffix = page.totalPages > 1 ? `-pag-${page.pageNumber}` : '';
    const defaultName = `${sanitize(this.cardTitle || 'leituras')}-${sanitize(this.selectedPreset())}${suffix}.png`;
    await this.electron.saveSocialImage({ dataUrl: page.dataUrl, defaultName });
  }

  async saveImage(): Promise<void> {
    const pages = this.renderedPages();
    if (!pages.length) return;
    const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const defaultName = `${sanitize(this.cardTitle || 'leituras')}-${sanitize(this.selectedPreset())}.png`;

    if (pages.length === 1) {
      await this.electron.saveSocialImage({ dataUrl: pages[0].dataUrl, defaultName });
    } else {
      await this.electron.saveSocialImage({
        dataUrls: pages.map(p => p.dataUrl),
        defaultName
      });
    }
  }

  containerResizeTrigger = signal(0);

  @HostListener('window:resize')
  onWindowResize(): void {
    this.containerResizeTrigger.update(v => v + 1);
  }

  getPageDimensions(page: SocialRenderedPage): { width: number; height: number } {
    // Leitura do signal para reavaliação automática no resize da janela
    this.containerResizeTrigger();

    const pageW = page.width || this.activePresetConfig().width || 1080;
    const pageH = page.height || this.activePresetConfig().height || 1080;
    const container = this.previewScrollContainer?.nativeElement;

    let availW = 600;
    let availH = 650;

    if (container && container.clientWidth > 50 && container.clientHeight > 50) {
      availW = Math.max(100, container.clientWidth - 56);
      const headerH = page.totalPages > 1 ? 46 : 0;
      availH = Math.max(100, container.clientHeight - 56 - headerH);
    } else if (typeof window !== 'undefined') {
      availW = Math.max(200, (window.innerWidth * 0.55) - 60);
      availH = Math.max(200, (window.innerHeight * 0.90) - 200);
    }

    const fitScale = Math.min(availW / pageW, availH / pageH);
    const zoom = this.previewZoom();

    return {
      width: Math.max(40, Math.round(pageW * fitScale * zoom)),
      height: Math.max(40, Math.round(pageH * fitScale * zoom))
    };
  }

  zoomIn(): void {
    const prev = this.previewZoom();
    const next = Math.min(this.maxZoom, Math.round((prev + this.zoomStep) * 100) / 100);
    if (next !== prev) {
      this.previewZoom.set(next);
      this.adjustScrollOnZoom(prev, next);
    }
  }

  zoomOut(): void {
    const prev = this.previewZoom();
    const next = Math.max(this.minZoom, Math.round((prev - this.zoomStep) * 100) / 100);
    if (next !== prev) {
      this.previewZoom.set(next);
      this.adjustScrollOnZoom(prev, next);
    }
  }

  resetZoom(): void {
    this.previewZoom.set(1);
    this.isPanning = false;
    this.isDragging.set(false);
    if (this.previewScrollContainer?.nativeElement) {
      this.previewScrollContainer.nativeElement.scrollLeft = 0;
      this.previewScrollContainer.nativeElement.scrollTop = 0;
    }
  }

  onPreviewWheel(event: WheelEvent): void {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const prev = this.previewZoom();
      const delta = event.deltaY < 0 ? 0.15 : -0.15;
      const next = Math.min(this.maxZoom, Math.max(this.minZoom, Math.round((prev + delta) * 100) / 100));
      if (next !== prev) {
        this.previewZoom.set(next);
        const container = this.previewScrollContainer?.nativeElement;
        if (container) {
          const rect = container.getBoundingClientRect();
          const focalX = event.clientX - rect.left;
          const focalY = event.clientY - rect.top;
          this.adjustScrollOnZoom(prev, next, focalX, focalY);
        }
      }
    }
  }

  private adjustScrollOnZoom(oldZoom: number, newZoom: number, focalX?: number, focalY?: number): void {
    const container = this.previewScrollContainer?.nativeElement;
    if (!container) return;

    requestAnimationFrame(() => {
      const ratio = newZoom / oldZoom;
      const clientX = focalX ?? (container.clientWidth / 2);
      const clientY = focalY ?? (container.clientHeight / 2);

      const targetScrollLeft = (container.scrollLeft + clientX) * ratio - clientX;
      const targetScrollTop = (container.scrollTop + clientY) * ratio - clientY;

      container.scrollLeft = Math.max(0, targetScrollLeft);
      container.scrollTop = Math.max(0, targetScrollTop);
    });
  }

  onPreviewMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;

    const container = this.previewScrollContainer?.nativeElement;
    if (!container) return;

    this.isPanning = true;
    this.isDragging.set(true);
    this.startPanX = event.clientX;
    this.startPanY = event.clientY;
    this.startScrollLeft = container.scrollLeft;
    this.startScrollTop = container.scrollTop;
  }

  onPreviewMouseMove(event: MouseEvent): void {
    if (!this.isPanning) return;
    const container = this.previewScrollContainer?.nativeElement;
    if (!container) return;

    event.preventDefault();
    const dx = event.clientX - this.startPanX;
    const dy = event.clientY - this.startPanY;
    container.scrollLeft = this.startScrollLeft - dx;
    container.scrollTop = this.startScrollTop - dy;
  }

  onPreviewMouseUp(): void {
    this.isPanning = false;
    this.isDragging.set(false);
  }

  handleClose(): void {
    this.resetZoom();
    this.socialShareService.close();
    this.close.emit();
  }

  onBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      this.handleClose();
    }
  }
}
