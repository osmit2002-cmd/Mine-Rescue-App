import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { figurePath } from './adapter';
import { collectCropFigures, cropsByRule } from './figures';
import { parseAll } from './load';

const book = (items: unknown[], extra: Record<string, unknown> = {}) => ({
  document: { title: 'Test book' },
  sections: [{ id: 'sec', title: 'Section', items, ...extra }]
});
const rule = (id: string, figures?: unknown[], images?: unknown[]) => ({ id, number: id.replace(/\D/g, ''), text: `Rule ${id} text.`, ...(figures ? { figures } : {}), ...(images ? { images } : {}) });
const map = (...files: string[]) => Object.fromEntries(files.map((f) => [f, f.replace(/\.png$/, '.webp')]));
const parse = (items: unknown[], opts: { index?: unknown; files?: string[]; checked?: boolean } = {}) =>
  parseAll({
    ruleBooks: [{ file: 'rules.json', event: 'mine-rescue', json: book(items) }],
    facts: [],
    figureIndex: opts.index,
    buildInfo: { figures: { map: map(...(opts.files ?? [])), checked: opts.checked ?? true } }
  });

describe('figure paths', () => {
  it('accepts paths relative to the content folder or to the figures folder', () => {
    expect(figurePath('figures/mine-rescue/a.png')).toBe('figures/mine-rescue/a.png');
    expect(figurePath('mine-rescue/a.png')).toBe('figures/mine-rescue/a.png');
    expect(figurePath('./figures/mine-rescue/a.png')).toBe('figures/mine-rescue/a.png');
    expect(figurePath('/content/figures/x.png')).toBe('figures/x.png');
    expect(figurePath('figures\\first-aid\\b.png')).toBe('figures/first-aid/b.png');
  });
});

