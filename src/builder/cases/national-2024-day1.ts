/**
 * 2024 National Mine Rescue — Coal, Day 1.
 *
 * Facts and the judges' stop order are transcribed from the contest packet. The PDF is not in this repo:
 * minerescuecenter.com states no license, so only the problem facts and the solution are encoded here.
 * Source: https://minerescuecenter.com/media/problems/2024_national_Coal_Mine_Rescue_2024_National_Coal_Rescue_Day_1.pdf
 *
 * The judges' text (team stop by team stop, with rule numbers) was read from the packet's text layer and
 * checked against the team-stop numbers printed on the judges' map. Stop positions below are those printed
 * numbers: entry from the left, crosscut row counting the fresh air base as row 0.
 *
 * Scored against the 2026 rule text. The 2024 judges cite the same rule numbers this fixture uses (24A, 24E,
 * 35, 44D, 44E). Nothing in their text uses a threshold that differs from 2026 (explosive 5–15% CH4 with
 * oxygen at least 12.1%; irrespirable oxygen is below 19.5%).
 *
 * Not scored, and not guessed: the four ventilation maps. The exhausting fan has no encoded intake, so the
 * ventilation planner cannot move the 18.3% oxygen and the barricade stays closed (Rule 35). The conscious
 * person, the body, and the two timbers inby that barricade are face down until it is opened. The judges also
 * allow either water-roofed area to be pumped first. Team stops 10–12 still fall out in the printed order
 * when the No. 1 water is pumped first, which is what the solver does, and those stops are scored.
 */
import { makeElement, type Kind } from '../catalog';
import { cellKey } from '../geometry';
import { defaultLayout, SCHEMA, type El, type Layout, type Problem, type XSub } from '../model';
import type { JudgeKey, ReferenceCase } from '../judge';
import { at } from '../samples';

function maker(prefix: string) {
  let seq = 0;
  return (kind: Kind, p: { x: number; y: number }, extra: Partial<El> = {}, sub?: XSub): El => ({ ...makeElement({ kind, sub }, p.x, p.y, `${prefix}-${++seq}`), ...extra });
}

