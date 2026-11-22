import { TestBed } from '@angular/core/testing';
import { SharedTransitionService } from '../../../../src/app/core/services/shared-transition.service';

describe('SharedTransitionService', () => {
  let service: SharedTransitionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SharedTransitionService]
    });
    service = TestBed.inject(SharedTransitionService);
  });

  it('deve ser instanciado com sucesso', () => {
    expect(service).toBeTruthy();
  });

  it('isActive deve retornar false quando nao ha item ativo', () => {
    expect(service.isActive(1, 'manga')).toBeFalse();
  });

  it('deve ativar o item correto e retornar nomes de transicao', () => {
    service.setActiveItem('manga', 42, 'card-1');
    expect(service.isActive(42, 'manga', 'card-1')).toBeTrue();
    expect(service.isActive(42, 'book', 'card-1')).toBeFalse();
    expect(service.isActive(42, 'manga', 'card-other')).toBeFalse();

    expect(service.getCoverName(42, 'manga', 'card-1')).toBe('cover-active');
    expect(service.getTitleName(42, 'manga', 'card-1')).toBe('title-active');
    expect(service.getProgressName(42, 'manga', 'card-1')).toBe('progress-active');
  });

  it('deve retornar none para nomes ja reivindicados por outro elemento no mesmo tick', () => {
    service.setActiveItem('manga', 10);
    // Element 1 claims cover-active
    const name1 = service.getCoverName(10, 'manga', 'elem-1');
    expect(name1).toBe('cover-active');

    // Element 2 with different instanceId attempts to claim the same name in the same tick
    const name2 = service.getCoverName(10, 'manga', 'elem-2');
    expect(name2).toBe('none');
  });

  it('clearActiveItem deve limpar o item ativo e nomes reivindicados', () => {
    service.setActiveItem('book', 99, 'inst-1');
    expect(service.isActive(99, 'book', 'inst-1')).toBeTrue();

    service.clearActiveItem();
    expect(service.isActive(99, 'book', 'inst-1')).toBeFalse();
    expect(service.getCoverName(99, 'book', 'inst-1')).toBe('none');
  });
});

