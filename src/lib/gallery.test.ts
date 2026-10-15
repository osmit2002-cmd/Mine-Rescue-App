import { describe, expect, it } from 'vitest';
import { applyAction, clampIndex, clampView, counterLabel, FIT, indexFromScroll, isDoubleTap, keyAction, MAX_ZOOM, stepIndex, swipeDirection, toggleZoom, zoomAt } from './gallery';

const stage = { w: 400, h: 600 };
const img = { w: 400, h: 300 };

describe('gallery navigation', () => {
  it('steps without wrapping and clamps', () => {
    expect(stepIndex(0, -1, 3)).toBe(0);
    expect(stepIndex(0, 1, 3)).toBe(1);
    expect(stepIndex(2, 1, 3)).toBe(2);
    expect(clampIndex(7, 0)).toBe(0);
    expect(clampIndex(-3, 4)).toBe(0);
  });
  it('maps keys to actions; zoom keys only in the fullscreen viewer', () => {
    expect(keyAction('ArrowRight')).toBe('next');
    expect(keyAction('ArrowLeft')).toBe('prev');
    expect(keyAction('Home')).toBe('first');
    expect(keyAction('End')).toBe('last');
    expect(keyAction('+')).toBeNull();
    expect(keyAction('+', true)).toBe('zoomIn');
    expect(keyAction('-', true)).toBe('zoomOut');
    expect(keyAction('0', true)).toBe('reset');
    expect(keyAction('a', true)).toBeNull();
    expect(applyAction(1, 'next', 3)).toBe(2);
    expect(applyAction(1, 'first', 3)).toBe(0);
    expect(applyAction(0, 'last', 3)).toBe(2);
    expect(applyAction(1, 'zoomIn', 3)).toBe(1);
  });
  it('reads the slide from the scroll position and labels the counter', () => {
    expect(indexFromScroll(0, 300, 3)).toBe(0);
    expect(indexFromScroll(160, 300, 3)).toBe(1); // past halfway snaps to the next
    expect(indexFromScroll(5000, 300, 3)).toBe(2);
    expect(indexFromScroll(100, 0, 3)).toBe(0);
    expect(counterLabel(0, 3)).toBe('1 of 3');
    expect(counterLabel(9, 3)).toBe('3 of 3');
  });
  it('recognises swipes: long enough and mostly horizontal', () => {
    expect(swipeDirection(-80, 10)).toBe(1);
    expect(swipeDirection(80, -5)).toBe(-1);
    expect(swipeDirection(30, 0)).toBe(0);
    expect(swipeDirection(-80, 70)).toBe(0);
  });
  it('detects a double tap only when quick and close', () => {
    expect(isDoubleTap(null, 100, 0, 0)).toBe(false);
    expect(isDoubleTap({ t: 0, x: 10, y: 10 }, 200, 15, 12)).toBe(true);
    expect(isDoubleTap({ t: 0, x: 10, y: 10 }, 500, 10, 10)).toBe(false);
    expect(isDoubleTap({ t: 0, x: 10, y: 10 }, 200, 90, 10)).toBe(false);
  });
});

describe('fullscreen zoom and pan', () => {
  it('zooms about a point and keeps it fixed on screen', () => {
    const tall = { w: 400, h: 500 };
    const v = zoomAt(FIT, 2, 100, 50, stage, tall);
    expect(v.scale).toBe(2);
    // the content point under (100, 50) before zoom stays under it: (p - x) / scale is unchanged
    expect((100 - v.x) / v.scale).toBeCloseTo(100);
    expect((50 - v.y) / v.scale).toBeCloseTo(50);
  });
  it('limits zoom to [1, MAX] and never pans past the image edges', () => {
    expect(zoomAt(FIT, 0.2, 0, 0, stage, img)).toEqual(FIT);
    expect(zoomAt(FIT, 100, 0, 0, stage, img).scale).toBe(MAX_ZOOM);
    const v = clampView({ scale: 2, x: 5000, y: -5000 }, stage, img);
    expect(v.x).toBe((400 * 2 - 400) / 2);
    expect(v.y).toBe(0); // 300 * 2 = 600 = stage height: no vertical room
    expect(clampView({ scale: 1, x: 30, y: 30 }, stage, img)).toEqual(FIT);
  });
  it('double tap toggles between fit and 2.5x', () => {
    const z = toggleZoom(FIT, 0, 0, stage, img);
    expect(z.scale).toBeCloseTo(2.5);
    expect(toggleZoom(z, 0, 0, stage, img)).toEqual(FIT);
  });
});
