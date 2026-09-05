import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-vocabulary-stub',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full flex flex-col bg-slate-950 text-slate-100">
      <div class="flex-1 flex items-center justify-center p-8 text-center">
        <div class="max-w-md space-y-2">
          <p class="text-sm font-semibold text-slate-200">Em breve</p>
          <p class="text-xs text-slate-400">
            A tela de vocabulário será portada em um plano futuro. O atalho já está disponível a partir do detalhe.
          </p>
        </div>
      </div>
    </div>
  `
})
export class VocabularyStubComponent {}
