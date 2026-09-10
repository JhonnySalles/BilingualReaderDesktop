import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Kanjax } from '../../../core/models';

@Component({
  selector: 'app-kanjax-detail-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" (click)="close.emit()">
      <div class="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden"
        (click)="$event.stopPropagation()">
        <div class="px-5 py-4 border-b border-slate-800 flex items-center gap-4"
          [ngClass]="{
            'bg-rose-950/40': jlptTone() === 'n1',
            'bg-amber-950/40': jlptTone() === 'n2',
            'bg-emerald-950/40': jlptTone() === 'n3',
            'bg-sky-950/40': jlptTone() === 'n4',
            'bg-violet-950/40': jlptTone() === 'n5'
          }">
          <span class="text-5xl font-bold text-slate-50">{{ item.kanji }}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-slate-100">{{ item.keywordsPt || item.keyword || '—' }}</p>
            <p class="text-xs text-slate-400 mt-0.5">
              JLPT {{ item.jlpt || '—' }} · Grau {{ item.grade || '—' }} · {{ item.strokes || '—' }} traços
            </p>
          </div>
          <button type="button" (click)="close.emit()" class="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="px-5 py-4 space-y-3 max-h-[65vh] overflow-y-auto text-sm">
          <div>
            <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Significado</p>
            <p class="text-slate-200">{{ item.meaningPt || item.meaning || '—' }}</p>
            @if (item.meaning && item.meaningPt) {
              <p class="text-xs text-slate-400 mt-1">{{ item.meaning }}</p>
            }
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">On-yomi</p>
              <p class="text-slate-300">{{ item.onyomi || '—' }}</p>
            </div>
            <div>
              <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Kun-yomi</p>
              <p class="text-slate-300">{{ item.kunyomi || '—' }}</p>
            </div>
          </div>
          @if (item.radical || item.parts || item.variants) {
            <div class="grid grid-cols-3 gap-2 text-xs text-slate-400">
              <div><span class="text-slate-500">Radical</span><br>{{ item.radical || '—' }}</div>
              <div><span class="text-slate-500">Partes</span><br>{{ item.parts || '—' }}</div>
              <div><span class="text-slate-500">Variantes</span><br>{{ item.variants || '—' }}</div>
            </div>
          }
          @if (item.koohii || item.kohii2) {
            <div>
              <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Koohii</p>
              <p class="text-xs text-slate-400 whitespace-pre-wrap">{{ item.koohii }}</p>
              @if (item.kohii2) {
                <p class="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{{ item.kohii2 }}</p>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class KanjaxDetailDialogComponent {
  @Input({ required: true }) item!: Kanjax;
  @Output() close = new EventEmitter<void>();

  jlptTone(): string {
    const n = Number(this.item.jlpt) || 0;
    if (n === 1) return 'n1';
    if (n === 2) return 'n2';
    if (n === 3) return 'n3';
    if (n === 4) return 'n4';
    if (n === 5) return 'n5';
    return '';
  }
}
