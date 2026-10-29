import { describe, expect, it } from 'vitest';
import { CASES } from './cases';
import { compareToKey, formatReport, type JudgeKey } from './judge';
import { normalizeProblem } from './model';
import { FIGURE7_STOPS, figure7 } from './samples';
import { solve } from './solve';

/**
 * Checks each reference case still fails today, by check id. When a solver change fixes one, remove it here; when a
 * change breaks a check that passed, the test fails. Either way the diff shows the solver's progress against the
 * judges.
 */
const KNOWN_GAPS: Record<string, string[]> = {
  // Row 4: the judges go No. 2 (10, the barricade), No. 3 (11), then No. 1 (12, after the second vent). The solver
  // advances No. 1 first from stop 9 and so reaches the No. 2 barricade one stop late.
  'post5-2016-day1': ['stop:1,4', 'stop:2,4', 'stop:0,4', 'rescue:person-n2']
};

describe('judge key comparison', () => {
  const fig7Key: JudgeKey = {
    source: 'Rule book Figure 7',
    stops: FIGURE7_STOPS.map(([i, r], k) => ({ at: [i, r], n: [k + 1] })),
    rescue: [],
    withdrawal: false,
    notes: [],
    manual: []
  };
  it('passes every check when the solver matches the key (rule book Figure 7)', () => {
    const r = compareToKey(solve(figure7()), fig7Key);
    expect(r.checks.filter((c) => !c.ok)).toEqual([]);
    expect(r.passed).toBe(r.total);
  });
  it('fails a stop whose number the judges do not accept, and says what it got', () => {
    const key: JudgeKey = { ...fig7Key, stops: [{ at: [0, 1], n: [2, 3] }] };
    const r = compareToKey(solve(figure7()), key);
    expect(r.checks[0]).toMatchObject({ id: 'stop:0,1', ok: false, expected: '2 or 3', got: '1' });
  });
  it('fails a rescue that is not in the plan and a withdrawal that did not happen', () => {
    const r = compareToKey(solve(figure7()), { ...fig7Key, withdrawal: true, rescue: [{ el: 'nobody', before: 0 }] });
    expect(r.checks.find((c) => c.id === 'withdrawal')?.ok).toBe(false);
    expect(r.checks.find((c) => c.id === 'rescue:nobody')).toMatchObject({ ok: false, got: 'not found' });
  });
});

describe('2016 Post 5 Day 1 specifics', () => {
  const sol = solve(CASES.find((c) => c.id === 'post5-2016-day1')!.problem());
  const idx = (kind: string, subject: string) => sol.plan.steps.findIndex((s) => s.kind === kind && s.subject === subject);
  it('takes the first barricade patient out before airlocking the second barricade (Rule 41B)', () => {
    expect(idx('recover', 'person-b1')).toBeGreaterThan(idx('breach', 'barricade-1'));
    expect(idx('recover', 'person-b1')).toBeLessThan(idx('breach', 'barricade-2'));
  });
  it('travels through stoppings found not intact instead of breaching them', () => {
    expect(sol.plan.steps.filter((s) => s.kind === 'breach').map((s) => s.subject)).toEqual(['barricade-1', 'barricade-2', 'barricade-3']);
  });
});

describe.each(CASES)('reference case $id', (c) => {
  const p = c.problem();
  const sol = solve(p);
  const report = compareToKey(sol, c.key);

  it('is a valid problem with every element inside an opening', () => {
    expect(normalizeProblem(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(sol.board.outside.map((e) => e.id)).toEqual([]);
    expect(sol.checks.filter((k) => k.level === 'error')).toEqual([]);
  });

  it('accounts for every missing person', () => {
    const persons = p.elements.filter((e) => e.kind === 'person' || e.kind === 'body').map((e) => e.id);
    expect(persons.length).toBe(p.missing);
    expect(persons.filter((id) => !sol.plan.found.has(id))).toEqual([]);
  });

  it('matches the judge key except for the known gaps', () => {
    const failing = report.checks.filter((k) => !k.ok).map((k) => k.id);
    expect(failing, formatReport(report)).toEqual(KNOWN_GAPS[c.id] ?? []);
  });
});
