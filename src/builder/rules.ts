/**
 * Contest-rule meanings of placed elements: gas classes, what blocks travel or air, ignition sources.
 * Thresholds are the 2026 Coal Mine Rescue Rules' own numbers; each function names its rule.
 */
import type { El } from './model';

export interface GasClass {
  /** Rule 31: methane between five and fifteen percent inclusively and oxygen 12.1 percent or greater. */
  explosive: boolean;
  /** Rule 34: less than 19.5 percent oxygen, carbon monoxide in excess of 50 PPM, or smoke. */
  irrespirable: boolean;
  /** Rule 44: carbon monoxide above 10 PPM, methane above one percent, or less than 19.5 percent oxygen (or smoke). */
  contaminant: boolean;
  /** Rule 31B: carbon monoxide above 10 ppm is evidence of fire. */
  fireEvidence: boolean;
}

export function classifyGas(g: Pick<El, 'ch4' | 'co' | 'o2'>): GasClass {
  const ch4 = g.ch4 ?? 0;
  const co = g.co ?? 0;
  const o2 = g.o2 ?? 20.8;
  return {
    explosive: ch4 >= 5 && ch4 <= 15 && o2 >= 12.1,
    irrespirable: o2 < 19.5 || co > 50,
    contaminant: co > 10 || ch4 > 1 || o2 < 19.5,
    fireEvidence: co > 10
  };
}

export const SMOKE_CLASS: GasClass = { explosive: false, irrespirable: true, contaminant: true, fireEvidence: true };

/** Plain-language reasons for a gas class, for the solution steps. */
export function gasReasons(g: Pick<El, 'ch4' | 'co' | 'o2'>): string[] {
  const ch4 = g.ch4 ?? 0;
  const co = g.co ?? 0;
  const o2 = g.o2 ?? 20.8;
  const out: string[] = [];
  if (ch4 >= 5 && ch4 <= 15 && o2 >= 12.1) out.push(`explosive: ${ch4}% CH4 is between 5 and 15% and ${o2}% O2 is 12.1% or more`);
  else if (ch4 >= 5 && ch4 <= 15) out.push(`not explosive: ${o2}% O2 is below 12.1%`);
  if (o2 < 19.5) out.push(`oxygen deficient: ${o2}% O2 is less than 19.5%`);
  if (co > 50) out.push(`irrespirable: ${co} PPM CO is over 50 PPM`);
  if (co > 10) out.push(`evidence of fire: ${co} PPM CO is above 10 PPM`);
  if (ch4 > 1 && !(ch4 >= 5 && ch4 <= 15)) out.push(`contaminant: ${ch4}% CH4 is above 1%`);
  return out;
}

export type BlockType = 'inaccessible' | 'separation';

export interface BlockInfo {
  type: BlockType;
  /** What the team could do to get through: support the roof, pump the water, or airlock and breach. */
  fix: 'timber' | 'pump' | 'airlock' | 'breach' | 'none';
  reason: string;
}

/**
 * Does this element stop team travel along its opening? Rule 44 defines inaccessible areas (seals; unsafe roof rib
 * to rib; inextinguishable fires; water over knee deep; caved areas; cut into old works). Stoppings, doors and
 * barricades are separations the team can breach after building an airlock (Rule 42); one found not intact has an
 * opening and does not stop travel (2016 Post 5 Day 1: the judges tie across through broken crosscut stoppings).
 */
