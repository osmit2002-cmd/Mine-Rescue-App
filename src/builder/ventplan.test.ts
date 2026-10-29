import { describe, expect, it } from 'vitest';
import { makeElement } from './catalog';
import { cellKey } from './geometry';
import { makeBoard, type Board } from './graph';
import { blankProblem, defaultLayout, type El, type Problem } from './model';
import { at } from './samples';
import { airflow, type VentContext } from './vent';
import { boardWith, emptyVentState, planVent } from './ventplan';

let n = 0;
const mk = (kind: El['kind'], p: { x: number; y: number }, extra: Partial<El> = {}, sub?: El['sub']): El => ({ ...makeElement({ kind, sub }, p.x, p.y, `v${++n}`), ...extra });

/** Three entries, four crosscut rows, exhausting fan at a shaft in the right side stub of row 3. */
function mine(els: (l: Problem['layout']) => El[]): Problem {
  const p = blankProblem('vent test');
  p.layout = defaultLayout(3, 4);
  p.layout.cells[cellKey(6, 6)] = 'open';
  const fanAt = at.xc(p.layout, 2, 3, 0.8);
  p.elements = [mk('x', fanAt, { text: 'AIR SHAFT' }, 'shaft'), mk('fan', fanAt, { fanMode: 'exhausting', on: true }), ...els(p.layout)];
  return p;
}

/** Everything explored and seen. */
function allKnown(b: Board, extra: Partial<VentContext> = {}): VentContext {
  const seen = new Map<string, [number, number][]>();
  for (const e of b.topo.edges.values()) seen.set(e.id, [[0, e.len]]);
  return { explored: new Set(b.topo.nodes.keys()), seen, unaccounted: 0, extinguished: new Set(), removedPersons: new Set(), ...extra };
}

describe('ventilation planner', () => {
  it('routes air through an explosive mixture to the return and checks the result with the airflow estimate', () => {
    const p = mine((l) => [mk('gas', at.entry(l, 0, 1), { ch4: 6, co: 0, o2: 20 }, undefined)]);
    const b = makeBoard(p);
    const gasId = p.elements[2].id;
    const plan = planVent(b, gasId, allKnown(b));
    expect(plan.ok, plan.why).toBe(true);
    expect(plan.mode).toBe('through');
    expect(plan.findings).toEqual([]);
    // Air really moves through the placard's opening with the stoppings built.
    const af = airflow(boardWith(b, emptyVentState(), plan.built, true));
    expect(af.flow.has(b.placed.get(gasId)!.loc.type === 'edge' ? (b.placed.get(gasId)!.loc as { edge: string }).edge : '')).toBe(true);
    expect(plan.steps.map((s) => s.kind)).toEqual(['permission', ...plan.built.map(() => 'build'), 'course', 'retest']);
  });

  it('never routes an explosive mixture over an ignition source (Rule 31)', () => {
    // The only way from the No. 1 Entry face area to the return is across the energized equipment in the inby crosscut.
    const p = mine((l) => [
      mk('gas', at.entry(l, 0, 3, 0.5), { ch4: 7, co: 0, o2: 20 }),
      mk('x', at.xc(l, 0, 3), { energized: true, text: 'ENERGIZED SCOOP' }, 'equipment'),
      mk('perm-stopping', at.entry(l, 0, 2)),
      mk('perm-stopping', at.xc(l, 0, 2))
    ]);
    const b = makeBoard(p);
    const plan = planVent(b, p.elements[2].id, allKnown(b));
    expect(plan.ok).toBe(false);
    expect(plan.why).toMatch(/ignition source/);
  });

  it('will not carry irrespirable air over an unexplored area while persons are unaccounted for (Rule 30)', () => {
    // Every way to the fan passes the No. 3 Entry at the last crosscut.
    const p = mine((l) => [mk('gas', at.entry(l, 0, 1), { ch4: 0, co: 0, o2: 17 })]);
    const b = makeBoard(p);
    const ctx = allKnown(b, { unaccounted: 2 });
    ctx.explored.delete('n2:3');
    const plan = planVent(b, p.elements[2].id, ctx);
    expect(plan.ok).toBe(false);
    expect(plan.why).toMatch(/unexplored/);
    // Once that intersection is explored the same plan is fine.
    expect(planVent(b, p.elements[2].id, allKnown(b, { unaccounted: 2 })).ok).toBe(true);
  });

  it('wings a line curtain to a placard in a dead end', () => {
    const p = mine((l) => [mk('gas', at.entry(l, 1, 3, 0.6), { ch4: 6, co: 0, o2: 20 })]);
    const b = makeBoard(p);
    const plan = planVent(b, p.elements[2].id, allKnown(b));
    expect(plan.ok, plan.why).toBe(true);
    expect(plan.mode).toBe('wing');
    expect(plan.steps.some((s) => s.kind === 'curtain')).toBe(true);
  });

  it('asks for the fan when it is off, and fails without a return for a blowing fan', () => {
    const p = mine((l) => [mk('gas', at.entry(l, 0, 1), { ch4: 6, co: 0, o2: 20 })]);
    p.elements[1].on = false;
    const b = makeBoard(p);
    expect(planVent(b, p.elements[2].id, allKnown(b)).steps.some((s) => s.kind === 'fan')).toBe(true);
    const q = { ...p, fabFresh: false, elements: p.elements.filter((e) => e.kind !== 'x').map((e) => (e.kind === 'fan' ? { ...e, fanMode: 'blowing' as const } : e)) };
    const bq = makeBoard(q);
    expect(planVent(bq, p.elements[2].id, allKnown(bq)).why).toMatch(/no shaft or outby opening/);
  });
});
