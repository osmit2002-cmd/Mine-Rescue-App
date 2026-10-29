/**
 * Airflow estimate and ventilation checks.
 *
 * The openings form a resistance network: every entry and crosscut is a branch, airtight separations remove a
 * branch, damaged structures add resistance. Openings to the surface (the FAB when it is fresh, air shafts) sit
 * at atmospheric pressure; a running fan pulls (exhausting) or pushes (blowing). Branch flows come from
 * Kirchhoff's laws. Air enters all openings where exhaust ventilation applies and exits all openings where
 * blowing ventilation applies (Miscellaneous rule 4).
 *
 * It is a teaching estimate for "what moves where if we change this", not a ventilation survey.
 */
import { buildGraph, otherEnd, subOfPlaced, type Board, type Graph, type Placed } from './graph';
import { contains, type Hazard } from './extents';
import type { El } from './model';
import { airEffect, isIgnition } from './rules';
import { elementName, placardText } from './catalog';

export interface Airflow {
  graph: Graph;
  /** Signed flow per edge (positive from end a to end b), scaled so the largest is 1. Edges without flow are absent. */
  flow: Map<string, number>;
  /** Openings used: FAB, shafts and fans. */
  openings: string[];
  /** Why there is no airflow, when there is none. */
  note?: string;
}

const LEAK_R = 40;

/** Conjugate gradient for the symmetric positive-definite system A x = b given as sparse rows. */
function cg(rows: Map<number, number>[], diag: number[], b: number[]): number[] {
  const n = b.length;
  const x = new Array<number>(n).fill(0);
  const mul = (v: number[]) => v.map((_, i) => {
    let s = diag[i] * v[i];
    for (const [j, a] of rows[i]) s += a * v[j];
    return s;
  });
  const r = b.slice();
  const p = r.slice();
  let rs = r.reduce((s, v) => s + v * v, 0);
  const tol = 1e-20 * Math.max(1, rs);
  for (let k = 0; k < 4 * n + 50 && rs > tol; k++) {
    const Ap = mul(p);
    const alpha = rs / p.reduce((s, v, i) => s + v * Ap[i], 0);
    for (let i = 0; i < n; i++) {
      x[i] += alpha * p[i];
      r[i] -= alpha * Ap[i];
    }
    const rs2 = r.reduce((s, v) => s + v * v, 0);
    const beta = rs2 / rs;
    rs = rs2;
    for (let i = 0; i < n; i++) p[i] = r[i] + beta * p[i];
  }
  return x;
}

/** Nearest end (sub-node) of the edge an element sits on, or the intersection it is in. */
export function attachSub(g: Graph, q: Placed): string | null {
  if (q.loc.type === 'node') return subOfPlaced(g, q) ?? q.loc.node;
  if (q.loc.type !== 'edge') return null;
  const e = g.board.topo.edges.get(q.loc.edge)!;
  const ends = g.ends.get(q.loc.edge);
  if (!ends) return null;
  return q.s <= e.len / 2 ? ends[0] : ends[1];
}

