/**
 * The exploration solver: a team-stop by team-stop walk through the problem that follows the contest rules for
 * systematic exploration and lists what the team must do at each stop.
 *
 * Move order (Rules 29 and 44):
 *   1. When tying outby and an unexplored open crosscut is at this intersection, tie across first (Rule 44D).
 *   2. Explore outby areas before advancing inby: the lowest crosscut row goes first (Rules 29, 44D, 44E).
 *   3. Prefer the contaminated entry/crosscut or entries next to it (Rule 44B, 44C).
 *   4. Then the shortest travel through explored workings.
 * Live persons are taken to the FAB as soon as they can be reached (Rule 41). Explosive mixture plus evidence of
 * fire, or energized equipment in an explosive mixture, stops exploration (Rule 31B). When nothing is left,
 * separations are airlocked through to reach accessible areas behind them (Rule 42), and if missing persons are
 * still unaccounted for, unsafe roof is supported or water pumped when the materials are at hand (Rule 44F).
 *
 * It is a study aid: it gives one rule-consistent order, not the only acceptable one.
 */
import { elementName, placardText } from './catalog';
import { contains, hazards, approachSides, touches, type Hazard } from './extents';
import { nodeName, type Port } from './geometry';
import { buildGraph, endOf, otherEnd, subOfPlaced, type Board, type Graph, type Placed } from './graph';
import { entryName, xcName, type El } from './model';
import { classifyGas, gasReasons, isAirtight, isIgnition, travelBlock } from './rules';

export interface Action {
  text: string;
  rules: string[];
  el?: string;
  level?: 'info' | 'must' | 'danger';
}

export type StepKind = 'fab' | 'stop' | 'recover' | 'breach' | 'support' | 'pump' | 'withdraw' | 'done';

export interface Step {
  kind: StepKind;
  /** Team stop number (intersections only). */
  n?: number;
  title: string;
  /** Where the team is at the end of the step (travel sub-node id). */
  at?: string;
  dir?: 'inby' | 'outby' | 'across';
  /** Sub-nodes travelled through to get here, including start and end. */
  route: string[];
  via?: string;
  /** The element a recover, breach, support or pump step is about. */
  subject?: string;
  found: string[];
  actions: Action[];
  notes: string[];
  /** Openings seen once this step is done (edge id → [s0, s1] spans), for the walk-through. */
  seen?: Map<string, [number, number][]>;
}

export interface Plan {
  steps: Step[];
  /** Base node ids explored. */
  explored: Set<string>;
  /** Seen intervals on each edge. */
  seen: Map<string, [number, number][]>;
  /** Element id → index of the step it was found at. */
  found: Map<string, number>;
  /** Elements whose condition the team changed: extinguished, breached, supported, pumped, removed (patients). */
  changed: Map<string, string>;
  personsFound: number;
  withdrawal: { step: number; reason: string } | null;
  hazards: Hazard[];
  /** Openings the team never reached, with what stopped it. */
  unexplored: { where: string; why: string }[];
}

const LOOK = 25; // feet into an opening from the captain's stopping point (Rule 29)

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface EdgeSeen {
  a: number; // seen from end a up to this s
  b: number; // seen from end b down to this s
}

