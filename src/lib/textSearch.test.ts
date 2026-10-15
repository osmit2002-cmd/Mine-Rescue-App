import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { snippet, splitForHighlight } from '../components/Highlight';
import { parseAll } from '../data/load';
import { buildRuleTree, filterRuleTree, type RuleNode, type SectionNode } from '../data/ruleTree';
import type { Rule } from '../data/types';
import { buildRuleSearchIndex, buildTextIndex, filterMatches, hasQuery } from './textSearch';

const rule = (id: string, over: Partial<Rule> = {}): Rule => ({ id, number: id, title: '', sectionPath: ['Section A'], text: '', tags: [], order: Number(id.replace(/\D/g, '')) || 0, ...over });

describe('shared filter search', () => {
  const index = buildTextIndex(
    [
      { id: 'a', number: '1', statement: 'Methane is explosive between 5 and 15 percent.' },
      { id: 'b', number: '12', statement: 'The team shall carry a lifeline.' },
      { id: 'c', number: '186', statement: 'Carbon monoxide is colorless.' }
    ],
    ['number', 'statement']
  );
  it('treats an empty or punctuation-only query as no search', () => {
    expect(filterMatches(index, '')).toBeNull();
    expect(filterMatches(index, '  - ')).toBeNull();
    expect(hasQuery('x')).toBe(true);
  });
  it('matches word prefixes, requires every word, and tolerates a typo in longer words', () => {
    expect([...filterMatches(index, 'meth')!.keys()]).toEqual(['a']);
    expect([...filterMatches(index, 'methane lifeline')!.keys()]).toEqual([]);
    expect([...filterMatches(index, 'lifelin team')!.keys()]).toEqual(['b']);
    expect([...filterMatches(index, 'monoxyde')!.keys()]).toEqual(['c']);
    expect(new Set(filterMatches(index, '1')!.keys())).toEqual(new Set(['a', 'b', 'c'])); // number prefix: 1, 12, 15, 186
  });
  it('reports the matched words so the list can highlight them, and respects the scope', () => {
    expect(filterMatches(index, 'carb')!.get('c')).toEqual(['carbon']);
    expect([...filterMatches(index, 'is', (id) => id !== 'a')!.keys()].sort()).toEqual(['c']);
    expect(splitForHighlight('Carbon monoxide', ['carbon']).filter((p) => p.hit).map((p) => p.text)).toEqual(['Carbon']);
  });
});

describe('snippet', () => {
  it('keeps characters verbatim (line breaks too unless flattened) and can require a hit', () => {
    const text = `${'x '.repeat(200)}SKILL  SHEET\n  Step 1   Check gauge\n${'y '.repeat(200)}`;
    const s = snippet(text, ['gauge'], 80, { flatten: false });
    expect(text.includes(s.replace(/^…|…$/g, ''))).toBe(true);
    expect(s).toContain('Check gauge');
    expect(snippet(text, ['nothing'], 80, { requireHit: true })).toBe('');
    const prose = 'Teams may elect to use a sound-powered telephone system with a lifeline, and two persons may assist in managing the lifeline at the base.';
    const w = snippet(prose, ['lifeline'], 60);
    expect(w).toMatch(/^…\S/);
    expect(prose.includes(w.replace(/^…/, '').replace(/…$/, ''))).toBe(true);
    const inner = w.replace(/^…/, '').replace(/…$/, '');
    const i = prose.indexOf(inner);
    expect(i === 0 || /\s/.test(prose[i - 1])).toBe(true); // starts at a word
    expect(i + inner.length === prose.length || /\s/.test(prose[i + inner.length])).toBe(true); // ends at a word
  });
});

