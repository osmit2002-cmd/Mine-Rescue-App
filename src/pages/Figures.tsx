import { Link } from 'react-router-dom';
import { FigureCard } from '../components/common';
import { ALL_EVENTS, useData, useEvent } from '../data/DataContext';

export default function Figures() {
  const { figures: allFigures, sectionsById, eventName, factEvents } = useData();
  const { event } = useEvent();
  const all = event === ALL_EVENTS;
  const figures = all ? allFigures : allFigures.filter((f) => f.event === event);
  if (!figures.length)
    return (
      <div className="card">
        <h1>Figures</h1>
        <p className="muted">No figures for {all ? 'the loaded content' : eventName(event)}.</p>
      </div>
    );
  // Group by figure-index title (e.g. "Extent of Gases", "Mine Map Legend").
  const groups = new Map<string, typeof figures>();
  for (const f of figures) {
    const g = f.title ?? (f.sectionId ? sectionsById.get(f.sectionId)?.title : undefined) ?? 'Figures';
    const k = all && factEvents.length > 1 ? `${eventName(f.event) ?? 'Other'} — ${g}` : g;
    groups.set(k, [...(groups.get(k) ?? []), f]);
  }
  return (
    <div>
      <h1>Figures{!all && factEvents.length > 1 ? ` — ${eventName(event)}` : ''}</h1>
      <p className="muted small">Page images from the rule book. Tap an image to open it full size (works offline).</p>
      <nav className="chips" aria-label="Jump to figure group">
        {[...groups.keys()].map((g) => (
          <a key={g} className="chip" href={`#/figures`} onClick={(e) => { e.preventDefault(); document.getElementById(`grp-${g.replace(/\W+/g, '-')}`)?.scrollIntoView({ behavior: 'smooth' }); }}>
            {g}
          </a>
        ))}
      </nav>
      {[...groups.entries()].map(([g, figs]) => (
        <section key={g} id={`grp-${g.replace(/\W+/g, '-')}`}>
          <h2>{g}</h2>
          <div className="figure-grid">
            {figs.map((f) => (
              <FigureCard key={f.file} fig={f} />
            ))}
          </div>
        </section>
      ))}
      <p className="small">
        <Link to="/rules">Back to the rule book</Link>
      </p>
    </div>
  );
}
