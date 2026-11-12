import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { OFFICIAL, OPEN } from './official';
import type { OfficialFixture } from './types';
import { CURRENT_RULE_YEAR, formatOverall, formatScores, recencyWeight, scoreFixture, weightedOverall } from './score';
import { TRIAGE } from './triage';
import { UNVERIFIED_BUILT } from './unverified';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function pdfsUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...pdfsUnder(p));
    else if (name.toLowerCase().endsWith('.pdf')) out.push(relative(ROOT, p));
  }
  return out.sort();
}

describe('solver accuracy', () => {
  const scores = OFFICIAL.map(scoreFixture);
  const open = OPEN.map(scoreFixture);

  it('prints the per-problem score', () => {
    const all = [...scores, ...open];
    const lines = [formatScores(all), '', formatOverall(all), '', 'Unverified (not scored):'];
    for (const u of UNVERIFIED_BUILT) lines.push(`  ${u.id}: ${u.reason}`);
    const officialPdfs = new Set(OFFICIAL.flatMap((f) => (f.pdf ? [f.pdf] : [])));
    const unread = pdfsUnder(join(ROOT, 'problems')).filter((p) => !officialPdfs.has(p));
    const yes = TRIAGE.filter((t) => t.official === 'yes').length;
    lines.push(`  ${unread.length} contest PDFs are not transcribed. ${yes} of ${TRIAGE.length} contain an official solution or judge key.`);
    console.log(lines.join('\n'));
    expect(scores.length).toBeGreaterThan(0);
  });

  it('reports 2026 Day 2 with the stops that do not match', () => {
    const s = open.find((x) => x.id === 'national-2026-day2')!;
    expect(s.passed).toBe(14);
    expect(s.total).toBe(18);
    expect(s.checks.filter((c) => !c.ok).map((c) => c.id)).toEqual(['stop:1,2', 'stop:2,2', 'stop:0,4', 'stop:2,4']);
  });

  it('reports 2019 Day 1 with the stops that do not match', () => {
    const s = open.find((x) => x.id === 'national-2019-day1')!;
    expect(s.passed).toBe(11);
    expect(s.total).toBe(16);
    expect(s.checks.filter((c) => !c.ok).map((c) => c.id)).toEqual(['stop:2,1', 'stop:0,2', 'stop:2,2', 'stop:0,3', 'stop:2,3']);
  });

  it.each(OFFICIAL.map((f) => f.id))('%s scores 100%', (id) => {
    const s = scores.find((x) => x.id === id)!;
    expect(s.percent, s.first ? `${s.first.what}: expected ${s.first.expected}; got ${s.first.got} (${s.first.rule.name})` : '').toBe(100);
    expect(s.first).toBeUndefined();
    expect(s.passed).toBe(s.total);
  });

  it('weights a fixture by its contest year against the 2026 rules', () => {
    expect(CURRENT_RULE_YEAR).toBe(2026);
    expect(recencyWeight(2026)).toBe(1);
    expect(recencyWeight(2016)).toBeCloseTo(1 / 3);
    expect(recencyWeight(2011)).toBeCloseTo(0.25);
    expect(recencyWeight(2031)).toBe(1);
    const weighted = weightedOverall([...scores, ...open]);
    expect(weighted).toBeGreaterThan(0);
    expect(weighted).toBeLessThanOrEqual(100);
  });

  it('a superseded check is listed but not counted, and the newer text is cited', () => {
    const base = OPEN.find((f) => f.id === 'national-2019-day1')!;
    const fixed: OfficialFixture = {
      ...base,
      supersedes: [{ checks: ['stop:2,1'], by: 'national-2026-day2', newer: { id: 'b-card-44', name: 'Rule 44B', text: 'test' }, reason: 'test' }]
    };
    const s = scoreFixture(fixed);
    const sup = s.checks.find((c) => c.id === 'stop:2,1')!;
    expect(sup.superseded?.by).toBe('national-2026-day2');
    expect(s.total).toBe(15);
    expect(s.passed).toBe(11);
    expect(s.first?.id).not.toBe('stop:2,1');
  });

  it('a superseding fixture is from a later contest year', () => {
    const year = (id: string) => OFFICIAL.concat(OPEN).find((f) => f.id === id)!.year;
    for (const f of OFFICIAL.concat(OPEN)) for (const sup of f.supersedes ?? []) expect(year(sup.by)).toBeGreaterThan(f.year);
  });

  it('does not treat an unverified problem as official', () => {
    const ids = new Set(OFFICIAL.map((f) => f.id));
    for (const u of UNVERIFIED_BUILT) expect(ids.has(u.id)).toBe(false);
  });

  it('triage names every contest PDF once', () => {
    const all = pdfsUnder(join(ROOT, 'problems'));
    expect(TRIAGE.map((t) => t.pdf)).toEqual(all);
    const transcribed = TRIAGE.filter((t) => t.transcribed).map((t) => t.pdf);
    const fixturePdfs = OFFICIAL.flatMap((f) => (f.pdf ? [f.pdf] : []));
    expect(new Set(transcribed)).toEqual(new Set(fixturePdfs));
    expect(transcribed.length).toBe(fixturePdfs.length);
    for (const pdf of fixturePdfs) {
      const row = TRIAGE.find((t) => t.pdf === pdf);
      expect(row?.official).toBe('yes');
      expect(row?.score).not.toBe('');
    }
    // A PDF is not called official unless this list says so. Figure 7 has no PDF.
    expect(TRIAGE.some((t) => t.official === 'yes')).toBe(true);
    expect(TRIAGE.some((t) => t.official === 'no')).toBe(true);
  });

  it('lists every contest PDF that has no fixture as unverified', () => {
    const officialPdfs = new Set(OFFICIAL.flatMap((f) => (f.pdf ? [f.pdf] : [])));
    const all = pdfsUnder(join(ROOT, 'problems'));
    const unread = all.filter((p) => !officialPdfs.has(p));
    expect(all.length).toBeGreaterThan(unread.length);
    expect(officialPdfs.has('problems/msha-archive/coal/2016/2016_Post_5_Day_1_Mine_Rescue.pdf')).toBe(true);
    expect(unread).not.toContain('problems/msha-archive/coal/2016/2016_Post_5_Day_1_Mine_Rescue.pdf');
    // The archive is still mostly unread. A new PDF stays unverified until a fixture is added.
    expect(unread.length).toBeGreaterThan(100);
  });
});
