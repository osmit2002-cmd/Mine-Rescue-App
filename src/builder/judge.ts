/**
 * Judge keys: what a contest's judge book says the team must do, written so the solver's answer can be checked
 * against it. A reference case pairs a problem transcribed from a past contest PDF (problems/) with its key.
 *
 * Judge books number team stops by intersection and often accept more than one order: a "45" written at an
 * intersection means it may be stop 4 or stop 5. Key points the solver cannot be checked against yet (most of
 * them about ventilation) are kept verbatim as `manual` so the report shows the gap.
 */
import { nodeId } from './geometry';
import type { Problem } from './model';
import type { Solution } from './solve';

export interface JudgeKey {
  /** PDF under problems/ and the pages the key comes from. */
  source: string;
  /** Team stops: intersection [entry index, crosscut row] → the stop numbers the judges accept there. */
  stops: { at: [number, number]; n: number[] }[];
  /** Elements the team must find (map). Omit to require every element not already shown on the blank map. */
  find?: string[];
  /** Elements the team must not reach. */
  notFound?: string[];
  /** Live persons to bring to the FAB; `before` = before the team starts this stop (0 = before leaving the FAB). */
  rescue: { el: string; before?: number }[];
  /** Bodies or persons the team must reach (examine) before this stop starts. */
  reachBefore?: { el: string; before: number }[];
  /** The judges expect the team to withdraw (Rule 31B). */
  withdrawal: boolean;
  /** The judge book's key points, verbatim. */
  notes: string[];
  /** The key points (or parts of them) that are not checked automatically yet. */
  manual: string[];
}

export interface ReferenceCase {
  id: string;
  title: string;
  problem: () => Problem;
  key: JudgeKey;
}

export interface KeyCheck {
  id: string;
  what: string;
  ok: boolean;
  expected: string;
  got: string;
}

export interface KeyReport {
  checks: KeyCheck[];
  passed: number;
  total: number;
  /** Key points not checked (manual). */
  unchecked: string[];
}

const baseOf = (sub: string | undefined) => (sub ? sub.split('#')[0] : '');

/** Compare one solution with the judge key. */
export function compareToKey(sol: Solution, key: JudgeKey): KeyReport {
  const { plan, board } = sol;
  const steps = plan.steps;
  const checks: KeyCheck[] = [];
  const name = (id: string) => {
    const q = board.placed.get(id);
    return q ? `${q.el.kind} “${q.el.text ?? ''}” (${id})` : id;
  };

  // Stop numbers: the first stop the solver makes at each intersection.
  const stopAt = new Map<string, number>();
  for (const s of steps) if (s.kind === 'stop' && s.n !== undefined && !stopAt.has(baseOf(s.at))) stopAt.set(baseOf(s.at), s.n);
  const stepOfStop = (n: number) => steps.findIndex((s) => s.kind === 'stop' && s.n === n);
  for (const st of key.stops) {
    const [i, r] = st.at;
    const got = stopAt.get(nodeId(i, r));
    checks.push({
      id: `stop:${i},${r}`,
      what: `Team stop at No. ${i + 1} Entry, crosscut row ${r}`,
      ok: got !== undefined && st.n.includes(got),
      expected: st.n.join(' or '),
      got: got === undefined ? 'never stopped there' : String(got)
    });
  }

  const wd = !!plan.withdrawal;
  checks.push({ id: 'withdrawal', what: 'Withdrawal (Rule 31B)', ok: wd === key.withdrawal, expected: key.withdrawal ? 'withdraw' : 'no withdrawal', got: wd ? `withdraws: ${plan.withdrawal!.reason}` : 'no withdrawal' });

  const find = key.find ?? board.elements.filter((e) => !e.preMapped).map((e) => e.id);
  const missed = find.filter((id) => !plan.found.has(id));
  checks.push({ id: 'found', what: 'Objects and conditions found', ok: missed.length === 0, expected: `${find.length} found`, got: missed.length ? `missed ${missed.map(name).join(', ')}` : `${find.length} found` });
  for (const id of key.notFound ?? []) checks.push({ id: `not-found:${id}`, what: `Never reached: ${name(id)}`, ok: !plan.found.has(id), expected: 'not found', got: plan.found.has(id) ? `found at step ${plan.found.get(id)}` : 'not found' });

  const recoverStep = (id: string) => steps.findIndex((s) => s.kind === 'recover' && s.subject === id);
  for (const r of key.rescue) {
    const at = recoverStep(r.el);
    const rescued = plan.changed.get(r.el) === 'taken to the FAB';
    let ok = rescued;
    let got = rescued ? `rescued at step ${at}` : plan.found.has(r.el) ? 'found but not rescued' : 'not found';
    let expected = 'taken to the FAB';
    if (r.before !== undefined) {
      expected += r.before === 0 ? ' before the team goes inby the FAB' : ` before team stop ${r.before}`;
      const limit = r.before === 0 ? steps.findIndex((s) => s.kind === 'stop') : stepOfStop(r.before);
      if (rescued && limit >= 0 && at > limit) {
        ok = false;
        got += r.before === 0 ? ' (after the first team stop)' : ` (after stop ${r.before})`;
      }
    }
    checks.push({ id: `rescue:${r.el}`, what: `Rescue ${name(r.el)}`, ok, expected, got });
  }
  for (const r of key.reachBefore ?? []) {
    const at = plan.found.get(r.el);
    const limit = stepOfStop(r.before);
    const ok = at !== undefined && (limit < 0 || at < limit);
    checks.push({ id: `reach:${r.el}`, what: `Reach ${name(r.el)} before stop ${r.before}`, ok, expected: `before stop ${r.before}`, got: at === undefined ? 'not found' : `found at step ${at}${limit >= 0 ? `, stop ${r.before} is step ${limit}` : ''}` });
  }

  const passed = checks.filter((c) => c.ok).length;
  return { checks, passed, total: checks.length, unchecked: key.manual };
}

/** One line per check, for test output and the console. */
export function formatReport(r: KeyReport): string {
  const lines = r.checks.map((c) => `${c.ok ? 'ok  ' : 'FAIL'} ${c.what}: expected ${c.expected}; got ${c.got}`);
  lines.push(`${r.passed}/${r.total} checks pass; ${r.unchecked.length} key point(s) not checked automatically.`);
  return lines.join('\n');
}
