/**
 * Cropped figures for the rule and section galleries. Optional sources, merged by figure id:
 *  - a rule item's list:     { ..., "figures": [{ "id", "file", "caption", "page", "pdf_page"?, "kind"? }] }  (display order)
 *  - a section's list:       same shape, for sections without rule items (e.g. a figures-only section)
 *  - figures.json:           { "figures": [{ "id", "file", "caption", "page", "event", "kind",
 *                               "rule_ids": [...], "section_ids": [...], "full_page": "figures/…png" | null }] }
 *                            (a bare array works too; "rules", "ruleIds", "rule_id", "rule" are accepted for "rule_ids")
 * figures.json entries of kind "page" are the older full-page images (already shown through `images`) and are
 * not added as cropped figures. Galleries follow the rule's/section's own order, then figures that only
 * figures.json links. Problems (missing files, unknown rules or sections, duplicates) are reported as issues
 * and the bad figure or link is skipped; nothing throws.
 */
import { adaptCropFigure, isCropFigureEntry } from './adapter';
import type { DataIssue, Figure } from './types';

export interface CropFigureInput {
  /** Raw rule records (as in the rule files) with the file each came from. */
  rawRules: { raw: unknown; file: string }[];
  /** Section-level cropped-figure lists (sectionId is the app's section id). */
  sectionFigures?: { sectionId: string; event?: string; entries: unknown[]; file?: string }[];
  /** Parsed figures.json, if any. */
  index?: unknown;
  /** Original figure path -> built file, from build-info.json. */
  figureMap: Record<string, string>;
  /** True when figureMap lists every figure file the build found, so missing files can be reported. */
  filesChecked: boolean;
  /** Known rules: id -> event. */
  rules: Map<string, string | undefined>;
  /** Known sections: app id -> { event, rawId }. */
  sections?: Map<string, { event?: string; rawId?: string }>;
}

