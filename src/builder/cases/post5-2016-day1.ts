/**
 * 2016 Post 5 & West Virginia State Mine Rescue Contest, Day 1.
 * Source: problems/msha-archive/coal/2016/2016_Post_5_Day_1_Mine_Rescue.pdf
 *   p. 2 problem map, p. 3 statement, p. 5 written instructions, p. 6 team stops / date & initials / gas tests,
 *   p. 7 gas extents, pp. 8, 9, 11 patient statements, pp. 10, 12 vent maps, p. 13 keys to problem.
 *
 * Transcribed from the problem map (p. 2) rendered at 200 dpi. The map is drawn with 20-ft openings and 40-ft
 * pillars (110 px and 220 px), so positions are converted from page pixels at 5.5 px per foot. The map is not
 * to scale, so only positions relative to the openings matter.
 *
 * Reading of the 2016 symbols against the 2026 legend: the chevrons in the crosscuts are stoppings not intact
 * (double lines permanent, single lines temporary); dashed rectangles are unsafe roof; the box with bars at the
 * No. 2 Entry rib is unsafe rib; the scalloped blob marked "Over Knee Deep" is water partly across the entry.
 */
import { cellKey } from '../geometry';
import type { Kind } from '../catalog';
import { defaultLayout, SCHEMA, type El, type Problem, type XSub } from '../model';
import type { JudgeKey, ReferenceCase } from '../judge';

const PX = 5.5;
/** Page pixel (200 dpi render of p. 2) → feet: x from the left side stub, y inby from the FAB's outby rib. */
const ft = (px: number, py: number) => ({ x: Math.round((20 + (px - 375) / PX) * 10) / 10, y: Math.round(((1745 - py) / PX) * 10) / 10 });

function el(id: string, kind: Kind, px: number, py: number, extra: Partial<El> = {}, sub?: XSub): El {
  return { id, kind, ...ft(px, py), ...(sub ? { sub } : {}), ...extra };
}
const x = (id: string, sub: XSub, px: number, py: number, text: string, extra: Partial<El> = {}) => el(id, 'x', px, py, { text, ...extra }, sub);
const gas = (id: string, px: number, py: number, ch4: number, co: number, o2: number) => el(id, 'gas', px, py, { ch4, co, o2 });
const brokenPerm = { intact: false, airtight: false, text: 'PERMANENT STOPPING NOT INTACT' };
const brokenTemp = { intact: false, airtight: false, text: 'TEMPORARY STOPPING NOT INTACT' };

