import MiniSearch, { type SearchResult } from 'minisearch';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Highlight, snippet } from '../components/Highlight';
import { FigureBadge, ruleLabel, ruleLink } from '../components/common';
import { ALL_EVENTS, useData, useEvent, type Data } from '../data/DataContext';
import { useUrlQuery } from '../lib/textSearch';

type DocType = 'rule' | 'fact' | 'section' | 'part';
interface Doc {
  id: string;
  type: DocType;
  refId: string;
  title: string;
  number: string;
  text: string;
  group: string;
  event: string;
}

function buildIndex(data: Data) {
  const docs: Doc[] = [
    ...data.rules.map((r) => ({ id: `r:${r.id}`, type: 'rule' as const, refId: r.id, title: ruleLabel(r), number: r.number, text: r.text, group: r.sectionPath[0] ?? '', event: r.event ?? '' })),
    ...data.facts.map((f) => ({ id: `f:${f.id}`, type: 'fact' as const, refId: f.id, title: f.number ? `Statement ${f.number}` : 'Statement', number: f.number ?? '', text: f.statement, group: f.category ?? f.section ?? 'Statements', event: f.event ?? '' })),
    ...data.sections
      .filter((s) => s.intro || s.note)
      .map((s) => ({ id: `s:${s.id}`, type: 'section' as const, refId: s.id, title: s.title, number: '', text: [s.intro, s.note, ...s.figures.map((f) => `${f.caption} ${f.title ?? ''} ${f.labels}`)].filter(Boolean).join('\n'), group: s.title, event: s.event ?? '' })),
    ...data.parts.map((t) => ({ id: `p:${t.id}`, type: 'part' as const, refId: t.id, title: `${t.assembly} — parts`, number: '', text: t.rows.map((r) => `${r.no}. ${r.name}`).join('\n'), group: 'Identification of Parts', event: t.event ?? '' }))
  ];
  const ms = new MiniSearch<Doc>({
    fields: ['title', 'number', 'text'],
    storeFields: ['type', 'refId', 'title', 'text', 'group', 'event'],
    searchOptions: { boost: { number: 4, title: 2 }, prefix: (t) => t.length > 2, fuzzy: (t) => (t.length > 4 ? 0.2 : false) }
  });
  ms.addAll(docs);
  return ms;
}

const TYPE_LABEL: Record<DocType, string> = { rule: 'Rule', fact: 'Statement', section: 'Section', part: 'Parts table' };

export default function Search() {
  const data = useData();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useUrlQuery('q');
  const type = (params.get('type') as DocType | 'all' | null) ?? 'all';
  const group = params.get('group') ?? '';
  const index = useMemo(() => buildIndex(data), [data]);
  const { event } = useEvent();

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [] as SearchResult[];
    const filter = event === ALL_EVENTS ? undefined : (r: SearchResult) => r.event === event;
    const and = index.search(q, { combineWith: 'AND', filter });
    return and.length ? and : index.search(q, { combineWith: 'OR', filter });
  }, [index, query, event]);

  const counts = { all: results.length, rule: 0, fact: 0, section: 0, part: 0 } as Record<DocType | 'all', number>;
  for (const r of results) counts[r.type as DocType]++;
  const byType = results.filter((r) => type === 'all' || r.type === type);
  const groups = [...new Set(byType.map((r) => r.group as string))].slice(0, 12);
  const shown = byType.filter((r) => !group || r.group === group).slice(0, 100);

  const setFilter = (key: 'type' | 'group', value: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== 'all') next.set(key, value);
    else next.delete(key);
    if (key === 'type') next.delete('group');
    setParams(next, { replace: true });
  };

  return (
    <div>
      <h1>Search</h1>
      <div className="toolbar">
        <input type="search" autoFocus placeholder="Search rules and statements… e.g. methane, 20 minutes, lifeline" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search" />
      </div>
      {query.trim() && (
        <>
          <div className="chips" role="group" aria-label="Filter by type">
            {(['all', 'rule', 'fact', 'section', 'part'] as const).map((t) =>
              t !== 'all' && counts[t] === 0 ? null : (
                <button key={t} aria-pressed={type === t} className={`chip ${type === t ? 'on' : ''}`} onClick={() => setFilter('type', t)}>
                  {t === 'all' ? 'All' : t === 'rule' ? 'Rules' : t === 'fact' ? 'Statements' : t === 'part' ? 'Parts' : 'Sections'} ({counts[t]})
                </button>
              )
            )}
          </div>
          {groups.length > 1 && (
            <div className="chips" role="group" aria-label="Filter by section">
              <button aria-pressed={!group} className={`chip small ${!group ? 'on' : ''}`} onClick={() => setFilter('group', '')}>Any section</button>
              {groups.map((g) => (
                <button key={g} aria-pressed={group === g} className={`chip small ${group === g ? 'on' : ''}`} onClick={() => setFilter('group', g)}>{g}</button>
              ))}
            </div>
          )}
        </>
      )}
      <ul className="results">
        {shown.map((r) => {
          const terms = r.terms as string[];
          const to = r.type === 'rule' ? ruleLink(data.rulesById.get(r.refId)!, terms.join(' ')) : r.type === 'fact' ? `/statements/${encodeURIComponent(r.refId)}` : r.type === 'part' ? `/parts/${encodeURIComponent(r.refId)}` : `/section/${encodeURIComponent(r.refId)}`;
          return (
            <li key={r.id}>
              <Link to={to}>
                <span className="result-type">{TYPE_LABEL[r.type as DocType]}{event === ALL_EVENTS && r.event ? ` · ${data.eventName(r.event)}` : ''} · {r.group}</span>
                <strong className="result-title">
                  <Highlight text={r.title} terms={terms} />
                  {r.type === 'rule' && data.rulesById.has(r.refId) && <FigureBadge count={data.galleryFor(data.rulesById.get(r.refId)!).length} />}
                </strong>
                <span className="result-snippet"><Highlight text={snippet(r.text, terms)} terms={terms} /></span>
              </Link>
            </li>
          );
        })}
      </ul>
      {query.trim() && shown.length === 0 && <p className="muted">No matches for “{query}”.</p>}
      {!query.trim() && <p className="muted">Searches {event === ALL_EVENTS ? 'all events' : data.eventName(event)}: rules, statements{data.parts.length ? ', parts tables' : ''} and section notes, offline.</p>}
    </div>
  );
}
