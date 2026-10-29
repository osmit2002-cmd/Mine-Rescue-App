/**
 * One call that runs everything for a problem: placement, hazards, the exploration plan, the mapping key and
 * the design checks.
 */
import { elementName, KIND_DEFS, placardText } from './catalog';
import { explore, type Plan } from './explore';
import { locName } from './geometry';
import { makeBoard, type Board, type Placed } from './graph';
import type { El, Problem } from './model';
import { classifyGas, isIgnition, travelBlock } from './rules';

export interface MapItem {
  el: El;
  where: string;
  /** What to write beside the symbol. */
  text: string;
  /** Required on the team map (A Card 5) / the briefing officer or CCA map (A Card 6). */
  team: boolean;
  bo: boolean;
  /** Already printed on the blank maps (FAB objects, air shafts). */
  preShown: boolean;
  step: number | null;
  note?: string;
}

export interface Check {
  level: 'error' | 'warn' | 'info';
  text: string;
  rules: string[];
  el?: string;
}

export interface Solution {
  board: Board;
  plan: Plan;
  items: MapItem[];
  /** Objects in areas the team never reaches: mapping them is a discount (A Card 4). */
  notMapped: MapItem[];
  /** Conditions left in the mine to note on the maps (A Card 5L / 6). */
  changes: string[];
  checks: Check[];
}

/** Objects/conditions the briefing officer or CCA map must show (A Card 6). */
function boRequired(el: El): boolean {
  switch (el.kind) {
    case 'body':
    case 'person':
    case 'smoke':
    case 'gas':
    case 'caved':
    case 'unsafe-roof':
    case 'fan':
    case 'fire':
    case 'perm-stopping':
    case 'temp-stopping':
    case 'door':
    case 'diagonal':
    case 'overcast':
    case 'seal':
    case 'barricade':
    case 'brattice':
    case 'line-curtain':
    case 'line-curtain-installed':
    case 'air':
    case 'refuge':
      return true;
    case 'water':
      return !!el.overKnee || !!el.roofed;
    case 'x':
      return el.sub === 'face' || isIgnition(el);
    default:
      return false;
  }
}

function mapNote(el: El): string | undefined {
  switch (el.kind) {
    case 'gas':
      return 'Write the readings as printed: methane, carbon monoxide, oxygen.';
    case 'smoke':
      return `Draw the entire extent of the smoke${el.density ? `; write “${el.density}”` : ''}. Do not extend it into unexplored areas.`;
    case 'body':
      return 'Show head and feet as found (not needed if the placard just says “Body”).';
    case 'person':
      return 'Write out the condition on the placard; show position if lying down.';
    case 'water':
      return 'Write out the depth(s) as shown on the placard.';
    case 'door':
      return 'Write out type, size (if given) and open or closed.';
    case 'x':
      if (el.sub === 'lunch-pail') return 'One X for the lunch pail and a separate X for any note inside (not stacked).';
      if (el.sub === 'note') return 'Record the information on the note; one X per note.';
      return 'X with the name of the object written beside it.';
    case 'fire':
      return 'Fire symbol over the object on fire; write “smoldering”, “raging”, etc.';
    case 'unsafe-roof':
      return 'Outline the size if indicated.';
    default:
      return undefined;
  }
}

