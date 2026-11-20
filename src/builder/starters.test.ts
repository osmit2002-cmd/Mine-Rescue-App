import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeProblem } from './model';
import { STARTER_DIR, starterIndex, starterJson, starterProblems } from './starters';

const dir = join(__dirname, '..', '..', 'public', STARTER_DIR);

describe('starter problem files in the repo', () => {
  // `npm run starters` sets WRITE_STARTERS=1 to rewrite the files from the code.
  if (process.env.WRITE_STARTERS) {
    it('writes the files', () => {
      if (existsSync(dir)) rmSync(dir, { recursive: true });
      mkdirSync(dir, { recursive: true });
      for (const s of starterProblems()) writeFileSync(join(dir, s.file), starterJson(s.problem));
      writeFileSync(join(dir, 'index.json'), starterIndex());
    });
    return;
  }

  it('match the sample and contest problems in the code (run `npm run starters` after changing them)', () => {
    const want = starterProblems();
    expect(readFileSync(join(dir, 'index.json'), 'utf8')).toBe(starterIndex());
    expect(readdirSync(dir).filter((f) => f !== 'index.json').sort()).toEqual(want.map((s) => s.file).sort());
    for (const s of want) expect(readFileSync(join(dir, s.file), 'utf8'), s.file).toBe(starterJson(s.problem));
  });

  it('are valid problem files', () => {
    for (const s of starterProblems()) expect(() => normalizeProblem(JSON.parse(readFileSync(join(dir, s.file), 'utf8')))).not.toThrow();
  });
});
