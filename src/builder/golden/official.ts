/**
 * Problems whose official step-by-step solution is already written down in this repo.
 * Add a fixture here when a judge key or the rule book gives the team stops and the required actions.
 * Do not fill one in by running the solver and calling that the official answer.
 */
import type { JudgeKey } from '../judge';
import { KEY as POST5_KEY, post5Day1 } from '../cases/post5-2016-day1';
import { KEY as N24_KEY, national2024Day1 } from '../cases/national-2024-day1';
import { FIGURE7_STOPS, figure7 } from '../samples';
import type { Solution } from '../solve';
import { RULE_30A_TIMBERS, RULE_30F, RULE_31A, RULE_31B, RULE_31C, RULE_31D, RULE_32, RULE_35, RULE_41, RULE_42, RULE_44A, RULE_44B, RULE_44D, RULE_44E, RULE_48E } from './cites';
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
    key: POST5_KEY,
    stopRule: RULE_44D,
    stopRules: { '1,4': RULE_44B, '2,4': RULE_44B, '0,4': RULE_44B },
    rescueRule: RULE_41,
    reachRule: RULE_32,
    ventRule: RULE_35,
    withdrawalRule: RULE_31B,
    foundRule: RULE_44A,
    extras: post5Extras
  },
  {
    id: 'national-2024-day1',
    title: '2024 National — Coal Day 1',
    source: 'https://minerescuecenter.com/media/problems/2024_national_Coal_Mine_Rescue_2024_National_Coal_Rescue_Day_1.pdf — judges’ stop-by-stop text. Scored on the 2026 rule text; the 2024 judges cite the same rule numbers.',
    problem: national2024Day1,
    key: N24_KEY,
    stopRule: RULE_44D,
    stopRules: { '2,1': RULE_44E },
    rescueRule: RULE_41,
    reachRule: RULE_32,
    ventRule: RULE_35,
    withdrawalRule: RULE_31B,
    foundRule: RULE_44A,
    extras: [
      {
        id: 'airlock-before:stop-5',
        what: 'Airlock the permanent stopping at stop 1 before team stop 5',
        rule: RULE_44E,
        run: (sol) => {
          const at = sol.plan.steps.findIndex((s) => s.kind === 'breach' && s.subject === 'perm-xc');
          const limit = sol.plan.steps.findIndex((s) => s.kind === 'stop' && s.n === 5);
          const ok = at >= 0 && limit > at;
          return {
            ok,
            expected: 'permanent stopping opened before stop 5',
            got: at < 0 ? 'never opened' : `opened at step ${at}; stop 5 is step ${limit}`
          };
        }
      },
      {
        id: 'barricade-after-vent',
        what: 'The No. 3 face barricade is opened only after the 18.3% oxygen is removed',
        rule: RULE_35,
        run: (sol) => {
          const vent = sol.plan.cleared.get('gas-barricade');
          const breach = sol.plan.steps.findIndex((s) => s.kind === 'breach' && s.subject === 'barricade-face');
          const ok = vent !== undefined && breach > vent;
          return {
            ok,
            expected: '18.3% oxygen ventilated, then the barricade breached',
            got: vent === undefined ? '18.3% oxygen never ventilated' : breach < 0 ? 'barricade not breached' : `ventilated at step ${vent}, breached at step ${breach}`
          };
        }
      },
      {
        id: 'unconscious-before-barricade',
        what: 'The unconscious person is at the FAB before the barricade is opened',
        rule: RULE_41,
        run: (sol) => {
          const rescue = sol.plan.steps.findIndex((s) => s.kind === 'recover' && s.subject === 'person-unconscious');
          const breach = sol.plan.steps.findIndex((s) => s.kind === 'breach' && s.subject === 'barricade-face');
          const ok = rescue >= 0 && breach > rescue;
          return { ok, expected: 'unconscious person rescued before the barricade is breached', got: rescue < 0 ? 'not rescued' : breach < 0 ? 'barricade not breached' : `rescued at step ${rescue}, barricade at step ${breach}` };
        }
      },
      {
        id: 'timber-elongated-body',
        what: 'The body under the elongated unsafe roof is timbered after the barricade patient is at the FAB',
        rule: RULE_32,
        run: (sol) => {
          const rescue = sol.plan.steps.findIndex((s) => s.kind === 'recover' && s.subject === 'person-barricade');
          const timber = sol.plan.steps.findIndex((s) => s.kind === 'support' && s.subject === 'body-elongated');
          const ok = rescue >= 0 && timber > rescue;
          return { ok, expected: 'body timbered after the barricade patient reaches the FAB', got: timber < 0 ? 'body not timbered' : `timbered at step ${timber}, patient at step ${rescue}` };
        }
      },
      {
        id: 'either-water-first',
        what: 'Either water-roofed area may be pumped first, and both are pumped before the barricade is ventilated',
        rule: RULE_42,
        run: (sol) => {
          const pumps = sol.plan.steps.filter((s) => s.kind === 'pump').map((s) => s.subject);
          const a = pumps.indexOf('water-stop3');
          const b = pumps.indexOf('water-stop9');
          const vent = sol.plan.cleared.get('gas-barricade');
          const pumpSteps = sol.plan.steps.map((s, i) => (s.kind === 'pump' ? i : -1)).filter((i) => i >= 0);
          const lastPump = pumpSteps.length ? Math.max(...pumpSteps) : -1;
          const both = a >= 0 && b >= 0;
          const beforeVent = vent !== undefined && lastPump >= 0 && lastPump < vent;
          return {
            ok: both && beforeVent,
            expected: 'both waters pumped, in either order, before the 18.3% oxygen is ventilated',
            got: `pumps ${pumps.join(' then ') || 'none'}; 18.3% ventilated at step ${vent ?? 'never'}`
          };
        }
      },
      {
        id: 'gas-57-remains',
        what: 'The 5.7% mixture just inby the fresh air base is not cleared',
        rule: RULE_31A,
        run: (sol) => {
          const cleared = sol.plan.cleared.has('gas-57');
          return { ok: !cleared, expected: '5.7% mixture left in place', got: cleared ? 'ventilated' : 'left in place' };
        }
      },
      {
        id: 'vents-before-water',
        what: 'Vents 1 and 2 clear the No. 1 and No. 3 explosive mixtures before either water is pumped',
        rule: RULE_31A,
        run: (sol) => {
          const firstPump = sol.plan.steps.findIndex((s) => s.kind === 'pump');
          const ids = ['gas-v1a', 'gas-v1b', 'gas-v2a', 'gas-v2b'];
          const late = ids.filter((id) => {
            const at = sol.plan.cleared.get(id);
            return at === undefined || firstPump < 0 || at > firstPump;
          });
          return {
            ok: late.length === 0,
            expected: '5.3/6/19.3, 5.1/7/19.1, 5.3/7/19.5 and 5.1/5/19.5 cleared before the first pump',
            got: late.length === 0 ? 'all four cleared before the first pump' : `${late.join(', ')} not cleared before the pump`
          };
        }
      },
      {
        id: 'move-pump-cable',
        what: 'The pump cable is moved out of the 5.7% mixture before the pump is energized',
        rule: RULE_31D,
        run: (sol) => {
          const move = sol.plan.steps.findIndex((s) => s.kind === 'move' && s.subject === 'pump-cable');
          const pump = sol.plan.steps.findIndex((s) => s.kind === 'pump');
          const still = sol.plan.steps.some((s) => s.kind === 'withdraw');
          return {
            ok: move >= 0 && pump > move && !still,
            expected: 'pump cable moved, then the pump energized, and the team does not withdraw',
            got: move < 0 ? 'cable not moved' : pump < 0 ? 'never pumped' : pump < move ? 'pumped before the move' : still ? 'team withdrew' : `moved at step ${move}, pumped at step ${pump}`
          };
        }
      },
      {
        id: 'airlock-back-out',
        what: 'After each water is pumped, the airlock is put back so the running fan does not move the stop-11 explosive over unexplored ground',
        rule: RULE_31C,
        run: (sol) => {
          const after = (id: string) => {
            const pump = sol.plan.steps.findIndex((s) => s.kind === 'pump' && s.subject === id);
            const back = sol.plan.steps.findIndex((s, i) => i > pump && s.kind === 'airlock' && s.subject === id);
            return pump >= 0 && back > pump;
          };
          const a = after('water-stop3');
          const b = after('water-stop9');
          return {
            ok: a && b,
            expected: 'airlock put back after water-stop3 and after water-stop9',
            got: `stop-3 water ${a ? 'closed back' : 'left open'}; stop-9 water ${b ? 'closed back' : 'left open'}`
          };
        }
      }
    ]
  }
];
