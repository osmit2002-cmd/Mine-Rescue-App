/**
 * 2026 National Mine Rescue — Coal, Day 2 (Wild Eagle Mine, Timber Ridge Section).
 *
 * Judges' packet, image only. Not committed (minerescuecenter.com states no license):
 * https://minerescuecenter.com/media/problems/2026_national_Coal_Day_2_Field_26_Nationals_Day_2.pdf
 * Pages were rendered with pdftoppm at 300 dpi. The team-stop map is page 5. Stop circles were read from
 * crops of that page, and tesseract hOCR/TSV on the full page (the circled numbers are line art and the TSV
 * pass did not read them; the crops did). The statement is page 2 and the written instructions are page 3.
 *
 * A circle with one number is that stop. A circle with two numbers (2/3, 7/8, 7/9, 8/9, 10/11) is the judges'
 * either-order mark, the same "45" the scorer already accepts. Cells the crops did not settle are listed on
 * the key and are not scored.
 */
import { makeElement, type Kind } from '../catalog';
import { defaultLayout, SCHEMA, type El, type Layout, type Problem, type XSub } from '../model';
import type { JudgeKey, ReferenceCase } from '../judge';
import { at } from '../samples';

function maker(prefix: string) {
  let seq = 0;
  return (kind: Kind, p: { x: number; y: number }, extra: Partial<El> = {}, sub?: XSub): El => ({ ...makeElement({ kind, sub }, p.x, p.y, `${prefix}-${++seq}`), ...extra });
}

