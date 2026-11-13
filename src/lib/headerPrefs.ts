/** Whether the header's rule-book bar is collapsed, persisted in localStorage. All access is guarded. */
export const HEADER_COLLAPSED_KEY = 'mrs.headerCollapsed';

/** Below this width the tab bar sits at the bottom and the rule-book menu takes its own row in the header. */
export const NARROW_QUERY = '(max-width: 759px)';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function storage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function isNarrow(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(NARROW_QUERY).matches;
  } catch {
    return false;
  }
}

/** The saved choice wins; with none saved, phones start collapsed (the menu row would cover the top of every page) and wide screens expanded. */
export function readHeaderCollapsed(narrow: boolean, store: StorageLike | null = storage()): boolean {
  let saved: string | null = null;
  try {
    saved = store?.getItem(HEADER_COLLAPSED_KEY) ?? null;
  } catch {
    saved = null;
  }
  if (saved === '1') return true;
  if (saved === '0') return false;
  return narrow;
}

export function writeHeaderCollapsed(collapsed: boolean, store: StorageLike | null = storage()): void {
  try {
    store?.setItem(HEADER_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    /* ignore: private mode or full storage */
  }
}
