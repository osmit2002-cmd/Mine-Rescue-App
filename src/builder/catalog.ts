/**
 * Everything that can be placed on a problem map: every symbol of the MSHA Mine Map Legend (2026 Coal Mine
 * Rescue Rules, rule book pp. 51–55) plus the common "X" objects. Legend notes are verbatim from the rule book.
 */
import type { El, XSub } from './model';

export type Kind =
  | 'perm-stopping'
  | 'temp-stopping'
  | 'seal'
  | 'door'
  | 'barricade'
  | 'diagonal'
  | 'overcast'
  | 'line-curtain-installed'
  | 'caved'
  | 'unsafe-roof'
  | 'unsafe-rib'
  | 'water'
  | 'smoke'
  | 'smoke-end'
  | 'gas'
  | 'air'
  | 'fire'
  | 'fan'
  | 'body'
  | 'person'
  | 'refuge'
  | 'brattice'
  | 'line-curtain'
  | 'x'
  | 'roof-support'
  | 'fpa';

/** How an element sits in an opening: across it (stoppings, caved…), diagonally in an intersection, on an intersection, or at a point. */
export type Placement = 'across' | 'diagonal' | 'node' | 'point';

export type GroupId = 'vent' | 'ground' | 'air' | 'people' | 'fire' | 'objects' | 'team';

export const GROUPS: { id: GroupId; name: string }[] = [
  { id: 'vent', name: 'Ventilation structures' },
  { id: 'ground', name: 'Roof, rib, water, caved' },
  { id: 'air', name: 'Gases, smoke, air' },
  { id: 'people', name: 'Persons' },
  { id: 'fire', name: 'Fire, fans, power' },
  { id: 'objects', name: 'Objects and materials' },
  { id: 'team', name: 'Team map only' }
];

export interface KindDef {
  kind: Kind;
  name: string;
  group: GroupId;
  place: Placement;
  /** Legend wording from the rule book (verbatim), or our own note in [brackets]. */
  legend: string;
  defaults: Partial<El>;
  /** Rule ids in rules.json that apply to this object. */
  rules: string[];
}

export const LEGEND_NOTE =
  'Note: The symbols found in the legend shall be used in lieu of the wording on the placard for the symbol. Any additional information found on the placard must be written on the maps.';

const def = (d: KindDef) => d;

