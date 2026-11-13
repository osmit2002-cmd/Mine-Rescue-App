import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HEADER_COLLAPSED_KEY, readHeaderCollapsed, writeHeaderCollapsed } from './headerPrefs';
import { HeaderToggle } from '../components/HeaderToggle';

function memStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe('header collapsed preference', () => {
  it('defaults to collapsed on phones and expanded on wide screens', () => {
    expect(readHeaderCollapsed(true, memStore())).toBe(true);
    expect(readHeaderCollapsed(false, memStore())).toBe(false);
  });
  it('a saved choice wins over the screen size', () => {
    expect(readHeaderCollapsed(true, memStore({ [HEADER_COLLAPSED_KEY]: '0' }))).toBe(false);
    expect(readHeaderCollapsed(false, memStore({ [HEADER_COLLAPSED_KEY]: '1' }))).toBe(true);
  });
  it('ignores junk and round-trips through storage', () => {
    const s = memStore({ [HEADER_COLLAPSED_KEY]: 'yes' });
    expect(readHeaderCollapsed(false, s)).toBe(false);
    writeHeaderCollapsed(true, s);
    expect(s.m.get(HEADER_COLLAPSED_KEY)).toBe('1');
    expect(readHeaderCollapsed(false, s)).toBe(true);
    writeHeaderCollapsed(false, s);
    expect(readHeaderCollapsed(true, s)).toBe(false);
  });
  it('never throws when storage is missing or broken', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } };
    expect(readHeaderCollapsed(true, broken)).toBe(true);
    expect(() => writeHeaderCollapsed(true, broken)).not.toThrow();
    expect(readHeaderCollapsed(false, null)).toBe(false);
  });
});

describe('HeaderToggle', () => {
  const render = (collapsed: boolean) => renderToStaticMarkup(createElement(HeaderToggle, { collapsed, controls: 'header-rulebook', current: 'Coal Mine Rescue', onToggle: () => {} }));
  it('is a real button that names the panel it controls', () => {
    const html = render(true);
    expect(html).toMatch(/^<button type="button"/);
    expect(html).toContain('aria-controls="header-rulebook"');
  });
  it('collapsed: aria-expanded false and shows the current rule book', () => {
    const html = render(true);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Coal Mine Rescue');
    expect(html).toContain('show rule book menu');
  });
  it('expanded: aria-expanded true and offers to hide the menu', () => {
    const html = render(false);
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toContain('Coal Mine Rescue');
    expect(html).toContain('Hide');
  });
});
