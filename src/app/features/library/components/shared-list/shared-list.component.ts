import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Manga, Book, LibraryViewType } from '../../../../core/models';
import { MangaCardComponent } from '../../manga-library/components/manga-card/manga-card.component';
import { MangaListItemComponent } from '../../manga-library/components/manga-list-item/manga-list-item.component';
import { BookCardComponent } from '../book-card/book-card.component';
import { LibraryStateService } from '../../../../core/services/library-state.service';

@Component({
  selector: 'app-shared-list',
  standalone: true,
  imports: [
    CommonModule,
    MangaCardComponent,
    MangaListItemComponent,
    BookCardComponent
  ],
  template: `
    <div class="w-full h-full">
      
      <!-- GRID VIEW MODE -->
      @if (libraryStateService.currentView() !== LibraryViewType.LINE) {
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-5 transition-all duration-300">
          @for (item of items; track getItemKey(item); let index = $index) {
            <div 
              draggable="true"
              (dragstart)="onDragStart($event, index)"
              (dragover)="onDragOver($event, index)"
              (drop)="onDrop($event, index)"
              (dragend)="onDragEnd()"
              [class.opacity-40]="draggedIndex() === index"
              [class.scale-105]="draggedIndex() === index"
              [class.border-2]="dragOverIndex() === index"
              [class.border-indigo-500]="dragOverIndex() === index"
              class="cursor-grab active:cursor-grabbing transition-all duration-200 rounded-xl overflow-hidden animate-fade-in-up">

              @if (type === 'manga') {
                <app-manga-card [manga]="$any(item)"></app-manga-card>
              } @else {
                <app-book-card [book]="$any(item)"></app-book-card>
              }
            </div>
          }
        </div>
      }

      <!-- LIST VIEW MODE -->
      @if (libraryStateService.currentView() === LibraryViewType.LINE) {
        <div class="flex flex-col gap-2 transition-all duration-300">
          @for (item of items; track getItemKey(item); let index = $index) {
            <div 
              draggable="true"
              (dragstart)="onDragStart($event, index)"
              (dragover)="onDragOver($event, index)"
              (drop)="onDrop($event, index)"
              (dragend)="onDragEnd()"
              [class.opacity-40]="draggedIndex() === index"
              [class.border-l-4]="dragOverIndex() === index"
              [class.border-indigo-500]="dragOverIndex() === index"
              class="cursor-grab active:cursor-grabbing transition-all duration-200 rounded-lg animate-fade-in-up">

              @if (type === 'manga') {
                <app-manga-list-item [manga]="$any(item)"></app-manga-list-item>
              } @else {
                <!-- Generic List Row for Books -->
                <div class="group bg-slate-800/40 backdrop-blur-md rounded-lg p-2.5 border border-slate-700/40 hover:border-amber-500/40 hover:bg-slate-800/80 transition-all duration-200 cursor-pointer flex items-center justify-between gap-4">
                  <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div class="w-10 h-14 bg-slate-900 rounded overflow-hidden flex-shrink-0 relative border border-slate-700/50 flex items-center justify-center text-amber-400 font-bold text-xs">
                      EPUB
                    </div>
                    <div class="min-w-0">
                      <h4 class="text-sm font-medium text-slate-200 truncate group-hover:text-amber-400 transition-colors">
                        {{ item.title }}
                      </h4>
                      <p class="text-xs text-slate-400 truncate mt-0.5">
                        {{ item.author || 'Autor Desconhecido' }}
                      </p>
                    </div>
                  </div>
                  <div class="text-right text-xs text-slate-400 font-mono">
                    {{ item.pages || 0 }} págs
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }

    </div>
  `
})
export class SharedListComponent {
  @Input() items: (Manga | Book)[] = [];
  @Input() type: 'manga' | 'book' = 'manga';
  @Output() reordered = new EventEmitter<(Manga | Book)[]>();

  public libraryStateService = inject(LibraryStateService);
  LibraryViewType = LibraryViewType;

  draggedIndex = signal<number | null>(null);
  dragOverIndex = signal<number | null>(null);

  getItemKey(item: Manga | Book): string | number {
    return item.id || item.path || item.title;
  }

  onDragStart(event: DragEvent, index: number) {
    this.draggedIndex.set(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', index.toString());
    }
  }

  onDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    if (this.draggedIndex() !== index) {
      this.dragOverIndex.set(index);
    }
  }

  onDrop(event: DragEvent, dropIndex: number) {
    event.preventDefault();
    const fromIndex = this.draggedIndex();
    if (fromIndex !== null && fromIndex !== dropIndex) {
      const updated = [...this.items];
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(dropIndex, 0, movedItem);
      this.reordered.emit(updated);
    }
    this.onDragEnd();
  }

  onDragEnd() {
    this.draggedIndex.set(null);
    this.dragOverIndex.set(null);
  }
}
