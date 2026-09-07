import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NormalizedSubtitleText } from '../../../core/utils/subtitle-normalize';
import { hitTestSubtitleText } from './subtitle-match.util';

@Component({
  selector: 'app-manga-subtitle-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible && texts.length) {
      <svg
        class="absolute inset-0 w-full h-full pointer-events-auto z-10"
        [attr.viewBox]="'0 0 ' + imageWidth + ' ' + imageHeight"
        preserveAspectRatio="none"
        (click)="onSvgClick($event)">
        @for (t of texts; track t.sequence + '-' + t.x1 + '-' + t.y1) {
          <rect
            [attr.x]="Math.min(t.x1, t.x2)"
            [attr.y]="Math.min(t.y1, t.y2)"
            [attr.width]="Math.abs(t.x2 - t.x1)"
            [attr.height]="Math.abs(t.y2 - t.y1)"
            fill="transparent"
            [attr.stroke]="selectedSequence === t.sequence ? '#fbbf24' : '#ef4444'"
            [attr.stroke-width]="selectedSequence === t.sequence ? 3 : 2"
            vector-effect="non-scaling-stroke"
            class="cursor-pointer" />
          <text
            [attr.x]="Math.min(t.x1, t.x2) + 2"
            [attr.y]="Math.min(t.y1, t.y2) - 4"
            fill="#ef4444"
            font-size="18"
            font-weight="700"
            class="pointer-events-none select-none">
            {{ t.sequence }}
          </text>
        }
      </svg>
    }
  `
})
export class MangaSubtitleOverlayComponent {
  @Input() visible = false;
  @Input() texts: NormalizedSubtitleText[] = [];
  @Input() imageWidth = 1;
  @Input() imageHeight = 1;
  @Input() selectedSequence: number | null = null;
  @Output() selectText = new EventEmitter<NormalizedSubtitleText>();

  Math = Math;

  onSvgClick(event: MouseEvent): void {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * this.imageWidth;
    const y = ((event.clientY - rect.top) / rect.height) * this.imageHeight;
    const hit = hitTestSubtitleText(this.texts, x, y);
    if (hit) {
      event.stopPropagation();
      this.selectText.emit(hit);
    }
  }
}
