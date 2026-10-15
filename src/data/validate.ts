/** Validates raw record arrays via the adapter. Bad records are reported and skipped; nothing throws. */
import { adaptFact, adaptRule, type AdaptResult } from './adapter';
import type { DataIssue, Fact, Rule } from './types';

export interface Validated<T> {
  records: T[];
  issues: DataIssue[];
}

function run<T extends { id: string }>(
  file: 'rules' | 'facts',
  raw: unknown[],
  adapt: (r: unknown, i: number) => AdaptResult<T>
): Validated<T> {
  const issues: DataIssue[] = [];
  const records: T[] = [];
  const seen = new Map<string, number>();
  raw.forEach((r, index) => {
    let res: AdaptResult<T>;
    try {
      res = adapt(r, index);
    } catch (e) {
      res = { ok: false, error: `adapter error: ${(e as Error).message}` };
    }
    if (!res.ok) {
      issues.push({ file, index, level: 'error', message: `${res.error} (record skipped)` });
      return;
    }
    const rec = res.value;
    for (const w of res.warnings) issues.push({ file, index, id: rec.id, level: 'warning', message: w });
    const n = seen.get(rec.id) ?? 0;
    if (n > 0) {
      const newId = `${rec.id}~${n + 1}`;
      issues.push({ file, index, id: rec.id, level: 'warning', message: `duplicate id; kept as "${newId}"` });
      seen.set(rec.id, n + 1);
      rec.id = newId;
    } else seen.set(rec.id, 1);
    records.push(rec);
  });
  return { records, issues };
}

export function validateRules(raw: unknown[]): Validated<Rule> {
  const v = run('rules', raw, adaptRule);
  const ids = new Set(v.records.map((r) => r.id));
  for (const r of v.records) {
    if (r.parent && (!ids.has(r.parent) || r.parent === r.id)) {
      v.issues.push({ file: 'rules', index: r.order, id: r.id, level: 'warning', message: `parent "${r.parent}" not found; shown at section level` });
      r.parent = undefined;
    }
  }
  return v;
}

export function validateFacts(raw: unknown[]): Validated<Fact> {
  return run('facts', raw, adaptFact);
}
