import { describe, expect, it } from 'vitest';
import type { Fact } from '../data/types';
import { findCandidates } from './candidates';
import { buildCandidateIndex, clozeSegments, factCandidates, referenceStart, generateFillIn, generateMultipleChoice, generateQuestion, numericDistractors, otherFactsOrdered, pickBlank } from './generate';
import { normalizeAnswer } from './text';
import { quizConfig } from './quizConfig';
import { seededRng } from './rng';

let n = 0;
const fact = (statement: string, extra: Partial<Fact> = {}): Fact => ({ id: `f${++n}`, number: String(n), statement, keyTerms: [], distractors: [], order: n, section: 'SOF', ...extra });

// Statements modelled on the 2026 MSHA statements of fact (verbatim style, no answer field).
const facts: Fact[] = [
  fact('Three elements must be present for an explosion to occur: fuel, oxygen, and heat (ignition).'),
  fact('Seals in high volatile coalbeds are often placed 1,000 feet or more from the fire area.'),
  fact('The explosive range of methane in air is 5 to 15 volume percent.'),
  fact('The specific gravity of methane is 0.5545.'),
  fact('The specific gravity of carbon dioxide is 1.5291.'),
  fact('The specific gravity of carbon monoxide is 0.9672.'),
  fact('Methane is lighter than air.'),
  fact('Hydrogen sulfide is highly toxic.'),
  fact('Electrical fires are “Class C” fires.'),
  fact('The TLV-TWA for Carbon Monoxide is 50 ppm.'),
  fact('The IDLH of Carbon Dioxide is 40,000 ppm.'),
  fact('It is recommended that team checks be conducted every 15 to 20 minutes.'),
  fact('The first priority of rescue and recovery operations is team safety.'),
  fact('Pools of water can release water soluble gases into the air when they are stirred up.'),
  fact('Permanent seals should be well hitched in the roof, floor, and ribs to make them as airtight as possible.')
];
const index = buildCandidateIndex(facts);
const ctx = (seed = 1) => ({ facts, index, rng: seededRng(seed) });

/** Rebuilds the statement from a cloze question (proves the text is unaltered apart from the blank). */
function rebuild(statement: string, segments: string[], answer: string): string {
  // Fill each blank with the original text at that position.
  let out = '';
  let pos = 0;
  segments.forEach((seg, i) => {
    out += seg;
    pos += seg.length;
    if (i < segments.length - 1) {
      const original = statement.slice(pos, pos + answer.length);
      expect(normalizeAnswer(original)).toBe(normalizeAnswer(answer));
      out += original;
      pos += answer.length;
    }
  });
  return out;
}

describe('findCandidates', () => {
  it('finds numbers with their unit, and the unit itself', () => {
    const c = findCandidates('Seals are often placed 1,000 feet or more from the fire area.');
    const num = c.find((x) => x.kind === 'number')!;
    expect(num.text).toBe('1,000');
    expect(num.unit).toBe('feet');
    expect(c.some((x) => x.kind === 'unit' && x.text === 'feet' && x.unit === 'length')).toBe(true);
  });
  it('finds decimals and percent signs', () => {
    expect(findCandidates('The specific gravity of methane is 0.5545.').find((x) => x.kind === 'number')?.text).toBe('0.5545');
    expect(findCandidates('Oxygen below 19.5% is deficient.').find((x) => x.kind === 'number')?.text).toBe('19.5%');
  });
  it('finds number words, quoted terms, acronyms and technical terms', () => {
    const c = findCandidates('Three elements must be present: fuel, oxygen, and heat.');
    expect(c.find((x) => x.text === 'Three')?.numberStyle).toBe('cardinal');
    expect(c.some((x) => x.text === 'oxygen' && x.kind === 'lexicon')).toBe(true);
    expect(findCandidates('Electrical fires are “Class C” fires.').some((x) => x.kind === 'quoted' && x.text === 'Class C')).toBe(true);
    expect(findCandidates('The IDLH of CO is 1200 ppm.').filter((x) => x.kind === 'acronym').map((x) => x.text)).toEqual(['IDLH', 'CO']);
    expect(findCandidates('The first priority is team safety.').find((x) => x.text === 'first')?.numberStyle).toBe('ordinal');
  });
  it('prefers supplied key terms and never returns overlapping candidates', () => {
    const c = findCandidates('Hydrogen sulfide is highly toxic.', ['highly toxic']);
    const best = c.reduce((a, b) => (b.score > a.score ? b : a));
    expect(best.kind).toBe('keyTerm');
    const sorted = c.slice().sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].start).toBeGreaterThanOrEqual(sorted[i - 1].end);
  });
  it('skips a capitalized word at a sentence start but keeps multi-word names', () => {
    const c = findCandidates('Barefaced exploration should stop. The Universal Gas Law applies.');
    expect(c.some((x) => x.text === 'Barefaced' && x.kind === 'capitalized')).toBe(false);
    expect(c.some((x) => x.text === 'The Universal Gas Law')).toBe(true);
  });
  it('always finds something to blank in an ordinary sentence', () => {
    for (const f of facts) expect(findCandidates(f.statement).length).toBeGreaterThan(0);
  });
});

