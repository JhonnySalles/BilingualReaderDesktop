import {
  getFilterDefs,
  LibraryFilterDef,
  LibraryFilterKind,
  LibrarySearchScope,
  LibrarySearchToken,
  ParsedLibrarySearch
} from '../models/library-search.model';

/** Complete @Tipo:"valor" or @Tipo:valor tokens (accents allowed in type). */
export const LIBRARY_SEARCH_TOKEN_REGEX = /@(\S+):(?:"([^"]*)"|(\S+))/g;

function normalizeKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function resolveFilterKind(
  typeText: string,
  scope: LibrarySearchScope,
  partial = false
): LibraryFilterDef | null {
  const defs = getFilterDefs(scope);
  const needle = normalizeKey(typeText.replace(/^@/, ''));
  if (!needle) return null;

  for (const def of defs) {
    const candidates = [def.label, def.kind, ...def.aliases].map(normalizeKey);
    if (partial) {
      if (candidates.some(c => c.includes(needle))) {
        return def;
      }
    } else if (candidates.some(c => c === needle)) {
      return def;
    }
  }
  return null;
}

export function formatTokenValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/\s/.test(trimmed) || trimmed.includes('"')) {
    return `"${trimmed.replace(/"/g, '')}"`;
  }
  return trimmed;
}

/** Formats a complete token ending with a trailing space for further typing. */
export function formatToken(labelOrKind: string, value: string): string {
  const formatted = formatTokenValue(value);
  if (!formatted) {
    return `@${labelOrKind}:`;
  }
  return `@${labelOrKind}:${formatted} `;
}

export function parseLibrarySearch(
  query: string | null | undefined,
  scope: LibrarySearchScope
): ParsedLibrarySearch {
  const raw = query ?? '';
  const tokens: LibrarySearchToken[] = [];
  let freeText = raw;

  if (raw.includes('@')) {
    const regex = new RegExp(LIBRARY_SEARCH_TOKEN_REGEX.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(raw)) !== null) {
      const typeText = match[1] ?? '';
      const value = (match[2] ?? match[3] ?? '').trim();
      const def = resolveFilterKind(typeText, scope, false);
      if (def && value) {
        tokens.push({
          kind: def.kind,
          label: def.label,
          value,
          raw: match[0],
          index: match.index
        });
      }
      freeText = freeText.replace(match[0], ' ');
    }
  }

  const lastAt = raw.lastIndexOf('@');
  let hasIncompleteAt = false;
  if (lastAt >= 0) {
    const segment = raw.slice(lastAt);
    const completeInSegment = new RegExp(LIBRARY_SEARCH_TOKEN_REGEX.source).test(segment);
    const afterColon = segment.indexOf(':');
    const after = afterColon >= 0 ? segment.slice(afterColon + 1) : '';
    const isQuotedOpen =
      after.startsWith('"') && !after.slice(1).includes('"');

    if (!completeInSegment || isQuotedOpen) {
      hasIncompleteAt = true;
      // Strip incomplete trailing @ segment from free text so it is not matched as title
      freeText = freeText.slice(0, freeText.lastIndexOf('@') >= 0 ? freeText.lastIndexOf('@') : freeText.length);
    }
  }

  freeText = freeText.replace(/\s+/g, ' ').trim();

  return { tokens, freeText, hasIncompleteAt };
}

export function removeTokenFromQuery(query: string, token: LibrarySearchToken): string {
  const before = query.slice(0, token.index);
  const after = query.slice(token.index + token.raw.length);
  return `${before}${after}`.replace(/\s+/g, ' ').trim();
}

export function replaceLastAtSegment(query: string, insertion: string): string {
  const lastAt = query.lastIndexOf('@');
  if (lastAt < 0) {
    return `${query.trim()} ${insertion}`.trimStart();
  }
  const prefix = query.slice(0, lastAt).trimEnd();
  return prefix ? `${prefix} ${insertion}` : insertion;
}

export function filterKindLabel(kind: LibraryFilterKind, scope: LibrarySearchScope): string {
  const def = getFilterDefs(scope).find(d => d.kind === kind);
  return def?.label ?? kind;
}
