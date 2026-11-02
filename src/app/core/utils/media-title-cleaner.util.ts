import { Manga, Book } from '../models';

/**
 * Remove extensões de arquivos conhecidas de mídia.
 */
export function removeFileExtension(filename: string): string {
  return filename.replace(/\.(epub|kepub|pdf|mobi|azw\d?|djvu|txt|cbz|cbr|cbt|cb7|zip|rar|7z|tar)$/i, '');
}

/**
 * Extrai o título de busca para Mangás no MyAnimeList / AniList:
 * 1. Prioriza o campo 'series' do mangá.
 * 2. Caso não tenha série ou esteja vazia, usa o título ou nome do arquivo
 *    extraindo o que vem antes de " - Volume 01" (prevendo sufixos como " (Jap)", " (Eng)", etc.).
 */
export function extractMangaSearchTitle(manga: Partial<Manga> | null | undefined): string {
  if (!manga) return '';

  if (manga.series && manga.series.trim()) {
    return manga.series.trim();
  }

  const raw = manga.title || manga.name || '';
  const withoutExt = removeFileExtension(raw.trim());

  // Obtém o que vem antes de " - Volume 01", " - Volume 01 (Jap)", " - Vol 01", etc.
  const beforeVolume = withoutExt.replace(/\s*-\s*(?:Volume|Vol\.?|v)\s*\d+.*$/i, '').trim();

  return beforeVolume || withoutExt;
}

/**
 * Extrai o título de busca para Livros no MyAnimeList / AniList / Tracker:
 * 1. Para o livro, obtém o título do OPF e remove o ", vol 01.5" presente (o que vem antes).
 * 2. Caso não obtenha o título do OPF (ou esteja vazio/igual ao filename), se for obtido
 *    do nome do arquivo obtém o que vem antes de " - Volume 01" (prevendo sufixos como " (Eng)", " (Jap)", etc.).
 */
export function extractBookSearchTitle(book: Partial<Book> | null | undefined): string {
  if (!book) return '';

  const opfTitle = book.title?.trim();
  const rawName = (book.name || '').trim();

  // Caso 1: Título presente no OPF (e não é puramente o nome de arquivo com extensão)
  if (opfTitle && !opfTitle.match(/\.(epub|pdf|mobi|azw\d?)$/i)) {
    // Remove ", vol 01.5", ", Vol 01", ", volume 2", ", v 01", etc.
    const beforeCommaVol = opfTitle.replace(/,\s*(?:vol(?:ume)?\.?|v)\s*[\d.]+.*$/i, '').trim();
    if (beforeCommaVol) {
      // Também previne caso no OPF tenham colocado " - Volume 01"
      return beforeCommaVol.replace(/\s*-\s*(?:Volume|Vol\.?|v)\s*\d+.*$/i, '').trim() || beforeCommaVol;
    }
  }

  // Caso 2: Título obtido do nome do arquivo
  const filename = rawName || opfTitle || '';
  const withoutExt = removeFileExtension(filename);

  // Obtém o que vem antes de " - Volume 01", " - Volume 01 (Eng)", etc.
  const beforeVolume = withoutExt.replace(/\s*-\s*(?:Volume|Vol\.?|v)\s*\d+.*$/i, '').trim();

  return beforeVolume || withoutExt;
}

/**
 * Higieniza qualquer string genérica de busca aplicando as regras de remoção de volume.
 */
export function sanitizeSearchTitle(title: string): string {
  if (!title) return '';
  let clean = removeFileExtension(title.trim());
  // Remove ", vol 01.5..."
  clean = clean.replace(/,\s*(?:vol(?:ume)?\.?|v)\s*[\d.]+.*$/i, '').trim();
  // Remove " - Volume 01..."
  clean = clean.replace(/\s*-\s*(?:Volume|Vol\.?|v)\s*\d+.*$/i, '').trim();
  return clean;
}
