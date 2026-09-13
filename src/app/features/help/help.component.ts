import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface HelpSection {
  id: string;
  title: string;
  body: string[];
}

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full overflow-y-auto bg-slate-950 text-slate-100 relative" #scroller>
      <div class="max-w-3xl mx-auto px-6 pt-24 pb-24 space-y-8">
        <header class="space-y-2">
          <h1 class="text-2xl font-bold text-slate-50 tracking-tight">Ajuda</h1>
          <p class="text-sm text-slate-400">
            Guia rápido do Bilingual Reader Desktop. Clique em um tópico para ir à seção.
          </p>
        </header>

        <nav class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Sumário</p>
          <div class="flex flex-wrap gap-2">
            @for (s of sections; track s.id) {
              <button type="button" (click)="scrollTo(s.id)"
                class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600/30 border border-slate-700 text-[11px] text-slate-200 cursor-pointer">
                {{ s.title }}
              </button>
            }
          </div>
        </nav>

        @for (s of sections; track s.id) {
          <section [attr.id]="s.id" class="scroll-mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
            <h2 class="text-sm font-bold text-indigo-300">{{ s.title }}</h2>
            @for (p of s.body; track $index) {
              <p class="text-sm text-slate-300 leading-relaxed">{{ p }}</p>
            }
          </section>
        }
      </div>

      <button type="button" (click)="scrollTop()"
        class="fixed bottom-6 right-8 z-20 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg cursor-pointer">
        Voltar ao topo
      </button>
    </div>
  `
})
export class HelpComponent {
  readonly sections: HelpSection[] = [
    {
      id: 'biblioteca',
      title: 'Biblioteca',
      body: [
        'Use a barra lateral para alternar entre Início, mangás, livros e bibliotecas personalizadas.',
        'Configure pastas padrão e bibliotecas extras em Configurações. A ordenação padrão também pode ser definida lá.',
        'A busca na biblioteca aceita filtros com @ (ex.: @autor Nome).'
      ]
    },
    {
      id: 'leitor-manga',
      title: 'Leitor de mangá',
      body: [
        'Abra um mangá pela capa ou pela tela de detalhes. Ajuste sentido de leitura (incluindo páginas duplas), zoom e animação de virada.',
        'Toque/clique nas zonas 3×3 conforme configurado. Shift+arrastar ativa a lupa.',
        'Botões e zonas podem ir ao arquivo anterior/próximo da pasta.'
      ]
    },
    {
      id: 'leitor-livro',
      title: 'Leitor de livro',
      body: [
        'EPUB e formatos convertidos abrem no leitor de texto com tipografia, TOC, busca e anotações coloridas.',
        'TTS (síntese de voz) e furigana podem ser ligados nas configurações de livro.',
        'Seleção de texto oferece copiar; buscar/traduzir na seleção virão em atualizações futuras.'
      ]
    },
    {
      id: 'legendas-ocr',
      title: 'Legendas e OCR',
      body: [
        'No leitor de mangá, abra o painel de legendas para importar JSON e desenhar caixas.',
        'OCR reconhece região ou página inteira (Tesseract / Windows). A tradução OCR usa a aba de IA quando ativada.'
      ]
    },
    {
      id: 'vocabulario',
      title: 'Vocabulário',
      body: [
        'A tela Vocabulário lista palavras importadas por mangá ou livro, com favoritos e filtros.',
        'Ative o processamento automático nas configurações do mangá/livro para importar ao ler.'
      ]
    },
    {
      id: 'estatisticas',
      title: 'Estatísticas e histórico',
      body: [
        'Estatísticas agregam tempo e páginas a partir do histórico de leitura.',
        'Em Configurações → Sistema você pode limpar o histórico de estatísticas sem apagar marcadores dos arquivos.'
      ]
    },
    {
      id: 'sharemark',
      title: 'ShareMark',
      body: [
        'Sincronize progresso, favoritos e anotações com Google Drive ou Firestore (mesmas coleções do Android).',
        'É necessário configurar as credenciais OAuth no arquivo .env do projeto.'
      ]
    },
    {
      id: 'touch',
      title: 'Zonas de toque',
      body: [
        'Em Configurações, abra “Configurar funções de clique” para mapear a grade 3×3 do leitor de mangá ou livro.'
      ]
    },
    {
      id: 'settings',
      title: 'Configurações e manutenção',
      body: [
        'Faça backup/restauração do SQLite, limpe capas em cache e ajuste tema, glassmorphism e capas 3D.',
        'A aba IA guarda a chave OpenRouter e modelos usados na tradução OCR.'
      ]
    }
  ];

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  scrollTop(): void {
    const root = document.querySelector('app-help .overflow-y-auto') as HTMLElement | null;
    (root || document.documentElement).scrollTo({ top: 0, behavior: 'smooth' });
  }
}
