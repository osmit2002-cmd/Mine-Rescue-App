/**
 * Sample problems. The first two are rule book figures redrawn as problems, so their solutions are the rule
 * book's own; the practice problem was written for this app and is not an official contest problem.
 */
import { makeElement, PALETTE } from './catalog';
import { cellKey, entryX, makeGeo, rowYc } from './geometry';
import { defaultLayout, SCHEMA, type El, type Layout, type Problem, type XSub } from './model';
import type { Kind } from './catalog';

/** Positions by entry and crosscut instead of feet. f runs 0..1 between the two imaginary rib lines. */
export const at = {
  node(l: Layout, i: number, r: number) {
    const g = makeGeo(l);
    return { x: entryX(g, i), y: rowYc(g, r) };
  },
  /** In entry i between crosscut rows r and r + 1 (r = last row: the inby stub). */
  entry(l: Layout, i: number, r: number, f = 0.5) {
    const g = makeGeo(l);
    const y0 = rowYc(g, r) + l.entryWidth / 2;
    const y1 = r < l.rows - 1 ? rowYc(g, r + 1) - l.entryWidth / 2 : g.height;
    return { x: entryX(g, i), y: Math.round(y0 + (y1 - y0) * f) };
  },
  /** In the crosscut at row r between entry i and i + 1 (i = -1 or entries-1: the side stubs). */
  xc(l: Layout, i: number, r: number, f = 0.5) {
    const g = makeGeo(l);
    const x0 = i < 0 ? 0 : entryX(g, i) + l.entryWidth / 2;
    const x1 = i >= l.entries - 1 ? g.width : i < 0 ? entryX(g, 0) - l.entryWidth / 2 : entryX(g, i + 1) - l.entryWidth / 2;
    return { x: Math.round(x0 + (x1 - x0) * f), y: rowYc(g, r) };
  }
};

/** Element maker with stable ids (prefix-1, prefix-2, …) so a sample is identical every time it is built. */
function maker(prefix: string) {
  let seq = 0;
  return (kind: Kind, p: { x: number; y: number }, extra: Partial<El> = {}, sub?: XSub): El => {
    const item = PALETTE.find((it) => it.kind === kind && (kind !== 'x' || it.sub === sub)) ?? { kind, sub };
    return { ...makeElement(item, p.x, p.y, `${prefix}-${++seq}`), ...extra };
  };
}

function problem(id: string, title: string, layout: Layout, elements: El[], rest: Partial<Problem>): Problem {
  return {
    schema: SCHEMA,
    id,
    title,
    statement: '',
    instructions: '',
    missing: 0,
    timeLimit: 0,
    fabFresh: true,
    fabMaterials: { timbers: 0, pump: false, brattice: true, lineCurtain: false },
    keyNotes: '',
    layout,
    elements,
    updated: '2026-10-29T00:00:00.000Z',
    ...rest
  };
}

/** Rule book Figure 7 – RULE 44 "SYSTEMATIC EXPLORATION" (2026 Coal Mine Rescue Rules, p. 49). */
export function figure7(): Problem {
  const l = defaultLayout(3, 4);
  l.stubLength = 30;
  for (let i = 0; i < 3; i++) l.cells[cellKey(2 * i + 1, 2 * l.rows - 1)] = 'projected';
  const el = maker('fig7');
  const els = [
    el('caved', at.xc(l, 0, 1, 0.55)),
    el('water', at.xc(l, 0, 2, 0.5)),
    el('caved', at.entry(l, 1, 0, 0.5)),
    el('caved', at.entry(l, 2, 0, 0.5)),
    el('caved', at.entry(l, 2, 1, 0.5)),
    el('unsafe-roof', at.entry(l, 2, 2, 0.5))
  ];
  return problem('sample-fig7', 'Rule book Figure 7 — Systematic exploration (Rule 44)', l, els, {
    source: '2026 Coal Mine Rescue Rules, Figure 7, rule book page 49',
    statement:
      'Figure 7 of the rule book drawn as a problem: three entries from the fresh air base (FAB) at the bottom. Caved areas, water over knee deep and unsafe roof block several crosscuts and entries. Explore systematically.',
    instructions: 'Explore all accessible areas systematically (Rule 44).',
    keyNotes:
      'Rule book solution — team stops numbered in accordance with Rule 44D: #1 No. 1 Entry at the first crosscut; #2 No. 1 at the second; #3 No. 1 at the third; #4 No. 2 at the third; #5 No. 2 at the second; #6 No. 3 at the second; #7 No. 2 at the first; #8 No. 3 at the first; #9 No. 3 at the third.'
  });
}

