import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Languages } from '../../core/models';
import {
  TextSpeech,
  TextSpeechMeta,
  activeTextSpeechVoices,
  formatTtsSpeedLabel
} from '../../core/models/enums/tts-enums';

@Component({
  selector: 'app-book-tts-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
        (click)="dismiss.emit()">
        <div
          class="w-full max-w-md bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl p-5 space-y-4"
          (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-100">Configuração TTS</h3>
            <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
              (click)="dismiss.emit()" title="Fechar">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div>
            <label class="block text-xs text-slate-300 mb-1.5 font-medium">Voz</label>
            <select
              class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 cursor-pointer"
              [ngModel]="draftVoice()"
              (ngModelChange)="draftVoice.set($event)">
              @for (v of voices; track v.id) {
                <option [ngValue]="v.id">{{ v.label }}</option>
              }
            </select>
          </div>

          <div>
            <div class="flex justify-between text-xs text-slate-300 mb-1.5 font-medium">
              <span>Velocidade</span>
              <span class="text-indigo-400 font-bold tabular-nums">{{ speedLabel() }}</span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              step="5"
              class="w-full accent-indigo-600 cursor-pointer"
              [ngModel]="draftSpeed()"
              (ngModelChange)="draftSpeed.set(+$event)" />
            <div class="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>−50%</span>
              <span>0</span>
              <span>+50%</span>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-1">
            <button type="button"
              class="px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
              (click)="dismiss.emit()">
              Cancelar
            </button>
            <button type="button"
              class="px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
              (click)="apply.emit({ voice: draftVoice(), speed: draftSpeed() })">
              Aplicar
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class BookTtsPopupComponent {
  open = input(false);
  voice = input<TextSpeech>(TextSpeech.FRANCISCA);
  speed = input(0);
  japaneseBook = input(false);

  dismiss = output<void>();
  apply = output<{ voice: TextSpeech; speed: number }>();

  draftVoice = signal<TextSpeech>(TextSpeech.FRANCISCA);
  draftSpeed = signal(0);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.draftVoice.set(this.voice());
      this.draftSpeed.set(this.speed());
    });
  }

  get voices(): TextSpeechMeta[] {
    const all = activeTextSpeechVoices();
    if (this.japaneseBook()) {
      return all.filter(v => v.language === Languages.JAPANESE);
    }
    return all;
  }

  speedLabel(): string {
    return formatTtsSpeedLabel(this.draftSpeed());
  }
}
