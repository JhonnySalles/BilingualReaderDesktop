import { compareFileTypeExtension } from '../models/enums/app-enums';
import {
  LibraryFilterKind,
  LibrarySearchableItem,
  LibrarySearchScope,
  ParsedLibrarySearch
} from '../models/library-search.model';

export function parseTagsField(tags?: string | null): string[] {
  if (!tags?.trim()) return [];
  return tags
    .split(/[,;]/)
    .map(t => t.trim())
    .filter(Boolean);
}

function containsIgnoreCase(haystack: string | undefined | null, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function equalsIgnoreCase(a: string | undefined | null, b: string): boolean {
  if (a == null) return false;
  return a.toLowerCase() === b.toLowerCase();
}

function matchToken(
  item: LibrarySearchableItem,
  kind: LibraryFilterKind,
  value: string,
  scope: LibrarySearchScope
): boolean {
  switch (kind) {
    case 'Author':
      return containsIgnoreCase(item.author, value);
    case 'Publisher':
      return containsIgnoreCase(item.publisher, value);
    case 'Series':
      return containsIgnoreCase(item.series, value);
    case 'Volume':
      // Library manga: exact; history: contains (Android parity)
      if (scope === 'history') {
        return containsIgnoreCase(item.volume, value);
      }
      return equalsIgnoreCase(item.volume, value);
    case 'Type':
      return containsIgnoreCase(String(item.fileType ?? ''), value);
    case 'Tag': {
      const tags = parseTagsField(item.tags);
      if (!value) return tags.length === 0;
      const needle = value.replace(/'/g, '').toLowerCase();
      return tags.some(t => t.toLowerCase() === needle || t.toLowerCase().includes(needle));
    }
    default:
      return false;
  }
}

function matchFreeText(
  item: LibrarySearchableItem,
  freeText: string,
  scope: LibrarySearchScope
): boolean {
  if (!freeText) return true;
  const q = freeText.toLowerCase();
  const name = (item.name ?? '').toLowerCase();
  const title = (item.title ?? '').toLowerCase();
  const typeMatch = compareFileTypeExtension(item.fileType, q);

  if (scope === 'manga') {
    return name.includes(q) || typeMatch;
  }
  if (scope === 'book') {
    return name.includes(q) || title.includes(q) || typeMatch;
  }
  // history
  return name.includes(q) || title.includes(q) || typeMatch;
}

/**
 * AND across @ tokens + free text.
 * Incomplete @ segments are ignored by the parser (not present in tokens).
 */
export function itemMatchesSearch(
  item: LibrarySearchableItem,
  parsed: ParsedLibrarySearch,
  scope: LibrarySearchScope
): boolean {
  if (!item) return false;

  for (const token of parsed.tokens) {
    if (!matchToken(item, token.kind, token.value, scope)) {
      return false;
    }
  }

  return matchFreeText(item, parsed.freeText, scope);
}

export function isSearchActive(parsed: ParsedLibrarySearch): boolean {
  return parsed.tokens.length > 0 || parsed.freeText.length > 0;
}
