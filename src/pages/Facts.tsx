import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { NotFound } from '../components/common';
import { EventPicker } from '../components/EventPicker';
import { ALL_EVENTS, useData, useEvent } from '../data/DataContext';
import type { Fact } from '../data/types';
import { normalizeAnswer } from '../quiz/text';

export function factLabel(f: Fact) {
  return f.number ? `Statement ${f.number}` : 'Statement';
}

export function FactList() {
  const { facts, factEvents, eventName } = useData();
  const { event } = useEvent();
  const ev = event === ALL_EVENTS ? '' : event;
  const [filter, setFilter] = useState('');
  const [cat, setCat] = useState<string>('');
  const categories = useMemo(() => [...new Set(facts.map((f) => f.category).filter((c): c is string => !!c))], [facts]);
  const q = normalizeAnswer(filter);
  const shown = facts.filter((f) => (!ev || f.event === ev) && (!cat || f.category === cat) && (!q || normalizeAnswer(`${f.number ?? ''} ${f.statement}`).includes(q)));
  return (
    <div>
      <h1>Statements of fact</h1>
      <div className="toolbar">
        <input type="search" placeholder="Filter statements…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter statements" />
      </div>
      <EventPicker />
      {categories.length > 0 && (
        <div className="chips">
          <button aria-pressed={!cat} className={`chip ${!cat ? 'on' : ''}`} onClick={() => setCat('')}>All</button>
          {categories.map((c) => (
            <button key={c} aria-pressed={cat === c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      )}
      <ol className="fact-list">
        {shown.map((f) => (
          <li key={f.id}>
            <Link to={`/facts/${encodeURIComponent(f.id)}`}>
              <span className="rule-num">{f.number ?? '•'}</span>
              <span>
                {!ev && factEvents.length > 1 && <span className="muted small">{eventName(f.event)} · </span>}
                {f.statement}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="muted small">
        {shown.length} of {ev ? facts.filter((f) => f.event === ev).length : facts.length} statements{ev && factEvents.length > 1 ? ` (${eventName(ev)})` : ''}.
      </p>
    </div>
  );
}

export function FactDetail() {
  const { id = '' } = useParams();
  const { factsById, facts, edition, document, events, eventName } = useData();
  const f = factsById.get(id);
  if (!f) return <NotFound what="statement" />;
  const sameEvent = facts.filter((x) => x.event === f.event);
  const i = sameEvent.indexOf(f);
  const evInfo = events.find((e) => e.id === f.event);
  const prev = sameEvent[i - 1];
  const next = sameEvent[i + 1];
  return (
    <article className="card">
      <nav className="breadcrumbs">
        <Link to="/facts">Statements of fact</Link> › {factLabel(f)}
      </nav>
      <h1>{factLabel(f)}</h1>
      <p className="statement">{f.statement}</p>
      {f.answer && (
        <p>
          <strong>Answer:</strong> {f.answer}
        </p>
      )}
      <dl className="meta">
        {f.event && (<><dt>Event</dt><dd>{eventName(f.event)}</dd></>)}
        {f.section && (<><dt>Section</dt><dd>{f.section}</dd></>)}
        {f.reference && (<><dt>Reference</dt><dd>{f.reference} <span className="muted">(printed at the end of the statement)</span></dd></>)}
        {f.category && (<><dt>Category</dt><dd>{f.category}</dd></>)}
        {f.page !== undefined && (<><dt>Page</dt><dd>Rule book p. {f.page}</dd></>)}
        {f.source && (
          <>
            <dt>Source</dt>
            <dd>
              {evInfo?.documentTitle ? (
                evInfo.documentUrl && /^https?:/i.test(evInfo.documentUrl) ? <a href={evInfo.documentUrl} target="_blank" rel="noreferrer noopener">{evInfo.documentTitle}</a> : evInfo.documentTitle
              ) : document.title && document.id === f.source ? document.title : f.source}
            </dd>
          </>
        )}
        {(evInfo?.edition || edition) && (<><dt>Edition</dt><dd>{evInfo?.edition ?? edition}</dd></>)}
        {f.keyTerms.length > 0 && (<><dt>Key terms</dt><dd>{f.keyTerms.join(', ')}</dd></>)}
      </dl>
      {f.note && <p className="note small"><strong>Edit note:</strong> {f.note}</p>}
      <p className="muted small">Shown exactly as printed, including any typos in the source.</p>
      <div className="pager">
        {prev ? <Link to={`/facts/${encodeURIComponent(prev.id)}`}>‹ {prev.number ?? 'Previous'}</Link> : <span />}
        <Link to={`/quiz?fact=${encodeURIComponent(f.id)}`} className="button">Practice this one</Link>
        {next ? <Link to={`/facts/${encodeURIComponent(next.id)}`}>{next.number ?? 'Next'} ›</Link> : <span />}
      </div>
    </article>
  );
}
