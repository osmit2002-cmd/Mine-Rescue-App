/**
 * Label picker for an X placard, shown next to the placard right after it is placed (or from its options ring).
 * Labels are grouped as equipment, ignition source and object. Typing jumps to and completes the closest label;
 * a label is applied only when it is clicked.
 */
import { useEffect, useRef, useState } from 'react';
import { X_CATEGORIES, X_LABELS, xAutocomplete, type XCategory, type XLabel } from '../catalog';

interface Props {
  /** Placard centre, in pixels within the map stage. */
  x: number;
  y: number;
  width: number;
  height: number;
  current?: string;
  /** Which placard: equipment, ignition source, or custom (objects plus own wording). */
  cat: XCategory;
  onPick: (l: XLabel) => void;
  /** Use the typed words as the label (not in the list). */
  onCustom: (text: string) => void;
  onClose: () => void;
}

const W = 250;
const H = 300;

export function XLabelPicker({ x, y, width, height, current, cat, onPick, onCustom, onClose }: Props) {
  const [typed, setTyped] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const labels = X_LABELS.filter((l) => l.cat === cat);
  const match = xAutocomplete(typed, labels);
  const custom = cat === 'object';

  useEffect(() => {
    box.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (match) listRef.current?.querySelector<HTMLElement>(`[data-label="${CSS.escape(match.text)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [match]);

  // Beside the placard (right, or left when there is no room), kept inside the map stage.
  const left = x + 18 + W <= width ? x + 18 : Math.max(4, x - 18 - W);
  const top = Math.min(Math.max(4, y - 40), Math.max(4, height - H - 4));

  const onKey = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (typed) setTyped('');
      else onClose();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      setTyped((t) => t.slice(0, -1));
    } else if (e.key.length === 1 && /[\w\s\-./&#]/.test(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      setTyped((t) => (t + e.key).slice(0, 60).replace(/^\s+/, ''));
    } else if (e.key === 'Delete' || e.key.startsWith('Arrow')) e.stopPropagation();
  };

  const up = typed.toUpperCase();
  const rest = match && match.text.startsWith(up.trim()) ? match.text.slice(up.trim().length) : '';

  return (
    <div
      ref={box}
      className="xpick"
      style={{ left, top, width: W, maxHeight: H }}
      tabIndex={-1}
      role="dialog"
      aria-label="Placard label"
      onKeyDown={onKey}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="xpick-typed" aria-live="polite">
        {typed ? (
          <>
            <span className="xpick-in">{up}</span>
            <span className="xpick-rest">{rest}</span>
          </>
        ) : (
          <span className="muted">{custom ? 'Type the wording, or pick a common object' : 'Type to jump to a label · click to choose'}</span>
        )}
      </div>
      <div className="xpick-list" ref={listRef}>
        {X_CATEGORIES.filter((c) => c.id === cat).map((c) => (
          <div key={c.id} className="xpick-group">
            <div className="xpick-cat">{c.name}</div>
            {labels.map((l) => (
              <button
                key={l.text}
                type="button"
                data-label={l.text}
                className={`xpick-item${match === l ? ' hi' : ''}${current === l.text ? ' cur' : ''}`}
                onClick={() => onPick(l)}
              >
                {l.text}
              </button>
            ))}
          </div>
        ))}
      </div>
      {typed.trim() && !(match && match.text === up.trim()) && (
        <button type="button" className="xpick-custom" onClick={() => onCustom(up.trim())}>
          Use “{up.trim()}”
        </button>
      )}
    </div>
  );
}
