import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { OFFICIAL } from './official';
import { formatScores, scoreFixture } from './score';
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

  it('prints the per-problem score', () => {
    const lines = [formatScores(scores), '', 'Unverified (not scored):'];
    for (const u of UNVERIFIED_BUILT) lines.push(`  ${u.id}: ${u.reason}`);
    const officialPdfs = new Set(OFFICIAL.flatMap((f) => (f.pdf ? [f.pdf] : [])));
    const unread = pdfsUnder(join(ROOT, 'problems')).filter((p) => !officialPdfs.has(p));
    lines.push(`  ${unread.length} contest PDFs under problems/ have no transcribed official solution.`);
    console.log(lines.join('\n'));
    expect(scores.length).toBeGreaterThan(0);
  });

  it.each(OFFICIAL.map((f) => f.id))('%s scores 100%', (id) => {
    const s = scores.find((x) => x.id === id)!;
    expect(s.percent, s.first ? `${s.first.what}: expected ${s.first.expected}; got ${s.first.got} (${s.first.rule.name})` : '').toBe(100);
    expect(s.first).toBeUndefined();
    expect(s.passed).toBe(s.total);
  });

  it('does not treat an unverified problem as official', () => {
    const ids = new Set(OFFICIAL.map((f) => f.id));
    for (const u of UNVERIFIED_BUILT) expect(ids.has(u.id)).toBe(false);
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
