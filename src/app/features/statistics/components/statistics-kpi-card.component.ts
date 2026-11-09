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
  @Input() accent: 'indigo' | 'amber' | 'manga' | 'book' = 'manga';
  @Output() pressed = new EventEmitter<void>();

  get isManga(): boolean {
    return this.accent === 'indigo' || this.accent === 'manga';
  }

  get hostClass(): Record<string, boolean> {
    return {
      'hover:-translate-y-0.5': this.clickable,
      'manga-kpi-hover': this.clickable && this.isManga,
      'book-kpi-hover': this.clickable && !this.isManga
    };
  }

  get valueClass(): string {
    return this.isManga ? 'manga-kpi-value' : 'book-kpi-value';
  }
}