describe('clozeSegments', () => {
  it('blanks every occurrence so the prompt never shows the answer', () => {
    const f = facts[13];
    const blank = findCandidates(f.statement).find((c) => c.text === 'water')!;
    const seg = clozeSegments(f.statement, blank);
    expect(seg).toHaveLength(3);
    expect(seg.join('')).not.toMatch(/\bwater\b/);
    expect(rebuild(f.statement, seg, 'water')).toBe(f.statement);
  });
});

describe('generateMultipleChoice (no answer field: cloze)', () => {
  it('builds a three-choice question with the correct answer present exactly once', () => {
    for (let seed = 1; seed < 40; seed++) {
      for (const f of facts) {
        const q = generateMultipleChoice(f, ctx(seed));
        expect(q).not.toBeNull();
        expect(q!.choices).toHaveLength(quizConfig.distractorCount + 1);
        expect(q!.choices![q!.correctIndex!]).toBe(q!.answer);
        const norm = q!.choices!.map(normalizeAnswer);
        expect(new Set(norm).size).toBe(norm.length);
        expect(rebuild(f.statement, q!.segments, q!.answer)).toBe(f.statement);
      }
    }
  });
  it('uses numbers with the same unit/style as distractors for a number blank', () => {
    const f = facts[3]; // 0.5545
    const blank = index.get(f.id)!.find((c) => c.text === '0.5545')!;
    expect(blank).toBeDefined();
    let q = null;
    for (let seed = 1; !q || q.answer !== '0.5545'; seed++) q = generateMultipleChoice(f, ctx(seed));
    for (const c of q.choices!) expect(c).toMatch(/^\d\.\d{4}$/);
  });
  it('uses plausible terms for a gas blank', () => {
    const f = facts[6]; // Methane is lighter than air.
    let q = null;
    for (let seed = 1; !q || q.answer !== 'Methane'; seed++) q = generateMultipleChoice(f, ctx(seed));
    const gases = quizConfig.termGroups[0].map(normalizeAnswer);
    for (const c of q.choices!) expect(gases).toContain(normalizeAnswer(c));
  });
  it('is deterministic for a given seed', () => {
    expect(generateMultipleChoice(facts[1], ctx(42))).toEqual(generateMultipleChoice(facts[1], ctx(42)));
  });
});

describe('generateMultipleChoice (answer field)', () => {
  const withAnswer = [
    fact('Which gas smells like rotten eggs?', { answer: 'Hydrogen sulfide', distractors: ['Methane', 'Nitrogen', 'Hydrogen sulfide'], category: 'Gases' }),
    fact('Which gas is lighter than air?', { answer: 'Methane', category: 'Gases' }),
    fact('Which gas supports combustion?', { answer: 'Oxygen', category: 'Gases' }),
    fact('Which is the first priority?', { answer: 'Team safety', category: 'Priorities' })
  ];
  const c2 = { facts: withAnswer, index: buildCandidateIndex(withAnswer), rng: seededRng(3) };
  it('uses supplied distractors, never duplicating the answer', () => {
    const q = generateMultipleChoice(withAnswer[0], c2)!;
    expect(q.source).toBe('answer');
    expect(q.choices!.map(normalizeAnswer).filter((c) => c === 'hydrogen sulfide')).toHaveLength(1);
    expect(q.choices!.every((c) => ['Hydrogen sulfide', 'Methane', 'Nitrogen'].includes(c))).toBe(true);
  });
  it('falls back to answers of other facts in the same category', () => {
    const q = generateMultipleChoice(withAnswer[1], c2)!;
    expect(q.source).toBe('answer');
    expect(q.choices!.sort()).toEqual(['Hydrogen sulfide', 'Methane', 'Oxygen']);
  });
  it('falls back to a cloze when not enough answers exist', () => {
    const lone = [fact('Which colour is the lifeline tag?', { answer: 'Orange' })];
    const q = generateMultipleChoice(lone[0], { facts: lone, index: buildCandidateIndex(lone), rng: seededRng(1) });
    expect(q === null || q.source === 'cloze').toBe(true);
  });
});

