/**
 * Ventilation planner: works out, step by step, how to move one contaminant out of the team's way.
 *
 * For a target gas or smoke placard it picks an air course: from the intake (the fan when it blows, otherwise the
 * FAB, shafts and outby openings) to the placard, and from the placard to a return. The contaminated leg, from
 * the placard to the return, may not pass an ignition source (explosive mixtures, Rule 31), an unexplored area
 * (Rules 30, 31), a live or not yet examined person, or the FAB when the briefing officer is there (Rule 30).
 * Every other opening that would short-circuit the course gets a team-built temporary stopping. A placard in a
 * dead end (an opening closed by a barricade, a face) is reached with a line curtain winged from the course.
 * The plan is then checked by running the airflow estimate (vent.ts) with the stoppings built and the fan on.
 *
 * It finds one rule-consistent plan, not necessarily the judges' plan.
 */
import { elementName, placardText } from './catalog';
import { hazards, type Hazard } from './extents';
import { edgePoint, locName, nodeName } from './geometry';
import { buildGraph, endOf, makeBoard, otherEnd, subOfPlaced, type Board, type Graph, type Placed } from './graph';
import type { El } from './model';
import { airEffect, isIgnition } from './rules';
import { airflow, attachSub, ventFindings, type Airflow, type VentContext, type VentFinding } from './vent';

export interface VentStep {
  kind: 'permission' | 'build' | 'curtain' | 'fan' | 'course' | 'retest';
  text: string;
  rules: string[];
  el?: string;
}

/** Changes made by earlier ventilation steps, carried into the next plan. */
export interface VentState {
  /** Elements no longer in the mine (breached structures, patients taken out). */
  removed: Set<string>;
  /** Team-built stoppings and curtains from earlier plans. */
  built: El[];
  /** Fan switched on by an earlier plan. */
  fanOn: boolean;
}

export interface VentPlan {
  ok: boolean;
  target: string;
  mode: 'through' | 'wing';
  steps: VentStep[];
  /** Team-built stoppings and the line curtain added by this plan. */
  built: El[];
  /** Air course from intake to return (air sub-node ids). */
  course: string[];
  airflow: Airflow | null;
  findings: VentFinding[];
  /** Why no plan was found. */
  why?: string;
}

export const emptyVentState = (): VentState => ({ removed: new Set(), built: [], fanOn: false });

/** The board as it stands after earlier changes. */
export function boardWith(base: Board, st: VentState, extra: El[] = [], fanOn = st.fanOn): Board {
  const els = base.problem.elements
    .filter((e) => !st.removed.has(e.id))
    .map((e) => (e.kind === 'fan' && fanOn ? { ...e, on: true } : e))
    .concat(st.built, extra);
  return makeBoard(base.problem, els);
}

interface Leg {
  cost: Map<string, number>;
  prev: Map<string, { sub: string; edge: string } | null>;
}

const W_LEAK = 200; // a damaged structure on the course costs as much as a long detour

function dijkstra(g: Graph, from: Map<string, number>, edgeOk: (eid: string) => boolean, len: (eid: string) => number, nodeOk: (sub: string) => boolean): Leg {
  const cost = new Map<string, number>();
  const prev = new Map<string, { sub: string; edge: string } | null>();
  const q: [string, number, { sub: string; edge: string } | null][] = [...from].map(([s, c]) => [s, c, null]);
  while (q.length) {
    q.sort((a, b) => a[1] - b[1]);
    const [u, d, p] = q.shift()!;
    if (cost.has(u)) continue;
    cost.set(u, d);
    prev.set(u, p);
    for (const eid of g.adj.get(u) ?? []) {
      if (!edgeOk(eid)) continue;
      const v = otherEnd(g, eid, u);
      if (cost.has(v) || !nodeOk(v)) continue;
      q.push([v, d + len(eid), { sub: u, edge: eid }]);
    }
  }
  return { cost, prev };
}

