/** Saved problems in localStorage, plus JSON import/export. All access is guarded: bad or missing storage never crashes. */
import { normalizeProblem, type Problem } from './model';

export const PROBLEMS_KEY = 'mrs.builder.problems.v1';
export const CURRENT_KEY = 'mrs.builder.current.v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadProblems(store: StorageLike | null = storage()): Problem[] {
  try {
    const raw = store?.getItem(PROBLEMS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown[];
    if (!Array.isArray(list)) return [];
    const out: Problem[] = [];
    for (const r of list) {
      try {
        out.push(normalizeProblem(r));
      } catch {
        /* skip a damaged entry */
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function saveProblems(list: Problem[], store: StorageLike | null = storage()): boolean {
  try {
    store?.setItem(PROBLEMS_KEY, JSON.stringify(list));
    return !!store;
  } catch {
    return false;
  }
}

export function loadCurrentId(store: StorageLike | null = storage()): string | null {
  try {
    return store?.getItem(CURRENT_KEY) ?? null;
  } catch {
    return null;
  }
}

export function saveCurrentId(id: string, store: StorageLike | null = storage()) {
  try {
    store?.setItem(CURRENT_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Download a problem as a .json file. */
export function downloadProblem(p: Problem) {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${p.title.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'problem'}.mrs-problem.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Read a problem from a user-chosen file. */
export async function readProblemFile(file: File): Promise<Problem> {
  if (file.size > 2_000_000) throw new Error('That file is too large to be a problem file.');
  const text = await file.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('That file is not JSON.');
  }
  return normalizeProblem(json);
}