export const KIND_DEFS: Record<Kind, KindDef> = {
  'perm-stopping': def({
    kind: 'perm-stopping',
    name: 'Permanent stopping',
    group: 'vent',
    place: 'across',
    legend: 'PERMANENT STOPPING INTACT, AIRTIGHT (No indication of opening(s) or leakage). PERMANENT STOPPING NOT INTACT, NOT AIRTIGHT: Condition noted on placard must be shown on Team map.',
    defaults: { intact: true, airtight: true, text: 'PERMANENT STOPPING' },
    rules: ['b-card-24', 'b-card-27', 'b-card-42', 'a-card-5']
  }),
  'temp-stopping': def({
    kind: 'temp-stopping',
    name: 'Temporary stopping',
    group: 'vent',
    place: 'across',
    legend:
      'TEMPORARY STOPPING INTACT, AIRTIGHT: This symbol must be used for all found and/or newly erected, intact, and airtight, structures built by the team. TEMPORARY STOPPING NOT INTACT, NOT AIRTIGHT: Condition noted on placard must be shown on the Team map. Note: Placards that say “Stopping” without stating whether it is Permanent or Temporary should not be used.',
    defaults: { intact: true, airtight: true, text: 'TEMPORARY STOPPING' },
    rules: ['b-card-24', 'b-card-27', 'b-card-42', 'b-card-43', 'a-card-5']
  }),
  seal: def({
    kind: 'seal',
    name: 'Seal',
    group: 'vent',
    place: 'across',
    legend:
      'If the seal is equipped with devices such as sampling tubes or water traps, or is damaged, leaking, or destroyed, that particular device or condition must be noted beside the symbol, including gas test results from sampling tube. No gas box symbol would be required for sampling tube test results.',
    defaults: { intact: true, airtight: true, text: 'SEAL' },
    rules: ['b-card-24', 'b-card-27', 'b-card-44', 'b-card-45']
  }),
  door: def({
    kind: 'door',
    name: 'Door',
    group: 'vent',
    place: 'across',
    legend:
      'Can be shown by itself or in ventilation controls. However, the type and size (if indicated by placard) and “open” or “closed” must be written out. Letters to indicate doors or barricades can be parallel or perpendicular to or on the stopping, or adjacent to the structure as shown.',
    defaults: { open: false, intact: true, airtight: true, text: 'DOOR CLOSED' },
    rules: ['b-card-24', 'b-card-27', 'b-card-42', 'b-card-19']
  }),
  barricade: def({
    kind: 'barricade',
    name: 'Barricade',
    group: 'vent',
    place: 'across',
    legend: 'If the placard indicates that the barricade is damaged, leaking, or destroyed, that particular condition must be noted beside the symbol.',
    defaults: { intact: true, airtight: true, response: false, text: 'BARRICADE' },
    rules: ['b-card-24', 'b-card-27', 'b-card-35', 'b-card-37', 'b-card-41', 'b-card-42']
  }),
  diagonal: def({
    kind: 'diagonal',
    name: 'Diagonal',
    group: 'vent',
    place: 'diagonal',
    legend: 'Temporary stoppings used to form a diagonal in an intersection, shall extend from corner to corner.',
    defaults: { intact: true, airtight: true, diag: '/', text: 'TEMPORARY STOPPING' },
    rules: ['b-card-48', 'b-card-23']
  }),
  overcast: def({
    kind: 'overcast',
    name: 'Overcast or undercast',
    group: 'vent',
    place: 'node',
    legend:
      'This symbol is to be used for placards indicating “overcast/undercast” or “overcast wall”. If the overcast or undercast is damaged, leaking, or destroyed, that particular condition must be noted beside the symbol.',
    defaults: { intact: true, airtight: true, text: 'OVERCAST' },
    rules: ['b-card-24', 'b-card-27', 'b-card-42', 'b-card-45', 'b-card-48']
  }),
  'line-curtain-installed': def({
    kind: 'line-curtain-installed',
    name: 'Line curtain installed',
    group: 'vent',
    place: 'point',
    legend:
      'The full extent of the line curtain shall be shown. If the line curtain is partially or completely down, it must be noted beside the symbol. It cannot be folded or rolled up.',
    defaults: { len: 30, text: 'LINE CURTAIN' },
    rules: ['b-card-19', 'b-card-48']
  }),
  caved: def({
    kind: 'caved',
    name: 'Caved',
    group: 'ground',
    place: 'across',
    legend:
      'Caved areas are not considered airtight unless the placard states “airtight” and it will have to be written out on the map (“airtight”) beside the symbol.',
    defaults: { across: true, airtight: false, len: 10, text: 'CAVED' },
    rules: ['b-card-23', 'b-card-24', 'b-card-27', 'b-card-30', 'b-card-44', 'b-card-48']
  }),
  'unsafe-roof': def({
    kind: 'unsafe-roof',
    name: 'Unsafe roof',
    group: 'ground',
    place: 'across',
    legend: 'Placard must state “unsafe roof”. Any other condition designated must be noted beside the symbol. Outline size if indicated by placard or markings.',
    defaults: { across: true, len: 10, text: 'UNSAFE ROOF' },
    rules: ['b-card-23', 'b-card-24', 'b-card-30', 'b-card-32', 'b-card-41', 'a-card-5']
  }),
  'unsafe-rib': def({
    kind: 'unsafe-rib',
    name: 'Unsafe rib or overhanging brow',
    group: 'ground',
    place: 'point',
    legend: 'Project over ribline and area on map.',
    defaults: { len: 10, text: 'UNSAFE RIB' },
    rules: ['b-card-23', 'b-card-30']
  }),
  water: def({
    kind: 'water',
    name: 'Water',
    group: 'ground',
    place: 'across',
    legend: 'Symbol indicates start and end of water or changes in depth of water. Write out depth(s) as shown on placard.',
    defaults: { across: true, overKnee: true, roofed: false, len: 10, text: 'WATER OVER KNEE DEEP' },
    rules: ['b-card-30', 'b-card-41', 'b-card-42', 'b-card-19', 'b-card-44']
  }),
  smoke: def({
    kind: 'smoke',
    name: 'Smoke',
    group: 'air',
    place: 'point',
    legend:
      'Write out “light” or “dense” if indicated on placard; draw in entire extent of smoke. The smoke symbol should not be extended into unexplored areas.',
    defaults: { density: '', text: 'SMOKE' },
    rules: ['b-card-20', 'b-card-22', 'b-card-24', 'b-card-8', 'b-card-34']
  }),
  'smoke-end': def({
    kind: 'smoke-end',
    name: 'End of smoke',
    group: 'air',
    place: 'point',
    legend: '[Placard marking where smoke ends. Smoke is considered to extend to a placard stating the “end of smoke” or a separation intended or indicated to be airtight (Rule 24E).]',
    defaults: { text: 'END OF SMOKE' },
    rules: ['b-card-24']
  }),
  gas: def({
    kind: 'gas',
    name: 'Gas placard',
    group: 'air',
    place: 'point',
    legend: 'PLACARD INDICATING GAS MIXTURE: Write out as indicated on placard. ____% CH4 ____PPM CO ____% O2',
    defaults: { ch4: 0, co: 0, o2: 20.8 },
    rules: ['b-card-24', 'b-card-25', 'b-card-31', 'b-card-34', 'b-card-44']
  }),
  air: def({
    kind: 'air',
    name: 'Air movement',
    group: 'air',
    place: 'point',
    legend: 'Write out quantity if shown on placard.',
    defaults: { dir: 0, text: '' },
    rules: ['misc-4', 'b-card-19']
  }),
  fire: def({
    kind: 'fire',
    name: 'Fire',
    group: 'fire',
    place: 'point',
    legend: 'Write out "smoldering", "raging", etc., if shown on placard. The fire symbol must be placed over the object on fire.',
    defaults: { extinguishable: true, text: 'FIRE' },
    rules: ['b-card-23', 'b-card-24', 'b-card-30', 'b-card-31']
  }),
  fan: def({
    kind: 'fan',
    name: 'Fan',
    group: 'fire',
    place: 'point',
    legend: 'Write out conditions of fan as indicated by placard.',
    defaults: { fanMode: 'exhausting', on: true, text: 'FAN ON EXHAUSTING' },
    rules: ['misc-4', 'b-card-19', 'a-card-5']
  }),
  body: def({
    kind: 'body',
    name: 'Body',
    group: 'people',
    place: 'point',
    legend:
      'Indicate position of head and feet as body is found. If the word “body” is on the placard, show symbol for body and denote the additional information that is shown on the placard. (Orientation is not required for placards that state “Body”)',
    defaults: { dir: 0, text: 'BODY' },
    rules: ['b-card-32', 'b-card-27', 'a-card-5']
  }),
  person: def({
    kind: 'person',
    name: 'Live person',
    group: 'people',
    place: 'point',
    legend: 'Write out condition indicated on the placard, such as conscious, unconscious, walking, etc., indicate position if lying down.',
    defaults: { conscious: true, dir: 0, text: 'LIVE PERSON CONSCIOUS' },
    rules: ['b-card-12', 'b-card-11', 'b-card-32', 'b-card-33', 'b-card-34', 'b-card-40', 'b-card-41']
  }),
  refuge: def({
    kind: 'refuge',
    name: 'Refuge alternative',
    group: 'people',
    place: 'point',
    legend:
      'A refuge alternative is considered to be an undamaged and air-tight unit equipped with an air lock. For contest work a refuge alternative will be the prefabricated type and will not block ventilation through an entry where the component is located or prohibit exploration around the component. The symbol “RA” may be located outside of the RA, the symbol is to remain upright with door oriented as found. The only items required to be mapped inside the Refuge Alternative are live persons and bodies (orientation does not apply).',
    defaults: { dir: 180, text: 'REFUGE ALTERNATIVE' },
    rules: ['b-card-36', 'b-card-41']
  }),
  brattice: def({
    kind: 'brattice',
    name: 'Brattice cloth',
    group: 'objects',
    place: 'point',
    legend: 'BRATTICE CLOTH',
    defaults: { text: 'BRATTICE CLOTH' },
    rules: ['b-card-45', 'b-card-48']
  }),
  'line-curtain': def({
    kind: 'line-curtain',
    name: 'Line curtain',
    group: 'objects',
    place: 'point',
    legend: 'Designated curtain provided for removing contaminated or explosive gases. Handheld by the team and is considered airtight.',
    defaults: { text: 'LINE CURTAIN' },
    rules: ['b-card-19', 'b-card-48']
  }),
  x: def({
    kind: 'x',
    name: 'Other object (X)',
    group: 'objects',
    place: 'point',
    legend: 'LOCATION OF ANY OTHER OBJECTS, CONDITIONS, OR EQUIPMENT: Write the name of the object, condition, or equipment by the symbol. This also includes faces if indicated by a placard.',
    defaults: { sub: 'other', text: '' },
    rules: ['a-card-5']
  }),
  'roof-support': def({
    kind: 'roof-support',
    name: 'Roof support installed by the team',
    group: 'team',
    place: 'point',
    legend: 'ANY ROOF SUPPORT INSTALLED BY THE TEAM',
    defaults: {},
    rules: ['b-card-30']
  }),
  fpa: def({
    kind: 'fpa',
    name: 'Farthest point of advance',
    group: 'team',
    place: 'across',
    legend: 'FARTHEST POINT OF ADVANCE IN ENTRY, ROOM, OR CROSSCUT: This symbol should only be used where areas inby the farthest point of advance will not be explored.',
    defaults: {},
    rules: ['a-card-5', 'a-card-6']
  })
};

