/**
 * Finds the parts of a statement that are worth blanking out (cloze deletion). Pure.
 * Priority (see quizConfig.blankScores): supplied keyTerms > numbers > quoted terms > acronyms/formulas
 * > technical lexicon > units after a number > Capitalized Terms > long plain words (fallback).
 */
import { quizConfig, type QuizConfig } from './quizConfig';
import { NUMBER_WORDS, NUMERIC_RE, escapeRegExp, tokenRe } from './text';

export type CandidateKind = 'keyTerm' | 'number' | 'quoted' | 'acronym' | 'lexicon' | 'unit' | 'capitalized' | 'word';

export interface Candidate {
  /** Exact substring of the statement. */
  text: string;
  start: number;
  end: number;
  kind: CandidateKind;
  score: number;
  /** For numbers: the unit that follows (lower case), if any. For units: the unit family. */
  unit?: string;
  /** For number words: 'ordinal' | 'cardinal'. */
  numberStyle?: 'digits' | 'cardinal' | 'ordinal';
}

const ALL_UNITS = (cfg: QuizConfig) =>
  Object.entries(cfg.units)
    .flatMap(([family, list]) => list.map((u) => ({ u, family })))
    .sort((a, b) => b.u.length - a.u.length);

export function unitFamily(unit: string, cfg: QuizConfig = quizConfig): string | undefined {
  const u = unit.toLowerCase();
  for (const [family, list] of Object.entries(cfg.units)) if (list.includes(u)) return family;
  return undefined;
}

