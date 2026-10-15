import { Component, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../data/DataContext';
import type { Figure, Rule } from '../data/types';

export function SampleBanner() {
  const { sample } = useData();
  if (!sample.rules && !sample.facts) return null;
  const which = sample.rules && sample.facts ? 'rules and statements of fact' : sample.rules ? 'rules' : 'statements of fact';
  return (
    <div className="sample-banner" role="status">
      <strong>SAMPLE DATA</strong> — the {which} shown are generic placeholders, not the real rule book. Add the real JSON to{' '}
      <code>content/</code> and rebuild (see README).
    </div>
  );
}

export function ruleLabel(r: Rule): string {
  const num = r.number ? `${r.sectionPath.length > 1 || /^\d+$/.test(r.number) ? 'Rule ' : ''}${r.number}` : '';
  return [num, r.title].filter(Boolean).join(' — ') || r.text.slice(0, 60);
}

export function ruleLink(r: Rule, q?: string) {
  return `/rules/${encodeURIComponent(r.id)}${q ? `?q=${encodeURIComponent(q)}` : ''}`;
}

export function pagesLabel(p?: [number, number]): string | null {
  if (!p) return null;
  return p[0] === p[1] ? `p. ${p[0]}` : `pp. ${p[0]}–${p[1]}`;
}

export function FigureCard({ fig }: { fig: Figure }) {
  const { contentUrl } = useData();
  const url = contentUrl(fig.file);
  const title = [fig.caption, fig.title].filter(Boolean).join(' — ');
  return (
    <figure className="figure-card" id={`fig-${fig.file.replace(/\W+/g, '-')}`}>
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={`${title}${fig.labels ? `. Labels: ${fig.labels.replace(/\n/g, ', ').slice(0, 300)}` : ''}`} loading="lazy" decoding="async" />
      </a>
      <figcaption>
        {title}
        {fig.printedPage !== undefined && <span className="muted"> · rule book p. {fig.printedPage}</span>}
      </figcaption>
    </figure>
  );
}

export function NotFound({ what }: { what: string }) {
  return (
    <div className="card">
      <h2>Not found</h2>
      <p>That {what} isn't in the loaded content. It may have been renumbered in a content update.</p>
      <Link to="/">Go home</Link>
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <div className="card error">
          <h2>Something went wrong</h2>
          <p>{this.state.error.message}</p>
          <button onClick={() => { this.setState({ error: null }); location.hash = '#/'; }}>Back to home</button>
        </div>
      );
    return this.props.children;
  }
}
