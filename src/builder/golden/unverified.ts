import type { UnverifiedProblem } from './types';

/**
 * Problems that are in the repo but do not have an official step-by-step solution transcribed.
 * A new contest problem is added by writing an OfficialFixture, not by guessing the judge's route.
 */
export const UNVERIFIED_BUILT: UnverifiedProblem[] = [
  {
    id: 'sample-fig5',
    title: 'Rule book Figure 5 — initial exploration',
    source: '2026 Coal Mine Rescue Rules, Figure 5, page 47',
    reason:
      'The figure shows the 25-foot limit at a team stop and the direction of travel. It does not number a full team-stop route, so there is no official step-by-step solution to score.'
  },
  {
    id: 'sample-practice-1',
    title: 'Practice 1 — Fire on the 1st North section',
    source: 'Sample written for this app (src/builder/samples.ts)',
    reason: 'Written for this app. It is not an official contest problem and has no judge key.'
  }
];