/** Sentence-start positions: index 0 and the first letter after ". ", "? ", "! ", ": " or a newline. */
function sentenceStarts(s: string): Set<number> {
  const starts = new Set<number>();
  const re = /(^|[.!?:;]\s+|\n\s*|^["“(]\s*)(?=\S)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    starts.add(m.index + m[0].length);
    if (m[0].length === 0) re.lastIndex++;
  }
  return starts;
}

const wordBoundaryRe = (term: string) => tokenRe(term);

export function findCandidates(statement: string, keyTerms: string[] = [], cfg: QuizConfig = quizConfig): Candidate[] {
  const S = cfg.blankScores;
  const out: Candidate[] = [];
  const ignore = new Set(cfg.ignoreTerms);
  const add = (c: Omit<Candidate, 'score'> & { score?: number }) => {
    if (!c.text.trim()) return;
    if (ignore.has(c.text.toLowerCase())) return;
    out.push({ ...c, score: c.score ?? S[c.kind] });
  };
  const letters = statement.replace(/[^\p{L}]/gu, '');
  const mostlyUpper = letters.length > 0 && letters.replace(/[^\p{Lu}]/gu, '').length / letters.length > 0.6;
  const starts = sentenceStarts(statement);

  // 1. Supplied key terms (first occurrence of each).
  for (const t of keyTerms) {
    const m = wordBoundaryRe(t).exec(statement) ?? new RegExp(escapeRegExp(t), 'i').exec(statement);
    if (m) add({ text: m[0], start: m.index, end: m.index + m[0].length, kind: 'keyTerm', score: S.keyTerm + Math.min(t.length, 20) / 100 });
  }

  // 2. Numbers in digits, plus the unit that follows them.
  const units = ALL_UNITS(cfg);
  for (const m of statement.matchAll(NUMERIC_RE)) {
    const start = m.index ?? 0;
    let end = start + m[0].length;
    let text = m[0];
    const pct = /^\s?%/.exec(statement.slice(end));
    if (pct) {
      text += pct[0];
      end += pct[0].length;
    }
    const after = statement.slice(end);
    let unit: string | undefined;
    for (const { u } of units) {
      const um = new RegExp(`^\\s+(${escapeRegExp(u)})(?![\\p{L}\\p{N}])`, 'iu').exec(after);
      if (um && u !== '%') {
        unit = um[1].toLowerCase();
        const uStart = end + um[0].length - um[1].length;
        add({ text: um[1], start: uStart, end: uStart + um[1].length, kind: 'unit', unit: unitFamily(unit, cfg) });
        break;
      }
    }
    // Skip list markers ("1)") and bare years / section references would still be numbers; keep them but lower.
    const isListMarker = start === 0 && /^\s*[).]/.test(after);
    add({ text, start, end, kind: 'number', unit: pct ? '%' : unit, numberStyle: 'digits', score: isListMarker ? S.word : S.number });
  }

  // 3. Number words ("three", "second").
  for (const m of statement.matchAll(/(?<![\p{L}\p{N}-])[\p{L}]+(?![\p{L}\p{N}]|-\p{L})/gu)) {
    const w = m[0].toLowerCase();
    if (!(w in NUMBER_WORDS) || w === 'zero' || w === 'zeroth') continue;
    // "no one", "any one", "the one": not a quantity.
    if (w === 'one' && /\b(no|any|the|every|some|each|that|this|which)\s+$/i.test(statement.slice(0, m.index ?? 0))) continue;
    const style = /(st|nd|rd|th)$/.test(w) || w === 'second' ? 'ordinal' : 'cardinal';
    add({ text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, kind: 'number', numberStyle: style, score: S.number - 5 });
  }

  // 4. Quoted terms ("Class A").
  for (const m of statement.matchAll(/["“]([^"”\n]{2,40})["”]/g)) {
    const inner = m[1];
    const start = (m.index ?? 0) + 1;
    add({ text: inner, start, end: start + inner.length, kind: 'quoted' });
  }

  if (!mostlyUpper) {
    // 5. Acronyms and chemical formulas: CO, CH4, O2, H2S, MSHA, SCSR.
    for (const m of statement.matchAll(/(?<![\p{L}\p{N}])(?:[A-Z]{2,}[0-9]*[A-Z0-9]*|[A-Z][a-z]?[0-9]+[A-Za-z0-9]*)(?![\p{L}\p{N}])/gu)) {
      if (/^[IVXLC]+$/.test(m[0]) && m[0].length <= 4) continue; // roman numerals
      add({ text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, kind: 'acronym' });
    }
    // 6. Capitalized terms not at a sentence start, e.g. "Class A", "Command Center", "Holmes".
    for (const m of statement.matchAll(/(?<![\p{L}\p{N}])\p{Lu}\p{Ll}+(?:[ -](?:\p{Lu}\p{Ll}*|\p{Lu}))*(?![\p{L}\p{N}])/gu)) {
      const start = m.index ?? 0;
      const multi = /[ -]/.test(m[0]);
      if (starts.has(start) && !multi) continue;
      add({ text: m[0], start, end: start + m[0].length, kind: 'capitalized', score: S.capitalized + (multi ? 5 : 0) });
    }
  }

  // 7. Technical lexicon, longest phrases first.
  const lex = [...new Set(cfg.lexicon.map((t) => t.toLowerCase()))].sort((a, b) => b.length - a.length);
  for (const term of lex) {
    for (const m of statement.matchAll(wordBoundaryRe(term))) {
      add({ text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, kind: 'lexicon', score: S.lexicon + (term.includes(' ') ? 4 : 0) });
    }
  }

  // 8. Fallback: long plain words.
  for (const m of statement.matchAll(/(?<![\p{L}\p{N}'’-])[\p{L}][\p{L}'’-]*[\p{L}](?![\p{L}\p{N}'’-])/gu)) {
    if (m[0].length < cfg.minFallbackWordLength || /['’]/.test(m[0])) continue;
    add({ text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, kind: 'word', score: S.word + Math.min(m[0].length, 14) / 2 });
  }

  return resolveOverlaps(out);
}

/** Keeps the best non-overlapping candidates (by score, then length), returned in text order. */
export function resolveOverlaps(cands: Candidate[]): Candidate[] {
  const sorted = cands.slice().sort((a, b) => b.score - a.score || b.end - b.start - (a.end - a.start) || a.start - b.start);
  const kept: Candidate[] = [];
  for (const c of sorted) {
    if (kept.some((k) => c.start < k.end && k.start < c.end)) continue;
    // Only the first occurrence of the same text, so the answer is unambiguous within the prompt.
    if (kept.some((k) => k.text.toLowerCase() === c.text.toLowerCase())) continue;
    kept.push(c);
  }
  return kept.sort((a, b) => a.start - b.start);
}
