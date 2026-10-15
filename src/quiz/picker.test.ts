import { describe, expect, it } from 'vitest';
import type { Fact } from '../data/types';
import { buildSession, filterByCategory, pickRandomFact } from './picker';
import { seededRng } from './rng';
import { emptyStats, loadStats, recordAnswer, saveStats } from './stats';

const facts: Fact[] = Array.from({ length: 30 }, (_, i) => ({ id: `f${i}`, statement: `s${i}`, keyTerms: [], distractors: [], order: i, category: i < 10 ? 'A' : 'B' }));

describe('pickRandomFact', () => {
  it('never picks a recently seen fact while fresh ones remain', () => {
    const recent = facts.slice(0, 29).map((f) => f.id);
    for (let s = 0; s < 20; s++) expect(pickRandomFact(facts, recent, seededRng(s))!.id).toBe('f29');
  });
  it('falls back to the least recently seen fact', () => {
    const recent = ['f3', 'f1', 'f2'];
    expect(pickRandomFact(facts.slice(1, 4), recent, seededRng(1))!.id).toBe('f3');
    expect(pickRandomFact([], [], seededRng(1))).toBeNull();
  });
});

describe('buildSession', () => {
  it('returns the requested size without repeats', () => {
    const s = buildSession(facts, { size: 10 }, seededRng(1));
    expect(s).toHaveLength(10);
    expect(new Set(s.map((f) => f.id)).size).toBe(10);
    expect(buildSession(facts, { size: 'all' }, seededRng(1))).toHaveLength(30);
    expect(buildSession(facts, { size: 100 }, seededRng(1))).toHaveLength(30);
  });
  it('puts recently seen facts last, oldest first', () => {
    const recent = ['f5', 'f6'];
    const s = buildSession(facts, { size: 'all', recent }, seededRng(2));
    expect(s.slice(-2).map((f) => f.id)).toEqual(['f5', 'f6']);
  });
  it('filters by category', () => {
    expect(filterByCategory(facts, ['A'])).toHaveLength(10);
    expect(buildSession(facts, { size: 'all', categories: ['B'] }, seededRng(1)).every((f) => f.category === 'B')).toBe(true);
  });
});

describe('stats', () => {
  it('records answers and best streak, and caps the recent list', () => {
    let st = emptyStats();
    st = recordAnswer(st, 'f1', true, 1);
    st = recordAnswer(st, 'f2', true, 2);
    st = recordAnswer(st, 'f1', false, 0);
    expect(st).toMatchObject({ answered: 3, correct: 2, bestStreak: 2, recent: ['f2', 'f1'] });
    expect(st.perFact.f1).toMatchObject({ seen: 2, correct: 1 });
  });
  it('survives corrupt storage', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    mem.set('mrs.quizStats.v1', '{not json');
    expect(loadStats(store)).toEqual(emptyStats());
    saveStats(recordAnswer(emptyStats(), 'x', true, 1), store);
    expect(loadStats(store).answered).toBe(1);
  });
});
