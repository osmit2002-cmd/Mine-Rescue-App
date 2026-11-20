/**
 * Starter problems: the sample problems and the transcribed past contest problems, as problem files a new user can
 * put in their problems folder. The files are kept in the repo under public/starter-problems/ (served with the
 * app); `npm run starters` rewrites them from the code, and a test fails when they are out of date.
 */
import { CASES } from './cases';
import type { Problem } from './model';
import { SAMPLES } from './samples';

export const STARTER_DIR = 'starter-problems';

/** Repo file name for a starter: plain lowercase ASCII, so it is safe in URLs on any host. */
export const starterFileName = (p: Pick<Problem, 'title'>) =>
  `${p.title.normalize('NFKD').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'problem'}.mrs-problem.json`;

/** Every starter problem once (a sample that is also a reference case is listed once), with its file name. */
export function starterProblems(): { file: string; problem: Problem }[] {
  const seen = new Set<string>();
  const out: { file: string; problem: Problem }[] = [];
  for (const p of [...SAMPLES.map((s) => s.make()), ...CASES.map((c) => c.problem())]) {
    const file = starterFileName(p);
    if (seen.has(file)) continue;
    seen.add(file);
    out.push({ file, problem: p });
  }
  return out;
}

export const starterJson = (p: Problem) => JSON.stringify(p, null, 2) + '\n';

/** Contents of starter-problems/index.json: the file names, in menu order. */
export const starterIndex = () => JSON.stringify({ files: starterProblems().map((s) => s.file) }, null, 2) + '\n';