export function national2026Day2(): Problem {
  const l: Layout = defaultLayout(3, 6);
  l.xcStart = 1;
  const el = maker('n26');
  const elements: El[] = [
    // Blowing fan. Air comes up No. 3 and returns in No. 1 and No. 2. It cannot be stopped, stalled, or reversed.
    el('fan', at.node(l, 2, 0), { fanMode: 'blowing', on: true, preMapped: true, text: 'BLOWING FAN RUNNING — air up No. 3, out No. 1 and No. 2; cannot be stopped, stalled, or reversed' }),

    // The No. 2 stopping outby the first team stop is marked not intact, so it does not seal the entry.
    el('perm-stopping', at.entry(l, 1, 0, 0.55), { intact: false, airtight: false, text: 'NOT INTACT' }),

    // Row 1. Stop 1 in No. 1. The 12.0% oxygen is in that entry, just inby the stop. 5.2% CH4 with 12.0% O2 is not explosive.
    el('gas', at.entry(l, 0, 1, 0.2), { id: 'gas-stop1', ch4: 5.2, co: 8, o2: 12, text: '8 PPM CO, 5.2% CH4, 12.0% O2' }),
    // Conscious Phil Billy stands in No. 1 just inby that intersection, outby the airtight. The B is on the crosscut corner.
    el('person', at.entry(l, 0, 1, 0.45), { id: 'person-phil', conscious: true, text: 'CONSCIOUS PHIL BILLY' }),
    el('barricade', at.xc(l, 0, 1, 0.25), { id: 'barricade-phil-xc', response: false, text: 'B' }),
    // Airtight across No. 1, outby stop 6, so the team reaches stop 6 from the crosscut.
    el('perm-stopping', at.entry(l, 0, 1, 0.8), { airtight: true, text: 'AIRTIGHT' }),
    el('gas', at.node(l, 1, 1), { id: 'gas-23-n2', ch4: 5.2, co: 8, o2: 19, text: '8 PPM CO, 5.2% CH4, 19.0% O2' }),

    // Row 2. Stops 6, 5, and 4. Open doors on both sides of stop 5.
    el('door', at.xc(l, 0, 2, 0.5), { open: true, text: 'OPEN' }),
    el('door', at.xc(l, 1, 2, 0.5), { open: true, text: 'OPEN' }),
    el('x', at.node(l, 1, 2), { count: 4, text: '4 TIMBERS' }, 'timbers'),
    // Johnny Sky and unconscious Jeff Batty are in the crosscut between No. 2 and No. 3, between two barricades.
    // Johnny's placard does not say whether he is alive, so he is not encoded.
    el('barricade', at.xc(l, 1, 2, 0.3), { id: 'barricade-jeff-a', response: false, text: 'B' }),
    el('person', at.xc(l, 1, 2, 0.55), { id: 'person-jeff', conscious: false, text: 'UNCONSCIOUS JEFF BATTY' }),
    el('barricade', at.xc(l, 1, 2, 0.75), { id: 'barricade-jeff-b', response: false, text: 'B' }),
    el('gas', at.entry(l, 2, 2, 0.7), { id: 'gas-n3-mid', ch4: 5.2, co: 8, o2: 19, text: '8 PPM CO, 5.2% CH4, 19.0% O2' }),

    // Row 3. Circles 7/9, 7/8, 8/9. Open doors on both sides of 7/8. The gases are in the entries just outby those circles.
    el('gas', at.entry(l, 0, 2, 0.8), { id: 'gas-79', ch4: 5.2, co: 0, o2: 19, text: '0 PPM CO, 5.2% CH4, 19.0% O2' }),
    el('door', at.xc(l, 0, 3, 0.5), { open: true, text: 'OPEN' }),
    el('door', at.xc(l, 1, 3, 0.5), { open: true, text: 'OPEN' }),
    el('gas', at.entry(l, 1, 2, 0.8), { id: 'gas-78', ch4: 5.2, co: 8, o2: 19, text: '8 PPM CO, 5.2% CH4, 19.0% O2' }),

    // Row 4. Stop 12 in No. 1, outby the face barricade. 10/11 in No. 2 and No. 3.
    // Unconscious Jerry Matthers is in the overcast between No. 1 and No. 2, inby the 7/8 doors.
    el('overcast', at.xc(l, 0, 4, 0.5), { text: 'OVERCAST' }),
    el('person', at.xc(l, 0, 4, 0.25), { id: 'person-jerry', conscious: false, text: 'UNCONSCIOUS JERRY MATTHERS' }),
    el('gas', at.entry(l, 0, 4, 0.3), { id: 'gas-face-n1', ch4: 2.5, co: 20, o2: 19, text: '20 PPM CO, 2.5% CH4, 19.0% O2' }),
    el('barricade', at.entry(l, 0, 4, 0.55), { id: 'barricade-shawn', response: false, text: 'B' }),
    el('person', at.entry(l, 0, 4, 0.8), { id: 'person-shawn', conscious: true, text: 'CONSCIOUS SHAWN MAXWELL' }),
    el('x', at.node(l, 0, 5), { count: 8, text: '8 TIMBERS' }, 'timbers'),
    el('x', at.node(l, 0, 5), { text: 'SHOVEL' }, 'other'),
    el('gas', at.entry(l, 2, 4, 0.35), { id: 'gas-1011-n3', ch4: 2.5, co: 8, o2: 19.5, text: '8 PPM CO, 2.5% CH4, 19.5% O2' }),
    el('x', at.entry(l, 2, 4, 0.75), { id: 'shaft-n3', preMapped: true, text: 'AIR SHAFT — not in use, available if needed' }, 'shaft')
  ];
  return {
    schema: SCHEMA,
    id: 'case-national-2026-day2',
    title: '2026 National — Coal Day 2',
    source: 'https://minerescuecenter.com/media/problems/2026_national_Coal_Day_2_Field_26_Nationals_Day_2.pdf',
    statement:
      'Wild Eagle Mine, fresh air base at the Timber Ridge Section. A five-man crew is missing after high CO readings at about 2:00 AM. An air shaft was just completed in the No. 3 entry; it is not in use but is available. The mine has a blowing fan. Air comes up the No. 3 entry and exits in the No. 1 and No. 2 entries. The fan is running and cannot be stopped, stalled, or reversed. Power to this area has been de-energized but can be re-energized. The team has 75 minutes.',
    instructions:
      'Account for all missing miners. Bring all survivors to the fresh air base. Explore all areas of the mine that can be explored safely. The team can only carry two brattice cloths at a time. Report the name and location of any missing miner to the Superintendent before leaving that team stop. The team cannot leave the field with materials it picked up.',
    missing: 4,
    timeLimit: 75,
    fabFresh: true,
    fabMaterials: { timbers: 0, pump: false, brattice: false, lineCurtain: false },
    keyNotes: 'Page 5 circles: row 1 is 1, 2/3, 2/3; row 2 is 6, 5, 4; row 3 is 7/9, 7/8, 8/9; row 4 is 12, 10/11, 10/11. Faces are inby of row 4.',
    layout: l,
    elements,
    updated: '2026-11-12T00:00:00.000Z'
  };
}

