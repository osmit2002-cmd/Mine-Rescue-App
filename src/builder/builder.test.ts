import { describe, expect, it } from 'vitest';
import { makeElement } from './catalog';
import { explore } from './explore';
import { hazards } from './extents';
import { buildTopo, locate, makeGeo, nodeId, snap } from './geometry';
import { buildGraph, makeBoard } from './graph';
import { blankProblem, defaultLayout, normalizeProblem, type El, type Problem } from './model';
import { classifyGas } from './rules';
import { at, FIGURE7_STOPS, figure5, figure7, practice1, SAMPLES } from './samples';
import { solve } from './solve';
import { airflow, ventFindings } from './vent';

let n = 0;
const mk = (kind: El['kind'], p: { x: number; y: number }, extra: Partial<El> = {}, sub?: El['sub']): El => ({ ...makeElement({ kind, sub }, p.x, p.y, `t${++n}`), ...extra });

function prob(entries: number, rows: number, els: (l: Problem['layout']) => El[], extra: Partial<Problem> = {}): Problem {
  const p = blankProblem('test');
  p.layout = defaultLayout(entries, rows);
  p.elements = els(p.layout);
  return { ...p, ...extra };
}

describe('gas classes use the rule book thresholds', () => {
  it('explosive: 5–15% CH4 inclusive with 12.1% O2 or more (Rule 31)', () => {
    expect(classifyGas({ ch4: 5, co: 0, o2: 12.1 }).explosive).toBe(true);
    expect(classifyGas({ ch4: 15, co: 0, o2: 20 }).explosive).toBe(true);
    expect(classifyGas({ ch4: 4.9, co: 0, o2: 20 }).explosive).toBe(false);
    expect(classifyGas({ ch4: 15.1, co: 0, o2: 20 }).explosive).toBe(false);
    expect(classifyGas({ ch4: 8, co: 0, o2: 12 }).explosive).toBe(false);
  });
  it('irrespirable: O2 below 19.5% or CO over 50 PPM (Rule 34)', () => {
    expect(classifyGas({ ch4: 0, co: 0, o2: 19.4 }).irrespirable).toBe(true);
    expect(classifyGas({ ch4: 0, co: 0, o2: 19.5 }).irrespirable).toBe(false);
    expect(classifyGas({ ch4: 0, co: 51, o2: 20.8 }).irrespirable).toBe(true);
    expect(classifyGas({ ch4: 0, co: 50, o2: 20.8 }).irrespirable).toBe(false);
  });
  it('contaminant: CO above 10 PPM, CH4 above 1%, O2 below 19.5% (Rule 44)', () => {
    expect(classifyGas({ ch4: 0, co: 11, o2: 20.8 }).contaminant).toBe(true);
    expect(classifyGas({ ch4: 0, co: 10, o2: 20.8 }).contaminant).toBe(false);
    expect(classifyGas({ ch4: 1.1, co: 0, o2: 20.8 }).contaminant).toBe(true);
    expect(classifyGas({ ch4: 1, co: 0, o2: 20.8 }).contaminant).toBe(false);
    expect(classifyGas({ ch4: 0, co: 11, o2: 20.8 }).fireEvidence).toBe(true);
  });
});

describe('geometry', () => {
  const l = defaultLayout(3, 4);
  const t = buildTopo(makeGeo(l));
  it('builds intersections and openings', () => {
    expect(t.nodes.has(nodeId(0, 0))).toBe(true);
    expect(t.nodes.has(nodeId(2, 3))).toBe(true);
    // 3 entries x 3 segments + 3 inby stubs + 2 crosscuts x 4 rows
    expect([...t.edges.values()].filter((e) => e.type === 'entry').length).toBe(9);
    expect([...t.edges.values()].filter((e) => e.type === 'stub').length).toBe(3);
    expect([...t.edges.values()].filter((e) => e.type === 'xc').length).toBe(8);
  });
  it('locates points and snaps across symbols perpendicular to the opening', () => {
    expect(locate(t, at.node(l, 1, 2).x, at.node(l, 1, 2).y)).toEqual({ type: 'node', node: nodeId(1, 2) });
    const e = at.entry(l, 1, 1);
    expect(snap(t, e.x + 3, e.y, 'across')).toMatchObject({ x: e.x, rot: 0 });
    const x = at.xc(l, 0, 2);
    expect(snap(t, x.x, x.y + 4, 'across')).toMatchObject({ y: x.y, rot: 90 });
    // A stopping dropped on an intersection moves into the nearest opening.
    const nd = at.node(l, 1, 2);
    const s = snap(t, nd.x, nd.y + 6, 'across')!;
    expect(locate(t, s.x, s.y).type).toBe('edge');
  });
});

