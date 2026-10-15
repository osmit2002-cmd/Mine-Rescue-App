import { Link } from 'react-router-dom';
import { EventPicker } from '../components/EventPicker';
import { ALL_EVENTS, useData, useEvent } from '../data/DataContext';
import { quizConfig } from '../quiz/quizConfig';
import { loadTimerSettings, mockPlan, sessionMinutes } from '../quiz/mock';
import { loadStats } from '../quiz/stats';

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
  return (
    <div>
      <section className="hero">
        <h1>Mine Rescue Study</h1>
        <p>{ev?.documentTitle ?? document.title ?? 'Mine rescue contest rules and statements of fact'}</p>
        {edition && <p className="edition-badge">{edition}</p>}
      </section>
      {factEvents.length > 1 && (
        <>
          <h2 className="small">Contest event</h2>
          <EventPicker />
        </>
      )}
      <div className="tiles">
        <Link className="tile" to="/quiz">
          <strong>Quiz</strong>
          <span>{quizConfig.distractorCount + 1}-choice questions from the statements of fact{evParts.length ? ' and parts tables' : ''}</span>
        </Link>
        {!all && (
          <Link className="tile" to="/quiz?mode=mock">
            <strong>Mock exam</strong>
            <span>
              {plan.facts} statements{plan.parts ? ` + ${plan.parts} parts` : ''}, {mMin ? `${mMin} min timer` : 'untimed'}, scored at the end
            </span>
          </Link>
        )}
        <Link className="tile" to="/rules">
          <strong>Rule book</strong>
          <span>{evRules.length} rules by section</span>
        </Link>
        <Link className="tile" to="/facts">
          <strong>Statements of fact</strong>
          <span>{evFacts.length} statements</span>
        </Link>
        {evParts.length > 0 && (
          <Link className="tile" to="/parts">
            <strong>Identification of Parts</strong>
            <span>
              {evParts.length} tables, {evParts.reduce((n, t) => n + t.rows.length, 0)} parts
            </span>
          </Link>
        )}
        <Link className="tile" to="/search">
          <strong>Search</strong>
          <span>Rules, statements and parts together</span>
        </Link>
        {evFigures.length > 0 && (
          <Link className="tile" to="/figures">
            <strong>Figures</strong>
            <span>{evFigures.length} diagrams, skill sheets and legend pages</span>
          </Link>
        )}
      </div>
      {factEvents.length > 1 && (
        <table className="counts small">
          <caption className="muted">Loaded content per event</caption>
          <thead>
            <tr><th>Event</th><th>Rules</th><th>Statements</th><th>Parts tables</th><th>Figures</th></tr>
          </thead>
          <tbody>
            {factEvents.map((e) => (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td>{rules.filter((r) => r.event === e.id).length}</td>
                <td>{facts.filter((f) => f.event === e.id).length}</td>
                <td>{parts.filter((t) => t.event === e.id).length || '—'}</td>
                <td>{figures.filter((f) => f.event === e.id).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {stats.answered > 0 && (
        <p className="muted small">
          Your progress: {stats.correct}/{stats.answered} correct ({Math.round((100 * stats.correct) / stats.answered)}%), best streak {stats.bestStreak},{' '}
          {Object.keys(stats.perFact).length} questions practised.
        </p>
      )}
      {errors > 0 && (
        <p className="warn small">
          {errors} content record(s) could not be loaded. <Link to="/about">Details</Link>
        </p>
      )}
    </div>
  );
}
