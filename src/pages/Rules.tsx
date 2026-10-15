import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { pagesLabel, ruleLink } from '../components/common';
import { ALL_EVENTS, useData, useEvent } from '../data/DataContext';
import type { RuleNode, SectionNode } from '../data/ruleTree';
import { normalizeAnswer } from '../quiz/text';

function matches(node: RuleNode, q: string): boolean {
  const r = node.rule;
  return normalizeAnswer(`${r.number} ${r.title} ${r.text}`).includes(q) || node.children.some((c) => matches(c, q));
}

function RuleItem({ node, q }: { node: RuleNode; q: string }) {
  if (q && !matches(node, q)) return null;
  const r = node.rule;
  const preview = r.title ? '' : r.text.split('\n')[0];
  return (
    <li>
      <Link to={ruleLink(r)} className="rule-link">
        <span className="rule-num">{r.number || '•'}</span>
        <span>
          {r.title || (preview.length > 140 ? `${preview.slice(0, 140)}…` : preview)}
        </span>
      </Link>
      {node.children.length > 0 && (
        <ul className="rule-list nested">
          {node.children.map((c) => (
            <RuleItem key={c.rule.id} node={c} q={q} />
          ))}
        </ul>
      )}
    </li>
  );
}

function sectionHas(s: SectionNode, q: string): boolean {
  return s.rules.some((r) => matches(r, q)) || s.sections.some((c) => sectionHas(c, q));
}

function Section({ node, q, openAll, sectionIdFor }: { node: SectionNode; q: string; openAll: boolean | null; sectionIdFor: (n: SectionNode) => string | undefined }) {
  const sectionId = sectionIdFor(node);
  if (q && !sectionHas(node, q)) return null;
  const open = q ? true : openAll ?? false;
  return (
    <details className={`section depth-${node.depth}`} open={open || undefined} key={`${node.key}-${String(openAll)}-${q ? 1 : 0}`}>
      <summary>
        <span className="section-name">{node.name}</span>
        <span className="count">{node.count}</span>
      </summary>
      {sectionId && (
        <p className="section-meta">
          <Link to={`/section/${encodeURIComponent(sectionId)}`}>Section page (introduction, notes, figures)</Link>
        </p>
      )}
      {node.sections.map((c) => (
        <Section key={c.key} node={c} q={q} openAll={openAll} sectionIdFor={sectionIdFor} />
      ))}
      {node.rules.length > 0 && (
        <ul className="rule-list">
          {node.rules.map((r) => (
            <RuleItem key={r.rule.id} node={r} q={q} />
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
  const [filter, setFilter] = useState('');
  const [openAll, setOpenAll] = useState<boolean | null>(null);
  const q = normalizeAnswer(filter);
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

  return (
    <div>
      <h1>Rule book{!all && data.factEvents.length > 1 ? ` — ${data.eventName(event)}` : ''}</h1>
      <div className="toolbar">
        <input type="search" placeholder="Filter rules…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter rules" />
        <button onClick={() => setOpenAll(true)}>Expand all</button>
        <button onClick={() => setOpenAll(false)}>Collapse all</button>
      </div>
      {sections.length > 0 && !q && (
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
      <div className="tree">
        {tree.sections.map((s) => (
          <Section key={s.key} node={s} q={q} openAll={openAll} sectionIdFor={sectionIdFor} />
        ))}
        {!q &&
          extraSections.map((s) => (
            <div key={s.id} className="section depth-1 static">
              <Link to={`/section/${encodeURIComponent(s.id)}`} className="section-name">
                {s.title} {pagesLabel(s.pages) && <span className="muted small">({pagesLabel(s.pages)})</span>}
              </Link>
            </div>
          ))}
      </div>
      {q && !tree.sections.some((s) => sectionHas(s, q)) && <p className="muted">No rules match “{filter}”.</p>}
      <p className="muted small">{rules.length} rules loaded.</p>
    </div>
  );
}
