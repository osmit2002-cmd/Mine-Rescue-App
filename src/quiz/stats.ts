/** Quiz statistics persisted in localStorage. All access is guarded; bad or missing storage never crashes. */
import { quizConfig } from './quizConfig';

export interface FactStat {
  seen: number;
  correct: number;
  last: number;
}

export interface QuizStats {
  version: 1;
  answered: number;
  correct: number;
  bestStreak: number;
  sessions: number;
  /** Recently seen fact ids, most recent last. */
  recent: string[];
  perFact: Record<string, FactStat>;
}

export const STATS_KEY = 'mrs.quizStats.v1';

export const emptyStats = (): QuizStats => ({ version: 1, answered: 0, correct: 0, bestStreak: 0, sessions: 0, recent: [], perFact: {} });

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadStats(store: StorageLike | null = storage()): QuizStats {
  try {
    const raw = store?.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    const s = JSON.parse(raw) as Partial<QuizStats>;
    if (!s || s.version !== 1) return emptyStats();
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
    return {
      version: 1,
      answered: num(s.answered),
      correct: num(s.correct),
      bestStreak: num(s.bestStreak),
      sessions: num(s.sessions),
      recent: Array.isArray(s.recent) ? s.recent.filter((x): x is string => typeof x === 'string').slice(-quizConfig.recentWindow) : [],
      perFact: s.perFact && typeof s.perFact === 'object' ? (s.perFact as Record<string, FactStat>) : {}
    };
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: QuizStats, store: StorageLike | null = storage()): void {
  try {
    store?.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    /* quota or private mode: ignore */
  }
}

/** Returns new stats with one answer recorded (pure). */
export function recordAnswer(stats: QuizStats, factId: string, correct: boolean, streak: number, now = Date.now()): QuizStats {
  const prev = stats.perFact[factId] ?? { seen: 0, correct: 0, last: 0 };
  const recent = [...stats.recent.filter((id) => id !== factId), factId].slice(-quizConfig.recentWindow);
  return {
    ...stats,
    answered: stats.answered + 1,
    correct: stats.correct + (correct ? 1 : 0),
    bestStreak: Math.max(stats.bestStreak, streak),
    recent,
    perFact: { ...stats.perFact, [factId]: { seen: prev.seen + 1, correct: prev.correct + (correct ? 1 : 0), last: now } }
  };
}

export function resetStats(store: StorageLike | null = storage()): QuizStats {
  try {
    store?.removeItem(STATS_KEY);
  } catch {
    /* ignore */
  }
  return emptyStats();
}
