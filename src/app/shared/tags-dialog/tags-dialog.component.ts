import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../core/services/electron.service';
import { Tag } from '../../core/models';
import { TeleportToBodyDirective } from '../directives/teleport-to-body.directive';

@Component({
  selector: 'app-tags-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TeleportToBodyDirective],
  template: `
    @if (open) {
      <div
        appTeleportToBody
        class="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in"
        (click)="cancel.emit()">
        <div
          class="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up"
          (click)="$event.stopPropagation()">
          
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
            <div class="flex items-center gap-3">
              <div 
                class="w-9 h-9 rounded-xl flex items-center justify-center text-lg border shadow-inner"
                [ngClass]="headerBadgeClass">
                🏷️
              </div>
              <div>
                <h3 class="text-sm font-bold text-slate-100">Gerenciar Tags</h3>
                <p class="text-[11px] text-slate-400 mt-0.5 truncate max-w-[16rem]" [title]="title">
                  {{ title || 'Selecionar tags' }}
                </p>
              </div>
            </div>
            <button
              type="button"
              (click)="cancel.emit()"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fechar">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
            <!-- Add New Tag Input -->
            <div>
              <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Nova Tag
              </label>
              <form (ngSubmit)="onAddTag()" class="flex gap-2">
                <div class="relative flex-1">
                  <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                    #
                  </span>
                  <input
                    type="text"
                    [(ngModel)]="newTagName"
                    name="newTagName"
                    placeholder="Nome da tag..."
                    maxlength="50"
                    class="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-7 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1"
                    [class.focus:ring-primary-500]="accent === 'primary'"
                    [class.focus:border-primary-500]="accent === 'primary'"
                    [class.focus:ring-book-500]="accent === 'amber' || accent === 'book'"
                    [class.focus:border-book-500]="accent === 'amber' || accent === 'book'"
                    [class.focus:ring-manga-500]="accent === 'indigo' || accent === 'manga'"
                    [class.focus:border-manga-500]="accent === 'indigo' || accent === 'manga'" />
                </div>
                <button
                  type="submit"
                  [disabled]="!newTagName().trim()"
                  class="px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md cursor-pointer flex items-center gap-1 shrink-0"
                  [ngClass]="addBtnClass">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                  </svg>
                  Adicionar
                </button>
              </form>
              @if (error()) {
                <p class="mt-1 text-[11px] text-rose-400 font-medium">{{ error() }}</p>
              }
            </div>

            <!-- Selected Tags Badges Preview -->
            @if (selectedTagsList().length > 0) {
              <div class="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Tags Vinculadas ({{ selectedTagsList().length }})
                  </span>
                  <button
                    type="button"
                    (click)="clearAllSelected()"
                    class="text-[10px] text-slate-500 hover:text-rose-400 transition-colors">
                    Limpar todas
                  </button>
                </div>
                <div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                  @for (tag of selectedTagsList(); track tag) {
                    <span 
                      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold border shadow-sm transition-all"
                      [ngClass]="tagBadgeClass">
                      <span>{{ tag }}</span>
                      <button 
                        type="button" 
                        (click)="toggleTag(tag)" 
                        class="hover:text-white rounded-full p-0.5 hover:bg-slate-800/50 transition-colors"
                        title="Desmarcar">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </span>
                  }
                </div>
              </div>
            }

            <!-- Tags List Section -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Todas as Tags ({{ allTags().length }})
                </label>
                @if (allTags().length > 5) {
                  <input
                    type="text"
                    [(ngModel)]="searchFilter"
                    placeholder="Filtrar..."
                    class="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none w-28" />
                }
              </div>

              <div class="border border-slate-800 rounded-xl bg-slate-950/40 divide-y divide-slate-800/60 overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                @if (filteredTags().length === 0) {
                  <div class="p-6 text-center text-slate-500 text-xs">
                    @if (allTags().length === 0) {
                      Nenhuma tag cadastrada ainda.<br />Digite uma tag acima para começar!
                    } @else {
                      Nenhuma tag corresponde ao filtro.
                    }
                  </div>
                }

                @for (tag of filteredTags(); track tag.id ?? tag.name) {
                  <div 
                    class="flex items-center justify-between px-3 py-2.5 hover:bg-slate-800/40 transition-colors group cursor-pointer select-none"
                    (click)="toggleTag(tag.name)">
                    <div class="flex items-center gap-2.5 min-w-0 flex-1">
                      <div 
                        class="w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0"
                        [ngClass]="tagSelectedCheckboxClass(tag.name)">
                        @if (isTagSelected(tag.name)) {
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                          </svg>
                        }
                      </div>
                      <span 
                        class="text-xs font-medium truncate transition-colors"
                        [ngClass]="tagSelectedTextClass(tag.name)">
                        {{ tag.name }}
                      </span>
                    </div>

                    @if (tag.id) {
                      <button
                        type="button"
                        (click)="onDeleteGlobalTag($event, tag)"
                        class="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all shrink-0"
                        title="Excluir tag globalmente">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    }
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-5 py-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              (click)="cancel.emit()"
              class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 transition-colors cursor-pointer">
              Cancelar
            </button>
            <button
              type="button"
              (click)="onConfirm()"
              class="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              [ngClass]="confirmBtnClass">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              Confirmar
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class TagsDialogComponent implements OnChanges {
  private electron = inject(ElectronService);

  @Input() open = false;
  @Input() title = '';
  @Input() initialTags: string[] | string | null | undefined = [];
  @Input() accent: 'primary' | 'amber' | 'indigo' | 'manga' | 'book' = 'primary';

  @Output() confirm = new EventEmitter<string[]>();
  @Output() cancel = new EventEmitter<void>();

  allTags = signal<Tag[]>([]);
  selectedTags = signal<Set<string>>(new Set());
  newTagName = signal<string>('');
  searchFilter = signal<string>('');
  error = signal<string>('');

  selectedTagsList = computed(() => Array.from(this.selectedTags()));

  get headerBadgeClass(): string {
    if (this.accent === 'amber' || this.accent === 'book') return 'bg-book-500/10 text-book-400 border-book-500/20';
    if (this.accent === 'indigo' || this.accent === 'manga') return 'bg-manga-500/10 text-manga-400 border-manga-500/20';
    return 'bg-primary-500/10 text-primary-400 border-primary-500/20';
  }

  get addBtnClass(): string {
    if (this.accent === 'amber' || this.accent === 'book') return 'bg-book-600 hover:bg-book-500 shadow-book-600/20';
    if (this.accent === 'indigo' || this.accent === 'manga') return 'bg-manga-600 hover:bg-manga-500 shadow-manga-600/20';
    return 'bg-primary-600 hover:bg-primary-500 shadow-primary-600/20';
  }

  get tagBadgeClass(): string {
    if (this.accent === 'amber' || this.accent === 'book') return 'bg-book-950/70 text-book-300 border-book-800/60';
    if (this.accent === 'indigo' || this.accent === 'manga') return 'bg-manga-950/70 text-manga-300 border-manga-800/60';
    return 'bg-primary-950/70 text-primary-300 border-primary-800/60';
  }

  tagSelectedCheckboxClass(tagName: string): string {
    if (!this.isTagSelected(tagName)) return 'border-slate-700 bg-slate-900 group-hover:border-slate-500';
    if (this.accent === 'amber' || this.accent === 'book') return 'bg-book-500 border-book-500 text-slate-950';
    if (this.accent === 'indigo' || this.accent === 'manga') return 'bg-manga-600 border-manga-600 text-white';
    return 'bg-primary-600 border-primary-600 text-white';
  }

  tagSelectedTextClass(tagName: string): string {
    if (!this.isTagSelected(tagName)) return 'text-slate-200';
    if (this.accent === 'amber' || this.accent === 'book') return 'text-book-300';
    if (this.accent === 'indigo' || this.accent === 'manga') return 'text-manga-300';
    return 'text-primary-300';
  }

  get confirmBtnClass(): string {
    if (this.accent === 'amber' || this.accent === 'book') return 'bg-book-600 hover:bg-book-500 shadow-book-600/25';
    if (this.accent === 'indigo' || this.accent === 'manga') return 'bg-manga-600 hover:bg-manga-500 shadow-manga-600/25';
    return 'bg-primary-600 hover:bg-primary-500 shadow-primary-600/25';
  }

  filteredTags = computed(() => {
    const filter = this.searchFilter().trim().toLowerCase();
    const tags = this.allTags();
    if (!filter) return tags;
    return tags.filter(t => t.name.toLowerCase().includes(filter));
  });

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['open'] && this.open) {
      this.error.set('');
      this.newTagName.set('');
      this.searchFilter.set('');
      await this.loadAllTags();
      this.initSelectedTags();
    }
  }

  private async loadAllTags(): Promise<void> {
    try {
      const tags = await this.electron.getTags();
      this.allTags.set(tags || []);
    } catch (e) {
      console.error('[TagsDialog] Error loading tags', e);
    }
  }

  private initSelectedTags(): void {
    const set = new Set<string>();
    if (Array.isArray(this.initialTags)) {
      this.initialTags.forEach(t => {
        if (t && t.trim()) set.add(t.trim());
      });
    } else if (typeof this.initialTags === 'string' && this.initialTags.trim()) {
      this.initialTags
        .split(/[,;]/)
        .map(t => t.trim())
        .filter(Boolean)
        .forEach(t => set.add(t));
    }
    this.selectedTags.set(set);
  }

  isTagSelected(name: string): boolean {
    return this.selectedTags().has(name);
  }

  toggleTag(name: string): void {
    const set = new Set(this.selectedTags());
    if (set.has(name)) {
      set.delete(name);
    } else {
      set.add(name);
    }
    this.selectedTags.set(set);
  }

  clearAllSelected(): void {
    this.selectedTags.set(new Set());
  }

  async onAddTag(): Promise<void> {
    const name = this.newTagName().trim();
    if (!name) return;

    this.error.set('');
    try {
      const saved = await this.electron.saveTag(name);
      if (saved) {
        const current = [...this.allTags()];
        if (!current.some(t => t.name.toLowerCase() === saved.name.toLowerCase())) {
          current.push(saved);
          current.sort((a, b) => a.name.localeCompare(b.name));
          this.allTags.set(current);
        }
        // Auto-select newly added tag
        const set = new Set(this.selectedTags());
        set.add(saved.name);
        this.selectedTags.set(set);
        this.newTagName.set('');
      }
    } catch (err: any) {
      this.error.set(err?.message || 'Erro ao adicionar tag');
    }
  }

  async onDeleteGlobalTag(event: Event, tag: Tag): Promise<void> {
    event.stopPropagation();
    if (!tag.id) return;

    try {
      const ok = await this.electron.deleteTag(tag.id);
      if (ok) {
        this.allTags.set(this.allTags().filter(t => t.id !== tag.id));
        // Also remove from selected set if present
        const set = new Set(this.selectedTags());
        set.delete(tag.name);
        this.selectedTags.set(set);
      }
    } catch (e) {
      console.error('[TagsDialog] Error deleting tag', e);
    }
  }

  onConfirm(): void {
    this.confirm.emit(this.selectedTagsList());
  }
}
