import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../core/services/electron.service';
import {
  PLATFORM_PRESETS,
  SocialImageGeneratorService
} from '../../core/services/social-image-generator.service';
import {
  SocialLayoutTemplate,
  SocialPlatformPreset,
  SocialRenderOptions,
  SocialShareItem,
  SocialTheme
} from '../../core/models/social-share.model';
import { SocialShareService } from '../../core/services/social-share.service';

@Component({
  selector: 'app-social-share-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (isVisible()) {
      <div
        class="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in select-none"
        (click)="onBackdropClick($event)">
        <div
          class="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden animate-scale-in"
          (click)="$event.stopPropagation()">

          <!-- Header -->
          <header class="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <span class="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-lg">
                📸
              </span>
              <div>
                <h2 class="text-base font-bold text-slate-100 flex items-center gap-2">
                  Compartilhar Leituras
                  <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                    Social Studio
                  </span>
                </h2>
                <p class="text-xs text-slate-400">
                  Gere imagens personalizadas em alta definição prontas para postar no Instagram, Twitter e Tumblr.
                </p>
              </div>
            </div>
            <button
              type="button"
              (click)="handleClose()"
              class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fechar">
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
                    [ngClass]="activePeriod() === 'week' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
                    Últimos 7 Dias
                  </button>
                  <button
                    type="button"
                    (click)="setPeriodPreset('month')"
                    class="py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer"
                    [ngClass]="activePeriod() === 'month' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
                    Este Mês
                  </button>
                  <button
                    type="button"
                    (click)="setPeriodPreset('year')"
                    class="py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer"
                    [ngClass]="activePeriod() === 'year' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
                    Este Ano
                  </button>
                  <button
                    type="button"
                    (click)="setPeriodPreset('custom')"
                    class="py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer"
                    [ngClass]="activePeriod() === 'custom' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
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
                    [ngClass]="mediaType() === 'ALL' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'">
                    Tudo
                  </button>
                  <button
                    type="button"
                    (click)="setMediaType('MANGA')"
                    class="py-1.5 rounded-lg font-semibold transition-all cursor-pointer"
                    [ngClass]="mediaType() === 'MANGA' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'">
                    Mangás
                  </button>
                  <button
                    type="button"
                    (click)="setMediaType('BOOK')"
                    class="py-1.5 rounded-lg font-semibold transition-all cursor-pointer"
                    [ngClass]="mediaType() === 'BOOK' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'">
                    Livros
                  </button>
                </div>

                <label class="flex items-center gap-2 pt-1 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    [(ngModel)]="onlyCompleted"
                    (change)="loadItems()"
                    class="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0" />
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
                      [ngClass]="selectedPreset() === p.id ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/40 text-slate-100' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'">
                      <div>
                        <div class="text-xs font-bold flex items-center gap-2">
                          {{ p.label }}
                          <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            {{ p.aspectRatioLabel }}
                          </span>
                        </div>
                        <div class="text-[11px] text-slate-400">{{ p.sublabel }}</div>
                      </div>
                      <span class="text-xs font-mono text-slate-500">{{ p.width }}x{{ p.height }}</span>
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
                    [ngClass]="selectedTemplate() === 'BENTO_GRID' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
                    🍱 Mosaico Bento
                  </button>
                  <button
                    type="button"
                    (click)="setLayoutTemplate('PERSPECTIVE_SHOWCASE')"
                    class="p-2 rounded-xl border text-center text-xs font-medium transition-all cursor-pointer"
                    [ngClass]="selectedTemplate() === 'PERSPECTIVE_SHOWCASE' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
                    📚 Estante 3D
                  </button>
                  <button
                    type="button"
                    (click)="setLayoutTemplate('WRAPPED_STATS')"
                    class="p-2 rounded-xl border text-center text-xs font-medium transition-all cursor-pointer"
                    [ngClass]="selectedTemplate() === 'WRAPPED_STATS' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
                    📊 Wrapped Stats
                  </button>
                  <button
                    type="button"
                    (click)="setLayoutTemplate('MINIMALIST_LIST')"
                    class="p-2 rounded-xl border text-center text-xs font-medium transition-all cursor-pointer"
                    [ngClass]="selectedTemplate() === 'MINIMALIST_LIST' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'">
                    📝 Lista Editorial
                  </button>
                </div>

                <!-- Tema de Cores / Background -->
                <div class="pt-2">
                  <label class="text-[10px] text-slate-400 block mb-1 uppercase font-bold tracking-wider">
                    Tema de Fundo
                  </label>
                  <select
                    [(ngModel)]="selectedTheme"
                    (ngModelChange)="triggerRender()"
                    class="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200">
                    <option value="AMBIENT_DYNAMIC">✨ Ambient Dinâmico (Cores das Capas)</option>
                    <option value="DARK_SLATE">🌑 Dark Slate Oficial</option>
                    <option value="OLED_BLACK">🖤 OLED Pure Black</option>
                    <option value="WARM_PAPER">📜 Warm Paper (Claro / Tumblr)</option>
                    <option value="CYBER_NEON">🔮 Cyber Neon Pop</option>
                  </select>
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
                      class="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0" />
                    Exibir resumo numérico (páginas / tempo lido)
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      [(ngModel)]="showCoverTitles"
                      (ngModelChange)="triggerRender()"
                      class="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0" />
                    Exibir títulos e autores nas capas
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      [(ngModel)]="showProgressBadge"
                      (ngModelChange)="triggerRender()"
                      class="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0" />
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
                    class="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer">
                    {{ allSelected() ? 'Desmarcar Todos' : 'Selecionar Todos' }}
                  </button>
                </div>

                @if (rawItems().length === 0) {
                  <div class="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                    Nenhuma leitura encontrada para o período selecionado.
                  </div>
                } @else {
                  <div class="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    @for (it of rawItems(); track it.fkReference + '-' + it.type) {
                      <label class="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-slate-800/80 hover:border-slate-700 text-xs text-slate-200 cursor-pointer">
                        <div class="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            [checked]="isItemSelected(it)"
                            (change)="toggleItem(it)"
                            class="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0" />
                          <span class="truncate font-medium">{{ it.title }}</span>
                        </div>
                        <span class="text-[10px] text-slate-500 font-mono shrink-0 ml-2">
                          {{ it.pagesReadInPeriod }}p
                        </span>
                      </label>
                    }
                  </div>
                }
              </section>
            </div>

            <!-- Coluna Direita: Preview em Tempo Real e Ações -->
            <div class="lg:col-span-7 flex flex-col bg-slate-950/70 p-6 overflow-hidden">
              <div class="flex items-center justify-between mb-4">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Visualização em Tempo Real (WYSIWYG)
                </span>
                <span class="text-xs text-slate-500 font-mono">
                  {{ activePresetConfig().width }} × {{ activePresetConfig().height }} px
                </span>
              </div>

              <!-- Canvas Container com Scroll / Fit -->
              <div class="flex-1 min-h-0 flex items-center justify-center p-2 rounded-2xl bg-slate-950 border border-slate-800/80 overflow-hidden relative shadow-inner">
                @if (isRendering()) {
                  <div class="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs">
                    <span class="text-xs font-semibold text-indigo-400 animate-pulse">Renderizando imagem…</span>
                  </div>
                }
                <canvas
                  #renderCanvas
                  class="max-h-full max-w-full object-contain rounded-lg shadow-2xl transition-all">
                </canvas>
              </div>

              <!-- Botões de Ação na Base -->
              <footer class="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                <div class="text-xs text-slate-400">
                  @if (copySuccess()) {
                    <span class="text-emerald-400 font-semibold animate-fade-in flex items-center gap-1">
                      ✓ Imagem copiada para a Área de Transferência! (Cole com Ctrl+V)
                    </span>
                  }
                </div>

                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    (click)="copyToClipboard()"
                    [disabled]="isRendering() || selectedItems().length === 0"
                    class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50">
                    <svg class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copiar Imagem
                  </button>

                  <button
                    type="button"
                    (click)="saveImage()"
                    [disabled]="isRendering() || selectedItems().length === 0"
                    class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20 disabled:opacity-50">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Salvar PNG…
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

  @ViewChild('renderCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private electron = inject(ElectronService);
  private generator = inject(SocialImageGeneratorService);
  readonly socialShareService = inject(SocialShareService);

  readonly presets = PLATFORM_PRESETS;

  // Visibilidade controlada tanto por service quanto por inputs
  isVisible = computed(() => {
    return this.socialShareService.isOpen();
  });

  // Estado
  activePeriod = signal<'week' | 'month' | 'year' | 'custom'>('month');
  mediaType = signal<'MANGA' | 'BOOK' | 'ALL'>('ALL');
  startDate = '';
  endDate = '';
  onlyCompleted = false;

  selectedPreset = signal<SocialPlatformPreset>('INSTAGRAM_POST');
  selectedTemplate = signal<SocialLayoutTemplate>('BENTO_GRID');
  selectedTheme: SocialTheme = 'AMBIENT_DYNAMIC';

  cardTitle = 'Minhas Leituras do Mês';
  cardSubtitle = '';
  userHandle = '';

  showStatsBanner = true;
  showCoverTitles = true;
  showProgressBadge = true;

  rawItems = signal<SocialShareItem[]>([]);
  excludedIds = signal<Set<string>>(new Set());

  isRendering = signal(false);
  copySuccess = signal(false);

  activePresetConfig = computed(() => this.generator.getPresetConfig(this.selectedPreset()));

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
    if (serviceOpts?.initialLibraryId) {
      this.initialLibraryId = serviceOpts.initialLibraryId;
    }

    this.setPeriodPreset('month');
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
    this.loadItems();
  }

  async loadItems(): Promise<void> {
    if (!this.startDate || !this.endDate) return;

    this.isRendering.set(true);
    try {
      const serviceOpts = this.socialShareService.activeOptions();
      const libId = serviceOpts?.initialLibraryId ?? this.initialLibraryId;

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
    if (!this.canvasRef?.nativeElement) {
      setTimeout(() => this.triggerRender(), 50);
      return;
    }

    this.isRendering.set(true);
    try {
      const options: SocialRenderOptions = {
        preset: this.selectedPreset(),
        template: this.selectedTemplate(),
        theme: this.selectedTheme,
        title: this.cardTitle,
        subtitle: this.cardSubtitle,
        userHandle: this.userHandle,
        showStatsBanner: this.showStatsBanner,
        showCoverTitles: this.showCoverTitles,
        showProgressBadge: this.showProgressBadge,
        showBranding: true
      };

      await this.generator.renderToCanvas(
        this.canvasRef.nativeElement,
        this.selectedItems(),
        options
      );
    } finally {
      this.isRendering.set(false);
    }
  }

  async copyToClipboard(): Promise<void> {
    if (!this.canvasRef?.nativeElement) return;
    const dataUrl = this.canvasRef.nativeElement.toDataURL('image/png');
    const res = await this.electron.copySocialImage({ dataUrl });
    if (res?.success) {
      this.copySuccess.set(true);
      setTimeout(() => this.copySuccess.set(false), 4000);
    }
  }

  async saveImage(): Promise<void> {
    if (!this.canvasRef?.nativeElement) return;
    const dataUrl = this.canvasRef.nativeElement.toDataURL('image/png');
    const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const defaultName = `${sanitize(this.cardTitle || 'leituras')}-${sanitize(this.selectedPreset())}.png`;

    await this.electron.saveSocialImage({ dataUrl, defaultName });
  }

  handleClose(): void {
    this.socialShareService.close();
    this.close.emit();
  }

  onBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      this.handleClose();
    }
  }
}
