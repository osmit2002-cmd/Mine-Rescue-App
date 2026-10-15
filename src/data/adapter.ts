/**
 * Schema adapter: the single place that maps raw JSON onto the app's types.
 * When field names change, edit only the alias lists and helpers in this file.
 *
 * Supported shapes
 *  rules.json
 *   - Nested rule book (2026 MSHA content):
 *       { document:{title,edition,url,...}, redline_note?, sections:[
 *           { id, title, pages:[a,b], intro?, note?, images?:[{file,pdf_page,printed_page,extracted_labels}],
 *             items:[{ id, number, title?, text, pages:[a,b], group?:{letter,title} }] } ] }
 *     Hierarchy shown: section > group > rule. Sub-items (A., 1., a.) stay inside the rule text.
 *   - Flat list: [{ id, number, title, section, subsection(s)?, parent?, text, tags?, pages? }]
 *  facts.json
 *   - { document?, facts:[{ id, number, text, section, category|null, page, source }] } or a bare array.
 *     Optional: answer, keyTerms, distractors.
 *  Either file may be wrapped as { sample: true, ... } to mark placeholder data.
 */
import type { DataIssue, DocumentInfo, EventInfo, Fact, Figure, PartTable, Rule, SectionInfo } from './types';

type Raw = Record<string, unknown>;

/** Field aliases, first match wins. */
export const RULE_FIELDS = {
  id: ['id', 'ruleId', 'rule_id', 'uid', 'key'],
  number: ['number', 'num', 'no', 'ruleNumber', 'rule_number', 'label'],
  title: ['title', 'heading', 'name', 'caption'],
  section: ['section', 'sectionTitle', 'section_title', 'part', 'chapter'],
  /** Below `section`: a string, {letter|number, title} object, or an array of those (outermost first). */
  subsection: ['group', 'subsection', 'subsections', 'subSection', 'sub_section', 'subheading', 'path'],
  parent: ['parent', 'parentId', 'parent_id'],
  text: ['text', 'body', 'content', 'wording'],
  tags: ['tags', 'keywords'],
  pages: ['pages', 'pageRange', 'page_range', 'page'],
  sectionId: ['sectionId', 'section_id'],
  event: ['event', 'contest'],
  format: ['format']
} as const;

export const FACT_FIELDS = {
  id: ['id', 'factId', 'fact_id', 'uid', 'key'],
  number: ['number', 'num', 'no'],
  statement: ['statement', 'text', 'fact', 'body'],
  answer: ['answer', 'correct', 'solution'],
  /** Topic grouping. The 2026 content leaves this null; `section` is NOT used as a category. */
  category: ['category', 'topic', 'group'],
  section: ['section', 'subsection'],
  page: ['page', 'pages'],
  source: ['source', 'ref', 'citation'],
  keyTerms: ['keyTerms', 'key_terms', 'terms', 'keywords'],
  distractors: ['distractors', 'wrongAnswers', 'wrong_answers', 'options'],
  event: ['event', 'contest'],
  reference: ['reference', 'citation_text'],
  note: ['edit_note', 'editNote', 'note']
} as const;

const SECTION_FIELDS = {
  list: ['sections', 'parts', 'chapters'],
  items: ['items', 'rules', 'children'],
  intro: ['intro', 'introduction', 'preamble'],
  note: ['note', 'notes'],
  images: ['images', 'figures']
} as const;

/** Separator accepted inside a single section string to express nesting ("A > B > C"). */
export const SECTION_PATH_SEPARATOR = ' > ';

/** Keys that wrap the record array in an object file, e.g. { "facts": [...] }. */
const ARRAY_KEYS = { rules: ['rules', 'items', 'data', 'records'], facts: ['facts', 'statements', 'items', 'data', 'records'] };

function pick(raw: Raw, keys: readonly string[]): unknown {
  for (const k of keys) if (raw[k] !== undefined && raw[k] !== null) return raw[k];
  return undefined;
}

const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);