describe('exploration solver', () => {
  it('reproduces the rule book Figure 7 team stops (Rule 44D numbering)', () => {
    const plan = explore(makeBoard(figure7()));
    const stops = plan.steps.filter((s) => s.n).map((s) => s.at!.split('#')[0]);
    expect(stops).toEqual(FIGURE7_STOPS.map(([i, r]) => nodeId(i, r)));
    expect(plan.withdrawal).toBeNull();
  });

  it('ties across and outby in an open section before advancing (Figure 5)', () => {
    const plan = explore(makeBoard(figure5()));
    const fresh = plan.steps.filter((s) => s.n).map((s) => s.at);
    expect(fresh.slice(0, 3)).toEqual([nodeId(0, 1), nodeId(1, 1), nodeId(2, 1)]);
    // Every opening between intersections gets explored.
    expect(plan.unexplored).toEqual([]);
    // Never advance to a row while an earlier row still has unexplored intersections.
    let maxRow = 0;
    for (const s of plan.steps.filter((x) => x.n)) {
      const r = Number(s.at!.split(':')[1]);
      expect(r).toBeLessThanOrEqual(maxRow + 1);
      maxRow = Math.max(maxRow, r);
    }
  });

  it('solves the practice problem: timbers to the patient under unsafe roof, barricade breached, everyone accounted for', () => {
    const plan = explore(makeBoard(practice1()));
    const kinds = plan.steps.map((s) => s.kind);
    expect(plan.withdrawal).toBeNull();
    expect(plan.personsFound).toBe(3);
    expect(kinds.filter((k) => k === 'recover').length).toBe(2);
    expect(kinds.indexOf('support')).toBeLessThan(kinds.indexOf('recover'));
    expect(kinds).toContain('breach');
    // The fire is put out before it is passed.
    expect(plan.changed.get(practice1().elements.find((e) => e.kind === 'fire')!.id)).toBe('extinguished');
  });

  it('withdraws when an explosive mixture meets evidence of fire (Rule 31B)', () => {
    const p = prob(2, 3, (l) => [mk('gas', at.entry(l, 0, 1, 0.3), { ch4: 8, co: 40, o2: 19 })]);
    const plan = explore(makeBoard(p));
    expect(plan.withdrawal).not.toBeNull();
    expect(plan.steps.some((s) => s.kind === 'withdraw')).toBe(true);
  });

  it('does not withdraw for an explosive mixture alone', () => {
    const p = prob(2, 3, (l) => [mk('gas', at.entry(l, 0, 1, 0.3), { ch4: 8, co: 0, o2: 19 })]);
    expect(explore(makeBoard(p)).withdrawal).toBeNull();
  });

  it('withdraws for energized equipment in an explosive mixture', () => {
    const p = prob(2, 3, (l) => [mk('gas', at.entry(l, 0, 2, 0.2), { ch4: 8, co: 0, o2: 19 }), mk('x', at.entry(l, 0, 2, 0.6), { energized: true }, 'equipment')]);
    expect(explore(makeBoard(p)).withdrawal?.reason).toMatch(/Energized/);
  });

  it('leaves a patient behind water over knee deep without a pump, and pumps when one is found', () => {
    const base = (withPump: boolean) =>
      prob(
        2,
        3,
        (l) => [
          mk('water', at.xc(l, 0, 2, 0.4), { overKnee: true }),
          mk('person', at.xc(l, 0, 2, 0.4), { conscious: true }),
          mk('caved', at.entry(l, 1, 0)),
          mk('caved', at.entry(l, 1, 1)),
          ...(withPump ? [mk('x', at.entry(l, 0, 0, 0.5), {}, 'pump')] : [])
        ],
        { missing: 1 }
      );
    const without = explore(makeBoard(base(false)));
    expect(without.personsFound).toBe(1);
    expect(without.steps.some((s) => s.kind === 'recover')).toBe(false);
    const withPump = explore(makeBoard(base(true)));
    expect(withPump.steps.some((s) => s.kind === 'pump')).toBe(true);
    expect(withPump.steps.some((s) => s.kind === 'recover')).toBe(true);
  });
});