export function national2024Day1(): Problem {
  const l: Layout = defaultLayout(3, 5);
  l.entryWidth = 20;
  l.pillarWidth = 40;
  l.pillarLength = 50;
  l.stubLength = 30;
  l.xcStart = 1;
  // The overcast between No. 2 and No. 3 at the second intersection is a wall the team tests, not a
  // crosscut they travel. Stop 6 is reached by coming up No. 3 after the airlock, not across from stop 4.
  l.cells[cellKey(4, 4)] = 'solid';
  const el = maker('n24');
  const elements: El[] = [
    el('fan', at.node(l, 1, 0), { fanMode: 'exhausting', on: true, preMapped: true, text: 'EXHAUSTING MAIN FAN ON — cannot be stopped, stalled, or reversed' }),

    // Openings inby the fresh air base. No. 1 is caved and No. 3 is a rib-to-rib diagonal unsafe roof, so the first team stop is up No. 2.
    el('caved', at.entry(l, 0, 0, 0.5), { airtight: true, text: 'CAVED AIRTIGHT' }),
    el('x', at.entry(l, 1, 0, 0.15), { text: 'ENERGIZED POWER CABLE' }, 'cable'),
    el('gas', at.entry(l, 1, 0, 0.4), { ch4: 5.7, co: 5, o2: 19.4, text: '5.7% CH4, 5 PPM CO, 19.4% O2' }),
    el('x', at.entry(l, 1, 0, 0.72), { text: 'OPEN BOREHOLE' }, 'borehole'),
    el('unsafe-roof', at.entry(l, 2, 0, 0.5), { text: 'DIAGONAL UNSAFE ROOF' }),

    // Stop 1, No. 2 at the first intersection: battery ram car. The open crosscut is to No. 1. The permanent stopping is toward No. 3.
    el('x', at.node(l, 1, 1), { energized: true, text: 'BATTERY RAM CAR' }, 'equipment'),
    el('perm-stopping', at.xc(l, 1, 1, 0.5), { id: 'perm-xc', text: 'PERMANENT STOPPING' }),

    // Stop 2 is No. 1 at that same intersection. The 5.3% mixture is inby, in No. 1.
    el('gas', at.entry(l, 0, 1, 0.25), { ch4: 5.3, co: 6, o2: 19.3, text: '5.3% CH4, 6 PPM CO, 19.3% O2' }),

    // Stop 3, No. 1 at the second intersection: lunch box. Water roofed inby it is airtight, so the explosive mixture outby it stops there.
    el('x', at.node(l, 0, 2), { text: 'LUNCH BOX — note inside: We gassed up and flooded.' }, 'lunch-pail'),
    el('gas', at.entry(l, 0, 2, 0.3), { ch4: 5.1, co: 7, o2: 19.1, text: '5.1% CH4, 7 PPM CO, 19.1% O2' }),
    el('water', at.entry(l, 0, 2, 0.72), { roofed: true, overKnee: true, text: 'WATER ROOFED' }),

    // Stop 4, No. 2 at the second intersection: brattice cloth used to airlock the permanent stopping before the two-break limit.
    el('brattice', at.node(l, 1, 2), { text: 'BRATTICE CLOTH' }),
    el('overcast', at.entry(l, 1, 1, 0.85), { text: 'OVERCAST' }),
    el('overcast', at.entry(l, 2, 1, 0.85), { text: 'OVERCAST WALL' }),

    // Stop 7, No. 3 at the third intersection: open borehole, and a temporary stopping that is not intact in the crosscut they tie through to stop 8.
    el('x', at.node(l, 2, 3), { text: 'OPEN BOREHOLE' }, 'borehole'),
    el('x', at.entry(l, 2, 2, 0.55), { text: 'SUBMERSIBLE PUMP' }, 'pump'),
    el('temp-stopping', at.xc(l, 1, 3, 0.5), { intact: false, airtight: false, text: 'TEMPORARY STOPPING NOT INTACT' }),
    el('caved', at.xc(l, 0, 3, 0.5), { airtight: true, text: 'CAVED AIRTIGHT' }),

    // Stop 9, No. 3 face: water is not what blocks the entry. The barricade has 18.3% oxygen immediately outby it.
    el('gas', at.entry(l, 2, 4, 0.22), { ch4: 4.7, co: 9, o2: 18.3, text: '4.7% CH4, 9 PPM CO, 18.3% O2' }),
    el('barricade', at.entry(l, 2, 4, 0.4), { id: 'barricade-face', response: true, text: 'BARRICADE' }),
    el('person', at.entry(l, 2, 4, 0.62), { id: 'person-barricade', conscious: true, text: 'CONSCIOUS — Help! Get me out!' }),
    el('body', at.entry(l, 2, 4, 0.78), { id: 'body-barricade', text: 'BODY' }),
    el('x', at.entry(l, 2, 4, 0.7), { id: 'timbers-barricade', count: 2, text: '2 TIMBERS' }, 'timbers'),

    // Printed stops 11 and 12 are behind water roofed. The unconscious person is in 18.5% oxygen. The body is under elongated unsafe roof.
    el('water', at.entry(l, 1, 3, 0.55), { roofed: true, overKnee: true, text: 'WATER ROOFED' }),
    el('gas', at.entry(l, 1, 4, 0.45), { ch4: 4.9, co: 7, o2: 18.5, text: '4.9% CH4, 7 PPM CO, 18.5% O2' }),
    el('person', at.entry(l, 1, 4, 0.6), { conscious: false, text: 'UNCONSCIOUS' }),
    el('caved', at.xc(l, 1, 4, 0.5), { text: 'CAVED' }),
    el('unsafe-roof', at.xc(l, 0, 4, 0.4), { across: false, len: 12, text: 'ELONGATED UNSAFE ROOF' }),
    el('body', at.xc(l, 0, 4, 0.45), { text: 'BODY' })
  ];
  return {
    schema: SCHEMA,
    id: 'case-national-2024-day1',
    title: '2024 National — Coal Day 1',
    source: 'https://minerescuecenter.com/media/problems/2024_national_Coal_Mine_Rescue_2024_National_Coal_Rescue_Day_1.pdf',
    statement:
      'The 1st West Mains crew of 4 miners is missing after a seismic event and a power outage. Explore from the fresh air base. The exhausting main fan is on and cannot be shut down, stalled, or reversed. Power is energized up to the fresh air base and cannot be cut. This is a 3-entry section, numbered left to right: No. 1 and No. 2 intakes, No. 3 the return. Mine maps are not up to date. A backup team is available but cannot assist.',
    instructions:
      'Explore all areas in the 1st West Mains Section if it can be accomplished safely. Account for all missing persons and evacuate all survivors to the Fresh Air Base. The exhausting main fan is on and cannot be stopped, stalled, or reversed. Your backup team will relieve you in 75 minutes.',
    missing: 4,
    timeLimit: 75,
    fabFresh: true,
    fabMaterials: { timbers: 0, pump: false, brattice: false, lineCurtain: false },
    keyNotes: 'Judges: first stop is up No. 2 because the No. 1 and No. 3 openings are blocked. Airlock the permanent stopping at stop 1 before breaking the two-break limit at stop 4. Do not breach the barricade while 18.3% oxygen is immediately outby it.',
    layout: l,
    elements,
    updated: '2026-11-12T00:00:00.000Z'
  };
}

