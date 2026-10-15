import { Fragment, useMemo } from 'react';
import { escapeRegExp } from '../quiz/text';

/**
 * Renders text with <mark> around matches of the given terms. The text itself is never changed:
 * it is only split into pieces. Terms are matched case-insensitively at word starts.
 */
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const parts = useMemo(() => splitForHighlight(text, terms), [text, terms]);
  return (
    <>
      {parts.map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <Fragment key={i}>{p.text}</Fragment>))}
    </>
  );
}

export function splitForHighlight(text: string, terms: string[]): { text: string; hit: boolean }[] {
  const clean = [...new Set(terms.map((t) => t.trim()).filter((t) => t.length > 0))].sort((a, b) => b.length - a.length);
  if (!clean.length) return [{ text, hit: false }];
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${clean.map(escapeRegExp).join('|')})`, 'giu');
  const out: { text: string; hit: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (!m[0]) continue;
    if (i > last) out.push({ text: text.slice(last, i), hit: false });
    out.push({ text: m[0], hit: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out;
}
