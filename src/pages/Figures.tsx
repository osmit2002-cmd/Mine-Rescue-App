import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FigureCard } from '../components/common';
import { ALL_EVENTS, encodePath, useData, useEvent } from '../data/DataContext';

const CROP_GROUPS: Record<string, string> = {
  figure: 'Figures and drawings',
  flowchart: 'Figures and drawings',
  table: 'Tables',
  'map-legend': 'Mine map legend',
  'map-symbol': 'Mine map symbols',
  'skill-sheet': 'Skill sheets',
  'parts-drawing': 'Parts drawings',
  'parts-table': 'Parts tables',
  form: 'Forms and checklists'
};
/** Group heading for a cropped figure, from its kind in the data. */
function cropGroup(kind?: string) {
  return (kind && CROP_GROUPS[kind]) ?? 'Cropped figures';
}

export default function Figures() {
  const { figures: allFigures, sectionsById, eventName, factEvents, runtimeFigures } = useData();
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
    const g = f.kind === 'crop' ? cropGroup(f.figureKind) : f.title ?? (f.sectionId ? sectionsById.get(f.sectionId)?.title : undefined) ?? 'Figures';
    const k = all && factEvents.length > 1 ? `${eventName(f.event) ?? 'Other'} — ${g}` : g;
    groups.set(k, [...(groups.get(k) ?? []), f]);
  }
  return (
    <div>
      <h1>Figures{!all && factEvents.length > 1 ? ` — ${eventName(event)}` : ''}</h1>
      <p className="muted small">
        {figures.some((f) => f.kind === 'crop') ? 'Figures and page images' : 'Page images'} from the rule book. Tap an image to open it full size (works offline).
      </p>
      {runtimeFigures.length > 0 && <DownloadAll />}
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

/**
 * Full-page images are not precached when cropped figures exist (they are cached when first viewed).
 * Fetching each once stores it in the service worker's runtime cache, so they all work offline.
 */
/** Must match the runtime cache name for content/pages/ in vite.config.ts. */
const PAGES_CACHE = 'figure-pages';

export function DownloadAll() {
  const { runtimeFigures } = useData();
  const [state, setState] = useState<{ done: number; failed: number; running: boolean } | null>(null);
  const base = import.meta.env.BASE_URL;
  const urls = runtimeFigures.map((f) => `${base}content/${encodePath(f)}`);
  const run = async () => {
    let done = 0;
    let failed = 0;
    setState({ done, failed, running: true });
    // Store straight into the service worker's runtime cache (same name as in vite.config.ts), so this works
    // even before the service worker controls the page; already-saved pages are skipped.
    const cache = typeof caches !== 'undefined' ? await caches.open(PAGES_CACHE).catch(() => null) : null;
    for (const u of urls) {
      try {
        const abs = new URL(u, location.href).href;
        if (!cache) throw new Error('no Cache Storage');
        if (!(await cache.match(abs))) {
          const r = await fetch(abs);
          if (!r.ok) throw new Error(String(r.status));
          await cache.put(abs, r);
        }
        done++;
      } catch {
        failed++;
      }
      setState({ done, failed, running: true });
    }
    setState({ done, failed, running: false });
  };
  if (!urls.length) return null;
  return (
    <p className="card small" data-testid="download-figures">
      Cropped figures are stored for offline use; the {urls.length} full-page images are saved as you view them.{' '}
      <button onClick={run} disabled={state?.running} data-testid="download-all">
        Download all for offline
      </button>{' '}
      {state && (
        <span role="status" data-testid="download-status">
          {state.done} of {urls.length} saved{state.failed ? `, ${state.failed} failed (${typeof caches === 'undefined' ? 'this browser has no offline storage here' : 'try again when online'})` : ''}
          {!state.running && !state.failed ? '. All full pages work offline.' : ''}
        </span>
      )}
    </p>
  );
}
