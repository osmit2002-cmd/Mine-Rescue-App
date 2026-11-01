import { Link } from 'react-router-dom';
import { ALL_EVENTS, useData, useEvent } from '../data/DataContext';
import { quizConfig } from '../quiz/quizConfig';
import { loadTimerSettings, mockPlan, sessionMinutes } from '../quiz/mock';
import { loadStats } from '../quiz/stats';

/**
 * A contest problem map, the thing a rescue team studies: two pillars of coal with the entries and
 * crosscuts open around them, the ribs of the mine at the edges, air direction, and the team's route
 * with its team stops. The whole map is inside the viewBox, so it scales without cropping on any screen.
 */
function MineMap() {
  // Openings are 36 wide. Entries run left (outby) to right (inby) above and below the pillars,
  // and three crosscuts run top to bottom: outby of the first pillar, between the two, and inby of the second.
  const stops: Array<[number, number]> = [
    [42, 158],
    [178, 158],
    [178, 42],
    [314, 42]
  ];
  return (
    <svg className="hero-map" viewBox="0 0 360 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      {/* Ribs: the solid coal around the openings, drawn as one frame that runs off every edge */}
      <path className="rib" fillRule="evenodd" d="M-10-10H370V210H-10Z M24 24V176H332V24Z" />
      {/* Two pillars */}
      <rect className="pillar" x={60} y={60} width={100} height={80} rx={3} />
      <rect className="pillar" x={196} y={60} width={100} height={80} rx={3} />
      {/* Air direction: up the outby crosscut and out along the top entry */}
      <path className="air" d="M42 114V94m-5 5 5-5 5 5" />
      <path className="air" d="M142 42h-20m5-5-5 5 5 5" />
      {/* Team route: along the bottom entry, up the middle crosscut, along the top entry, down the inby crosscut */}
      <path className="route" d="M42 158H178V42H314V100" />
      {stops.map(([x, y]) => (
        <circle key={`${x}-${y}`} className="stop" cx={x} cy={y} r={5} />
      ))}
      <circle className="team" cx={314} cy={100} r={6} />
    </svg>
  );
}

function Chevron() {
  return (
    <svg className="tile-chevron" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Simple stroke icons on a 24 grid, one per destination, drawn in the card's or row's own colour. */
const ICONS = {
  quiz: 'm3 7 2 2 4-4M3 17l2 2 4-4M13 6h8M13 12h8M13 18h8',
  mock: 'M10 2h4M12 14l3-3M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
  rules: 'M12 20h9M16.4 3.6a2.1 2.1 0 0 1 3 3L7.4 18.6l-4 1 1-4Z',
  book: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20',
  statements: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM14 2v5h6M10 9H8M16 13H8M16 17H8',
  parts: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9Z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  builder: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  figures: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM21 15l-3.1-3.1a2 2 0 0 0-2.8 0L6 21'
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <span className="tile-icon">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** Zero or missing optional content (parts tables) shows as an em dash, in every cell alike. */
const dash = (n: number) => (n > 0 ? n : '—');

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
  const title = all ? 'All events' : ev?.name ?? 'Mine Rescue App';
  return (
    <div>
      <section className="hero">
        <div className="hero-text">
          {edition && <p className="hero-edition">{edition}</p>}
          <h1>{title}</h1>
          <p className="hero-doc">{ev?.documentTitle ?? document.title ?? 'Mine rescue contest rules and statements'}</p>
        </div>
        <MineMap />
      </section>
      {all && factEvents.length > 1 && <p className="note small home-note">Showing all events. Choose an event in the header menu to take a quiz or mock exam.</p>}
      <div className="tiles">
        <h2 className="home-h">Practice</h2>
        <div className="tile-grid">
          <Link className="tile quiz" to="/quiz">
            <Icon name="quiz" />
            <strong>Quiz</strong>
            <span className="tile-desc">{quizConfig.distractorCount + 1}-choice questions from the statements{evParts.length ? ' and parts tables' : ''}</span>
            <span className="tile-go">Start<Chevron /></span>
          </Link>
          {!all && (
            <Link className="tile mock primary" to="/quiz?mode=mock">
              <Icon name="mock" />
              <strong>Mock exam</strong>
              <span className="tile-desc">
                {plan.facts} statements{plan.parts ? ` + ${plan.parts} parts` : ''}, {mMin ? `${mMin} min timer` : 'untimed'}, scored at the end
              </span>
              <span className="tile-go">Start<Chevron /></span>
            </Link>
          )}
          {!all && evRules.length > 0 && (
            <Link className="tile rules" to="/quiz?kind=rules">
              <Icon name="rules" />
              <strong>Rules quiz</strong>
              <span className="tile-desc">Fill the blank in sentences from the {ev?.name ?? ''} rule book</span>
              <span className="tile-go">Start<Chevron /></span>
            </Link>
          )}
        </div>
        <h2 className="home-h">Reference and tools</h2>
        <ul className="tile-list">
          <li>
            <Link className="tile-row book" to="/rules">
              <Icon name="book" />
              <strong>Rule book</strong>
              <span className="tile-row-desc">{evRules.length} rules by section</span>
              <Chevron />
            </Link>
          </li>
          <li>
            <Link className="tile-row statements" to="/statements">
              <Icon name="statements" />
              <strong>Statements</strong>
              <span className="tile-row-desc">{evFacts.length} statements</span>
              <Chevron />
            </Link>
          </li>
          {evParts.length > 0 && (
            <li>
              <Link className="tile-row parts" to="/parts">
                <Icon name="parts" />
                <strong>Identification of Parts</strong>
                <span className="tile-row-desc">
                  {evParts.length} tables, {evParts.reduce((n, t) => n + t.rows.length, 0)} parts
                </span>
                <Chevron />
              </Link>
            </li>
          )}
          <li>
            <Link className="tile-row search" to="/search">
              <Icon name="search" />
              <strong>Search</strong>
              <span className="tile-row-desc">Rules, statements and parts together</span>
              <Chevron />
            </Link>
          </li>
          <li>
            <Link className="tile-row tool-builder" to="/builder">
              <Icon name="builder" />
              <strong>Problem builder</strong>
              <span className="tile-row-desc">Place placards on a blank mine map, then solve it: team stops, mapping key, ventilation</span>
              <Chevron />
            </Link>
          </li>
          {evFigures.length > 0 && (
            <li>
              <Link className="tile-row figures" to="/figures">
                <Icon name="figures" />
                <strong>Figures</strong>
                <span className="tile-row-desc">{evFigures.length} diagrams, skill sheets and legend pages</span>
                <Chevron />
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
                  <td data-label="Rules">{rules.filter((r) => r.event === e.id).length}</td>
                  <td data-label="Statements">{facts.filter((f) => f.event === e.id).length}</td>
                  <td data-label="Parts tables">{dash(parts.filter((t) => t.event === e.id).length)}</td>
                  <td data-label="Figures">{figures.filter((f) => f.event === e.id).length}</td>
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
