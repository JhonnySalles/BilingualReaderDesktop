import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DetailMetaField {
  label: string;
  value: string;
  fullWidth?: boolean;
}

@Component({
  selector: 'app-detail-meta-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="space-y-4">
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
        {{ title }}
      </h3>

      @if (fields.length === 0 && tags.length === 0) {
        <p class="text-xs text-slate-500">Nenhum metadado disponível.</p>
      } @else {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3.5">
          @for (field of fields; track field.label) {
            <div [class.col-span-full]="field.fullWidth">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">{{ field.label }}</p>
              <p class="text-sm text-slate-200 break-words leading-snug">{{ field.value }}</p>
            </div>
          }
        </div>

        @if (tags.length > 0) {
          <div class="pt-2 border-t border-slate-800/80 space-y-1.5">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tags</p>
            <div class="flex flex-wrap gap-1.5">
              @for (tag of tags; track tag) {
                <button
                  type="button"
                  (click)="tagClick.emit(tag)"
                  class="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors flex items-center gap-1 cursor-pointer">
                  <span class="text-slate-500">#</span>
                  <span>{{ tag }}</span>
                </button>
              }
            </div>
          </div>
        }
      }
      <ng-content></ng-content>
    </section>
  `
})
export class DetailMetaSectionComponent {
  @Input() title = 'Detalhe';
  @Input() fields: DetailMetaField[] = [];
  @Input() tags: string[] = [];

  @Output() tagClick = new EventEmitter<string>();
}
