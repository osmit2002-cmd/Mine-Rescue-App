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
 * Vents 1–4 are the placards the judges' maps mark "Cleared", in that order. The 5.7% mixture just inby the
 * fresh air base is not cleared. The judges allow either water-roofed area to be pumped first; the printed
 * stop numbers are the same for both orders because pumping the stop-9 water ends in an airlock back out
 * and does not open a new team stop. The conscious person, the body and the two timbers inby the barricade
 * are scored once that barricade is opened.
 *
 * Scored on the 2026 rule text. The 2024 judges cite Rule 31C for moving the stop-11 explosive mixture over
 * a caved area or unsafe roof. In the 2026 text, Rule 31C is moving an explosive mixture over an unexplored
 * area; Rule 30F is the low oxygen through unexplored ground while persons are missing; Rule 42 is the
 * airlock on the way out when leaving it down would change the ventilation. The No. 1 opening is caved, so
 * the team cannot travel it, and the gas-extent map still shows intake air moving up that entry, so the
 * cave does not seal the airway.
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
    // The surface fan exhausts the No. 3 return. Intake is the other fresh-air-base entries and the intake shaft at the No. 1 face.
    el('fan', at.node(l, 2, 0), { fanMode: 'exhausting', on: true, preMapped: true, text: 'EXHAUSTING MAIN FAN ON — cannot be stopped, stalled, or reversed' }),
    el('x', at.entry(l, 0, 4, 0.55), { id: 'intake-shaft', text: 'INTAKE AIR SHAFT' }, 'shaft'),

    // Openings inby the fresh air base. No. 1 is caved and No. 3 is a rib-to-rib diagonal unsafe roof, so the first team stop is up No. 2.
    // The cave stops the team (Rule 44). The gas-extent map draws the intake arrow up this same entry, and vents 1 and 2
    // clear the No. 1 gases before either water is pumped, so the cave does not seal the airway.
    el('caved', at.entry(l, 0, 0, 0.5), { airtight: false, text: 'CAVED' }),
    el('x', at.entry(l, 1, 0, 0.15), { text: 'ENERGIZED POWER CABLE' }, 'cable'),
    el('gas', at.entry(l, 1, 0, 0.4), { id: 'gas-57', ch4: 5.7, co: 5, o2: 19.4, text: '5.7% CH4, 5 PPM CO, 19.4% O2' }),
    // The pump cable lies in the 5.7% mixture. It is not energized until the team asks the briefing officer to start the pump.
    el('x', at.entry(l, 1, 0, 0.55), { id: 'pump-cable', energized: false, text: 'PUMP CABLE' }, 'cable'),
    el('x', at.entry(l, 1, 0, 0.72), { text: 'OPEN BOREHOLE' }, 'borehole'),
    el('unsafe-roof', at.entry(l, 2, 0, 0.5), { text: 'DIAGONAL UNSAFE ROOF' }),

    // Stop 1, No. 2 at the first intersection: battery ram car. The open crosscut is to No. 1. The permanent stopping is toward No. 3.
    el('x', at.node(l, 1, 1), { energized: true, text: 'BATTERY RAM CAR' }, 'equipment'),
    el('perm-stopping', at.xc(l, 1, 1, 0.5), { id: 'perm-xc', text: 'PERMANENT STOPPING' }),

    // Stop 2 is No. 1 at that same intersection. The 5.3% mixture is inby, in No. 1.
    el('gas', at.entry(l, 0, 1, 0.25), { id: 'gas-v1a', ch4: 5.3, co: 6, o2: 19.3, text: '5.3% CH4, 6 PPM CO, 19.3% O2' }),

    // Stop 3, No. 1 at the second intersection: lunch box. Water roofed inby it is airtight, so the explosive mixture outby it stops there.
    el('x', at.node(l, 0, 2), { text: 'LUNCH BOX — note inside: We gassed up and flooded.' }, 'lunch-pail'),
    el('gas', at.entry(l, 0, 2, 0.3), { id: 'gas-v1b', ch4: 5.1, co: 7, o2: 19.1, text: '5.1% CH4, 7 PPM CO, 19.1% O2' }),
    el('water', at.entry(l, 0, 2, 0.72), { id: 'water-stop3', roofed: true, overKnee: true, text: 'WATER ROOFED' }),

    // Stop 4, No. 2 at the second intersection: brattice cloth used to airlock the permanent stopping before the two-break limit.
    el('brattice', at.node(l, 1, 2), { text: 'BRATTICE CLOTH' }),
    el('overcast', at.entry(l, 1, 1, 0.85), { text: 'OVERCAST' }),
    el('overcast', at.entry(l, 2, 1, 0.85), { text: 'OVERCAST WALL' }),
    // 2nd vent: 5.1% CH4 / 5 PPM CO / 19.5% O2 in No. 3, and 5.3% / 7 PPM / 19.5% just outby the open borehole at stop 7.
    el('gas', at.entry(l, 2, 1, 0.7), { id: 'gas-v2b', ch4: 5.1, co: 5, o2: 19.5, text: '5.1% CH4, 5 PPM CO, 19.5% O2' }),
    el('gas', at.entry(l, 2, 2, 0.75), { id: 'gas-v2a', ch4: 5.3, co: 7, o2: 19.5, text: '5.3% CH4, 7 PPM CO, 19.5% O2' }),

    // Stop 7, No. 3 at the third intersection: open borehole, and a temporary stopping that is not intact in the crosscut they tie through to stop 8.
    el('x', at.node(l, 2, 3), { text: 'OPEN BOREHOLE' }, 'borehole'),
    el('x', at.entry(l, 2, 2, 0.55), { text: 'SUBMERSIBLE PUMP' }, 'pump'),
    el('temp-stopping', at.xc(l, 1, 3, 0.5), { intact: false, airtight: false, text: 'TEMPORARY STOPPING NOT INTACT' }),
    el('caved', at.xc(l, 0, 3, 0.5), { airtight: true, text: 'CAVED AIRTIGHT' }),

    // Stop 9, No. 3 face: water is not what blocks the entry. The barricade has 18.3% oxygen immediately outby it.
    el('gas', at.entry(l, 2, 4, 0.22), { id: 'gas-barricade', ch4: 4.7, co: 9, o2: 18.3, text: '4.7% CH4, 9 PPM CO, 18.3% O2' }),
    el('barricade', at.entry(l, 2, 4, 0.4), { id: 'barricade-face', response: true, text: 'BARRICADE' }),
    el('person', at.entry(l, 2, 4, 0.62), { id: 'person-barricade', conscious: true, text: 'CONSCIOUS — Help! Get me out!' }),
    el('body', at.entry(l, 2, 4, 0.78), { id: 'body-barricade', text: 'BODY' }),
    el('x', at.entry(l, 2, 4, 0.7), { id: 'timbers-barricade', count: 2, text: '2 TIMBERS' }, 'timbers'),

    // Printed stops 11 and 12 are behind water roofed. The unconscious person is in 18.5% oxygen. The body is under elongated unsafe roof.
    el('water', at.entry(l, 1, 3, 0.55), { id: 'water-stop9', roofed: true, overKnee: true, text: 'WATER ROOFED' }),
    // 3rd vent: 5.1% CH4 / 5 PPM CO / 19.1% O2 in No. 1, inby the water roofed at stop 3.
    el('gas', at.entry(l, 0, 3, 0.8), { id: 'gas-v3', ch4: 5.1, co: 5, o2: 19.1, text: '5.1% CH4, 5 PPM CO, 19.1% O2' }),
    el('gas', at.entry(l, 1, 4, 0.45), { ch4: 4.9, co: 7, o2: 18.5, text: '4.9% CH4, 7 PPM CO, 18.5% O2' }),
    el('person', at.entry(l, 1, 4, 0.6), { id: 'person-unconscious', conscious: false, text: 'UNCONSCIOUS' }),
    el('caved', at.xc(l, 1, 4, 0.5), { text: 'CAVED' }),
    el('unsafe-roof', at.xc(l, 0, 4, 0.4), { across: false, len: 12, text: 'ELONGATED UNSAFE ROOF' }),
    el('body', at.xc(l, 0, 4, 0.45), { id: 'body-elongated', text: 'BODY' })
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

