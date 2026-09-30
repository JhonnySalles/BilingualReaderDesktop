import {
  clampBookMark,
  isUnread,
  isCompleted,
  progressPercent,
  progressPageLabel,
  toReaderIndex,
  fromReaderIndex
} from '../../../../src/app/core/utils/reading-progress.util';

describe('reading-progress.util (Frontend Utils)', () => {
  describe('clampBookMark', () => {
    it('deve retornar 0 para valores negativos ou zero', () => {
      expect(clampBookMark(0, 100)).toBe(0);
      expect(clampBookMark(-5, 100)).toBe(0);
    });

    it('deve limitar o valor maximo ao total de paginas', () => {
      expect(clampBookMark(150, 100)).toBe(100);
      expect(clampBookMark(50, 100)).toBe(50);
    });

    it('deve arredondar numeros decimais para baixo', () => {
      expect(clampBookMark(45.9, 100)).toBe(45);
    });
  });

  describe('isUnread', () => {
    it('deve retornar true para marcas nao iniciadas', () => {
      expect(isUnread(0)).toBeTrue();
      expect(isUnread(-1)).toBeTrue();
      expect(isUnread(NaN)).toBeTrue();
    });

    it('deve retornar false quando houver leitura em andamento', () => {
      expect(isUnread(1)).toBeFalse();
      expect(isUnread(10)).toBeFalse();
    });
  });

  describe('isCompleted', () => {
    it('deve retornar true se a flag completed for true', () => {
      expect(isCompleted(10, 100, true)).toBeTrue();
    });

    it('deve retornar true se a pagina atual alcancou o total de paginas', () => {
      expect(isCompleted(100, 100)).toBeTrue();
      expect(isCompleted(120, 100)).toBeTrue();
    });

    it('deve retornar false se a leitura estiver no meio e flag for false', () => {
      expect(isCompleted(50, 100, false)).toBeFalse();
    });
  });

  describe('progressPercent', () => {
    it('deve retornar 0% para livro nao iniciado', () => {
      expect(progressPercent(0, 100)).toBe(0);
    });

    it('deve calcular a porcentagem correta', () => {
      expect(progressPercent(25, 100)).toBe(25);
      expect(progressPercent(50, 200)).toBe(25);
    });

    it('deve retornar 100% se completed for true ou pagina final atingida', () => {
      expect(progressPercent(10, 100, true)).toBe(100);
      expect(progressPercent(100, 100)).toBe(100);
    });
  });

  describe('progressPageLabel', () => {
    it('deve retornar Concluído se concluído', () => {
      expect(progressPageLabel(100, 100)).toBe('Concluído');
      expect(progressPageLabel(10, 100, true)).toBe('Concluído');
    });

    it('deve retornar Não iniciado para leitura sem progresso', () => {
      expect(progressPageLabel(0, 100)).toBe('Não iniciado');
      expect(progressPageLabel(0, 100, false, { notStartedLabel: 'Comece a ler' })).toBe('Comece a ler');
    });

    it('deve formatar o rotulo atual / total', () => {
      expect(progressPageLabel(45, 100)).toBe('45 / 100');
    });
  });

  describe('toReaderIndex & fromReaderIndex', () => {
    it('deve converter 1-based (armazenamento) para 0-based (leitor)', () => {
      expect(toReaderIndex(1, 100)).toBe(0);
      expect(toReaderIndex(50, 100)).toBe(49);
      expect(toReaderIndex(0, 100)).toBe(0);
    });

    it('deve converter 0-based (leitor) para 1-based (armazenamento)', () => {
      expect(fromReaderIndex(0, 100)).toBe(1);
      expect(fromReaderIndex(49, 100)).toBe(50);
    });
  });
});
