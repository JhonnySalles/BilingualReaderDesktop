import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioStatus } from '../../core/models/enums/tts-enums';

@Component({
  selector: 'app-book-tts-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible()) {
      <div
        class="absolute bottom-20 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,22rem)]
          bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl px-3 py-2
          pointer-events-auto select-none"
        (click)="$event.stopPropagation()"
        (mousedown)="$event.stopPropagation()">
        <div class="flex items-center justify-between gap-1">
          <button
            type="button"
            class="p-2.5 rounded-xl text-slate-200 hover:bg-slate-800 cursor-pointer"
            title="Configurar TTS"
            (click)="config.emit()">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </button>

          <button
            type="button"
            class="p-2.5 rounded-xl text-slate-200 hover:bg-slate-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Frase anterior"
            [disabled]="!canPrev()"
            (click)="previous.emit()">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>

          <button
            type="button"
            class="relative p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer
              disabled:opacity-60 disabled:cursor-wait min-w-[3rem] flex items-center justify-center"
            [title]="status() === AudioStatus.PLAY ? 'Pausar' : 'Reproduzir'"
            [disabled]="status() === AudioStatus.PREPARE"
            (click)="togglePlay.emit()"
            (contextmenu)="$event.preventDefault(); stop.emit()">
            @if (status() === AudioStatus.PREPARE) {
              <span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            } @else if (status() === AudioStatus.PLAY) {
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z"/>
              </svg>
            } @else {
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7L8 5z"/>
              </svg>
            }
          </button>

          <button
            type="button"
            class="p-2.5 rounded-xl text-slate-200 hover:bg-slate-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Próxima frase"
            [disabled]="!canNext()"
            (click)="next.emit()">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>

          <button
            type="button"
            class="p-2.5 rounded-xl text-slate-200 hover:bg-rose-500/20 hover:text-rose-300 cursor-pointer"
            title="Parar TTS"
            (click)="close.emit()">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        @if (error()) {
          <p class="text-[10px] text-rose-300 text-center mt-1.5 px-1">{{ error() }}</p>
        }
      </div>
    }
  `
})
export class BookTtsBarComponent {
  visible = input(false);
  status = input<AudioStatus>(AudioStatus.STOP);
  canPrev = input(false);
  canNext = input(false);
  error = input<string | null>(null);

  AudioStatus = AudioStatus;

  config = output<void>();
  previous = output<void>();
  next = output<void>();
  togglePlay = output<void>();
  stop = output<void>();
  close = output<void>();
}