/** Team stops printed on the judges' map. The three placards inby the barricade are not in `find`. */
const BEHIND_BARRICADE = new Set(['person-barricade', 'body-barricade', 'timbers-barricade']);

export const KEY: JudgeKey = {
  source: 'https://minerescuecenter.com/media/problems/2024_national_Coal_Mine_Rescue_2024_National_Coal_Rescue_Day_1.pdf — judges’ stop-by-stop text and team-stop map',
  stops: [
    { at: [1, 1], n: [1] },
    { at: [0, 1], n: [2] },
    { at: [0, 2], n: [3] },
    { at: [1, 2], n: [4] },
    { at: [2, 1], n: [5] },
    { at: [2, 2], n: [6] },
    { at: [2, 3], n: [7] },
    { at: [1, 3], n: [8] },
    { at: [2, 4], n: [9] },
    { at: [0, 3], n: [10] },
    { at: [0, 4], n: [11] },
    { at: [1, 4], n: [12] }
  ],
  find: national2024Day1().elements.filter((e) => !e.preMapped && !BEHIND_BARRICADE.has(e.id)).map((e) => e.id),
  rescue: [],
  withdrawal: false,
  notes: [
    'The gas test at the open borehole in No. 2 stops the 5.7% CH4 from extending into the intersection at stop 1, where the battery ram car is.',
    'Before breaking the two-break limit at stop 4, airlock through the permanent stopping found at stop 1 (Rule 44E).',
    'Do not breach the barricade at stop 9 while low oxygen is immediately outby it (Rule 35).'
  ],
  manual: [
    'The conscious person, the body, and the two timbers inby the No. 3 face barricade are face down until that barricade is opened. The ventilation planner reports no intake for the exhausting fan, so the 18.3% oxygen is not removed and the barricade is not breached (Rule 35). Vents 1–4 are drawn in the packet and are not encoded. The fan cannot be stopped, stalled, or reversed.',
    'The judges allow either water-roofed area to be pumped first, with an airlock back out if pumping the stop-3 water would pull the stop-11 mixture over the cave or the unsafe roof (Rules 31C and 30F). The printed stops 10, 11 and 12 are the order scored here.'
  ]
};

export const NATIONAL_2024_DAY1: ReferenceCase = {
  id: 'national-2024-day1',
  title: '2024 National — Coal Day 1',
  problem: national2024Day1,
  key: KEY
};
