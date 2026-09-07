import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LibrarySearchScope,
  LibrarySearchSuggestion,
  LibrarySearchToken
} from '../../core/models/library-search.model';
import { LibrarySearchService } from '../../core/services/library-search.service';
import { replaceLastAtSegment } from '../../core/utils/library-search.parser';

@Component({
  selector: 'app-search-suggest-field',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="relative flex flex-col gap-1.5" [class.w-full]="fullWidth">
      <div
        class="relative transition-all duration-300"
        [class.w-48]="!focused() && !fullWidth"
        [class.sm:w-64]="!focused() && !fullWidth"
        [class.w-72]="focused() && !fullWidth"
        [class.sm:w-96]="focused() && !fullWidth"
        [class.w-full]="fullWidth">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        <input
          #inputEl
          type="text"
          [ngModel]="displayValue()"
          (ngModelChange)="onInput($event)"
          (focus)="onFocus()"
          (blur)="onBlur()"
          (keydown)="onKeydown($event)"
          [placeholder]="placeholder"
          autocomplete="off"
          spellcheck="false"
          class="w-full pl-9 pr-8 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-200
            placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/80
            transition-all shadow-sm" />

        @if (displayValue()) {
          <button
            type="button"
            (mousedown)="$event.preventDefault(); clear()"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-500 hover:text-slate-200 cursor-pointer"
            title="Limpar">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        }
      </div>

      @if (tokens().length > 0) {
        <div class="flex flex-wrap gap-1 max-w-full">
          @for (t of tokens(); track t.index + t.raw) {
            <span
              class="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-lg text-[10px] font-semibold
                bg-indigo-600/15 text-indigo-300 border border-indigo-500/30">
              <span class="truncate">{{ t.label }}: {{ t.value }}</span>
              <button
                type="button"
                (click)="removeToken(t)"
                class="shrink-0 hover:text-white cursor-pointer leading-none"
                title="Remover filtro">
                ×
              </button>
            </span>
          }
        </div>
      }
    </div>

    <!-- Teleported to document.body so layout overflow/stacking cannot clip it -->
    @if (open() && suggestions().length > 0) {
      <div
        #dropdownEl
        class="fixed z-[200] max-h-64 overflow-y-auto
          bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-xl shadow-2xl
          ring-1 ring-black/20 animate-fade-in"
        [style.top.px]="dropdownPos().top"
        [style.left.px]="dropdownPos().left"
        [style.width.px]="dropdownPos().width"
        role="listbox">
        <ul class="py-1.5">
          @for (s of suggestions(); track s.insertText + s.label; let i = $index) {
            <li>
              <button
                type="button"
                role="option"
                [attr.aria-selected]="i === activeIndex()"
                (mousedown)="onSuggestionMouseDown($event, s)"
                class="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors cursor-pointer hover:bg-slate-800"
                [ngClass]="i === activeIndex() ? 'bg-indigo-600/15 text-indigo-200' : 'text-slate-200'">
                @if (s.kind === 'type') {
                  <span class="font-bold text-indigo-400 shrink-0">&#64;</span>
                  <span class="truncate font-medium">{{ s.label.replace('@', '') }}</span>
                  <span class="ml-auto text-[10px] uppercase tracking-wider text-slate-500">filtro</span>
                } @else {
                  <span class="w-1.5 h-1.5 rounded-full bg-indigo-500/80 shrink-0"></span>
                  <span class="truncate font-mono text-[11px]">{{ s.label }}</span>
                }
              </button>
            </li>
          }
        </ul>
        <div class="px-3 py-2 border-t border-slate-800/80 text-[10px] text-slate-500 leading-snug">
          Use &#64;Tipo:"texto" · vários &#64; combinam com E
        </div>
      </div>
    }
  `
})
export class SearchSuggestFieldComponent implements OnChanges, OnDestroy {
  private readonly searchService = inject(LibrarySearchService);
  private readonly host = inject(ElementRef<HTMLElement>);

  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement>;

  private dropdownNode: HTMLElement | null = null;

  @ViewChild('dropdownEl')
  set dropdownEl(ref: ElementRef<HTMLElement> | undefined) {
    if (this.dropdownNode && this.dropdownNode.parentElement === document.body) {
      this.dropdownNode.remove();
      this.dropdownNode = null;
    }
    if (ref?.nativeElement) {
      this.dropdownNode = ref.nativeElement;
      document.body.appendChild(this.dropdownNode);
      this.updateDropdownPosition();
    }
  }

  @Input() value = '';
  @Input() scope: LibrarySearchScope = 'manga';
  @Input() placeholder = 'Pesquisar ou @Autor:';
  @Input() fullWidth = false;
  /** Debounced value used for filtering (skips while typing incomplete @). */
  @Output() valueChange = new EventEmitter<string>();
  /** Immediate raw value (for chips / controlled input). */
  @Output() rawChange = new EventEmitter<string>();

  focused = signal(false);
  open = signal(false);
  suggestions = signal<LibrarySearchSuggestion[]>([]);
  activeIndex = signal(0);
  tokens = signal<LibrarySearchToken[]>([]);
  dropdownPos = signal({ top: 0, left: 0, width: 240 });

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private blurTimer: ReturnType<typeof setTimeout> | null = null;
  /** Last query that was committed for filtering (when not paused). */
  private lastCommitted = '';

  /** Local mirror so typing feels instant even before parent signal updates. */
  displayValue = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.displayValue.set(this.value ?? '');
    }
    if (changes['value'] || changes['scope']) {
      this.refreshSuggestions(this.value);
      this.refreshTokens(this.value);
    }
  }

  ngOnDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.blurTimer) clearTimeout(this.blurTimer);
    this.detachDropdown();
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(ev: MouseEvent): void {
    const target = ev.target as Node;
    const inHost = this.host.nativeElement.contains(target);
    const inDropdown = this.dropdownNode?.contains(target) ?? false;
    if (!inHost && !inDropdown) {
      this.open.set(false);
    }
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onViewportChange(): void {
    if (this.open()) {
      this.updateDropdownPosition();
    }
  }

  onFocus(): void {
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
    this.focused.set(true);
    this.refreshSuggestions(this.displayValue());
    if (this.suggestions().length > 0) {
      this.showDropdown();
    }
  }

  onBlur(): void {
    this.blurTimer = setTimeout(() => {
      this.focused.set(false);
      this.open.set(false);
    }, 150);
  }

  onInput(next: string): void {
    this.displayValue.set(next);
    this.rawChange.emit(next);
    this.refreshSuggestions(next);
    this.refreshTokens(next);

    if (this.suggestions().length > 0 && next.includes('@')) {
      this.showDropdown();
      this.activeIndex.set(0);
    } else if (!next.includes('@') || this.suggestions().length === 0) {
      this.open.set(false);
    }

    this.scheduleCommit(next);
  }

  onKeydown(ev: KeyboardEvent): void {
    if (!this.open() || this.suggestions().length === 0) {
      if (ev.key === 'Escape') {
        this.open.set(false);
      }
      return;
    }

    const list = this.suggestions();
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.activeIndex.update(i => (i + 1) % list.length);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.activeIndex.update(i => (i - 1 + list.length) % list.length);
    } else if (ev.key === 'Enter' || ev.key === 'Tab') {
      ev.preventDefault();
      const s = list[this.activeIndex()];
      if (s) this.selectSuggestion(s);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      this.open.set(false);
    }
  }

  onSuggestionMouseDown(ev: MouseEvent, s: LibrarySearchSuggestion): void {
    ev.preventDefault();
    this.selectSuggestion(s);
  }

  selectSuggestion(s: LibrarySearchSuggestion): void {
    const next = replaceLastAtSegment(this.displayValue(), s.insertText);
    this.displayValue.set(next);
    this.rawChange.emit(next);
    this.refreshSuggestions(next);
    this.refreshTokens(next);

    if (s.kind === 'type') {
      this.showDropdown();
      this.activeIndex.set(0);
      this.scheduleCommit(next, true);
    } else {
      this.open.set(false);
      this.commitNow(next);
    }

    queueMicrotask(() => {
      const el = this.inputEl?.nativeElement;
      if (el) {
        el.focus();
        el.setSelectionRange(next.length, next.length);
      }
    });
  }

  removeToken(token: LibrarySearchToken): void {
    const next = this.searchService.removeToken(this.displayValue(), token);
    this.displayValue.set(next);
    this.rawChange.emit(next);
    this.refreshSuggestions(next);
    this.refreshTokens(next);
    this.commitNow(next);
  }

  clear(): void {
    this.displayValue.set('');
    this.rawChange.emit('');
    this.suggestions.set([]);
    this.tokens.set([]);
    this.open.set(false);
    this.commitNow('');
  }

  private showDropdown(): void {
    this.updateDropdownPosition();
    this.open.set(true);
    queueMicrotask(() => this.updateDropdownPosition());
  }

  private updateDropdownPosition(): void {
    const el = this.inputEl?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const maxHeight = 256;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const openUpward = spaceBelow < 120 && rect.top > spaceBelow;
    const width = Math.max(rect.width, 220);
    const top = openUpward
      ? Math.max(8, rect.top - Math.min(maxHeight, rect.top - 8) - gap)
      : rect.bottom + gap;

    this.dropdownPos.set({
      top,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      width
    });
  }

  private detachDropdown(): void {
    if (this.dropdownNode?.parentElement === document.body) {
      this.dropdownNode.remove();
    }
    this.dropdownNode = null;
  }

  private refreshSuggestions(query: string): void {
    const list = this.searchService.getSuggestions(query, this.scope);
    this.suggestions.set(list);
  }

  private refreshTokens(query: string): void {
    const parsed = this.searchService.parse(query, this.scope);
    this.tokens.set(parsed.tokens);
  }

  private scheduleCommit(query: string, forcePause = false): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const paused = forcePause || this.searchService.shouldPauseFiltering(query);
    if (paused) {
      return;
    }

    this.debounceTimer = setTimeout(() => {
      this.commitNow(query);
    }, this.searchService.debounceMs);
  }

  private commitNow(query: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.searchService.shouldPauseFiltering(query) && query.includes('@')) {
      return;
    }
    this.lastCommitted = query;
    this.valueChange.emit(query);
  }
}
