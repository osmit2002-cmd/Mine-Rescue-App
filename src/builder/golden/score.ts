/**
 * Scores one solver run against an official fixture. Checks run in solution order. The first counted check that
 * disagrees is the divergence, and it carries the rule that applies.
 *
 * Recency: a fixture counts for `recencyWeight(year)` in the weighted overall. A newer contest is more likely to
 * reflect a rule change, so it weighs more. Superseded checks (see `Supersession`) are listed but not counted.
 */
import { compareToKey, type KeyCheck } from '../judge';
import { solve, type Solution } from '../solve';
import type { OfficialFixture, ProblemScore, RuleCite, ScoredCheck } from './types';

/** The rule book the solver follows. Figure 7 comes from this book and counts as this year. */
export const CURRENT_RULE_YEAR = 2026;

/**
 * Weight for a contest year: 1 for the current rules, falling toward 0 as the contest ages.
 * weight = 1 / (1 + (CURRENT_RULE_YEAR − year) / 5). A year after the current rules is weighted 1.
 * 2026 → 1.00, 2024 → 0.71, 2019 → 0.42, 2016 → 0.33, 2011 → 0.25.
 */
export function recencyWeight(year: number, current = CURRENT_RULE_YEAR): number {
  return 1 / (1 + Math.max(0, current - year) / 5);
}

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
  for (const c of checks) {
    if (c.ok) continue;
    const s = (fix.supersedes ?? []).find((x) => x.checks.includes(c.id));
    if (s) c.superseded = { by: s.by, newer: s.newer, reason: s.reason };
  }
  const counted = checks.filter((c) => !c.superseded);
  const passed = counted.filter((c) => c.ok).length;
  const total = counted.length;
  const percent = total === 0 ? 100 : Math.round((passed / total) * 100);
  return {
    id: fix.id,
    title: fix.title,
    year: fix.year,
    source: fix.source,
    passed,
    total,
    percent,
    weight: recencyWeight(fix.year),
    checks,
    first: counted.find((c) => !c.ok)
  };
}

/** Solve the fixture's problem and score it. The solver is deterministic, so this is too. */
export function scoreFixture(fix: OfficialFixture): ProblemScore {
  return scoreSolution(solve(fix.problem()), fix);
}

/** Weighted mean of the per-fixture percentages. Each fixture counts for its recency weight. */
export function weightedOverall(scores: ProblemScore[]): number {
  const w = scores.reduce((a, s) => a + s.weight, 0);
  if (w === 0) return 100;
  return Math.round((scores.reduce((a, s) => a + s.weight * s.percent, 0) / w) * 10) / 10;
}

/** Unweighted mean of the per-fixture percentages, for comparison with the weighted overall. */
export function rawOverall(scores: ProblemScore[]): number {
  if (scores.length === 0) return 100;
  return Math.round((scores.reduce((a, s) => a + s.percent, 0) / scores.length) * 10) / 10;
}

export function formatScore(s: ProblemScore): string {
  const lines = [`${s.id}  ${s.passed}/${s.total}  ${s.percent}%  weight ${s.weight.toFixed(2)}  ${s.title}`];
  if (s.first) {
    lines.push(`  first divergence: ${s.first.what}`);
    lines.push(`  expected ${s.first.expected}; got ${s.first.got}`);
    lines.push(`  ${s.first.rule.name}: “${s.first.rule.text}”`);
  }
  for (const c of s.checks.filter((x) => x.superseded)) {
    lines.push(`  superseded (not counted): ${c.what}; expected ${c.expected}; got ${c.got}`);
    lines.push(`    older: ${c.rule.name}: “${c.rule.text}”`);
    lines.push(`    newer (${c.superseded!.by}): ${c.superseded!.newer.name}: “${c.superseded!.newer.text}”`);
    lines.push(`    why: ${c.superseded!.reason}`);
  }
  return lines.join('\n');
}

export function formatScores(scores: ProblemScore[]): string {
  return scores.map(formatScore).join('\n');
}

/** One line per fixture: raw score, weight, and the two overall figures. */
export function formatOverall(scores: ProblemScore[]): string {
  const rows = scores.map((s) => `  ${s.id.padEnd(20)} ${String(s.year)}  raw ${String(s.percent).padStart(3)}%  weight ${s.weight.toFixed(2)}`);
  return [
    'Per-fixture scores (raw = percent of counted checks):',
    ...rows,
    `Raw overall (unweighted mean): ${rawOverall(scores)}%`,
    `Weighted overall (recency, ${CURRENT_RULE_YEAR} = 1.00): ${weightedOverall(scores)}%`
  ].join('\n');
}
