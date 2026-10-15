import { describe, expect, it } from 'vitest';
import type { PartTable } from '../data/types';
import { generatePartQuestion, partItems } from './parts';
import { seededRng } from './rng';

const table = (id: string, event: string, names: string[]): PartTable => ({
  id,
  event,
  assembly: `Assembly ${id}`,
  page: 10,
  rows: names.map((name, i) => ({ no: String(i + 1), name })),
  order: 0
});

describe('parts questions', () => {
  const a = table('a', 'bench-x', ['Lens', 'Strap', 'Valve', 'Hose']);
  const b = table('b', 'bench-x', ['Cylinder', 'Gauge']);
  const other = table('o', 'bench-y', ['Nope']);
  const all = [a, b, other];

  it('builds one item per row', () => {
    expect(partItems([a, b])).toHaveLength(6);
    expect(new Set(partItems([a, b]).map((p) => p.id)).size).toBe(6);
  });

  it('gives 3 unique choices with distractors from the same table first', () => {
    for (let s = 0; s < 30; s++) {
      const q = generatePartQuestion(partItems([a])[0], all, 'mc', seededRng(s))!;
      expect(q.choices).toHaveLength(3);
      expect(new Set(q.choices).size).toBe(3);
      expect(q.choices![q.correctIndex!]).toBe('Lens');
      expect(q.answer).toBe('Lens');
      for (const c of q.choices!) expect(a.rows.map((r) => r.name)).toContain(c);
      expect(q.segments[0]).toContain('No. 1');
    }
  });

  it('falls back to other tables of the same event, never another event', () => {
    const tiny = table('t', 'bench-x', ['Strap', 'Straps']);
    for (let s = 0; s < 30; s++) {
      const q = generatePartQuestion(partItems([tiny])[0], [tiny, b, other], 'mc', seededRng(s))!;
      expect(q.choices).toHaveLength(3);
      expect(q.choices).not.toContain('Nope');
      expect(q.choices).not.toContain('Straps'); // plural of the answer is never offered
    }
  });

  it('returns null when the event has too few other names', () => {
    expect(generatePartQuestion(partItems([other])[0], all, 'mc', seededRng(1))).toBeNull();
  });

  it('fill-in asks for the printed name', () => {
    const q = generatePartQuestion(partItems([b])[1], all, 'fill', seededRng(1))!;
    expect(q.type).toBe('fill');
    expect(q.answer).toBe('Gauge');
  });
});
