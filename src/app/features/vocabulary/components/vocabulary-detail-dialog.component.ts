import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ElectronService } from '../../../core/services/electron.service';
import { Kanjax, Vocabulary } from '../../../core/models';

@Component({
  selector: 'app-vocabulary-detail-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4" (click)="close.emit()">
      <div class="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden"
        (click)="$event.stopPropagation()">
        <div class="px-5 py-4 border-b border-slate-800 flex items-start gap-4">
          <span class="text-3xl font-bold text-indigo-200" [style.writing-mode]="'vertical-rl'">{{ item.word }}</span>
          <div class="flex-1 min-w-0 space-y-1">
            <p class="text-sm text-slate-100">
              {{ item.reading || '—' }}
              @if (!item.revised) { <span class="text-amber-400">¹</span> }
            </p>
            <p class="text-xs text-slate-400">JLPT {{ item.jlpt || '—' }} · Freq. {{ item.appears || 0 }}</p>
            @if (item.basicForm) {
              <p class="text-xs text-slate-500">Forma base: {{ item.basicForm }}</p>
            }
          </div>
          <button type="button" (click)="close.emit()" class="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          <div>
            <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Português</p>
            <p class="text-sm text-slate-200">{{ item.portuguese || '—' }}</p>
          </div>
          <div>
            <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">English</p>
            <p class="text-sm text-slate-300">{{ item.english || '—' }}</p>
          </div>
          @if (kanjiList().length) {
            <div>
              <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Kanji</p>
              <div class="flex flex-wrap gap-2">
                @for (k of kanjiList(); track k.kanji) {
                  <button type="button" (click)="openKanji.emit(k)"
                    class="w-11 h-11 rounded-xl border border-slate-700 bg-slate-950 text-lg text-indigo-100 hover:border-indigo-500 cursor-pointer">
                    {{ k.kanji }}
                  </button>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class VocabularyDetailDialogComponent implements OnInit {
  private electron = inject(ElectronService);
  @Input({ required: true }) item!: Vocabulary;
  @Output() close = new EventEmitter<void>();
  @Output() openKanji = new EventEmitter<Kanjax>();
  kanjiList = signal<Kanjax[]>([]);

  async ngOnInit(): Promise<void> {
    this.kanjiList.set(await this.electron.getKanjaxForWord(this.item.word || ''));
  }
}
