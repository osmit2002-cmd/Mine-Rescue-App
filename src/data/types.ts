/** App-internal shapes. The raw JSON is mapped onto these in adapter.ts (the ONLY place that knows field names). */

export interface Rule {
  id: string;
  /** Display number exactly as in the rule book, e.g. "29" or "3(b)". May be empty. */
  number: string;
  title: string;
  /** Section hierarchy, outermost first, e.g. ["Section I", "Rules Governing ...", "Written Examination"]. */
  sectionPath: string[];
  /** id of a parent rule (for sub-rules nested under a rule). */
  parent?: string;
  /** Verbatim rule wording. Never trimmed, reflowed or otherwise modified. */
  text: string;
  tags: string[];
  /** Printed rule-book page range [first, last], if known. */
  pages?: [number, number];
  /** id of the section this rule belongs to (nested documents only). */
  sectionId?: string;
  /** Contest event (e.g. "mine-rescue", "first-aid"). */
  event?: string;
  /** 'pre' = preformatted skill sheet or form: shown monospace with whitespace exactly as printed. */
  format?: 'pre';
  /** Position in the source file, used for stable ordering and prev/next. */
  order: number;
}

export interface Figure {
  /** Path relative to the content folder, e.g. "figures/page-43.png". */
  file: string;
  /** Printed rule-book page (used to match figures to rules by page range). */
  printedPage?: number;
  pdfPage?: number;
  /** Label text extracted from the drawing (may be empty). */
  labels: string;
  /** First line of the labels, e.g. "Figure 4", or a fallback like "Page 48". */
  caption: string;
  /** Title from the section's figure index, e.g. "Extent of Gases". */
  title?: string;
  sectionId?: string;
  /** Rule item this figure belongs to (e.g. a skill sheet or parts page). */
  ruleId?: string;
  event?: string;
  /** Stable id of a cropped figure (from a rule's `figures` list or figures.json). */
  id?: string;
  /**
   * 'crop' = an individual cropped figure (diagram, skill sheet, parts drawing) shown in the rule's gallery.
   * Absent = a whole page image (the original figures), shown as before.
   */
  kind?: 'crop';
  /** Rules a cropped figure belongs to (from the rule item and/or figures.json). */
  ruleIds?: string[];
  /** The data's own figure type, e.g. "figure", "skill-sheet", "parts-drawing", "map-symbol". */
  figureKind?: string;
  /** Sections a cropped figure belongs to (sections without rule items have their own gallery). */
  sectionIds?: string[];
  /** Full rule-book page the crop was cut from (content path), loaded only on request. */
  fullPage?: string;
}

/** Section-level information from nested rule books (title, intro paragraphs, notes, figures). */
export interface SectionInfo {
  id: string;
  title: string;
  pages?: [number, number];
  /** Verbatim introductory text before the numbered rules. */
  intro?: string;
  note?: string;
  figures: Figure[];
  event?: string;
  order: number;
  /** Section id as written in the rule file (before the event prefix); figures.json section_ids use it. */
  rawId?: string;
}

export interface PartRow {
  /** Number/label as printed, e.g. "12" or "A". */
  no: string;
  /** Part name as printed. */
  name: string;
}

/** One Identification of Parts table from a bench rule book. */
export interface PartTable {
  id: string;
  event?: string;
  assembly: string;
  titleNote?: string;
  page?: number;
  /** Figure file (original content path; map with contentUrl). */
  figure?: string;
  rows: PartRow[];
  order: number;
}

/** A contest event in a multi-event facts file. */
export interface EventInfo {
  id: string;
  name: string;
  /** Number of statement-of-fact questions on that event's written exam (used for the mock exam). */
  examQuestions?: number;
  /** Total questions on the written exam. */
  totalQuestions?: number;
  /** Questions from statements of fact / from Identification of Parts (bench events). */
  factQuestions?: number;
  partsQuestions?: number;
  timeLimitMin?: number;
  examFormat?: string;
  examDetail?: string;
  examSourceRule?: string;
  rulesFile?: string;
  documentId?: string;
  documentPublisher?: string;
  documentTitle?: string;
  documentUrl?: string;
  edition?: string;
  order: number;
}

export interface DocumentInfo {
  id?: string;
  title?: string;
  /** e.g. '2026, "Approved – 1/15/2026"' */
  edition?: string;
  publisher?: string;
  url?: string;
  /** Any note about the source (e.g. redline handling). */
  note?: string;
}

export interface Fact {
  id: string;
  /** Number in the source list, if any (e.g. "17"). */
  number?: string;
  /** Verbatim statement of fact. */
  statement: string;
  /** Explicit answer, if the content supplies one (usually absent). */
  answer?: string;
  /** Topic grouping, if the content provides one (the 2026 source does not). */
  category?: string;
  /** Section of the rule book the statement comes from. */
  section?: string;
  page?: number;
  source?: string;
  /** Contest event the statement belongs to (e.g. "mine-rescue", "first-aid"). Quiz questions stay within one event. */
  event?: string;
  /** Citation printed at the end of the statement (already part of `statement`); never blanked. */
  reference?: string;
  /** Editor's note about how the statement was transcribed (e.g. typo kept as printed). */
  note?: string;
  /** Terms worth blanking out in a quiz, if supplied. */
  keyTerms: string[];
  /** Wrong-answer options for multiple choice, if supplied. */
  distractors: string[];
  order: number;
}

export type IssueLevel = 'error' | 'warning';

export interface DataIssue {
  file: 'rules' | 'facts' | 'parts' | string;
  /** Index of the record in the source array (-1 for file-level problems). */
  index: number;
  id?: string;
  level: IssueLevel;
  message: string;
}

export interface ContentState {
  rules: Rule[];
  facts: Fact[];
  sections: SectionInfo[];
  figures: Figure[];
  document: DocumentInfo;
  /** Events found in facts.json (empty for single-event content). */
  events: EventInfo[];
  /** Per-event rule book documents (title, edition, url, redline note). */
  ruleBooks: (DocumentInfo & { event?: string; file: string })[];
  parts: PartTable[];
  /** Original figure path -> built file (e.g. png -> downscaled webp). */
  figureMap: Record<string, string>;
  /** Rule id -> its cropped figure ids, in the order the rule lists them (the gallery order). */
  galleries: Record<string, string[]>;
  /** Section id -> its cropped figure ids, in the section's own order. */
  sectionGalleries: Record<string, string[]>;
  /** Built figure files that are NOT precached (full-page images when crops exist); cached on first view. */
  runtimeFigures: string[];
  issues: DataIssue[];
  /** True when the bundled SAMPLE placeholder data is in use instead of real content. */
  sample: { rules: boolean; facts: boolean };
}