export function airflow(board: Board): Airflow {
  const g = buildGraph(board, 'air');
  const flow = new Map<string, number>();
  // Branch resistances.
  const R = new Map<string, number>();
  for (const [eid] of g.ends) {
    const e = board.topo.edges.get(eid)!;
    let r = Math.max(1, e.len) / 100;
    let blocked = false;
    for (const q of board.onEdge.get(eid) ?? []) {
      const eff = airEffect(q.el);
      if (eff === 'block') blocked = true;
      else if (eff === 'leak') r += LEAK_R;
    }
    if (!blocked) R.set(eid, r);
  }
  // Fixed pressures.
  const fixed = new Map<string, { p: number; r: number }[]>(); // sub → connections to fixed pressure
  const openings: string[] = [];
  const addFixed = (sub: string, p: number, r: number) => fixed.set(sub, [...(fixed.get(sub) ?? []), { p, r }]);
  // A running fan in the FAB drives it: the FAB is then the intake (or return), not open to the atmosphere.
  const fanInFab = [...board.placed.values()].some((q) => q.el.kind === 'fan' && q.el.on !== false && g.subs.get(attachSub(g, q) ?? '')?.node.r === 0);
  if (board.problem.fabFresh && !fanInFab) {
    for (const s of g.subs.values()) if (s.node.fab) addFixed(s.id, 0, 0.01);
    openings.push('FAB (fresh air)');
  }
  let fans = 0;
  for (const q of board.placed.values()) {
    const s = attachSub(g, q);
    if (!s) continue;
    if (q.el.kind === 'x' && (q.el.sub === 'shaft' || q.el.sub === 'outby')) {
      addFixed(s, 0, 0.05);
      openings.push(`${elementName(q.el)}${placardText(q.el) ? ` (${placardText(q.el)})` : ''}`);
    } else if (q.el.kind === 'fan' && q.el.on !== false) {
      addFixed(s, q.el.fanMode === 'blowing' ? 1 : -1, 0.05);
      openings.push(`Fan ${q.el.fanMode === 'blowing' ? 'blowing' : 'exhausting'}`);
      fans++;
    }
  }
  if (!fans) return { graph: g, flow, openings, note: 'No fan is running, so no air moves (Miscellaneous rule 4: if no airflow is indicated, none exists).' };
  // Unknowns: sub-nodes connected (through open branches) to a fixed pressure.
  const reach = new Set<string>();
  const stack = [...fixed.keys()];
  stack.forEach((s) => reach.add(s));
  while (stack.length) {
    const u = stack.pop()!;
    for (const eid of g.adj.get(u) ?? []) {
      if (!R.has(eid)) continue;
      const v = otherEnd(g, eid, u);
      if (!reach.has(v)) {
        reach.add(v);
        stack.push(v);
      }
    }
  }
  const idx = new Map<string, number>();
  for (const s of reach) idx.set(s, idx.size);
  const n = idx.size;
  const rows: Map<number, number>[] = Array.from({ length: n }, () => new Map());
  const diag = new Array<number>(n).fill(0);
  const b = new Array<number>(n).fill(0);
  for (const [s, i] of idx) {
    for (const f of fixed.get(s) ?? []) {
      diag[i] += 1 / f.r;
      b[i] += f.p / f.r;
    }
    for (const eid of g.adj.get(s) ?? []) {
      const r = R.get(eid);
      if (r === undefined) continue;
      const j = idx.get(otherEnd(g, eid, s));
      if (j === undefined || j === i) continue;
      diag[i] += 1 / r;
      rows[i].set(j, (rows[i].get(j) ?? 0) - 1 / r);
    }
  }
  const pr = n ? cg(rows, diag, b) : [];
  let max = 0;
  const raw = new Map<string, number>();
  for (const [eid, [a, bb]] of g.ends) {
    const r = R.get(eid);
    const ia = idx.get(a);
    const ib = idx.get(bb);
    if (r === undefined || ia === undefined || ib === undefined) continue;
    const q = (pr[ia] - pr[ib]) / r;
    raw.set(eid, q);
    max = Math.max(max, Math.abs(q));
  }
  // Ignore trickles (under 1% of the main flow) so the arrows show where the air really goes.
  if (max > 1e-9) for (const [eid, q] of raw) if (Math.abs(q) > max * 0.01) flow.set(eid, q / max);
  return { graph: g, flow, openings, note: flow.size ? undefined : 'The fan has no path through the workings: no air moves inby.' };
}

export interface VentFinding {
  level: 'danger' | 'warn' | 'info';
  text: string;
  rules: string[];
}

/** Sub-nodes and edges downstream of a hazard: the air leaving its extent carries it there. */
function downstream(af: Airflow, hz: Hazard, baseOfSub: (s: string) => string): { edges: Set<string>; subs: Set<string> } {
  const g = af.graph;
  const edges = new Set<string>();
  const subs = new Set<string>();
  const queue: string[] = [];
  const pushSub = (s: string) => {
    if (subs.has(s)) return;
    subs.add(s);
    queue.push(s);
  };
  for (const [eid] of hz.extent.edges) {
    const q = af.flow.get(eid);
    if (!q) continue;
    edges.add(eid);
    const [a, b] = g.ends.get(eid)!;
    pushSub(q > 0 ? b : a);
  }
  for (const s of hz.extent.nodes) {
    const base = baseOfSub(s);
    for (const sub of g.subsOf.get(base) ?? []) pushSub(sub);
  }
  while (queue.length) {
    const u = queue.shift()!;
    for (const eid of g.adj.get(u) ?? []) {
      const q = af.flow.get(eid);
      if (!q) continue;
      const [a, b] = g.ends.get(eid)!;
      const leaves = (q > 0 && a === u) || (q < 0 && b === u);
      if (!leaves) continue;
      edges.add(eid);
      pushSub(otherEnd(g, eid, u));
    }
  }
  return { edges, subs };
}

export interface VentContext {
  /** Base node ids the team has explored and edges fully seen (from the exploration plan). */
  explored: Set<string>;
  seen: Map<string, [number, number][]>;
  /** Missing persons still unaccounted for. */
  unaccounted: number;
  /** Elements that are no longer ignition sources (fires put out). */
  extinguished: Set<string>;
  /** Patients already taken out. */
  removedPersons: Set<string>;
  /** Other elements to treat as potentially live persons (e.g. a placard that only says "person", not yet examined). */
  protect?: Set<string>;
}

