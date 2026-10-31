import { Link } from 'react-router-dom';
import { ALL_EVENTS, useData, useEvent } from '../data/DataContext';
import { quizConfig } from '../quiz/quizConfig';
import { loadTimerSettings, mockPlan, sessionMinutes } from '../quiz/mock';
import { loadStats } from '../quiz/stats';

/**
 * A fragment of a mine map, the thing a rescue team studies: pillars of coal, three entries,
 * crosscuts between them, two stoppings, air direction, and the team's route with its stops.
 */
function MineMap() {
  // Pillars 70 wide by 40 tall; entries run left to right between the rows, crosscuts top to bottom between the columns.
  const cols = [20, 110, 200, 290];
  const rows = [-20, 60, 120, 180];
  return (
    <svg className="mine-map" viewBox="0 0 360 200" width="360" height="200" aria-hidden="true" focusable="false">
      {rows.map((y) => cols.map((x) => <rect key={`${x}-${y}`} className="pillar" x={x} y={y} width={70} height={40} rx={3} />))}
      <rect className="pillar" x={-60} y={-20} width={70} height={40} rx={3} />
      <rect className="pillar" x={-60} y={60} width={70} height={40} rx={3} />
      <rect className="pillar" x={-60} y={120} width={70} height={40} rx={3} />
      <rect className="pillar" x={-60} y={180} width={70} height={40} rx={3} />
      {/* Stoppings across two crosscuts between the first and second entry */}
      <line className="stopping" x1={110} y1={80} x2={90} y2={80} />
      <line className="stopping" x1={290} y1={80} x2={270} y2={80} />
      {/* Air direction in the return entry */}
      <path className="air" d="M332 170h-20m5-5-5 5 5 5" />
      <path className="air" d="M242 170h-20m5-5-5 5 5 5" />
      <path className="air" d="M152 170h-20m5-5-5 5 5 5" />
      {/* Team route: along the first entry, down a crosscut, along the second, down again */}
      <path className="route" d="M-10 50H190V110H280V170H372" />
      <circle className="stop" cx={100} cy={50} r={5} />
      <circle className="stop" cx={190} cy={50} r={5} />
      <circle className="stop" cx={190} cy={110} r={5} />
      <circle className="stop" cx={280} cy={110} r={5} />
      <circle className="team" cx={280} cy={170} r={6} />
    </svg>
  );
}

export default function Home() {
  const data = useData();
  const { rules, facts, figures, parts, document, issues, factEvents } = data;
  const { event } = useEvent();
  const all = event === ALL_EVENTS;
  const inEv = <T extends { event?: string }>(xs: T[]) => (all ? xs : xs.filter((x) => x.event === event));
  const evRules = inEv(rules);
  const evFacts = inEv(facts);
  const evFigures = inEv(figures);
  const evParts = inEv(parts);
  const ev = data.eventInfo(all ? undefined : event);
  const plan = mockPlan(event, ev, evParts.length > 0);
  const mMin = all ? null : sessionMinutes(loadTimerSettings(), 'mock', event, plan.officialMinutes);
  const stats = loadStats();
  const errors = issues.filter((i) => i.level === 'error').length;
  const edition = data.editionFor(all ? undefined : event);
  const title = all ? 'All events' : ev?.name ?? 'Mine Rescue Study';
  return (
    <div>
      <section className="hero">
        <div className="hero-text">
          <h1>{title}</h1>
          <p className="hero-doc">{ev?.documentTitle ?? document.title ?? 'Mine rescue contest rules and statements'}</p>
          {edition && <p className="hero-edition">{edition}</p>}
        </div>
        <MineMap />
      </section>
      {all && factEvents.length > 1 && <p className="note small home-note">Showing all events. Choose an event in the header menu to take a quiz or mock exam.</p>}
      <div className="tiles">
        <h2 className="home-h">Practice</h2>
        <div className="tile-grid">
          <Link className="tile" to="/quiz">
            <strong>Quiz</strong>
            <span>{quizConfig.distractorCount + 1}-choice questions from the statements{evParts.length ? ' and parts tables' : ''}</span>
          </Link>
          {!all && (
            <Link className="tile" to="/quiz?mode=mock">
              <strong>Mock exam</strong>
              <span>
                {plan.facts} statements{plan.parts ? ` + ${plan.parts} parts` : ''}, {mMin ? `${mMin} min timer` : 'untimed'}, scored at the end
              </span>
            </Link>
          )}
          {!all && evRules.length > 0 && (
            <Link className="tile" to="/quiz?kind=rules">
              <strong>Rules quiz</strong>
              <span>Fill the blank in sentences from the {ev?.name ?? ''} rule book</span>
            </Link>
          )}
        </div>
        <h2 className="home-h">Reference and tools</h2>
        <ul className="tile-list">
          <li>
            <Link className="tile-row" to="/rules">
              <strong>Rule book</strong>
              <span>{evRules.length} rules by section</span>
            </Link>
          </li>
          <li>
            <Link className="tile-row" to="/statements">
              <strong>Statements</strong>
              <span>{evFacts.length} statements</span>
            </Link>
          </li>
          {evParts.length > 0 && (
            <li>
              <Link className="tile-row" to="/parts">
                <strong>Identification of Parts</strong>
                <span>
                  {evParts.length} tables, {evParts.reduce((n, t) => n + t.rows.length, 0)} parts
                </span>
              </Link>
            </li>
          )}
          <li>
            <Link className="tile-row" to="/search">
              <strong>Search</strong>
              <span>Rules, statements and parts together</span>
            </Link>
          </li>
          <li>
            <Link className="tile-row" to="/builder">
              <strong>Problem builder</strong>
              <span>Place placards on a blank mine map, then solve it: team stops, mapping key, ventilation</span>
            </Link>
          </li>
          {evFigures.length > 0 && (
            <li>
              <Link className="tile-row" to="/figures">
                <strong>Figures</strong>
                <span>{evFigures.length} diagrams, skill sheets and legend pages</span>
              </Link>
            </li>
          )}
        </ul>
      </div>
      {factEvents.length > 1 && (
        <table className="counts">
          <caption>Loaded content per event</caption>
          <thead>
            <tr><th scope="col">Event</th><th scope="col">Rules</th><th scope="col">Statements</th><th scope="col">Parts tables</th><th scope="col">Figures</th></tr>
          </thead>
          <tbody>
            {factEvents.map((e) => {
              const current = !all && e.id === event;
              return (
                <tr key={e.id} className={current ? 'current' : undefined} aria-current={current ? 'true' : undefined}>
                  <td>{e.name}</td>
                  <td>{rules.filter((r) => r.event === e.id).length}</td>
                  <td>{facts.filter((f) => f.event === e.id).length}</td>
                  <td>{parts.filter((t) => t.event === e.id).length || '—'}</td>
                  <td>{figures.filter((f) => f.event === e.id).length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {stats.answered > 0 && (
        <p className="muted small progress-line">
          Your progress: {stats.correct}/{stats.answered} correct ({Math.round((100 * stats.correct) / stats.answered)}%), best streak {stats.bestStreak},{' '}
          {Object.keys(stats.perFact).length} questions practised.
        </p>
      )}
      {errors > 0 && (
        <p className="warn small home-warn">
          {errors} content record(s) could not be loaded. <Link to="/about">Details</Link>
        </p>
      )}
    </div>
  );
}