/** Expected team stops for Figure 7 as [entry index, crosscut row], from the rule book. */
export const FIGURE7_STOPS: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 3],
  [1, 2],
  [2, 2],
  [1, 1],
  [2, 1],
  [2, 3]
];

/** Rule book Figure 5 – EXAMPLE OF INITIAL EXPLORATION AS PER RULE 29 (open three-entry section). */
export function figure5(): Problem {
  const l = defaultLayout(3, 4);
  l.stubLength = 40;
  return problem('sample-fig5', 'Rule book Figure 5 — Initial exploration (Rule 29)', l, [], {
    source: '2026 Coal Mine Rescue Rules, Figure 5, rule book page 47',
    statement:
      'Figure 5 of the rule book drawn as a problem: an open three-entry section with no placards. Use it to see the 25-ft limit at each team stop and the tie-across / tie-outby order for open crosscuts.',
    instructions: 'Explore all accessible areas systematically.',
    keyNotes:
      'At each team stop exploration into the openings is limited to 25 ft from the captain’s or No. 5’s stopping point, or to the imaginary line of the next intersection, whichever is less. Open crosscuts must be tied across into the next intersection and teams cannot advance from that intersection before tying outby (Rule 44D).'
  });
}

/** A practice problem written for this app (not an official contest problem). */
export function practice1(): Problem {
  const l = defaultLayout(4, 6);
  l.entryNames = ['No. 1 Entry', 'No. 2 Entry', 'No. 3 Entry', 'No. 4 Entry'];
  // Side stubs: a sealed area off No. 4 at crosscut 1, the shaft/fan off No. 4 at crosscut 5.
  l.cells[cellKey(8, 2)] = 'open';
  l.cells[cellKey(8, 10)] = 'open';
  const el = maker('p1');
  const els: El[] = [
    el('air', { ...at.node(l, 1, 0), y: at.node(l, 1, 0).y - 4 }, { dir: 0, text: 'AIR MOVING INBY', preMapped: true }),
    el('x', at.xc(l, 1, 0, 0.5), { text: 'STOPPING MATERIAL', preMapped: true }, 'materials'),
    el('brattice', at.xc(l, 2, 0, 0.5), { preMapped: true }),
    el('body', at.entry(l, 0, 1, 0.5), { dir: 0, text: 'BODY' }),
    el('x', at.entry(l, 2, 1, 0.35), { count: 8, text: 'TIMBERS' }, 'timbers'),
    el('water', at.entry(l, 2, 1, 0.75), { overKnee: false, across: true, len: 8, text: 'WATER 6 INCHES DEEP' }),
    el('perm-stopping', at.xc(l, 2, 1, 0.5), { text: 'PERMANENT STOPPING' }),
    el('perm-stopping', at.xc(l, 2, 2, 0.5), { text: 'PERMANENT STOPPING' }),
    el('seal', at.xc(l, 3, 1, 0.4), { text: 'SEAL - SAMPLING PIPE' }),
    el('gas', at.entry(l, 1, 2, 0.3), { ch4: 0.2, co: 25, o2: 20.5 }),
    el('x', at.node(l, 2, 2), { text: 'LUNCH PAIL' }, 'lunch-pail'),
    el('x', { ...at.node(l, 2, 2), x: at.node(l, 2, 2).x + 5 }, { text: 'NOTE - WE WENT TO THE NO. 4 ENTRY AND BUILT A BARRICADE' }, 'note'),
    el('caved', at.xc(l, 2, 3, 0.5), { text: 'CAVED' }),
    el('smoke', at.entry(l, 1, 3, 0.15), { density: 'light', text: 'LIGHT SMOKE' }),
    el('smoke-end', at.xc(l, 0, 4, 0.85)),
    el('smoke-end', at.entry(l, 1, 4, 0.2)),
    el('smoke-end', at.xc(l, 1, 4, 0.85)),
    el('fire', at.xc(l, 1, 4, 0.45), { extinguishable: true, text: 'FIRE - SMOLDERING' }),
    el('x', { ...at.xc(l, 1, 4, 0.45), y: at.xc(l, 1, 4, 0.45).y + 4 }, { energized: false, text: 'BATTERY CHARGER' }, 'equipment'),
    el('door', at.xc(l, 2, 4, 0.5), { open: false, text: 'MAN DOOR CLOSED' }),
    el('unsafe-roof', at.xc(l, 0, 5, 0.5), { across: true, len: 14, text: 'UNSAFE ROOF' }),
    el('person', at.xc(l, 0, 5, 0.5), { conscious: false, dir: 90, text: 'LIVE PERSON UNCONSCIOUS' }),
    el('gas', at.entry(l, 0, 5, 0.7), { ch4: 7.5, co: 0, o2: 19.8 }),
    el('x', at.entry(l, 0, 5, 0.95), { text: 'CUT INTO OLD WORKS' }, 'old-works'),
    el('barricade', at.entry(l, 3, 5, 0.25), { response: true, text: 'BARRICADE - KNOCKING HEARD' }),
    el('person', at.entry(l, 3, 5, 0.7), { conscious: true, text: 'LIVE PERSON CONSCIOUS' }),
    el('x', at.xc(l, 3, 5, 0.85), { text: 'AIR SHAFT' }, 'shaft'),
    el('fan', at.xc(l, 3, 5, 0.6), { fanMode: 'exhausting', on: true, text: 'FAN ON EXHAUSTING' })
  ];
  return problem('sample-practice-1', 'Practice 1 — Fire on the 1st North section', l, els, {
    source: 'Practice problem written for this app (not an official contest problem)',
    statement:
      'At approximately 7:30 a.m. a fire was reported on the 1st North section. Five miners were working on the section; two escaped and reported light smoke in the No. 2 Entry. Three miners are unaccounted for. The main mine fan, at the air shaft off the No. 4 Entry at Crosscut 5, is running and exhausting. All power to the section has been removed at the power center. The fresh air base has been established at the mouth of the section; the team may enter the section in any of the four entries.',
    instructions:
      'Explore the section and locate and account for all missing persons. Bring all live persons to the fresh air base. Do not change the fan without the briefing officer’s approval. Timbers are not provided at the fresh air base.',
    missing: 3,
    timeLimit: 0,
    keyNotes:
      'Contaminant (25 PPM CO) in No. 2 Entry: advance in No. 2 or the entries next to it (Rule 44B). Smoke in No. 2 inby Crosscut 3: lifeline. Smoldering fire at the battery charger in Crosscut 4: put it out before passing. Explosive mixture at the No. 1 Entry face is not near evidence of fire (no withdrawal). Timbers in No. 3 Entry are needed to reach the unconscious person under unsafe roof in Crosscut 5. Barricade in No. 4 inby Crosscut 5 answers: airlock and breach promptly.'
  });
}

export const SAMPLES: { id: string; make: () => Problem; blurb: string }[] = [
  { id: 'sample-fig7', make: figure7, blurb: 'The rule book’s Rule 44 example with its official team-stop order.' },
  { id: 'sample-fig5', make: figure5, blurb: 'Open three-entry section from the Rule 29 figure.' },
  { id: 'sample-practice-1', make: practice1, blurb: 'Smoke, fire, a barricade, unsafe roof and three missing miners.' }
];
