/**
 * Rules quiz: blank a key token in one sentence of a rule. Pure.
 *
 * - Sentences come from the verbatim rule text (split at line breaks and sentence ends; list markers such as
 *   "A." or "1." at the start of a line are left out of the shown sentence, which is still a verbatim substring).
 * - Skipped: format 'pre' rules (forms, skill sheets), very short or very long sentences, and fragments
 *   (no leading capital, no closing . ! ?, or ending in ":"/";").
 * - Blanks: a number with its unit, a defined/quoted term, an acronym, a technical (lexicon) term or a
 *   capitalized term. Never plain words. A token that appears more than `maxBlanks` times is not used,
 *   so the answer is never visible elsewhere in the sentence.
 * - Distractors: the same token type from other rules of the same event: numbers with the same unit first,
 *   then terms from the same section, then the rest of the event.
 */
import type { Rule } from '../data/types';
import { findCandidates, type Candidate, type CandidateKind } from './candidates';
import { assembleMc, numericDistractors, same, uniqueAdd, type Question, type QuestionType } from './generate';
import { quizConfig, type QuizConfig } from './quizConfig';
import { randInt, shuffle, type Rng } from './rng';
import { escapeRegExp, tokenRe } from './text';

export const rulesQuizConfig = {
  minWords: 6,
  maxWords: 45,
  /** At most this many blanks per sentence (the real exam allows two). */
  maxBlanks: 2,
  /** Candidate kinds that may be blanked. Plain words and bare units are never blanked. */
  kinds: ['keyTerm', 'number', 'quoted', 'acronym', 'lexicon', 'capitalized'] as CandidateKind[]
};

export interface RuleSentence {
  /** "rule:<ruleId>#<n>", stable for stats. */
  id: string;
  rule: Rule;
  /** Verbatim substring of rule.text. */
  text: string;
  /** Offset of `text` inside rule.text. */
  offset: number;
  candidates: Candidate[];
}

const ABBREV = /(?:\b(?:e\.g|i\.e|etc|No|Nos|Fig|Figs|pg|pp|p|Mr|Mrs|Dr|St|vs|approx|Sec|Ch|U\.S|min|max|ft|in|lbs?|oz|cfm|fpm|psi|Inc|Co|Corp|Jr|Sr)|\b[A-Z])\.$/;
const LIST_MARKER = /^\s*(?:[A-Z]|[a-z]|\d{1,3}|[ivxlc]{1,5})[.)]\s+|^\s*\((?:[A-Za-z]|\d{1,3}|[ivxlc]{1,5})\)\s+|^\s*[•\-–]\s+/;

/** Splits one line into sentences, returning [start, end) offsets within the line. */
function splitLine(line: string): [number, number][] {
  const out: [number, number][] = [];
  let start = 0;
  const re = /[.!?]["”’)]*\s+(?=["“(]?[A-Z0-9])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const endPunct = m.index + m[0].trimEnd().length;
    const before = line.slice(start, m.index + 1);
    if (ABBREV.test(before)) continue; // "e.g. Class", "No. 5", initials
    out.push([start, endPunct]);
    start = m.index + m[0].length;
  }
  out.push([start, line.trimEnd().length]);
  return out;
}