describe('generateFillIn and generateQuestion', () => {
  it('blanks a candidate and keeps the rest verbatim', () => {
    const f = facts[1];
    const q = generateFillIn(f, ctx(5))!;
    expect(q.type).toBe('fill');
    expect(q.segments.length).toBeGreaterThan(1);
    expect(rebuild(f.statement, q.segments, q.answer)).toBe(f.statement);
  });
  it('asks short explicit answers directly', () => {
    const f = fact('What is the first priority?', { answer: 'Team safety' });
    const q = generateFillIn(f, ctx())!;
    expect(q.source).toBe('answer');
    expect(q.segments).toEqual([f.statement]);
  });
  it('honours the requested mode and mixes in mixed mode', () => {
    expect(generateQuestion(facts[0], 'fill', ctx())!.type).toBe('fill');
    expect(generateQuestion(facts[0], 'mc', ctx())!.type).toBe('mc');
    const types = new Set(Array.from({ length: 30 }, (_, i) => generateQuestion(facts[0], 'mixed', ctx(i))!.type));
    expect(types).toEqual(new Set(['mc', 'fill']));
  });
  it('pickBlank stays within the top tier', () => {
    const c = findCandidates(facts[1].statement);
    const best = Math.max(...c.map((x) => x.score));
    for (let s = 0; s < 20; s++) expect(pickBlank(c, seededRng(s))!.score).toBeGreaterThanOrEqual(best - quizConfig.blankTierSpread);
    expect(pickBlank([], seededRng(1))).toBeNull();
  });
});

describe('distractor sources', () => {
  it('numericDistractors keeps format and stays positive and within percent', () => {
    const d = numericDistractors('1,000', seededRng(1));
    expect(d.length).toBeGreaterThan(2);
    for (const x of d) expect(x).toMatch(/^\d{1,3}(,\d{3})*$/);
    for (const x of numericDistractors('78', seededRng(2), 'percent')) expect(Number(x)).toBeLessThanOrEqual(100);
  });
  it('orders other facts by category, then nearby numbers', () => {
    const order = otherFactsOrdered(facts[5], facts, seededRng(1), { ...quizConfig, nearbyFactWindow: 2 });
    const firstFour = order.slice(0, 4).map((f) => Number(f.number));
    for (const num of firstFour) expect(Math.abs(num - Number(facts[5].number))).toBeLessThanOrEqual(2);
    expect(order.find((f) => f.id === facts[5].id)).toBeUndefined();
  });
});

describe('review regressions', () => {
  it('never offers a number that is already in the statement', () => {
    const f = facts[11]; // every 15 to 20 minutes
    for (let seed = 1; seed < 60; seed++) {
      const q = generateMultipleChoice(f, ctx(seed))!;
      if (q.answer === '20') expect(q.choices).not.toContain('15');
    }
  });
  it('caps percentages at 100 even when the unit is a word away', () => {
    const f = facts[2]; // 5 to 15 volume percent
    for (let seed = 1; seed < 60; seed++) {
      const q = generateMultipleChoice(f, ctx(seed))!;
      if (q.answerKind === 'number' && /^\d+$/.test(q.answer)) for (const c of q.choices!) expect(Number(c)).toBeLessThanOrEqual(100);
    }
  });
  it('does not blank pieces of other numbers or hyphenated words', () => {
    const s = 'Seals may be 500-1,500 feet away, about one and one-half miles.';
    const c500 = findCandidates(s).find((c) => c.text === '500')!;
    expect(clozeSegments(s, c500)).toEqual(['Seals may be ', '-1,500 feet away, about one and one-half miles.']);
    const one = findCandidates(s).find((c) => c.text === 'one');
    if (one) expect(clozeSegments(s, one).join('_')).toContain('one-half');
  });
  it('keeps "one" as a number at the end of a sentence and skips "no one"', () => {
    expect(findCandidates('Normal air has a specific gravity of one.').some((c) => c.text === 'one' && c.kind === 'number')).toBe(true);
    expect(findCandidates('Make sure no one enters the area.').some((c) => c.text === 'one' && c.kind === 'number')).toBe(false);
  });
  it('does not offer a spelling variant of the unit as a wrong answer', () => {
    const f = facts[1]; // 1,000 feet
    for (let seed = 1; seed < 80; seed++) {
      const q = generateMultipleChoice(f, ctx(seed))!;
      if (q.answerKind === 'unit') expect(q.choices!.map((c) => c.toLowerCase())).not.toContain('foot');
    }
  });
});

