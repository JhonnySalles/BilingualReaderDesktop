import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TouchScreen } from '../../core/models';
import { TouchZoneMeta } from '../../core/services/touch-zone.service';

@Component({
  selector: 'app-reader-touch-action-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (open) {
      <div class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
        (click)="cancel.emit()">
        <div class="w-full max-w-md max-h-[min(80vh,32rem)] overflow-hidden rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col"
          (click)="$event.stopPropagation()">
          <div class="px-5 py-4 border-b border-slate-800">
            <h3 class="text-sm font-bold text-slate-100">Escolher função</h3>
            <p class="text-xs text-slate-400 mt-1">Selecione a ação para esta zona de clique.</p>
          </div>
          <div class="overflow-y-auto flex-1 p-2">
            @for (item of actions; track item.action) {
              <button type="button"
                (click)="select.emit(item.action)"
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer"
                [ngClass]="item.action === selected
                  ? 'bg-indigo-600/30 text-indigo-200'
                  : 'text-slate-200 hover:bg-slate-800'">
                <span class="shrink-0 w-9 h-9 rounded-lg bg-slate-800/80 flex items-center justify-center">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    @for (d of item.iconPaths; track d) {
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="d"/>
                    }
                  </svg>
                </span>
                <span class="text-sm font-medium">{{ item.label }}</span>
              </button>
            }
          </div>
          <div class="px-4 py-3 border-t border-slate-800 flex justify-end">
            <button type="button" (click)="cancel.emit()"
              class="px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ReaderTouchActionPickerComponent {
  @Input() open = false;
  @Input() actions: TouchZoneMeta[] = [];
  @Input() selected: TouchScreen | null = null;
  @Output() select = new EventEmitter<TouchScreen>();
  @Output() cancel = new EventEmitter<void>();
}