export function post5Day1(): Problem {
  const l = defaultLayout(3, 5);
  l.entryWidth = 20;
  l.pillarWidth = 40;
  l.pillarLength = 40;
  l.stubLength = 20;
  l.xcStart = 1; // "You are located in the first crosscut"
  l.cells[cellKey(6, 0)] = 'solid'; // no opening right of No. 3 at the FAB; the fan stub is on the left
  const elements: El[] = [
    // Fresh air base (Crosscut 1) — shown on the blank maps.
    el('fan', 'fan', 318, 1690, { fanMode: 'blowing', on: false, text: 'BLOWING FAN - SWITCH OFF', preMapped: true }),
    el('bc-fab-1', 'brattice', 593, 1725, { preMapped: true }),
    el('bc-fab-2', 'brattice', 922, 1725, { preMapped: true }),
    x('shaft', 'shaft', 1090, 252, "8' AIR SHAFT", { preMapped: true }),

    // No. 1 Entry, FAB to Crosscut 2: two barricades with persons, unsafe roof outby Crosscut 2.
    gas('gas-b1-outby', 429, 1600, 5.5, 5, 19.5),
    el('barricade-1', 'barricade', 431, 1585, { response: true, text: 'BARRICADE' }),
    el('person-b1', 'person', 465, 1570, { conscious: true, dir: 90, text: 'CONSCIOUS - HELP! THERE IS AN AIRTIGHT BARRICADE BEHIND ME.' }),
    gas('gas-b1', 390, 1545, 4.8, 5, 19.0),
    el('barricade-2', 'barricade', 431, 1532, { response: true, text: 'BARRICADE' }),
    el('person-b2', 'person', 464, 1495, { conscious: true, text: 'CONSCIOUS - HELP! GET ME OUT OF HERE!' }),
    el('body-b2', 'body', 392, 1487, { text: 'BODY' }),
    x('timbers-b2', 'timbers', 432, 1471, 'THREE TIMBERS', { count: 3 }),
    el('roof-n1-1', 'unsafe-roof', 431, 1437, { across: true, len: 8, text: 'UNSAFE ROOF' }),

    // No. 2 Entry, FAB to Crosscut 2.
    el('lc', 'line-curtain', 760, 1466),
    gas('gas-n2-r1', 760, 1362, 4.5, 9, 19.9),
    el('water-n2-1', 'water', 805, 1300, { overKnee: true, across: false, len: 6, text: 'OVER KNEE DEEP' }),

    // No. 3 Entry, FAB to Crosscut 2: a person under unsafe roof along the left rib, between two timber sets.
    x('timber-set-n3-1', 'other', 1090, 1597, 'TIMBER SET'),
    el('roof-n3-1', 'unsafe-roof', 1050, 1526, { across: false, len: 18, text: 'UNSAFE ROOF' }),
    el('body-n3', 'body', 1048, 1555, { text: 'PERSON' }),
    x('timber-set-n3-2', 'other', 1088, 1461, 'TIMBER SET'),

    // Crosscut 2 (row 1).
    el('stop-xc2-12', 'perm-stopping', 610, 1362, brokenPerm),
    x('saw', 'other', 695, 1403, 'SAW'),
    el('stop-xc2-23', 'perm-stopping', 945, 1362, brokenPerm),

    // Pillar band between Crosscuts 2 and 3.
    x('timber-set-n1', 'other', 472, 1261, 'TIMBER SET'),
    gas('gas-n1-b1', 470, 1118, 4.5, 9, 19.9),
    el('roof-n2-scoop', 'unsafe-roof', 805, 1090, { across: false, len: 10, text: 'UNSAFE ROOF' }),
    x('scoop-1', 'equipment', 800, 1088, 'BATTERY SCOOP', { energized: false }),

    // Crosscut 3 (row 2).
    el('stop-xc3-12', 'temp-stopping', 610, 1032, brokenTemp),
    el('stop-xc3-23', 'temp-stopping', 945, 1032, brokenTemp),
    gas('gas-xc3-23', 978, 990, 4.5, 9, 19.9),

    // Pillar band between Crosscuts 3 and 4.
    gas('gas-n1-r2', 469, 963, 5.5, 10, 18.5),
    el('roof-n1-2', 'unsafe-roof', 431, 871, { across: true, len: 10, text: 'UNSAFE ROOF' }),
    gas('gas-n3-b2', 1050, 792, 4.5, 9, 19.9),
    el('rib-n2', 'unsafe-rib', 812, 748, { text: 'UNSAFE RIB' }),

    // Crosscut 4 (row 3).
    el('bc-n1-r3', 'brattice', 399, 707),
    x('hammer', 'other', 497, 743, 'HAMMER'),
    el('stop-xc4-12', 'temp-stopping', 607, 703, brokenTemp),
    x('scoop-2', 'equipment', 973, 662, 'BATTERY SCOOP', { energized: false }),

    // Pillar band between Crosscuts 4 and 5.
    el('stop-n2', 'temp-stopping', 760, 617, brokenTemp),
    x('glue', 'other', 426, 597, 'GLUE STICK'),
    x('axe-n2', 'other', 803, 640, 'AXE'),
    x('tape', 'other', 716, 586, 'BLACK TAPE'),
    el('body-n2', 'body', 803, 575, { text: 'BODY' }),
    x('pump-float', 'other', 762, 548, 'PUMP FLOAT'),
    el('water-n2-2', 'water', 762, 517, { overKnee: false, across: true, len: 10, text: 'KNEE DEEP' }),
    el('roof-n3-2', 'unsafe-roof', 1090, 515, { across: true, len: 20, text: 'UNSAFE ROOF' }),
    gas('gas-n3-b3', 1130, 493, 5.5, 10, 19.7),

    // Crosscut 5 (row 4).
    x('ax-n1', 'other', 475, 440, 'AX'),
    el('bc-xc5', 'brattice', 505, 405),
    x('roof-bolter', 'equipment', 586, 372, 'ROOF BOLTER', { energized: false }),
    x('roof-bolt-1', 'materials', 634, 372, 'ROOF BOLT'),
    x('roof-bolt-2', 'materials', 670, 415, 'ROOF BOLT'),
    el('water-xc5', 'water', 915, 375, { overKnee: false, across: true, len: 9, text: 'KNEE DEEP' }),

    // Faces.
    x('timbers-broken', 'timbers', 390, 236, 'FOUR TIMBERS BROKEN (CANNOT USE)', { count: 0 }),
    el('bc-n1-face', 'brattice', 420, 236),
    x('face-1', 'face', 432, 215, 'FACE'),
    gas('gas-n2-face', 760, 305, 5.5, 10, 19.5),
    el('barricade-3', 'barricade', 760, 268, { response: true, text: 'BARRICADE' }),
    el('person-n2', 'person', 800, 238, { conscious: true, text: 'CONSCIOUS - HELP! GET ME OUT OF HERE!' }),
    x('miner', 'equipment', 720, 245, 'CONTINUOUS MINER WITH BROKEN CH4 SENSOR', { energized: false }),
    x('face-2', 'face', 762, 215, 'FACE'),
    x('ram-car', 'equipment', 1045, 300, 'BATTERY RAM CAR', { energized: false }),
    x('face-3', 'face', 1090, 215, 'FACE')
  ];
  return {
    schema: SCHEMA,
    id: 'case-post5-2016-day1',
    title: '2016 Post 5 & WV State — Day 1',
    source: 'problems/msha-archive/coal/2016/2016_Post_5_Day_1_Mine_Rescue.pdf',
    statement:
      'You are located in the first crosscut of WVS # 1 mine. This mine just reopened after several years of being idle due to bad roof and high methane liberations. Thanks for answering our call for help. The RP reported over an hour ago that the blowing fan had stopped suddenly and that he called underground and did not get a response. He said that six miners was sent to the unit early this morning to prepare for day shift coal production. The RP also reported high concentrations of methane in the no.1 entry after the fan stopped and a decision was made by management to call for professional help. The fan has been checked by electricians and has been deemed safe for use if needed. We do have an airshaft in the no.3 entry that can be use for ventilation. The power inby the fresh air base has been locked out and is being guarded. A trained mine rescue team is here to back you up and the mine maps that you will receive once the clock is started are up to date. We have had constant trouble with our methane monitor on the continuous miner giving false readings. We believe this may have contributed to our emergency situation here today. Please find the six missing miners and bring survivors to the fresh air base. Be careful and explore with safety.',
    instructions:
      'EXPLORE THE ENTIRE MINE THAT CAN BE SAFELY EXPLORED. FAN SWITCH IS CONTROLLED BY THE COMMAND CENTER / BO. THE BLOWING FAN CANNOT BE REVERSED. THE BLOWING FAN CANNOT BE STOPPED OR STALLED AFTER STARTING. YOU CANNOT CARRY MORE THAN 3 BRATTICE CLOTH WHILE ADVANCING OR RETREATING. BO/CCA IS OUTSIDE AND ISOLATED.',
    missing: 6,
    timeLimit: 0,
    fabFresh: true,
    fabMaterials: { timbers: 0, pump: false, brattice: true, lineCurtain: false },
    keyNotes: KEY.notes.join(' '),
    layout: l,
    elements,
    updated: '2026-10-29T00:00:00.000Z'
  };
}

