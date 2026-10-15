import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { editionLabel } from './adapter';
import { parseAll, parseContent } from './load';
import { buildRuleTree } from './ruleTree';
import sampleRules from './sample/sample-rules.json';
import sampleFacts from './sample/sample-facts.json';

describe('validator', () => {
  it('reports bad records without throwing and keeps the good ones', () => {
    const c = parseContent(
      [{ id: 'a', number: '1', title: 'T', section: 'S', text: 'x' }, 42, { id: 'a', text: 'dup', section: 'S' }, { title: '' }, { id: 'c', text: 'y', parent: 'nope' }],
      { facts: [{ id: 'f1', text: 'Methane is lighter than air.' }, { id: 'f2', text: '' }, null, { text: 'No id here.' }] }
    );
    expect(c.rules.map((r) => r.id)).toEqual(['a', 'a~2', 'c']);
    expect(c.facts.map((f) => f.id)).toEqual(['f1', 'fact-4']);
    expect(c.issues.filter((i) => i.level === 'error')).toHaveLength(4);
    expect(c.rules[2].parent).toBeUndefined();
  });
  it('reports a file that is not an array', () => {
    const c = parseContent('oops', 7);
    expect(c.rules).toEqual([]);
    expect(c.issues.map((i) => i.file)).toEqual(['rules', 'facts']);
  });
  it('loads the bundled sample data and flags it as SAMPLE', () => {
    const c = parseContent(sampleRules, sampleFacts);
    expect(c.rules).toHaveLength(15);
    expect(c.facts).toHaveLength(20);
    expect(c.sample).toEqual({ rules: true, facts: true });
    expect(c.issues.filter((i) => i.level === 'error')).toEqual([]);
  });
});

describe('nested rule book', () => {
  const doc = {
    document: { title: '2026 Coal Mine Rescue Rules', edition: '2026, "Approved – 1/15/2026"', url: 'https://www.msha.gov/x.pdf' },
    sections: [
      { id: 's1', title: 'General', pages: [1, 2], intro: 'Intro text.', items: [{ id: 's1-1', number: 1, text: 'Line one.\nA. Sub item', pages: [1, 1] }] },
      { id: 'b', title: 'B Card', pages: [16, 40], items: [{ id: 'b-1', number: 1, text: 'x 3', pages: [16, 16], group: { letter: 'A', title: 'Apparatus' } }] },
      { id: 'fig', title: 'Figures', pages: [41, 55], note: 'Index: Roof Testing p41; Map Legend p51.', images: [{ file: 'figures/page-43.png', pdf_page: 43, printed_page: 41, extracted_labels: 'Figure 1(a)' }, { file: 'figures/page-53.png', printed_page: 51, extracted_labels: '' }] }
    ]
  };
  it('flattens sections > group > rule, keeps text verbatim, and collects figures', () => {
    const c = parseContent(doc, []);
    expect(c.rules.map((r) => r.sectionPath)).toEqual([['General'], ['B Card', 'A. Apparatus']]);
    expect(c.rules[0].text).toBe('Line one.\nA. Sub item');
    expect(c.rules[0].pages).toEqual([1, 1]);
    expect(c.sections.map((s) => s.id)).toEqual(['s1', 'b', 'fig']);
    expect(c.sections[0].intro).toBe('Intro text.');
    expect(c.figures.map((f) => [f.caption, f.title])).toEqual([['Figure 1(a)', 'Roof Testing'], ['Page 51', 'Map Legend']]);
    expect(editionLabel(c.document)).toBe('2026 MSHA rules, approved 1/15/2026');
  });
  it('builds a nested tree with counts and parent links, and is cycle-safe', () => {
    const tree = buildRuleTree(parseContent(sampleRules, []).rules);
    expect(tree.count).toBe(15);
    const a = tree.sections.find((s) => s.name === 'Sample Section A')!;
    const general = a.sections.find((s) => s.name === 'Sample General Rules')!;
    expect(general.sections.map((s) => s.name)).toEqual(['Sample Timing', 'Sample Written Test']);
    const s2 = general.rules.find((r) => r.rule.number === 'S-2')!;
    expect(s2.children.map((c) => c.rule.number)).toEqual(['S-2(a)', 'S-2(b)']);
    const cyc = parseContent([{ id: 'x', text: 't', section: 'S', parent: 'y' }, { id: 'y', text: 't', section: 'S', parent: 'x' }], []).rules;
    expect(buildRuleTree(cyc).count).toBe(2);
  });
});

// Runs against the real content when content/ is present in the repo.
const dir = 'content/';
const realFacts = `${dir}facts.json`;
const read = (f: string) => JSON.parse(readFileSync(`${dir}${f}`, 'utf8'));
describe.runIf(existsSync(`${dir}rules.json`) && existsSync(realFacts))('real 2026 content (all events)', () => {
  const factsJson = read('facts.json');
  const evs = factsJson.events ?? {};
  const evList: { id: string; rules_file?: string }[] = Array.isArray(evs) ? evs : Object.entries(evs).map(([id, v]) => ({ id, ...(v as object) }));
  const books = evList
    .map((e) => ({ file: e.rules_file ?? (e.id === 'mine-rescue' ? 'rules.json' : `rules-${e.id}.json`), event: e.id }))
    .filter((b: { file: string }) => existsSync(`${dir}${b.file}`));
  const c = parseAll({
    ruleBooks: books.map((b: { file: string; event: string }) => ({ ...b, json: read(b.file) })),
    facts: factsJson,
    parts: existsSync(`${dir}parts.json`) ? read('parts.json') : undefined
  });
  const count = (xs: { event?: string }[], ev: string) => xs.filter((x) => x.event === ev).length;

  it('loads every record with no errors', () => {
    expect(c.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(c.sample).toEqual({ rules: false, facts: false });
  });
  it('has every fact, per event, with unique ids and verbatim text', () => {
    const declared = factsJson.count ?? factsJson.facts.length;
    expect(c.facts).toHaveLength(declared);
    expect(new Set(c.facts.map((f) => f.id)).size).toBe(declared);
    for (const [ev, n] of Object.entries((factsJson.counts_by_event ?? {}) as Record<string, number>)) expect(count(c.facts, ev)).toBe(n);
    factsJson.facts.forEach((raw: { text: string }, i: number) => expect(c.facts[i].statement).toBe(raw.text));
  });
  it('has exactly the 200 Coal Mine Rescue statements, numbered 1 to 200 with no gaps or duplicates', () => {
    const nums = c.facts.filter((f) => f.event === 'mine-rescue').map((f) => Number(f.number));
    expect(nums).toEqual(Array.from({ length: 200 }, (_, i) => i + 1));
  });
  it('loads every rule book with its event', () => {
    expect(books.length).toBe(6);
    expect(count(c.rules, 'mine-rescue')).toBe(100);
    for (const b of books) expect(count(c.rules, b.event)).toBeGreaterThan(0);
    expect(c.rules.every((r) => r.event)).toBe(true);
    expect(c.rules.some((r) => r.format === 'pre')).toBe(true);
    expect(c.ruleBooks).toHaveLength(6);
  });
  it('loads all parts tables and rows', () => {
    const pj = read('parts.json');
    expect(c.parts).toHaveLength(pj.count_tables ?? pj.parts.length);
    expect(c.parts.reduce((n, t) => n + t.rows.length, 0)).toBe(pj.count_rows ?? 354);
    expect(c.parts.every((t) => t.event?.startsWith('bench-'))).toBe(true);
  });
});