describe('extent of gases and smoke (Rule 24E)', () => {
  it('confines a gas placard in an intersection to the intersection', () => {
    const p = prob(2, 3, (l) => [mk('gas', at.node(l, 0, 1), { ch4: 2, co: 0, o2: 20 })]);
    const [h] = hazards(makeBoard(p));
    expect(h.extent.nodes.size).toBe(1);
    expect(h.extent.edges.size).toBe(0);
  });
  it('stops a gas at the imaginary line of the next intersection', () => {
    const p = prob(2, 3, (l) => [mk('gas', at.entry(l, 0, 1, 0.2), { ch4: 2, co: 0, o2: 20 })]);
    const b = makeBoard(p);
    const [h] = hazards(b);
    const [[eid, spans]] = [...h.extent.edges];
    const e = b.topo.edges.get(eid)!;
    expect(spans[0][1]).toBeCloseTo(e.len - p.layout.entryWidth / 2);
    expect(h.extent.nodes.size).toBe(0);
  });
  it('floods smoke through intersections until end-of-smoke placards and airtight stoppings', () => {
    const p = prob(2, 4, (l) => [
      mk('smoke', at.entry(l, 0, 1, 0.1)),
      mk('smoke-end', at.entry(l, 0, 2, 0.5)),
      mk('perm-stopping', at.xc(l, 0, 2, 0.5))
    ]);
    const b = makeBoard(p);
    const [h] = hazards(b);
    const g = buildGraph(b, 'air');
    expect(h.extent.nodes.has(nodeId(0, 2))).toBe(true);
    expect(h.extent.nodes.has(nodeId(0, 3))).toBe(false);
    expect(h.extent.nodes.has(nodeId(1, 2))).toBe(false);
    expect(h.extent.nodes.has(nodeId(0, 1))).toBe(false); // not back outby of the placard
    expect(g.subs.size).toBeGreaterThan(0);
  });
});

describe('ventilation estimate', () => {
  it('moves air from the FAB to an exhausting fan and flags explosive gas carried over a fire', () => {
    const p = prob(2, 3, (l) => [
      mk('fan', at.entry(l, 0, 2, 0.9), { fanMode: 'exhausting', on: true }),
      mk('gas', at.entry(l, 0, 1, 0.2), { ch4: 7, co: 0, o2: 20 }),
      mk('fire', at.entry(l, 0, 1, 0.8), { extinguishable: true })
    ]);
    const b = makeBoard(p);
    const af = airflow(b);
    expect(af.flow.size).toBeGreaterThan(0);
    const plan = explore(b);
    const f = ventFindings(b, af, plan.hazards, { explored: plan.explored, seen: plan.seen, unaccounted: 0, extinguished: new Set(), removedPersons: new Set() });
    expect(f.some((x) => x.level === 'danger' && x.rules.includes('b-card-31'))).toBe(true);
  });
  it('has no airflow when no fan runs (Miscellaneous rule 4)', () => {
    const p = prob(2, 3, () => []);
    expect(airflow(makeBoard(p)).flow.size).toBe(0);
  });
  it('an airtight stopping blocks the branch', () => {
    const p = prob(1, 3, (l) => [mk('fan', at.entry(l, 0, 2, 0.9), { on: true }), mk('perm-stopping', at.entry(l, 0, 1, 0.5))]);
    expect(airflow(makeBoard(p)).flow.size).toBe(0);
  });
});

describe('problem files', () => {
  it('round-trips every sample through JSON', () => {
    for (const s of SAMPLES) {
      const p = s.make();
      const back = normalizeProblem(JSON.parse(JSON.stringify(p)));
      expect(back.elements.length).toBe(p.elements.length);
      expect(back.layout).toEqual(p.layout);
    }
  });
  it('rejects non-problems and cleans bad fields', () => {
    expect(() => normalizeProblem({ hello: 1 })).toThrow(/schema/);
    const p = normalizeProblem({ schema: 'mrs-problem/1', title: 'x', layout: { entries: 99, rows: -3, cells: { '1,1': 'open', bad: 'x' } }, elements: [{ kind: 'nope', x: 1, y: 1 }, { kind: 'gas', x: 30, y: 30, ch4: '5' }] });
    expect(p.layout.entries).toBe(12);
    expect(p.layout.rows).toBe(2);
    expect(p.layout.cells).toEqual({ '1,1': 'open' });
    expect(p.elements.length).toBe(1);
    expect(p.elements[0].ch4).toBeUndefined();
  });
  it('solve() lists what to map and flags design issues', () => {
    const s = solve(practice1());
    expect(s.items.some((i) => i.el.kind === 'gas' && i.bo)).toBe(true);
    expect(s.items.find((i) => i.el.kind === 'x' && i.el.sub === 'lunch-pail')?.bo).toBe(false);
    expect(s.notMapped.some((i) => i.where.length > 0) || s.notMapped.length === 0).toBe(true);
    const bad = solve(prob(2, 3, (l) => [mk('perm-stopping', at.entry(l, 0, 1), { text: 'STOPPING' }), mk('gas', at.entry(l, 1, 1), { text: 'AIR CLEAR' })]));
    expect(bad.checks.some((c) => /permanent or temporary/.test(c.text))).toBe(true);
    expect(bad.checks.some((c) => /Air clear/i.test(c.text))).toBe(true);
  });
});