export function isUsableSentence(s: string, cfg = rulesQuizConfig): boolean {
  const words = s.split(/\s+/).filter(Boolean).length;
  if (words < cfg.minWords || words > cfg.maxWords) return false;
  if (!/^["“(]?[A-Z]/.test(s)) return false; // fragments of tables start with digits or lower case
  if (!/[.!?]["”’)]*$/.test(s)) return false;
  if (/[:;,]$/.test(s)) return false;
  if (/\.{3}|…|_{3,}/.test(s)) return false; // elided text or form blanks
  if (/\s\d{1,2}\s+[A-Z][a-z]/.test(s)) return false; // skill-sheet rows that run a score column into the next step
  return true;
}

/** Verbatim sentences of a rule that can be asked about. Empty for format 'pre'. */
export function ruleSentences(rule: Rule, qcfg: QuizConfig = quizConfig, cfg = rulesQuizConfig): RuleSentence[] {
  if (rule.format === 'pre') return [];
  const out: RuleSentence[] = [];
  let lineStart = 0;
  for (const line of rule.text.split('\n')) {
    const marker = LIST_MARKER.exec(line);
    const body = marker ? marker[0].length : 0;
    for (const [a, b] of splitLine(line.slice(body))) {
      const raw = line.slice(body + a, body + b);
      const lead = raw.length - raw.trimStart().length;
      const text = raw.trim();
      if (!isUsableSentence(text, cfg)) continue;
      const offset = lineStart + body + a + lead;
      const candidates = sentenceCandidates(text, qcfg, cfg);
      out.push({ id: `rule:${rule.id}#${out.length}`, rule, text, offset, candidates });
    }
    lineStart += line.length + 1;
  }
  return out;
}

/** Positions of `t` in `s`: exact-case and any-case whole-token matches. */
function occurrences(s: string, t: string) {
  const exact = [...s.matchAll(tokenRe(t, 'gu'))].map((m) => m.index ?? 0);
  const any = [...s.matchAll(tokenRe(t, 'giu'))].length;
  return { exact, any };
}

function sentenceCandidates(text: string, qcfg: QuizConfig, cfg = rulesQuizConfig): Candidate[] {
  const raw = findCandidates(text, [], qcfg);
  const out: Candidate[] = [];
  for (const c of raw) {
    if (!cfg.kinds.includes(c.kind)) continue;
    let cand = c;
    // "The Contest Director" -> "Contest Director": a leading determiner is not part of the term.
    if (c.kind === 'capitalized') {
      const det = /^(?:The|A|An|This|That|These|Those|Each|Every|All|Any|No|Both)\s+(?=\p{Lu})/u.exec(c.text);
      if (det) cand = { ...c, text: c.text.slice(det[0].length), start: c.start + det[0].length };
      if (!/\s/.test(cand.text) && cand.start === 0) continue; // a lone sentence-initial word is not a term
    }
    // Citation parts such as the "CFR" in "30 CFR Part 49" are not worth asking.
    if (c.kind === 'acronym' && /\d\s*$/.test(text.slice(0, c.start))) continue;
    // Words printed in capitals on forms ("NOTE", "VALVE", "COOLER") are not acronyms.
    if (c.kind === 'acronym' && !/\d/.test(c.text) && (c.text.length > 5 || NOT_ACRONYMS.has(c.text))) continue;
    // A number takes its unit with it: "15 minutes", "200 feet".
    if (c.kind === 'number' && c.numberStyle === 'digits' && c.unit && c.unit !== '%') {
      const m = new RegExp(`^\\s+(${escapeRegExp(c.unit)})(?![\\p{L}\\p{N}])`, 'iu').exec(text.slice(c.end));
      if (m) cand = { ...c, text: text.slice(c.start, c.end + m[0].length), end: c.end + m[0].length };
    }
    if (c.kind === 'number' && c.numberStyle === 'digits') {
      // Digits only with a unit or percent ("15 minutes", "19.5 percent"); never rule/figure/page references.
      const pct = /%$/.test(cand.text) || /^\s+percent\b/i.test(text.slice(cand.end));
      if (cand === c && !pct) continue;
      if (/\b(?:rule|rules|figure|figures|section|sections|page|pages|p|pp|pg|no|item|step|chapter|ch|appendix|part)\.?\s*$/i.test(text.slice(0, c.start))) continue;
    }
    if (cand.text.length < 2 && c.kind !== 'number') continue;
    const occ = occurrences(text, cand.text);
    // Cap repeated blanks; skip when a different-case copy would stay visible.
    if (occ.exact.length === 0 || occ.exact.length > cfg.maxBlanks || occ.any !== occ.exact.length) continue;
    out.push(cand);
  }
  return out;
}

/** All askable sentences of an event's rules (only those with at least one blankable token). */
export function ruleSentenceIndex(rules: Rule[], qcfg: QuizConfig = quizConfig): RuleSentence[] {
  // A single capitalized word that also appears in lower case in these rules is an ordinary word
  // capitalized by position ("Exception:", "Use the ..."), not a term.
  const lower = new Set<string>();
  for (const r of rules) for (const m of r.text.matchAll(/(?<![\p{L}])\p{Ll}[\p{L}'-]*/gu)) lower.add(m[0]);
  return rules
    .flatMap((r) => ruleSentences(r, qcfg))
    .map((s) => ({ ...s, candidates: s.candidates.filter((c) => !(c.kind === 'capitalized' && !/\s/.test(c.text) && lower.has(c.text.toLowerCase()))) }))
    .filter((s) => s.candidates.length > 0);
}

/** Segments around every exact occurrence of the blank (at most maxBlanks). Joining with the answer gives the sentence. */
export function ruleSegments(text: string, answer: string): string[] {
  const parts: string[] = [];
  let last = 0;
  for (const m of text.matchAll(tokenRe(answer, 'gu'))) {
    const i = m.index ?? 0;
    if (i < last) continue;
    parts.push(text.slice(last, i));
    last = i + m[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}

const NOT_ACRONYMS = new Set(['NOTE', 'NOTES', 'STEP', 'ITEM', 'PAGE', 'PART', 'MODE', 'NO', 'OK', 'ON', 'OFF', 'AND', 'OR', 'THE', 'YES', 'NONE', 'ALL', 'EACH', 'TEST', 'OPEN', 'TIME']);

const numValue = (t: string) => Number((/^[\d.,]+/.exec(t)?.[0] ?? '').replace(/,/g, ''));

function distractorsFor(item: RuleSentence, blank: Candidate, all: RuleSentence[], rng: Rng, qcfg: QuizConfig): string[] {
  const max = qcfg.distractorCount;
  const out: string[] = [];
  const exclude = [blank.text];
  const visible = (t: string) => tokenRe(t, 'iu').test(item.text);
  const others = all.filter((s) => s.rule.event === item.rule.event && s.rule.id !== item.rule.id);
  const sameSection = (s: RuleSentence) => !!item.rule.sectionId && s.rule.sectionId === item.rule.sectionId;
  // An option that contains the answer (or is contained in it), e.g. "tail captain" for "captain", is never offered.
  const nested = (t: string) => blank.kind !== 'number' && (tokenRe(blank.text, 'iu').test(t) || tokenRe(t, 'iu').test(blank.text));
  const tokens = (pred: (c: Candidate, s: RuleSentence) => boolean, list: RuleSentence[]) =>
    shuffle(list.flatMap((s) => s.candidates.filter((c) => pred(c, s)).map((c) => c.text)), rng).filter((t) => !visible(t) && !nested(t));

  if (blank.kind === 'number') {
    const withUnit = blank.text !== blank.text.replace(/\s+\p{L}.*$/u, '');
    const v = numValue(blank.text);
    const sameKind = (c: Candidate) => c.kind === 'number' && c.numberStyle === blank.numberStyle && (c.unit ?? '') === (blank.unit ?? '') && (c.text !== c.text.replace(/\s+\p{L}.*$/u, '')) === withUnit && numValue(c.text) !== v;
    uniqueAdd(out, tokens(sameKind, others.filter(sameSection)), exclude, max);
    uniqueAdd(out, tokens(sameKind, others), exclude, max);
    if (out.length < max && blank.numberStyle === 'digits') {
      // Fall back to nearby values with the same unit text, e.g. "15 minutes" -> "20 minutes".
      const num = /^[\d.,]+%?/.exec(blank.text)?.[0] ?? '';
      const rest = blank.text.slice(num.length);
      uniqueAdd(out, numericDistractors(num, rng, blank.unit).map((n) => n + rest).filter((t) => !visible(t)), exclude, max);
    }
    return out;
  }
  const group = qcfg.termGroups.find((g) => g.some((t) => same(t, blank.text)));
  if (group) uniqueAdd(out, shuffle(group.filter((t) => !visible(t) && !nested(t)), rng), exclude, max);
  const kindsFor: Record<string, CandidateKind[]> = {
    acronym: ['acronym'],
    capitalized: ['capitalized', 'quoted'],
    quoted: ['quoted', 'capitalized'],
    keyTerm: ['keyTerm', 'lexicon'],
    lexicon: ['lexicon', 'keyTerm']
  };
  const kinds = kindsFor[blank.kind] ?? ['lexicon'];
  const words = blank.text.split(/\s+/).length;
  // Same case style as the answer, so the odd one out never gives it away.
  const lowerAnswer = /^\p{Ll}/u.test(blank.text);
  const caseOk = (t: string) => (lowerAnswer ? /^\p{Ll}/u.test(t) : !/^\p{Ll}/u.test(t));
  const similar = (c: Candidate) => kinds.includes(c.kind) && Math.abs(c.text.split(/\s+/).length - words) <= 1 && caseOk(c.text);
  uniqueAdd(out, tokens(similar, others.filter(sameSection)), exclude, max);
  uniqueAdd(out, tokens(similar, others), exclude, max);
  if (blank.kind !== 'acronym') uniqueAdd(out, shuffle(qcfg.lexicon.filter((t) => Math.abs(t.split(/\s+/).length - words) <= 1 && !visible(t) && !nested(t)), rng), exclude, max);
  // Lexicon fallbacks are lower case; capitalize them for a capitalized answer.
  const upper = /^\p{Lu}/u.test(blank.text) && blank.kind !== 'acronym';
  return out.map((o) => (upper && /^\p{Ll}/u.test(o) ? o[0].toUpperCase() + o.slice(1) : o));
}

/**
 * One question from a rule sentence, or null if no blank yields enough distractors (multiple choice).
 * Tries candidates in random order, best-scoring first.
 */
export function generateRuleQuestion(item: RuleSentence, all: RuleSentence[], type: QuestionType, rng: Rng, qcfg: QuizConfig = quizConfig): Question | null {
  const ordered = shuffle(item.candidates, rng).sort((a, b) => b.score - a.score);
  // Some variety among equally good blanks.
  if (ordered.length > 1 && ordered[1].score >= ordered[0].score - qcfg.blankTierSpread && randInt(rng, 2) === 1) ordered.unshift(ordered.splice(1, 1)[0]);
  for (const blank of ordered) {
    const base = {
      factId: item.id,
      source: 'rule' as const,
      ruleId: item.rule.id,
      segments: ruleSegments(item.text, blank.text),
      answer: blank.text,
      answerKind: blank.kind,
      unit: blank.unit
    };
    if (type === 'fill') {
      // "15 minutes": typing just "15" is also right (the unit is part of the printed blank).
      const num = blank.kind === 'number' ? /^[\d.,]+%?(?=\s)/.exec(blank.text)?.[0] : undefined;
      return { ...base, type: 'fill', ...(num ? { alternatives: [num] } : {}) };
    }
    const d = distractorsFor(item, blank, all, rng, qcfg);
    if (d.length >= qcfg.distractorCount) return assembleMc(base, d.slice(0, qcfg.distractorCount), rng);
  }
  return null;
}

/** Session order with sentences from different rules first (one per rule, then seconds, ...). */
export function spreadByRule<T extends { rule: Rule }>(items: T[]): T[] {
  const seen = new Map<string, number>();
  return items
    .map((it, i) => {
      const n = seen.get(it.rule.id) ?? 0;
      seen.set(it.rule.id, n + 1);
      return { it, n, i };
    })
    .sort((a, b) => a.n - b.n || a.i - b.i)
    .map((x) => x.it);
}
