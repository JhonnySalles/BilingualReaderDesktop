import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NormalizedSubtitleText } from '../../../core/utils/subtitle-normalize';

@Component({
  selector: 'app-manga-subtitle-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="absolute right-0 top-0 bottom-0 w-80 max-w-[90vw] z-40 flex flex-col
                bg-slate-950/95 border-l border-slate-800 backdrop-blur-md shadow-2xl">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div>
          <h3 class="text-sm font-bold text-slate-100">Legendas</h3>
          <p class="text-[10px] text-slate-500 mt-0.5">
            {{ texts.length ? texts.length + ' texto(s) nesta página' : 'Sem legenda nesta página' }}
          </p>
        </div>
        <button type="button" (click)="close.emit()"
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
          title="Fechar">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="px-4 py-3 space-y-3 border-b border-slate-800">
        <div>
          <label class="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Idioma</label>
          <select
            class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
            [ngModel]="language"
            (ngModelChange)="languageChange.emit($event)">
            @for (lang of languages; track lang) {
              <option [ngValue]="lang">{{ lang }}</option>
            }
          </select>
        </div>

        <label class="flex items-center justify-between gap-2 text-xs text-slate-300 cursor-pointer">
          <span>Desenhar caixas</span>
          <input type="checkbox" class="w-4 h-4 accent-indigo-600 rounded"
            [ngModel]="drawBoxes"
            (ngModelChange)="drawBoxesChange.emit($event)" />
        </label>

        <button type="button" (click)="importJson.emit()"
          class="w-full px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700
                 text-slate-300 hover:bg-slate-800 cursor-pointer">
          Importar JSON externo
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-3 space-y-2">
        @if (!texts.length) {
          <p class="text-xs text-slate-500 text-center py-8 px-4">
            Nenhuma legenda encontrada para esta página. Verifique o idioma ou importe um JSON.
          </p>
        } @else {
          @for (t of texts; track t.sequence + '-' + $index) {
            <button
              type="button"
              class="w-full text-left rounded-xl border px-3 py-2 transition-colors cursor-pointer"
              [ngClass]="{
                'border-amber-500 bg-amber-500/10': selectedSequence === t.sequence,
                'border-slate-800 bg-slate-900/60': selectedSequence !== t.sequence
              }"
              (click)="selectText.emit(t)">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[10px] font-bold text-red-400">#{{ t.sequence }}</span>
                <span class="text-[10px] text-slate-600 font-mono">
                  {{ t.x1 }},{{ t.y1 }} - {{ t.x2 }},{{ t.y2 }}
                </span>
              </div>
              <p class="text-xs text-slate-200 whitespace-pre-wrap break-words leading-relaxed">{{ t.text }}</p>
            </button>
          }
        }
      </div>
    </div>
  `
})
export class MangaSubtitlePanelComponent {
  @Input() languages: string[] = [];
  @Input() language = '';
  @Input() texts: NormalizedSubtitleText[] = [];
  @Input() drawBoxes = true;
  @Input() selectedSequence: number | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() languageChange = new EventEmitter<string>();
  @Output() drawBoxesChange = new EventEmitter<boolean>();
  @Output() selectText = new EventEmitter<NormalizedSubtitleText>();
  @Output() importJson = new EventEmitter<void>();
}
