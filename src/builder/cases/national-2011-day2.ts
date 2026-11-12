/**
 * 2011 National Mine Rescue — Coal, Day 2 (Cat's Paw Coal, Buckeye No. 1).
 *
 * The statement and the judges' team-stop narrative are in the MSHA problem file, which is public domain:
 * https://permanent.fdlp.gov/websites/www.msha.gov/MineRescue/PROBLEMS/coal/2011/NMRC%20Day%202%20Problem.pdf
 * The PDF is not committed. Placard cells below were read from the judges' map "GAS TESTS, R&R, D&I, TEAM STOPS"
 * rendered at 300 dpi, with tesseract word coordinates, and checked against that written stop order.
 * A cell is encoded only where the map and the written stop text put it in the same opening.
 * Cells that disagreed, or that the crop did not resolve to one opening, are listed on the key and are not scored.
 *
 * Scored on the 2026 rule text. The 2011 problem uses the same explosive and irrespirable thresholds this
 * solver uses. Power is locked out, so the battery equipment is not an ignition source.
 */
import { makeElement, type Kind } from '../catalog';
import { defaultLayout, SCHEMA, type El, type Layout, type Problem, type XSub } from '../model';
import type { JudgeKey, ReferenceCase } from '../judge';
import { at } from '../samples';

function maker(prefix: string) {
  let seq = 0;
  return (kind: Kind, p: { x: number; y: number }, extra: Partial<El> = {}, sub?: XSub): El => ({ ...makeElement({ kind, sub }, p.x, p.y, `${prefix}-${++seq}`), ...extra });
}

