/** Mock exam sizing and the quiz timer setting. Pure helpers plus guarded localStorage access. */
import type { EventInfo } from '../data/types';
import { quizConfig, type QuizConfig } from './quizConfig';

export interface MockPlan {
  facts: number;
  parts: number;
  /** Official time limit in minutes (null = none). */
  officialMinutes: number | null;
  /** Where the statement count came from, for display and the report. */
  sizeSource: 'metadata' | 'fallback';
}

/**
 * Size of an event's mock exam.
 * Statements only (default): the event's statement count from the metadata. For bench events the metadata's
 * 10-statement figure belongs to the 10 statements + 10 parts format, which v0.1.0 does not use, so the
 * whole exam length (`questions`, 20) is asked as statements; otherwise `benchMockStatements` (20).
 */
export function mockPlan(eventId: string, ev: EventInfo | undefined, hasParts: boolean, cfg: QuizConfig = quizConfig): MockPlan {
  const fb = cfg.mockExams[eventId] ?? { facts: cfg.mockExamSize, parts: 0, minutes: null };
  const officialMinutes = ev?.timeLimitMin ?? fb.minutes;
  const isPartsFormat = (ev?.partsQuestions ?? 0) > 0 || fb.parts > 0 || eventId.startsWith('bench-');
  if (cfg.mockIncludesParts && hasParts) {
    const parts = ev?.partsQuestions ?? fb.parts;
    const facts = ev?.factQuestions ?? (ev?.totalQuestions !== undefined ? ev.totalQuestions - parts : undefined);
    return { facts: facts ?? fb.facts, parts, officialMinutes, sizeSource: facts !== undefined ? 'metadata' : 'fallback' };
  }
  if (isPartsFormat) {
    const n = ev?.totalQuestions;
    return { facts: n ?? cfg.benchMockStatements, parts: 0, officialMinutes, sizeSource: n !== undefined ? 'metadata' : 'fallback' };
  }
  const n = ev?.factQuestions ?? ev?.totalQuestions ?? ev?.examQuestions;
  return { facts: n ?? fb.facts, parts: 0, officialMinutes, sizeSource: n !== undefined ? 'metadata' : 'fallback' };
}

export type TimerMode = 'mock' | 'practice' | 'rules';

export interface TimerSettings {
  version: 1;
  /** Timer on/off per mode. A missing entry means "use the default". */
  on: Partial<Record<TimerMode, Record<string, boolean>>>;
  /** Chosen length per event, in minutes. */
  minutes: Record<string, number>;
}

const KEY = 'mrs.timer.v1';
export const emptyTimerSettings = (): TimerSettings => ({ version: 1, on: {}, minutes: {} });

export function clampMinutes(n: number, cfg: QuizConfig = quizConfig): number {
  const [lo, hi] = cfg.timerRange;
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/** Default length: the event's official time, else quizConfig.defaultTimerMinutes (15). */
export function defaultTimerMinutes(officialMinutes: number | null, cfg: QuizConfig = quizConfig): number {
  return officialMinutes ?? cfg.defaultTimerMinutes;
}

/** Default on/off: mock exams are timed when the event has an official limit; practice and the Rules quiz are untimed. */
export function defaultTimerOn(mode: TimerMode, officialMinutes: number | null): boolean {
  return mode === 'mock' && officialMinutes !== null;
}

export function timerOn(s: TimerSettings, mode: TimerMode, eventId: string, officialMinutes: number | null): boolean {
  return s.on[mode]?.[eventId] ?? defaultTimerOn(mode, officialMinutes);
}

export function timerMinutes(s: TimerSettings, eventId: string, officialMinutes: number | null, cfg: QuizConfig = quizConfig): number {
  const v = s.minutes[eventId];
  return v !== undefined ? clampMinutes(v, cfg) : defaultTimerMinutes(officialMinutes, cfg);
}

/** Minutes for a session, or null when the timer is off. */
export function sessionMinutes(s: TimerSettings, mode: TimerMode, eventId: string, officialMinutes: number | null): number | null {
  return timerOn(s, mode, eventId, officialMinutes) ? timerMinutes(s, eventId, officialMinutes) : null;
}

export function withTimerOn(s: TimerSettings, mode: TimerMode, eventId: string, on: boolean): TimerSettings {
  return { ...s, on: { ...s.on, [mode]: { ...(s.on[mode] ?? {}), [eventId]: on } } };
}

export function withTimerMinutes(s: TimerSettings, eventId: string, minutes: number): TimerSettings {
  return { ...s, minutes: { ...s.minutes, [eventId]: clampMinutes(minutes) } };
}

/** Parses stored settings, dropping anything malformed. */
export function parseTimerSettings(raw: string | null): TimerSettings {
  const out = emptyTimerSettings();
  if (!raw) return out;
  try {
    const j = JSON.parse(raw) as Partial<TimerSettings>;
    if (!j || typeof j !== 'object') return out;
    for (const mode of ['mock', 'practice', 'rules'] as TimerMode[]) {
      const m = j.on?.[mode];
      if (m && typeof m === 'object') out.on[mode] = Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v === 'boolean'));
    }
    if (j.minutes && typeof j.minutes === 'object')
      out.minutes = Object.fromEntries(Object.entries(j.minutes).filter(([, v]) => typeof v === 'number' && Number.isFinite(v)).map(([k, v]) => [k, clampMinutes(v as number)]));
  } catch {
    /* ignore corrupt settings */
  }
  return out;
}

export function loadTimerSettings(): TimerSettings {
  try {
    return parseTimerSettings(localStorage.getItem(KEY));
  } catch {
    return emptyTimerSettings();
  }
}

export function saveTimerSettings(s: TimerSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked */
  }
}
