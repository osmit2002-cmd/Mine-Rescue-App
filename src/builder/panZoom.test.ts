import { describe, expect, it } from 'vitest';
import { anchoredScroll, clampZoom, MAX_ZOOM, MIN_ZOOM, wheelFactor } from './ui/panZoom';

describe('map pan and zoom', () => {
  it('wheel up zooms in, wheel down zooms out, and one notch feels the same in any delta mode', () => {
    expect(wheelFactor(-100)).toBeGreaterThan(1);
    expect(wheelFactor(100)).toBeLessThan(1);
    expect(wheelFactor(-3, 1)).toBeCloseTo(wheelFactor(-48), 6);
    expect(wheelFactor(-100000)).toBeCloseTo(wheelFactor(-200), 6);
  });
  it('clamps the zoom', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    expect(clampZoom(1000)).toBe(MAX_ZOOM);
    expect(clampZoom(3)).toBe(3);
  });
  it('keeps the point under the pointer in place', () => {
    // Stage 1000 px wide at screen x 100 (scrollLeft 50); pointer at x 600 is at fraction 0.5.
    const a = { fx: 0.5, fy: 0.25, cx: 600, cy: 300 };
    // After zooming to 2000 px wide (stage still at x 100) that point is at x 1100.
    const s = anchoredScroll({ left: 100, top: 50, width: 2000, height: 800 }, { left: 50, top: 0 }, a);
    // Scrolling by (1100 - 600) more puts that point back under the pointer.
    expect(s.left).toBe(550);
    expect(s.top).toBe(-50);
  });
});
