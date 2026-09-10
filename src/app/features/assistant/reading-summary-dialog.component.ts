import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../core/services/electron.service';
import {
  AssistantContextItem,
  buildContextFromSelection
} from './assistant-context.util';

@Component({
  selector: 'app-reading-summary-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="absolute inset-0 z-[75] flex items-center justify-center bg-black/70 p-4" (click)="close.emit()">
      <div class="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden"
        (click)="$event.stopPropagation()">
        <div class="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h3 class="text-sm font-bold text-indigo-300">Resumo do trecho</h3>
          <button type="button" (click)="close.emit()" class="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="p-4 space-y-3">
          <p class="text-[11px] text-slate-500">
            Usa a seleção atual de contexto ({{ selectedCount }} itens, {{ charCount }} chars).
          </p>
          @if (busy()) {
            <p class="text-xs text-slate-300 whitespace-pre-wrap min-h-[6rem]">{{ summary() }}<span class="inline-block w-1.5 h-3 ml-0.5 bg-indigo-300 animate-pulse align-middle"></span></p>
          } @else if (summary()) {
            <p class="text-xs text-slate-200 whitespace-pre-wrap max-h-64 overflow-y-auto">{{ summary() }}</p>
          } @else {
            <p class="text-xs text-slate-500 py-6 text-center">Gere um resumo para refrescar a memória antes de continuar.</p>
          }
          @if (error()) {
            <p class="text-[11px] text-rose-300">{{ error() }}</p>
          }
          <div class="flex justify-end gap-2 pt-1">
            @if (summary() && !busy()) {
              <button type="button" (click)="openInChat.emit(summary())"
                class="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer">
                Abrir no chat
              </button>
            }
            <button type="button" (click)="generate()" [disabled]="busy() || !selectedCount"
              class="px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer disabled:opacity-40">
              {{ busy() ? 'Gerando…' : 'Gerar resumo' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ReadingSummaryDialogComponent {
  private electron = inject(ElectronService);

  @Input({ required: true }) type!: 'BOOK' | 'MANGA';
  @Input({ required: true }) referenceId!: number;
  @Input() title = '';
  @Input() items: AssistantContextItem[] = [];
  @Input() selectedIds: string[] = [];
  @Input() maxContextChars = 12000;
  @Input() model = 'openrouter/free';

  @Output() close = new EventEmitter<void>();
  @Output() openInChat = new EventEmitter<string>();

  summary = signal('');
  busy = signal(false);
  error = signal<string | null>(null);
  private requestId: string | null = null;
  private unsub: (() => void) | null = null;

  get selectedCount(): number {
    const set = new Set(this.selectedIds);
    return this.items.filter(i => set.has(i.id)).length;
  }

  get charCount(): number {
    return buildContextFromSelection(this.items, this.selectedIds, this.maxContextChars).charCount;
  }

  async generate(): Promise<void> {
    const built = buildContextFromSelection(this.items, this.selectedIds, this.maxContextChars);
    if (!built.text.trim()) {
      this.error.set('Selecione contexto antes de resumir.');
      return;
    }
    this.error.set(null);
    this.summary.set('');
    this.busy.set(true);
    const requestId = `sum-${Date.now()}`;
    this.requestId = requestId;
    this.unsub?.();
    this.unsub = this.electron.onAssistantChunk(ev => {
      if (ev.requestId !== requestId) return;
      this.summary.update(t => t + ev.delta);
    });
    try {
      const result = await this.electron.assistantAsk({
        type: this.type,
        referenceId: this.referenceId,
        title: this.title,
        question: 'summary',
        contextText: built.text,
        model: this.model,
        mode: 'summary',
        language: 'Portuguese',
        requestId
      });
      if (result.ok && result.text) this.summary.set(result.text);
      if (!result.ok) this.error.set(result.error || 'Falha ao resumir');
    } finally {
      this.busy.set(false);
      this.requestId = null;
      this.unsub?.();
      this.unsub = null;
    }
  }
}
