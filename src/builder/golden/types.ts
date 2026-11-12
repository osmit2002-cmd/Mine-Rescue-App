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

/**
 * A divergence in an older fixture that a newer key or the 2026 rule text overrides. The old check is still listed in
 * the report, marked superseded, and left out of the pass/fail gate. `by` must be a fixture from a later contest year.
 */
export interface Supersession {
  /** Check ids on the older fixture this applies to, e.g. "stop:2,1". */
  checks: string[];
  /** Id of the newer fixture whose key or rule text wins. */
  by: string;
  /** The newer rule text, verbatim from content/rules.md or the newer key's citation. */
  newer: RuleCite;
  /** Why the newer text wins over the older key step. */
  reason: string;
}

export interface OfficialFixture {
  id: string;
  title: string;
  /** Contest year. Drives the recency weight (see `recencyWeight`). The 2026 rule book counts as 2026. */
  year: number;
  /** Where the official solution was read. */
  source: string;
  /** Contest PDF this fixture transcribes, relative to the repo, if it came from problems/. */
  pdf?: string;
  problem: () => Problem;
  key: JudgeKey;
  /** Citation for team-stop checks. `stopRules` overrides by "entry,row". */
  stopRule: RuleCite;
  stopRules?: Record<string, RuleCite>;
  /** Citation for a team-stop check the key lets the captain choose (JudgeKey.captainOrder). */
  captainRule?: RuleCite;
  /** Older divergences a newer key or the 2026 rule text overrides. See `Supersession`. */
  supersedes?: Supersession[];
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
  /** Set when the check is a captain's-choice stop (JudgeKey.captainOrder). */
  captain?: boolean;
  /** Set when a newer key or rule overrides this older check. The check is listed but not counted. */
  superseded?: { by: string; newer: RuleCite; reason: string };
}

export interface ProblemScore {
  id: string;
  title: string;
  year: number;
  source: string;
  /** Counted checks that passed. Superseded checks are not counted. */
  passed: number;
  /** Counted checks. Superseded checks are not counted. */
  total: number;
  /** 0–100 over the counted checks. 100 means every counted official check passed. */
  percent: number;
  /** Recency weight, 0–1. See `recencyWeight`. */
  weight: number;
  checks: ScoredCheck[];
  /** The first counted check, in solution order, that does not match. Absent when percent is 100. */
  first?: ScoredCheck;
}

export interface UnverifiedProblem {
  id: string;
  title: string;
  source: string;
  reason: string;
}