export function national2011Day2(): Problem {
  const l: Layout = defaultLayout(3, 5);
  l.xcStart = 1;
  const el = maker('n11');
  const elements: El[] = [
    // The blowing fan is in the No. 1 drift, off, and can be started, stopped, or reversed.
    el('fan', at.node(l, 0, 0), { fanMode: 'blowing', on: false, preMapped: true, text: 'BLOWING FAN OFF — in the No. 1 drift, guarded; can be started, stopped, or reversed' }),

    // The No. 3 mouth is caved airtight, so the first team stop is up No. 1.
    el('caved', at.entry(l, 2, 0, 0.55), { airtight: true, text: 'CAVED AIR TIGHT' }),
    // Four timbers and the briefing officer's borehole are at the fresh air base. The captain timbers the unsafe roof in the No. 1 opening before stop 1.
    el('x', at.node(l, 1, 0), { id: 'timbers-fab', count: 4, text: 'FOUR TIMBERS' }, 'timbers'),
    el('x', at.node(l, 1, 0), { text: 'BOREHOLE TO SURFACE' }, 'borehole'),
    // The roof marks in the No. 1 opening do not read as rib-to-rib, so the team can travel that entry. Stop 1 is there.
    el('unsafe-roof', at.entry(l, 0, 0, 0.45), { across: false, text: 'UNSAFE ROOF' }),

    // Stop 1, No. 1 at the first intersection. Irrespirable air inby, up to the cave. The lunch box and the 7.0% mixture are in that same opening.
    el('x', at.node(l, 0, 1), { text: 'LUNCH BOX' }, 'lunch-pail'),
    el('gas', at.entry(l, 0, 0, 0.75), { id: 'gas-n1-mouth', ch4: 7, co: 2, o2: 19.6, text: '2 PPM CO, 7.0% CH4, 19.6% O2' }),
    el('gas', at.entry(l, 0, 1, 0.25), { id: 'gas-n1-inby1', ch4: 4, co: 4, o2: 19, text: '4 PPM CO, 4.0% CH4, 19.0% O2' }),
    el('caved', at.entry(l, 0, 1, 0.7), { text: 'CAVED' }),

    // Stop 2 is across in No. 2. Water over knee deep blocks No. 2 between the first and second intersections.
    el('water', at.entry(l, 1, 1, 0.5), { overKnee: true, text: 'WATER OVER KNEE DEEP' }),
    el('brattice', at.node(l, 1, 1), { text: 'BRATTICE CLOTH' }),
    el('line-curtain', at.node(l, 1, 1), { text: 'LINE CURTAIN' }),

    // Stop 3, No. 3 at the first intersection. The person is under unsafe roof inby, between this stop and stop 4.
    el('person', at.entry(l, 2, 1, 0.35), { id: 'person-stop3', conscious: true, text: 'PERSON' }),
    el('unsafe-roof', at.entry(l, 2, 1, 0.45), { text: 'UNSAFE ROOF' }),
    el('gas', at.entry(l, 2, 0, 0.7), { id: 'gas-n3-stop3', ch4: 7, co: 2, o2: 19.6, text: '2 PPM CO, 7.0% CH4, 19.6% O2' }),

    // The judges' stop 4 text: caved in the second crosscut between No. 3 and No. 2, so the team does not tie across there.
    el('caved', at.xc(l, 1, 2, 0.5), { text: 'CAVED' }),

    // Stop 7 is the back side of the water in No. 2, at the second intersection. The judges' text places a body here.
    el('body', at.node(l, 1, 2), { id: 'body-stop7', text: 'BODY' }),
    el('gas', at.entry(l, 1, 2, 0.35), { id: 'gas-n2-stop7', ch4: 5.8, co: 2, o2: 19.2, text: '2 PPM CO, 5.8% CH4, 19.2% O2' }),
    // The team travels outby in No. 2 from stop 6 to stop 7, so this water does not span the entry. They test the back side of it.
    el('water', at.entry(l, 1, 2, 0.65), { overKnee: true, across: false, text: 'WATER OVER KNEE DEEP' }),
    // Stop 6: unsafe roof in the crosscut between No. 2 and No. 1, so the team does not tie across there.
    el('unsafe-roof', at.xc(l, 0, 3, 0.5), { text: 'UNSAFE ROOF' }),

    // Stop 9, No. 1 at the third intersection. The judges' text places a body here.
    el('body', at.node(l, 0, 3), { id: 'body-stop9', text: 'BODY' }),

    // Water over knee deep in No. 2 inby the third intersection, with a battery ram car. Power is locked out.
    el('water', at.entry(l, 1, 3, 0.4), { overKnee: true, text: 'WATER OVER KNEE DEEP' }),
    el('x', at.entry(l, 1, 3, 0.55), { energized: false, text: 'BATTERY RAM CAR' }, 'equipment'),

    // Two explosive mixtures in No. 3 inby stop 5. The cave is inby them.
    el('gas', at.entry(l, 2, 3, 0.3), { id: 'gas-n3-84', ch4: 5.4, co: 8, o2: 19.6, text: '8 PPM CO, 5.4% CH4, 19.6% O2' }),
    el('gas', at.entry(l, 2, 3, 0.55), { id: 'gas-n3-74', ch4: 5.4, co: 7, o2: 19.6, text: '7 PPM CO, 5.4% CH4, 19.6% O2' }),
    el('caved', at.entry(l, 2, 3, 0.8), { text: 'CAVED' }),

    // Stop 10, No. 1 at the last open crosscut. Barricade inby, with a response. The mixture outby it is explosive and irrespirable.
    el('gas', at.entry(l, 0, 4, 0.25), { id: 'gas-n1-face', ch4: 6.4, co: 5, o2: 19, text: '5 PPM CO, 6.4% CH4, 19.0% O2' }),
    el('barricade', at.entry(l, 0, 4, 0.5), { id: 'barricade-n1', response: true, text: 'BARRICADE' }),
    el('person', at.entry(l, 0, 4, 0.75), { id: 'person-n1', conscious: true, text: 'LIVE CONSCIOUS PERSON' }),

    // Stop 11, No. 2 face. The barricade does not answer. The person behind it is unconscious, in 19.0% oxygen.
    el('gas', at.entry(l, 1, 4, 0.25), { id: 'gas-n2-face', ch4: 4.4, co: 5, o2: 19, text: '5 PPM CO, 4.4% CH4, 19.0% O2' }),
    el('barricade', at.entry(l, 1, 4, 0.5), { id: 'barricade-n2', response: false, text: 'BARRICADE' }),
    el('person', at.entry(l, 1, 4, 0.75), { id: 'person-n2', conscious: false, text: 'UNCONSCIOUS LIVE PERSON' }),

    // Stop 12, No. 3 face. Clear of the explosive limit. An open 6-foot shaft and a de-energized battery ram car.
    el('gas', at.entry(l, 2, 4, 0.3), { id: 'gas-n3-face', ch4: 4.8, co: 3, o2: 19.6, text: '3 PPM CO, 4.8% CH4, 19.6% O2' }),
    el('x', at.entry(l, 2, 4, 0.55), { energized: false, text: 'BATTERY RAM CAR' }, 'equipment'),
    el('x', at.entry(l, 2, 4, 0.8), { id: 'shaft-n3', text: '6 FOOT SHAFT' }, 'shaft'),
    el('x', at.node(l, 2, 4), { count: 3, text: '3 TIMBERS' }, 'timbers')
  ];
  return {
    schema: SCHEMA,
    id: 'case-national-2011-day2',
    title: '2011 National — Coal Day 2',
    source: 'https://permanent.fdlp.gov/websites/www.msha.gov/MineRescue/PROBLEMS/coal/2011/NMRC%20Day%202%20Problem.pdf',
    statement:
      "Superintendent of the Cat's Paw Coal Co., Buckeye No. 1 Mine. Three repairmen, an examiner, and a foreman are missing from the 1st Right off 2 South Mains after smoke and a blast at the drifts. The blowing fan is off but operable and can be started, stopped, or reversed. It is in the No. 1 drift and is guarded. Power underground is locked out and guarded. The fresh air base has a safe haven for the briefing officer. All outby areas are explored and the mine map is up to date.",
    instructions:
      'Explore all of the mine that can be done safely. Account for all missing persons. Bring survivors to the fresh air base. Call out the lowest O2 readings to the briefing officer with 20 minute checks. The team can only carry three sets of building material at a time. You will have 70 minutes.',
    missing: 5,
    timeLimit: 70,
    fabFresh: true,
    fabMaterials: { timbers: 0, pump: false, brattice: false, lineCurtain: false },
    keyNotes: "Judges' map: stops 1, 2, 3 across the first intersection; 8, 7, 4 across the second; 9, 6, 5 across the third; 10, 11, 12 at the last open crosscut.",
    layout: l,
    elements,
    updated: '2026-11-12T00:00:00.000Z'
  };
}

