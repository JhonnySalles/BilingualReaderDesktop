import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ElectronService } from '../../core/services/electron.service';

interface OssCredit {
  name: string;
  url: string;
}

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full overflow-y-auto bg-slate-950 text-slate-100">
      <div class="max-w-2xl mx-auto px-6 py-10 space-y-8">
        <div class="flex items-start gap-5">
          <div class="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <span class="text-2xl font-black text-indigo-300">BR</span>
          </div>
          <div class="min-w-0">
            <h1 class="text-2xl font-bold text-slate-50 tracking-tight">{{ info().productName }}</h1>
            <p class="text-sm text-slate-400 mt-1">Versão {{ info().version }}</p>
            <p class="text-xs text-slate-500 mt-2">Leitor bilíngue para mangás e e-books — desktop</p>
          </div>
        </div>

        <section class="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Autor</h2>
          <p class="text-sm text-slate-200">{{ info().author }}</p>
          <div class="flex flex-wrap gap-2 pt-1">
            <button type="button" (click)="open('https://github.com/JhonnySalles/BilingualMangaReader')"
              class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer">
              GitHub
            </button>
            <button type="button" (click)="open(contactMailto)"
              class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer">
              Contato
            </button>
          </div>
        </section>

        <section class="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Créditos de código aberto</h2>
          <ul class="space-y-2">
            @for (c of credits; track c.name) {
              <li>
                <button type="button" (click)="open(c.url)"
                  class="text-sm text-indigo-300 hover:text-indigo-200 hover:underline cursor-pointer">
                  {{ c.name }}
                </button>
              </li>
            }
          </ul>
        </section>
      </div>
    </div>
  `
})
export class AboutComponent implements OnInit {
  private electron = inject(ElectronService);

  info = signal({
    name: 'Bilingual Reader',
    version: '…',
    author: 'Jhonny Salles',
    productName: 'Bilingual Reader'
  });

  readonly contactMailto = 'mailto:jhonnysalles@gmail.com';

  readonly credits: OssCredit[] = [
    { name: 'Electron', url: 'https://github.com/electron/electron' },
    { name: 'Angular', url: 'https://angular.dev/' },
    { name: 'epub.js', url: 'https://github.com/futurepress/epub.js/' },
    { name: 'libmobi (LGPL) — conversão MOBI/AZW', url: 'https://github.com/bfabiszewski/libmobi' },
    { name: 'Sudachi / Kuromoji (japonês)', url: 'https://github.com/WorksApplications/Sudachi' },
    { name: 'Tesseract.js', url: 'https://tesseract.projectnaptha.com/' },
    { name: 'better-sqlite3', url: 'https://github.com/WiseLibs/better-sqlite3' },
    { name: 'Sentry', url: 'https://sentry.io/' }
  ];

  async ngOnInit(): Promise<void> {
    this.info.set(await this.electron.appGetInfo());
  }

  open(url: string): void {
    void this.electron.openExternal(url);
  }
}
