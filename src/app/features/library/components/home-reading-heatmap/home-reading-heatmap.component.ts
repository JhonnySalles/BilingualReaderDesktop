import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeatmapDay } from '../../../../core/models';
import { formatShortDuration } from '../../../../core/services/statistics.service';

interface HeatCell {
  date: string;
  value: number;
  pages: number;
  level: number;
  title: string;
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

@Component({
  selector: 'app-home-reading-heatmap',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <h3 class="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
          Atividade de leitura
        </h3>
        <div class="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span>Menos</span>
          @for (lv of [0, 1, 2, 3, 4]; track lv) {
            <span class="w-3 h-3 rounded-sm" [ngClass]="levelClass(lv)"></span>
          }
          <span>Mais</span>
        </div>
      </div>

      <div class="overflow-x-auto">
        <div class="inline-flex gap-1.5 min-w-max">
          <div class="flex flex-col gap-1 pr-1 pt-4 justify-between py-[2px]">
            @for (label of weekdayLabels; track label; let i = $index) {
              <span class="h-3 text-[9px] text-slate-500 leading-3 w-6"
                [class.opacity-0]="i % 2 === 1">{{ label }}</span>
            }
          </div>

          <div class="flex flex-col gap-1">
            <div class="flex gap-1 h-3 relative">
              @for (label of monthLabels; track $index) {
                <span
                  class="absolute text-[9px] text-slate-500 leading-3 whitespace-nowrap"
                  [style.left.px]="label.offsetPx">{{ label.text }}</span>
              }
            </div>
            <div class="flex gap-1">
              @for (week of weeks; track $index) {
                <div class="flex flex-col gap-1">
                  @for (cell of week; track cell.date) {
                    <div
                      class="w-3 h-3 rounded-sm"
                      [ngClass]="levelClass(cell.level)"
                      [attr.title]="cell.title"></div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      </div>

      @if (!hasActivity) {
        <p class="text-[11px] text-slate-500">
          Sem leituras registradas neste período. Abra um mangá ou livro para começar o gráfico.
        </p>
      }
    </div>
  `
})
export class HomeReadingHeatmapComponent implements OnChanges {
  @Input() days: HeatmapDay[] = [];

  readonly weekdayLabels = WEEKDAY_LABELS;
  weeks: HeatCell[][] = [];
  monthLabels: { text: string; offsetPx: number }[] = [];
  hasActivity = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['days']) {
      this.buildGrid();
    }
  }

  levelClass(level: number): string {
    switch (level) {
      case 1: return 'bg-indigo-900/80';
      case 2: return 'bg-indigo-700/80';
      case 3: return 'bg-indigo-500/90';
      case 4: return 'bg-indigo-400';
      default: return 'bg-slate-800';
    }
  }

  private buildGrid(): void {
    const raw = this.days?.length ? [...this.days] : this.emptyTwelveMonths();
    const max = Math.max(0, ...raw.map(d => d.value));
    this.hasActivity = max > 0;

    const cells: HeatCell[] = raw.map(d => {
      const level = this.intensity(d.value, max);
      const title = d.value > 0
        ? `${this.formatDate(d.date)} · ${formatShortDuration(d.value)} · ${d.pages} pág.`
        : `${this.formatDate(d.date)} · Sem leitura`;
      return { date: d.date, value: d.value, pages: d.pages, level, title };
    });

    // Align to week starting Sunday (like GitHub)
    const first = this.parseLocalDate(cells[0].date);
    const pad = first.getDay(); // 0=Sun
    const padded: (HeatCell | null)[] = [
      ...Array.from({ length: pad }, () => null),
      ...cells
    ];

    const weeks: HeatCell[][] = [];
    for (let i = 0; i < padded.length; i += 7) {
      const slice = padded.slice(i, i + 7);
      while (slice.length < 7) slice.push(null);
      weeks.push(slice.map((c, idx) => {
        if (c) return c;
        return {
          date: `pad-${i}-${idx}`,
          value: 0,
          pages: 0,
          level: 0,
          title: ''
        };
      }));
    }
    this.weeks = weeks;
    this.monthLabels = this.buildMonthLabels(weeks);
  }

  private buildMonthLabels(weeks: HeatCell[][]): { text: string; offsetPx: number }[] {
    const labels: { text: string; offsetPx: number }[] = [];
    let lastMonth = -1;
    // cell 12px + gap 4px = 16px per week column
    const colWidth = 16;

    for (let wi = 0; wi < weeks.length; wi++) {
      const real = weeks[wi].find(c => !c.date.startsWith('pad-'));
      if (!real) continue;
      const d = this.parseLocalDate(real.date);
      const month = d.getMonth();
      if (month !== lastMonth) {
        labels.push({ text: MONTH_LABELS[month], offsetPx: wi * colWidth });
        lastMonth = month;
      }
    }
    return labels;
  }

  private intensity(value: number, max: number): number {
    if (value <= 0 || max <= 0) return 0;
    const ratio = value / max;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  }

  /** Last ~12 months ending today, Sunday-aligned start (matches backend). */
  private emptyTwelveMonths(): HeatmapDay[] {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const start = new Date(today);
    start.setMonth(start.getMonth() - 12);
    start.setDate(start.getDate() + 1);
    start.setDate(start.getDate() - start.getDay());

    const out: HeatmapDay[] = [];
    const cursor = new Date(start);
    const endKey = this.toLocalDateKey(today);
    while (this.toLocalDateKey(cursor) <= endKey) {
      out.push({ date: this.toLocalDateKey(cursor), value: 0, pages: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  private parseLocalDate(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
  }

  private toLocalDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private formatDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  }
}