export const KEY: JudgeKey = {
  source: 'https://permanent.fdlp.gov/websites/www.msha.gov/MineRescue/PROBLEMS/coal/2011/NMRC%20Day%202%20Problem.pdf — judges’ written stops and the team-stop map',
  stops: [
    { at: [0, 1], n: [1] },
    { at: [1, 1], n: [2] },
    { at: [2, 1], n: [3] },
    { at: [2, 2], n: [4] },
    { at: [2, 3], n: [5] },
    { at: [1, 3], n: [6] },
    { at: [1, 2], n: [7] },
    { at: [0, 2], n: [8] },
    { at: [0, 3], n: [9] },
    { at: [0, 4], n: [10] },
    { at: [1, 4], n: [11] },
    { at: [2, 4], n: [12] }
  ],
  find: ['person-stop3', 'body-stop7', 'body-stop9', 'person-n1', 'person-n2'],
  rescue: [{ el: 'person-stop3' }, { el: 'person-n1' }, { el: 'person-n2' }],
  withdrawal: false,
  notes: [
    'Five missing: the person under the unsafe roof in No. 3, the body at stop 7, the body at stop 9, the conscious person behind the No. 1 barricade, and the unconscious person behind the No. 2 barricade.',
    'The No. 1 barricade answers. The No. 2 barricade does not. Power is locked out, so the battery ram cars and the scoop batteries are not energized.'
  ],
  manual: [
    'Not scored, because the 300 dpi read did not settle the opening: the 2 PPM / 4.4% CH4 / 19.1% O2 and the 2 PPM / 4.0% / 19.2% O2 between stops 6 and 8; the SCSR, tool box, pallet of glue, bow saw, hammer, and cap board; which crosscut holds the caved airtight marks beside the upper water; the scoop batteries at the fresh air base; and the 2 PPM / 0.3% CH4 / 17.5% O2 at the caved No. 3 mouth. The first and second ventilation builds are written in the judges’ text and are not encoded until those placards have openings.'
  ]
};

export const NATIONAL_2011_DAY2: ReferenceCase = {
  id: 'national-2011-day2',
  title: '2011 National — Coal Day 2',
  problem: national2011Day2,
  key: KEY
};
