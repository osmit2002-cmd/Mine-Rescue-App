import { collectCropFigures } from './figures';
import { adaptParts, documentInfo, eventsInfo, unwrap, unwrapRules } from './adapter';
import type { ContentState, DataIssue, DocumentInfo, Figure, SectionInfo } from './types';
import { validateFacts, validateRules } from './validate';

const base = import.meta.env.BASE_URL;

async function fetchJson(name: string): Promise<unknown> {
  const res = await fetch(`${base}content/${name}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.json();
}

export interface RuleBookInput {
  file: string;
  event?: string | null;
  json: unknown;
}

export interface ContentInput {
  ruleBooks: RuleBookInput[];
  facts: unknown;
  parts?: unknown;
  buildInfo?: unknown;
  /** figures.json (cropped figures index), if present. */
  figureIndex?: unknown;
}

type BuildInfo = {
  rules?: { used?: string };
  facts?: { used?: string };
  figures?: { map?: Record<string, string>; checked?: boolean; runtime?: string[] };
  figuresIndex?: { used?: string | false };
};

/** Parses already-fetched JSON into content. Pure; never throws; exported for tests. */
export function parseAll(input: ContentInput): ContentState {
  const issues: DataIssue[] = [];
  const info = (input.buildInfo && typeof input.buildInfo === 'object' ? input.buildInfo : {}) as BuildInfo;
  const sections: SectionInfo[] = [];
  const figures: Figure[] = [];
  const ruleBooks: ContentState['ruleBooks'] = [];
  const rawRules: unknown[] = [];
  const sectionFigures: NonNullable<Parameters<typeof collectCropFigures>[0]['sectionFigures']> = [];
  const recordFile: string[] = [];
  let rulesSample = info.rules?.used === 'sample';
  for (const book of input.ruleBooks) {
    try {
      const u = unwrapRules(book.json, book.event);
      sections.push(...u.sections.map((s) => ({ ...s, order: sections.length + s.order })));
      figures.push(...u.figures);
      sectionFigures.push(...u.sectionFigures.map((x) => ({ ...x, file: book.file })));
      rawRules.push(...u.records);
      u.records.forEach(() => recordFile.push(book.file));
      ruleBooks.push({ ...u.document, event: book.event ?? u.sections[0]?.event ?? undefined, file: book.file });
      rulesSample = rulesSample || u.sample;
    } catch (e) {
      issues.push({ file: book.file, index: -1, level: 'error', message: (e as Error).message });
    }
  }
  const vr = validateRules(rawRules);
  // Report rule issues against the file they came from.
  issues.push(...vr.issues.map((i) => ({ ...i, file: recordFile[i.index] ?? i.file })));

  let document: DocumentInfo = ruleBooks[0] ?? {};
  const events = eventsInfo(input.facts);
  let facts = { records: [] as ContentState['facts'], sample: false };
  try {
    const u = unwrap(input.facts, 'facts');
    const v = validateFacts(u.records);
    issues.push(...v.issues);
    facts = { records: v.records, sample: u.sample || info.facts?.used === 'sample' };
    if (!document.title && !document.edition) document = documentInfo(input.facts);
    // Count check against the file's own totals.
    const fj = input.facts as Record<string, unknown>;
    if (fj && typeof fj === 'object' && !Array.isArray(fj)) {
      if (typeof fj.count === 'number' && fj.count !== v.records.length)
        issues.push({ file: 'facts', index: -1, level: 'warning', message: `count says ${fj.count}, loaded ${v.records.length}` });
      const byEvent = fj.counts_by_event;
      if (byEvent && typeof byEvent === 'object')
        for (const [ev, n] of Object.entries(byEvent as Record<string, unknown>)) {
          const got = v.records.filter((f) => f.event === ev).length;
          if (typeof n === 'number' && n !== got) issues.push({ file: 'facts', index: -1, level: 'warning', message: `${ev}: counts_by_event says ${n}, loaded ${got}` });
        }
    }
  } catch (e) {
    issues.push({ file: 'facts', index: -1, level: 'error', message: (e as Error).message });
  }
  const parts = adaptParts(input.parts);
  issues.push(...parts.issues);
  const crops = collectCropFigures({
    rawRules: rawRules.map((raw, i) => ({ raw, file: recordFile[i] })),
    sectionFigures,
    sections: new Map(sections.map((s) => [s.id, { event: s.event, rawId: s.rawId }])),
    index: input.figureIndex,
    figureMap: info.figures?.map ?? {},
    filesChecked: info.figures?.checked === true,
    rules: new Map(vr.records.map((r) => [r.id, r.event]))
  });
  figures.push(...crops.figures);
  issues.push(...crops.issues);

  return {
    rules: vr.records,
    facts: facts.records,
    sections,
    figures,
    document,
    events,
    ruleBooks,
    parts: parts.tables,
    figureMap: info.figures?.map ?? {},
    galleries: crops.galleries,
    sectionGalleries: crops.sectionGalleries,
    runtimeFigures: Array.isArray(info.figures?.runtime) ? info.figures.runtime : [],
    issues,
    sample: { rules: rulesSample, facts: facts.sample }
  };
}

/** Single rule book convenience wrapper (used by tests and flat content). */
export function parseContent(rulesJson: unknown, factsJson: unknown, buildInfo?: unknown): ContentState {
  return parseAll({ ruleBooks: [{ file: 'rules', json: rulesJson }], facts: factsJson, buildInfo });
}

export async function loadContent(): Promise<ContentState> {
  const buildInfo = (await fetchJson('build-info.json').catch(() => undefined)) as
    | (BuildInfo & { ruleFiles?: { file: string; event?: string | null }[]; parts?: { used?: boolean } })
    | undefined;
  const ruleFiles = buildInfo?.ruleFiles?.length ? buildInfo.ruleFiles : [{ file: 'rules.json', event: null }];
  const [facts, parts, figureIndex, ...books] = await Promise.allSettled([
    fetchJson('facts.json'),
    buildInfo?.parts?.used ? fetchJson('parts.json') : Promise.resolve(undefined),
    buildInfo?.figuresIndex?.used ? fetchJson('figures.json') : Promise.resolve(undefined),
    ...ruleFiles.map((r) => fetchJson(r.file))
  ]);
  const loadIssues: DataIssue[] = [];
  const ruleBooks: RuleBookInput[] = [];
  books.forEach((b, i) => {
    if (b.status === 'fulfilled') ruleBooks.push({ ...ruleFiles[i], json: b.value });
    else loadIssues.push({ file: ruleFiles[i].file, index: -1, level: 'error', message: `could not load ${ruleFiles[i].file} (${String(b.reason?.message ?? b.reason)})` });
  });
  if (facts.status === 'rejected') loadIssues.push({ file: 'facts', index: -1, level: 'error', message: `could not load facts.json (${String(facts.reason?.message ?? facts.reason)})` });
  if (parts.status === 'rejected') loadIssues.push({ file: 'parts', index: -1, level: 'error', message: `could not load parts.json (${String(parts.reason?.message ?? parts.reason)})` });
  if (figureIndex.status === 'rejected') loadIssues.push({ file: 'figures.json', index: -1, level: 'error', message: `could not load figures.json (${String(figureIndex.reason?.message ?? figureIndex.reason)})` });
  const state = parseAll({
    ruleBooks,
    facts: facts.status === 'fulfilled' ? facts.value : [],
    parts: parts.status === 'fulfilled' ? parts.value : undefined,
    figureIndex: figureIndex.status === 'fulfilled' ? figureIndex.value : undefined,
    buildInfo
  });
  state.issues.unshift(...loadIssues);
  return state;
}
