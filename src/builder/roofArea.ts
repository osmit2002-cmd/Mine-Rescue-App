/**
 * Unsafe roof and caved areas drawn from two points on the ribs (Odin's design):
 *
 * - Points on two different pillars (or ribs): the area stretches from one point to the other (the rectangle they
 *   span, kept inside the openings when drawn).
 * - Both points on the same pillar: a band one third of the entry width wide runs along that pillar's rib from one
 *   point to the other, the shorter way round the pillar.
 *
 * The solver still sees an ordinary across element: `areaPlacement` gives the position, length along the opening
 * and whether the area reaches from rib to rib.
 */
import { cellRect, cellState, cellType, snap, type Geo, type Rect, type Topo } from './geometry';
import type { El } from './model';

export interface Pt {
  x: number;
  y: number;
}

/** A rib point: where on which solid block (pillar or unmined cell) it lies. */
export interface RibPoint extends Pt {
  /** Cell key "cx,cy" of the solid block. */
  block: string;
}

/** Solid blocks the ribs belong to: every pillar and every unmined cell. */
export function solidBlocks(g: Geo): { key: string; r: Rect }[] {
  const out: { key: string; r: Rect }[] = [];
  for (let cx = 0; cx <= 2 * g.E; cx++)
    for (let cy = 0; cy <= 2 * g.R - 1; cy++)
      if (cellType(g, cx, cy) === 'pillar' || cellState(g, cx, cy) === 'solid') out.push({ key: `${cx},${cy}`, r: cellRect(g, cx, cy) });
  return out;
}

/** The nearest point on a block's outline to (x, y). */
function nearestOnRect(r: Rect, x: number, y: number): Pt & { d: number } {
  const cx = Math.max(r.x, Math.min(r.x + r.w, x));
  const cy = Math.max(r.y, Math.min(r.y + r.h, y));
  const inside = x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
  if (!inside) return { x: cx, y: cy, d: Math.hypot(x - cx, y - cy) };
  // Inside the block: push out to the nearest side.
  const dl = x - r.x;
  const dr = r.x + r.w - x;
  const db = y - r.y;
  const dt = r.y + r.h - y;
  const m = Math.min(dl, dr, db, dt);
  if (m === dl) return { x: r.x, y, d: m };
  if (m === dr) return { x: r.x + r.w, y, d: m };
  if (m === db) return { x, y: r.y, d: m };
  return { x, y: r.y + r.h, d: m };
}

/** Snap a click to the nearest rib (side of a pillar or of unmined coal next to an opening). Null when none is near. */
export function snapRib(g: Geo, x: number, y: number): RibPoint | null {
  const W = g.layout.entryWidth;
  let best: RibPoint | null = null;
  let bd = Infinity;
  for (const b of solidBlocks(g)) {
    const p = nearestOnRect(b.r, x, y);
    if (p.d < bd) {
      bd = p.d;
      best = { x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2, block: b.key };
    }
  }
  return best && bd <= W * 0.75 ? best : null;
}

const blockRect = (g: Geo, key: string): Rect => {
  const [cx, cy] = key.split(',').map(Number);
  return cellRect(g, cx, cy);
};

/** Position along a rectangle's outline, counter-clockwise from the bottom-left corner (y up). */
function perimS(r: Rect, p: Pt): number {
  const e = 0.01;
  if (Math.abs(p.y - r.y) < e) return p.x - r.x;
  if (Math.abs(p.x - (r.x + r.w)) < e) return r.w + (p.y - r.y);
  if (Math.abs(p.y - (r.y + r.h)) < e) return r.w + r.h + (r.x + r.w - p.x);
  return 2 * r.w + r.h + (r.y + r.h - p.y);
}

/** Corners of the outline in order, each with the outward normals of the side before and after it. */
const corners = (r: Rect) => [
  { s: 0, p: { x: r.x, y: r.y }, n: { x: -1, y: -1 } },
  { s: r.w, p: { x: r.x + r.w, y: r.y }, n: { x: 1, y: -1 } },
  { s: r.w + r.h, p: { x: r.x + r.w, y: r.y + r.h }, n: { x: 1, y: 1 } },
  { s: 2 * r.w + r.h, p: { x: r.x, y: r.y + r.h }, n: { x: -1, y: 1 } }
];

