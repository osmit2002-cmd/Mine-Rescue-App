import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAll } from '../data/load';
import { buildCandidateIndex, generateQuestion } from './generate';
import { generatePartQuestion, partItems } from './parts';
import { seededRng } from './rng';

const dir = 'content/';
describe.runIf(existsSync(`${dir}facts.json`) && existsSync(`${dir}parts.json`))('quiz over the real content', () => {
  const c = parseAll({ ruleBooks: [], facts: JSON.parse(readFileSync(`${dir}facts.json`, 'utf8')), parts: JSON.parse(readFileSync(`${dir}parts.json`, 'utf8')) });

  it('every statement yields a three-choice question within its own event, text unchanged around the blank', () => {
    const events = [...new Set(c.facts.map((f) => f.event))];
    const failures: string[] = [];
    for (const ev of events) {
      const facts = c.facts.filter((f) => f.event === ev);
      const index = buildCandidateIndex(facts);
      for (const f of facts) {
        const q = generateQuestion(f, 'mc', { facts, index, rng: seededRng(f.order + 1) });
        if (!q || q.choices?.length !== 3 || new Set(q.choices).size !== 3) {
          failures.push(f.id);
          continue;
        }
        // Repeated occurrences of the answer are blanked too (case-insensitive), so compare ignoring case.
        if (q.source === 'cloze') expect(q.segments.join(q.answer).toLowerCase()).toBe(f.statement.toLowerCase());
      }
    }
    expect(failures).toEqual([]);
  });

  it('every part row yields a three-choice question', () => {
    const items = partItems(c.parts);
    expect(items).toHaveLength(354);
    const bad = items.filter((it) => {
      const q = generatePartQuestion(it, c.parts, 'mc', seededRng(it.row + 1));
      return !q || new Set(q.choices).size !== 3;
    });
    expect(bad.map((b) => b.id)).toEqual([]);
  });
});