describe('cropped figures (schema validation)', () => {
  it('reads a rule item’s figures in the rule’s own order, captions verbatim', () => {
    const c = parse(
      [
        rule('r1', [
          { id: 'f2', file: 'figures/mine-rescue/two.png', caption: 'Figure 2 – EXTENT  OF GASES', page: 46, kind: 'figure' },
          { id: 'f1', file: 'mine-rescue/one.png', caption: 'Judge’s Checklist', page: null, pdf_page: 33, kind: 'form' }
        ]),
        rule('r2', [{ id: 'f1', file: 'figures/mine-rescue/one.png', caption: 'Judge’s Checklist' }])
      ],
      { files: ['figures/mine-rescue/one.png', 'figures/mine-rescue/two.png'] }
    );
    expect(c.issues).toEqual([]);
    const g = cropsByRule(c.figures, c.galleries);
    expect(g.get('r1')!.map((f) => f.id)).toEqual(['f2', 'f1']);
    expect(g.get('r2')!.map((f) => f.id)).toEqual(['f1']);
    const f2 = g.get('r1')![0];
    expect(f2).toMatchObject({ kind: 'crop', caption: 'Figure 2 – EXTENT  OF GASES', printedPage: 46, event: 'mine-rescue', figureKind: 'figure' });
    const f1 = g.get('r1')![1];
    expect(f1.printedPage).toBeUndefined();
    expect(f1.pdfPage).toBe(33);
    expect(new Set(f1.ruleIds)).toEqual(new Set(['r1', 'r2']));
  });

  it('reports a figure whose file is missing and skips it, without crashing; the rule still loads', () => {
    const c = parse([rule('r1', [{ id: 'gone', file: 'figures/mine-rescue/gone.png', caption: 'Gone' }, { id: 'ok', file: 'figures/mine-rescue/ok.png', caption: 'OK' }])], { files: ['figures/mine-rescue/ok.png'] });
    expect(c.rules.map((r) => r.id)).toEqual(['r1']);
    expect(c.issues.some((i) => i.level === 'warning' && i.id === 'gone' && /not found/.test(i.message))).toBe(true);
    expect(cropsByRule(c.figures, c.galleries).get('r1')!.map((f) => f.id)).toEqual(['ok']);
  });

  it('reports entries with no file, bad entries and unknown rules; nothing throws', () => {
    const c = parse([rule('r1', [{ id: 'nofile', caption: 'No file' }, { id: 'x', file: 42, caption: 'Bad' }])], {
      index: { figures: [{ id: 'i1', file: 'figures/a.png', caption: 'A', rule_ids: ['r1', 'nope'] }, 'junk'] },
      files: ['figures/a.png']
    });
    expect(c.issues.filter((i) => /has no file/.test(i.message)).length).toBe(2);
    expect(c.issues.some((i) => i.file === 'figures.json' && /not an object/.test(i.message))).toBe(true);
    expect(c.issues.some((i) => /unknown rule "nope"/.test(i.message))).toBe(true);
    expect(cropsByRule(c.figures, c.galleries).get('r1')!.map((f) => f.id)).toEqual(['i1']);
    expect(parse([rule('r1')], { index: { nothing: true } }).issues.some((i) => /no figures list/.test(i.message))).toBe(true);
  });

  it('merges figures.json with rule lists by id; skips its full-page entries; keeps page images as before', () => {
    const c = parse([rule('r1', [{ id: 'f1', file: 'figures/mine-rescue/one.png', caption: '' }], [{ file: 'figures/page-43.png', printed_page: 41 }])], {
      index: {
        figures: [
          { id: 'f1', file: 'figures/mine-rescue/one.png', caption: 'From the index', page: 7, event: 'mine-rescue', rule_ids: ['r1'] },
          { id: 'p43', file: 'figures/page-43.png', caption: 'Rulebook page 41', page: 41, kind: 'page', rule_ids: [] },
          { id: 'only-index', file: 'figures/mine-rescue/three.png', caption: 'Linked only in figures.json', rules: ['r1'] }
        ]
      },
      files: ['figures/mine-rescue/one.png', 'figures/mine-rescue/three.png', 'figures/page-43.png']
    });
    expect(c.issues).toEqual([]);
    const g = cropsByRule(c.figures, c.galleries).get('r1')!;
    expect(g.map((f) => [f.id, f.caption, f.printedPage])).toEqual([
      ['f1', 'From the index', 7],
      ['only-index', 'Linked only in figures.json', undefined]
    ]);
    const pages = c.figures.filter((f) => f.kind !== 'crop');
    expect(pages.map((f) => [f.file, f.ruleId, f.caption])).toEqual([['figures/page-43.png', 'r1', 'Page 41']]);
  });

  it('without figures.json or rule figures, the content is exactly as before', () => {
    const c = parse([rule('r1', undefined, [{ file: 'figures/page-43.png', printed_page: 41 }])], { files: ['figures/page-43.png'] });
    expect(c.figures.every((f) => f.kind !== 'crop')).toBe(true);
    expect(c.galleries).toEqual({});
    expect(c.issues).toEqual([]);
  });

  it('does not check files when the build did not list them (old build-info)', () => {
    const c = parse([rule('r1', [{ id: 'f', file: 'figures/x.png', caption: 'X' }])], { checked: false });
    expect(c.issues).toEqual([]);
    expect(cropsByRule(c.figures, c.galleries).get('r1')!.length).toBe(1);
  });
});

