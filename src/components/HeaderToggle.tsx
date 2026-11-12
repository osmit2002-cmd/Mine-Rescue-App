/** The button that shows or hides the header's rule-book menu. In the collapsed bar it also names the current rule book. */
export function HeaderToggle({ collapsed, controls, current, onToggle }: { collapsed: boolean; controls: string; current: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="header-toggle"
      aria-expanded={!collapsed}
      aria-controls={controls}
      onClick={onToggle}
      data-testid="header-toggle"
      title={collapsed ? 'Show the rule book menu' : 'Hide the rule book menu'}
    >
      {collapsed ? (
        <span className="header-current" data-testid="header-current">
          <span className="sr-only">Rule book: </span>
          {current}
        </span>
      ) : (
        <span className="header-hide-label">Hide</span>
      )}
      <span className="sr-only">{collapsed ? ', show rule book menu' : ' rule book menu'}</span>
      <svg className={`header-chevron${collapsed ? '' : ' up'}`} width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M4 6l4 4 4-4" />
      </svg>
    </button>
  );
}
