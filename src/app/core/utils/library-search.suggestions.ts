import {
  getFilterDefs,
  LibraryFilterKind,
  LibrarySearchCatalog,
  LibrarySearchScope,
  LibrarySearchSuggestion
} from '../models/library-search.model';
import { formatToken, formatTokenValue, resolveFilterKind } from './library-search.parser';
import { ensureCatalog } from './library-search.catalog';

function valuesForKind(catalog: LibrarySearchCatalog, kind: LibraryFilterKind): string[] {
  switch (kind) {
    case 'Author':
      return catalog.authors;
    case 'Publisher':
      return catalog.publishers;
    case 'Series':
      return catalog.series;
    case 'Volume':
      return catalog.volumes;
    case 'Tag':
      return catalog.tags;
    case 'Type':
      return catalog.types;
    default:
      return [];
  }
}

/**
 * Builds autocomplete suggestions from the active @ segment (after the last @).
 * Returns empty when the last @ segment is already a complete token with trailing space,
 * or when there is no active @ segment.
 */
export function buildLibrarySearchSuggestions(
  query: string,
  scope: LibrarySearchScope,
  catalog: LibrarySearchCatalog
): LibrarySearchSuggestion[] {
  const cat = ensureCatalog(catalog);
  const lastAt = query.lastIndexOf('@');
  if (lastAt < 0) return [];

  const segment = query.slice(lastAt); // includes @
  // If a complete token already ends and there's trailing space after it, stop suggesting
  const completeMatch = segment.match(/^@(\S+):(?:"([^"]*)"|(\S+))(\s*)$/);
  if (completeMatch && (completeMatch[4]?.length ?? 0) > 0) {
    return [];
  }
  // Complete token without trailing space — still allow filtering values while refining
  // but if the value is complete (quoted closed or unquoted), prefer showing nothing
  // unless user is still typing the value (partial). Android continues until space.
  // We treat "no space after complete value" as still in value mode only if incomplete quote.
  const colonIdx = segment.indexOf(':');

  if (colonIdx < 0) {
    // Typing filter type: @ or @Aut
    const typed = segment.slice(1); // without @
    const defs = getFilterDefs(scope);
    const needle = typed.toLowerCase();
    return defs
      .filter(d => {
        if (!needle) return true;
        const keys = [d.label, d.kind, ...d.aliases].map(k => k.toLowerCase());
        return keys.some(k => k.includes(needle) || needle.includes(k));
      })
      .map(d => ({
        kind: 'type' as const,
        insertText: `@${d.label}:`,
        label: `@${d.label}:`,
        filterKind: d.kind
      }));
  }

  const typePart = segment.slice(1, colonIdx);
  const valuePart = segment.slice(colonIdx + 1);
  // Open quote without closing → keep suggesting
  const openQuote = valuePart.startsWith('"') && !valuePart.slice(1).includes('"');

  const def = resolveFilterKind(typePart, scope, true);
  if (!def) return [];

  let condition = valuePart;
  if (condition.startsWith('"')) {
    condition = openQuote ? condition.slice(1) : condition.replace(/^"|"$/g, '');
  }

  const values = valuesForKind(cat, def.kind).filter(
    v => !condition || v.toLowerCase().includes(condition.toLowerCase())
  );

  return values.slice(0, 50).map(v => ({
    kind: 'value' as const,
    insertText: formatToken(def.label, v),
    label: formatTokenValue(v) || v,
    filterKind: def.kind,
    matchHint: condition || undefined
  }));
}

export function shouldPauseFiltering(query: string): boolean {
  const lastAt = query.lastIndexOf('@');
  if (lastAt < 0) return false;
  const segment = query.slice(lastAt);
  // Pause while typing type name or open value
  if (!segment.includes(':')) return true;
  const after = segment.slice(segment.indexOf(':') + 1);
  if (after.startsWith('"') && !after.slice(1).includes('"')) return true;
  // Complete token with trailing space → do not pause
  if (/^@\S+:(?:"[^"]*"|\S+)\s+/.test(segment)) return false;
  // Mid-typing unquoted value without space → pause (Android waits for space)
  if (/^@\S+:\S*$/.test(segment) || /^@\S+:"[^"]*"$/.test(segment)) {
    // Complete value without trailing space — Android still filters when leaving @ mode
    // via space. Pause until space after token for library parity.
    return !/\s$/.test(segment);
  }
  if (/^@\S+:$/.test(segment)) return true;
  return false;
}