/** What the airflow would do with the smoke and gases as found: Rules 30F, 30G, 30H and 31A/C/D. */
export function ventFindings(board: Board, af: Airflow, hz: Hazard[], ctx: VentContext): VentFinding[] {
  const out: VentFinding[] = [];
  const g = af.graph;
  const baseOfSub = (s: string) => s.split('#')[0];
  const fullySeen = (eid: string) => {
    const e = board.topo.edges.get(eid)!;
    if (board.topo.nodes.get(e.a)?.fab && board.topo.nodes.get(e.b)?.fab) return true; // the FAB itself
    const spans = ctx.seen.get(eid) ?? [];
    const covered = spans.reduce((t, [a, b]) => t + (b - a), 0);
    return covered >= e.len - 0.5;
  };
  const elsAt = (edges: Set<string>, subs: Set<string>): Placed[] => {
    const res: Placed[] = [];
    for (const eid of edges) res.push(...(board.onEdge.get(eid) ?? []));
    for (const s of subs) for (const q of board.onNode.get(baseOfSub(s)) ?? []) if (subOfPlaced(g, q) === s) res.push(q);
    return res;
  };
  const label = (h: Hazard) => (h.el.kind === 'smoke' ? `smoke${placardText(h.el) && placardText(h.el) !== 'SMOKE' ? ` (${placardText(h.el)})` : ''}` : `the gas at placard ${placardText(h.el)}`);
  const unexploredIn = (edges: Set<string>, subs: Set<string>) => {
    const names: string[] = [];
    for (const s of subs) {
      const node = g.subs.get(s)?.node;
      if (node && !node.end && !ctx.explored.has(baseOfSub(s))) names.push(s);
    }
    for (const eid of edges) if (!fullySeen(eid)) names.push(eid);
    return names.length;
  };
  for (const h of hz) {
    if (!h.cls.irrespirable && !h.cls.explosive && !h.cls.contaminant) continue;
    const moving = [...h.extent.edges.keys()].some((e) => af.flow.has(e)) || [...h.extent.nodes].some((s) => (g.adj.get(s) ?? []).some((e) => af.flow.has(e)));
    if (!moving) continue;
    const d = downstream(af, h, baseOfSub);
    const here = elsAt(d.edges, d.subs);
    const before = out.length;
    if (h.cls.explosive) {
      const ign = here.filter((q) => isIgnition(q.el) && !ctx.extinguished.has(q.el.id));
      if (ign.length)
        out.push({ level: 'danger', text: `Explosive mixture (${placardText(h.el)}) would be moved over ${ign.map((q) => elementName(q.el).toLowerCase()).join(', ')} — 30 points per mixture per ignition source.`, rules: ['b-card-31'] });
      const ux = unexploredIn(d.edges, d.subs);
      if (ux) out.push({ level: 'danger', text: `Explosive mixture (${placardText(h.el)}) would be moved over ${ux} unexplored area(s) — 30 points per mixture per area.`, rules: ['b-card-31'] });
    }
    if (h.cls.irrespirable) {
      const ux = unexploredIn(d.edges, d.subs);
      if (ux && ctx.unaccounted > 0)
        out.push({ level: 'danger', text: `Irrespirable ${label(h)} would be ventilated over ${ux} unexplored area(s) while ${ctx.unaccounted} person(s) are unaccounted for (potentially live) — 5 points per mixture × area × person (max 3 persons).`, rules: ['b-card-30'] });
      const fab = [...d.subs].filter((s) => g.subs.get(s)?.node.fab);
      if (fab.length && !board.problem.boOutside) out.push({ level: 'warn', text: `Irrespirable ${label(h)} reaches the FAB. The briefing officer's designated location must stay respirable (not by apparatus or SCSR).`, rules: ['b-card-30'] });
      const ppl = here.filter((q) => (q.el.kind === 'person' && !ctx.removedPersons.has(q.el.id)) || !!ctx.protect?.has(q.el.id));
      if (ppl.length) out.push({ level: 'warn', text: `Irrespirable ${label(h)} would reach ${ppl.length} live person(s): protect them first.`, rules: ['b-card-34'] });
    }
    if (out.length === before)
      out.push({ level: 'info', text: `${h.el.kind === 'smoke' ? 'Smoke' : `Gas at ${placardText(h.el)}`} is carried toward the return; nothing in its path is unexplored, an ignition source or the FAB.`, rules: ['misc-4'] });
  }
  // Rule 30G: never ventilate over an inextinguishable fire.
  for (const q of board.placed.values()) {
    if (q.el.kind !== 'fire' || q.el.extinguishable !== false) continue;
    const moving = q.loc.type === 'edge' ? af.flow.has(q.loc.edge) : q.loc.type === 'node' ? (g.adj.get(subOfPlaced(g, q) ?? q.loc.node) ?? []).some((e) => af.flow.has(e)) : false;
    if (moving) out.push({ level: 'danger', text: `Air is moving over the inextinguishable fire${placardText(q.el) ? ` (${placardText(q.el)})` : ''}.`, rules: ['b-card-30'] });
  }
  if (!out.length && af.flow.size) out.push({ level: 'info', text: 'No smoke or gas is moved over an ignition source, an unexplored area or the FAB.', rules: ['misc-4'] });
  return out;
}

/** Hazards whose extent contains an element (e.g. is this person in irrespirable air?). */
export function hazardsAt(board: Board, hz: Hazard[], el: El): Hazard[] {
  const q = board.placed.get(el.id);
  if (!q) return [];
  const g = buildGraph(board, 'air');
  return hz.filter((h) => contains(h.extent, g, q));
}
