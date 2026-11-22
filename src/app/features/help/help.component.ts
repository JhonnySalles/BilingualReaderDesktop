import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../core/services/language.service';

interface HelpSection {
  id: string;
  title: string;
  body: string[];
}

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="h-full overflow-y-auto bg-slate-950 text-slate-100 relative" #scroller>
      <div class="max-w-3xl mx-auto px-6 pt-24 pb-24 space-y-8">
        <header class="space-y-2">
          <h1 class="text-2xl font-bold text-slate-50 tracking-tight">{{ 'help.title' | translate }}</h1>
          <p class="text-sm text-slate-400">
            {{ 'help.subtitle' | translate }}
          </p>
        </header>

        <nav class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{{ 'help.summary' | translate }}</p>
          <div class="flex flex-wrap gap-2">
            @for (s of sections(); track s.id) {
              <button type="button" (click)="scrollTo(s.id)"
                class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-primary-600/30 border border-slate-700 text-[11px] text-slate-200 cursor-pointer">
                {{ s.title }}
              </button>
            }
          </div>
        </nav>

        @for (s of sections(); track s.id) {
          <section [attr.id]="s.id" class="scroll-mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
            <h2 class="text-sm font-bold text-primary-300">{{ s.title }}</h2>
            @for (p of s.body; track $index) {
              <p class="text-sm text-slate-300 leading-relaxed">{{ p }}</p>
            }
          </section>
        }
      </div>

      <button type="button" (click)="scrollTop()"
        class="fixed bottom-6 right-8 z-20 px-3 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-xs font-semibold text-white shadow-lg cursor-pointer">
        {{ 'help.backToTop' | translate }}
      </button>
    </div>
  `
})
export class HelpComponent {
  private languageService = inject(LanguageService);

  readonly sections = computed<HelpSection[]>(() => {
    this.languageService.currentLang();
    const t = (k: string) => this.languageService.t(k);
    return [
      {
        id: 'biblioteca',
        title: t('help.sections.library.title'),
        body: [
          t('help.sections.library.p1'),
          t('help.sections.library.p2'),
          t('help.sections.library.p3')
        ]
      },
      {
        id: 'leitor-manga',
        title: t('help.sections.mangaReader.title'),
        body: [
          t('help.sections.mangaReader.p1'),
          t('help.sections.mangaReader.p2'),
          t('help.sections.mangaReader.p3')
        ]
      },
      {
        id: 'leitor-livro',
        title: t('help.sections.bookReader.title'),
        body: [
          t('help.sections.bookReader.p1'),
          t('help.sections.bookReader.p2'),
          t('help.sections.bookReader.p3')
        ]
      },
      {
        id: 'legendas-ocr',
        title: t('help.sections.subtitlesOcr.title'),
        body: [
          t('help.sections.subtitlesOcr.p1'),
          t('help.sections.subtitlesOcr.p2')
        ]
      },
      {
        id: 'vocabulario',
        title: t('help.sections.vocabulary.title'),
        body: [
          t('help.sections.vocabulary.p1'),
          t('help.sections.vocabulary.p2')
        ]
      },
      {
        id: 'estatisticas',
        title: t('help.sections.statistics.title'),
        body: [
          t('help.sections.statistics.p1'),
          t('help.sections.statistics.p2')
        ]
      },
      {
        id: 'sharemark',
        title: t('help.sections.sharemark.title'),
        body: [
          t('help.sections.sharemark.p1'),
          t('help.sections.sharemark.p2')
        ]
      },
      {
        id: 'touch',
        title: t('help.sections.touch.title'),
        body: [
          t('help.sections.touch.p1')
        ]
      },
      {
        id: 'settings',
        title: t('help.sections.settings.title'),
        body: [
          t('help.sections.settings.p1'),
          t('help.sections.settings.p2')
        ]
      }
    ];
  });

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  scrollTop(): void {
    const root = document.querySelector('app-help .overflow-y-auto') as HTMLElement | null;
    (root || document.documentElement).scrollTo({ top: 0, behavior: 'smooth' });
  }
}
