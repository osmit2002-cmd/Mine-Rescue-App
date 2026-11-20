import { describe, expect, it } from 'vitest';
import { buildTopo, cellRect, makeGeo } from './geometry';
import { blankLayout, normalizeElement } from './model';
import { areaPlacement, areaPolygon, ribBand, snapRib } from './roofArea';

const geo = makeGeo(blankLayout());
const topo = buildTopo(geo);
const W = geo.layout.entryWidth;
// Pillars either side of No. 2 Entry, between the FAB and crosscut 1.
const left = cellRect(geo, 2, 1);
const right = cellRect(geo, 4, 1);

describe('unsafe roof and caved drawn from rib points', () => {
  it('snaps a click near a pillar side onto that rib', () => {
    const p = snapRib(geo, left.x + left.w + 2, left.y + 20)!;
    expect(p).toMatchObject({ x: left.x + left.w, y: left.y + 20, block: '2,1' });
    expect(snapRib(geo, left.x + left.w + W / 2, left.y + 20)).not.toBeNull();
  });

  it('two different pillars: the area stretches from one point to the other and reaches rib to rib', () => {
    const a = { x: left.x + left.w, y: left.y + 10, block: '2,1' };
    const b = { x: right.x, y: left.y + 40, block: '4,1' };
    const poly = areaPolygon(geo, a, b);
    expect(poly).toEqual([
      { x: a.x, y: a.y },
      { x: b.x, y: a.y },
      { x: b.x, y: b.y },
      { x: a.x, y: b.y }
    ]);
    const at = areaPlacement(topo, a, b)!;
    expect(at.across).toBe(true);
    expect(at.len).toBe(30);
    expect(at.x).toBe(a.x + W / 2);
  });

  it('facing points at the same height still give an area a third of the entry deep', () => {
    const a = { x: left.x + left.w, y: left.y + 30, block: '2,1' };
    const b = { x: right.x, y: left.y + 30, block: '4,1' };
    const ys = areaPolygon(geo, a, b).map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(W / 3);
  });

  it('same pillar: a band W/3 wide along the rib, the short way round the corner', () => {
    // From the right side, round the top-right corner, onto the top.
    const a = { x: left.x + left.w, y: left.y + left.h - 10 };
    const b = { x: left.x + left.w - 15, y: left.y + left.h };
    const band = ribBand(left, a, b, W / 3);
    expect(band.length).toBe(25);
    expect(band.poly).toContainEqual({ x: left.x + left.w, y: left.y + left.h });
    expect(band.poly).toContainEqual({ x: left.x + left.w + W / 3, y: left.y + left.h + W / 3 });
    const at = areaPlacement(topo, { ...a, block: '2,1' }, { ...b, block: '2,1' })!;
    expect(at.across).toBe(false);
    expect(at.len).toBe(25);
  });

  it('goes the short way when the long way would wrap the whole pillar', () => {
    const a = { x: left.x + 5, y: left.y };
    const b = { x: left.x, y: left.y + 5 };
    expect(ribBand(left, a, b, 2).length).toBe(10);
  });

  it('keeps the rib points through save and load', () => {
    const el = normalizeElement({ id: 'u', kind: 'unsafe-roof', x: 1, y: 2, ribs: [{ x: 1, y: 2, block: '2,1' }, { x: 3, y: 4, block: '4,1' }] });
    expect(el?.ribs).toHaveLength(2);
    expect(normalizeElement({ id: 'u', kind: 'caved', x: 1, y: 2, ribs: [{ x: 1, y: 2, block: 'bad' }, { x: 3, y: 4, block: '4,1' }] })?.ribs).toBeUndefined();
  });
});