export interface XDef {
  sub: XSub;
  name: string;
  text: string;
  /** Why it matters to the solver, shown in the inspector. */
  hint: string;
  defaults?: Partial<El>;
}

export const X_DEFS: XDef[] = [
  { sub: 'lunch-pail', name: 'Lunch pail', text: 'LUNCH PAIL', hint: 'Must be examined (Rule 47). A note inside is mapped with its own X (A Card 5G).' },
  { sub: 'note', name: 'Note', text: 'NOTE', hint: 'Information on notes must be recorded on the map, one X for each note (A Card 5G).' },
  { sub: 'timbers', name: 'Timbers', text: 'TIMBERS', hint: 'Roof support for timbering through unsafe roof to a patient (Rules 30A, 41C).', defaults: { count: 6 } },
  { sub: 'pump', name: 'Pump', text: 'PUMP', hint: 'Used to pump water over knee deep to reach a patient (Rule 41C2).' },
  { sub: 'equipment', name: 'Equipment', text: 'SCOOP', hint: 'Mark energized if it is: energized equipment in an explosive mixture is a withdrawal situation (Rule 31B).', defaults: { energized: false } },
  { sub: 'cable', name: 'Cable', text: 'ENERGIZED CABLE', hint: 'Energized cables are ignition sources (Rule 31).', defaults: { energized: true } },
  { sub: 'battery', name: 'Battery', text: 'BATTERY', hint: 'All batteries except cap light batteries count as ignition sources (Rule 31B).', defaults: { energized: true } },
  { sub: 'borehole', name: 'Borehole', text: 'OPEN BOREHOLE', hint: 'Open boreholes are gas-test locations (Rule 24A). Boreholes cannot be used for ventilation (Rule 19).' },
  { sub: 'shaft', name: 'Air shaft', text: 'AIR SHAFT', hint: 'An opening to the surface. All air shafts are shown on the team map (A Card 5B).', defaults: { preMapped: true } },
  { sub: 'face', name: 'Face', text: 'FACE', hint: 'Faces get roof/face/rib tests, a gas test and dates and initials (Rules 23, 24A, 27).' },
  { sub: 'old-works', name: 'Cut into old works', text: 'CUT INTO OLD WORKS', hint: 'Inaccessible (Rule 44). Gas test where it prohibits further travel (Rule 24A).' },
  { sub: 'materials', name: 'Materials', text: 'STOPPING MATERIAL', hint: 'Ventilation material for temporary stoppings (Rule 45).' },
  { sub: 'other', name: 'Other', text: '', hint: 'Anything not in the legend: write the name by the X (A Card 5E).' }
];

