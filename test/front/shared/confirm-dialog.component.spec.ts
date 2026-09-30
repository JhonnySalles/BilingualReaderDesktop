import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmDialogComponent } from '../../../src/app/shared/confirm-dialog/confirm-dialog.component';
import { ConfirmDialogService } from '../../../src/app/core/services/confirm-dialog.service';

describe('ConfirmDialogComponent (Frontend Shared Component)', () => {
  let component: ConfirmDialogComponent;
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let service: ConfirmDialogService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [ConfirmDialogService]
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(ConfirmDialogService);
    fixture.detectChanges();
  });

  it('nao deve renderizar nenhum modal quando activeDialog for nulo', () => {
    const dialogElement = fixture.nativeElement.querySelector('.fixed');
    expect(dialogElement).toBeNull();
  });

  it('deve renderizar o modal com titulo, mensagem e botoes quando confirm for acionado', () => {
    service.confirm({
      title: 'Excluir Item',
      message: 'Tem certeza que deseja apagar?',
      confirmText: 'Sim, apagar',
      cancelText: 'Voltar',
      confirmVariant: 'danger'
    });

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h3')?.textContent?.trim()).toBe('Excluir Item');
    expect(compiled.querySelector('p')?.textContent?.trim()).toBe('Tem certeza que deseja apagar?');

    const buttons = compiled.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent?.trim()).toBe('Voltar');
    expect(buttons[1].textContent?.trim()).toBe('Sim, apagar');
  });

  it('deve resolver true quando o usuario clicar no botao de confirmacao', async () => {
    let resolvedValue: boolean | undefined;

    service.confirm({
      title: 'Atenção',
      message: 'Deseja continuar?'
    }).then((val: boolean) => {
      resolvedValue = val;
    });

    fixture.detectChanges();

    const confirmButton = fixture.nativeElement.querySelectorAll('button')[1] as HTMLButtonElement;
    confirmButton.click();
    fixture.detectChanges();

    await fixture.whenStable();
    expect(resolvedValue).toBeTrue();
    expect(service.activeDialog()).toBeNull();
  });

  it('deve resolver false quando o usuario clicar no botao de cancelar', async () => {
    let resolvedValue: boolean | undefined;

    service.confirm({
      title: 'Atenção',
      message: 'Deseja cancelar?'
    }).then((val: boolean) => {
      resolvedValue = val;
    });

    fixture.detectChanges();

    const cancelButton = fixture.nativeElement.querySelectorAll('button')[0] as HTMLButtonElement;
    cancelButton.click();
    fixture.detectChanges();

    await fixture.whenStable();
    expect(resolvedValue).toBeFalse();
    expect(service.activeDialog()).toBeNull();
  });

  it('deve fechar e resolver false ao pressionar a tecla Escape', async () => {
    let resolvedValue: boolean | undefined;

    service.confirm('Confirmar acao rápida').then((val: boolean) => {
      resolvedValue = val;
    });

    fixture.detectChanges();

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);
    fixture.detectChanges();

    await fixture.whenStable();
    expect(resolvedValue).toBeFalse();
    expect(service.activeDialog()).toBeNull();
  });

  it('deve confirmar e resolver true ao pressionar a tecla Enter', async () => {
    let resolvedValue: boolean | undefined;

    service.confirm('Confirmar acao rápida').then((val: boolean) => {
      resolvedValue = val;
    });

    fixture.detectChanges();

    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    window.dispatchEvent(event);
    fixture.detectChanges();

    await fixture.whenStable();
    expect(resolvedValue).toBeTrue();
    expect(service.activeDialog()).toBeNull();
  });
});
