import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-statistics-kpi-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      (click)="pressed.emit()"
      [disabled]="!clickable"
      class="w-full rounded-xl p-3 border transition-all text-center bg-slate-800 border-slate-700"
      [class.cursor-pointer]="clickable"
      [class.opacity-90]="!clickable"
      [ngClass]="hostClass">
      <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{{ label }}</p>
      <p class="text-2xl font-bold tabular-nums" [ngClass]="valueClass">
        {{ value }}
      </p>
    </button>
  `
})
export class StatisticsKpiCardComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: string | number;
  @Input() clickable = false;
  @Input() accent: 'indigo' | 'amber' = 'indigo';
  @Output() pressed = new EventEmitter<void>();

  get hostClass(): Record<string, boolean> {
    return {
      'hover:-translate-y-0.5': this.clickable,
      'hover:border-indigo-400': this.clickable && this.accent === 'indigo',
      'hover:border-amber-400': this.clickable && this.accent === 'amber'
    };
  }

  get valueClass(): string {
    return this.accent === 'indigo' ? 'text-indigo-300' : 'text-amber-300';
  }
}