/** Scalar to string without trimming (text must stay verbatim). */
function scalar(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

/** Short label: trimmed scalar, or "{letter|number}. {title}" from an object. */
function label(v: unknown): string | undefined {
  const s = scalar(v);
  if (s !== undefined) return s.trim() || undefined;
  if (isObj(v)) {
    const num = scalar(v.letter ?? v.number ?? v.num ?? v.id)?.trim();
    const title = scalar(v.title ?? v.name ?? v.heading)?.trim();
    if (num && title) return `${num}. ${title}`;
    return num || title || undefined;
  }
  return undefined;
}

function pathOf(v: unknown): string[] {
  if (v === undefined) return [];
  if (Array.isArray(v)) return v.map(label).filter((s): s is string => !!s);
  const l = label(v);
  if (!l) return [];
  return l.split(SECTION_PATH_SEPARATOR).map((s) => s.trim()).filter(Boolean);
}

function pageRange(v: unknown): [number, number] | undefined {
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : typeof x === 'string' && /^\d+$/.test(x.trim()) ? Number(x) : undefined);
  if (Array.isArray(v)) {
    const a = n(v[0]);
    const b = n(v[v.length - 1]);
    return a !== undefined ? [a, b ?? a] : undefined;
  }
  const one = n(v);
  return one !== undefined ? [one, one] : undefined;
}

function stringList(v: unknown): string[] | undefined {
  if (v === undefined) return [];
  if (typeof v === 'string') return v.trim() ? [v.trim()] : [];
  if (!Array.isArray(v)) return undefined;
  return v.map(scalar).filter((s): s is string => !!s && !!s.trim()).map((s) => s.trim());
}

export function documentInfo(json: unknown): DocumentInfo {
  if (!isObj(json)) return {};
  const d = isObj(json.document) ? json.document : {};
  return {
    id: label(d.id),
    title: label(d.title),
    edition: label(d.edition),
    publisher: label(d.publisher),
    url: label(d.url),
    note: label(json.redline_note ?? json.note)
  };
}

/** "2026 MSHA rules, approved 1/15/2026" from an edition string like '2026, "Approved – 1/15/2026"'. */
export function editionLabel(doc: DocumentInfo): string | undefined {
  const src = `${doc.edition ?? ''} ${doc.title ?? ''}`;
  const year = /\b(19|20)\d{2}\b/.exec(src)?.[0];
  const date = /\b\d{1,2}\/\d{1,2}\/\d{4}\b/.exec(doc.edition ?? '')?.[0];
  const who = /msha/i.test(`${doc.publisher ?? ''} ${doc.url ?? ''} ${doc.title ?? ''}`) ? 'MSHA ' : '';
  if (!year && !doc.edition) return undefined;
  if (year && date) return `${year} ${who}rules, approved ${date}`;
  return doc.edition ?? `${year} ${who}rules`;
}

/** Parses a figure index like "Index: Proper Method of Roof Testing p41; Extent of Gases p46." */
function figureIndex(note: string | undefined): { title: string; page: number }[] {
  if (!note) return [];
  const body = note.includes('Index:') ? note.slice(note.indexOf('Index:') + 6) : note;
  return [...body.matchAll(/\s*([^;:.]+?)\s+p\.?\s?(\d+)/g)].map((m) => ({ title: m[1].trim(), page: Number(m[2]) })).sort((a, b) => a.page - b.page);
}