/** Outward normal of the side at outline position s. */
function sideNormal(r: Rect, s: number): Pt {
  const P = 2 * (r.w + r.h);
  const t = ((s % P) + P) % P;
  if (t < r.w) return { x: 0, y: -1 };
  if (t < r.w + r.h) return { x: 1, y: 0 };
  if (t < 2 * r.w + r.h) return { x: 0, y: 1 };
  return { x: -1, y: 0 };
}

function pointAt(r: Rect, s: number): Pt {
  const P = 2 * (r.w + r.h);
  const t = ((s % P) + P) % P;
  if (t < r.w) return { x: r.x + t, y: r.y };
  if (t < r.w + r.h) return { x: r.x + r.w, y: r.y + (t - r.w) };
  if (t < 2 * r.w + r.h) return { x: r.x + r.w - (t - r.w - r.h), y: r.y + r.h };
  return { x: r.x, y: r.y + r.h - (t - 2 * r.w - r.h) };
}

/**
 * The band along one block's rib from a to b, the shorter way round, `t` feet wide (out into the opening).
 * Returns the polygon (feet, y up) and the band's length.
 */
export function ribBand(r: Rect, a: Pt, b: Pt, t: number): { poly: Pt[]; length: number } {
  const P = 2 * (r.w + r.h);
  let s0 = perimS(r, a);
  let d = (((perimS(r, b) - s0) % P) + P) % P;
  if (d > P / 2) {
    s0 = perimS(r, b);
    d = P - d;
  }
  const s1 = s0 + d;
  // Side normal just after the start and just before the end, so a point on a corner takes the side the band runs along.
  const n0 = sideNormal(r, s0 + 0.001);
  const n1 = sideNormal(r, s1 - 0.001);
  const inner: Pt[] = [pointAt(r, s0)];
  const outer: Pt[] = [{ x: inner[0].x + n0.x * t, y: inner[0].y + n0.y * t }];
  for (const lap of [0, P])
    for (const c of corners(r)) {
      const s = c.s + lap;
      if (s > s0 + 0.001 && s < s1 - 0.001) {
        inner.push(c.p);
        outer.push({ x: c.p.x + c.n.x * t, y: c.p.y + c.n.y * t });
      }
    }
  const end = pointAt(r, s1);
  inner.push(end);
  outer.push({ x: end.x + n1.x * t, y: end.y + n1.y * t });
  return { poly: [...inner, ...outer.reverse()], length: d };
}

/** The area two rib points mark, as a polygon in feet (y up). */
export function areaPolygon(g: Geo, a: RibPoint, b: RibPoint): Pt[] {
  const t = g.layout.entryWidth / 3;
  if (a.block === b.block) return ribBand(blockRect(g, a.block), a, b, t).poly;
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  // Facing ribs at the same height: give the area some depth along the opening.
  const ex = x1 - x0 < t ? (t - (x1 - x0)) / 2 : 0;
  const ey = y1 - y0 < t ? (t - (y1 - y0)) / 2 : 0;
  return [
    { x: x0 - ex, y: y0 - ey },
    { x: x1 + ex, y: y0 - ey },
    { x: x1 + ex, y: y1 + ey },
    { x: x0 - ex, y: y1 + ey }
  ];
}

/**
 * What the solver needs for an area: the placard position (in the opening, near the area's middle), its length
 * along the opening, and whether it reaches from rib to rib.
 */
export function areaPlacement(t: Topo, a: RibPoint, b: RibPoint): Pick<El, 'x' | 'y' | 'len' | 'across'> | null {
  const g = t.geo;
  const W = g.layout.entryWidth;
  const poly = areaPolygon(g, a, b);
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const bx0 = Math.min(...xs);
  const bx1 = Math.max(...xs);
  const by0 = Math.min(...ys);
  const by1 = Math.max(...ys);
  const s = snap(t, (bx0 + bx1) / 2, (by0 + by1) / 2, 'across');
  if (!s) return null;
  const alongY = s.rot === 0;
  if (a.block === b.block) return { x: s.x, y: s.y, len: Math.max(2, Math.round(ribBand(blockRect(g, a.block), a, b, W / 3).length)), across: false };
  const along = alongY ? by1 - by0 : bx1 - bx0;
  const span = alongY ? bx1 - bx0 : by1 - by0;
  return { x: s.x, y: s.y, len: Math.max(2, Math.round(along)), across: span >= W * 0.9 };
}
