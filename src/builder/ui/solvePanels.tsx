import { elementName, placardText } from '../catalog';
import type { Step } from '../explore';
import type { El, Problem } from '../model';
import { gasReasons } from '../rules';
import type { Solution } from '../solve';
import type { Airflow, VentFinding } from '../vent';
import { Checks, Section } from './panels';
import { RuleRefs } from './RuleRefs';
import { SymbolIcon } from './symbols';

const LEVEL_ICON = { danger: '⚠', must: '●', info: '○' } as const;

function StepBody({ step, sol, onSelectEl }: { step: Step; sol: Solution; onSelectEl: (id: string) => void }) {
  return (
    <div className="step-body">
      <ul className="actions-list">
        {step.actions.map((a, i) => (
          <li key={i} className={`act ${a.level ?? 'info'}`}>
            <span className="act-icon" aria-hidden="true">
              {LEVEL_ICON[a.level ?? 'info']}
            </span>
            <span>
              {a.text} {a.rules.length > 0 && <span className="muted small">(<RuleRefs ids={a.rules} />)</span>}
              {a.el && (
                <button type="button" className="link" onClick={() => onSelectEl(a.el!)}>
                  show
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {step.notes.map((n, i) => (
        <p key={i} className="note small">
          {n}
        </p>
      ))}
      {step.found.length > 0 && (
        <p className="small muted">
          Found here:{' '}
          {step.found.map((id, i) => {
            const el = sol.board.placed.get(id)?.el;
            if (!el) return null;
            return (
              <span key={id}>
                {i > 0 && ', '}
                <button type="button" className="link" onClick={() => onSelectEl(id)}>
                  {elementName(el)}
                  {placardText(el) && placardText(el).toUpperCase() !== elementName(el).toUpperCase() ? ` (${placardText(el)})` : ''}
                </button>
              </span>
            );
          })}
        </p>
      )}
    </div>
  );
}

export function SolvePanel({ sol, stepIdx, setStepIdx, onSelectEl }: { sol: Solution; stepIdx: number | null; setStepIdx: (i: number | null) => void; onSelectEl: (id: string) => void }) {
  const { plan } = sol;
  const p = sol.board.problem;
  const stops = plan.steps.filter((s) => s.n).length;
  const live = sol.items.filter((i) => i.el.kind === 'person').length;
  const bodies = sol.items.filter((i) => i.el.kind === 'body').length;
  return (
    <div className="solve-panel">
      <div className={`card summary ${plan.withdrawal ? 'bad' : ''}`}>
        {plan.withdrawal ? (
          <p>
            <strong>Withdrawal situation</strong> at step {plan.withdrawal.step}: {plan.withdrawal.reason} <RuleRefs ids={['b-card-31']} />
          </p>
        ) : (
          <p>
            <strong>{stops} team stops</strong>, {plan.steps.length} steps.
          </p>
        )}
        <p className={p.missing > live + bodies ? 'warn' : ''}>
          Persons accounted for: {live} live, {bodies} {bodies === 1 ? 'body' : 'bodies'}
          {p.missing ? ` of ${p.missing} missing` : ''}.
        </p>
        {plan.unexplored.length > 0 && (
          <p className="small">
            Not explored: {plan.unexplored.map((u) => `${u.where} (${u.why})`).join('; ')}.
          </p>
        )}
        <p className="small muted">One rule-consistent solution, worked out from the 2026 rules. Other orders can also be acceptable; check the official rule book.</p>
      </div>
      <div className="walk" role="group" aria-label="Walk through the solution">
        <button type="button" onClick={() => setStepIdx(Math.max(0, (stepIdx ?? 0) - 1))} disabled={stepIdx === 0}>
          ◀ Prev
        </button>
        <span className="walk-pos">{stepIdx === null ? 'Whole solution' : `Step ${stepIdx + 1} of ${plan.steps.length}`}</span>
        <button type="button" onClick={() => setStepIdx(stepIdx === null ? 0 : Math.min(plan.steps.length - 1, stepIdx + 1))} disabled={stepIdx === plan.steps.length - 1}>
          Next ▶
        </button>
        <button type="button" className="link" onClick={() => setStepIdx(null)} disabled={stepIdx === null}>
          Show all
        </button>
      </div>
      <ol className="steps">
        {plan.steps.map((s, i) => (
          <li key={i} className={`step ${s.kind}${i === stepIdx ? ' on' : ''}`} ref={i === stepIdx ? (n) => n?.scrollIntoView({ block: 'nearest' }) : undefined}>
            <button type="button" className="step-head" onClick={() => setStepIdx(i === stepIdx ? null : i)} aria-expanded={i === stepIdx}>
              <span className="step-no">{s.n ? `#${s.n}` : s.kind === 'fab' ? 'FAB' : s.kind === 'done' ? '✓' : s.kind === 'withdraw' ? '⚠' : '·'}</span>
              <span>{s.title}</span>
            </button>
            {i === stepIdx && <StepBody step={s} sol={sol} onSelectEl={onSelectEl} />}
          </li>
        ))}
      </ol>
      <Section title="Mapping key (A Card 5 and 6)" count={sol.items.length} open={false}>
        <div className="table-wrap">
          <table className="map-key">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Write beside it</th>
                <th>Where</th>
                <th title="Team map (A Card 5)">Team</th>
                <th title="Briefing officer / CCA map (A Card 6)">BO</th>
              </tr>
            </thead>
            <tbody>
              {sol.items.map((it) => (
                <tr key={it.el.id}>
                  <td>
                    <button type="button" className="link sym-link" onClick={() => onSelectEl(it.el.id)} title={elementName(it.el)}>
                      <SymbolIcon el={it.el} size={24} />
                    </button>
                  </td>
                  <td>
                    {it.text}
                    {it.note && <div className="muted small">{it.note}</div>}
                  </td>
                  <td className="small">{it.where}</td>
                  <td>{it.preShown ? <span title="Already shown on the blank maps">pre</span> : it.team ? '✓' : ''}</td>
                  <td>{it.preShown ? <span title="Already shown on the blank maps">pre</span> : it.bo ? '✓' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          Verbatim means in sequence, not stacked or oriented like the card; symbols from the legend replace the placard wording; objects must be within 6 ft of the key map (team map only). <RuleRefs ids={['a-card-5', 'a-card-6']} />
        </p>
      </Section>
      {sol.changes.length > 0 && (
        <Section title="Conditions left in the mine (note on the maps)" count={sol.changes.length} open={false}>
          <ul className="small">
            {sol.changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Section>
      )}
      {sol.notMapped.length > 0 && (
        <Section title="Not reached — do not map" count={sol.notMapped.length} open={false}>
          <p className="small muted">
            Conditions or objects marked in areas the team did not explore are discounted. <RuleRefs ids={['a-card-4']} />
          </p>
          <ul className="small">
            {sol.notMapped.map((it) => (
              <li key={it.el.id}>
                {elementName(it.el)} — {it.text} <span className="muted">({it.where})</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <HazardList sol={sol} onSelectEl={onSelectEl} />
      <Section title="Design checks" count={sol.checks.length} open={false}>
        <Checks checks={sol.checks} onSelect={onSelectEl} />
      </Section>
    </div>
  );
}

function HazardList({ sol, onSelectEl }: { sol: Solution; onSelectEl: (id: string) => void }) {
  const hz = sol.plan.hazards;
  if (!hz.length) return null;
  return (
    <Section title="Gases and smoke" count={hz.length} open={false}>
      <ul className="hz-list">
        {hz.map((h) => (
          <li key={h.el.id}>
            <button type="button" className="link" onClick={() => onSelectEl(h.el.id)}>
              {h.el.kind === 'smoke' ? `Smoke${h.el.density ? ` (${h.el.density})` : ''}` : placardText(h.el)}
            </button>{' '}
            {h.cls.explosive && <span className="chip static small danger">Explosive</span>}
            {h.cls.irrespirable && <span className="chip static small warnc">Irrespirable</span>}
            {h.cls.contaminant && <span className="chip static small">Contaminant</span>}
            {h.cls.fireEvidence && <span className="chip static small">Evidence of fire</span>}
            {h.el.kind === 'gas' && <div className="small muted">{gasReasons(h.el).join('; ') || 'normal air'}</div>}
          </li>
        ))}
      </ul>
      <p className="small muted">
        Hatched on the map: how far each extends (Rule 24E). Explosive: 5–15% CH4 with 12.1% O2 or more (Rule 31). Irrespirable: under 19.5% O2, over 50 PPM CO, or smoke (Rule 34). Contaminant: smoke, over 10 PPM CO, over 1% CH4 or under 19.5% O2 (Rule 44).
      </p>
    </Section>
  );
}

// ------------------------------------------------------------ ventilation

export interface Scenario {
  /** Structures taken down, fires put out. */
  removed: string[];
  /** Field overrides (door open/closed, fan on/mode). */
  overrides: Record<string, Partial<El>>;
  /** Temporary stoppings built by the team. */
  added: El[];
}

export const emptyScenario = (): Scenario => ({ removed: [], overrides: {}, added: [] });

export function applyScenario(p: Problem, sc: Scenario): El[] {
  return [...p.elements.filter((e) => !sc.removed.includes(e.id)).map((e) => (sc.overrides[e.id] ? { ...e, ...sc.overrides[e.id] } : e)), ...sc.added];
}

export function VentPanel({
  p,
  sc,
  setSc,
  af,
  findings,
  base,
  tool,
  setTool
}: {
  p: Problem;
  sc: Scenario;
  setSc: (s: Scenario) => void;
  af: Airflow;
  findings: VentFinding[];
  base: Airflow;
  tool: string;
  setTool: (t: 'vent-build' | 'vent-toggle' | 'select') => void;
}) {
  const fans = p.elements.filter((e) => e.kind === 'fan');
  const changes: string[] = [
    ...sc.removed.map((id) => {
      const el = p.elements.find((e) => e.id === id);
      return el ? `${elementName(el)}${placardText(el) ? ` “${placardText(el)}”` : ''}: ${el.kind === 'fire' ? 'put out' : 'taken down'}` : '';
    }),
    ...Object.entries(sc.overrides).map(([id, o]) => {
      const el = p.elements.find((e) => e.id === id);
      if (!el) return '';
      if (el.kind === 'door') return `Door: ${o.open ? 'opened' : 'closed'}`;
      if (el.kind === 'fan') return `Fan: ${o.on === false ? 'stopped' : `running, ${o.fanMode ?? el.fanMode}`}`;
      return `${elementName(el)} changed`;
    }),
    ...sc.added.map(() => 'Temporary stopping built')
  ].filter(Boolean);
  return (
    <div className="vent-panel">
      <div className="card">
        <p>
          <strong>Airflow estimate.</strong> Blue arrows show where air moves. {af.note}
        </p>
        <p className="small muted">
          Openings: {af.openings.join(', ') || 'none'}. Airflow enters all openings where exhaust ventilation applies and exits all openings where blowing ventilation applies. <RuleRefs ids={['misc-4']} />
        </p>
        <p className="small muted">A teaching estimate of “what moves where if we change this”, using Kirchhoff’s laws over the openings — not a ventilation survey.</p>
      </div>
      <Section title="What if the team…">
        <div className="seg">
          <button type="button" className={`chip${tool === 'vent-toggle' ? ' on' : ''}`} onClick={() => setTool(tool === 'vent-toggle' ? 'select' : 'vent-toggle')} aria-pressed={tool === 'vent-toggle'}>
            Take down / put back a structure
          </button>
          <button type="button" className={`chip${tool === 'vent-build' ? ' on' : ''}`} onClick={() => setTool(tool === 'vent-build' ? 'select' : 'vent-build')} aria-pressed={tool === 'vent-build'}>
            Build a temporary stopping
          </button>
        </div>
        <p className="small muted">
          {tool === 'vent-toggle'
            ? 'Click a stopping, door, seal, barricade, diagonal or fire on the map. Doors open and close; fires are put out.'
            : tool === 'vent-build'
              ? 'Click an entry or crosscut to build a temporary stopping across it (click it again to take it down).'
              : 'Pick a change above, then click the map.'}
        </p>
        {fans.map((f) => {
          const o = { ...f, ...(sc.overrides[f.id] ?? {}) };
          const set = (patch: Partial<El>) => setSc({ ...sc, overrides: { ...sc.overrides, [f.id]: { ...(sc.overrides[f.id] ?? {}), ...patch } } });
          return (
            <div key={f.id} className="fan-ctl">
              <span>Fan{placardText(f) ? ` (${placardText(f)})` : ''}:</span>
              <label className="field check">
                <input type="checkbox" checked={o.on !== false} onChange={(e) => set({ on: e.target.checked })} /> <span>Running</span>
              </label>
              <select value={o.fanMode ?? 'exhausting'} onChange={(e) => set({ fanMode: e.target.value as El['fanMode'] })} aria-label="Fan mode">
                <option value="exhausting">Exhausting</option>
                <option value="blowing">Blowing</option>
              </select>
            </div>
          );
        })}
        {changes.length > 0 ? (
          <>
            <ul className="small">
              {changes.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
            <button type="button" onClick={() => setSc(emptyScenario())}>
              Reset to the problem as found
            </button>
          </>
        ) : (
          <p className="small muted">No changes yet: the map shows the mine as found{base.flow.size ? '' : ' (no air moving)'}.</p>
        )}
        <p className="small muted">
          The team must notify the briefing officer and obtain permission before ventilation changes are made. <RuleRefs ids={['b-card-19']} />
        </p>
      </Section>
      <Section title="What the air would carry" count={findings.length}>
        <ul className="checks">
          {findings.map((f, i) => (
            <li key={i} className={f.level === 'danger' ? 'error' : f.level === 'warn' ? 'warn' : 'info'}>
              <span className="lvl">{f.level === 'danger' ? 'Violation' : f.level === 'warn' ? 'Caution' : 'OK'}</span> {f.text} <span className="muted small">(<RuleRefs ids={f.rules} />)</span>
            </li>
          ))}
          {!findings.length && <li className="info">No air is moving smoke or gas.</li>}
        </ul>
        <p className="small muted">“Unexplored” means areas the solution never reaches (behind seals, caved areas, water, unsafe roof). Unaccounted-for persons are treated as potentially live (Rule 30F).</p>
      </Section>
    </div>
  );
}
