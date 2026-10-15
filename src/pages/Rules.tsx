import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Highlight, snippet } from '../components/Highlight';
import { SearchBar } from '../components/SearchBar';
import { pagesLabel, ruleLink } from '../components/common';
import { ALL_EVENTS, useData, useEvent } from '../data/DataContext';
import { filterRuleTree, type RuleNode, type SectionNode } from '../data/ruleTree';
import { buildRuleSearchIndex, filterMatches, useUrlQuery } from '../lib/textSearch';

type Hits = Map<string, string[]> | null;

function RuleItem({ node, hits }: { node: RuleNode; hits: Hits }) {
  const r = node.rule;
  const terms = hits?.get(r.id);
  const preview = r.title ? '' : r.text.split('\n')[0];
  const label = r.title || (preview.length > 140 ? `${preview.slice(0, 140)}…` : preview);
  // For a matching rule, show where the words occur in its verbatim text (unless the label already shows it all).
  const around = terms ? snippet(r.text, terms, 240, { flatten: false, requireHit: true }) : '';
  const showSnippet = around && !(preview && around === preview);
  return (
    <li className={terms ? 'hit' : undefined}>
      <Link to={ruleLink(r, terms?.join(' '))} className="rule-link" data-testid={terms ? 'rule-hit' : undefined}>
        <span className="rule-num">{terms ? <Highlight text={r.number || '•'} terms={terms} /> : r.number || '•'}</span>
        <span>
          {terms ? <Highlight text={label} terms={terms} /> : label}
          {showSnippet && (
            <span className={`rule-snippet${r.format === 'pre' ? ' pre' : ''}`} data-testid="rule-snippet">
              <Highlight text={around} terms={terms!} />
            </span>
          )}
        </span>
      </Link>
      {node.children.length > 0 && (
        <ul className="rule-list nested">
          {node.children.map((c) => (
            <RuleItem key={c.rule.id} node={c} hits={hits} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Section({ node, hits, open, sectionIdFor }: { node: SectionNode; hits: Hits; open: boolean; sectionIdFor: (n: SectionNode) => string | undefined }) {
  const sectionId = sectionIdFor(node);
  return (
    <details className={`section depth-${node.depth}`} open={open || undefined}>
      <summary>
        <span className="section-name">{node.name}</span>
        <span className="count">{node.count}</span>
      </summary>
      {sectionId && !hits && (
        <p className="section-meta">
          <Link to={`/section/${encodeURIComponent(sectionId)}`}>Section page (introduction, notes, figures)</Link>
        </p>
      )}
      {node.sections.map((c) => (
        <Section key={c.key} node={c} hits={hits} open={open} sectionIdFor={sectionIdFor} />
      ))}
      {node.rules.length > 0 && (
        <ul className="rule-list">
          {node.rules.map((r) => (
            <RuleItem key={r.rule.id} node={r} hits={hits} />
          ))}
        </ul>
      )}
    </details>
  );
}

export default function Rules() {
  const data = useData();
  const { event } = useEvent();
  const all = event === ALL_EVENTS;
  const tree = data.treeFor(event);
  const rules = useMemo(() => (all ? data.rules : data.rules.filter((r) => r.event === event)), [data.rules, event, all]);
  const sections = useMemo(() => (all ? data.sections : data.sections.filter((s) => s.event === event)), [data.sections, event, all]);
  const [query, setQuery] = useUrlQuery('q');
  const [sectionKey, setSectionKey] = useState('');
  const [openAll, setOpenAll] = useState<boolean | null>(null);
  // Number, title and verbatim text of every rule, 'pre' skill sheets included. Scoped to the header event.
  const index = useMemo(() => buildRuleSearchIndex(data.rules), [data.rules]);
  const hits = useMemo(() => filterMatches(index, query, (id) => all || data.rulesById.get(id)?.event === event), [index, query, all, event, data.rulesById]);
  const top = tree.sections.some((s) => s.key === sectionKey) ? sectionKey : '';
  const view = useMemo(() => filterRuleTree(tree, hits && ((r) => hits.has(r.id)), top), [tree, hits, top]);
  const scopeTotal = top ? tree.sections.find((s) => s.key === top)?.count ?? 0 : tree.count;

  // Map top-level tree nodes to section info (by title) so we can link to section pages.
  // Section pages exist per event, so match titles within the right event (depth 2 when all events are shown).
  const sectionIdFor = (n: SectionNode) => {
    const depth = all && data.factEvents.length > 1 ? 2 : 1;
    if (n.depth !== depth) return undefined;
    const ev = depth === 2 ? data.factEvents.find((e) => e.name === n.key.split('\u001f')[0])?.id : event;
    return sections.find((s) => s.title === n.name && (!ev || ev === ALL_EVENTS || s.event === ev))?.id;
  };
  const ruleSectionIds = new Set(rules.map((r) => r.sectionId));
  const extraSections = sections.filter((s) => !ruleSectionIds.has(s.id)); // e.g. the figures-only section
  const narrowed = !!hits || !!top;
  const count = hits
    ? `${view.count} of ${scopeTotal} rules match${top ? ' in this section' : ''}.`
    : top
      ? `${scopeTotal} of ${tree.count} rules in this section.`
      : `${tree.count} rules${!all && data.factEvents.length > 1 ? ` (${data.eventName(event)})` : ''}.`;

  return (
    <div>
      <h1>Rule book{!all && data.factEvents.length > 1 ? ` — ${data.eventName(event)}` : ''}</h1>
      <SearchBar value={query} onChange={setQuery} placeholder="Search rules… number, title or wording" label="Search rules" count={count}>
        {tree.sections.length > 1 && (
          <div className="chips" role="group" aria-label="Filter rules by section" data-testid="rule-section-filter">
            <span className="chips-label">Section:</span>
            <button aria-pressed={!top} className={`chip small ${!top ? 'on' : ''}`} onClick={() => setSectionKey('')}>All sections</button>
            {tree.sections.map((s) => (
              <button key={s.key} aria-pressed={top === s.key} className={`chip small ${top === s.key ? 'on' : ''}`} onClick={() => setSectionKey(s.key)}>
                {s.name}
              </button>
            ))}
          </div>
        )}
        {!hits && (
          <div className="toolbar">
            <button onClick={() => setOpenAll(true)}>Expand all</button>
            <button onClick={() => setOpenAll(false)}>Collapse all</button>
          </div>
        )}
      </SearchBar>
      {sections.length > 0 && !narrowed && (
        <p className="muted small">
          Section pages (introductions, notes, figures):{' '}
          {sections
            .filter((s) => s.intro || !ruleSectionIds.has(s.id))
            .map((s, i) => (
              <span key={s.id}>
                {i > 0 && ' · '}
                <Link to={`/section/${encodeURIComponent(s.id)}`}>{s.title}</Link>
              </span>
            ))}
        </p>
      )}
      <div className="tree" key={`${String(openAll)}-${hits ? 1 : 0}-${top}`}>
        {view.sections.map((s) => (
          <Section key={s.key} node={s} hits={hits} open={hits ? true : openAll ?? !!top} sectionIdFor={sectionIdFor} />
        ))}
        {!narrowed &&
          extraSections.map((s) => (
            <div key={s.id} className="section depth-1 static">
              <Link to={`/section/${encodeURIComponent(s.id)}`} className="section-name">
                {s.title} {pagesLabel(s.pages) && <span className="muted small">({pagesLabel(s.pages)})</span>}
              </Link>
            </div>
          ))}
      </div>
      {hits && view.count === 0 && <p className="muted">No rules match “{query}”.</p>}
    </div>
  );
}
