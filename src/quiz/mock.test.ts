import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eventsInfo } from '../data/adapter';
import type { EventInfo } from '../data/types';
import {
  clampMinutes,
  emptyTimerSettings,
  mockPlan,
  parseTimerSettings,
  sessionMinutes,
  timerMinutes,
  timerOn,
  withTimerMinutes,
  withTimerOn
} from './mock';

const ev = (id: string, extra: Partial<EventInfo> = {}): EventInfo => ({ id, name: id, order: 0, ...extra });

describe('mockPlan', () => {
  it('bench mocks are statements only, sized from the exam length in the metadata', () => {
    const p = mockPlan('bench-biopak', ev('bench-biopak', { totalQuestions: 20, factQuestions: 10, partsQuestions: 10, timeLimitMin: 20 }), true);
    expect(p).toEqual({ facts: 20, parts: 0, officialMinutes: 20, sizeSource: 'metadata' });
  });
  it('bench mocks fall back to 20 statements without metadata', () => {
    expect(mockPlan('bench-bg4', undefined, true)).toMatchObject({ facts: 20, parts: 0, sizeSource: 'fallback' });
  });
  it('other events use their statement count; mine rescue is 15 min (metadata or fallback)', () => {
    expect(mockPlan('mine-rescue', ev('mine-rescue', { totalQuestions: 10, timeLimitMin: 15 }), false)).toEqual({ facts: 10, parts: 0, officialMinutes: 15, sizeSource: 'metadata' });
    expect(mockPlan('mine-rescue', ev('mine-rescue', { totalQuestions: 10 }), false)).toMatchObject({ officialMinutes: 15 });
    expect(mockPlan('unknown-event', undefined, false)).toMatchObject({ officialMinutes: null });
    expect(mockPlan('first-aid', ev('first-aid', { totalQuestions: 15, timeLimitMin: 20 }), false)).toMatchObject({ facts: 15, officialMinutes: 20 });
    expect(mockPlan('preshift', undefined, false)).toMatchObject({ facts: 10, officialMinutes: 15, sizeSource: 'fallback' });
  });
  it('can re-enable parts questions through the config', async () => {
    const { quizConfig } = await import('./quizConfig');
    const cfg = { ...quizConfig, mockIncludesParts: true };
    expect(mockPlan('bench-proair', ev('bench-proair', { totalQuestions: 20, factQuestions: 10, partsQuestions: 10 }), true, cfg)).toMatchObject({ facts: 10, parts: 10 });
  });
});

const dir = 'content/';
describe.runIf(existsSync(`${dir}facts.json`))('mock plans from the real events metadata', () => {
  const events = eventsInfo(JSON.parse(readFileSync(`${dir}facts.json`, 'utf8')));
  const plan = (id: string) => mockPlan(id, events.find((e) => e.id === id), id.startsWith('bench-'));
  it('matches the agreed sizes and times', () => {
    expect(plan('mine-rescue')).toMatchObject({ facts: 10, parts: 0, officialMinutes: 15 });
    expect(events.find((e) => e.id === 'mine-rescue')?.timeLimitMin).toBe(15);
    expect(plan('first-aid')).toMatchObject({ facts: 15, parts: 0, officialMinutes: 20 });
    for (const b of ['bench-biopak', 'bench-bg4', 'bench-proair']) expect(plan(b)).toMatchObject({ facts: 20, parts: 0, officialMinutes: 20 });
    expect(plan('preshift')).toMatchObject({ facts: 10, parts: 0, officialMinutes: 15 });
  });
});

describe('timer settings', () => {
  it('defaults: mock timed at the official length, practice untimed, 15 min when an event without a limit is turned on', () => {
    const s = emptyTimerSettings();
    expect(sessionMinutes(s, 'mock', 'first-aid', 20)).toBe(20);
    expect(sessionMinutes(s, 'practice', 'first-aid', 20)).toBeNull();
    expect(sessionMinutes(s, 'mock', 'mine-rescue', 15)).toBe(15);
    expect(sessionMinutes(s, 'practice', 'mine-rescue', 15)).toBeNull();
    expect(sessionMinutes(withTimerOn(s, 'mock', 'mine-rescue', false), 'mock', 'mine-rescue', 15)).toBeNull();
    expect(sessionMinutes(s, 'mock', 'other', null)).toBeNull();
    expect(sessionMinutes(withTimerOn(s, 'mock', 'other', true), 'mock', 'other', null)).toBe(15);
  });
  it('stores on/off per mode and event, and a clamped length per event', () => {
    let s = withTimerOn(emptyTimerSettings(), 'practice', 'preshift', true);
    s = withTimerMinutes(s, 'preshift', 7.6);
    expect(timerOn(s, 'practice', 'preshift', 15)).toBe(true);
    expect(timerOn(s, 'mock', 'preshift', 15)).toBe(true); // default for mock with an official limit
    expect(timerMinutes(s, 'preshift', 15)).toBe(8);
    expect(sessionMinutes(withTimerOn(s, 'mock', 'preshift', false), 'mock', 'preshift', 15)).toBeNull();
    expect(clampMinutes(0)).toBe(1);
    expect(clampMinutes(999)).toBe(180);
    expect(clampMinutes(Number.NaN)).toBe(1);
  });
  it('keeps a separate, untimed-by-default switch for the Rules quiz', () => {
    const s = emptyTimerSettings();
    expect(sessionMinutes(s, 'rules', 'first-aid', 20)).toBeNull();
    const on = withTimerOn(s, 'rules', 'first-aid', true);
    expect(sessionMinutes(on, 'rules', 'first-aid', 20)).toBe(20);
    expect(parseTimerSettings(JSON.stringify(on))).toEqual(on);
  });
  it('round-trips through JSON and ignores corrupt data', () => {
    const s = withTimerMinutes(withTimerOn(emptyTimerSettings(), 'mock', 'x', false), 'x', 12);
    expect(parseTimerSettings(JSON.stringify(s))).toEqual(s);
    expect(parseTimerSettings('{oops')).toEqual(emptyTimerSettings());
    expect(parseTimerSettings(JSON.stringify({ on: { mock: { a: 'yes', b: true } }, minutes: { a: 'x', b: 500 } }))).toEqual({ version: 1, on: { mock: { b: true } }, minutes: { b: 180 } });
  });
});
