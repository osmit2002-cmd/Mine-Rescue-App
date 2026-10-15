import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useData } from '../data/DataContext';
import type { Figure } from '../data/types';
import { applyAction, clampIndex, clampView, counterLabel, FIT, isDoubleTap, keyAction, MAX_ZOOM, swipeDirection, toggleZoom, zoomAt, type GalleryAction, type View } from '../lib/gallery';

type Pt = { x: number; y: number };
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * Fullscreen figure viewer in a native modal <dialog> (focus stays inside; Esc closes).
 * Pinch or wheel or +/- to zoom, double-tap/double-click to toggle zoom, drag to pan when zoomed,
 * swipe or arrows (buttons and keys) to move between figures. No library; works offline.
 */
export function Lightbox({ figures, index, onIndex, onClose }: { figures: Figure[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const { contentUrl } = useData();
  const dlg = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [view, setView] = useState<View>(FIT);
  const [dragX, setDragX] = useState(0);
  const [gesturing, setGesturing] = useState(false);
  const [broken, setBroken] = useState(false);
  const pts = useRef(new Map<number, Pt>());
  const g = useRef<{ x0: number; y0: number; t0: number; v0: View; dist0?: number; mid0?: Pt; multi: boolean } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const n = figures.length;
  const f = figures[clampIndex(index, n)];

  useEffect(() => {
    const d = dlg.current;
    if (d && !d.open) d.showModal();
    document.documentElement.classList.add('lb-open');
    const closed = () => onClose();
    d?.addEventListener('close', closed);
    return () => {
      d?.removeEventListener('close', closed);
      if (d?.open) d.close();
      document.documentElement.classList.remove('lb-open');
    };
  }, [onClose]);
  useEffect(() => {
    setView(FIT);
    setBroken(false);
  }, [index]);

  const sizes = () => {
    const r = stage.current?.getBoundingClientRect() ?? new DOMRect();
    return { rect: r, stage: { w: r.width, h: r.height }, img: { w: img.current?.offsetWidth ?? 0, h: img.current?.offsetHeight ?? 0 } };
  };
  const rel = (x: number, y: number) => {
    const { rect } = sizes();
    return { x: x - rect.left - rect.width / 2, y: y - rect.top - rect.height / 2 };
  };
  const zoomBy = (factor: number, px = 0, py = 0) => {
    const s = sizes();
    setView((v) => zoomAt(v, factor, px, py, s.stage, s.img));
  };
  const go = (i: number) => {
    const j = clampIndex(i, n);
    if (j !== index) onIndex(j);
  };
  const act = (a: GalleryAction) => {
    if (a === 'zoomIn') zoomBy(1.5);
    else if (a === 'zoomOut') zoomBy(1 / 1.5);
    else if (a === 'reset') setView(FIT);
    else go(applyAction(index, a, n));
  };

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const s = { w: r.width, h: r.height };
      const im = { w: img.current?.offsetWidth ?? 0, h: img.current?.offsetHeight ?? 0 };
      setView((v) => zoomAt(v, Math.exp(-e.deltaY * 0.0015), e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2, s, im));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const startGesture = (multi: boolean) => {
    const p = [...pts.current.values()];
    if (!p.length) return;
    g.current = { x0: p[0].x, y0: p[0].y, t0: performance.now(), v0: viewRef.current, multi, ...(p.length >= 2 ? { dist0: dist(p[0], p[1]), mid0: mid(p[0], p[1]) } : {}) };
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startGesture(pts.current.size > 1 || (g.current?.multi ?? false));
    setGesturing(true);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pts.current.has(e.pointerId) || !g.current) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = [...pts.current.values()];
    const s = sizes();
    const gg = g.current;
    if (p.length >= 2 && gg.dist0 && gg.mid0) {
      const m = mid(p[0], p[1]);
      const c0 = rel(gg.mid0.x, gg.mid0.y);
      const v = zoomAt(gg.v0, dist(p[0], p[1]) / gg.dist0, c0.x, c0.y, s.stage, s.img);
      setView(clampView({ ...v, x: v.x + m.x - gg.mid0.x, y: v.y + m.y - gg.mid0.y }, s.stage, s.img));
    } else if (gg.v0.scale > 1.01) {
      setView(clampView({ ...gg.v0, x: gg.v0.x + p[0].x - gg.x0, y: gg.v0.y + p[0].y - gg.y0 }, s.stage, s.img));
    } else if (!gg.multi && n > 1) {
      setDragX(p[0].x - gg.x0);
    }
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.delete(e.pointerId);
    if (pts.current.size > 0) return startGesture(true);
    const gg = g.current;
    g.current = null;
    setGesturing(false);
    setDragX(0);
    if (!gg || gg.multi || e.type !== 'pointerup') return;
    const dx = e.clientX - gg.x0;
    const dy = e.clientY - gg.y0;
    const now = performance.now();
    if (gg.v0.scale <= 1.01) {
      const dir = swipeDirection(dx, dy);
      if (dir) {
        lastTap.current = null;
        return go(index + dir);
      }
    }
    if (Math.hypot(dx, dy) < 10 && now - gg.t0 < 300) {
      if (isDoubleTap(lastTap.current, now, e.clientX, e.clientY)) {
        const c = rel(e.clientX, e.clientY);
        const s = sizes();
        setView((v) => toggleZoom(v, c.x, c.y, s.stage, s.img));
        lastTap.current = null;
      } else lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    }
  };

  if (!f) return null;
  return (
    <dialog
      ref={dlg}
      className="lightbox"
      aria-label={`${f.caption} (${counterLabel(index, n)})`}
      data-testid="lightbox"
      onKeyDown={(e) => {
        const a = keyAction(e.key, true);
        if (a && !(e.target as HTMLElement).matches('input, textarea')) {
          e.preventDefault();
          act(a);
        }
      }}
    >
      <div className="lb-bar">
        <span className="lb-counter" aria-live="polite" data-testid="lightbox-counter">
          {counterLabel(index, n)}
        </span>
        <span className="lb-tools">
          <button type="button" aria-label="Zoom out" onClick={() => act('zoomOut')} disabled={view.scale <= 1.01}>−</button>
          <button type="button" aria-label="Zoom in" onClick={() => act('zoomIn')} disabled={view.scale >= MAX_ZOOM} data-testid="zoom-in">+</button>
          <button type="button" aria-label="Fit to screen" onClick={() => act('reset')} disabled={view.scale <= 1.01}>Fit</button>
          <button type="button" aria-label="Close" onClick={() => dlg.current?.close()} data-testid="lightbox-close" autoFocus>×</button>
        </span>
      </div>
      <div className="lb-stage" ref={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} data-testid="lightbox-stage">
        {broken ? (
          <p className="lb-missing">Image not available.</p>
        ) : (
          <img
            ref={img}
            src={contentUrl(f.file)}
            alt={f.caption}
            draggable={false}
            onError={() => setBroken(true)}
            data-testid="lightbox-img"
            data-scale={view.scale.toFixed(2)}
            style={{ transform: `translate(${view.x + dragX}px, ${view.y}px) scale(${view.scale})`, transition: gesturing ? 'none' : undefined }}
          />
        )}
        {n > 1 && (
          <>
            <button type="button" className="lb-nav prev" aria-label="Previous figure" onClick={() => act('prev')} disabled={index <= 0}>‹</button>
            <button type="button" className="lb-nav next" aria-label="Next figure" onClick={() => act('next')} disabled={index >= n - 1}>›</button>
          </>
        )}
      </div>
      <p className="lb-caption">
        {f.caption}
        {f.printedPage !== undefined && <span className="lb-page"> · rule book p. {f.printedPage}</span>}
      </p>
    </dialog>
  );
}
