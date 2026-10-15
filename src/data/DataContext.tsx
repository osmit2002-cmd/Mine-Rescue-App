import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { editionLabel } from './adapter';
import { loadContent } from './load';
import { buildRuleTree, type SectionNode } from './ruleTree';
import type { ContentState, EventInfo, Fact, Figure, PartTable, Rule, SectionInfo } from './types';

export const ALL_EVENTS = 'all';

export interface Data extends ContentState {
  rulesById: Map<string, Rule>;
  factsById: Map<string, Fact>;
  sectionsById: Map<string, SectionInfo>;
  partsById: Map<string, PartTable>;
  /** Events that have statements or rules, in file order (empty for single-event content). */
  factEvents: EventInfo[];
  eventName: (id?: string) => string | undefined;
  eventInfo: (id?: string) => EventInfo | undefined;
  /** Rule tree for one event, or for all events (top level = event name). */
  treeFor: (event: string) => SectionNode;
  /** "2026 MSHA rules, approved 1/15/2026" for an event (or the main rule book). */
  editionFor: (event?: string) => string | undefined;
  figuresForRule: (rule: Rule) => Figure[];
  figuresForSection: (section: SectionInfo) => Figure[];
  /** URL of a content file (figures, sources.md); figure paths are mapped to the built (WebP) files. */
  contentUrl: (file: string) => string;
  /** Default edition label (main rule book). */
  edition?: string;
  /** @deprecated single-event tree; use treeFor */
  tree: SectionNode;
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: Data };

const Ctx = createContext<{ state: LoadState; reload: () => void } | null>(null);
const EventCtx = createContext<{ event: string; setEvent: (e: string) => void }>({ event: ALL_EVENTS, setEvent: () => {} });

const inRange = (p: number | undefined, r?: [number, number]) => p !== undefined && !!r && p >= r[0] && p <= r[1];

/** "Figure 5" / "Figures 2(a)" mentioned in a rule's text. */
function figureRefs(text: string): string[] {
  return [...text.matchAll(/\bFigures?\s+(\d+(?:\s?\([a-z]\))?)/gi)].map((m) => m[1].replace(/\s/g, '').toLowerCase());
}

export function enrich(content: ContentState): Data {
  const rulesById = new Map(content.rules.map((r) => [r.id, r]));
  const factsById = new Map(content.facts.map((f) => [f.id, f]));
  const sectionsById = new Map(content.sections.map((s) => [s.id, s]));
  const partsById = new Map(content.parts.map((t) => [t.id, t]));
  const figNumber = (f: Figure) => /^figure\s+(\S+)/i.exec(f.caption)?.[1].toLowerCase();
  const figuresForRule = (rule: Rule) => {
    const refs = figureRefs(rule.text);
    return content.figures.filter((f) => {
      if (f.ruleId) return f.ruleId === rule.id;
      if (f.event !== rule.event) return false;
      const n = figNumber(f);
      if (n && refs.some((r) => r === n || (!r.includes('(') && n.startsWith(`${r}(`)))) return true;
      return inRange(f.printedPage, rule.pages) && f.sectionId === rule.sectionId;
    });
  };
  const figuresForSection = (s: SectionInfo) => content.figures.filter((f) => f.sectionId === s.id || (!f.sectionId && f.event === s.event && inRange(f.printedPage, s.pages)));
  const base = import.meta.env.BASE_URL;

  const declared = new Map(content.events.map((e) => [e.id, e]));
  const factEvents: EventInfo[] = [];
  for (const x of [...content.facts, ...content.rules]) {
    if (!x.event || factEvents.some((e) => e.id === x.event)) continue;
    factEvents.push(declared.get(x.event) ?? { id: x.event, name: x.event, order: 1000 + factEvents.length });
  }
  factEvents.sort((a, b) => a.order - b.order);
  const eventInfo = (id?: string) => (id ? declared.get(id) ?? factEvents.find((e) => e.id === id) : undefined);
  const eventName = (id?: string) => (id ? eventInfo(id)?.name ?? id : undefined);

  const trees = new Map<string, SectionNode>();
  const treeFor = (event: string) => {
    let t = trees.get(event);
    if (!t) {
      const multi = factEvents.length > 1;
      const rules =
        event === ALL_EVENTS || !multi
          ? multi
            ? content.rules.map((r) => ({ ...r, sectionPath: [eventName(r.event) ?? 'Other', ...r.sectionPath] }))
            : content.rules
          : content.rules.filter((r) => r.event === event);
      t = buildRuleTree(rules);
      trees.set(event, t);
    }
    return t;
  };

  const sample = content.sample.rules;
  const editionFor = (event?: string) => {
    if (sample) return undefined;
    const book = content.ruleBooks.find((b) => b.event === event) ?? (event && event !== ALL_EVENTS ? undefined : content.ruleBooks[0]);
    const ev = eventInfo(event);
    const doc = book ?? (ev ? { edition: ev.edition, title: ev.documentTitle, url: ev.documentUrl, publisher: ev.documentPublisher } : content.document);
    return editionLabel(doc);
  };

  return {
    ...content,
    rulesById,
    factsById,
    sectionsById,
    partsById,
    factEvents,
    eventName,
    eventInfo,
    treeFor,
    editionFor,
    tree: treeFor(ALL_EVENTS),
    edition: editionFor(content.ruleBooks[0]?.event),
    figuresForRule,
    figuresForSection,
    contentUrl: (file: string) => {
      const clean = file.replace(/^\.?\//, '');
      return `${base}content/${content.figureMap[clean] ?? clean}`;
    }
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    loadContent()
      .then((c) => alive && setState({ status: 'ready', data: enrich(c) }))
      .catch((e: unknown) => alive && setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, [nonce]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const value = useMemo(() => ({ state, reload }), [state, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const EVENT_KEY = 'mrs.event.v1';

/** Global event selection, persisted in localStorage. Must be rendered below DataProvider. */
export function EventProvider({ children }: { children: ReactNode }) {
  const [event, setEventState] = useState<string>(() => {
    try {
      return localStorage.getItem(EVENT_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const { state } = useLoadState();
  const events = state.status === 'ready' ? state.data.factEvents : [];
  // Default to the first event (Coal Mine Rescue); drop a stored event that no longer exists.
  const effective = !events.length ? ALL_EVENTS : event === ALL_EVENTS || events.some((e) => e.id === event) ? event : events[0].id;
  const setEvent = useCallback((e: string) => {
    setEventState(e);
    try {
      localStorage.setItem(EVENT_KEY, e);
    } catch {
      /* ignore */
    }
  }, []);
  const value = useMemo(() => ({ event: effective, setEvent }), [effective, setEvent]);
  return <EventCtx.Provider value={value}>{children}</EventCtx.Provider>;
}

/** Selected event id, or ALL_EVENTS. */
export function useEvent() {
  return useContext(EventCtx);
}

export function useLoadState() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLoadState outside DataProvider');
  return v;
}

/** Only call below <DataGate>, which renders children once data is ready. */
export function useData(): Data {
  const { state } = useLoadState();
  if (state.status !== 'ready') throw new Error('data not ready');
  return state.data;
}