export const xDef = (sub?: XSub) => X_DEFS.find((d) => d.sub === sub) ?? X_DEFS[X_DEFS.length - 1];

/** One button in the palette. */
export interface PaletteItem {
  key: string;
  kind: Kind;
  sub?: XSub;
  name: string;
  group: GroupId;
}

export const PALETTE: PaletteItem[] = [
  ...(Object.values(KIND_DEFS).filter((d) => d.kind !== 'x') as KindDef[]).map((d) => ({ key: d.kind, kind: d.kind, name: d.name, group: d.group })),
  ...X_DEFS.map((x) => ({ key: `x:${x.sub}`, kind: 'x' as const, sub: x.sub, name: x.name, group: x.sub === 'equipment' || x.sub === 'cable' || x.sub === 'battery' ? ('fire' as const) : ('objects' as const) }))
];

/** A new element of this palette item at (x, y), with the kind's defaults. */
export function makeElement(item: Pick<PaletteItem, 'kind' | 'sub'>, x: number, y: number, id: string): El {
  const d = KIND_DEFS[item.kind];
  const el: El = { id, kind: item.kind, x, y, ...d.defaults };
  if (item.kind === 'x') {
    const xd = xDef(item.sub);
    Object.assign(el, { sub: xd.sub, text: xd.text }, xd.defaults ?? {});
  }
  return el;
}

/** Placard wording for a gas placard, in the required order: methane, carbon monoxide, oxygen (Rule 24E). */
export function gasText(el: Pick<El, 'ch4' | 'co' | 'o2'>): string {
  const f = (v: number | undefined) => (v === undefined ? '—' : String(v));
  return `${f(el.ch4)}% CH4 ${f(el.co)} PPM CO ${f(el.o2)}% O2`;
}

/** The wording to map beside the symbol (verbatim placard text, or the gas readings). */
export function placardText(el: El): string {
  if (el.kind === 'gas') return el.text?.trim() || gasText(el);
  return el.text?.trim() ?? '';
}

/** Short human name, e.g. "Gas placard", "Lunch pail". */
export function elementName(el: El): string {
  if (el.kind === 'x') return xDef(el.sub).name;
  return KIND_DEFS[el.kind].name;
}
