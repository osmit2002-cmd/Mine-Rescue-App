import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

/** A labeled single-choice menu. The chevron is drawn in CSS on every select. */
export function SelectField({
  label,
  value,
  onChange,
  options,
  testId
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  testId?: string;
}) {
  const id = useId();
  return (
    <div className="select-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} aria-label={label} data-testid={testId} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Chevron() {
  return (
    <svg className="select-chevron" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Several choices that can be combined, bundled into one menu.
 * An empty selection means every option (shown as "All"), matching the chip rows this replaces.
 */
export function MultiMenu({
  label,
  options,
  selected,
  onChange
}: {
  label: string;
  options: SelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const panel = ref.current?.querySelector('.menu-panel');
    if (panel) {
      const nav = document.querySelector('.nav');
      const navTop = nav && getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect().top : window.innerHeight;
      const bottom = panel.getBoundingClientRect().bottom;
      if (bottom > navTop - 8) window.scrollBy(0, bottom - (navTop - 8));
    }
    const current = ref.current?.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]') ?? ref.current?.querySelector<HTMLButtonElement>('[role="option"]');
    current?.focus();
  }, [open]);

  const summary =
    selected.length === 0 ? 'All' : selected.length === 1 ? options.find((o) => o.value === selected[0])?.label ?? '1 selected' : `${selected.length} selected`;
  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  const onListKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]')];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[Math.min(items.length - 1, Math.max(0, i) + 1)]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[Math.max(0, i - 1)]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  return (
    <div className="select-field" ref={ref}>
      <span id={id}>{label}</span>
      <button type="button" className="menu-button" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${summary}`} onClick={() => setOpen((v) => !v)}>
        <span>{summary}</span>
        <Chevron />
      </button>
      {open && (
        <div className="menu-panel" role="listbox" aria-multiselectable="true" aria-labelledby={id} onKeyDown={onListKey}>
          <button type="button" role="option" aria-selected={selected.length === 0} className={selected.length === 0 ? 'on' : ''} onClick={() => onChange([])}>
            All
          </button>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={selected.includes(o.value)}
              className={selected.includes(o.value) ? 'on' : ''}
              onClick={() => toggle(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
