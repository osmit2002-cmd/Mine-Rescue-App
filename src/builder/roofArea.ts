/**
 * Unsafe roof and caved drawn as lines (Odin's design):
 *
 * 1. The front line: two clicks, any angle (diagonal is fine). A click near a rib snaps onto it.
 * 2. The side: which side of the line is unsafe / caved. Until the back end is placed, that side is shown as
 *    unknown extent (a fading band past the line).
 * 3. The back end: a second line. The area between the two lines is the unsafe roof / caved area.
 *
 * The solver still sees an ordinary across element: `areaPlacement` gives its position in the opening, its length
 * along the opening and whether it reaches from rib to rib.
 */
import { cellRect, cellState, cellType, snap, type Geo, type Rect, type Topo } from './geometry';
import type { El } from './model';

export interface Pt {
  x: number;
  y: number;
}
export interface Seg {
  a: Pt;
  b: Pt;
}

/** Solid blocks the ribs belong to: every pillar and every unmined cell. */
export function solidBlocks(g: Geo): Rect[] {
  const out: Rect[] = [];
  for (let cx = 0; cx <= 2 * g.E; cx++)
    for (let cy = 0; cy <= 2 * g.R - 1; cy++) if (cellType(g, cx, cy) === 'pillar' || cellState(g, cx, cy) === 'solid') out.push(cellRect(g, cx, cy));
  return out;
}

function nearestOnRect(r: Rect, x: number, y: number): Pt & { d: number } {
  const inside = x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
  if (!inside) {
    const cx = Math.max(r.x, Math.min(r.x + r.w, x));
    const cy = Math.max(r.y, Math.min(r.y + r.h, y));
    return { x: cx, y: cy, d: Math.hypot(x - cx, y - cy) };
  }
  const opts = [
    { x: r.x, y, d: x - r.x },
    { x: r.x + r.w, y, d: r.x + r.w - x },
    { x, y: r.y, d: y - r.y },
    { x, y: r.y + r.h, d: r.y + r.h - y }
  ];
  return opts.reduce((a, b) => (b.d < a.d ? b : a));
}

const half = (v: number) => Math.round(v * 2) / 2;

/**
 * A line end: snapped onto the nearest rib when the click is within a third of the entry width of one (or inside
 * the coal), otherwise where it was clicked. Null when the click is not in or next to an opening.
 */
export function snapLinePoint(t: Topo, x: number, y: number): Pt | null {
  const g = t.geo;
  const W = g.layout.entryWidth;
  let best: (Pt & { d: number }) | null = null;
  for (const r of solidBlocks(g)) {
    const p = nearestOnRect(r, x, y);
    if (!best || p.d < best.d) best = p;
  }
  if (best && best.d <= W / 3) return { x: half(best.x), y: half(best.y) };
  return snap(t, x, y, 'point') ? { x: half(x), y: half(y) } : null;
}

const sub = (a: Pt, b: Pt) => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v: Pt) => Math.hypot(v.x, v.y);

/** Which side of the line a point is on: 1 = left of a→b, -1 = right. */
export function sideOf(s: Seg, p: Pt): 1 | -1 {
  const d = sub(s.b, s.a);
  const q = sub(p, s.a);
  return d.x * q.y - d.y * q.x >= 0 ? 1 : -1;
}

/** Unit normal pointing to `side` of the line. */
export function sideNormal(s: Seg, side: 1 | -1): Pt {
  const d = sub(s.b, s.a);
  const l = len(d) || 1;
  return { x: (-d.y / l) * side, y: (d.x / l) * side };
}

/** The unknown-extent band shown past the front line on its unsafe / caved side, `depth` feet deep. */
export function unknownBand(s: Seg, side: 1 | -1, depth: number): Pt[] {
  const n = sideNormal(s, side);
  return [s.a, s.b, { x: s.b.x + n.x * depth, y: s.b.y + n.y * depth }, { x: s.a.x + n.x * depth, y: s.a.y + n.y * depth }];
}

/** The closed area between the front line and the back end (ordered so the outline does not cross itself). */
export function closedArea(front: Seg, back: Seg): Pt[] {
  const straight = len(sub(front.b, back.b)) + len(sub(front.a, back.a));
  const crossed = len(sub(front.b, back.a)) + len(sub(front.a, back.b));
  return crossed <= straight ? [front.a, front.b, back.a, back.b] : [front.a, front.b, back.b, back.a];
}

/** The outline drawn for an element: the closed area once there is a back end, else the unknown band. */
export function areaOutline(el: Pick<El, 'edges' | 'side'>, W: number): { poly: Pt[]; closed: boolean } | null {
  const [front, back] = el.edges ?? [];
  if (!front) return null;
  if (back) return { poly: closedArea(front, back), closed: true };
  return el.side ? { poly: unknownBand(front, el.side, W), closed: false } : null;
}

/**
 * What the solver needs: the placard position (in the opening, near the area's middle), its length along the
 * opening, and whether it reaches from rib to rib. With only the front line, the area is taken as one third of the
 * entry width deep on its side (the rest is unknown).
 */
export function areaPlacement(t: Topo, el: Pick<El, 'edges' | 'side'>): Pick<El, 'x' | 'y' | 'len' | 'across'> | null {
  const g = t.geo;
  const W = g.layout.entryWidth;
  const [front, back] = el.edges ?? [];
  if (!front) return null;
  const poly = back ? closedArea(front, back) : unknownBand(front, el.side ?? 1, W / 3);
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const bx0 = Math.min(...xs);
  const bx1 = Math.max(...xs);
  const by0 = Math.min(...ys);
  const by1 = Math.max(...ys);
  const s = snap(t, (bx0 + bx1) / 2, (by0 + by1) / 2, 'across');
  if (!s) return null;
  const alongY = s.rot === 0;
  const along = alongY ? by1 - by0 : bx1 - bx0;
  const span = alongY ? bx1 - bx0 : by1 - by0;
  return { x: s.x, y: s.y, len: Math.max(2, Math.round(along)), across: span >= W * 0.9 };
}