function adaptFigure(v: unknown, sectionId: string | undefined, index: { title: string; page: number }[], extra: { event?: string; ruleId?: string; ruleTitle?: string } = {}): Figure | null {
  const raw: Raw = typeof v === 'string' ? { file: v } : isObj(v) ? v : {};
  const file = label(raw.file ?? raw.src ?? raw.path);
  if (!file) return null;
  const printedPage = pageRange(raw.printed_page ?? raw.printedPage ?? raw.page)?.[0];
  const pdfPage = pageRange(raw.pdf_page ?? raw.pdfPage)?.[0];
  const labels = scalar(raw.extracted_labels ?? raw.labels ?? raw.caption) ?? '';
  const first = labels.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  const isFigLabel = /^figure\s+\w+/i.test(first);
  let title: string | undefined;
  if (printedPage !== undefined) for (const e of index) if (e.page <= printedPage) title = e.title;
  const caption = isFigLabel ? first.replace(/^FIGURE/, 'Figure') : printedPage !== undefined ? `Page ${printedPage}` : file.split('/').pop() ?? file;
  return { file: file.replace(/^\.?\//, ''), printedPage, pdfPage, labels, caption, title: title ?? extra.ruleTitle, sectionId, event: extra.event, ruleId: extra.ruleId };
}

/**
 * Events in a multi-event facts file:
 * { events: { "<id>": { name, document, written_exam: { questions, from_statements_of_fact?, detail } } },
 *   documents: { "<docId>": { title, edition, url } } }
 */
export function eventsInfo(json: unknown): EventInfo[] {
  if (!isObj(json) || !isObj(json.events)) return [];
  const docs = isObj(json.documents) ? json.documents : {};
  return Object.entries(json.events).map(([id, v], order) => {
    const e = isObj(v) ? v : {};
    const exam = isObj(e.written_exam) ? e.written_exam : {};
    const num = (x: unknown) => (typeof x === 'number' && x > 0 ? x : undefined);
    const docId = label(e.document);
    const doc = docId && isObj(docs[docId]) ? (docs[docId] as Raw) : {};
    return {
      id,
      name: label(e.name) ?? id,
      examQuestions: num(exam.from_statements_of_fact) ?? num(exam.questions),
      totalQuestions: num(exam.questions),
      factQuestions: num(exam.from_statements_of_fact),
      partsQuestions: num(exam.from_identification_of_parts),
      timeLimitMin: num(exam.time_limit_min),
      examFormat: label(exam.format),
      examDetail: label(exam.detail),
      examSourceRule: label(exam.source_rule),
      rulesFile: label(e.rules_file),
      documentId: docId,
      documentTitle: label(doc.title),
      documentUrl: label(doc.url),
      documentPublisher: label(doc.publisher),
      edition: label(doc.edition),
      order
    };
  });
}

export interface UnwrappedRules {
  records: unknown[];
  sections: SectionInfo[];
  figures: Figure[];
  document: DocumentInfo;
  sample: boolean;
}

/**
 * Accepts a nested rule book, a bare array, or an object wrapping an array. Throws if nothing usable is found.
 * `event` (or the file's own "event") is stamped on sections, rules and figures. Section ids are prefixed
 * with the event ("first-aid:general") so books from different events never collide.
 */
export function unwrapRules(json: unknown, eventHint?: string | null): UnwrappedRules {
  const sample = isObj(json) && json.sample === true;
  const document = documentInfo(json);
  const fileEvent = (isObj(json) ? label(json.event) : undefined) ?? eventHint ?? undefined;
  const list = isObj(json) ? pick(json, SECTION_FIELDS.list) : undefined;
  if (Array.isArray(list)) {
    const sections: SectionInfo[] = [];
    const figures: Figure[] = [];
    const records: unknown[] = [];
    list.forEach((s, si) => {
      if (!isObj(s)) {
        records.push(s); // reported as a bad record by the validator
        return;
      }
      const event = label(s.event) ?? fileEvent;
      const rawId = label(s.id) ?? `section-${si + 1}`;
      const id = event && fileEvent ? `${event}:${rawId}` : rawId;
      const title = label(s.title ?? s.name) ?? rawId;
      const note = label(pick(s, SECTION_FIELDS.note));
      const imgs = pick(s, SECTION_FIELDS.images);
      const idx = figureIndex(note);
      const figs = (Array.isArray(imgs) ? imgs : []).map((v) => adaptFigure(v, id, idx, { event })).filter((f): f is Figure => !!f);
      figures.push(...figs);
      const intro = scalar(pick(s, SECTION_FIELDS.intro));
      sections.push({ id, title, pages: pageRange(s.pages), intro: intro || undefined, note, figures: figs, event, order: si });
      const items = pick(s, SECTION_FIELDS.items);
      for (const it of Array.isArray(items) ? items : []) {
        if (!isObj(it)) {
          records.push(it);
          continue;
        }
        const itEvent = label(it.event) ?? event;
        const itImgs = pick(it, SECTION_FIELDS.images);
        if (Array.isArray(itImgs)) {
          const ruleId = label(it.id);
          figures.push(...itImgs.map((v) => adaptFigure(v, id, [], { event: itEvent, ruleId, ruleTitle: label(it.title) })).filter((f): f is Figure => !!f));
        }
        records.push({ ...it, section: it.section ?? title, sectionId: it.sectionId ?? id, event: itEvent });
      }
    });
    return { records, sections, figures, document, sample };
  }
  const flat = unwrap(json, 'rules');
  return { ...flat, records: fileEvent ? flat.records.map((r) => (isObj(r) && r.event === undefined ? { ...r, event: fileEvent } : r)) : flat.records, sections: [], figures: [], document };
}

export interface Unwrapped {
  records: unknown[];
  sample: boolean;
}

/** Accepts a bare array or an object wrapping the array. Throws if no array is found. */
export function unwrap(json: unknown, file: 'rules' | 'facts'): Unwrapped {
  if (Array.isArray(json)) return { records: json, sample: false };
  if (isObj(json)) {
    const sample = json.sample === true;
    for (const k of ARRAY_KEYS[file]) if (Array.isArray(json[k])) return { records: json[k] as unknown[], sample };
    for (const v of Object.values(json)) if (Array.isArray(v)) return { records: v, sample };
  }
  throw new Error(`${file}.json: expected an array of records (or an object containing one)`);
}

export type AdaptResult<T> = { ok: true; value: T; warnings: string[] } | { ok: false; error: string };

export function adaptRule(input: unknown, index: number): AdaptResult<Rule> {
  if (!isObj(input)) return { ok: false, error: 'record is not an object' };
  const raw = input;
  const warnings: string[] = [];
  const number = label(pick(raw, RULE_FIELDS.number)) ?? '';
  const sectionId = label(pick(raw, RULE_FIELDS.sectionId));
  let id = label(pick(raw, RULE_FIELDS.id));
  if (!id) {
    if (number) {
      id = sectionId ? `${sectionId}-${number}` : `rule-${number}`;
      warnings.push(`missing id; using "${id}"`);
    } else return { ok: false, error: 'missing id and number' };
  }
  const rawText = pick(raw, RULE_FIELDS.text);
  const text = scalar(rawText);
  if (rawText !== undefined && text === undefined) return { ok: false, error: 'text is not a string' };
  const title = label(pick(raw, RULE_FIELDS.title)) ?? '';
  if (!text?.trim() && !title) return { ok: false, error: 'missing text and title' };
  if (!text?.trim()) warnings.push('no rule text (heading only)');
  const sectionPath = [...pathOf(pick(raw, RULE_FIELDS.section)), ...pathOf(pick(raw, RULE_FIELDS.subsection))];
  if (sectionPath.length === 0) warnings.push('no section; listed under "Unsorted"');
  const tags = stringList(pick(raw, RULE_FIELDS.tags));
  if (tags === undefined) warnings.push('tags is not a list; ignored');
  const pagesRaw = pick(raw, RULE_FIELDS.pages);
  const pages = pageRange(pagesRaw);
  if (pagesRaw !== undefined && !pages) warnings.push('pages not understood; ignored');
  const parent = label(pick(raw, RULE_FIELDS.parent));
  const fmt = label(pick(raw, RULE_FIELDS.format));
  if (fmt && fmt !== 'pre') warnings.push(`unknown format "${fmt}"; shown as normal text`);
  return {
    ok: true,
    warnings,
    value: {
      id,
      number,
      title,
      sectionPath: sectionPath.length ? sectionPath : ['Unsorted'],
      parent,
      text: text ?? '',
      tags: tags ?? [],
      pages,
      sectionId,
      event: label(pick(raw, RULE_FIELDS.event)),
      format: fmt === 'pre' ? 'pre' : undefined,
      order: index
    }
  };
}

export function adaptFact(input: unknown, index: number): AdaptResult<Fact> {
  if (!isObj(input)) return { ok: false, error: 'record is not an object' };
  const raw = input;
  const warnings: string[] = [];
  const statementRaw = pick(raw, FACT_FIELDS.statement);
  const statement = scalar(statementRaw);
  if (!statement || !statement.trim()) return { ok: false, error: statementRaw === undefined ? 'missing statement/text' : 'statement/text is empty or not a string' };
  const number = label(pick(raw, FACT_FIELDS.number));
  let id = label(pick(raw, FACT_FIELDS.id));
  if (!id) {
    id = number ? `fact-${number}` : `fact-${index + 1}`;
    warnings.push(`missing id; using "${id}"`);
  }
  const answerRaw = pick(raw, FACT_FIELDS.answer);
  const answer = label(answerRaw);
  if (answerRaw !== undefined && answer === undefined) warnings.push('answer is not a string; ignored');
  const keyTerms = stringList(pick(raw, FACT_FIELDS.keyTerms));
  if (keyTerms === undefined) warnings.push('keyTerms is not a list; ignored');
  const distractors = stringList(pick(raw, FACT_FIELDS.distractors));
  if (distractors === undefined) warnings.push('distractors is not a list; ignored');
  const lower = statement.toLowerCase();
  const missingTerms = (keyTerms ?? []).filter((t) => !lower.includes(t.toLowerCase()));
  if (missingTerms.length) warnings.push(`key term(s) not found in statement: ${missingTerms.join(', ')}`);
  const catPath = pathOf(pick(raw, FACT_FIELDS.category));
  const reference = label(pick(raw, FACT_FIELDS.reference));
  if (reference && !statement.trimEnd().endsWith(reference)) warnings.push('reference is not at the end of the text; it may be blanked in quizzes');
  return {
    ok: true,
    warnings,
    value: {
      id,
      number,
      statement,
      answer,
      category: catPath.length ? catPath.join(' / ') : undefined,
      section: label(pick(raw, FACT_FIELDS.section)),
      page: pageRange(pick(raw, FACT_FIELDS.page))?.[0],
      source: label(pick(raw, FACT_FIELDS.source)),
      keyTerms: (keyTerms ?? []).filter((t) => !missingTerms.includes(t)),
      distractors: distractors ?? [],
      event: label(pick(raw, FACT_FIELDS.event)),
      reference,
      note: label(pick(raw, FACT_FIELDS.note)),
      order: index
    }
  };
}

/**
 * parts.json: { parts: [{ id, event, assembly, title_note, page, figure, parts: [{ cons_no, designation }] }],
 *               count_tables, count_rows }
 * Bad tables/rows are skipped and reported. Never throws.
 */
export function adaptParts(json: unknown): { tables: PartTable[]; issues: DataIssue[] } {
  const issues: DataIssue[] = [];
  const tables: PartTable[] = [];
  if (json === undefined || json === null) return { tables, issues };
  let list: unknown[] = [];
  if (Array.isArray(json)) list = json;
  else if (isObj(json) && Array.isArray(json.parts)) list = json.parts;
  else if (isObj(json) && Array.isArray(json.tables)) list = json.tables;
  else {
    issues.push({ file: 'parts', index: -1, level: 'error', message: 'parts.json: expected { parts: [...] }' });
    return { tables, issues };
  }
  const ids = new Set<string>();
  list.forEach((t, index) => {
    if (!isObj(t)) {
      issues.push({ file: 'parts', index, level: 'error', message: 'table is not an object (skipped)' });
      return;
    }
    let id = label(t.id) ?? `parts-${index + 1}`;
    if (ids.has(id)) {
      issues.push({ file: 'parts', index, id, level: 'warning', message: `duplicate id; kept as "${id}~${index}"` });
      id = `${id}~${index}`;
    }
    ids.add(id);
    const assembly = label(t.assembly ?? t.title ?? t.name);
    const rawRows = Array.isArray(t.parts) ? t.parts : Array.isArray(t.rows) ? t.rows : null;
    if (!rawRows) {
      issues.push({ file: 'parts', index, id, level: 'error', message: 'table has no rows (skipped)' });
      return;
    }
    const rows: { no: string; name: string }[] = [];
    rawRows.forEach((r, ri) => {
      const no = isObj(r) ? label(r.cons_no ?? r.no ?? r.number) : undefined;
      const name = isObj(r) ? scalar(r.designation ?? r.name) : undefined;
      if (!no || !name || !name.trim()) issues.push({ file: 'parts', index, id, level: 'warning', message: `row ${ri + 1} missing number or name (skipped)` });
      else rows.push({ no, name });
    });
    const titleNote = label(t.title_note ?? t.titleNote);
    const page = pageRange(t.page)?.[0];
    if (!assembly && !titleNote) issues.push({ file: 'parts', index, id, level: 'warning', message: 'table has no assembly title' });
    tables.push({ id, event: label(t.event), assembly: assembly ?? (page !== undefined ? `Parts list, p. ${page} (no assembly title printed)` : `Parts table ${index + 1}`), titleNote, page, figure: label(t.figure), rows, order: index });
  });
  if (isObj(json)) {
    const nT = typeof json.count_tables === 'number' ? json.count_tables : undefined;
    const nR = typeof json.count_rows === 'number' ? json.count_rows : undefined;
    const rows = tables.reduce((n, t) => n + t.rows.length, 0);
    if (nT !== undefined && nT !== tables.length) issues.push({ file: 'parts', index: -1, level: 'warning', message: `count_tables says ${nT}, loaded ${tables.length}` });
    if (nR !== undefined && nR !== rows) issues.push({ file: 'parts', index: -1, level: 'warning', message: `count_rows says ${nR}, loaded ${rows}` });
  }
  return { tables, issues };
}
