/**
 * Identification of Parts questions (bench events). Pure.
 * "In <assembly> (p. N), what is part No. X?" -> pick the name. Distractors come from other rows of the
 * same table first, then other tables of the same event.
 */
import type { PartTable } from '../data/types';
import { assembleMc, same, uniqueAdd, type Question, type QuestionType } from './generate';
import { quizConfig, type QuizConfig } from './quizConfig';
import { shuffle, type Rng } from './rng';

export interface PartItem {
  /** Stable id used for stats: "part:<tableId>#<row index>". */
  id: string;
  table: PartTable;
  row: number;
}

export function partItems(tables: PartTable[]): PartItem[] {
  return tables.flatMap((table) => table.rows.map((_r, row) => ({ id: `part:${table.id}#${row}`, table, row })));
}

export function partPrompt(table: PartTable, no: string): string {
  return `Identification of Parts — ${table.assembly}${table.page !== undefined ? ` (p. ${table.page})` : ''}: what is part No. ${no}?`;
}

export function generatePartQuestion(item: PartItem, allTables: PartTable[], type: QuestionType, rng: Rng, cfg: QuizConfig = quizConfig): Question | null {
  const { table, row } = item;
  const r = table.rows[row];
  if (!r) return null;
  const base = {
    factId: item.id,
    source: 'part' as const,
    segments: [partPrompt(table, r.no)],
    answer: r.name,
    answerKind: 'part' as const,
    partTableId: table.id,
    partNo: r.no
  };
  if (type === 'fill') return { ...base, type: 'fill' };
  const d: string[] = [];
  const sameTable = table.rows.filter((x, i) => i !== row && !same(x.name, r.name)).map((x) => x.name);
  uniqueAdd(d, shuffle(sameTable, rng), [r.name], cfg.distractorCount);
  const sameEvent = allTables.filter((t) => t.id !== table.id && t.event === table.event).flatMap((t) => t.rows.map((x) => x.name));
  uniqueAdd(d, shuffle(sameEvent, rng), [r.name], cfg.distractorCount);
  if (d.length < cfg.distractorCount) return null;
  return assembleMc(base, d, rng);
}
