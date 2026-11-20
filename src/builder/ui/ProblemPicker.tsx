/**
 * Stored problems drop-down: one line per problem, newest first, with a search box at the top. A folder icon marks
 * problems that have a file in the linked problems folder.
 * Arrow keys move through the list, Enter opens the highlighted problem, Esc closes.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Problem } from '../model';

/** Problems whose title or source contain every typed word (any order, any case), most recently edited first. */
export function filterProblems(list: Problem[], query: string): Problem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return list
    .filter((p) => {
      const hay = `${p.title} ${p.source ?? ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => (Date.parse(b.updated) || 0) - (Date.parse(a.updated) || 0));
}

const shortDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
};

interface Props {
  problems: Problem[];
  currentId: string;
  /** Problem ids that have a file in the linked problems folder. */
  saved: Set<string>;
  onOpen: (id: string) => void;
}

export function ProblemPicker({ problems, currentId, saved, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const current = problems.find((p) => p.id === currentId);
  const shown = useMemo(() => filterProblems(problems, query), [problems, query]);

  useEffect(() => {
    if (!open) return;
    setHi(Math.max(0, shown.findIndex((p) => p.id === currentId)));
    setTimeout(() => input.current?.focus(), 0);
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [hi]);

  const pick = (id: string) => {
    onOpen(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="prob-picker" ref={box}>
      <button type="button" className="prob-picker-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} data-testid="problem-select" title="Stored problems">
        <span className="prob-picker-title">{current?.title ?? 'Problems'}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="prob-pop" role="dialog" aria-label="Stored problems">
          <input
            ref={input}
            type="search"
            className="prob-search"
            placeholder={`Search ${problems.length} problem${problems.length === 1 ? '' : 's'}…`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHi(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHi((h) => Math.min(shown.length - 1, h + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHi((h) => Math.max(0, h - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (shown[hi]) pick(shown[hi].id);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
              }
            }}
            aria-label="Search problems"
          />
          <ul className="prob-list" role="listbox" ref={listRef}>
            {shown.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={p.id === currentId}
                  data-i={i}
                  className={`prob-row${i === hi ? ' hi' : ''}${p.id === currentId ? ' cur' : ''}`}
                  onMouseEnter={() => setHi(i)}
                  onClick={() => pick(p.id)}
                  title={p.source ? `${p.title} — ${p.source}` : p.title}
                >
                  <span className="prob-row-title">{p.title}</span>
                  {saved.has(p.id) && (
                    <span className="prob-row-drive" title="Saved in the problems folder" aria-label="Saved in folder">
                      📁
                    </span>
                  )}
                  <span className="prob-row-date">{shortDate(p.updated)}</span>
                </button>
              </li>
            ))}
            {!shown.length && <li className="prob-empty small muted">No problem matches “{query}”.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
