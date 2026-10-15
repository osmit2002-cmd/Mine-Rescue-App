import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Highlight } from '../components/Highlight';
import { SearchBar } from '../components/SearchBar';
import { NotFound } from '../components/common';
import { ALL_EVENTS, useData, useEvent } from '../data/DataContext';
import type { Fact } from '../data/types';
import { buildTextIndex, filterMatches, useUrlQuery } from '../lib/textSearch';

export function factLabel(f: Fact) {
  return f.number ? `Statement ${f.number}` : 'Statement';
}

export function FactList() {
  const { facts, factEvents, eventName } = useData();
  const { event } = useEvent();
  const ev = event === ALL_EVENTS ? '' : event;
  const [filter, setFilter] = useUrlQuery('q');
  const [cat, setCat] = useState<string>('');
  const categories = useMemo(() => [...new Set(facts.map((f) => f.category).filter((c): c is string => !!c))], [facts]);
  const index = useMemo(() => buildTextIndex(facts.map((f) => ({ id: f.id, number: f.number ?? '', statement: f.statement })), ['number', 'statement']), [facts]);
  const byId = useMemo(() => new Map(facts.map((f) => [f.id, f])), [facts]);
  const hits = useMemo(() => filterMatches(index, filter, (id) => !ev || byId.get(id)?.event === ev), [index, filter, ev, byId]);
  const inEvent = ev ? facts.filter((f) => f.event === ev) : facts;
  const shown = inEvent.filter((f) => (!cat || f.category === cat) && (!hits || hits.has(f.id)));
  return (
    <div>
      <h1>Statements{ev && factEvents.length > 1 ? ` — ${eventName(ev)}` : ''}</h1>
      <SearchBar
        value={filter}
        onChange={setFilter}
        placeholder="Search statements…"
        label="Search statements"
        count={`${shown.length} of ${inEvent.length} statements${ev && factEvents.length > 1 ? ` (${eventName(ev)})` : ''}.`}
      >
        {categories.length > 0 && (
          <div className="chips" role="group" aria-label="Filter by category">
            <button aria-pressed={!cat} className={`chip ${!cat ? 'on' : ''}`} onClick={() => setCat('')}>All</button>
            {categories.map((c) => (
              <button key={c} aria-pressed={cat === c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
        )}
      </SearchBar>
      <ol className="fact-list">
        {shown.map((f) => (
          <li key={f.id}>
            <Link to={`/statements/${encodeURIComponent(f.id)}`}>
              <span className="rule-num">{hits ? <Highlight text={f.number ?? '•'} terms={hits.get(f.id) ?? []} /> : f.number ?? '•'}</span>
              <span>
                {!ev && factEvents.length > 1 && <span className="muted small">{eventName(f.event)} · </span>}
                {hits ? <Highlight text={f.statement} terms={hits.get(f.id) ?? []} /> : f.statement}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {hits && shown.length === 0 && <p className="muted">No statements match “{filter}”.</p>}
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
        <Link to="/statements">Statements</Link> › {factLabel(f)}
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
        {prev ? <Link to={`/statements/${encodeURIComponent(prev.id)}`}>‹ {prev.number ?? 'Previous'}</Link> : <span />}
        <Link to={`/quiz?fact=${encodeURIComponent(f.id)}`} className="button">Practice this one</Link>
        {next ? <Link to={`/statements/${encodeURIComponent(next.id)}`}>{next.number ?? 'Next'} ›</Link> : <span />}
      </div>
    </article>
  );
}