/** Subs and edges from a leg's source to `to`, in order from the source. */
function trace(leg: Leg, to: string): { subs: string[]; edges: string[] } {
  const subs: string[] = [];
  const edges: string[] = [];
  let x: string | undefined = to;
  while (x !== undefined) {
    subs.unshift(x);
    const p = leg.prev.get(x);
    if (!p) break;
    edges.unshift(p.edge);
    x = p.sub;
  }
  return { subs, edges };
}

/** Plan the ventilation that moves the hazard at placard `target` (a gas or smoke element). */
export function planVent(base: Board, target: string, ctx: VentContext, st: VentState = emptyVentState()): VentPlan {
  const fail = (why: string, mode: VentPlan['mode'] = 'through'): VentPlan => ({ ok: false, target, mode, steps: [], built: [], course: [], airflow: null, findings: [], why });
  const b = boardWith(base, st);
  const g = buildGraph(b, 'air');
  const topo = b.topo;
  const W = b.problem.layout.entryWidth;
  const q = b.placed.get(target);
  if (!q) return fail('The placard is not in the mine.');
  const hz = hazards(b);
  const H = hz.find((h) => h.el.id === target);
  if (!H) return fail('Only gas and smoke placards can be ventilated.');
  const hzT: Hazard = H;
  const fan = [...b.placed.values()].find((p) => p.el.kind === 'fan');
  if (!fan) return fail('There is no fan to move the air.');
  const fanSub = attachSub(g, fan);
  if (!fanSub) return fail('The fan is not connected to the workings.');
  const blowing = fan.el.fanMode === 'blowing';

  // Openings to the atmosphere.
  const fabAtm = b.problem.fabFresh && g.subs.get(fanSub)?.node.r !== 0;
  const openings = new Set<string>();
  for (const p of b.placed.values()) if (p.el.kind === 'x' && (p.el.sub === 'shaft' || p.el.sub === 'outby')) {
    const s = attachSub(g, p);
    if (s) openings.add(s);
  }
  if (fabAtm) for (const s of g.subs.values()) if (s.node.fab) openings.add(s.id);
  openings.delete(fanSub);
  const intakes = blowing ? new Set([fanSub]) : openings;
  const exits = blowing ? openings : new Set([fanSub]);
  if (!exits.size || !intakes.size) return fail(blowing ? 'The fan blows but there is no shaft or outby opening for the return.' : 'There is no intake for the exhausting fan.');
  const fixed = new Set([...intakes, ...exits]);

  // What the air course may pass.
  const blocks = (eid: string, extra: Set<string>) => extra.has(eid) || (b.onEdge.get(eid) ?? []).some((p) => airEffect(p.el) === 'block');
  const leaks = (eid: string) => (b.onEdge.get(eid) ?? []).some((p) => airEffect(p.el) === 'leak');
  const len = (eid: string) => topo.edges.get(eid)!.len + (leaks(eid) ? W_LEAK : 0);
  const baseOf = (s: string) => g.subs.get(s)!.base;
  const protect = (p: Placed) => (p.el.kind === 'person' && !ctx.removedPersons.has(p.el.id)) || !!ctx.protect?.has(p.el.id);
  const fullySeen = (eid: string) => {
    const e = topo.edges.get(eid)!;
    if (topo.nodes.get(e.a)?.fab && topo.nodes.get(e.b)?.fab) return true; // the FAB itself
    return (ctx.seen.get(eid) ?? []).reduce((t, [a, c]) => t + (c - a), 0) >= e.len - 0.5;
  };
  const why = new Map<string, string>(); // first reason the contaminated leg avoided an opening, for messages
  const dirtyBad = (items: Placed[], where: string): string | null => {
    for (const p of items) {
      if (p.el.id === target) continue;
      if (H.cls.explosive && isIgnition(p.el) && !ctx.extinguished.has(p.el.id)) return `${elementName(p.el).toLowerCase()} (ignition source) at ${where}`;
      if (H.cls.irrespirable && protect(p)) return `${elementName(p.el).toLowerCase()} “${placardText(p.el)}” at ${where}`;
    }
    return null;
  };
  const dirtyNodeOk = (s: string) => {
    const n = g.subs.get(s)!.node;
    const where = nodeName(topo, n.id);
    let r: string | null = null;
    if (!n.end && !n.fab && !ctx.explored.has(n.id)) r = `unexplored ${where}`;
    else if (H.cls.irrespirable && n.fab && !b.problem.boOutside) r = 'the FAB (the briefing officer is there)';
    else r = dirtyBad((b.onNode.get(n.id) ?? []).filter((p) => (subOfPlaced(g, p) ?? n.id) === s), where);
    if (r && !why.has(s)) why.set(s, r);
    return !r;
  };
  const dirtyEdgeOk = (eid: string, extra: Set<string>) => {
    if (blocks(eid, extra)) return false;
    const where = locName(topo, { type: 'edge', edge: eid, s: 0 });
    const r = !fullySeen(eid) ? `unexplored ${where}` : dirtyBad(b.onEdge.get(eid) ?? [], where);
    if (r && !why.has(eid)) why.set(eid, r);
    return !r;
  };

  // Where the course meets the placard.
  interface Option {
    mode: VentPlan['mode'];
    in: string; // course reaches the placard from here
    out: string; // contaminated air leaves from here
    through?: string; // the placard's edge, when the course runs through it
  }
  const options: Option[] = [];
  if (q.loc.type === 'node') {
    const s = subOfPlaced(g, q) ?? q.loc.node;
    options.push({ mode: 'through', in: s, out: s });
  } else if (q.loc.type === 'edge') {
    const eid = q.loc.edge;
    const [ea, eb] = g.ends.get(eid)!;
    const stops = (b.onEdge.get(eid) ?? []).filter((p) => airEffect(p.el) === 'block');
    const openTo = (end: 'a' | 'b') => !stops.some((p) => (end === 'a' ? p.s1 <= q.s : p.s0 >= q.s));
    const isEnd = (s: string) => g.subs.get(s)!.node.end;
    if (!stops.length && !isEnd(ea) && !isEnd(eb)) {
      options.push({ mode: 'through', in: ea, out: eb, through: eid }, { mode: 'through', in: eb, out: ea, through: eid });
    }
    if (openTo('a') && !isEnd(ea)) options.push({ mode: 'wing', in: ea, out: ea });
    if (openTo('b') && !isEnd(eb)) options.push({ mode: 'wing', in: eb, out: eb });
  }
  if (!options.length) return fail('The placard is sealed off on every side: there is no way to bring air to it.', 'wing');

  const tried: string[] = [];
  const candidates: { opt: Option; exit: string; cost: number; c1: { subs: string[]; edges: string[] }; c2: { subs: string[]; edges: string[] } }[] = [];
  const noExtra = new Set<string>();
  const clean = dijkstra(g, new Map([...intakes].map((s) => [s, 0])), (e) => !blocks(e, noExtra), len, () => true);
  for (const opt of options) {
    const c1cost = clean.cost.get(opt.in);
    if (c1cost === undefined) {
      tried.push(`no fresh air reaches ${nodeName(topo, baseOf(opt.in))}`);
      continue;
    }
    if (!dirtyNodeOk(opt.out) && !(fixed.has(opt.out) && exits.has(opt.out))) {
      tried.push(`the contaminated air would leave into ${why.get(opt.out)}`);
      continue;
    }
    const dirty = dijkstra(g, new Map([[opt.out, 0]]), (e) => e !== opt.through && dirtyEdgeOk(e, noExtra), len, dirtyNodeOk);
    for (const x of exits) {
      const c2cost = dirty.cost.get(x);
      if (c2cost === undefined) continue;
      const c1 = trace(clean, opt.in);
      const c2 = trace(dirty, x);
      // The two legs may meet only where the course turns (wing) — otherwise air would short-circuit.
      const shared = c1.subs.filter((s) => c2.subs.includes(s) && !(opt.in === opt.out && s === opt.in));
      if (shared.length) continue;
      candidates.push({ opt, exit: x, cost: c1cost + c2cost + (opt.mode === 'wing' ? 50 : 0), c1, c2 });
    }
    if (![...exits].some((x) => dirty.cost.has(x))) tried.push(`from ${nodeName(topo, baseOf(opt.out))} every way to the return passes ${[...why.values()][0] ?? 'a blocked opening'}`);
  }
  candidates.sort((x, y) => x.cost - y.cost);

  let last: VentPlan | null = null;
  for (const cand of candidates.slice(0, 12)) {
    const plan = build(cand.opt, cand.c1, cand.c2);
    if (plan.ok) return plan;
    last ??= plan;
  }
  return last ?? fail(`No safe air course: ${[...new Set(tried)].join('; ') || 'no route from the intake through the placard to a return'}.`);

  function build(opt: Option, c1: { subs: string[]; edges: string[] }, c2: { subs: string[]; edges: string[] }): VentPlan {
    const courseSubs = opt.in === opt.out ? [...c1.subs, ...c2.subs.slice(1)] : [...c1.subs, ...c2.subs];
    const courseEdges = new Set([...c1.edges, ...(opt.through ? [opt.through] : []), ...c2.edges]);
    const onCourse = new Set(courseSubs);
    // Close every opening that would short-circuit the course: it leads back to the course or to the atmosphere.
    const stopEdges: { eid: string; at: string }[] = [];
    const shut = new Set<string>();
    const circuit = (from: string, at: string): boolean => {
      if (onCourse.has(from) && from !== at) return true;
      if (fixed.has(from)) return true;
      const seenS = new Set([from]);
      const stack = [from];
      while (stack.length) {
        const u = stack.pop()!;
        for (const eid of g.adj.get(u) ?? []) {
          if (courseEdges.has(eid) || blocks(eid, shut)) continue;
          const v = otherEnd(g, eid, u);
          if (seenS.has(v)) continue;
          if (onCourse.has(v) || fixed.has(v)) return true;
          seenS.add(v);
          stack.push(v);
        }
      }
      return false;
    };
    for (const u of courseSubs) {
      for (const eid of g.adj.get(u) ?? []) {
        if (courseEdges.has(eid) || blocks(eid, shut)) continue;
        if (opt.mode === 'wing' && q!.loc.type === 'edge' && eid === q!.loc.edge) continue; // the curtain goes in here
        if (circuit(otherEnd(g, eid, u), u)) {
          shut.add(eid);
          stopEdges.push({ eid, at: u });
        }
      }
    }
    // Team-built stoppings just outside the intersection on the course.
    const built: El[] = [];
    const steps: VentStep[] = [
      { kind: 'permission', text: `Ventilate ${label(hzT)}: get the briefing officer's permission and tell the BO which way the air will go.`, rules: ['b-card-19'] }
    ];
    let k = st.built.length;
    for (const { eid, at } of stopEdges) {
      const e = topo.edges.get(eid)!;
      const fromA = endOf(g, eid, at) === 'a';
      const d = Math.min(e.len / 2, W / 2 + 3);
      const s = fromA ? d : e.len - d;
      const pt = edgePoint(e, s);
      const id = `vent-${++k}`;
      built.push({ id, kind: 'temp-stopping', x: Math.round(pt.x * 10) / 10, y: Math.round(pt.y * 10) / 10, intact: true, airtight: true, text: 'TEMPORARY STOPPING (TEAM-BUILT)' });
      const seenHere = (ctx.seen.get(eid) ?? []).some(([a, c]) => a <= s + 0.5 && c >= s - 0.5) || ctx.explored.has(baseOf(at));
      steps.push({
        kind: 'build',
        el: id,
        text: `Build a temporary stopping in ${locName(topo, { type: 'edge', edge: eid, s })}, next to ${nodeName(topo, baseOf(at))}: roof and rib test first; the captain dates and initials it.${seenHere ? '' : ' (This spot is not explored yet: explore it first.)'}`,
        rules: ['b-card-45', 'b-card-23', 'b-card-27']
      });
    }
    if (opt.mode === 'wing') {
      const id = `vent-${++k}`;
      built.push({ id, kind: 'line-curtain-installed', x: q!.el.x, y: q!.el.y, len: 10, text: 'LINE CURTAIN' });
      steps.push({
        kind: 'curtain',
        el: id,
        text: `Hang the line curtain from ${nodeName(topo, baseOf(opt.in))} into ${locName(topo, q!.loc)} past the placard to wing the air to it; the curtain is airtight and is mapped to its full extent.`,
        rules: ['b-card-48', 'a-card-5']
      });
    }
    const fanOn = fan!.el.on !== false || st.fanOn;
    if (!fanOn) steps.push({ kind: 'fan', text: `Have the briefing officer start the fan (${blowing ? 'blowing' : 'exhausting'}).`, rules: ['b-card-19', 'misc-4'] });

    // Check it with the airflow estimate.
    const b2 = boardWith(base, st, built, true);
    const af = airflow(b2);
    const g2 = af.graph;
    const hz2 = hazards(b2);
    const moved = (h: Hazard): Hazard => (opt.mode === 'wing' && h.el.id === target ? { ...h, extent: { edges: new Map(), nodes: new Set([opt.out]) } } : h);
    const findings = ventFindings(b2, af, hz2.map(moved), ctx).filter((f) => f.level !== 'info');
    const flowsAt = opt.through ? af.flow.has(opt.through) : (g2.adj.get(opt.in) ?? []).some((e) => courseEdges.has(e) && af.flow.has(e));
    const courseNames = courseSubs.map((s) => nodeName(topo, baseOf(s))).filter((n, i, a) => a.indexOf(n) === i);
    const exitSub = courseSubs[courseSubs.length - 1];
    const exitEl = [...b.placed.values()].find((p) => p.el.kind === 'x' && (p.el.sub === 'shaft' || p.el.sub === 'outby') && attachSub(g, p) === exitSub);
    const exitName = !blowing ? 'the fan' : exitEl ? (exitEl.el.sub === 'outby' ? `the opening outby the ${nodeName(topo, baseOf(exitSub))}` : 'the air shaft') : 'the FAB';
    steps.push({
      kind: 'course',
      text: `Air course: ${courseNames.join(' → ')} → out through ${exitName}. The ${label(hzT)} is carried to the return without passing an ignition source, an unexplored area or a person${b.problem.boOutside ? '' : ', or the FAB'}.`,
      rules: ['b-card-30', 'b-card-31', 'misc-4']
    });
    steps.push({ kind: 'retest', text: `Re-enter and test for CH4, CO and O2 at the placard before passing it, then note the gas as removed on the map.`, rules: ['b-card-24', 'a-card-5'] });
    const ok = flowsAt && findings.length === 0;
    return {
      ok,
      target,
      mode: opt.mode,
      steps,
      built,
      course: courseSubs,
      airflow: af,
      findings,
      why: ok ? undefined : !flowsAt ? 'The airflow estimate shows no air reaching the placard with these controls.' : findings.map((f) => f.text).join(' ')
    };
  }
}

const label = (h: Hazard) => (h.el.kind === 'smoke' ? 'smoke' : `${h.cls.explosive ? 'explosive mixture' : h.cls.irrespirable ? 'irrespirable air' : 'gas'} at placard ${placardText(h.el)}`);