export const KEY: JudgeKey = {
  source: 'https://minerescuecenter.com/media/problems/2024_national_Coal_Mine_Rescue_2024_National_Coal_Rescue_Day_1.pdf — judges’ stop-by-stop text, team-stop map, and vents 1–4',
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
  find: national2024Day1().elements.filter((e) => !e.preMapped).map((e) => e.id),
  rescue: [{ el: 'person-unconscious' }, { el: 'person-barricade' }],
  vents: [
    { el: 'gas-v1a', beforeBreach: 'barricade-face' },
    { el: 'gas-v1b', beforeBreach: 'barricade-face' },
    { el: 'gas-v2a', beforeBreach: 'barricade-face', after: 'gas-v1a' },
    { el: 'gas-v2b', beforeBreach: 'barricade-face', after: 'gas-v1b' },
    { el: 'gas-v3', beforeBreach: 'barricade-face', after: 'gas-v2a' },
    { el: 'gas-barricade', beforeBreach: 'barricade-face', after: 'gas-v3' }
  ],
  withdrawal: false,
  notes: [
    'The gas test at the open borehole in No. 2 stops the 5.7% CH4 from extending into the intersection at stop 1, where the battery ram car is.',
    'Before breaking the two-break limit at stop 4, airlock through the permanent stopping found at stop 1 (Rule 44E).',
    'See vents 1 and 2 before pumping. Any explosive mixture being moved cannot be directed over an ignition source (Rule 31A). Any oxygen below 19.5% cannot be directed over the fresh air base (Rule 30H).',
    'The team may choose which water roofed they will pump first. Team stops 10, 11 and 12 are the numbers printed on the judges’ map for both orders.',
    'Now its time to ventilate the barricade, see vents 3 and 4. After those vents, airlock and enter. The 4.7% CH4 / 9 PPM CO / 18.3% O2 is cleared on the 4th vent.',
    'After the live person from the barricade is at the fresh air base, use the two timbers to check the body in the elongated unsafe roof before the clock stops (Rule 32).'
  ],
  manual: [
    'Placards that stay face down until a water placard is flipped — three timbers and caved inby the stop-9 water, and the unsafe roof with an unsafe rib plus caved airtight and three timbers inby the stop-3 water — are not given a separate location in the judges’ text, so they are not encoded. The three timbers the judges use to timber the diagonal unsafe roof are among those face-down placards, so that timber sentence is not a separate scored stop.'
  ]
};

export const NATIONAL_2024_DAY1: ReferenceCase = {
  id: 'national-2024-day1',
  title: '2024 National — Coal Day 1',
  problem: national2024Day1,
  key: KEY
};