export const KEY: JudgeKey = {
  source: '2026 National Coal Day 2 judges’ packet, page 5 team-stop map, read at 300 dpi',
  stops: [
    { at: [0, 1], n: [1] },
    { at: [1, 1], n: [2, 3] },
    { at: [2, 1], n: [2, 3] },
    { at: [0, 2], n: [6] },
    { at: [1, 2], n: [5] },
    { at: [2, 2], n: [4] },
    { at: [0, 3], n: [7, 9] },
    { at: [1, 3], n: [7, 8] },
    { at: [2, 3], n: [8, 9] },
    { at: [0, 4], n: [12] },
    { at: [1, 4], n: [10, 11] },
    { at: [2, 4], n: [10, 11] }
  ],
  // Rule 44B, first paragraph: "If the team encounters contaminants in multiple entries, the team has the option of
  // which entry to examine first." Row 2 has contaminants ahead in No. 1, No. 2 and No. 3 (5.2% CH4 placards between
  // rows 2 and 3). Row 4 has contaminants ahead in No. 1 (2.5% CH4, 20 PPM CO) and No. 3 (2.5% CH4). No. 2 at row 4 has
  // no placard, so 11 there is not in a group.
  captainOrder: [
    {
      at: [
        [0, 2],
        [1, 2],
        [2, 2]
      ],
      why: 'Rule 44B: “If the team encounters contaminants in multiple entries, the team has the option of which entry to examine first.” Row 2 contaminants ahead in No. 1, No. 2 and No. 3.'
    },
    {
      at: [
        [0, 4],
        [2, 4]
      ],
      why: 'Rule 44B: “If the team encounters contaminants in multiple entries, the team has the option of which entry to examine first.” Row 4 contaminants ahead in No. 1 and No. 3.'
    }
  ],
  find: ['person-phil', 'person-jeff', 'person-jerry', 'person-shawn'],
  rescue: [{ el: 'person-phil' }, { el: 'person-jeff' }, { el: 'person-jerry' }, { el: 'person-shawn' }],
  withdrawal: false,
  notes: [
    'Five missing on the statement. Four placards name a condition: conscious Phil Billy, unconscious Jeff Batty, unconscious Jerry Matthers, conscious Shawn Maxwell.',
    'The fan is blowing and cannot be stopped. Power is de-energized.'
  ],
  manual: [
    'Not scored. Johnny Sky is drawn between the two barricades with Jeff Batty, and the placard does not say whether he is alive.',
    'Not scored, because the crop did not settle the opening: the oil bucket on fire beside stop 1, the spiral symbol in No. 1 outby stop 1, the BC marks at the fresh air base, the Great Smoky Mountains lunch box, the shuttle car, the roof bolter, the battery mine phone, the pick hammer, the cap light battery, the battery scoops, the copper tubing, the methane probe, the vent tubing, the 10mm socket, and the 3/8 inch drive ratchet.',
    'Not scored: the 2.5% CH4 / 8 PPM CO / 19.0% O2 inside the room beside Johnny Sky, and a second 5.2% / 8 PPM / 19.0% whose square sits on the Jeff Batty barricade line.',
    'Not scored: the five ventilation maps (pages 7–11) and the final vent map (page 12). The builds are not encoded until each placard they move has an opening.'
  ]
};

export const NATIONAL_2026_DAY2: ReferenceCase = {
  id: 'national-2026-day2',
  title: '2026 National — Coal Day 2',
  problem: national2026Day2,
  key: KEY
};