describe('cloze fallback', () => {
  it('blanks a hyphenated number and its other plain occurrences', () => {
    const s = 'Use a 20-minute check, then repeat every 20 minutes.';
    const seg = clozeSegments(s, { text: '20', start: 6, end: 8, kind: 'number', score: 85 });
    expect(seg).toEqual(['Use a ', '-minute check, then repeat every ', ' minutes.']);
  });
});

describe('multi-event content', () => {
  const fa = fact('A patient in shock should be kept warm. Ch.-10 pg. 210', { event: 'first-aid', reference: 'Ch.-10 pg. 210' });
  const fa2 = fact('Bleeding from an artery is bright red and spurts. Ch.-9 pg. 190', { event: 'first-aid', reference: 'Ch.-9 pg. 190' });
  const mr = facts.map((f) => ({ ...f, event: 'mine-rescue' }));
  const all = [...mr, fa, fa2];
  const c = { facts: all, index: buildCandidateIndex(all), rng: seededRng(1) };
  it('never blanks the printed reference', () => {
    for (let s = 0; s < 40; s++) {
      const q = generateFillIn(fa, { ...c, rng: seededRng(s) })!;
      expect(q.segments[q.segments.length - 1].endsWith('Ch.-10 pg. 210')).toBe(true);
    }
  });
  it('only uses facts from the same event for distractors', () => {
    const order = otherFactsOrdered(fa, all, seededRng(2));
    expect(order.map((f) => f.id)).toEqual([fa2.id]);
  });
});

describe('numbers inside names', () => {
  it('does not blank the 19 in Covid-19', () => {
    expect(findCandidates('Covid-19, hepatitis, and tetanus are recommended.').some((c) => c.text === '19')).toBe(false);
  });
});

describe('printed reference is never blanked', () => {
  const f = fact('A team check is made every 20 minutes. Ch.-3 pg. 20', { reference: 'Ch.-3 pg. 20' });
  it('finds where the reference starts', () => {
    expect(referenceStart(f)).toBe(f.statement.indexOf('Ch.-3'));
    expect(referenceStart(fact('No reference here.'))).toBe('No reference here.'.length);
  });
  it('excludes reference tokens from candidates and from repeated-occurrence blanking', () => {
    const cands = factCandidates(f);
    expect(cands.every((c) => c.end <= referenceStart(f))).toBe(true);
    const twenty = cands.find((c) => c.text === '20')!;
    const segs = clozeSegments(f.statement, twenty, referenceStart(f));
    expect(segs).toHaveLength(2);
    expect(segs[1]).toContain('pg. 20');
  });
});

describe('distractor source order', () => {
  it('never uses another event and prefers nearby numbers over far ones', () => {
    const mk = (num: number, event: string) => fact(`Statement ${num}.`, { number: String(num), order: num, event, section: 'S' });
    const me = mk(50, 'a');
    const near = mk(52, 'a');
    const far = mk(150, 'a');
    const otherEv = mk(51, 'b');
    for (let s = 0; s < 10; s++) {
      const order = otherFactsOrdered(me, [me, far, otherEv, near], seededRng(s));
      expect(order).not.toContain(otherEv);
      expect(order.indexOf(near)).toBeLessThan(order.indexOf(far));
    }
  });
});
