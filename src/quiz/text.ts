/** Text helpers shared by the generators and the answer checker. Pure. */

/** Lower-case, fold quotes/diacritics, drop punctuation, collapse whitespace. */
export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d"'`]/g, '')
    .replace(/%/g, ' percent ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/^(the|a|an) /, '');
}

/** Edit distance with adjacent transpositions counted as one edit (optimal string alignment), so "recieve" ~ "receive" = 1. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
    }
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

const CARDINALS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const TENS: Record<string, number> = { thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000 };
const ORDINALS = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];

export const NUMBER_WORDS: Record<string, number> = (() => {
  const m: Record<string, number> = { ...TENS };
  CARDINALS.forEach((w, i) => (m[w] = i));
  ORDINALS.forEach((w, i) => (m[w] = i));
  return m;
})();
export const CARDINAL_WORDS = [...CARDINALS.slice(1), ...Object.keys(TENS)];
export const ORDINAL_WORDS = ORDINALS.slice(1);

/** Digits with optional thousands separators and decimals, e.g. 1,000 / 19.5 / 2. */
export const NUMERIC_RE = /(?<![\p{L}\p{N}.,-])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?![\p{L}\p{N}]|[.,]\d)/gu;

/**
 * Parses an answer that should be a number: "1,000", "1000", "19.5%", "3", "three", "3rd", "third".
 * Trailing unit words are ignored. Returns null if the input is not a number.
 */
export function parseNumberAnswer(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/^(about|approximately|approx\.?)\s+/, '');
  const m = /^(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|-?\.\d+)\s*(?:st|nd|rd|th)?\b(.*)$/.exec(s) ?? /^(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(%)?$/.exec(s);
  if (m) {
    const rest = m[2]?.trim() ?? '';
    if (/\d/.test(rest)) return null; // "1 2" or "10-20": ambiguous
    const n = Number(m[1].replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  const w = /^([a-z]+)\b(.*)$/.exec(s);
  if (w && w[1] in NUMBER_WORDS && !/\d/.test(w[2])) return NUMBER_WORDS[w[1]];
  return null;
}

/** True when the whole expected answer is a single number (digits or number word, optional %). */
export function isNumberAnswer(expected: string): boolean {
  const s = expected.trim().toLowerCase();
  return /^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*%?$/.test(s) || s in NUMBER_WORDS || /^\d+(st|nd|rd|th)$/.test(s);
}

/**
 * Regex matching `term` as a whole token: not inside a longer word, hyphenated word or number
 * (so "500" does not match inside "1,500" and "one" does not match inside "one-half").
 */
export function tokenRe(term: string, flags = 'giu'): RegExp {
  const numeric = /^[\d.,]+%?$/.test(term);
  const before = numeric ? '(?<![\\p{L}\\p{N}.,-])' : '(?<![\\p{L}\\p{N}-])';
  const after = numeric ? '(?![\\p{L}\\p{N}-]|[.,]\\d)' : '(?![\\p{L}\\p{N}]|-\\p{L})';
  return new RegExp(`${before}${escapeRegExp(term)}${after}`, flags);
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