export interface CropFigures {
  figures: Figure[];
  galleries: Record<string, string[]>;
  sectionGalleries: Record<string, string[]>;
  issues: DataIssue[];
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function indexEntries(json: unknown): unknown[] | undefined {
  if (Array.isArray(json)) return json;
  if (isObj(json)) for (const k of ['figures', 'items', 'images']) if (Array.isArray(json[k])) return json[k] as unknown[];
  return undefined;
}

export function collectCropFigures(input: CropFigureInput): CropFigures {
  const issues: DataIssue[] = [];
  const warn = (file: string, index: number, id: string | undefined, message: string) => issues.push({ file, index, id, level: 'warning', message });
  const byId = new Map<string, Figure>();
  const ruleOrder = new Map<string, string[]>();
  const sectionOrder = new Map<string, string[]>();
  const listed = { rule: new Map<string, Set<string>>(), section: new Map<string, Set<string>>() }; // figure id -> owners from the owners' own lists
  const push = (order: Map<string, string[]>, owner: string, figId: string) => {
    const l = order.get(owner) ?? [];
    if (!l.includes(figId)) l.push(figId);
    order.set(owner, l);
  };
  const add = (f: Figure, file: string, index: number): boolean => {
    const have = byId.get(f.id!);
    if (!have) {
      byId.set(f.id!, { ...f, ruleIds: [...(f.ruleIds ?? [])], sectionIds: [...(f.sectionIds ?? [])] });
      return true;
    }
    if (have.file !== f.file) {
      warn(file, index, f.id, `figure id "${f.id}" is used for two files (${have.file}, ${f.file}); the second is ignored`);
      return false;
    }
    have.ruleIds = [...new Set([...(have.ruleIds ?? []), ...(f.ruleIds ?? [])])];
    have.sectionIds = [...new Set([...(have.sectionIds ?? []), ...(f.sectionIds ?? [])])];
    if (!have.caption && f.caption) have.caption = f.caption;
    if (have.printedPage === undefined) have.printedPage = f.printedPage;
    if (have.pdfPage === undefined) have.pdfPage = f.pdfPage;
    if (!have.event) have.event = f.event;
    if (!have.fullPage) have.fullPage = f.fullPage;
    if (!have.figureKind) have.figureKind = f.figureKind;
    return true;
  };
  const ownList = (kind: 'rule' | 'section', owner: string, entries: unknown[], event: string | undefined, file: string, index: number) => {
    const seen = new Set<string>();
    for (const e of entries) {
      const r = adaptCropFigure(e, kind === 'rule' ? { event, ruleId: owner } : { event, sectionId: owner });
      if (!r.figure) {
        warn(file, index, owner, `${r.error} (figure skipped)`);
        continue;
      }
      const id = r.figure.id!;
      if (seen.has(id)) {
        warn(file, index, owner, `figure "${id}" is listed twice for ${kind} ${owner}`);
        continue;
      }
      seen.add(id);
      if (!add(r.figure, file, index)) continue;
      push(kind === 'rule' ? ruleOrder : sectionOrder, owner, id);
      const m = listed[kind];
      m.set(id, (m.get(id) ?? new Set()).add(owner));
    }
  };

  input.rawRules.forEach(({ raw, file }, index) => {
    if (!isObj(raw) || !Array.isArray(raw.figures)) return;
    const entries = raw.figures.filter(isCropFigureEntry);
    if (!entries.length) return;
    const ruleId = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : undefined;
    if (!ruleId) return warn(file, index, undefined, 'rule has figures but no id (figures skipped)');
    ownList('rule', ruleId, entries, typeof raw.event === 'string' ? raw.event : undefined, file, index);
  });
  for (const s of input.sectionFigures ?? []) ownList('section', s.sectionId, s.entries, s.event, s.file ?? 'rules', -1);

  const fromIndex = new Map<string, Figure>();
  if (input.index !== undefined) {
    const entries = indexEntries(input.index);
    if (!entries) issues.push({ file: 'figures.json', index: -1, level: 'error', message: 'figures.json has no figures list (ignored)' });
    const ids = new Set<string>();
    (entries ?? []).forEach((e, index) => {
      const r = adaptCropFigure(e);
      if (!r.figure) return warn('figures.json', index, undefined, `${r.error} (figure skipped)`);
      const id = r.figure.id!;
      if (ids.has(id)) return warn('figures.json', index, id, `figure id "${id}" appears twice in figures.json (second entry ignored)`);
      ids.add(id);
      if (r.figure.figureKind === 'page' && !byId.has(id)) return;
      fromIndex.set(id, r.figure);
      add(r.figure, 'figures.json', index);
    });
    // The index and the rule/section lists should agree on who uses each figure.
    for (const kind of ['rule', 'section'] as const)
      for (const [id, owners] of listed[kind]) {
        const f = fromIndex.get(id);
        if (!f) {
          if (fromIndex.size) warn('figures.json', -1, id, `figure "${id}" is listed by ${kind} ${[...owners].join(', ')} but missing from figures.json`);
          continue;
        }
        const idxOwners = new Set(kind === 'rule' ? f.ruleIds : (f.sectionIds ?? []).map((s) => resolveSection(s, f.event, input.sections) ?? s));
        const missing = [...owners].filter((o) => !idxOwners.has(o));
        if (missing.length) warn('figures.json', -1, id, `figure "${id}": figures.json ${kind}_ids lacks ${missing.join(', ')}`);
      }
  }

  const built = new Set([...Object.keys(input.figureMap), ...Object.values(input.figureMap)]);
  const files = new Map<string, string>();
  const figures: Figure[] = [];
  for (const f of byId.values()) {
    if (input.filesChecked && !built.has(f.file)) {
      warn('figures', -1, f.id, `figure "${f.id}": file ${f.file} not found (figure skipped)`);
      continue;
    }
    const other = files.get(f.file);
    if (other) warn('figures', -1, f.id, `figures "${other}" and "${f.id}" use the same file ${f.file}`);
    else files.set(f.file, f.id!);
    let fullPage = f.fullPage;
    if (fullPage && input.filesChecked && !built.has(fullPage)) {
      warn('figures', -1, f.id, `figure "${f.id}": full page ${fullPage} not found (link hidden)`);
      fullPage = undefined;
    }
    for (const id of (f.ruleIds ?? []).filter((id) => !input.rules.has(id))) warn('figures', -1, f.id, `figure "${f.id}" refers to unknown rule "${id}"`);
    const ruleIds = (f.ruleIds ?? []).filter((id) => input.rules.has(id));
    const sectionIds: string[] = [];
    for (const s of f.sectionIds ?? []) {
      const id = resolveSection(s, f.event, input.sections);
      if (id) sectionIds.push(id);
      else warn('figures', -1, f.id, `figure "${f.id}" refers to unknown section "${s}"`);
    }
    const event = f.event ?? (ruleIds.length ? input.rules.get(ruleIds[0]) : undefined);
    const caption = f.caption || (f.printedPage !== undefined ? `Figure, rule book p. ${f.printedPage}` : 'Figure');
    figures.push({ ...f, ruleIds, sectionIds: [...new Set(sectionIds)], event, caption, fullPage });
    for (const id of ruleIds) push(ruleOrder, id, f.id!);
    for (const id of new Set(sectionIds)) push(sectionOrder, id, f.id!);
  }
  const kept = new Set(figures.map((f) => f.id));
  const finish = (order: Map<string, string[]>, known: (id: string) => boolean) => {
    const out: Record<string, string[]> = {};
    for (const [owner, ids] of order) {
      const l = ids.filter((id) => kept.has(id));
      if (!l.length) continue;
      if (known(owner)) out[owner] = l;
      else warn('figures', -1, owner, `figures listed for unknown ${order === ruleOrder ? 'rule' : 'section'} "${owner}" are not shown`);
    }
    return out;
  };
  return {
    figures,
    galleries: finish(ruleOrder, (id) => input.rules.has(id)),
    sectionGalleries: finish(sectionOrder, (id) => !input.sections || input.sections.has(id)),
    issues
  };
}

/** A section id from the data (app id, or the raw id used in figures.json) -> the app's section id. */
function resolveSection(id: string, event: string | undefined, sections?: Map<string, { event?: string; rawId?: string }>): string | undefined {
  if (!sections) return id;
  if (sections.has(id)) return id;
  if (event && sections.has(`${event}:${id}`)) return `${event}:${id}`;
  for (const [appId, s] of sections) if (s.rawId === id && (!event || s.event === event)) return appId;
  return undefined;
}

/** Owner id -> its cropped figures, in gallery order. */
export function cropsByOwner(figures: Figure[], galleries: Record<string, string[]>): Map<string, Figure[]> {
  const byId = new Map(figures.filter((f) => f.kind === 'crop').map((f) => [f.id!, f]));
  const out = new Map<string, Figure[]>();
  for (const [owner, ids] of Object.entries(galleries)) {
    const l = ids.map((id) => byId.get(id)).filter((f): f is Figure => !!f);
    if (l.length) out.set(owner, l);
  }
  return out;
}
/** @deprecated name kept for tests: rule id -> figures. */
export const cropsByRule = cropsByOwner;
