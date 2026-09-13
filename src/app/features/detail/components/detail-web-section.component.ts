import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExternalTrackerMediaDetails, ExternalTrackerRelatedItem } from '../../../core/models';

@Component({
  selector: 'app-detail-web-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="space-y-4">
      <div class="flex items-center justify-between border-b border-slate-800 pb-2">
        <div class="flex items-center gap-2">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">
            Informações da Web
          </h3>
          @if (mediaDetails?.source === 'MAL') {
            <span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
              MyAnimeList
            </span>
          } @else if (mediaDetails?.source === 'ANILIST') {
            <span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-600/30 text-cyan-400 border border-cyan-500/40 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              AniList
            </span>
          }
        </div>

        @if (mediaDetails?.url) {
          <button
            type="button"
            (click)="openLink.emit(mediaDetails!.url!)"
            class="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer">
            <span>Abrir no {{ mediaDetails?.source === 'MAL' ? 'MyAnimeList' : 'AniList' }}</span>
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
          </button>
        }
      </div>

      @if (loading) {
        <div class="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 flex items-center justify-center gap-3 text-xs text-slate-400 animate-pulse">
          <div class="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
          Buscando detalhes sincronizados na web (MAL / AniList)...
        </div>
      } @else if (!mediaDetails) {
        <div class="p-6 rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 flex flex-col items-center justify-center gap-2 text-center">
          <p class="text-xs text-slate-400">Nenhuma informação web encontrada automaticamente.</p>
          <button
            type="button"
            (click)="searchManual.emit()"
            class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer">
            Vincular Rastreador
          </button>
        </div>
      } @else {
        <!-- Main Media Info Card -->
        <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 shadow-xl backdrop-blur-sm">
          <div class="flex flex-col sm:flex-row gap-4">
            @if (mediaDetails.coverImage) {
              <div class="w-24 sm:w-28 shrink-0 aspect-[2/3] rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-md">
                <img
                  [src]="mediaDetails.coverImage"
                  [alt]="mediaDetails.title"
                  class="w-full h-full object-cover" />
              </div>
            }

            <div class="flex-1 min-w-0 space-y-2.5">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div class="min-w-0">
                  <h4 class="text-base font-bold text-slate-100 leading-snug">{{ mediaDetails.title }}</h4>
                  @if (mediaDetails.authors && mediaDetails.authors.length > 0) {
                    <p class="text-xs text-slate-400 mt-0.5">Por: {{ mediaDetails.authors.join(', ') }}</p>
                  }
                </div>

                @if (mediaDetails.score != null) {
                  <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs shrink-0">
                    <svg class="w-3.5 h-3.5 text-amber-400 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                    </svg>
                    <span>{{ mediaDetails.score | number:'1.1-2' }}</span>
                  </div>
                }
              </div>

              <!-- Quick Info Badges -->
              <div class="flex flex-wrap items-center gap-1.5 text-[11px]">
                @if (mediaDetails.status) {
                  <span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60 font-medium">
                    {{ mediaDetails.status }}
                  </span>
                }
                @if (mediaDetails.mediaType) {
                  <span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60 font-medium uppercase">
                    {{ mediaDetails.mediaType }}
                  </span>
                }
                @if (mediaDetails.totalChapters) {
                  <span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60 font-medium">
                    {{ mediaDetails.totalChapters }} capítulos
                  </span>
                }
                @if (mediaDetails.totalVolumes) {
                  <span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60 font-medium">
                    {{ mediaDetails.totalVolumes }} volumes
                  </span>
                }
                @if (mediaDetails.published) {
                  <span class="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 font-normal">
                    {{ mediaDetails.published }}
                  </span>
                }
              </div>

              <!-- Genres chips -->
              @if (mediaDetails.genres && mediaDetails.genres.length > 0) {
                <div class="flex flex-wrap gap-1 pt-1">
                  @for (genre of mediaDetails.genres; track genre) {
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-950/60 text-indigo-300 border border-indigo-800/50">
                      {{ genre }}
                    </span>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Synopsis -->
          @if (mediaDetails.synopsis) {
            <div class="pt-2 border-t border-slate-800/80 text-xs text-slate-300 leading-relaxed space-y-1">
              <p [class.line-clamp-3]="!isSynopsisExpanded()">
                {{ mediaDetails.synopsis }}
              </p>
              @if (mediaDetails.synopsis.length > 220) {
                <button
                  type="button"
                  (click)="isSynopsisExpanded.set(!isSynopsisExpanded())"
                  class="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer text-[11px]">
                  {{ isSynopsisExpanded() ? 'Mostrar menos' : 'Mostrar mais' }}
                </button>
              }
            </div>
          }
        </div>

        <!-- Related Media List -->
        @if (mediaDetails.related && mediaDetails.related.length > 0) {
          <div class="space-y-3 pt-2">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400">
              Obras Relacionadas ({{ mediaDetails.related.length }})
            </h4>

            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              @for (rel of mediaDetails.related; track rel.id) {
                <div
                  (click)="rel.url ? openLink.emit(rel.url) : openRelated.emit(rel)"
                  class="group relative rounded-xl border border-slate-800 bg-slate-900/80 hover:border-indigo-500/80 hover:bg-slate-900 transition-all p-2 flex flex-col gap-2 cursor-pointer shadow-sm hover:shadow-md">
                  <div class="aspect-[2/3] rounded-lg overflow-hidden bg-slate-950 relative">
                    @if (rel.coverImage) {
                      <img
                        [src]="rel.coverImage"
                        [alt]="rel.title"
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    } @else {
                      <div class="w-full h-full flex items-center justify-center text-[10px] text-slate-600">Sem capa</div>
                    }

                    <span class="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/70 text-slate-200 backdrop-blur-xs">
                      {{ rel.relationType }}
                    </span>
                  </div>

                  <div class="min-w-0">
                    <p class="text-[11px] font-semibold text-slate-200 truncate group-hover:text-indigo-300 transition-colors" [title]="rel.title">
                      {{ rel.title }}
                    </p>
                    <p class="text-[9px] text-slate-500 uppercase">{{ rel.mediaType || 'MANGA' }}</p>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      }
    </section>
  `
})
export class DetailWebSectionComponent {
  @Input() mediaDetails: ExternalTrackerMediaDetails | null = null;
  @Input() loading = false;

  @Output() openLink = new EventEmitter<string>();
  @Output() searchManual = new EventEmitter<void>();
  @Output() openRelated = new EventEmitter<ExternalTrackerRelatedItem>();

  isSynopsisExpanded = signal(false);
}
