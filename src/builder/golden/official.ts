/**
 * Problems whose official step-by-step solution is already written down in this repo.
 * Add a fixture here when a judge key or the rule book gives the team stops and the required actions.
 * Do not fill one in by running the solver and calling that the official answer.
 */
import type { JudgeKey } from '../judge';
import { KEY, post5Day1 } from '../cases/post5-2016-day1';
import { FIGURE7_STOPS, figure7 } from '../samples';
import type { Solution } from '../solve';
import { RULE_30A_TIMBERS, RULE_30F, RULE_32, RULE_35, RULE_41, RULE_44A, RULE_44B, RULE_44D, RULE_48E, RULE_31B } from './cites';
import type { ExtraCheck, OfficialFixture } from './types';

const fig7Key: JudgeKey = {
  source: '2026 Coal Mine Rescue Rules, Figure 7, page 49',
  stops: FIGURE7_STOPS.map(([i, r], k) => ({ at: [i, r], n: [k + 1] })),
  rescue: [],
  withdrawal: false,
  notes: [
    'Team stops numbered in accordance with Rule 44D: #1 No. 1 at the first crosscut; #2 No. 1 at the second; #3 No. 1 at the third; #4 No. 2 at the third; #5 No. 2 at the second; #6 No. 3 at the second; #7 No. 2 at the first; #8 No. 3 at the first; #9 No. 3 at the third.'
  ],
  manual: []
};

function ventStep(sol: Solution, gasId: string) {
  return sol.plan.steps.find((s) => s.kind === 'ventilate' && s.subject === gasId);
}

function courseCrosses(sol: Solution, gasId: string, elId: string): boolean {
  const vent = sol.plan.vents.find((v) => v.plan.target === gasId);
  const placed = sol.board.placed.get(elId);
  if (!vent || placed?.loc.type !== 'edge') return false;
  const edge = sol.board.topo.edges.get(placed.loc.edge);
  if (!edge) return false;
  const course = vent.plan.course.map((s) => s.split('#')[0]);
  for (let i = 1; i < course.length; i++) {
    const a = course[i - 1];
    const b = course[i];
    if ((a === edge.a && b === edge.b) || (a === edge.b && b === edge.a)) return true;
  }
  return false;
}

const post5Extras: ExtraCheck[] = [
  {
    id: 'rebuild:barricade-1',
    what: 'First vent puts the first barricade back up to wing the explosive mixture',
    rule: RULE_48E,
    run: (sol) => {
      const step = ventStep(sol, 'gas-b1-outby');
      const ok = !!step?.actions.some((a) => a.el === 'barricade-1');
      return {
        ok,
        expected: 'rebuild barricade-1 before winging the explosive mixture',
        got: ok ? 'barricade put back up on that vent' : step ? 'vent happens without rebuilding it' : 'explosive mixture never ventilated'
      };
    }
  },
  {
    id: 'rebuild-down:barricade-1',
    what: 'Second vent is made with the first barricade down, toward the second barricade',
    rule: RULE_35,
    run: (sol) => {
      const step = ventStep(sol, 'gas-b1');
      const rebuilt = !!step?.actions.some((a) => a.el === 'barricade-1');
      const ok = !!step && !rebuilt;
      return {
        ok,
        expected: 'ventilate the 19.0% O2 with the first barricade taken down',
        got: !step ? '19.0% O2 never ventilated' : rebuilt ? 'barricade is still being rebuilt on this vent' : 'barricade is down for this vent'
      };
    }
  },
  {
    id: 'vent-avoid:body-n3',
    what: 'The 19.0% O2 is not sent over the person under unsafe roof in No. 3',
    rule: RULE_30F,
    run: (sol) => {
      const crosses = courseCrosses(sol, 'gas-b1', 'body-n3');
      const vent = sol.plan.vents.find((v) => v.plan.target === 'gas-b1');
      const ok = !!vent?.plan.ok && !crosses;
      return {
        ok,
        expected: 'irrespirable air does not travel the opening the person is in',
        got: !vent ? 'not ventilated' : crosses ? `course crosses that opening (${vent.plan.course.join(' → ')})` : 'course stays off that opening'
      };
    }
  },
  {
    id: 'support-before:body-n3',
    what: 'Timber to the person under unsafe roof in No. 3 before team stop 12',
    rule: RULE_32,
    run: (sol) => {
      const at = sol.plan.steps.findIndex((s) => s.kind === 'support' && s.subject === 'body-n3');
      const limit = sol.plan.steps.findIndex((s) => s.kind === 'stop' && s.n === 12);
      const ok = at >= 0 && (limit < 0 || at < limit);
      return {
        ok,
        expected: 'timber and examine before stop 12',
        got: at < 0 ? 'never timbered' : `support step ${at}, stop 12 is step ${limit}`
      };
    }
  },
  {
    id: 'timbers-broken-unused',
    what: 'The four broken timbers in the No. 1 face are not used',
    rule: RULE_30A_TIMBERS,
    run: (sol) => {
      const used = sol.plan.changed.has('timbers-broken');
      const noted = sol.plan.steps.some((s) => s.actions.some((a) => a.el === 'timbers-broken' && /cannot be used/i.test(a.text)));
      return {
        ok: !used && noted,
        expected: 'placard recorded as unusable, and not used',
        got: used ? 'counted as usable timbers' : noted ? 'left unused' : 'found without noting they cannot be used'
      };
    }
  }
];

export const OFFICIAL: OfficialFixture[] = [
  {
    id: 'figure-7',
    title: 'Rule book Figure 7 — systematic exploration',
    source: '2026 Coal Mine Rescue Rules, Figure 7, page 49. Team stops are printed on the figure.',
    problem: figure7,
    key: fig7Key,
    stopRule: RULE_44D,
    rescueRule: RULE_41,
    reachRule: RULE_32,
    ventRule: RULE_35,
    withdrawalRule: RULE_31B,
    foundRule: RULE_44A
  },
  {
    id: 'post5-2016-day1',
    title: '2016 Post 5 & WV State — Day 1',
    source: 'problems/msha-archive/coal/2016/2016_Post_5_Day_1_Mine_Rescue.pdf, team-stop map and Keys to Problem',
    pdf: 'problems/msha-archive/coal/2016/2016_Post_5_Day_1_Mine_Rescue.pdf',
    problem: post5Day1,
    key: KEY,
    stopRule: RULE_44D,
    stopRules: { '1,4': RULE_44B, '2,4': RULE_44B, '0,4': RULE_44B },
    rescueRule: RULE_41,
    reachRule: RULE_32,
    ventRule: RULE_35,
    withdrawalRule: RULE_31B,
    foundRule: RULE_44A,
    extras: post5Extras
  }
];