describe('the sample figures.json fixture (the shape King Grok ships)', () => {
  const fixture = JSON.parse(readFileSync('src/data/sample/sample-figures.json', 'utf8'));
  const items = [rule('b-card-23', [
    { id: 'mine-rescue:fig-1a', file: 'figures/mine-rescue/fig-1a.png', caption: 'Figure 1(a) – PROPER METHOD OF ROOF TESTING', page: 41, pdf_page: 43, kind: 'figure' },
    { id: 'mine-rescue:fig-1b', file: 'figures/mine-rescue/fig-1b.png', caption: 'Figure 1(b) – PROPER METHOD OF ROOF TESTING (cont.)', page: 42, pdf_page: 44, kind: 'figure' }
  ])];
  const files = ['figures/mine-rescue/fig-1a.png', 'figures/mine-rescue/fig-1b.png', 'figures/page-43.png', 'figures/page-44.png'];
  it('gives the rule a 2-figure gallery with full-page links, the section a gallery, and skips the page entry', () => {
    const c = parseAll({
      ruleBooks: [{ file: 'rules.json', event: 'mine-rescue', json: { sections: [{ id: 'b-card', title: 'B Card', items }, { id: 'figures', title: 'Drawings and Figures', items: [], figures: [{ id: 'mine-rescue:fig-1a', file: 'figures/mine-rescue/fig-1a.png', caption: 'Figure 1(a) – PROPER METHOD OF ROOF TESTING', page: 41 }] }] } }],
      facts: [],
      figureIndex: fixture,
      buildInfo: { figures: { map: map(...files), checked: true } }
    });
    expect(c.issues).toEqual([]);
    const g = cropsByRule(c.figures, c.galleries).get('b-card-23')!;
    expect(g.map((f) => [f.id, f.fullPage])).toEqual([
      ['mine-rescue:fig-1a', 'figures/page-43.png'],
      ['mine-rescue:fig-1b', 'figures/page-44.png']
    ]);
    expect(c.sectionGalleries['mine-rescue:figures']).toEqual(['mine-rescue:fig-1a', 'mine-rescue:fig-1b']);
    expect(c.figures.filter((f) => f.kind === 'crop').length).toBe(2);
  });
  it('reports figures listed by a rule the app does not know, instead of dropping them silently', () => {
    const r = collectCropFigures({
      rawRules: [{ raw: { id: 'ghost', figures: [{ id: 'g1', file: 'figures/g.png', caption: 'G' }] }, file: 'rules.json' }],
      figureMap: { 'figures/g.png': 'figures/g.webp' },
      filesChecked: true,
      rules: new Map([['r1', 'mine-rescue']])
    });
    expect(r.galleries).toEqual({});
    expect(r.issues.some((i) => /unknown rule "ghost"/.test(i.message))).toBe(true);
  });

  it('reports duplicates and disagreements between figures.json and the lists', () => {
    const dup = { figures: [...fixture.figures, fixture.figures[0]] };
    const c = parseAll({
      ruleBooks: [{ file: 'rules.json', event: 'mine-rescue', json: { sections: [{ id: 'b-card', title: 'B', items: [rule('b-card-23', [items[0].figures![0], items[0].figures![0]]), rule('b-card-24', [items[0].figures![1]])] }] } }],
      facts: [],
      figureIndex: dup,
      buildInfo: { figures: { map: map(...files), checked: true } }
    });
    const msgs = c.issues.map((i) => i.message);
    expect(msgs.some((m) => /appears twice in figures.json/.test(m))).toBe(true);
    expect(msgs.some((m) => /listed twice for rule b-card-23/.test(m))).toBe(true);
    expect(msgs.some((m) => /rule_ids lacks b-card-24/.test(m))).toBe(true);
    expect(msgs.some((m) => /unknown section "figures"/.test(m))).toBe(true);
  });
});

const dir = existsSync('content/rules.json') ? 'content/' : '../content/';
// Runs only when the content folder has figures.json (the new figure data). The data is read inside the test:
// a skipped describe block still runs its body when the tests are collected.
describe.runIf(existsSync(`${dir}figures.json`))('the real figure data', () => {
  const load = () => {
    const facts = JSON.parse(readFileSync(`${dir}facts.json`, 'utf8'));
    const books = Object.entries((facts.events ?? {}) as Record<string, { rules_file?: string }>).map(([event, e]) => ({ event, file: e.rules_file ?? `rules-${event}.json` }));
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
    const files = walk(`${dir}figures`).map((p) => p.slice(dir.length).split('\\').join('/'));
    const c = parseAll({
      ruleBooks: books.map((b) => ({ ...b, json: JSON.parse(readFileSync(`${dir}${b.file}`, 'utf8')) })),
      facts,
      figureIndex: JSON.parse(readFileSync(`${dir}figures.json`, 'utf8')),
      buildInfo: { figures: { map: Object.fromEntries(files.map((f) => [f, f])), checked: true } }
    });
    return c;
  };
  it('every figure file exists, every rule and section id resolves, nothing is duplicated', () => {
    const c = load();
    const problems = c.issues.filter((i) => i.file === 'figures' || i.file === 'figures.json' || /figure/.test(i.message));
    console.log(`real figures: ${c.figures.filter((f) => f.kind === 'crop').length} crops, ${Object.keys(c.galleries).length} rules and ${Object.keys(c.sectionGalleries).length} sections with galleries, ${Object.values(c.galleries).reduce((n, l) => n + l.length, 0)} rule links; ${problems.length} problem(s)`);
    for (const p of problems) console.log(`  ${p.file} ${p.id ?? ''}: ${p.message}`);
    expect(problems).toEqual([]);
  });
});