/** Judge key from pp. 6 and 13. */
export const KEY: JudgeKey = {
  source: 'problems/msha-archive/coal/2016/2016_Post_5_Day_1_Mine_Rescue.pdf, pp. 6, 13',
  stops: [
    { at: [2, 1], n: [1, 2, 3] },
    { at: [1, 1], n: [1, 2] },
    { at: [0, 1], n: [2, 3] },
    { at: [0, 2], n: [4, 5] },
    { at: [1, 2], n: [4, 5] },
    { at: [2, 2], n: [6] },
    { at: [1, 3], n: [7, 8] },
    { at: [2, 3], n: [7, 8] },
    { at: [0, 3], n: [9] },
    { at: [1, 4], n: [10] },
    { at: [2, 4], n: [11] },
    { at: [0, 4], n: [12] }
  ],
  rescue: [
    { el: 'person-b1', before: 0 },
    { el: 'person-n2', before: 11 },
    { el: 'person-b2', before: 12 }
  ],
  reachBefore: [{ el: 'body-n3', before: 12 }],
  withdrawal: false,
  manual: [
    'Ventilation: put the first barricade back up to wing out the explosive mixture (vent 1), then take it down to ventilate the 19.0% O2 to the second barricade (vent 2), before stop 12.',
    'Ventilation: never send low O2 over the person under unsafe roof in No. 3 Entry.',
    'Materials: the four broken timbers cannot be used; the three timbers from the barricade are the ones used to reach the person in No. 3.'
  ],
  notes: [
    'Team must rescue patient in first Barricade before entire team goes inby fresh air base.',
    'Team must rescue patient in Barricade at team stop #10 before going to next team stop.',
    'Team must ventilate to get patient in 2nd Barricade in no.1 entry before going to team stop # 12.',
    '4 broken timbers in no.1 face area cannot be used for timbering.',
    'Team must put first Barricade back up in no.1 entry to wing out explosive mixture (see vent 1 map) on first vent. Then team can take first barricade down to vent irrespirable 19.0 %O2 (see second vent map) going to second barricade.',
    'Team must not send low O2 over person in unsafe roof in no.3 entry.',
    'Team must use the three timbers in barricade to timber to person in unsafe roof before exploring team stop # 12.',
    'Team must explore team stop #12 before stopping the clock.'
  ]
};

export const POST5_2016_DAY1: ReferenceCase = { id: 'post5-2016-day1', title: '2016 Post 5 & WV State — Day 1', problem: post5Day1, key: KEY };
