import { useCallback, useEffect, useRef, useState } from 'react';
import { useData } from '../data/DataContext';
import type { Figure } from '../data/types';
import { applyAction, clampIndex, counterLabel, indexFromScroll, keyAction } from '../lib/gallery';
import { Lightbox } from './Lightbox';

/**
 * A swipeable strip of a rule's cropped figures (CSS scroll-snap: one figure per swipe, no momentum
 * skipping), with prev/next buttons, Left/Right/Home/End keys when focused, a "1 of N" counter, caption
 * and page. Tap a figure for the fullscreen viewer. Images load lazily; alt text is the caption.
 */
export function FigureGallery({ figures, label }: { figures: Figure[]; label: string }) {
  const { contentUrl } = useData();
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [page, setPage] = useState<Figure | null>(null);
  const [broken, setBroken] = useState<Set<number>>(new Set());
  const n = figures.length;
  const cur = figures[clampIndex(index, n)];

  // While a button/key scroll animates, intermediate scroll positions must not move the counter back
  // (a quick second click would otherwise be lost). Any user scroll gesture cancels the target.
  const target = useRef<number | null>(null);
  const go = useCallback(
    (i: number, smooth = true) => {
      const j = clampIndex(i, n);
      setIndex(j);
      const el = track.current;
      if (!el) return;
      target.current = Math.abs(el.scrollLeft - j * el.clientWidth) > 1 ? j : null;
      // Safety net: never ignore scroll positions for long (e.g. an interrupted animation).
      if (target.current !== null)
        window.setTimeout(() => {
          if (target.current !== j) return;
          target.current = null;
          if (track.current) setIndex(indexFromScroll(track.current.scrollLeft, track.current.clientWidth, n));
        }, 1500);
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollTo({ left: j * el.clientWidth, behavior: smooth && !reduce ? 'smooth' : 'auto' });
    },
    [n]
  );
  // Keep the visible slide in place when the strip changes width (e.g. phone rotation).
  const indexRef = useRef(index);
  indexRef.current = index;
  useEffect(() => {
    const el = track.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      el.scrollTo({ left: indexRef.current * width });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const t = target.current;
    if (t !== null) {
      if (Math.abs(el.scrollLeft - t * el.clientWidth) > 1) return;
      target.current = null;
    }
    setIndex(indexFromScroll(el.scrollLeft, el.clientWidth, n));
  };
  const userScroll = () => {
    target.current = null;
  };
  const closeViewer = useCallback(() => setOpen(null), []);
  const closePage = useCallback(() => setPage(null), []);
  if (!n || !cur) return null;

  return (
    <section
      className="gallery"
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      data-testid="gallery"
      onKeyDown={(e) => {
        const a = keyAction(e.key);
        if (!a || open !== null || page) return;
        e.preventDefault();
        go(applyAction(index, a, n));
      }}
    >
      <div className="gallery-viewport">
        <div className="gallery-track" ref={track} onScroll={onScroll} onPointerDown={userScroll} onTouchStart={userScroll} onWheel={userScroll} data-testid="gallery-track">
          {figures.map((f, i) => (
            <div className="gallery-slide" key={f.id ?? f.file} role="group" aria-roledescription="slide" aria-label={counterLabel(i, n)}>
              {broken.has(i) ? (
                <p className="gallery-missing">Image not available: {f.caption}</p>
              ) : (
                <button type="button" className="gallery-open" onClick={() => setOpen(i)} aria-label={`Open full screen: ${f.caption}`} tabIndex={i === index ? 0 : -1}>
                  <img src={contentUrl(f.file)} alt={f.caption} loading="lazy" decoding="async" draggable={false} onError={() => setBroken((b) => new Set(b).add(i))} />
                </button>
              )}
            </div>
          ))}
        </div>
        {n > 1 && (
          <>
            <button type="button" className="gallery-nav prev" aria-label="Previous figure" onClick={() => go(index - 1)} disabled={index <= 0} data-testid="gallery-prev">‹</button>
            <button type="button" className="gallery-nav next" aria-label="Next figure" onClick={() => go(index + 1)} disabled={index >= n - 1} data-testid="gallery-next">›</button>
          </>
        )}
      </div>
      <div className="gallery-meta">
        <span className="gallery-counter" aria-live="polite" data-testid="gallery-counter">{counterLabel(index, n)}</span>
        <span className="gallery-caption" data-testid="gallery-caption">
          {cur.caption}
          {cur.printedPage !== undefined && <span className="muted"> · rule book p. {cur.printedPage}</span>}
        </span>
        {cur.fullPage && (
          <button
            type="button"
            className="link-button gallery-fullpage"
            data-testid="view-full-page"
            onClick={() => setPage({ file: cur.fullPage!, caption: `Full page${cur.printedPage !== undefined ? ` — rule book p. ${cur.printedPage}` : ''}: ${cur.caption}`, labels: '', printedPage: cur.printedPage })}
          >
            View full page
          </button>
        )}
      </div>
      {n > 1 && n <= 12 && (
        <div className="gallery-dots" aria-hidden="true">
          {figures.map((f, i) => (
            <button type="button" key={f.id ?? f.file} tabIndex={-1} className={i === index ? 'on' : ''} onClick={() => go(i)} />
          ))}
        </div>
      )}
      {page && <Lightbox figures={[page]} index={0} onIndex={() => {}} onClose={closePage} />}
      {open !== null && (
        <Lightbox
          figures={figures}
          index={open}
          onIndex={(i) => {
            setOpen(i);
            go(i, false);
          }}
          onClose={closeViewer}
        />
      )}
    </section>
  );
}
