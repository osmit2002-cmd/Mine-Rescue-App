/**
 * Scores one solver run against an official fixture. Checks run in solution order. The first one that
 * disagrees is the divergence, and it carries the rule that applies.
 */
import { compareToKey, type KeyCheck } from '../judge';
import { solve, type Solution } from '../solve';
import type { OfficialFixture, ProblemScore, RuleCite, ScoredCheck } from './types';

function citeFor(fix: OfficialFixture, check: KeyCheck): RuleCite {
  if (check.id.startsWith('stop:')) {
    const at = check.id.slice('stop:'.length);
    return fix.stopRules?.[at] ?? fix.stopRule;
  }
  if (check.id.startsWith('rescue:')) return fix.rescueRule;
  if (check.id.startsWith('reach:')) return fix.reachRule;
  if (check.id.startsWith('vent:') || check.id === 'vents-safe') return fix.ventRule;
  if (check.id === 'withdrawal') return fix.withdrawalRule;
  if (check.id === 'found' || check.id.startsWith('not-found:')) return fix.foundRule;
  return fix.stopRule;
}

function fromKey(fix: OfficialFixture, check: KeyCheck): ScoredCheck {
  const rule = citeFor(fix, check);
  return { id: check.id, what: check.what, ok: check.ok, expected: check.expected, got: check.got, rule };
}

/** Compare the solver's solution with the official fixture. */
export function scoreSolution(sol: Solution, fix: OfficialFixture): ProblemScore {
  const checks: ScoredCheck[] = compareToKey(sol, fix.key).checks.map((c) => fromKey(fix, c));
  for (const extra of fix.extras ?? []) {
    const r = extra.run(sol);
    checks.push({ id: extra.id, what: extra.what, ok: r.ok, expected: r.expected, got: r.got, rule: extra.rule });
  }
  const passed = checks.filter((c) => c.ok).length;
  const total = checks.length;
  const percent = total === 0 ? 100 : Math.round((passed / total) * 100);
  return {
    id: fix.id,
    title: fix.title,
    source: fix.source,
    passed,
    total,
    percent,
    checks,
    first: checks.find((c) => !c.ok)
  };
}

/** Solve the fixture's problem and score it. The solver is deterministic, so this is too. */
export function scoreFixture(fix: OfficialFixture): ProblemScore {
  return scoreSolution(solve(fix.problem()), fix);
}

export function formatScore(s: ProblemScore): string {
  const lines = [`${s.id}  ${s.passed}/${s.total}  ${s.percent}%  ${s.title}`];
  if (s.first) {
    lines.push(`  first divergence: ${s.first.what}`);
    lines.push(`  expected ${s.first.expected}; got ${s.first.got}`);
    lines.push(`  ${s.first.rule.name}: “${s.first.rule.text}”`);
  }
  return lines.join('\n');
}

export function formatScores(scores: ProblemScore[]): string {
  return scores.map(formatScore).join('\n');
}