describe('filterRuleTree', () => {
  const rules = [rule('r1', { text: 'alpha' }), rule('r2', { parent: 'r1', text: 'beta' }), rule('r3', { sectionPath: ['Section B'], text: 'gamma' }), rule('r4', { sectionPath: ['Section B', 'Sub'], text: 'beta' })];
  const tree = buildRuleTree(rules);
  it('returns the full tree when there is no search', () => {
    const v = filterRuleTree(tree, null);
    expect(v.count).toBe(4);
    expect(v.sections.map((s) => s.name)).toEqual(['Section A', 'Section B']);
  });
  it('keeps matching rules with their parents as context, counting only matches', () => {
    const v = filterRuleTree(tree, (r) => r.text === 'beta');
    expect(v.count).toBe(2);
    expect(v.sections[0].rules[0].rule.id).toBe('r1'); // context parent
    expect(v.sections[0].rules[0].children.map((c) => c.rule.id)).toEqual(['r2']);
    expect(v.sections[1].rules).toEqual([]);
    expect(v.sections[1].sections[0].rules.map((r) => r.rule.id)).toEqual(['r4']);
  });
  it('narrows to one top-level section, with or without a search', () => {
    expect(filterRuleTree(tree, null, 'Section B').sections.map((s) => s.name)).toEqual(['Section B']);
    expect(filterRuleTree(tree, (r) => r.text === 'beta', 'Section B').count).toBe(1);
    expect(filterRuleTree(tree, (r) => r.text === 'alpha', 'Section B').count).toBe(0);
  });
});

const dir = existsSync('content/rules.json') ? 'content/' : '../content/';
describe.runIf(existsSync(`${dir}rules.json`) && existsSync(`${dir}facts.json`))('rules search over the real rule books', () => {
  const facts = JSON.parse(readFileSync(`${dir}facts.json`, 'utf8'));
  const books = Object.entries((facts.events ?? {}) as Record<string, { rules_file?: string }>).map(([event, e]) => ({ event, file: e.rules_file ?? `rules-${event}.json` }));
  const c = parseAll({ ruleBooks: books.map((b) => ({ ...b, json: JSON.parse(readFileSync(`${dir}${b.file}`, 'utf8')) })), facts: { facts: [] } });
  const index = buildRuleSearchIndex(c.rules);
  const byId = new Map(c.rules.map((r) => [r.id, r]));
  const words = (r: Rule) => r.text.match(/[A-Za-z]{6,}/g) ?? [];

  it('finds every rule by its number and by a word of its wording, within its own event only', () => {
    for (const r of c.rules) {
      const w = words(r)[0];
      if (w) {
        const hits = filterMatches(index, w, (id) => byId.get(id)!.event === r.event)!;
        expect(hits.has(r.id), `${r.id} by "${w}"`).toBe(true);
        expect([...hits.keys()].every((id) => byId.get(id)!.event === r.event)).toBe(true);
      }
      if (/^[\p{L}\p{N}]/u.test(r.number)) expect(filterMatches(index, r.number, (id) => byId.get(id)!.event === r.event)!.has(r.id), `${r.id} by number`).toBe(true);
    }
  });

  it("searches 'pre' skill sheets too, and every snippet shown is verbatim rule text", () => {
    const pre = c.rules.filter((r) => r.format === 'pre');
    expect(pre.length).toBeGreaterThan(0);
    for (const r of pre) {
      const w = words(r)[0];
      if (!w) continue;
      const terms = filterMatches(index, w)!.get(r.id)!;
      expect(terms, r.id).toBeDefined();
      const s = snippet(r.text, terms, 240, { flatten: false, requireHit: true });
      expect(s.length).toBeGreaterThan(0);
      expect(r.text.includes(s.replace(/^…/, '').replace(/…$/, ''))).toBe(true);
    }
  });

  it('the filtered tree holds exactly the matching rules, and an empty search restores the full tree', () => {
    const allIds = (s: SectionNode): string[] => [...s.rules.flatMap(function walk(n: RuleNode): string[] { return [n.rule.id, ...n.children.flatMap(walk)]; }), ...s.sections.flatMap(allIds)];
    for (const b of books) {
      const tree = buildRuleTree(c.rules.filter((r) => r.event === b.event));
      const hits = filterMatches(index, 'shall', (id) => byId.get(id)!.event === b.event);
      if (!hits?.size) continue;
      const v = filterRuleTree(tree, (r) => hits.has(r.id));
      expect(v.count).toBe(hits.size);
      expect(allIds(v).filter((id) => hits.has(id)).sort()).toEqual([...hits.keys()].sort());
      expect(filterRuleTree(tree, filterMatches(index, '') && null).count).toBe(tree.count);
    }
  });
});
