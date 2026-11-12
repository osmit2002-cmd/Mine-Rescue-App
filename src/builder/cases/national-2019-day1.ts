/**
 * 2019 National Mine Rescue — Coal, Day 1 (Lexington No. 1).
 *
 * Field packet, a scan. Not committed (minerescuecenter.com states no license):
 * https://minerescuecenter.com/media/problems/2019_national_Coal_Day_1_Field.pdf
 * Rendered with pdftoppm at 300 dpi. The judges' briefing (page 4 and page 5) names each team stop by
 * entry. The team-stop map (page 7) writes the same numbers on the intersections. A cell is encoded only
 * where those two agree. "1/2" accepts either stop, the same way a judge map's "45" does.
 */
import { makeElement, type Kind } from '../catalog';
import { defaultLayout, SCHEMA, type El, type Layout, type Problem, type XSub } from '../model';
import type { JudgeKey, ReferenceCase } from '../judge';
import { at } from '../samples';

function maker(prefix: string) {
  let seq = 0;
  return (kind: Kind, p: { x: number; y: number }, extra: Partial<El> = {}, sub?: XSub): El => ({ ...makeElement({ kind, sub }, p.x, p.y, `${prefix}-${++seq}`), ...extra });
}

export function national2019Day1(): Problem {
  const l: Layout = defaultLayout(3, 6);
  l.xcStart = 1;
  const el = maker('n19');
  const elements: El[] = [
    // Blowing fan, on. The briefing says it cannot be stopped, stalled, or reversed, so each opening is airlocked.
    el('fan', at.node(l, 1, 0), { fanMode: 'blowing', on: true, preMapped: true, text: 'BLOWING FAN ON — cannot be stopped, stalled, or reversed' }),

    // Water over knee deep in the No. 2 opening, so the first stops are in No. 1 or No. 3.
    el('water', at.entry(l, 1, 0, 0.55), { overKnee: true, text: 'WATER OVER KNEE DEEP' }),

    // First crosscut. The unsafe roof in No. 1 and No. 3 does not close those entries: the briefing sends the team up either one.
    el('unsafe-roof', at.entry(l, 0, 1, 0.45), { across: false, text: 'UNSAFE ROOF' }),
    el('unsafe-roof', at.entry(l, 2, 1, 0.5), { across: false, text: 'UNSAFE ROOF' }),

    // Stops 4/5. Unconscious live person in the crosscut, open door, caved airtight up No. 1.
    el('door', at.xc(l, 0, 2, 0.35), { open: true, text: 'DOOR OPEN' }),
    el('person', at.xc(l, 0, 2, 0.6), { id: 'person-45', conscious: false, text: 'UNCONSCIOUS LIVE PERSON' }),
    el('caved', at.entry(l, 0, 2, 0.7), { airtight: true, text: 'CAVED AIRTIGHT' }),

    // Stop 6, No. 3. The operative pump is here. The person/body placard in the unsafe roof is not encoded.
    el('x', at.entry(l, 2, 2, 0.4), { id: 'pump-n3', text: 'OPERATIVE WATER PUMP' }, 'pump'),
    el('unsafe-roof', at.entry(l, 2, 2, 0.65), { across: false, text: 'UNSAFE ROOF' }),

    // Stops 7/8. Refuge alternative in the crosscut off No. 2, with a body inside. Water roofed up No. 3.
    el('refuge', at.xc(l, 0, 3, 0.4), { text: 'RA' }),
    el('body', at.xc(l, 0, 3, 0.55), { id: 'body-ra', text: 'BODY' }),
    el('water', at.entry(l, 2, 3, 0.5), { roofed: true, text: 'WATER ROOFED' }),

    // Stops 10/11 at the last open break. The note and the body are at those intersections. Chest-deep water is up the headings.
    el('x', at.node(l, 0, 4), { text: 'LUNCHBOX — Shane is trapped in #3 entry' }, 'note'),
    el('water', at.entry(l, 0, 4, 0.6), { overKnee: true, text: 'CHEST DEEP WATER' }),
    el('body', at.node(l, 1, 4), { id: 'body-n2', text: 'BODY' }),
    el('water', at.entry(l, 1, 4, 0.6), { overKnee: true, text: 'CHEST DEEP WATER' }),

    // Stop 12, No. 3, after the roofed water is pumped. Irrespirable air outby the permanent stopping. A body and an unconscious person inby.
    el('x', at.node(l, 2, 4), { text: 'SMALL HOLE IN RIB INTO OLD WORKS' }, 'old-works'),
    el('gas', at.entry(l, 2, 4, 0.25), { id: 'gas-n3-outby', ch4: 0, co: 0, o2: 19, text: 'LOW IRRESPIRABLE AIR OUTBY THE STOPPING' }),
    el('perm-stopping', at.entry(l, 2, 4, 0.4), { id: 'stopping-n3', airtight: true, text: 'PERMANENT STOPPING' }),
    el('gas', at.entry(l, 2, 4, 0.55), { id: 'gas-n3-face', ch4: 6, co: 0, o2: 19, text: '0 PPM CO, 6.0% CH4, 19.0% O2' }),
    el('body', at.entry(l, 2, 4, 0.7), { id: 'body-n3', text: 'BODY' }),
    el('person', at.entry(l, 2, 4, 0.85), { id: 'person-shane', conscious: false, text: 'UNCONSCIOUS LIVE PERSON' }),
    el('x', at.node(l, 2, 5), { count: 8, text: '8 TIMBERS' }, 'timbers')
  ];
  return {
    schema: SCHEMA,
    id: 'case-national-2019-day1',
    title: '2019 National — Coal Day 1',
    source: 'https://minerescuecenter.com/media/problems/2019_national_Coal_Day_1_Field.pdf',
    statement:
      'Superintendent of the Lexington No. 1 mine. Seven miners from the maintenance crew are missing on the No. 1 section of the northwest mains after rushing water was heard while they were moving the refuge alternative. The mine map is not up to date. The fresh air base is on the northwest mains at crosscut 34. The main fan is blowing, on, and cannot be turned off, reversed, or stalled. The seam height is about 6 feet.',
    instructions:
      'Find and locate all missing miners. Bring survivors to the fresh air base. Explore the entire mine if it is safe to do so. Do not stop, stall, or reverse the fan. The team can only carry 2 sets of building material at a time. 80 minutes.',
    missing: 5,
    timeLimit: 80,
    fabFresh: true,
    fabMaterials: { timbers: 0, pump: false, brattice: false, lineCurtain: false },
    keyNotes: 'Briefing plus the team-stop map: row 1 is 1/2, 2/3, 1/2; row 2 is 4/5, 4/5, 6; row 3 is 9, 7/8, 7/8; row 4 is 10/11, 10/11, 12.',
    layout: l,
    elements,
    updated: '2026-11-12T00:00:00.000Z'
  };
}

