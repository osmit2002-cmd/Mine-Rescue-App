/**
 * Question generators. Pure functions: same inputs + same rng => same question.
 *
 * Multiple choice
 *  - Fact has `answer`: correct = answer; 3 distractors from fact.distractors, then answers of other facts
 *    in the same category, then any other answers. Falls back to cloze if fewer than 3 are available.
 *  - Otherwise (the usual case): blank one candidate term (see candidates.ts) and offer it plus 3 options
 *    of the same kind: other numbers with the same unit, units of the same family, or terms of the same
 *    kind drawn from other facts (same category first) and the technical lexicon.
 * Fill-in
 *  - Blank a candidate (key term, number, unit, technical term...) and type it.
 *  - A short `answer` (<= maxTypedAnswerWords) is asked as "type the answer" to the statement.
 */
import type { Fact } from '../data/types';
import { findCandidates, type Candidate, type CandidateKind } from './candidates';
import { quizConfig, type QuizConfig } from './quizConfig';
import { randInt, shuffle, type Rng } from './rng';
import { CARDINAL_WORDS, NUMERIC_RE, ORDINAL_WORDS, normalizeAnswer, tokenRe } from './text';

export type QuestionType = 'mc' | 'fill';
export type QuizMode = QuestionType | 'mixed';

export interface Question {
  factId: string;
  type: QuestionType;
  /** 'answer' = uses the fact's answer field; 'cloze' = a blanked statement; 'part' = Identification of Parts. */
  source: 'answer' | 'cloze' | 'part' | 'rule';
  /** Rules quiz: the rule the sentence comes from. */
  ruleId?: string;
  /** Fill-in: other accepted answers (e.g. the bare number for a "15 minutes" blank). */
  alternatives?: string[];
  /**
   * Prompt split around the blank(s): segments.length = blanks + 1. For source 'answer' this is
   * [statement] (no blank). Every occurrence of the answer is blanked so the prompt never gives it away.
   */
  segments: string[];
  answer: string;
  answerKind: CandidateKind | 'answer' | 'part';
  /** Parts questions: the table and the part number asked about. */
  partTableId?: string;
  partNo?: string;
  /** Multiple choice only: options in display order (contains `answer`). */
  choices?: string[];
  correctIndex?: number;
  /** Unit shown after a blanked number, for context (already visible in the segments). */
  unit?: string;
}

/** Precomputed candidates per fact; build once per content load. */
export type CandidateIndex = Map<string, Candidate[]>;

export function buildCandidateIndex(facts: Fact[], cfg: QuizConfig = quizConfig): CandidateIndex {
  const idx: CandidateIndex = new Map();
  for (const f of facts) idx.set(f.id, factCandidates(f, cfg));
  return idx;
}

/** Index where the printed reference starts (statement length if there is none). */
export function referenceStart(f: Fact): number {
  const ref = f.reference?.trim();
  const end = f.statement.trimEnd();
  return ref && end.endsWith(ref) ? end.length - ref.length : f.statement.length;
}

/** Candidates for a fact, excluding the printed citation at the end (e.g. "Ch.-3 pg. 39"). */
export function factCandidates(f: Fact, cfg: QuizConfig = quizConfig): Candidate[] {
  const cut = referenceStart(f);
  return findCandidates(f.statement, f.keyTerms, cfg).filter((c) => c.end <= cut);
}

/** Picks a blank among the top-scoring tier of candidates. */
export function pickBlank(cands: Candidate[], rng: Rng, cfg: QuizConfig = quizConfig): Candidate | null {
  if (!cands.length) return null;
  const best = Math.max(...cands.map((c) => c.score));
  const tier = cands.filter((c) => c.score >= best - cfg.blankTierSpread);
  return tier[randInt(rng, tier.length)];
}

/** Splits the statement at every whole-word occurrence of the blanked text. */
export function clozeSegments(statement: string, blank: Candidate, protectFrom = statement.length): string[] {
  // Blank the candidate's own position plus every other whole-token occurrence of the same text,
  // except inside the protected tail (the printed reference/citation).
  const spans = [...statement.matchAll(tokenRe(blank.text))]
    .map((m) => ({ index: m.index ?? 0, len: m[0].length }))
    .filter((m) => m.index + m.len <= protectFrom);
  if (!spans.some((m) => m.index === blank.start)) spans.push({ index: blank.start, len: blank.end - blank.start });
  spans.sort((x, y) => x.index - y.index);
  const parts: string[] = [];
  let last = 0;
  for (const sp of spans) {
    if (sp.index < last) continue; // overlapping match (defensive)
    parts.push(statement.slice(last, sp.index));
    last = sp.index + sp.len;
  }
  parts.push(statement.slice(last));
  return parts;
}

