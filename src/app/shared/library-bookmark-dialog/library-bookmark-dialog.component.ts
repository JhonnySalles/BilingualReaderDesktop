import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { clampBookMark } from '../../core/utils/reading-progress.util';
import { SettingsService } from '../../core/services/settings.service';
import { ElectronService } from '../../core/services/electron.service';

export interface LibraryBookmarkPayload {
  /** 1-based page in [1, pages], or 0 if cleared (not used by dialog save). */
  page: number;
  /** ISO datetime combining date + time. */
  lastAccess: string;
  completed: boolean;
  secondsRead: number;
  secondsReadAutomatic: boolean;
  wordCount?: number;
}

@Component({
  selector: 'app-library-bookmark-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (open) {
      <div
        class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
        (click)="cancel.emit()">
        <div
          class="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col"
          (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div>
              <h3 class="text-sm font-bold text-slate-100">Marcador de leitura</h3>
              <p class="text-[11px] text-slate-400 mt-0.5 truncate max-w-[16rem]" [title]="title">
                {{ title || 'Definir progresso' }}
              </p>
            </div>
            <button
              type="button"
              (click)="cancel.emit()"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
              title="Fechar">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div class="p-5 space-y-4">
            <div>
              <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Página (1 a {{ maxPages }})
              </label>
              <input
                type="number"
                min="1"
                [max]="maxPages"
                [(ngModel)]="localPage"
                (ngModelChange)="onPageChange($event)"
                class="w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-1"
                [class.border-slate-700]="!errors().page"
                [class.border-amber-500]="!!errors().page"
                [class.focus:ring-indigo-500]="accent === 'indigo'"
                [class.focus:border-indigo-500]="accent === 'indigo'"
                [class.focus:ring-amber-500]="accent === 'amber'"
                [class.focus:border-amber-500]="accent === 'amber'" />
              @if (errors().page) {
                <p class="mt-1 text-[11px] text-amber-300">{{ errors().page }}</p>
              }
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Data
                </label>
                <input
                  type="date"
                  [(ngModel)]="localDate"
                  class="w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-1"
                  [class.border-slate-700]="!errors().date"
                  [class.border-amber-500]="!!errors().date"
                  [class.focus:ring-indigo-500]="accent === 'indigo'"
                  [class.focus:border-indigo-500]="accent === 'indigo'"
                  [class.focus:ring-amber-500]="accent === 'amber'"
                  [class.focus:border-amber-500]="accent === 'amber'" />
                @if (errors().date) {
                  <p class="mt-1 text-[11px] text-amber-300">{{ errors().date }}</p>
                }
              </div>
              <div>
                <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Hora
                </label>
                <input
                  type="time"
                  [(ngModel)]="localTime"
                  class="w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-1"
                  [class.border-slate-700]="!errors().time"
                  [class.border-amber-500]="!!errors().time"
                  [class.focus:ring-indigo-500]="accent === 'indigo'"
                  [class.focus:border-indigo-500]="accent === 'indigo'"
                  [class.focus:ring-amber-500]="accent === 'amber'"
                  [class.focus:border-amber-500]="accent === 'amber'" />
                @if (errors().time) {
                  <p class="mt-1 text-[11px] text-amber-300">{{ errors().time }}</p>
                }
              </div>
            </div>

            <!-- Reading Time (Hours, Minutes, Seconds) + Auto Calculate -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Tempo de Leitura
                </label>
                <button
                  type="button"
                  (click)="autoCalculateTime()"
                  class="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  title="Recalcular automaticamente baseado na velocidade média">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Auto Calcular</span>
                </button>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div>
                  <div class="relative">
                    <input
                      type="number"
                      min="0"
                      [(ngModel)]="localHours"
                      (ngModelChange)="onTimeFieldChange()"
                      placeholder="0"
                      class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 pr-7 focus:outline-none focus:ring-1"
                      [class.focus:ring-indigo-500]="accent === 'indigo'"
                      [class.focus:border-indigo-500]="accent === 'indigo'"
                      [class.focus:ring-amber-500]="accent === 'amber'"
                      [class.focus:border-amber-500]="accent === 'amber'" />
                    <span class="absolute right-2.5 top-2 text-xs text-slate-500 font-medium">h</span>
                  </div>
                </div>
                <div>
                  <div class="relative">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      [(ngModel)]="localMinutes"
                      (ngModelChange)="onTimeFieldChange()"
                      placeholder="0"
                      class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 pr-7 focus:outline-none focus:ring-1"
                      [class.focus:ring-indigo-500]="accent === 'indigo'"
                      [class.focus:border-indigo-500]="accent === 'indigo'"
                      [class.focus:ring-amber-500]="accent === 'amber'"
                      [class.focus:border-amber-500]="accent === 'amber'" />
                    <span class="absolute right-2.5 top-2 text-xs text-slate-500 font-medium">m</span>
                  </div>
                </div>
                <div>
                  <div class="relative">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      [(ngModel)]="localSeconds"
                      (ngModelChange)="onTimeFieldChange()"
                      placeholder="0"
                      class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 pr-7 focus:outline-none focus:ring-1"
                      [class.focus:ring-indigo-500]="accent === 'indigo'"
                      [class.focus:border-indigo-500]="accent === 'indigo'"
                      [class.focus:ring-amber-500]="accent === 'amber'"
                      [class.focus:border-amber-500]="accent === 'amber'" />
                    <span class="absolute right-2.5 top-2 text-xs text-slate-500 font-medium">s</span>
                  </div>
                </div>
              </div>
              <p class="text-[10px] text-slate-500 mt-1">
                {{ isManualEdit ? 'Modificado manualmente' : 'Estimativa automática' }}
              </p>
            </div>

            <label class="flex items-center justify-between gap-3 cursor-pointer select-none rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
              <div>
                <p class="text-sm font-semibold text-slate-100">Concluído</p>
                <p class="text-[11px] text-slate-500">Marca a obra como lida por completo</p>
              </div>
              <input
                type="checkbox"
                class="w-4 h-4 rounded accent-indigo-600"
                [class.accent-amber-600]="accent === 'amber'"
                [ngModel]="localCompleted"
                (ngModelChange)="onCompletedChange($event)" />
            </label>
          </div>

          <div class="px-5 py-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              (click)="markAsRead()"
              class="px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer border"
              [ngClass]="accent === 'indigo'
                ? 'border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/15'
                : 'border-amber-500/40 text-amber-300 hover:bg-amber-600/15'">
              Marcar como lido
            </button>
            <div class="flex gap-2">
              <button
                type="button"
                (click)="cancel.emit()"
                class="px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer">
                Cancelar
              </button>
              <button
                type="button"
                (click)="onSave()"
                class="px-3 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
                [ngClass]="accent === 'indigo' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-amber-600 hover:bg-amber-500'">
                Salvar
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class LibraryBookmarkDialogComponent implements OnChanges {
  private settings = inject(SettingsService);
  private electron = inject(ElectronService);

  @Input() open = false;
  @Input() title = '';
  @Input() type: 'manga' | 'book' = 'manga';
  @Input() filePath?: string | null;
  @Input() maxPages = 1;
  /** Current 1-based bookmark (0 = unread). */
  @Input() pageValue = 0;
  @Input() lastAccess?: string | null;
  @Input() completed = false;
  @Input() accent: 'indigo' | 'amber' = 'indigo';

  @Output() confirm = new EventEmitter<LibraryBookmarkPayload>();
  @Output() cancel = new EventEmitter<void>();

  localPage = 1;
  localDate = '';
  localTime = '';
  localHours = 0;
  localMinutes = 0;
  localSeconds = 0;
  localCompleted = false;
  isManualEdit = false;
  cachedWordCount = 0;
  errors = signal<{ page?: string; date?: string; time?: string }>({});

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] || changes['pageValue'] || changes['lastAccess'] || changes['completed'] || changes['maxPages']) {
      if (this.open) {
        this.initFromInputs();
      }
    }
  }

  private async initFromInputs(): Promise<void> {
    if (this.type === 'book' && (!this.maxPages || this.maxPages <= 1) && this.filePath) {
      if (this.cachedWordCount <= 0) {
        this.cachedWordCount = await this.electron.countBookWords(this.filePath);
      }
      if (this.cachedWordCount > 0) {
        this.maxPages = Math.max(1, Math.ceil(this.cachedWordCount / 250));
      }
    }

    const max = Math.max(1, this.maxPages || 1);
    let page = clampBookMark(this.pageValue, max);
    // Android: if unread (<=0), suggest end page
    if (page <= 0) page = max;
    this.localPage = page;
    this.localCompleted = !!this.completed || page >= max;

    const when = this.parseAccess(this.lastAccess) ?? new Date();
    this.localDate = this.formatDate(when);
    this.localTime = this.formatTime(when);
    this.errors.set({});
    this.isManualEdit = false;

    await this.calculateEstimatedTime();
  }

  private async calculateEstimatedTime(): Promise<void> {
    const max = Math.max(1, this.maxPages || 1);
    const page = clampBookMark(this.localPage, max);
    const prevPage = this.pageValue > 0 ? this.pageValue : 0;
    const pagesDelta = Math.max(1, page > prevPage ? page - prevPage : page);

    let totalSeconds = 0;
    if (this.type === 'manga') {
      const avgPerPage = this.settings.mangaAvgTimePerPage() || 120;
      totalSeconds = Math.round(pagesDelta * avgPerPage);
    } else {
      const avgPerWord = this.settings.bookAvgTimePerWord() || 0.24;
      if (this.cachedWordCount <= 0 && this.filePath) {
        this.cachedWordCount = await this.electron.countBookWords(this.filePath);
      }
      let words = this.cachedWordCount;
      if (words > 0 && max > 0 && pagesDelta < max) {
        words = Math.round((words / max) * pagesDelta);
      }
      if (words <= 0) {
        words = pagesDelta * 250;
      }
      totalSeconds = Math.round(words * avgPerWord);
    }

    this.setTimeFieldsFromSeconds(totalSeconds);
  }

  private setTimeFieldsFromSeconds(totalSeconds: number): void {
    const s = Math.max(0, totalSeconds);
    this.localHours = Math.floor(s / 3600);
    this.localMinutes = Math.floor((s % 3600) / 60);
    this.localSeconds = s % 60;
  }

  private getTotalSeconds(): number {
    const h = Math.max(0, Number(this.localHours) || 0);
    const m = Math.max(0, Math.min(59, Number(this.localMinutes) || 0));
    const s = Math.max(0, Math.min(59, Number(this.localSeconds) || 0));
    return h * 3600 + m * 60 + s;
  }

  onPageChange(value: number): void {
    const max = Math.max(1, this.maxPages || 1);
    const page = clampBookMark(Number(value), max);
    this.localPage = page > 0 ? page : 1;
    if (this.localPage >= max) {
      this.localCompleted = true;
    }
    if (!this.isManualEdit) {
      void this.calculateEstimatedTime();
    }
  }

  onTimeFieldChange(): void {
    this.isManualEdit = true;
  }

  async autoCalculateTime(): Promise<void> {
    this.isManualEdit = false;
    await this.calculateEstimatedTime();
  }

  onCompletedChange(checked: boolean): void {
    this.localCompleted = checked;
    if (checked) {
      this.localPage = Math.max(1, this.maxPages || 1);
    }
    if (!this.isManualEdit) {
      void this.calculateEstimatedTime();
    }
  }

  markAsRead(): void {
    const max = Math.max(1, this.maxPages || 1);
    this.localPage = max;
    this.localCompleted = true;
    this.errors.set({});
    if (!this.isManualEdit) {
      void this.calculateEstimatedTime();
    }
  }

  onSave(): void {
    if (!this.validate()) return;
    const iso = this.toIso(this.localDate, this.localTime);
    if (!iso) {
      this.errors.update(e => ({ ...e, date: 'Data/hora inválidas' }));
      return;
    }
    const max = Math.max(1, this.maxPages || 1);
    const page = clampBookMark(this.localPage, max);
    const secondsRead = this.getTotalSeconds();

    this.confirm.emit({
      page,
      lastAccess: iso,
      completed: this.localCompleted,
      secondsRead,
      secondsReadAutomatic: !this.isManualEdit,
      wordCount: this.cachedWordCount > 0 ? this.cachedWordCount : undefined
    });
  }

  private validate(): boolean {
    const max = Math.max(1, this.maxPages || 1);
    const next: { page?: string; date?: string; time?: string } = {};
    const page = Number(this.localPage);
    if (!Number.isFinite(page) || !Number.isInteger(page)) {
      next.page = 'Informe um número de página válido';
    } else if (page < 1 || page > max) {
      next.page = `A página deve estar entre 1 e ${max}`;
    }
    if (!this.localDate?.trim()) next.date = 'Informe a data';
    if (!this.localTime?.trim()) next.time = 'Informe a hora';
    this.errors.set(next);
    return Object.keys(next).length === 0;
  }

  private parseAccess(value?: string | null): Date | null {
    if (!value?.trim()) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private formatTime(d: Date): string {
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  }

  private toIso(dateStr: string, timeStr: string): string | null {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hh, mm] = timeStr.split(':').map(Number);
    if (![y, m, d, hh, mm].every(n => Number.isFinite(n))) return null;
    const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  }
}