export function explore(board: Board): Plan {
  const p = board.problem;
  const topo = board.topo;
  const W = p.layout.entryWidth;
  const removed = new Set<string>();
  const changed = new Map<string, string>();
  const active = (el: El) => !removed.has(el.id);
  const approach = approachSides(board);
  const hz = hazards(board, approach);
  const airG = buildGraph(board, 'air');
  let g: Graph = buildGraph(board, 'travel', active);

  const steps: Step[] = [];
  const pushStep = (st: Step) => {
    st.seen = spansOf();
    steps.push(st);
  };
  const exploredSubs = new Set<string>();
  const seen = new Map<string, EdgeSeen>();
  const traversed = new Set<string>();
  const found = new Map<string, number>();
  const recovered = new Set<string>();
  const pendingPatients = new Map<string, string>(); // person id → note already given
  let withdrawal: Plan['withdrawal'] = null;
  let stopNo = 0;

  const edge = (id: string) => topo.edges.get(id)!;
  const sub = (id: string) => g.subs.get(id)!;
  const rowOf = (id: string) => sub(id).node.r;
  const colOf = (id: string) => sub(id).node.i;
  const seenOf = (eid: string): EdgeSeen => seen.get(eid) ?? { a: -1, b: edge(eid).len + 1 };
  const blocksOn = (eid: string) => (board.onEdge.get(eid) ?? []).filter((q) => active(q.el) && travelBlock(q.el));
  const passable = (eid: string) => blocksOn(eid).length === 0;
  const isEnd = (sid: string) => sub(sid).node.end;
  const explored = (sid: string) => exploredSubs.has(sid);

  /** Rebuild the travel graph after a diagonal is breached; carry explored state and position across. */
  const rebuild = (cur: string): string => {
    const old = g;
    g = buildGraph(board, 'travel', active);
    const oldExplored = [...exploredSubs];
    exploredSubs.clear();
    for (const [id, s] of g.subs) {
      if (oldExplored.some((o) => old.subs.get(o)?.base === s.base && old.subs.get(o)!.ports.every((pt) => s.ports.includes(pt)))) exploredSubs.add(id);
    }
    const c = old.subs.get(cur);
    if (!c) return cur;
    for (const [id, s] of g.subs) if (s.base === c.base && c.ports.some((pt) => s.ports.includes(pt))) return id;
    return cur;
  };

  // ------------------------------------------------------------ discovery

  function spansOf(): Map<string, [number, number][]> {
    const out = new Map<string, [number, number][]>();
    for (const [eid, s] of seen) {
      const e = edge(eid);
      const spans: [number, number][] = [];
      if (s.a >= s.b) spans.push([0, e.len]);
      else {
        if (s.a > 0) spans.push([0, s.a]);
        if (s.b < e.len) spans.push([s.b, e.len]);
      }
      out.set(eid, spans);
    }
    return out;
  }

  const markFound = (els: Placed[], step: Step) => {
    for (const q of els) {
      if (found.has(q.el.id)) continue;
      found.set(q.el.id, steps.length);
      step.found.push(q.el.id);
    }
  };

  /** Look into an edge from one end. 'look' = 25 ft, 'line' = to the next intersection's imaginary line, 'full' = to its end. */
  const look = (eid: string, from: string, mode: 'look' | 'line' | 'full'): { items: Placed[]; block: Placed | null; reachedEnd: boolean } => {
    const e = edge(eid);
    const end = endOf(g, eid, from);
    const items = board.onEdge.get(eid) ?? [];
    const toS = (d: number) => (end === 'a' ? d : e.len - d);
    const dist = (q: Placed) => (end === 'a' ? q.s0 : e.len - q.s1); // distance from this end to the near side
    const far = (q: Placed) => (end === 'a' ? q.s1 : e.len - q.s0);
    const firstBlock = items.filter((q) => active(q.el) && travelBlock(q.el)).sort((x, y) => dist(x) - dist(y))[0] ?? null;
    let limit = mode === 'look' ? LOOK : mode === 'line' ? e.len - W / 2 : e.len;
    let block: Placed | null = null;
    if (firstBlock && dist(firstBlock) <= limit) {
      block = firstBlock;
      limit = far(firstBlock); // the condition itself and what lies within it can be seen
    }
    limit = Math.min(limit, e.len);
    const s = seenOf(eid);
    if (end === 'a') s.a = Math.max(s.a, limit);
    else s.b = Math.min(s.b, toS(limit));
    if (limit >= e.len - 0.01) {
      s.a = e.len;
      s.b = 0;
    }
    seen.set(eid, s);
    const vis = items.filter((q) => (end === 'a' ? q.s0 <= limit + 0.01 : q.s1 >= toS(limit) - 0.01));
    if (s.a >= s.b) traversed.add(eid);
    return { items: vis, block, reachedEnd: !block && limit >= e.len - 0.01 };
  };

  const nodeItems = (sid: string): Placed[] => {
    const s = sub(sid);
    return (board.onNode.get(s.base) ?? []).filter((q) => (subOfPlaced(g, q) ?? s.base) === sid);
  };

  // ------------------------------------------------------------ naming

  const portName = (sid: string, eid: string): string => {
    const s = sub(sid);
    const e = edge(eid);
    const pt: Port = endOf(g, eid, sid) === 'a' ? e.pa : e.pb;
    const l = p.layout;
    if (pt === 'N') return e.type === 'stub' ? `${entryName(l, s.node.i)} inby (to the face)` : `${entryName(l, s.node.i)} inby`;
    if (pt === 'S') return s.node.r === 1 ? `${entryName(l, s.node.i)} outby (to the FAB)` : `${entryName(l, s.node.i)} outby`;
    return `${xcName(l, s.node.r)} ${pt === 'E' ? 'right' : 'left'}`;
  };

  const subName = (sid: string) => {
    const s = sub(sid);
    const base = nodeName(topo, s.base);
    return (g.subsOf.get(s.base) ?? []).length > 1 ? `${base} (${s.ports.join('/')} side of the diagonal)` : base;
  };

  // ------------------------------------------------------------ element actions

  const atmosphereAt = (q: Placed) => hz.filter((h) => h.cls.irrespirable && contains(h.extent, airG, q));

  const timbersAvailable = () =>
    p.fabMaterials.timbers > 0 || [...found.keys()].some((id) => board.placed.get(id)?.el.kind === 'x' && board.placed.get(id)?.el.sub === 'timbers' && (board.placed.get(id)?.el.count ?? 1) > 0 && !changed.has(id));
  const pumpAvailable = () => p.fabMaterials.pump || [...found.keys()].some((id) => board.placed.get(id)?.el.kind === 'x' && board.placed.get(id)?.el.sub === 'pump');

  const actionsFor = (q: Placed): Action[] => {
    const el = q.el;
    const t = placardText(el);
    const name = `${elementName(el)}${t && t.toUpperCase() !== elementName(el).toUpperCase() ? ` “${t}”` : ''}`;
    const A = (text: string, rules: string[], level: Action['level'] = 'must'): Action => ({ text, rules, el: el.id, level });
    const out: Action[] = [];
    switch (el.kind) {
      case 'gas': {
        const c = classifyGas(el);
        const why = gasReasons(el);
        out.push(A(`Gas placard ${t}: record it on the map as printed (methane, carbon monoxide, oxygen)${why.length ? ` — ${why.join('; ')}` : ''}.`, ['a-card-5', 'b-card-24'], 'info'));
        if (c.explosive) out.push(A(`EXPLOSIVE MIXTURE: never move it over an ignition source or an unexplored area; with evidence of fire nearby it is a withdrawal situation.`, ['b-card-31'], 'danger'));
        if (c.irrespirable) out.push(A(`Irrespirable atmosphere: any patient here must be protected with an approved apparatus before being moved.`, ['b-card-34'], 'danger'));
        if (c.contaminant) out.push(A(`Contaminant: advance in this entry or the entries next to it; tie across into a contaminated crosscut first.`, ['b-card-44'], 'info'));
        break;
      }
      case 'smoke':
        out.push(A(`${name}: every team member holds or is attached to the lifeline/link line in smoke; attach the lifeline on the outby end of the smoke and leave it until the team comes back through.`, ['b-card-20', 'b-card-22'], 'must'));
        out.push(A(`Map the whole extent of the smoke${el.density ? ` and write “${el.density}”` : ''}; patients wearing SCSRs need goggles in smoke.`, ['a-card-5', 'b-card-8'], 'info'));
        break;
      case 'smoke-end':
        out.push(A(`End of smoke: the smoke extent stops here.`, ['b-card-24'], 'info'));
        break;
      case 'perm-stopping':
      case 'temp-stopping':
      case 'diagonal':
        if (isAirtight(el)) out.push(A(`${name}: gas test at the stopping and the captain's date and initials with chalk.`, ['b-card-24', 'b-card-27']));
        else out.push(A(`${name}: not intact / not airtight — write the condition from the placard beside the symbol; date and initials.`, ['a-card-5', 'b-card-27']));
        break;
      case 'seal':
        out.push(A(`${name}: gas test at the seal (open sampling-pipe valves before testing) and date and initials. Do not explore behind seals unless the problem requires it, and then only after all accessible areas are explored.`, ['b-card-24', 'b-card-27', 'b-card-44']));
        break;
      case 'door':
        out.push(A(`${name}: write out the type, size and “${el.open ? 'open' : 'closed'}”; date and initials${el.open ? '' : '; gas test if intact and airtight'}.`, ['b-card-24', 'b-card-27']));
        if (!el.open) out.push(A(`Before opening it with unknown conditions on the other side, build an airlock (temporary stopping).`, ['b-card-42'], 'info'));
        break;
      case 'barricade':
        out.push(A(`${name}: gas test and date and initials at the barricade; call out for a response.`, ['b-card-24', 'b-card-27']));
        if (el.response) out.push(A(`A person answers: verbal contact. Remove them safely and promptly; a person behind the barricade may read the judges' statement aloud.`, ['b-card-41', 'b-card-37'], 'danger'));
        break;
      case 'overcast':
        out.push(A(`${name}: gas tests and date and initials on the overcast walls.`, ['b-card-24', 'b-card-27']));
        break;
      case 'line-curtain-installed':
        out.push(A(`${name}: map its full extent; note it if partially or completely down. Line curtains cannot be used in an intersection with an intact overcast.`, ['a-card-5', 'b-card-48'], 'info'));
        break;
      case 'caved':
        if (el.across === false) out.push(A(`${name} (partly across): roof and rib test; map its outline.`, ['b-card-23', 'a-card-5'], 'info'));
        else
          out.push(
            A(`${name}: roof and rib test, gas test immediately outby, date and initials where it prohibits travel. Do not travel into or pass material through caved areas.`, ['b-card-23', 'b-card-24', 'b-card-27', 'b-card-30', 'b-card-48'])
          );
        if (el.airtight) out.push(A(`Placard says “airtight”: write “airtight” beside the symbol; it is a separation for air.`, ['a-card-5'], 'info'));
        break;
      case 'unsafe-roof':
        if (el.across === false) out.push(A(`${name} (part of the opening): sound-and-vibration roof test; stay clear, travel by it along the safe rib.`, ['b-card-23', 'b-card-30'], 'info'));
        else
          out.push(
            A(`${name} rib to rib: roof test from rib to rib at the outby end (sound and vibration); gas test outby; date and initials. Nobody travels under it — inaccessible unless timbered in the Rule 30A sequence.`, ['b-card-23', 'b-card-24', 'b-card-27', 'b-card-30'])
          );
        break;
      case 'unsafe-rib':
        out.push(A(`${name}: do not travel under it; no sound-and-vibration test required. Project it over the rib line on the map.`, ['b-card-23', 'b-card-30'], 'info'));
        break;
      case 'water':
        if (el.roofed) out.push(A(`${name}: water roofed is airtight — an equivalent airtight separation (airlocks) is needed before pumping it.`, ['b-card-42'], 'must'));
        else if (el.overKnee && el.across !== false)
          out.push(A(`${name}: do not travel through water over knee deep; gas test immediately outby; date and initials. Write the depth on the map.`, ['b-card-30', 'b-card-24', 'b-card-27', 'a-card-5']));
        else out.push(A(`${name}: write the depth from the placard on the map.`, ['a-card-5'], 'info'));
        break;
      case 'fire':
        if (el.extinguishable === false)
          out.push(A(`${name} (inextinguishable): roof and rib test and gas test; never ventilate over it; inaccessible.`, ['b-card-23', 'b-card-24', 'b-card-30'], 'danger'));
        else out.push(A(`${name}: roof and rib test rib to rib, gas test, then put the fire out before passing it (2A10BC extinguisher).`, ['b-card-23', 'b-card-24', 'b-card-30'], 'must'));
        break;
      case 'fan':
        out.push(A(`${name}: write out the fan's condition. The briefing officer starts, stops or reverses fans at the team's request; get permission before ventilation changes.`, ['a-card-5', 'b-card-19'], 'info'));
        break;
      case 'air':
        out.push(A(`Air movement${t ? ` “${t}”` : ''}: map the direction${t ? ' and quantity' : ''}.`, ['a-card-5'], 'info'));
        break;
      case 'body': {
        const under = underBlock(q);
        if (under)
          out.push(A(`${name} under ${travelBlock(under.el)!.reason}: map it (position counts as known). Timber to it and examine it only after all missing persons are accounted for, before the clock is stopped.`, ['b-card-32', 'a-card-5'], 'must'));
        else out.push(A(`${name}: stop; the captain examines the body by touching it before anyone passes; date and initials; map head and feet as found.`, ['b-card-32', 'b-card-27', 'a-card-5']));
        break;
      }
      case 'person': {
        const air = atmosphereAt(q);
        out.push(A(`${name}: captain makes contact; initial assessment (conscious: ask if OK, look for life-threatening injuries; unconscious: also breathing and carotid pulse 5–10 s); date and initials.`, ['b-card-12', 'b-card-27', 'b-card-32']));
        if (air.length) out.push(A(`In an irrespirable atmosphere (${air.map((h) => placardText(h.el)).join('; ')}): put an approved apparatus on the patient before moving them.`, ['b-card-34', 'b-card-38'], 'danger'));
        if (el.conscious === false) out.push(A(`Unconscious: apparatus with a full facepiece; carry on a stretcher, secured with two straps and covered with a blanket to the neck.`, ['b-card-34', 'b-card-11'], 'must'));
        break;
      }
      case 'refuge':
        out.push(A(`${name}: enter at this team stop — the captain opens the outer door and tests the airlock before anyone else enters; purge 5 s if irrespirable; test again before opening the inner door. Date and initials on the outer door.`, ['b-card-36', 'b-card-27']));
        break;
      case 'brattice':
      case 'line-curtain':
        out.push(A(`${name}: material the team may use; only the ventilation material provided may be used.`, ['b-card-45'], 'info'));
        break;
      case 'x':
        switch (el.sub) {
          case 'lunch-pail':
            out.push(A(`${name}: examine the lunch pail; any note inside is recorded on the map with its own X.`, ['b-card-47', 'a-card-5']));
            break;
          case 'note':
            out.push(A(`${name}: record the note's information on the map (one X per note).`, ['a-card-5']));
            break;
          case 'timbers':
            out.push(A(`${name}${el.count ? ` (${el.count})` : ''}: roof supports available — if a patient is under or beyond unsafe roof, the team must use them.`, ['b-card-41', 'b-card-30'], 'info'));
            break;
          case 'pump':
            out.push(A(`${name}: if a patient is beyond water over knee deep, stop, take the pump and pump the water.`, ['b-card-41'], 'info'));
            break;
          case 'borehole':
            out.push(A(`${name}: gas test at the open borehole. Boreholes cannot be used for ventilation.`, ['b-card-24', 'b-card-19']));
            break;
          case 'face':
            out.push(A(`${name}: roof, face and rib tests; gas test; date and initials.`, ['b-card-23', 'b-card-24', 'b-card-27']));
            break;
          case 'old-works':
            out.push(A(`${name}: gas test and date and initials where it prohibits further travel; inaccessible.`, ['b-card-24', 'b-card-27', 'b-card-44']));
            break;
          case 'shaft':
            out.push(A(`${name}: an opening — air shafts are shown on all maps.`, ['a-card-5', 'misc-4'], 'info'));
            break;
          default:
            if (isIgnition(el)) out.push(A(`${name}: energized — an ignition source. Have the briefing officer de-energize circuits when needed; in an explosive mixture it is a withdrawal situation.`, ['b-card-31', 'b-card-19'], 'danger'));
            else out.push(A(`${name}: map with an X and its name.`, ['a-card-5'], 'info'));
        }
        break;
      default:
        break;
    }
    if (el.kind !== 'x' && el.kind !== 'gas' && isIgnition(el) && el.kind !== 'fire') out.push(A(`Ignition source.`, ['b-card-31'], 'danger'));
    return out;
  };

  /** The active travel block whose extent contains this element (e.g. a body under unsafe roof), if any. */
  const underBlock = (q: Placed): Placed | null => {
    if (q.loc.type !== 'edge') return null;
    return blocksOn(q.loc.edge).find((b) => b !== q && q.s >= b.s0 - 0.5 && q.s <= b.s1 + 0.5) ?? null;
  };

  /** Can the team reach this element from explored workings without passing a block? */
  const reachable = (q: Placed): boolean => {
    if (q.loc.type === 'node') return explored(subOfPlaced(g, q) ?? q.loc.node);
    if (q.loc.type !== 'edge') return false;
    const eid = q.loc.edge;
    const [a, b] = g.ends.get(eid)!;
    const bl = blocksOn(eid).filter((x) => x !== q);
    const clearFromA = !bl.some((x) => x.s0 < q.s - 0.5);
    const clearFromB = !bl.some((x) => x.s1 > q.s + 0.5);
    return (explored(a) && clearFromA) || (explored(b) && clearFromB);
  };

  // ------------------------------------------------------------ steps

  const newStep = (kind: StepKind, title: string, route: string[] = []): Step => ({ kind, title, route, found: [], actions: [], notes: [] });

  const describeFound = (step: Step, els: Placed[]) => {
    markFound(els, step);
    for (const q of els) if (step.found.includes(q.el.id)) step.actions.push(...actionsFor(q));
  };

  // Stop 0: the fresh air base.
  const fabSubs = [...g.subs.values()].filter((s) => s.node.fab).map((s) => s.id);
  for (const s of fabSubs) exploredSubs.add(s);
  const fab = newStep('fab', 'Fresh air base — before going inby');
  fab.actions.push(
    { text: 'Start the clock; the written problem and the two blank maps are handed out. Label the Team map and the Briefing Officer map.', rules: ['fab-2', 'general-7'], level: 'must' },
    { text: 'Examine all gas detectors in front of a judge and test communications with the briefing officer; arrange lifeline pull signals.', rules: ['b-card-14', 'b-card-17'], level: 'must' },
    { text: 'Captain marks date, initials and team number on the check board, examines every apparatus and has his/her own examined.', rules: ['b-card-26', 'b-card-6'], level: 'must' }
  );
  const fabFound: Placed[] = [];
  for (const s of fabSubs) {
    fabFound.push(...nodeItems(s));
    for (const eid of g.adj.get(s) ?? []) {
      const o = otherEnd(g, eid, s);
      if (sub(o).node.fab) {
        const r = look(eid, s, 'full');
        fabFound.push(...r.items);
        if (r.reachedEnd) traversed.add(eid);
      }
    }
  }
  const entrances: string[] = [];
  for (const s of fabSubs) {
    for (const eid of g.adj.get(s) ?? []) {
      const o = otherEnd(g, eid, s);
      if (sub(o).node.fab) continue;
      const r = look(eid, s, isEnd(o) ? 'full' : 'line');
      fabFound.push(...r.items);
      entrances.push(`${portName(s, eid)}${r.block ? ` (to the ${travelBlock(r.block.el)!.reason}, test immediately outby it)` : ''}`);
    }
  }
  const inFab = (q: Placed) =>
    q.loc.type === 'node' ? !!topo.nodes.get(q.loc.node)?.fab : q.loc.type === 'edge' && !!topo.nodes.get(edge(q.loc.edge).a)?.fab && !!topo.nodes.get(edge(q.loc.edge).b)?.fab;
  const preMapped = [...new Set(fabFound)].filter((q) => inFab(q) || q.el.preMapped);
  if (entrances.length)
    fab.actions.push({
      text: `Check every entrance before the entire team goes inby: gas tests for CH4, CO and O2 deficiency with the detector inby the imaginary rib line — ${entrances.join('; ')}. The captain may go no more than 25 ft inby.`,
      rules: ['b-card-24'],
      level: 'must'
    });
  fab.actions.push(
    { text: 'Stop within 50 ft once every member is inby the FAB to check team members and apparatus; then check gauges and apparatus at not more than 20-minute intervals, at team stops.', rules: ['b-card-28', 'a-card-2'], level: 'must' },
    { text: 'Notify the briefing officer before advancing or retreating; all members hold or are attached to the link line.', rules: ['b-card-18', 'b-card-21'], level: 'info' }
  );
  markFound(fabFound, fab);
  if (preMapped.length) fab.notes.push(`Objects in the FAB are already shown on all maps: ${preMapped.map((q) => elementName(q.el) + (placardText(q.el) ? ` (${placardText(q.el)})` : '')).join(', ')} (A Card 5B).`);
  for (const q of fabFound) if (fab.found.includes(q.el.id) && !preMapped.includes(q)) fab.actions.push(...actionsFor(q));
  pushStep(fab);

  let cur = fabSubs.slice().sort((x, y) => colOf(x) - colOf(y))[0] ?? [...g.subs.keys()][0];
  let lastDir: Step['dir'] | null = null;
  let forced: string | null = null; // edge to take next (after breaching to a person who answered)

  /** Known contaminant locations (from hazards whose placard has been found). */
  const knownContam = () => hz.filter((h) => h.cls.contaminant && found.has(h.el.id));

  const contamEntries = () => {
    const out = new Set<number>();
    for (const h of knownContam()) {
      for (const eid of h.extent.edges.keys()) {
        const e = edge(eid);
        if (e.vertical) out.add(topo.nodes.get(e.a)!.i);
      }
      for (const n of h.extent.nodes) {
        const s = airG.subs.get(n);
        if (s) out.add(s.node.i);
      }
    }
    return out;
  };

  /** Shortest travel through explored workings (Dijkstra over traversed or fully seen passable edges). */
  const travel = (from: string): Map<string, { d: number; prev: string | null }> => {
    const res = new Map<string, { d: number; prev: string | null }>();
    const q: [string, number, string | null][] = [[from, 0, null]];
    while (q.length) {
      q.sort((x, y) => x[1] - y[1]);
      const [u, d, prev] = q.shift()!;
      if (res.has(u)) continue;
      res.set(u, { d, prev });
      for (const eid of g.adj.get(u) ?? []) {
        if (!traversed.has(eid) || !passable(eid)) continue;
        const v = otherEnd(g, eid, u);
        if (explored(v) && !res.has(v)) q.push([v, d + edge(eid).len, u]);
      }
    }
    return res;
  };

  const routeTo = (paths: Map<string, { d: number; prev: string | null }>, to: string): string[] => {
    const out: string[] = [];
    let x: string | null = to;
    while (x) {
      out.unshift(x);
      x = paths.get(x)?.prev ?? null;
    }
    return out;
  };

  interface Cand {
    u: string;
    e: string;
    v: string;
    fresh: boolean;
    key: number[];
  }

  const candidates = (): Cand[] => {
    const paths = travel(cur);
    const ce = contamEntries();
    const contamEdges = new Set(knownContam().flatMap((h) => [...h.extent.edges.keys()]));
    const out: Cand[] = [];
    for (const u of exploredSubs) {
      const pu = paths.get(u);
      if (!pu) continue;
      for (const eid of g.adj.get(u) ?? []) {
        if (traversed.has(eid) || !passable(eid)) continue;
        const v = otherEnd(g, eid, u);
        if (isEnd(v)) continue;
        const e = edge(eid);
        const fresh = !explored(v);
        if (forced && eid !== forced) continue;
        const tieAcross = lastDir === 'outby' && u === cur && !e.vertical ? 0 : 1;
        const rank = fresh ? rowOf(v) : Math.min(rowOf(u), rowOf(v));
        const vi = colOf(v);
        const contam = contamEdges.has(eid) || (e.vertical && (ce.has(vi) || ce.has(vi - 1) || ce.has(vi + 1))) ? 0 : 1;
        out.push({ u, e: eid, v, fresh, key: [tieAcross, rank, contam, Math.round(pu.d), e.vertical ? 1 : 0, vi] });
      }
    }
    out.sort((x, y) => {
      for (let i = 0; i < x.key.length; i++) if (x.key[i] !== y.key[i]) return x.key[i] - y.key[i];
      return x.e < y.e ? -1 : x.e > y.e ? 1 : 0;
    });
    return out;
  };

  /** Accessible (reachable by passable edges) intersections not yet explored. */
  const accessibleUnexplored = (): string[] => {
    const seenS = new Set<string>(exploredSubs);
    const q = [...exploredSubs];
    const out: string[] = [];
    while (q.length) {
      const u = q.pop()!;
      for (const eid of g.adj.get(u) ?? []) {
        if (!passable(eid)) continue;
        const v = otherEnd(g, eid, u);
        if (seenS.has(v) || isEnd(v)) continue;
        seenS.add(v);
        out.push(v);
        q.push(v);
      }
    }
    return out;
  };

  /** What the team does at an intersection: look into every opening, gas tests, objects found. */
  const atStop = (step: Step, v: string, via: string | null) => {
    const tests: string[] = [];
    const items: Placed[] = [...nodeItems(v)];
    for (const eid of g.adj.get(v) ?? []) {
      if (eid === via) continue;
      const o = otherEnd(g, eid, v);
      const e = edge(eid);
      // Rule 29: 25 ft into openings toward intersections; to the face or condition in dead ends and blocked openings.
      const mode = isEnd(o) || !passable(eid) ? 'full' : 'look';
      const r = look(eid, v, mode);
      items.push(...r.items);
      const near = r.block ? (endOf(g, eid, v) === 'a' ? r.block.s0 : e.len - r.block.s1) : Infinity;
      const label = portName(v, eid);
      if (r.block && travelBlock(r.block.el)?.type === 'inaccessible' && near <= W / 2 + 3) tests.push(`${label} (immediately outby the ${travelBlock(r.block.el)!.reason})`);
      else tests.push(label);
      if (isEnd(o) || r.block) {
        const what = r.block ? `the ${travelBlock(r.block.el)!.reason}` : e.state === 'projected' ? 'the end of the projection' : 'the face';
        if (near > LOOK || (!r.block && e.len - W / 2 > LOOK))
          step.actions.push({ text: `Explore ${label} up to ${what} (it prohibits further travel): stay within the 25-ft limit of the captain's or No. 5's stopping point, or make it a team stop.`, rules: ['b-card-29'], level: 'info' });
        if (!r.block && sub(o).node.end && e.state === 'open')
          step.actions.push({ text: `Face of ${label}: roof, face and rib tests; gas test; captain's date and initials.`, rules: ['b-card-23', 'b-card-24', 'b-card-27'], level: 'must' });
      }
      if (e.state === 'projected') step.actions.push({ text: `${label} is a projection (dotted lines): draw in the rib lines, pillars and faces explored.`, rules: ['a-card-5'], level: 'must' });
    }
    if (tests.length) step.actions.unshift({ text: `Gas tests for CH4, CO and O2 deficiency in each opening before leaving the intersection: ${tests.join('; ')}.`, rules: ['b-card-24', 'b-card-25'], level: 'must' });
    describeFound(step, items);
  };

  const fmtRoute = (route: string[]) => (route.length > 2 ? ` (via ${route.slice(1, -1).map(subName).join(' → ')})` : '');

  // ------------------------------------------------------------ patients and withdrawal

  const handlePatients = (): boolean => {
    let acted = false;
    for (const [id] of found) {
      const q = board.placed.get(id);
      if (!q || q.el.kind !== 'person' || recovered.has(id)) continue;
      if (reachable(q)) {
        const step = newStep('recover', `Take the patient to the FAB — ${elementName(q.el)} “${placardText(q.el)}”`, [cur]);
        step.subject = id;
        step.actions.push(
          { text: 'Every effort to remove the patient safely and promptly; exploring ahead of this location is limited to 25 ft; no ventilation controls, timbering or pumping unless needed to recover the patient.', rules: ['b-card-41'], level: 'must' },
          { text: 'A team member stays within 10 ft of the patient at all times; secure any extra apparatus to the stretcher.', rules: ['b-card-40', 'b-card-16'], level: 'must' },
          { text: 'Once the team starts out with the patient it goes directly to the FAB. Live person brought to the FAB (20-point discount if not).', rules: ['b-card-41', 'b-card-33'], level: 'must' }
        );
        if (q.el.conscious === false) step.actions.push({ text: 'Unconscious patients go to the FAB on a stretcher.', rules: ['b-card-11'], level: 'must' });
        step.notes.push('Note “patient removed from the mine” on the map.');
        recovered.add(id);
        changed.set(id, 'taken to the FAB');
        const fabSub = fabSubs.slice().sort((x, y) => colOf(x) - colOf(y))[0];
        if (fabSub) cur = fabSub;
        lastDir = null;
        step.at = cur;
        pushStep(step);
        acted = true;
        continue;
      }
      // Seen but not reachable: under or beyond unsafe roof or water. Take the first block between the team and the patient.
      let blk = underBlock(q);
      if (!blk && q.loc.type === 'edge') {
        const [a] = g.ends.get(q.loc.edge)!;
        const fromA = explored(a);
        const between = blocksOn(q.loc.edge).filter((b) => b !== q && (fromA ? b.s1 <= q.s + 0.5 : b.s0 >= q.s - 0.5));
        between.sort((x, y) => (fromA ? x.s0 - y.s0 : y.s1 - x.s1));
        blk = between[0] ?? null;
      }
      if (!blk) continue;
      const info = travelBlock(blk.el)!;
      if (info.fix === 'timber' && timbersAvailable()) {
        resolve(blk, 'support', `Support the unsafe roof to reach the patient`);
        acted = true;
      } else if (info.fix === 'pump' && pumpAvailable()) {
        resolve(blk, 'pump', `Pump the water to reach the patient`);
        acted = true;
      } else if (!pendingPatients.has(id)) {
        pendingPatients.set(id, info.reason);
        steps[steps.length - 1].notes.push(
          info.fix === 'timber'
            ? `Patient seen under/beyond unsafe roof with no roof supports yet: when timbers are found the team must stop (before No. 5 passes them), get them and timber to the patient (Rule 41C1, Figure 3).`
            : info.fix === 'pump'
              ? `Patient beyond water over knee deep with no pump yet: when a pump is found the team must stop, get it, pump the water and recover the patient (Rule 41C2).`
              : `Patient beyond the ${info.reason}: cannot be reached.`
        );
      }
    }
    if (acted) return true;
    // Verbal contact at a barricade: the persons behind it must be reached promptly (Rule 41A) — after any patient
    // already reached is on the way out (Rule 41B: no ventilation controls while removing a patient).
    for (const [id] of found) {
      const q = board.placed.get(id);
      if (q?.el.kind === 'barricade' && q.el.response && active(q.el)) {
        resolve(q, 'breach', 'Verbal contact at the barricade: airlock and breach to reach the persons');
        return true;
      }
    }
    return acted;
  };

  const checkWithdrawal = (): string | null => {
    const known = hz.filter((h) => found.has(h.el.id));
    for (const ex of known.filter((h) => h.cls.explosive)) {
      if (ex.cls.fireEvidence) return `Explosive mixture with ${ex.el.co} PPM CO at the same placard (${placardText(ex.el)}).`;
      for (const f of known) if (f !== ex && f.cls.fireEvidence && touches(ex.extent, f.extent, airG)) return `Explosive mixture (${placardText(ex.el)}) with no non-explosive separation from ${f.el.kind === 'smoke' ? 'smoke' : `CO above 10 PPM (${placardText(f.el)})`}.`;
      for (const id of found.keys()) {
        const q = board.placed.get(id);
        if (!q || removed.has(id)) continue;
        if (q.el.kind === 'fire' && contains(ex.extent, airG, q)) return `Explosive mixture (${placardText(ex.el)}) at a fire.`;
        if (q.el.kind === 'x' && isIgnition(q.el) && contains(ex.extent, airG, q)) return `Energized ${elementName(q.el).toLowerCase()} in an explosive mixture (${placardText(ex.el)}).`;
      }
    }
    return null;
  };

  // ------------------------------------------------------------ resolving blocks

  function resolve(blk: Placed, kind: 'breach' | 'support' | 'pump', title: string) {
    const el = blk.el;
    const info = travelBlock(el)!;
    const where = blk.loc.type === 'edge' ? blk.loc.edge : null;
    const step = newStep(kind, `${title} — ${elementName(el)}${placardText(el) ? ` “${placardText(el)}”` : ''}`, [cur]);
    step.subject = el.id;
    if (kind === 'support') {
      step.actions.push(
        { text: 'Roof test at the outby end (sound and vibration); set the first timber outby the unsafe roof no more than 5 ft from a safe rib (or two timbers no more than 5 ft apart), then timbers at no more than 5-ft intervals, then the last timber inby; roof test at the inby end. Stay between the timbers and the safe rib.', rules: ['b-card-30', 'b-card-23'], level: 'must' },
        { text: 'Timbers found already set cannot be used as required timbers. Map every roof support the team installs (circle symbol); never remove a set support.', rules: ['b-card-30', 'a-card-5'], level: 'must' }
      );
      changed.set(el.id, 'roof supported');
    } else if (kind === 'pump') {
      step.actions.push(
        { text: 'Take the pump and pump the water; wait until the judges change the placards before assuming the water is lowered. Ventilate any explosive mixture before energizing the pump.', rules: ['b-card-41', 'b-card-19'], level: 'must' },
        { text: 'Note “water pumped” on the map.', rules: ['a-card-5'], level: 'must' }
      );
      if (el.roofed) step.actions.push({ text: 'Water roofed: keep an equivalent airtight separation while pumping (airlocks: one build in an entry or crosscut, two in a 3-way, three in a 4-way intersection).', rules: ['b-card-42'], level: 'must' });
      changed.set(el.id, 'water pumped');
    } else {
      if (el.kind === 'barricade' && el.response) {
        const outbyBad = hz.some((h) => h.cls.irrespirable && where && (h.extent.edges.get(where) ?? []).some(([a, b]) => a <= blk.s1 + 2 && b >= blk.s0 - 2));
        if (outbyBad) step.actions.push({ text: 'Irrespirable atmosphere immediately outby the barricade: remove it (ventilate with the briefing officer’s permission) before breaching.', rules: ['b-card-35', 'b-card-19'], level: 'danger' });
      }
      if (info.fix === 'airlock')
        step.actions.push({ text: 'Conditions on the other side are unknown: build an airlock (a temporary stopping) giving an equivalent airtight separation before breaching. Roof and rib test before building; captain dates and initials the team-built stopping.', rules: ['b-card-42', 'b-card-23', 'b-card-27'], level: 'must' });
      step.actions.push({ text: `Breach the ${info.reason}. Map it as removed if both sides are taken down; a structure rebuilt in the same place is mapped as a temporary stopping.`, rules: ['a-card-5', 'b-card-43'], level: 'must' });
      changed.set(el.id, 'breached');
      if (where) forced = null;
    }
    removed.add(el.id);
    if (el.kind === 'diagonal') cur = rebuild(cur);
    // Look past the opened condition.
    if (where) {
      const [a, b] = g.ends.get(where)!;
      const from = explored(a) && seenOf(where).a >= blk.s0 - 0.5 ? a : b;
      const r = look(where, from, isEnd(otherEnd(g, where, from)) ? 'full' : 'line');
      describeFound(step, r.items);
      if (!passable(where)) forced = null;
      else if (!explored(otherEnd(g, where, from)) && !isEnd(otherEnd(g, where, from))) forced = el.kind === 'barricade' ? where : null;
    } else if (blk.loc.type === 'node') {
      for (const s of g.subsOf.get(blk.loc.node) ?? []) describeFound(step, nodeItems(s));
    }
    pushStep(step);
  }

  // ------------------------------------------------------------ main loop

  const personsTotal = () => [...found.keys()].filter((id) => ['person', 'body'].includes(board.placed.get(id)?.el.kind ?? '')).length;
  let guard = 0;
  outer: while (guard++ < 2000) {
    // 1. Explore everything reachable.
    for (;;) {
      if (handlePatients()) continue;
      const w = checkWithdrawal();
      if (w) {
        withdrawal = { step: steps.length, reason: w };
        const step = newStep('withdraw', 'WITHDRAW — imminent explosion possible', [cur]);
        step.actions.push(
          { text: `${w} Stop exploring and leave the mine; the team may go to any location already explored at this stop on its way out. No roof/rib or gas tests are required at the withdrawal location, and fires there are not extinguished.`, rules: ['b-card-31'], level: 'danger' },
          { text: 'Map all objects and conditions seen in the intersection. Mark the farthest point of advance where areas inby will not be explored.', rules: ['b-card-31', 'a-card-5'], level: 'must' }
        );
        pushStep(step);
        break outer;
      }
      const cands = candidates();
      if (!cands.length) {
        if (forced) {
          forced = null;
          continue;
        }
        break;
      }
      const c = cands[0];
      const paths = travel(cur);
      const route = [...routeTo(paths, c.u), c.v];
      const e = edge(c.e);
      const dir: Step['dir'] = e.vertical ? (rowOf(c.v) > rowOf(c.u) ? 'inby' : 'outby') : 'across';
      if (c.fresh) stopNo++;
      const title = c.fresh
        ? `${dir === 'inby' ? 'Advance' : dir === 'outby' ? 'Tie outby' : 'Tie across'} to ${subName(c.v)}`
        : `${dir === 'across' ? 'Tie across' : dir === 'outby' ? 'Tie outby' : 'Travel'} through ${portName(c.u, c.e)} to ${subName(c.v)} (already explored)`;
      const step = newStep('stop', title + fmtRoute(route), route);
      if (c.fresh) step.n = stopNo;
      step.dir = dir;
      step.via = c.e;
      step.at = c.v;
      if (dir === 'inby') {
        const bad = accessibleUnexplored().filter((s) => rowOf(s) <= rowOf(c.v) - 3);
        if (bad.length)
          step.notes.push(`Rule 44E: ${bad.map(subName).join(', ')} is still unexplored more than two crosscuts outby. Where crosscuts are blocked, No. 5 may not advance beyond the inby corner of the second crosscut before the team ties across and/or behind into all accessible areas outby.`);
      }
      // Travel the edge: everything on it is passed.
      const items = board.onEdge.get(c.e) ?? [];
      const sObj = seenOf(c.e);
      sObj.a = e.len;
      sObj.b = 0;
      seen.set(c.e, sObj);
      traversed.add(c.e);
      for (const q of items) {
        if (q.el.kind === 'fire' && active(q.el) && q.el.extinguishable !== false) {
          step.actions.push({ text: `Put out the fire before passing it; note “fire extinguished” on the map. Roof tests are needed again each time the team travels through the fire area.`, rules: ['b-card-30', 'b-card-23', 'a-card-5'], el: q.el.id, level: 'must' });
          removed.add(q.el.id);
          changed.set(q.el.id, 'extinguished');
        }
      }
      describeFound(step, items);
      if (c.fresh) exploredSubs.add(c.v);
      atStop(step, c.v, c.e);
      for (const q of nodeItems(c.v)) {
        if (q.el.kind === 'fire' && active(q.el) && q.el.extinguishable !== false) {
          removed.add(q.el.id);
          changed.set(q.el.id, 'extinguished');
          step.actions.push({ text: 'Put out the fire in the intersection before any member leaves it to an unexplored area; roof tests imaginary rib line to imaginary rib line.', rules: ['b-card-29', 'b-card-30', 'b-card-23'], el: q.el.id, level: 'must' });
        }
      }
      if (forced === c.e) forced = null;
      lastDir = dir;
      cur = c.v;
      pushStep(step);
    }
    // 2. Airlock through separations that hide accessible areas.
    const sepCands: { blk: Placed; pri: number }[] = [];
    const missingLeft = p.missing > personsTotal();
    for (const [eid, [a, b]] of g.ends) {
      for (const blk of blocksOn(eid)) {
        const info = travelBlock(blk.el)!;
        if (info.type !== 'separation') continue;
        const fromA = explored(a) && !blocksOn(eid).some((x) => x !== blk && x.s1 < blk.s0) ? a : null;
        const fromB = explored(b) && !blocksOn(eid).some((x) => x !== blk && x.s0 > blk.s1) ? b : null;
        const from = fromA ?? fromB;
        if (!from) continue;
        const beyond = from === a ? b : a;
        if (explored(beyond)) continue;
        if (isEnd(beyond) && !missingLeft) continue;
        sepCands.push({ blk, pri: (blk.el.kind === 'barricade' ? 0 : 10) + rowOf(from) });
      }
    }
    for (const s of g.subs.values()) {
      if (!exploredSubs.has(s.id)) continue;
      for (const q of board.onNode.get(s.base) ?? []) {
        if (q.el.kind !== 'diagonal' || !active(q.el)) continue;
        const others = (g.subsOf.get(s.base) ?? []).filter((x) => !exploredSubs.has(x));
        if (others.some((o) => (g.adj.get(o) ?? []).some((eid) => !explored(otherEnd(g, eid, o))))) sepCands.push({ blk: q, pri: 5 + rowOf(s.id) });
      }
    }
    sepCands.sort((x, y) => x.pri - y.pri);
    const sep = sepCands.find((x) => x.blk.el.kind === 'barricade' && x.blk.el.response) ?? sepCands[0];
    if (sep) {
      resolve(sep.blk, 'breach', sep.blk.el.kind === 'barricade' && sep.blk.el.response ? 'Airlock and breach to reach the persons who answered' : 'Airlock through to explore the accessible area behind');
      continue;
    }
    // 3. Rule 44F: inaccessible areas only while missing persons are unaccounted for.
    if (missingLeft) {
      const fixes: Placed[] = [];
      for (const [eid, [a, b]] of g.ends) {
        for (const blk of blocksOn(eid)) {
          const info = travelBlock(blk.el)!;
          if (info.type !== 'inaccessible') continue;
          if (!((info.fix === 'timber' && timbersAvailable()) || (info.fix === 'pump' && pumpAvailable()))) continue;
          const reached = (explored(a) && seenOf(eid).a >= blk.s0) || (explored(b) && seenOf(eid).b <= blk.s1);
          if (!reached) continue;
          if (explored(a) && explored(b) && !isEnd(a) && !isEnd(b)) continue;
          fixes.push(blk);
        }
      }
      if (fixes.length) {
        const blk = fixes[0];
        const info = travelBlock(blk.el)!;
        resolve(blk, info.fix === 'pump' ? 'pump' : 'support', info.fix === 'pump' ? 'Missing persons unaccounted for: pump the water to explore beyond it' : 'Missing persons unaccounted for: support the unsafe roof to explore beyond it');
        steps[steps.length - 1].actions.unshift({ text: 'All accessible areas are explored and missing persons are still unaccounted for, so inaccessible areas must be explored where the problem provides the materials.', rules: ['b-card-44'], level: 'must' });
        continue;
      }
    }
    break;
  }

  // Bodies under unsafe roof: timber to them last, once all missing persons are found.
  if (!withdrawal && personsTotal() >= p.missing) {
    for (const id of found.keys()) {
      const q = board.placed.get(id);
      if (q?.el.kind !== 'body') continue;
      const blk = underBlock(q);
      if (blk && travelBlock(blk.el)?.fix === 'timber' && timbersAvailable()) {
        const step = newStep('support', `Timber to the body under unsafe roof and examine it`, [cur]);
        step.actions.push({ text: 'All missing persons are accounted for: provide roof support (Figure 3 method) to the body and examine it before the clock is stopped.', rules: ['b-card-32', 'b-card-30'], el: id, level: 'must' });
        changed.set(blk.el.id, 'roof supported');
        pushStep(step);
      }
    }
  }

  // ------------------------------------------------------------ summary

  const seenSpans = spansOf();
  const unexplored: Plan['unexplored'] = [];
  const reported = new Set<string>();
  for (const [eid, [a, b]] of g.ends) {
    const s = seenOf(eid);
    const e = edge(eid);
    if (s.a >= s.b - 0.01) continue;
    if (s.a < 0 && s.b > e.len && !explored(a) && !explored(b)) continue; // deep inside an unexplored area: reported via its boundary
    const blk = blocksOn(eid)[0];
    const why = blk ? travelBlock(blk.el)!.reason : withdrawal ? 'exploration stopped (withdrawal)' : 'not reached';
    const key = `${eid}`;
    if (reported.has(key)) continue;
    reported.add(key);
    unexplored.push({ where: `${portName(explored(a) ? a : b, eid)} from ${subName(explored(a) ? a : b)}`, why });
  }

  const done = newStep('done', withdrawal ? 'Problem ends in withdrawal' : 'Exploration complete', [cur]);
  const persons = [...found.keys()].map((id) => board.placed.get(id)!).filter((q) => q.el.kind === 'person' || q.el.kind === 'body');
  done.actions.push({
    text: `Persons found: ${plural(persons.filter((q) => q.el.kind === 'person').length, 'live person', 'live persons')}, ${plural(persons.filter((q) => q.el.kind === 'body').length, 'body', 'bodies')}${p.missing ? ` (${p.missing} missing)` : ''}.`,
    rules: ['b-card-32'],
    level: p.missing > persons.length ? 'danger' : 'info'
  });
  if (p.missing > persons.length && !withdrawal) done.actions.push({ text: `${p.missing - persons.length} missing person(s) not found. Check the written instructions and whether materials (timbers, pump) are provided to explore the inaccessible areas.`, rules: ['b-card-44', 'b-card-32'], level: 'danger' });
  if (!withdrawal) done.actions.push({ text: 'Return to the FAB; the captain stops the clock and the maps are turned in. Note on the maps the conditions left: fan status, ventilation changes, victims removed, circuits, fires extinguished, water pumped, roof supports installed.', rules: ['a-card-3', 'a-card-5', 'a-card-6'], level: 'must' });
  pushStep(done);

  return {
    steps,
    explored: new Set([...exploredSubs].map((s) => g.subs.get(s)?.base ?? s)),
    seen: seenSpans,
    found,
    changed,
    personsFound: persons.length,
    withdrawal,
    hazards: hz,
    unexplored
  };
}