export function designChecks(p: Problem, board: Board): Check[] {
  const out: Check[] = [];
  for (const el of board.outside) out.push({ level: 'error', text: `${elementName(el)} is not inside an entry, crosscut or intersection — move it onto an opening.`, rules: [], el: el.id });
  if (!p.statement.trim()) out.push({ level: 'warn', text: 'Write the problem statement. It (or the team map) must clearly identify the entries so the team knows where to begin exploration.', rules: ['general-7'] });
  const persons = p.elements.filter((e) => e.kind === 'person' || e.kind === 'body');
  if (p.missing === 0 && persons.length) out.push({ level: 'warn', text: `${persons.length} person/body placard(s) are on the map but the number of missing persons is 0.`, rules: ['b-card-32'] });
  if (p.missing > persons.length) out.push({ level: 'info', text: `${p.missing} missing, ${persons.length} person/body placard(s) placed: ${p.missing - persons.length} will stay unaccounted for, which makes the team explore inaccessible areas when materials allow (Rule 44F).`, rules: ['b-card-44'] });
  for (const el of p.elements) {
    const t = (el.text ?? '').toUpperCase();
    if ((el.kind === 'perm-stopping' || el.kind === 'temp-stopping') && t && !/PERMANENT|TEMPORARY/.test(t))
      out.push({ level: 'warn', text: `Stopping placard “${el.text}” should say whether it is permanent or temporary (legend note).`, rules: ['a-card-5'], el: el.id });
    if (el.kind === 'unsafe-roof' && !/UNSAFE ROOF/.test(t)) out.push({ level: 'warn', text: `Unsafe roof placards must state “unsafe roof” (legend).`, rules: ['a-card-5'], el: el.id });
    if (/AIR CLEAR/.test(t)) out.push({ level: 'error', text: `“Air clear” placards will not be used (Rule 24E).`, rules: ['b-card-24'], el: el.id });
    if (el.kind === 'gas') {
      if (el.ch4 === undefined || el.co === undefined || el.o2 === undefined) out.push({ level: 'error', text: 'Gas placards show methane, carbon monoxide and oxygen quantities (Rule 24E).', rules: ['b-card-24'], el: el.id });
      if ((el.o2 ?? 0) > 21 || (el.ch4 ?? 0) > 100 || (el.ch4 ?? 0) < 0 || (el.co ?? 0) < 0 || (el.o2 ?? 0) < 0) out.push({ level: 'warn', text: `Unusual gas readings on ${placardText(el)}.`, rules: [], el: el.id });
    }
    if (el.kind === 'fan' && !el.text?.trim()) out.push({ level: 'warn', text: 'The fan placard should state its condition (on/off, exhausting/blowing); the written instructions must state the status of the mine fan(s).', rules: ['misc-4'], el: el.id });
  }
  const fans = p.elements.filter((e) => e.kind === 'fan');
  if (!fans.length) out.push({ level: 'info', text: 'No fan placed. Written instructions must clearly indicate the status of and any changes that can be made to the mine fan(s).', rules: ['misc-4'] });
  // Smoke reaching the FAB.
  const fabSmoke = [...board.placed.values()].some((q) => q.el.kind === 'smoke' && q.loc.type === 'node' && board.topo.nodes.get(q.loc.node)?.fab);
  if (fabSmoke) out.push({ level: 'warn', text: 'Smoke in the FAB: the briefing officer’s designated location must remain respirable.', rules: ['b-card-30'] });
  // One live person per refuge alternative.
  const ras = [...board.placed.values()].filter((q) => q.el.kind === 'refuge');
  for (const ra of ras) {
    const inside = [...board.placed.values()].filter((q) => q.el.kind === 'person' && Math.hypot(q.el.x - ra.el.x, q.el.y - ra.el.y) < 8);
    if (inside.length > 1) out.push({ level: 'error', text: 'A maximum of one live person may be found in each refuge alternative (Rule 41A).', rules: ['b-card-41'], el: ra.el.id });
  }
  // Diagonals must be in intersections; across symbols must be in openings.
  for (const q of board.placed.values()) {
    if (q.el.kind === 'diagonal' && q.loc.type !== 'node') out.push({ level: 'error', text: 'A diagonal goes from corner to corner in an intersection.', rules: ['b-card-48'], el: q.el.id });
    if (q.el.kind === 'overcast' && q.loc.type !== 'node') out.push({ level: 'warn', text: 'Place the overcast on the intersection it crosses.', rules: [], el: q.el.id });
  }
  // Explosive mixture next to evidence of fire found together: withdrawal by design.
  const gases = [...board.placed.values()].filter((q) => q.el.kind === 'gas');
  for (const g of gases) {
    const c = classifyGas(g.el);
    if (c.explosive && c.fireEvidence) out.push({ level: 'info', text: `Placard ${placardText(g.el)} is an explosive mixture with CO above 10 PPM: the team must withdraw when it finds it (Rule 31B).`, rules: ['b-card-31'], el: g.el.id });
  }
  return out;
}

export function solve(p: Problem): Solution {
  const board = makeBoard(p);
  const plan = explore(board);
  const items: MapItem[] = [];
  const notMapped: MapItem[] = [];
  const inFab = (q: Placed) =>
    q.loc.type === 'node'
      ? !!board.topo.nodes.get(q.loc.node)?.fab
      : q.loc.type === 'edge' && !!board.topo.nodes.get(board.topo.edges.get(q.loc.edge)!.a)?.fab && !!board.topo.nodes.get(board.topo.edges.get(q.loc.edge)!.b)?.fab;
  for (const q of board.placed.values()) {
    const el = q.el;
    if (el.kind === 'smoke-end' || el.kind === 'roof-support' || el.kind === 'fpa') continue;
    const item: MapItem = {
      el,
      where: locName(board.topo, q.loc),
      text: placardText(el) || elementName(el),
      team: true,
      bo: boRequired(el),
      preShown: inFab(q) || !!el.preMapped,
      step: plan.found.get(el.id) ?? null,
      note: mapNote(el)
    };
    if (plan.found.has(el.id)) items.push(item);
    else notMapped.push(item);
  }
  items.sort((a, b) => (a.step ?? 0) - (b.step ?? 0));
  const changes: string[] = [];
  for (const [id, what] of plan.changed) {
    const q = board.placed.get(id);
    if (!q) continue;
    changes.push(`${elementName(q.el)}${placardText(q.el) ? ` “${placardText(q.el)}”` : ''} at ${locName(board.topo, q.loc)}: ${what}.`);
  }
  for (const q of board.placed.values()) if (q.el.kind === 'fan') changes.push(`Fan${placardText(q.el) ? ` “${placardText(q.el)}”` : ''}: note any change made (on/off, exhausting/blowing). No notation needed if unchanged.`);
  const checks = designChecks(p, board);
  for (const q of notMapped) {
    if (q.el.kind === 'person' || q.el.kind === 'body') checks.push({ level: 'info', text: `${elementName(q.el)} at ${q.where} is never reached by the solution.`, rules: ['b-card-32'], el: q.el.id });
  }
  // Inaccessible blocks for the summary are in plan.unexplored; also flag unreachable blocks for the designer.
  for (const q of board.placed.values()) {
    const b = travelBlock(q.el);
    if (b?.type === 'separation' && !plan.found.has(q.el.id)) checks.push({ level: 'info', text: `${KIND_DEFS[q.el.kind].name} at ${locName(board.topo, q.loc)} is in an area the team never reaches.`, rules: [], el: q.el.id });
  }
  return { board, plan, items, notMapped, changes, checks };
}
