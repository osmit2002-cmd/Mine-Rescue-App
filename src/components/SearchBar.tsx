import { useRef, type ReactNode } from 'react';

/**
 * The search box shared by the Statements and Rules pages: live filtering, a clear button,
 * optional filter options directly below it, and a result count that screen readers announce.
 */
export function SearchBar({ value, onChange, placeholder, label, count, children }: { value: string; onChange: (v: string) => void; placeholder: string; label: string; count: ReactNode; children?: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="searchbar">
      <div className="search-field">
        <input ref={input} type="search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} onKeyDown={(e) => e.key === 'Escape' && onChange('')} />
        {value && (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            onClick={() => {
              onChange('');
              input.current?.focus();
            }}
          >
            ×
          </button>
        )}
      </div>
      {children && <div className="search-options">{children}</div>}
      <p className="search-count muted small" role="status" aria-live="polite" data-testid="search-count">
        {count}
      </p>
    </div>
  );
}
