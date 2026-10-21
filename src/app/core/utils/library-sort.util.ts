import { Manga, Book, OrderType } from '../models';

export function getItemTitle(item: { title?: string; name?: string }): string {
  return (item.title || (item as any).name || '').trim();
}

export function hasLastAccess(item: Manga | Book): boolean {
  const la = (item as any).lastAccess;
  if (!la) return false;
  const s = String(la).trim();
  return s !== '' && s !== '0' && s !== '0000-00-00';
}

/**
 * Ordena itens da biblioteca de acordo com a modalidade e direção.
 * 
 * Regras:
 * 1. Nome, Autor, Data, Gênero, Série: Ordenação geral da lista.
 * 2. Favorito: Ordenação em cascata com dois sorts na mesma lista:
 *    - Sort 1: Ordem alfabética da lista.
 *    - Sort 2: Favoritos primeiro, não favoritos depois.
 * 3. Último Acesso: Ordenação em cascata com dois sorts na mesma lista:
 *    - Sort 1: Ordem alfabética da lista.
 *    - Sort 2: Com acesso primeiro (ordenados por data de acesso ASC ou DESC),
 *              sem acesso depois (mantendo a ordem alfabética do Sort 1).
 */
export function sortLibraryItems<T extends Manga | Book>(
  items: T[],
  order: OrderType,
  isAsc: boolean
): T[] {
  const list = [...items];

  switch (order) {
    case OrderType.Favorite: {
      // Cascata com 2 sorts na mesma lista:
      // Sort 1: Ordem alfabética (respeitando a direção isAsc)
      list.sort((a, b) => {
        const nameA = getItemTitle(a);
        const nameB = getItemTitle(b);
        return isAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });

      // Sort 2: Bloco de favoritos sempre primeiro
      list.sort((a, b) => {
        const favA = Boolean(a.favorite);
        const favB = Boolean(b.favorite);
        if (favA !== favB) {
          return favA ? -1 : 1; // Favoritos sempre no topo
        }
        return 0; // Preserva a ordem alfabética do Sort 1
      });

      return list;
    }

    case OrderType.LastAccess: {
      // Cascata com 2 sorts na mesma lista:
      // Sort 1: Ordem alfabética (respeitando a direção isAsc)
      list.sort((a, b) => {
        const nameA = getItemTitle(a);
        const nameB = getItemTitle(b);
        return isAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });

      // Sort 2: Bloco com acesso primeiro (por data ASC ou DESC), sem acesso depois
      list.sort((a, b) => {
        const hasA = hasLastAccess(a);
        const hasB = hasLastAccess(b);

        if (hasA !== hasB) {
          return hasA ? -1 : 1; // Com acesso sempre no topo
        }

        if (hasA && hasB) {
          const dateA = String((a as any).lastAccess).trim();
          const dateB = String((b as any).lastAccess).trim();
          const cmp = isAsc ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
          if (cmp !== 0) return cmp;
          const nameA = getItemTitle(a);
          const nameB = getItemTitle(b);
          return isAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        }

        // Ambos SEM acesso: preserva a ordem alfabética do Sort 1
        return 0;
      });

      return list;
    }

    case OrderType.Name: {
      list.sort((a, b) => {
        const nameA = getItemTitle(a);
        const nameB = getItemTitle(b);
        return isAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
      return list;
    }

    case OrderType.Author: {
      list.sort((a, b) => {
        const authA = (a.author || '').trim();
        const authB = (b.author || '').trim();
        if (!authA && authB) return 1;
        if (authA && !authB) return -1;
        const cmp = isAsc ? authA.localeCompare(authB) : authB.localeCompare(authA);
        if (cmp !== 0) return cmp;
        const nameA = getItemTitle(a);
        const nameB = getItemTitle(b);
        return isAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
      return list;
    }

    case OrderType.Date: {
      list.sort((a, b) => {
        const dateA = ((a as any).dateCreate || '').trim();
        const dateB = ((b as any).dateCreate || '').trim();
        if (!dateA && dateB) return 1;
        if (dateA && !dateB) return -1;
        const cmp = isAsc ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
        if (cmp !== 0) return cmp;
        const nameA = getItemTitle(a);
        const nameB = getItemTitle(b);
        return isAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
      return list;
    }

    case OrderType.Genre: {
      list.sort((a, b) => {
        const genreA = ((a as any).genre || '').trim();
        const genreB = ((b as any).genre || '').trim();
        if (!genreA && genreB) return 1;
        if (genreA && !genreB) return -1;
        const cmp = isAsc ? genreA.localeCompare(genreB) : genreB.localeCompare(genreA);
        if (cmp !== 0) return cmp;
        const nameA = getItemTitle(a);
        const nameB = getItemTitle(b);
        return isAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
      return list;
    }

    case OrderType.Series: {
      list.sort((a, b) => {
        const seriesA = ((a as any).series || '').trim();
        const seriesB = ((b as any).series || '').trim();
        if (!seriesA && seriesB) return 1;
        if (seriesA && !seriesB) return -1;
        const cmp = isAsc ? seriesA.localeCompare(seriesB) : seriesB.localeCompare(seriesA);
        if (cmp !== 0) return cmp;
        const nameA = getItemTitle(a);
        const nameB = getItemTitle(b);
        return isAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
      return list;
    }

    default: {
      list.sort((a, b) => {
        const nameA = getItemTitle(a);
        const nameB = getItemTitle(b);
        return isAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
      return list;
    }
  }
}
