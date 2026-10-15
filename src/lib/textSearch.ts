import MiniSearch, { type SearchOptions } from 'minisearch';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Rule } from '../data/types';

/**
 * Shared "filter as you type" search, used by the Statements and Rules pages.
 * Every query word must match (AND). Words match as prefixes, and words of 5+ letters also
 * tolerate a small typo. The search only decides which items show; their text is never changed.
 */
export interface TextDoc {
  id: string;
  [field: string]: string;
}

export const FILTER_SEARCH_OPTIONS: SearchOptions = {
  combineWith: 'AND',
  prefix: true,
  fuzzy: (term) => (term.length > 4 ? 0.2 : false)
};

export function buildTextIndex(docs: TextDoc[], fields: string[]): MiniSearch<TextDoc> {
  const index = new MiniSearch<TextDoc>({ fields, idField: 'id' });
  index.addAll(docs);
  return index;
}

/** True if the query has something searchable (a letter or a digit). */
export function hasQuery(query: string): boolean {
  return /[\p{L}\p{N}]/u.test(query);
}

/**
 * Maps each matching id to the words in that item that matched (for highlighting).
 * Returns null for an empty query, meaning "no search: show everything".
 */
export function filterMatches(index: MiniSearch<TextDoc>, query: string, inScope?: (id: string) => boolean): Map<string, string[]> | null {
  if (!hasQuery(query)) return null;
  const out = new Map<string, string[]>();
  const filter = inScope ? (r: { id: unknown }) => inScope(String(r.id)) : undefined;
  for (const r of index.search(query.trim(), { ...FILTER_SEARCH_OPTIONS, filter })) out.set(String(r.id), r.terms);
  return out;
}

/** A search box value kept in the URL (?q=…), synced after a short pause so it survives reloads and Back. */
export function useUrlQuery(key = 'q'): [string, (v: string) => void] {
  const [params, setParams] = useSearchParams();
  const [value, setValue] = useState(params.get(key) ?? '');
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [value, params, setParams, key]);
  return [value, setValue];
}

/** Rule search over number, title and verbatim text of every rule ('pre' skill sheets included). */
export function buildRuleSearchIndex(rules: Rule[]): MiniSearch<TextDoc> {
  return buildTextIndex(rules.map((r) => ({ id: r.id, number: r.number, title: r.title, text: r.text })), ['number', 'title', 'text']);
}
