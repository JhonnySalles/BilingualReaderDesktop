import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NavigationStackService } from './navigation-stack.service';
import { SharedTransitionService } from './shared-transition.service';

describe('NavigationStackService (Frontend Angular)', () => {
  let service: NavigationStackService;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockSharedTransition: jasmine.SpyObj<SharedTransitionService>;

  beforeEach(() => {
    mockRouter = jasmine.createSpyObj('Router', ['navigateByUrl', 'navigate'], { url: '/detail/manga/1' });
    mockSharedTransition = jasmine.createSpyObj('SharedTransitionService', ['setActiveItem', 'clearActiveItem']);

    TestBed.configureTestingModule({
      providers: [
        NavigationStackService,
        { provide: SharedTransitionService, useValue: mockSharedTransition }
      ]
    });

    service = TestBed.inject(NavigationStackService);
  });

  it('deve inicializar com pilha de retorno vazia', () => {
    expect(service.canGoBack()).toBeFalse();
  });

  it('deve adicionar e consumir URLs da pilha de navegacao (LIFO)', () => {
    service.pushReturnUrl('/livros');
    service.pushReturnUrl('/manga');

    expect(service.canGoBack()).toBeTrue();
    expect(service.consumeReturnUrl()).toBe('/manga');
    expect(service.consumeReturnUrl()).toBe('/livros');
    expect(service.canGoBack()).toBeFalse();
  });

  it('nao deve empilhar a mesma URL consecutivamente', () => {
    service.pushReturnUrl('/home');
    service.pushReturnUrl('/home');

    expect(service.consumeReturnUrl()).toBe('/home');
    expect(service.canGoBack()).toBeFalse();
  });

  it('deve lembrar a biblioteca de origem e gerar a URL correta', () => {
    service.rememberLibrary('favoritos');
    expect(service.libraryUrl()).toBe('/?lib=favoritos');
  });

  it('deve limpar a pilha ao invocar clearStack', () => {
    service.pushReturnUrl('/rota-1');
    service.pushReturnUrl('/rota-2');
    service.clearStack();

    expect(service.canGoBack()).toBeFalse();
  });

  it('deve acionar router.navigateByUrl ao chamar goBack', () => {
    service.pushReturnUrl('/pagina-anterior');
    service.goBack(mockRouter);

    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/pagina-anterior');
  });
});
