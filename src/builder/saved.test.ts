import { describe, expect, it } from 'vitest';
import { applyXLabel, makeElement, PALETTE, X_LABELS, xAutocomplete, xCategory } from './catalog';
import { driveFileName, mergeProblems } from './drive';
import { blankProblem, normalizeElement, type El, type Problem } from './model';
import { filterProblems } from './ui/ProblemPicker';
import { cableOptions, MAX_WORD, openingOptions, radialOptions } from './ui/RadialMenu';

const prob = (id: string, title: string, updated: string): Problem => ({ ...blankProblem(title), id, updated });

describe('stored problems', () => {
  it('searches titles and sources by every word, newest first', () => {
    const list = [prob('a', '2019 National Day 1', '2026-01-01T00:00:00Z'), prob('b', 'Practice fire', '2026-03-01T00:00:00Z'), { ...prob('c', 'Day 2', '2026-02-01T00:00:00Z'), source: '2011 National' }];
    expect(filterProblems(list, '').map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect(filterProblems(list, 'national day').map((p) => p.id)).toEqual(['c', 'a']);
    expect(filterProblems(list, 'FIRE').map((p) => p.id)).toEqual(['b']);
    expect(filterProblems(list, 'nothing')).toEqual([]);
  });

  it('names Drive files after the problem title', () => {
    expect(driveFileName({ title: 'Day 1: A/B test' })).toBe('Day 1- A-B test.mrs-problem.json');
    expect(driveFileName({ title: '  ' })).toBe('Untitled problem.mrs-problem.json');
  });

  it('merges device and Drive copies: newer wins, new ones from either side are kept', () => {
    const local = [prob('a', 'A local', '2026-01-02T00:00:00Z'), prob('b', 'B local', '2026-01-01T00:00:00Z'), prob('c', 'C only here', '2026-01-01T00:00:00Z')];
    const remote = [prob('a', 'A drive', '2026-01-01T00:00:00Z'), prob('b', 'B drive', '2026-01-05T00:00:00Z'), prob('d', 'D only in Drive', '2026-01-01T00:00:00Z')];
    const r = mergeProblems(local, remote);
    expect(r.list.map((p) => p.title)).toEqual(['A local', 'B drive', 'C only here', 'D only in Drive']);
    expect(r.upload.sort()).toEqual(['a', 'c']);
  });
});

describe('X placard labels', () => {
  it('has one X tool and one cable tool in the palette', () => {
    const xs = PALETTE.filter((p) => p.kind === 'x');
    expect(xs.map((p) => p.key)).toEqual(['x', 'x:cable']);
  });

  it('groups labels as equipment, ignition source and object, without duplicates', () => {
    expect(new Set(X_LABELS.map((l) => l.cat))).toEqual(new Set(['equipment', 'ignition', 'object']));
    expect(new Set(X_LABELS.map((l) => l.text)).size).toBe(X_LABELS.length);
    const cats = X_LABELS.map((l) => l.cat);
    expect(cats.indexOf('ignition')).toBeGreaterThan(cats.lastIndexOf('equipment'));
  });

  it('completes the closest label as keys are typed', () => {
    expect(xAutocomplete('s')?.text).toBe('SCOOP');
    expect(xAutocomplete('sh')?.text).toBe('SHUTTLE CAR');
    expect(xAutocomplete('lun')?.text).toBe('LUNCH PAIL');
    expect(xAutocomplete('cable')?.text).toBe('ENERGIZED CABLE');
    expect(xAutocomplete('zzz')).toBeNull();
    expect(xAutocomplete('')).toBeNull();
  });

  it('applies a label with what the solver needs', () => {
    const el = makeElement({ kind: 'x' }, 0, 0, 'e');
    const cable = { ...el, ...applyXLabel(X_LABELS.find((l) => l.text === 'ENERGIZED CABLE')!) };
    expect(cable).toMatchObject({ sub: 'cable', energized: true, text: 'ENERGIZED CABLE' });
    expect(xCategory(cable)).toBe('ignition');
    const pail = { ...cable, ...applyXLabel(X_LABELS.find((l) => l.text === 'LUNCH PAIL')!) };
    expect(pail.sub).toBe('lunch-pail');
    expect(pail.energized).toBeUndefined();
    expect(xCategory(pail)).toBe('object');
  });
});

describe('cable path', () => {
  it('keeps the path points through save and load', () => {
    const el = normalizeElement({ id: 'c', kind: 'x', sub: 'cable', x: 1, y: 2, path: [{ x: 3, y: 4 }, { x: 'bad' }, { x: 5, y: 6 }] }) as El;
    expect(el.path).toEqual([{ x: 3, y: 4 }, { x: 5, y: 6 }]);
  });
  it('offers end, undo and clear while drawing', () => {
    expect(cableOptions(0).map((o) => o.id)).toEqual(['end', 'cancel']);
    expect(cableOptions(2).map((o) => o.id)).toEqual(['end', 'undo', 'cancel']);
  });
});

describe('ring button labels fit inside the round buttons', () => {
  const labels = new Set<string>();
  for (const it of PALETTE) {
    const base = makeElement(it, 0, 0, 'e');
    for (const variant of [base, { ...base, intact: false, airtight: false, open: true, on: false, fanMode: 'blowing' as const, conscious: false, path: [{ x: 1, y: 1 }] }]) for (const o of radialOptions(variant)) labels.add(o.label);
  }
  for (const o of [...openingOptions('open'), ...cableOptions(1)]) labels.add(o.label);
  it.each([...labels])('%s', (label) => {
    const words = label.split(/\s+/);
    expect(words.length).toBeLessThanOrEqual(2);
    for (const w of words) expect(w.length).toBeLessThanOrEqual(MAX_WORD);
  });
});
