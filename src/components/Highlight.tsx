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

/**
 * A window of about `size` characters around the first highlighted term. Characters inside the window
 * are unchanged; with `flatten`, line breaks are shown as spaces (for one-line result lists).
 * Returns '' when `requireHit` is set and no term occurs in the text.
 */
export function snippet(text: string, terms: string[], size = 220, { flatten = true, requireHit = false } = {}): string {
  const body = flatten ? text.replace(/\s*\n\s*/g, ' ') : text;
  const clean = terms.filter((t) => t.trim());
  const m = clean.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${clean.map(escapeRegExp).join('|')})`, 'iu').exec(body) : null;
  if (requireHit && !m) return '';
  if (body.length <= size) return body;
  const at = m ? m.index : 0;
  let start = Math.max(0, Math.min(at - 60, body.length - size));
  let end = start + size;
  // Don't cut words in half: move the cut points to the nearest space (within 25 characters).
  if (start > 0 && /\S/.test(body[start - 1])) {
    const sp = body.slice(start, Math.min(at, start + 25)).search(/\s/);
    if (sp >= 0) start += sp + 1;
  }
  if (end < body.length && /\S/.test(body[end])) {
    const sp = body.slice(Math.max(start, end - 25), end).search(/\s\S*$/);
    if (sp >= 0) end = Math.max(start, end - 25) + sp;
  }
  return `${start > 0 ? '…' : ''}${body.slice(start, end)}${end < body.length ? '…' : ''}`;
}
