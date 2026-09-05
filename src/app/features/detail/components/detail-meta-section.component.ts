import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DetailMetaField {
  label: string;
  value: string;
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
      @if (fields.length === 0) {
        <p class="text-xs text-slate-500">Nenhum metadado disponível.</p>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          @for (field of fields; track field.label) {
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">{{ field.label }}</p>
              <p class="text-sm text-slate-100 break-words">{{ field.value }}</p>
            </div>
          }
        </div>
      }
      <ng-content></ng-content>
    </section>
  `
})
export class DetailMetaSectionComponent {
  @Input() title = 'Detalhe';
  @Input() fields: DetailMetaField[] = [];
}
