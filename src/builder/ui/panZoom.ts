import { useCallback, useEffect, useLayoutEffect, useRef, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type RefObject } from 'react';

export const MIN_ZOOM = 0.6;
export const MAX_ZOOM = 16;
/** A mouse drag shorter than this (px) is still a click. */
export const PAN_SLOP = 4;

export const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

/** Zoom factor for one wheel event: pixel, line and page deltas all feel about the same. */
export function wheelFactor(deltaY: number, deltaMode = 0): number {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return Math.exp(-Math.max(-200, Math.min(200, px)) * 0.0015);
}

/**
 * Scroll offset that puts the point at fraction (fx, fy) of the stage back under the screen point
 * (cx, cy), given where the stage now sits on screen and the scroller's current scroll.
 */
export function anchoredScroll(
  stage: { left: number; top: number; width: number; height: number },
  scroll: { left: number; top: number },
  a: { fx: number; fy: number; cx: number; cy: number }
) {
  return { left: scroll.left + stage.left + a.fx * stage.width - a.cx, top: scroll.top + stage.top + a.fy * stage.height - a.cy };
}

type Anchor = { fx: number; fy: number; cx: number; cy: number };

/**
 * Scroll-wheel zoom (about the pointer), mouse drag to pan, and two-finger pinch on touch screens,
 * for a scrolling box (`scroller`) holding a stage element (`.map-stage`) sized by `zoom`.
 * One-finger touch drag keeps the browser's own scrolling.
 */
export function usePanZoom(scroller: RefObject<HTMLDivElement>, zoom: number, setZoom: (z: number) => void) {
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const pending = useRef<Anchor | 'center' | null>(null);
  const panned = useRef(false);

  const stageEl = () => scroller.current?.querySelector<HTMLElement>(':scope > .map-stage') ?? null;

  const applyAnchor = useCallback(() => {
    const sc = scroller.current;
    const st = stageEl();
    const a = pending.current;
    pending.current = null;
    if (!sc || !st || !a) return;
    if (a === 'center') {
      sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2;
      sc.scrollTop = (sc.scrollHeight - sc.clientHeight) / 2;
      return;
    }
    const s = anchoredScroll(st.getBoundingClientRect(), { left: sc.scrollLeft, top: sc.scrollTop }, a);
    sc.scrollLeft = s.left;
    sc.scrollTop = s.top;
  }, []);

  useLayoutEffect(applyAnchor, [zoom, applyAnchor]);

  /** Where (as a fraction of the stage) the screen point (cx, cy) falls. */
  const anchorAt = (cx: number, cy: number): Anchor | null => {
    const st = stageEl();
    if (!st) return null;
    const r = st.getBoundingClientRect();
    return { fx: r.width ? (cx - r.left) / r.width : 0.5, fy: r.height ? (cy - r.top) / r.height : 0.5, cx, cy };
  };
  const viewCenter = () => {
    const r = scroller.current?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 };
  };

  /** Set the zoom, keeping anchor `a` fixed on screen. */
  const zoomTo = useCallback(
    (z: number, a: Anchor | null) => {
      const next = clampZoom(z);
      pending.current = a;
      if (Math.abs(next - zoomRef.current) < 1e-6) applyAnchor();
      else {
        zoomRef.current = next;
        setZoom(next);
      }
    },
    [setZoom, applyAnchor]
  );

  /** Zoom by `factor` about a screen point (default: the middle of the view). */
  const zoomBy = (factor: number, cx?: number, cy?: number) => {
    const c = cx === undefined || cy === undefined ? viewCenter() : { x: cx, y: cy };
    zoomTo(zoomRef.current * factor, anchorAt(c.x, c.y));
  };

  /** Set the zoom and center the map in the view (Fit). */
  const zoomCentered = (z: number) => {
    pending.current = 'center';
    if (Math.abs(z - zoomRef.current) < 1e-6) applyAnchor();
    else {
      zoomRef.current = z;
      setZoom(z);
    }
  };

  // Wheel zoom and two-finger pinch need non-passive native listeners (to stop page scroll / page zoom).
  useEffect(() => {
    const sc = scroller.current;
    if (!sc) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.deltaY) return;
      // Let pop-ups on the map (the X label list) scroll themselves.
      if ((e.target as Element | null)?.closest?.('.xpick')) return;
      e.preventDefault();
      const a = anchorAt(e.clientX, e.clientY);
      zoomTo(zoomRef.current * wheelFactor(e.deltaY, e.deltaMode), a);
    };
    let pinch: { d0: number; z0: number; a: Anchor } | null = null;
    const mid = (t: TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const m = mid(e.touches);
      const a = anchorAt(m.x, m.y);
      if (a) pinch = { d0: dist(e.touches), z0: zoomRef.current, a };
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const m = mid(e.touches);
      zoomTo(pinch.z0 * (dist(e.touches) / pinch.d0), { fx: pinch.a.fx, fy: pinch.a.fy, cx: m.x, cy: m.y });
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };
    sc.addEventListener('wheel', onWheel, { passive: false });
    sc.addEventListener('touchstart', onTouchStart, { passive: true });
    sc.addEventListener('touchmove', onTouchMove, { passive: false });
    sc.addEventListener('touchend', onTouchEnd);
    sc.addEventListener('touchcancel', onTouchEnd);
    return () => {
      sc.removeEventListener('wheel', onWheel);
      sc.removeEventListener('touchstart', onTouchStart);
      sc.removeEventListener('touchmove', onTouchMove);
      sc.removeEventListener('touchend', onTouchEnd);
      sc.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [scroller, zoomTo]);

  /**
   * Mouse/pen drag on the map background pans. Map items, side-room grips and the option rings stop
   * the pointerdown themselves (or are skipped here), so their own drags and taps keep working.
   * A drag that moved suppresses the click that follows, so it does not place or deselect.
   */
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || (e.button !== 0 && e.button !== 1)) return;
    const t = e.target as Element;
    if (t.closest('.radial, .xpick, button, input, select, textarea, a, .room-grip, .map-el')) return;
    const sc = scroller.current;
    if (!sc) return;
    if (e.button === 1) e.preventDefault(); // no autoscroll
    const x0 = e.clientX;
    const y0 = e.clientY;
    const l0 = sc.scrollLeft;
    const t0 = sc.scrollTop;
    let moving = false;
    panned.current = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (!moving && Math.hypot(dx, dy) < PAN_SLOP) return;
      if (!moving) {
        moving = true;
        sc.classList.add('panning');
      }
      sc.scrollLeft = l0 - dx;
      sc.scrollTop = t0 - dy;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      sc.classList.remove('panning');
      panned.current = moving;
      // A click (if any) is dispatched right after pointerup; forget the drag once it has passed.
      if (moving) setTimeout(() => (panned.current = false), 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  const onClickCapture = (e: RMouseEvent) => {
    if (panned.current) {
      panned.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return { zoomBy, zoomCentered, handlers: { onPointerDown, onClickCapture } };
}
