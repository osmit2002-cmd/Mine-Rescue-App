/**
 * Official solutions the solver is scored against. A fixture is only added when the step-by-step solution is
 * already in the repo (the rule book, or a contest PDF's judge key). Anything else stays unverified.
 */
import type { JudgeKey } from '../judge';
import type { Problem } from '../model';
import type { Solution } from '../solve';

/** A sentence from content/rules.md, or a judge-key sentence that applies a rule. */
export interface RuleCite {
  /** Rule id used elsewhere in the app, e.g. "b-card-44". */
  id: string;
  /** How the report names it, e.g. "Rule 44B". */
  name: string;
  /** Short verbatim excerpt. */
  text: string;
}

export interface ExtraCheck {
  id: string;
  what: string;
  rule: RuleCite;
  run: (sol: Solution) => { ok: boolean; expected: string; got: string };
}

export interface OfficialFixture {
  id: string;
  title: string;
  /** Where the official solution was read. */
  source: string;
  /** Contest PDF this fixture transcribes, relative to the repo, if it came from problems/. */
  pdf?: string;
  problem: () => Problem;
  key: JudgeKey;
  /** Citation for team-stop checks. `stopRules` overrides by "entry,row". */
  stopRule: RuleCite;
  stopRules?: Record<string, RuleCite>;
  rescueRule: RuleCite;
  reachRule: RuleCite;
  ventRule: RuleCite;
  withdrawalRule: RuleCite;
  foundRule: RuleCite;
  /** Official requirements the judge key's fields do not express (order of a rebuild, a timber deadline, a route). */
  extras?: ExtraCheck[];
}

export interface ScoredCheck {
  id: string;
  what: string;
  ok: boolean;
  expected: string;
  got: string;
  rule: RuleCite;
}

export interface ProblemScore {
  id: string;
  title: string;
  source: string;
  passed: number;
  total: number;
  /** 0–100. 100 means every official check passed. */
  percent: number;
  checks: ScoredCheck[];
  /** The first check, in solution order, that does not match. Absent when percent is 100. */
  first?: ScoredCheck;
}

export interface UnverifiedProblem {
  id: string;
  title: string;
  source: string;
  reason: string;
}
