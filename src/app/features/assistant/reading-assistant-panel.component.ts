import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../core/services/electron.service';
import { SettingsService, LlmProviderSetting } from '../../core/services/settings.service';
import { AssistantMessage } from '../../core/models/enums/ai-enums';
import { ASSISTANT_SUGGESTION_CHIPS } from '../../core/utils/llm-assistant.prompts';
import {
  AssistantContextItem,
  buildContextFromSelection,
  contextMeterTone,
  defaultBookChapterIds,
  defaultMangaPageIds,
  parseSelection,
  serializeSelection
} from './assistant-context.util';

export interface AssistantUiMessage {
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  message: string;
  streaming?: boolean;
}

@Component({
  selector: 'app-reading-assistant-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="absolute inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" (click)="close.emit()">
      <div class="w-full max-w-5xl h-[min(80vh,720px)] rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl
                  flex flex-col overflow-hidden"
        (click)="$event.stopPropagation()">
        <header class="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
          <div class="min-w-0 flex-1">
            <h2 class="text-sm font-bold text-indigo-300 truncate">Assistente de Leitura</h2>
            <p class="text-[11px] text-slate-500 truncate">{{ title }}</p>
          </div>
          <button type="button" (click)="openSummary.emit()"
            class="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer">
            Resumo
          </button>
          <button type="button" (click)="clearHistory()"
            class="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 text-slate-300 hover:bg-rose-900/40 hover:text-rose-200 cursor-pointer">
            Limpar
          </button>
          <button type="button" (click)="close.emit()"
            class="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 cursor-pointer" title="Fechar">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </header>

        <div class="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_min(34%,280px)]">
          <!-- Chat -->
          <div class="flex flex-col min-h-0 border-r border-slate-800">
            <div class="flex-1 overflow-y-auto p-4 space-y-3" #scrollBox>
              @if (!messages().length && !streaming()) {
                <p class="text-xs text-slate-500 text-center py-8">Faça uma pergunta sobre o trecho selecionado.</p>
              }
              @for (m of messages(); track $index) {
                <div class="flex" [class.justify-end]="m.role === 'USER'">
                  <div class="max-w-[90%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap"
                    [ngClass]="{
                      'bg-indigo-600/30 border border-indigo-500/30 text-indigo-50': m.role === 'USER',
                      'bg-slate-800 border border-slate-700 text-slate-100': m.role === 'ASSISTANT',
                      'bg-amber-950/40 border border-amber-800/40 text-amber-100': m.role === 'SYSTEM'
                    }">
                    {{ m.message }}@if (m.streaming) {<span class="inline-block w-1.5 h-3 ml-0.5 bg-indigo-300 animate-pulse align-middle"></span>}
                  </div>
                </div>
              }
              @if (error()) {
                <p class="text-[11px] text-rose-300">{{ error() }}</p>
              }
            </div>

            <div class="px-3 pt-2 flex flex-wrap gap-1.5 shrink-0">
              @for (chip of chips; track chip) {
                <button type="button" (click)="ask(chip)"
                  class="px-2 py-1 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 hover:bg-indigo-900/50 hover:text-indigo-200 cursor-pointer"
                  [disabled]="streaming()">
                  {{ chip }}
                </button>
              }
            </div>

            <form class="p-3 flex gap-2 shrink-0 border-t border-slate-800" (submit)="$event.preventDefault(); ask(draft)">
              <input type="text" [(ngModel)]="draft" name="assistantDraft"
                placeholder="Pergunte sobre o contexto…"
                class="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                [disabled]="streaming()" />
              @if (streaming()) {
                <button type="button" (click)="cancel()"
                  class="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-700/80 text-white cursor-pointer">
                  Cancelar
                </button>
              } @else {
                <button type="submit"
                  class="px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer disabled:opacity-40"
                  [disabled]="!draft.trim()">
                  Enviar
                </button>
              }
            </form>
          </div>

          <!-- Context sidebar -->
          <aside class="flex flex-col min-h-0 bg-slate-950/50">
            <div class="px-3 py-2 border-b border-slate-800">
              <p class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Contexto</p>
              <p class="text-[11px] mt-1 tabular-nums"
                [ngClass]="{
                  'text-emerald-400': meter() === 'ok',
                  'text-amber-400': meter() === 'warn',
                  'text-rose-400': meter() === 'over'
                }">
                {{ charCount() }} / {{ maxContextChars }} chars
              </p>
            </div>
            <div class="px-3 py-2 border-b border-slate-800 space-y-1.5">
              <label class="block text-[10px] text-slate-500">Provedor</label>
              <select class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-200"
                [ngModel]="selectedProvider" name="asstProvider"
                (ngModelChange)="onProviderChange($event)">
                <option value="openrouter">OpenRouter</option>
                <option value="ollama">Ollama</option>
                <option value="lm_studio">LM Studio</option>
              </select>
              <label class="block text-[10px] text-slate-500 mt-1.5">Modelo</label>
              <select class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-200"
                [(ngModel)]="selectedModel" name="asstModel">
                @for (m of modelOptions(); track m.id) {
                  <option [value]="m.id">{{ m.id }}{{ m.hasVision ? ' · vision' : '' }}</option>
                }
              </select>
            </div>
            <div class="flex-1 overflow-y-auto p-2 space-y-1">
              @for (item of items; track item.id) {
                <label class="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-900 cursor-pointer">
                  <input type="checkbox" class="mt-0.5 accent-indigo-600"
                    [checked]="isSelected(item.id)"
                    (change)="toggleItem(item.id, $any($event.target).checked)" />
                  <span class="text-[11px] text-slate-300 leading-snug line-clamp-2">{{ item.label }}</span>
                </label>
              } @empty {
                <p class="text-[11px] text-slate-600 text-center py-6">Nenhum trecho disponível.</p>
              }
            </div>
            <div class="p-2 border-t border-slate-800 max-h-28 overflow-y-auto">
              <p class="text-[10px] text-slate-600 whitespace-pre-wrap break-words line-clamp-6">{{ preview() }}</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  `
})
export class ReadingAssistantPanelComponent implements OnChanges, OnDestroy {
  private electron = inject(ElectronService);
  private settings = inject(SettingsService);

  @Input({ required: true }) type!: 'BOOK' | 'MANGA';
  @Input({ required: true }) referenceId!: number;
  @Input() title = '';
  @Input() sessionId = '';
  @Input() items: AssistantContextItem[] = [];
  @Input() currentPage = 0;
  @Input() pageCount = 0;
  @Input() maxContextChars = 12000;
  @Input() preloadSystem: string | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() openSummary = new EventEmitter<void>();

  readonly chips = ASSISTANT_SUGGESTION_CHIPS;
  messages = signal<AssistantUiMessage[]>([]);
  streaming = signal(false);
  error = signal<string | null>(null);
  draft = '';
  selectedIds = signal<string[]>([]);
  selectedProvider: LlmProviderSetting = 'openrouter';
  selectedModel = 'openrouter/free';
  modelOptions = signal<Array<{ id: string; name: string; hasVision: boolean }>>([]);

  private requestId: string | null = null;
  private unsubChunk: (() => void) | null = null;
  private ready = false;

  charCount = computed(() => {
    return buildContextFromSelection(this.items, this.selectedIds(), this.maxContextChars).charCount;
  });

  meter = computed(() => contextMeterTone(this.charCount(), this.maxContextChars));

  preview = computed(() => {
    const { text } = buildContextFromSelection(this.items, this.selectedIds(), this.maxContextChars);
    return text.slice(0, 400) || 'Selecione capítulos ou páginas à direita.';
  });

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['items'] || changes['referenceId'] || changes['type']) {
      await this.bootstrap();
    }
    if (changes['preloadSystem'] && this.preloadSystem) {
      this.messages.update(list => {
        const without = list.filter(m => m.role !== 'SYSTEM');
        return [{ role: 'SYSTEM', message: this.preloadSystem! }, ...without];
      });
    }
  }

  ngOnDestroy(): void {
    this.unsubChunk?.();
    if (this.requestId) void this.electron.assistantCancel(this.requestId);
  }

  isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  toggleItem(id: string, checked: boolean): void {
    this.selectedIds.update(ids => {
      const set = new Set(ids);
      if (checked) set.add(id);
      else set.delete(id);
      const next = [...set];
      void this.electron.assistantSelectionSet(this.type, this.referenceId, serializeSelection(next));
      return next;
    });
  }

  async clearHistory(): Promise<void> {
    await this.electron.assistantHistoryClear(this.referenceId, this.type);
    this.messages.set(this.preloadSystem ? [{ role: 'SYSTEM', message: this.preloadSystem }] : []);
  }

  cancel(): void {
    if (this.requestId) void this.electron.assistantCancel(this.requestId);
    this.streaming.set(false);
  }

  async ask(questionRaw: string): Promise<void> {
    const question = String(questionRaw || '').trim();
    if (!question || this.streaming()) return;
    this.draft = '';
    this.error.set(null);

    const status = await this.electron.assistantStatus();
    if (!status.enabled) {
      this.error.set('Ative a IA em Configurações.');
      return;
    }
    if (status.ready === false) {
      this.error.set(
        status.readyReason ||
          (status.provider === 'openrouter'
            ? 'Configure a chave OpenRouter.'
            : 'Provedor local offline — verifique Ollama/LM Studio e a Base URL.')
      );
      return;
    }
    if (status.provider === 'openrouter' && !status.hasApiKey) {
      this.error.set('Configure a chave OpenRouter.');
      return;
    }

    const built = buildContextFromSelection(this.items, this.selectedIds(), this.maxContextChars);
    if (!built.text.trim() && this.type === 'BOOK') {
      this.error.set('Selecione ao menos um capítulo com texto.');
      return;
    }

    let imagesBase64: string[] = [];
    if (this.type === 'MANGA' && this.sessionId && built.pageIndexes.length) {
      imagesBase64 = await this.electron.assistantPageImages(this.sessionId, built.pageIndexes);
    }

    this.messages.update(m => [...m, { role: 'USER', message: question }]);
    this.messages.update(m => [...m, { role: 'ASSISTANT', message: '', streaming: true }]);
    this.streaming.set(true);

    const requestId = `asst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.requestId = requestId;
    this.unsubChunk?.();
    this.unsubChunk = this.electron.onAssistantChunk(ev => {
      if (ev.requestId !== requestId) return;
      this.messages.update(list => {
        const copy = [...list];
        const last = copy[copy.length - 1];
        if (last?.role === 'ASSISTANT' && last.streaming) {
          copy[copy.length - 1] = { ...last, message: last.message + ev.delta };
        }
        return copy;
      });
    });

    try {
      const result = await this.electron.assistantAsk({
        type: this.type,
        referenceId: this.referenceId,
        title: this.title,
        question,
        contextText: built.text,
        imagesBase64,
        model: this.selectedModel,
        mode: 'qa',
        language: 'Portuguese',
        requestId
      });
      this.messages.update(list => {
        const copy = [...list];
        const last = copy[copy.length - 1];
        if (last?.role === 'ASSISTANT') {
          copy[copy.length - 1] = {
            role: 'ASSISTANT',
            message: result.ok ? result.text || last.message : last.message || result.error || 'Falha',
            streaming: false
          };
        }
        return copy;
      });
      if (!result.ok) this.error.set(result.error || 'Falha na pergunta');
    } finally {
      this.streaming.set(false);
      this.requestId = null;
      this.unsubChunk?.();
      this.unsubChunk = null;
    }
  }

  async onProviderChange(value: string): Promise<void> {
    const p: LlmProviderSetting =
      value === 'ollama' || value === 'lm_studio' || value === 'openrouter'
        ? value
        : 'openrouter';
    this.selectedProvider = p;
    this.settings.llmProvider.set(p);
    if (p === 'ollama' || p === 'lm_studio') {
      this.settings.llmLocalKind.set(p);
    }
    await this.electron.llmSetProvider(p);
    await this.reloadModels();
  }

  private async bootstrap(): Promise<void> {
    const hist = await this.electron.assistantHistoryList(this.referenceId, this.type);
    const mapped: AssistantUiMessage[] = hist
      .filter(h => h.role === AssistantMessage.USER || h.role === AssistantMessage.ASSISTANT)
      .map(h => ({
        role: h.role as 'USER' | 'ASSISTANT',
        message: h.message
      }));
    if (this.preloadSystem) {
      mapped.unshift({ role: 'SYSTEM', message: this.preloadSystem });
    }
    this.messages.set(mapped);

    const saved = parseSelection(await this.electron.assistantSelectionGet(this.type, this.referenceId));
    let selected = saved.filter(id => this.items.some(i => i.id === id));
    if (!selected.length) {
      selected =
        this.type === 'MANGA'
          ? defaultMangaPageIds(
              this.currentPage,
              this.pageCount || this.items.length,
              2
            ).slice(0, this.settings.llmMaxMangaPages())
          : defaultBookChapterIds(this.items, this.settings.llmMaxBookChapters());
    }
    // Filter manga defaults to existing items
    selected = selected.filter(id => this.items.some(i => i.id === id));
    if (!selected.length && this.items.length) {
      selected = [this.items[Math.min(this.currentPage, this.items.length - 1)]?.id].filter(Boolean) as string[];
    }
    this.selectedIds.set(selected);

    this.selectedProvider = this.settings.llmProvider();
    await this.reloadModels();
    this.ready = true;
  }

  private async reloadModels(): Promise<void> {
    const provider = this.selectedProvider;
    const models = await this.electron.assistantModels(provider);
    let opts = models.models || [];
    if (this.type === 'MANGA') {
      const vision = opts.filter(m => m.hasVision);
      if (vision.length) opts = vision;
    }
    const local = provider === 'ollama' || provider === 'lm_studio';
    if (!opts.length) {
      opts = local
        ? [
            {
              id: this.settings.llmMangaLocalModel() || 'llama3.2',
              name: this.settings.llmMangaLocalModel() || 'llama3.2',
              hasVision: false
            }
          ]
        : [{ id: 'openrouter/free', name: 'openrouter/free', hasVision: false }];
    }
    this.modelOptions.set(opts);
    const preferred = local
      ? this.type === 'MANGA'
        ? this.settings.llmMangaLocalModel()
        : this.settings.llmBookLocalModel()
      : this.type === 'MANGA'
        ? this.settings.llmMangaTranslateModel()
        : this.settings.llmBookQaModel();
    this.selectedModel = opts.some(o => o.id === preferred) ? preferred : opts[0].id;
  }
}
