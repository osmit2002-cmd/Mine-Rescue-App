import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { FigureGallery } from '../components/FigureGallery';
import { FigureCard, NotFound, pagesLabel, ruleLabel, ruleLink } from '../components/common';
import { RuleText } from '../components/RuleText';
import { useData } from '../data/DataContext';
import { ruleAncestors } from '../data/ruleTree';

export default function RuleDetail() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const data = useData();
  const [copied, setCopied] = useState(false);
  const rule = data.rulesById.get(id);
  if (!rule) return <NotFound what="rule" />;
  const terms = (params.get('q') ?? '').split(/\s+/).filter((t) => t.length > 1);
  const ancestors = ruleAncestors(rule, data.rulesById);
  const children = data.rules.filter((r) => r.parent === rule.id);
  const sameEvent = data.rules.filter((r) => r.event === rule.event);
  const idx = sameEvent.indexOf(rule);
  const prev = sameEvent[idx - 1];
  const next = sameEvent[idx + 1];
  const figures = data.figuresForRule(rule);
  const gallery = data.galleryFor(rule);
  const section = rule.sectionId ? data.sectionsById.get(rule.sectionId) : undefined;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}#${ruleLink(rule)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <article className="card">
      <nav className="breadcrumbs" aria-label="Breadcrumbs">
        <Link to="/rules">Rules</Link>
        {data.factEvents.length > 1 && rule.event && <span>{' › '}{data.eventName(rule.event)}</span>}
        {rule.sectionPath.map((p, i) => (
          <span key={i}>
            {' › '}
            {i === 0 && section ? <Link to={`/section/${encodeURIComponent(section.id)}`}>{p}</Link> : p}
          </span>
        ))}
        {ancestors.map((a) => (
          <span key={a.id}>
            {' › '}
            <Link to={ruleLink(a)}>{a.number || a.title}</Link>
          </span>
        ))}
      </nav>
      <h1>{ruleLabel(rule)}</h1>
      <p className="muted small">
        {[pagesLabel(rule.pages) && `Rule book ${pagesLabel(rule.pages)}`, data.editionFor(rule.event)].filter(Boolean).join(' · ')}
      </p>
      <RuleText text={rule.text} terms={terms} format={rule.format} />
      {gallery.length > 0 && (
        <>
          <h2>Figures ({gallery.length})</h2>
          <FigureGallery key={rule.id} figures={gallery} label={`Figures for ${ruleLabel(rule)}`} />
        </>
      )}
      {rule.tags.length > 0 && (
        <p className="tags">
          {rule.tags.map((t) => (
            <span key={t} className="chip static">{t}</span>
          ))}
        </p>
      )}
      {children.length > 0 && (
        <>
          <h2>Sub-rules</h2>
          <ul className="rule-list">
            {children.map((c) => (
              <li key={c.id}>
                <Link to={ruleLink(c)} className="rule-link">
                  <span className="rule-num">{c.number}</span>
                  <span>{c.title || c.text.slice(0, 100)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {figures.length > 0 && (
        <>
          <h2>Figures</h2>
          <div className="figure-grid">
            {figures.map((f) => (
              <FigureCard key={f.file} fig={f} />
            ))}
          </div>
        </>
      )}
      <div className="pager">
        {prev ? <Link to={ruleLink(prev)}>‹ {prev.number || prev.title}</Link> : <span />}
        <button onClick={copyLink}>{copied ? 'Link copied' : 'Copy link'}</button>
        {next ? <Link to={ruleLink(next)}>{next.number || next.title} ›</Link> : <span />}
      </div>
    </article>
  );
}
