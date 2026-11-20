import { describe, expect, it } from 'vitest';
import { buildTopo, cellRect, makeGeo } from './geometry';
import { blankLayout, normalizeElement } from './model';
import { areaOutline, areaPlacement, closedArea, sideOf, snapLinePoint, unknownBand } from './roofArea';

const geo = makeGeo(blankLayout());
const topo = buildTopo(geo);
const W = geo.layout.entryWidth;
// Pillars either side of No. 2 Entry, between the FAB and crosscut 1.
const left = cellRect(geo, 2, 1);
const right = cellRect(geo, 4, 1);
const xl = left.x + left.w; // left rib of No. 2 Entry
const xr = right.x; // right rib
const y0 = left.y;

describe('unsafe roof and caved drawn as lines', () => {
  it('snaps a line end near a rib onto it, and keeps a click in the middle of the entry where it is', () => {
    expect(snapLinePoint(topo, xl + 2, y0 + 20)).toEqual({ x: xl, y: y0 + 20 });
    expect(snapLinePoint(topo, xl + W / 2, y0 + 20)).toEqual({ x: xl + W / 2, y: y0 + 20 });
  });

  it('a diagonal front line: the chosen side shows as unknown extent until the back end is placed', () => {
    const front = { a: { x: xl, y: y0 + 10 }, b: { x: xr, y: y0 + 20 } };
    const inby = { x: xl + 10, y: y0 + 40 };
    const side = sideOf(front, inby);
    const band = unknownBand(front, side, W);
    expect(band.slice(0, 2)).toEqual([front.a, front.b]);
    // The band lies on the inby side of the line.
    expect(sideOf(front, band[2])).toBe(side);
    expect(areaOutline({ edges: [front], side }, W)).toMatchObject({ closed: false });
    expect(areaOutline({ edges: [front] }, W)).toBeNull();
  });

  it('the back end closes the area between the two lines, without a crossed outline', () => {
    const front = { a: { x: xl, y: y0 + 10 }, b: { x: xr, y: y0 + 20 } };
    const back = { a: { x: xr, y: y0 + 45 }, b: { x: xl, y: y0 + 40 } };
    expect(closedArea(front, back)).toEqual([front.a, front.b, back.a, back.b]);
    expect(closedArea(front, { a: back.b, b: back.a })).toEqual([front.a, front.b, back.a, back.b]);
    const o = areaOutline({ edges: [front, back], side: 1 }, W)!;
    expect(o.closed).toBe(true);
    const at = areaPlacement(topo, { edges: [front, back], side: 1 })!;
    expect(at.across).toBe(true);
    expect(at.len).toBe(35);
    expect(at.x).toBe(xl + W / 2);
  });

  it('with only the front line the solver takes a third of the entry width on the chosen side', () => {
    const front = { a: { x: xl, y: y0 + 30 }, b: { x: xr, y: y0 + 30 } };
    const at = areaPlacement(topo, { edges: [front], side: 1 })!;
    expect(at.across).toBe(true);
    expect(at.len).toBe(Math.round(W / 3));
  });

  it('keeps the lines and side through save and load', () => {
    const el = normalizeElement({ id: 'u', kind: 'unsafe-roof', x: 1, y: 2, side: -1, edges: [{ a: { x: 1, y: 2 }, b: { x: 3, y: 4 } }] });
    expect(el?.edges).toHaveLength(1);
    expect(el?.side).toBe(-1);
    expect(normalizeElement({ id: 'u', kind: 'caved', x: 1, y: 2, edges: [{ a: { x: 1 }, b: { x: 3, y: 4 } }] })?.edges).toBeUndefined();
  });
});