export const KEY: JudgeKey = {
  source: '2019 National Coal Day 1 judges’ briefing (pages 4–5) and the team-stop map (page 7), read at 300 dpi',
  stops: [
    { at: [0, 1], n: [1, 2] },
    { at: [1, 1], n: [2, 3] },
    { at: [2, 1], n: [1, 2] },
    { at: [0, 2], n: [4, 5] },
    { at: [1, 2], n: [4, 5] },
    { at: [2, 2], n: [6] },
    { at: [0, 3], n: [9] },
    { at: [1, 3], n: [7, 8] },
    { at: [2, 3], n: [7, 8] },
    { at: [0, 4], n: [10, 11] },
    { at: [1, 4], n: [10, 11] },
    { at: [2, 4], n: [12] }
  ],
  find: ['person-45', 'body-ra', 'body-n2', 'body-n3', 'person-shane'],
  rescue: [{ el: 'person-45' }, { el: 'person-shane' }],
  withdrawal: false,
  notes: [
    'The statement says seven miners. Five placards name a condition: the unconscious person in the 4/5 crosscut, the body in the refuge alternative, the body in the No. 2 heading, and the body and unconscious person inby the No. 3 stopping.',
    'The fan stays on. The No. 2 opening is water over knee deep, so the first team stops are in No. 1 or No. 3.'
  ],
  manual: [
    'Not scored. Two placards read “Person/Body”, one under the unsafe roof in No. 1 and one under the unsafe roof in No. 3 at stop 6. Neither placard says whether the miner is alive.',
    'Not scored, because the briefing names the condition and not the opening: the overcast and its open door at the 4/5 stop, the line curtain in No. 2, the inoperative battery scoops, the ankle-deep water, and the gas placards other than the irrespirable air outby the No. 3 stopping and the 6.0% mixture at that face.',
    'Not scored: vents 1, 2, and 3. The briefing says three ventilations are required before the No. 3 water is pumped, and the vent maps are separate pages.'
  ]
};

export const NATIONAL_2019_DAY1: ReferenceCase = {
  id: 'national-2019-day1',
  title: '2019 National — Coal Day 1',
  problem: national2019Day1,
  key: KEY
};
