/** Fact selection: random order that avoids recently seen facts. Pure. */
import type { Fact } from '../data/types';
import { randInt, shuffle, type Rng } from './rng';

/**
 * Picks one random fact that is not in `recent` (most recent last). If every fact was seen
 * recently, returns the one seen longest ago. Returns null for an empty pool.
 */
export function pickRandomFact(pool: Fact[], recent: readonly string[], rng: Rng): Fact | null {
  if (!pool.length) return null;
  const recentSet = new Set(recent);
  const fresh = pool.filter((f) => !recentSet.has(f.id));
  if (fresh.length) return fresh[randInt(rng, fresh.length)];
  const rank = new Map(recent.map((id, i) => [id, i]));
  return pool.reduce((a, b) => ((rank.get(a.id) ?? -1) <= (rank.get(b.id) ?? -1) ? a : b));
}

export interface SessionOptions {
  /** Number of questions, or 'all'. */
  size: number | 'all';
  /** Restrict to these categories (empty/undefined = all). */
  categories?: string[];
  /** Recently seen fact ids, most recent last. */
  recent?: readonly string[];
}

export function filterByCategory<T extends { category?: string }>(facts: T[], categories?: string[]): T[] {
  if (!categories || categories.length === 0) return facts;
  const set = new Set(categories);
  return facts.filter((f) => set.has(f.category ?? ''));
}

/**
 * Builds a session order with no repeats: unseen facts first (shuffled), then recently seen ones,
 * oldest first. Truncated to `size`.
 */
export function buildSession<T extends { id: string; category?: string }>(facts: T[], opts: SessionOptions, rng: Rng): T[] {
  const pool = filterByCategory(facts, opts.categories);
  const recent = opts.recent ?? [];
  const rank = new Map(recent.map((id, i) => [id, i]));
  const fresh = shuffle(pool.filter((f) => !rank.has(f.id)), rng);
  const stale = pool.filter((f) => rank.has(f.id)).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  const ordered = [...fresh, ...stale];
  const n = opts.size === 'all' ? ordered.length : Math.max(0, Math.min(opts.size, ordered.length));
  return ordered.slice(0, n);
}