/** Same option, ignoring case/punctuation and a plural "s" (so "seal" and "seals" are never both offered). */
const stem = (s: string) => normalizeAnswer(s).replace(/(?<=\p{L}{3})s\b/gu, '').replace(/ /g, '');
export const same = (a: string, b: string) => stem(a) === stem(b);

export function uniqueAdd(target: string[], items: Iterable<string>, exclude: string[], max: number) {
  for (const it of items) {
    if (target.length >= max) return;
    if (!it || !it.trim()) continue;
    if ([...target, ...exclude].some((x) => same(x, it))) continue;
    target.push(it);
  }
}

function formatLike(n: number, template: string): string {
  const hasComma = template.includes(',');
  const pct = /%\s*$/.test(template) ? (template.includes(' %') ? ' %' : '%') : '';
  const decimals = (/\.(\d+)/.exec(template)?.[1].length) ?? 0;
  let s = decimals ? n.toFixed(decimals) : String(Math.round(n));
  if (hasComma || (n >= 10000 && !decimals)) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return s + pct;
}

/** Plausible wrong numbers near the correct value, formatted like it. */
export function numericDistractors(answer: string, rng: Rng, unit?: string): string[] {
  const n = Number(answer.replace(/[,%\s]/g, ''));
  if (!Number.isFinite(n)) return [];
  const decimals = (/\.(\d+)/.exec(answer)?.[1].length) ?? 0;
  const step = decimals ? Math.pow(10, -decimals) * 5 : n >= 1000 ? Math.pow(10, Math.floor(Math.log10(n)) - 1) * 5 : n >= 100 ? 25 : n >= 20 ? 5 : 1;
  const raw = [n * 2, n / 2, n + step, n - step, n + 2 * step, n * 1.5, n * 3, n - 2 * step, n * 10, n / 10];
  const ok = raw.filter((x) => x > 0 && x !== n && (decimals || Number.isInteger(x)) && (!(/%/.test(answer) || unit === 'percent' || unit === '%') || x <= 100));
  return shuffle(ok.slice(0, 6), rng).map((x) => formatLike(x, answer));
}

export interface GenContext {
  facts: Fact[];
  index: CandidateIndex;
  rng: Rng;
  cfg?: QuizConfig;
}

/**
 * Other facts in distractor-preference order: same category (if the content has categories), then
 * same section, then facts with nearby numbers, each tier shuffled.
 */
export function otherFactsOrdered(fact: Fact, facts: Fact[], rng: Rng, cfg: QuizConfig = quizConfig): Fact[] {
  const pos = (f: Fact) => (f.number !== undefined && /^\d+$/.test(f.number) ? Number(f.number) : f.order);
  const me = pos(fact);
  const tier = (f: Fact) => {
    if (fact.event && f.event !== fact.event) return 4; // other (or unknown) contest event: never used
    if (fact.category && f.category === fact.category) return 0;
    const near = Math.abs(pos(f) - me) <= cfg.nearbyFactWindow;
    const sameSection = !!fact.section && f.section === fact.section;
    // When every fact shares one section (2026 content), "nearby numbers" is the useful signal.
    return near ? 1 : sameSection ? 2 : 3;
  };
  const buckets: Fact[][] = [[], [], [], [], []];
  for (const f of facts) if (f.id !== fact.id) buckets[tier(f)].push(f);
  buckets.pop();
  return buckets.flatMap((b) => shuffle(b, rng));
}

