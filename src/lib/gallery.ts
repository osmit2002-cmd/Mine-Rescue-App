/** Pure navigation and zoom logic for the figure gallery and its fullscreen viewer (unit tested). */

export const clampIndex = (i: number, n: number) => (n <= 0 ? 0 : Math.min(n - 1, Math.max(0, Math.round(i))));

/** Next/previous without wrapping (the ends are visible: arrows disable at the first and last figure). */
export const stepIndex = (i: number, delta: number, n: number) => clampIndex(i + delta, n);

/** Which slide a scroll-snap track is showing. */
export function indexFromScroll(scrollLeft: number, slideWidth: number, n: number): number {
  if (!(slideWidth > 0)) return 0;
  return clampIndex(scrollLeft / slideWidth, n);
}

export const counterLabel = (i: number, n: number) => `${clampIndex(i, n) + 1} of ${n}`;

export type GalleryAction = 'prev' | 'next' | 'first' | 'last' | 'zoomIn' | 'zoomOut' | 'reset';

/** Keyboard shortcuts. The strip uses the navigation keys; the fullscreen viewer also uses the zoom keys. */
export function keyAction(key: string, zoomKeys = false): GalleryAction | null {
  switch (key) {
    case 'ArrowLeft':
      return 'prev';
    case 'ArrowRight':
      return 'next';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
  }
  if (!zoomKeys) return null;
  if (key === '+' || key === '=') return 'zoomIn';
  if (key === '-' || key === '_') return 'zoomOut';
  if (key === '0') return 'reset';
  return null;
}

export function applyAction(i: number, a: GalleryAction | null, n: number): number {
  if (a === 'prev') return stepIndex(i, -1, n);
  if (a === 'next') return stepIndex(i, 1, n);
  if (a === 'first') return 0;
  if (a === 'last') return clampIndex(n - 1, n);
  return i;
}

/** A finished one-finger drag: +1 = next (swiped left), -1 = previous, 0 = not a swipe (too short or too vertical). */
export function swipeDirection(dx: number, dy: number, threshold = 50): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}

/** Image transform in the viewer: translate(x, y) scale(scale), origin at the stage centre. */
export interface View {
  scale: number;
  x: number;
  y: number;
}
export interface Size {
  w: number;
  h: number;
}
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;
export const FIT: View = { scale: 1, x: 0, y: 0 };

/** Keeps the zoomed image covering the stage (no panning past its edges); at scale 1 it is centred. */
export function clampView(v: View, stage: Size, img: Size): View {
  const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.scale));
  const maxX = Math.max(0, (img.w * scale - stage.w) / 2);
  const maxY = Math.max(0, (img.h * scale - stage.h) / 2);
  // `|| 0` turns -0 into 0.
  return { scale, x: Math.min(maxX, Math.max(-maxX, v.x)) || 0, y: Math.min(maxY, Math.max(-maxY, v.y)) || 0 };
}

/** Zoom by `factor` keeping the point (px, py) — relative to the stage centre — fixed on screen. */
export function zoomAt(v: View, factor: number, px: number, py: number, stage: Size, img: Size): View {
  const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.scale * factor));
  const k = scale / v.scale;
  return clampView({ scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k }, stage, img);
}

/** Double tap: zoom in to 2.5x at the tapped point, or back to fit when already zoomed. */
export function toggleZoom(v: View, px: number, py: number, stage: Size, img: Size): View {
  return v.scale > 1.01 ? FIT : zoomAt(v, 2.5 / v.scale, px, py, stage, img);
}

export function isDoubleTap(prev: { t: number; x: number; y: number } | null, t: number, x: number, y: number): boolean {
  return !!prev && t - prev.t < 320 && Math.hypot(x - prev.x, y - prev.y) < 30;
}
