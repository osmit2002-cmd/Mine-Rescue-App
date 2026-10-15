import { Link, useParams } from 'react-router-dom';
import { FigureGallery } from '../components/FigureGallery';
import { FigureCard, NotFound, pagesLabel, ruleLink } from '../components/common';
import { RuleText } from '../components/RuleText';
import { useData } from '../data/DataContext';

export default function SectionPage() {
  const { id = '' } = useParams();
  const data = useData();
  const s = data.sectionsById.get(id);
  if (!s) return <NotFound what="section" />;
  const rules = data.rules.filter((r) => r.sectionId === s.id && !r.parent);
  const figures = data.figuresForSection(s);
  const gallery = data.sectionGalleryFor(s);
  return (
    <article className="card">
      <nav className="breadcrumbs">
        <Link to="/rules">Rules</Link>{data.factEvents.length > 1 && s.event ? ` › ${data.eventName(s.event)}` : ''} › {s.title}
      </nav>
      <h1>{s.title}</h1>
      <p className="muted small">{[pagesLabel(s.pages) && `Rule book ${pagesLabel(s.pages)}`, data.editionFor(s.event)].filter(Boolean).join(' · ')}</p>
      {s.intro && <RuleText text={s.intro} />}
      {s.note && <p className="note">{s.note}</p>}
      {rules.length > 0 && (
        <>
          <h2>Rules ({rules.length})</h2>
          <ul className="rule-list">
            {rules.map((r) => (
              <li key={r.id}>
                <Link to={ruleLink(r)} className="rule-link">
                  <span className="rule-num">{r.number || '•'}</span>
                  <span>{r.title || (r.text.length > 120 ? `${r.text.slice(0, 120)}…` : r.text)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {gallery.length > 0 && (
        <>
          <h2>Figures ({gallery.length})</h2>
          <FigureGallery key={s.id} figures={gallery} label={`Figures for ${s.title}`} />
        </>
      )}
      {figures.length > 0 && (
        <>
          <h2>Figures ({figures.length})</h2>
          <div className="figure-grid">
            {figures.map((f) => (
              <FigureCard key={f.file} fig={f} />
            ))}
          </div>
        </>
      )}
    </article>
  );
}