/** Wrong options of the same kind as the blank. */
export function clozeDistractors(fact: Fact, blank: Candidate, ctx: GenContext): string[] {
  const cfg = ctx.cfg ?? quizConfig;
  const max = cfg.distractorCount;
  const out: string[] = [];
  // Never offer something that already appears elsewhere in the statement (it could also fit).
  const visible = (t: string) => tokenRe(t, 'iu').test(fact.statement);
  const numbersInStatement = new Set([...fact.statement.matchAll(NUMERIC_RE)].map((m) => Number(m[0].replace(/,/g, ''))));
  const numberVisible = (t: string) => numbersInStatement.has(Number(t.replace(/[,%\s]/g, '')));
  const exclude = [blank.text];
  const others = otherFactsOrdered(fact, ctx.facts, ctx.rng, cfg);
  const fromOthers = (pred: (c: Candidate) => boolean) =>
    others.flatMap((f) => (ctx.index.get(f.id) ?? []).filter(pred).map((c) => c.text)).filter((t) => !visible(t));

  if (blank.kind === 'number' && blank.numberStyle !== 'digits') {
    const pool = blank.numberStyle === 'ordinal' ? ORDINAL_WORDS : CARDINAL_WORDS.slice(0, 12);
    const cap = (w: string) => (/^\p{Lu}/u.test(blank.text) ? w[0].toUpperCase() + w.slice(1) : w);
    const at = pool.findIndex((w) => same(w, blank.text));
    const near = pool.filter((w, i) => !same(w, blank.text) && (at < 0 || Math.abs(i - at) <= 3) && !visible(w));
    uniqueAdd(out, shuffle(near, ctx.rng).map(cap), exclude, max);
    uniqueAdd(out, shuffle(pool.filter((w) => !visible(w)), ctx.rng).map(cap), exclude, max);
    return out;
  }
  if (blank.kind === 'number') {
    // Real values from other facts with the same unit and the same style (integer vs. decimal places).
    const decimals = (t: string) => /\.(\d+)/.exec(t)?.[1].length ?? 0;
    const value = (t: string) => Number(t.replace(/[,%\s]/g, ''));
    const v = value(blank.text);
    // "5 to 15 volume percent": treat as a percentage even when the unit is a few words away.
    const isPct = blank.unit === 'percent' || blank.unit === '%' || /^[^.;]{0,25}?\bpercent\b/i.test(fact.statement.slice(blank.end));
    const sameUnit = fromOthers(
      (c) =>
        c.kind === 'number' &&
        c.numberStyle === 'digits' &&
        c.unit === blank.unit &&
        decimals(c.text) === decimals(blank.text) &&
        value(c.text) > 0 &&
        Math.max(value(c.text), v) / Math.max(Math.min(value(c.text), v), 1e-9) <= 10 &&
        (!isPct || value(c.text) <= 100) &&
        !numberVisible(c.text)
    );
    // Decimal constants (e.g. specific gravities) are best confused with each other; integers get one real value.
    uniqueAdd(out, decimals(blank.text) >= 2 ? sameUnit : sameUnit.slice(0, 1), exclude, max);
    uniqueAdd(out, numericDistractors(blank.text, ctx.rng, isPct ? 'percent' : blank.unit).filter((t) => !numberVisible(t)), exclude, max);
    uniqueAdd(out, sameUnit, exclude, max);
    return out;
  }
  if (blank.kind === 'unit') {
    const family = blank.unit ? cfg.units[blank.unit] ?? [] : [];
    const isPlural = (u: string) => /s$/i.test(u) || /^feet$/i.test(u);
    // Spelling variants of the answer's own unit ("foot" for "feet", "minute" for "minutes") are not wrong answers.
    const UNIT_ALIASES: Record<string, string> = { feet: 'foot', ft: 'foot', inches: 'inch', in: 'inch', metres: 'meter', metre: 'meter', meters: 'meter', hrs: 'hour', min: 'minute', lbs: 'pound', lb: 'pound', litres: 'liter', litre: 'liter', liters: 'liter', kg: 'kilogram', psig: 'psi', amperes: 'amp' };
    const unitKey = (u: string) => {
      const l = u.toLowerCase();
      return UNIT_ALIASES[l] ?? l.replace(/(?<=..)s$/, '');
    };
    const ok = (u: string) => u.length > 2 && isPlural(u) === isPlural(blank.text) && unitKey(u) !== unitKey(blank.text) && !visible(u);
    uniqueAdd(out, shuffle(family.filter(ok), ctx.rng), exclude, max);
    const anyUnits = Object.values(cfg.units).flat().filter(ok);
    uniqueAdd(out, shuffle(anyUnits, ctx.rng), exclude, max);
    return out;
  }
  // Interchangeable terms from quizConfig.termGroups come first.
  const group = cfg.termGroups.find((g) => g.some((t) => same(t, blank.text)));
  if (group) uniqueAdd(out, shuffle(group.filter((t) => !visible(t)), ctx.rng), exclude, max);
  const kindGroup: Record<string, CandidateKind[]> = {
    acronym: ['acronym'],
    capitalized: ['capitalized', 'quoted'],
    quoted: ['quoted', 'capitalized'],
    keyTerm: ['keyTerm', 'lexicon'],
    lexicon: ['lexicon', 'keyTerm'],
    word: ['word', 'lexicon']
  };
  const kinds = kindGroup[blank.kind] ?? ['lexicon'];
  const words = blank.text.split(/\s+/).length;
  // Prefer options with a similar number of words.
  uniqueAdd(out, fromOthers((c) => kinds.includes(c.kind) && Math.abs(c.text.split(/\s+/).length - words) <= 1), exclude, max);
  if (blank.kind !== 'acronym') {
    const lex = shuffle(cfg.lexicon.filter((t) => Math.abs(t.split(/\s+/).length - words) <= 1 && !visible(t)), ctx.rng);
    uniqueAdd(out, lex, exclude, max);
    uniqueAdd(out, fromOthers((c) => c.kind !== 'number' && c.kind !== 'unit'), exclude, max);
  }
  // Match the capitalisation style of the answer.
  const upperFirst = /^\p{Lu}/u.test(blank.text) && blank.kind !== 'acronym';
  return out.map((o) => (upperFirst && /^\p{Ll}/u.test(o) ? o[0].toUpperCase() + o.slice(1) : o));
}

