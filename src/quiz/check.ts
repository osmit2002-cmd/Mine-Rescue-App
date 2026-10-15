/** Answer checker for typed (fill-in) answers. Pure. */
import { quizConfig } from './quizConfig';
import { isNumberAnswer, levenshtein, normalizeAnswer, parseNumberAnswer } from './text';

export interface CheckResult {
  correct: boolean;
  /** Accepted, but not an exact (normalized) match, i.e. a small typo was forgiven. */
  typo: boolean;
}

function toleranceFor(len: number, table = quizConfig.typoTolerance): number {
  for (const row of table) if (len <= row.maxLen) return row.distance;
  return 0;
}

function digitRuns(s: string): string {
  return (s.match(/\d+/g) ?? []).join(' ');
}

/**
 * Compares a typed answer with the expected one.
 * - Case, punctuation, quotes and a leading article are ignored.
 * - Numbers must match exactly ("1,000" = "1000" = "1000 feet"; "three" = "3"; "3" != "30").
 * - Words allow a small number of typos (quizConfig.typoTolerance; a swap of two adjacent letters counts as one),
 *   but each word's first letter and any digits must match exactly.
 */
export function checkAnswer(input: string, expected: string, alternatives: string[] = []): CheckResult {
  let best: CheckResult = { correct: false, typo: false };
  for (const exp of [expected, ...alternatives]) {
    const r = checkOne(input, exp);
    if (r.correct && !r.typo) return r;
    if (r.correct) best = r;
  }
  return best;
}

function checkOne(input: string, expected: string): CheckResult {
  if (!input.trim()) return { correct: false, typo: false };
  if (isNumberAnswer(expected)) {
    const want = parseNumberAnswer(expected);
    const got = parseNumberAnswer(input);
    return { correct: want !== null && got !== null && want === got, typo: false };
  }
  const a = normalizeAnswer(input);
  const b = normalizeAnswer(expected);
  if (!a || !b) return { correct: false, typo: false };
  if (a === b) return { correct: true, typo: false };
  if (a.replace(/ /g, '') === b.replace(/ /g, '')) return { correct: true, typo: false };
  if (digitRuns(a) !== digitRuns(b)) return { correct: false, typo: false };
  // Another member of the answer's term group (e.g. "Class B" for "Class C") is a real mistake, not a typo.
  const group = quizConfig.termGroups.find((g) => g.some((t) => normalizeAnswer(t) === b));
  if (group?.some((t) => normalizeAnswer(t) === a)) return { correct: false, typo: false };
  // Typos are judged word by word: short words (<= 3 chars, e.g. the "C" in "Class C") must match exactly.
  const aw = a.split(' ');
  const bw = b.split(' ');
  if (aw.length !== bw.length) return { correct: false, typo: false };
  let typo = false;
  for (let i = 0; i < bw.length; i++) {
    if (aw[i] === bw[i]) continue;
    // A different first letter is treated as a different word, not a typo. This rejects antonyms made by a
    // prefix ("unconscious" for "conscious", "decrease" for "increase", "impermissible") and "ethane" for "methane".
    if (aw[i][0] !== bw[i][0]) return { correct: false, typo: false };
    if (levenshtein(aw[i], bw[i]) > toleranceFor(bw[i].length)) return { correct: false, typo: false };
    typo = true;
  }
  return { correct: typo, typo };
}
