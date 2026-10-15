import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAll } from '../data/load';
import type { Rule } from '../data/types';
import { same } from './generate';
import { seededRng } from './rng';
import { generateRuleQuestion, isUsableSentence, ruleSegments, ruleSentenceIndex, ruleSentences, spreadByRule } from './rulesQuiz';

let n = 0;
const rule = (text: string, extra: Partial<Rule> = {}): Rule => ({ id: `r${++n}`, number: String(n), title: '', sectionPath: ['S'], text, tags: [], order: n, event: 'ev', sectionId: 'ev:s', ...extra });

describe('rule sentences', () => {
  it('splits sentences, keeps them verbatim and drops list markers, fragments and forms', () => {
    const r = rule('A. Each team shall have a Briefing Officer present at the fresh air base.\nB. Fragment without end\nThe team must stop within 15 minutes of the alarm. See Fig. 3 for the layout of the course.');
    const s = ruleSentences(r);
    expect(s.map((x) => x.text)).toEqual(['Each team shall have a Briefing Officer present at the fresh air base.', 'The team must stop within 15 minutes of the alarm.', 'See Fig. 3 for the layout of the course.']);
    for (const x of s) expect(r.text.slice(x.offset, x.offset + x.text.length)).toBe(x.text);
    expect(ruleSentences(rule('Line one is a form field with plenty of words in it.', { format: 'pre' }))).toEqual([]);
  });
  it('rejects too short, too long, lower-case and colon-ended sentences', () => {
    expect(isUsableSentence('Too short.')).toBe(false);
    expect(isUsableSentence('the team will walk to the base now.')).toBe(false);
    expect(isUsableSentence('The following items are required for each team:')).toBe(false);
    expect(isUsableSentence(`${'Word '.repeat(50)}end.`)).toBe(false);
    expect(isUsableSentence('The team will walk to the fresh air base.')).toBe(true);
  });
  it('blanks a number together with its unit, never a bare rule or figure number', () => {
    const [s] = ruleSentences(rule('The team must stop within 15 minutes of the alarm sounding.'));
    expect(s.candidates.map((c) => c.text)).toContain('15 minutes');
    const [t] = ruleSentences(rule('Teams must follow Rule 15 exactly during the whole contest.'));
    expect(t?.candidates.map((c) => c.text) ?? []).not.toContain('15');
  });
  it('never offers a token that appears more than twice, or in another case elsewhere', () => {
    const [s] = ruleSentences(rule('The Lifeline and the Lifeline and the Lifeline must be tied off by the team.'));
    expect(s.candidates.map((c) => c.text)).not.toContain('Lifeline');
    expect(ruleSegments('A seal and a seal are built.', 'seal')).toEqual(['A ', ' and a ', ' are built.']);
  });
});

describe('rule questions', () => {
  const rules = [
    rule('The team must stop within 15 minutes of the alarm sounding in the mine.'),
    rule('The captain may call a break of 10 minutes at the fresh air base.'),
    rule('Each check of the apparatus takes 5 minutes for every team member.'),
    rule('The Briefing Officer must stay at the Fresh Air Base during the problem.'),
    rule('The Chief Judge decides every dispute raised by the Contest Director.')
  ];
  const idx = ruleSentenceIndex(rules);
  it('builds three unique choices from the same token type, answer once, sentence intact', () => {
    for (let seed = 1; seed < 40; seed++) {
      const q = generateRuleQuestion(idx[0], idx, 'mc', seededRng(seed))!;
      expect(q).not.toBeNull();
      expect(q.choices).toHaveLength(3);
      expect(new Set(q.choices!.map((c) => c.toLowerCase())).size).toBe(3);
      expect(q.choices!.filter((c) => same(c, q.answer))).toHaveLength(1);
      expect(q.segments.join(q.answer)).toBe(idx[0].text);
      expect(q.ruleId).toBe(rules[0].id);
      if (/minutes$/.test(q.answer)) for (const c of q.choices!) expect(c).toMatch(/^\d+ minutes$/);
    }
  });
  it('spreads a session across rules before repeating one', () => {
    const a = { rule: rules[0] };
    const b = { rule: rules[1] };
    expect(spreadByRule([a, { ...a }, b]).map((x) => x.rule.id)).toEqual([rules[0].id, rules[1].id, rules[0].id]);
  });
});

const dir = existsSync('content/rules.json') ? 'content/' : '../content/';
describe.runIf(existsSync(`${dir}rules.json`) && existsSync(`${dir}facts.json`))('Rules quiz over the real rule books', () => {
  const facts = JSON.parse(readFileSync(`${dir}facts.json`, 'utf8'));
  const evs = facts.events ?? {};
  const books = Object.entries(evs as Record<string, { rules_file?: string }>).map(([event, e]) => ({ event, file: e.rules_file ?? `rules-${event}.json` }));
  const c = parseAll({ ruleBooks: books.map((b) => ({ ...b, json: JSON.parse(readFileSync(`${dir}${b.file}`, 'utf8')) })), facts: { facts: [] } });

  it('every generated question is verbatim from its rule, with three distinct options, per event', () => {
    const report: string[] = [];
    for (const b of books) {
      const rules = c.rules.filter((r) => r.event === b.event);
      const idx = ruleSentenceIndex(rules);
      expect(idx.every((s) => s.rule.format !== 'pre')).toBe(true);
      const okRules = new Set<string>();
      let ok = 0;
      idx.forEach((s, i) => {
        expect(s.rule.text.includes(s.text)).toBe(true);
        expect(s.rule.text.slice(s.offset, s.offset + s.text.length)).toBe(s.text);
        const q = generateRuleQuestion(s, idx, 'mc', seededRng(i + 1));
        if (!q) return;
        ok++;
        okRules.add(s.rule.id);
        expect(q.segments.join(q.answer)).toBe(s.text);
        expect(s.rule.text.includes(q.answer)).toBe(true);
        expect(q.choices).toHaveLength(3);
        expect(new Set(q.choices!.map((x) => x.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))).size).toBe(3);
        expect(q.choices!.filter((x) => same(x, q.answer))).toHaveLength(1);
        expect(q.segments.length - 1).toBeLessThanOrEqual(2);
        if (q.answerKind !== 'number') for (const o of q.choices!) if (o !== q.answer) expect(o.toLowerCase().split(/\W+/)).not.toContain(q.answer.toLowerCase());
      });
      report.push(`${b.event}: ${okRules.size}/${rules.length} rules, ${ok} sentences yield questions`);
      expect(ok).toBeGreaterThan(20);
    }
    console.log(`Rules quiz yield:\n  ${report.join('\n  ')}`);
  });
});

describe('rule fill-in', () => {
  it('accepts the bare number for a number-with-unit blank', async () => {
    const { checkAnswer } = await import('./check');
    const r = rule('The team must stop within 15 minutes of the alarm sounding in the mine.');
    const idx = ruleSentenceIndex([r]);
    let q = null;
    for (let seed = 1; seed < 50 && (!q || q.answer !== '15 minutes'); seed++) q = generateRuleQuestion(idx[0], idx, 'fill', seededRng(seed));
    expect(q!.answer).toBe('15 minutes');
    expect(checkAnswer('15', q!.answer, q!.alternatives).correct).toBe(true);
    expect(checkAnswer('15 minutes', q!.answer, q!.alternatives).correct).toBe(true);
    expect(checkAnswer('20', q!.answer, q!.alternatives).correct).toBe(false);
  });
});