export function assembleMc(base: Omit<Question, 'choices' | 'correctIndex' | 'type'>, distractors: string[], rng: Rng): Question {
  const choices = shuffle([base.answer, ...distractors], rng);
  return { ...base, type: 'mc', choices, correctIndex: choices.findIndex((c) => c === base.answer) };
}

function clozeBase(fact: Fact, blank: Candidate): Omit<Question, 'choices' | 'correctIndex' | 'type'> {
  return { factId: fact.id, source: 'cloze', segments: clozeSegments(fact.statement, blank, referenceStart(fact)), answer: blank.text, answerKind: blank.kind, unit: blank.unit };
}

export function generateMultipleChoice(fact: Fact, ctx: GenContext): Question | null {
  const cfg = ctx.cfg ?? quizConfig;
  const need = cfg.distractorCount;
  if (fact.answer) {
    const d: string[] = [];
    uniqueAdd(d, shuffle(fact.distractors, ctx.rng), [fact.answer], need);
    const others = otherFactsOrdered(fact, ctx.facts, ctx.rng, cfg);
    uniqueAdd(d, others.map((f) => f.answer ?? ''), [fact.answer], need);
    if (d.length >= need) return assembleMc({ factId: fact.id, source: 'answer', segments: [fact.statement], answer: fact.answer, answerKind: 'answer' }, d, ctx.rng);
  }
  const cands = ctx.index.get(fact.id) ?? factCandidates(fact, cfg);
  // Try the preferred tier first, then any candidate that yields enough options.
  const first = pickBlank(cands, ctx.rng, cfg);
  const order = first ? [first, ...shuffle(cands.filter((c) => c !== first), ctx.rng).sort((a, b) => b.score - a.score)] : [];
  for (const blank of order) {
    const d = clozeDistractors(fact, blank, ctx);
    if (d.length >= need) return assembleMc(clozeBase(fact, blank), d.slice(0, need), ctx.rng);
  }
  return null;
}

export function generateFillIn(fact: Fact, ctx: GenContext): Question | null {
  const cfg = ctx.cfg ?? quizConfig;
  if (fact.answer && fact.answer.trim().split(/\s+/).length <= cfg.maxTypedAnswerWords) {
    return { factId: fact.id, type: 'fill', source: 'answer', segments: [fact.statement], answer: fact.answer, answerKind: 'answer' };
  }
  const cands = ctx.index.get(fact.id) ?? factCandidates(fact, cfg);
  const blank = pickBlank(cands, ctx.rng, cfg);
  if (!blank) return null;
  return { ...clozeBase(fact, blank), type: 'fill' };
}

/** Generates a question of the requested mode, falling back to the other type if needed. */
export function generateQuestion(fact: Fact, mode: QuizMode, ctx: GenContext): Question | null {
  const cfg = ctx.cfg ?? quizConfig;
  const type: QuestionType = mode === 'mixed' ? (ctx.rng() < cfg.mixedMcRatio ? 'mc' : 'fill') : mode;
  const primary = type === 'mc' ? generateMultipleChoice(fact, ctx) : generateFillIn(fact, ctx);
  if (primary) return primary;
  return type === 'mc' ? generateFillIn(fact, ctx) : generateMultipleChoice(fact, ctx);
}