export function travelBlock(el: El): BlockInfo | null {
  switch (el.kind) {
    case 'caved':
      return el.across === false ? null : { type: 'inaccessible', fix: 'none', reason: 'caved area' };
    case 'unsafe-roof':
      return el.across === false ? null : { type: 'inaccessible', fix: 'timber', reason: 'unsafe roof from rib to rib' };
    case 'water':
      if (el.roofed) return { type: 'inaccessible', fix: 'pump', reason: 'water roofed' };
      return el.overKnee && el.across !== false ? { type: 'inaccessible', fix: 'pump', reason: 'water over knee deep' } : null;
    case 'seal':
      return { type: 'inaccessible', fix: 'none', reason: 'seal' };
    case 'fire':
      return el.extinguishable === false ? { type: 'inaccessible', fix: 'none', reason: 'inextinguishable fire' } : null;
    case 'x':
      return el.sub === 'old-works' ? { type: 'inaccessible', fix: 'none', reason: 'cut into old works' } : null;
    case 'perm-stopping':
    case 'temp-stopping':
    case 'diagonal':
      // Not intact (partly or completely down, legend p. 51): there is an opening, so the team travels through.
      if (el.intact === false) return null;
      return { type: 'separation', fix: isAirtight(el) ? 'airlock' : 'breach', reason: el.kind === 'perm-stopping' ? 'permanent stopping' : 'temporary stopping' };
    case 'barricade':
      if (el.intact === false) return null;
      return { type: 'separation', fix: isAirtight(el) ? 'airlock' : 'breach', reason: 'barricade' };
    case 'door':
      return el.open || el.intact === false ? null : { type: 'separation', fix: isAirtight(el) ? 'airlock' : 'breach', reason: 'closed door' };
    default:
      return null;
  }
}

/** Intact and airtight as found (the default for structures). */
export function isAirtight(el: El): boolean {
  if (el.kind === 'door') return !el.open && el.intact !== false && el.airtight !== false;
  if (el.kind === 'caved') return el.airtight === true;
  if (el.kind === 'water') return el.roofed === true;
  return el.intact !== false && el.airtight !== false;
}

/** Effect on airflow: an airtight separation blocks it; a damaged structure leaks. Rule 24D/24E "separation intended or indicated to be airtight". */
export function airEffect(el: El): 'block' | 'leak' | 'none' {
  switch (el.kind) {
    case 'perm-stopping':
    case 'temp-stopping':
    case 'seal':
    case 'barricade':
    case 'diagonal':
      return isAirtight(el) ? 'block' : 'leak';
    case 'door':
      return el.open ? 'none' : isAirtight(el) ? 'block' : 'leak';
    case 'caved':
      return el.airtight ? 'block' : 'none';
    case 'water':
      return el.roofed ? 'block' : 'none';
    default:
      return 'none';
  }
}

/** Fires, energized equipment, energized cables and batteries (except cap light batteries) are ignition sources (Rule 31). */
export function isIgnition(el: El): boolean {
  if (el.kind === 'fire') return true;
  if (el.kind === 'x' && (el.sub === 'equipment' || el.sub === 'cable' || el.sub === 'battery')) return el.energized !== false;
  if (el.kind === 'x' && el.energized) return true;
  return false;
}

/** Extent of an element along its opening, in feet either side of its point (across conditions have a length). */
export function halfLength(el: El): number {
  if (el.kind === 'caved' || el.kind === 'unsafe-roof' || el.kind === 'water' || el.kind === 'unsafe-rib') return Math.max(0, (el.len ?? 10) / 2);
  return 0;
}

export const RULE_NAMES: Record<string, string> = {
  'general-7': 'General Information 7',
  'misc-1': 'Miscellaneous 1',
  'misc-3': 'Miscellaneous 3',
  'misc-4': 'Miscellaneous 4',
  'fab-1': 'FAB Procedures 1',
  'fab-2': 'FAB Procedures 2',
  'a-card-2': 'A Card 2',
  'a-card-3': 'A Card 3',
  'a-card-4': 'A Card 4',
  'a-card-5': 'A Card 5',
  'a-card-6': 'A Card 6'
};

/** "b-card-24" → "Rule 24", "a-card-5" → "A Card 5". */
export function ruleName(id: string): string {
  if (RULE_NAMES[id]) return RULE_NAMES[id];
  const m = /^b-card-(\d+)$/.exec(id);
  if (m) return `Rule ${m[1]}`;
  return id;
}
