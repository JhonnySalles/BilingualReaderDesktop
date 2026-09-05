import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartPoint } from '../../../core/models';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface PlottedPoint {
  month: number;
  count: number;
  label: string;
  x: number;
  y: number;
}

@Component({
  selector: 'app-statistics-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full h-56 relative">
      <svg viewBox="0 0 560 220" class="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" [attr.stop-color]="strokeColor" stop-opacity="0.35" />
            <stop offset="100%" [attr.stop-color]="strokeColor" stop-opacity="0.02" />
          </linearGradient>
        </defs>

        @for (gy of gridYs; track gy) {
          <line
            x1="40" [attr.y1]="gy" x2="540" [attr.y2]="gy"
            stroke="rgba(51,65,85,0.45)" stroke-width="1" />
        }

        <path [attr.d]="areaPath()" [attr.fill]="'url(#' + gradientId + ')'" />
        <path
          [attr.d]="linePath()"
          fill="none"
          [attr.stroke]="strokeColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round" />

        @for (pt of plottedPoints(); track pt.month) {
          <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3.5" [attr.fill]="strokeColor" class="opacity-80" />
          <text [attr.x]="pt.x" y="208" text-anchor="middle" fill="#94a3b8" font-size="10">
            {{ pt.label }}
          </text>
        }
      </svg>

      @if (maxCount() === 0) {
        <div class="absolute inset-0 flex items-center justify-center text-[11px] text-slate-500 pointer-events-none">
          Sem leituras concluídas neste período
        </div>
      }
    </div>
  `
})
export class StatisticsChartComponent {
  @Input() points: ChartPoint[] = [];
  @Input() accent: 'indigo' | 'amber' = 'indigo';
  @Input() label = 'Leituras / mês';

  readonly gradientId = `stats-fill-${Math.random().toString(36).slice(2, 9)}`;
  readonly gridYs = [20, 60, 100, 140, 180];

  get strokeColor(): string {
    return this.accent === 'indigo' ? 'rgb(99, 102, 241)' : 'rgb(245, 158, 11)';
  }

  maxCount(): number {
    const counts = this.normalized().map(p => p.count);
    const max = Math.max(0, ...counts);
    return max;
  }

  plottedPoints(): PlottedPoint[] {
    const points = this.normalized();
    const max = Math.max(1, this.maxCount());
    const left = 40;
    const right = 540;
    const top = 20;
    const bottom = 180;
    const span = Math.max(points.length - 1, 1);

    return points.map((p, i) => ({
      ...p,
      x: left + ((right - left) * i) / span,
      y: bottom - ((bottom - top) * p.count) / max
    }));
  }

  linePath(): string {
    const pts = this.plottedPoints();
    if (!pts.length) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }

  areaPath(): string {
    const pts = this.plottedPoints();
    if (!pts.length) return '';
    const bottom = 180;
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const last = pts[pts.length - 1];
    const first = pts[0];
    return `${line} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`;
  }

  private normalized(): { month: number; count: number; label: string }[] {
    const len = Math.max(this.points?.length || 0, 12);
    const capped = Math.min(len, 12);
    const result: { month: number; count: number; label: string }[] = [];
    const sourceLen = this.points?.length || 0;
    const months = sourceLen > 0 ? sourceLen : 12;

    for (let i = 0; i < months && i < capped; i++) {
      const month = i + 1;
      result.push({
        month,
        count: this.points?.find(p => p.month === month)?.count ?? 0,
        label: MONTH_LABELS[i] ?? String(month)
      });
    }

    if (result.length === 0) {
      for (let i = 0; i < 12; i++) {
        result.push({ month: i + 1, count: 0, label: MONTH_LABELS[i] });
      }
    }
    return result;
  }
}
