import { Link, useParams } from 'react-router-dom';
import { EventPicker } from '../components/EventPicker';
import { NotFound } from '../components/common';
import { ALL_EVENTS, useData, useEvent } from '../data/DataContext';
import type { PartTable } from '../data/types';

export function partTableLabel(t: PartTable) {
  return t.assembly;
}

/** Bench events: Identification of Parts tables for the selected event. */
export function PartsList() {
  const { parts, eventName, factEvents } = useData();
  const { event } = useEvent();
  const all = event === ALL_EVENTS;
  const tables = all ? parts : parts.filter((t) => t.event === event);
  const byEvent = new Map<string, PartTable[]>();
  for (const t of tables) byEvent.set(t.event ?? '', [...(byEvent.get(t.event ?? '') ?? []), t]);
  const benchEvents = factEvents.filter((e) => parts.some((t) => t.event === e.id));
  return (
    <div>
      <h1>Identification of Parts</h1>
      {!tables.length && (
        <div className="card">
          <p>{all ? 'No parts tables are loaded.' : `${eventName(event)} has no parts tables.`} Parts tables belong to the bench events:</p>
          <ul>
            {benchEvents.map((e) => (
              <li key={e.id}>{e.name}</li>
            ))}
          </ul>
        </div>
      )}
      <EventPicker />
      {[...byEvent.entries()].map(([ev, ts]) => (
        <section key={ev}>
          {(all || byEvent.size > 1) && <h2>{eventName(ev) ?? 'Parts'}</h2>}
          <ul className="rule-list">
            {ts.map((t) => (
              <li key={t.id}>
                <Link to={`/parts/${encodeURIComponent(t.id)}`} className="rule-link">
                  <span className="rule-num">{t.page !== undefined ? `p. ${t.page}` : '•'}</span>
                  <span>
                    {partTableLabel(t)} <span className="muted small">({t.rows.length} parts)</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {tables.length > 0 && (
        <p className="muted small">
          {tables.length} tables, {tables.reduce((n, t) => n + t.rows.length, 0)} parts. Part names are shown exactly as printed.{' '}
          <Link to="/quiz">Practise parts questions</Link>
        </p>
      )}
    </div>
  );
}

export function PartsTable() {
  const { id = '' } = useParams();
  const { partsById, parts, eventName, contentUrl } = useData();
  const t = partsById.get(id);
  if (!t) return <NotFound what="parts table" />;
  const same = parts.filter((x) => x.event === t.event);
  const i = same.indexOf(t);
  const prev = same[i - 1];
  const next = same[i + 1];
  const img = t.figure ? contentUrl(t.figure) : undefined;
  return (
    <article className="card">
      <nav className="breadcrumbs">
        <Link to="/parts">Parts</Link> › {eventName(t.event)} › {t.assembly}
      </nav>
      <h1>{t.assembly}</h1>
      <p className="muted small">
        {[eventName(t.event), t.page !== undefined && `rule book p. ${t.page}`].filter(Boolean).join(' · ')}
      </p>
      {t.titleNote && <p className="note small">{t.titleNote}</p>}
      {img && (
        <figure className="figure-card wide">
          <a href={img} target="_blank" rel="noreferrer">
            <img src={img} alt={`${t.assembly} parts diagram`} loading="lazy" decoding="async" />
          </a>
        </figure>
      )}
      <table className="parts-table">
        <thead>
          <tr>
            <th scope="col">No.</th>
            <th scope="col">Part</th>
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r, k) => (
            <tr key={`${r.no}-${k}`}>
              <td>{r.no}</td>
              <td>{r.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pager">
        {prev ? <Link to={`/parts/${encodeURIComponent(prev.id)}`}>‹ {prev.assembly}</Link> : <span />}
        {next ? <Link to={`/parts/${encodeURIComponent(next.id)}`}>{next.assembly} ›</Link> : <span />}
      </div>
    </article>
  );
}
