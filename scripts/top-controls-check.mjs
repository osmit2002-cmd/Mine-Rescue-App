// Headless check that every control near the top of each page is fully visible and pressable: not under the
// sticky header, not under the bottom tab bar, and not hidden under the header after scrolling back to it.
// Usage (with `npm run preview` running):
//   node scripts/top-controls-check.mjs [url] [--state=collapsed|expanded|both] [--shots=dir]
import { chromium } from 'playwright-core';

const ROUTES = ['', 'rules', 'rules/scba-1', 'section/' + encodeURIComponent('mine-rescue:figures'), 'statements', 'quiz', 'search?q=methane', 'figures', 'parts', 'about', 'builder'];
const VIEWPORTS = [{ width: 390, height: 844, name: 'phone-390' }, { width: 1440, height: 900, name: 'desktop-1440' }];
const SCHEMES = ['light', 'dark'];
const SHOT_ROUTES = new Set(['', 'quiz', 'builder']);

function parseArgs(argv) {
  const opt = (k, d) => (argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=')[1];
  const state = opt('state', 'both');
  return {
    url: argv.find((a) => !a.startsWith('--')) ?? 'http://localhost:4173/',
    states: state === 'both' ? ['collapsed', 'expanded'] : [state],
    shots: opt('shots', '')
  };
}

/** Runs in the page: every visible control in the header and in the top half of main, checked against the
 *  band between the header's bottom and the tab bar's top, with hit tests at its centre and near its corners. */
function checkTopControls() {
  const header = document.querySelector('header.header');
  const nav = document.querySelector('nav.nav');
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
  const fixedNav = !!nav && getComputedStyle(nav).position === 'fixed';
  const floor = fixedNav ? nav.getBoundingClientRect().top : window.innerHeight;
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const sel = 'button, select, a[href], input, summary, [role=button], textarea';
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  const hits = (el, x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === el || el.contains(t)); };
  // Content of a closed <details> keeps a layout box in Chrome but is not shown; only its summary is.
  const inClosedDetails = (el) => {
    for (let d = el.closest('details:not([open])'); d; d = d.parentElement?.closest('details:not([open])')) {
      const sum = d.querySelector(':scope > summary');
      if (!sum || !sum.contains(el)) return true;
    }
    return false;
  };
  const describe = (t) => (t ? t.tagName.toLowerCase() + (typeof t.className === 'string' && t.className ? '.' + t.className.split(' ')[0] : '') : 'nothing');

  const out = { headerBottom: Math.round(headerBottom), checked: 0, bad: [] };
  const els = [...document.querySelectorAll(`header.header :is(${sel}), main :is(${sel})`)].filter((el) => !el.closest('svg'));
  for (const el of els) {
    const cs = getComputedStyle(el);
    // An inline link that wraps has one box per line; check its first line.
    const r = cs.display === 'inline' && el.getClientRects().length ? el.getClientRects()[0] : el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || el.closest('[hidden]') || inClosedDetails(el)) continue;
    const inHeader = !!el.closest('header.header');
    const inNav = fixedNav && !!el.closest('nav.nav');
    if (!inHeader && r.top > vh * 0.5) continue; // top area only
    if (!inHeader && (r.left >= vw || r.right <= 0)) continue; // off to the side in a horizontal scroller
    if (!inHeader && el.closest('.gallery, [data-testid=gallery]') && (r.left < 0 || r.right > vw)) continue; // next slide of a carousel
    out.checked++;
    const top = inHeader ? 0 : headerBottom;
    const bottom = inNav ? vh : floor;
    const problems = [];
    if (r.top < top - 0.5) problems.push(`top ${r.top.toFixed(0)} is above the header bottom ${top.toFixed(0)}`);
    // A control that fits on the first screen must be shown whole (tall figures and maps just scroll).
    if (r.bottom > bottom + 0.5 && r.height <= Math.min(120, bottom - top)) problems.push(`bottom ${r.bottom.toFixed(0)} below ${bottom.toFixed(0)}`);
    if ((r.left < -0.5 || r.right > vw + 0.5) && r.width <= vw && !el.closest('.table-wrap')) problems.push(`x ${r.left.toFixed(0)}..${r.right.toFixed(0)} outside 0..${vw}`);
    // Centre and four points just inside the corners (inset past a 10px corner radius).
    const i = Math.min(8, r.width / 4, r.height / 4);
    const y1 = Math.min(r.bottom, bottom) - i;
    const pts = [[r.left + r.width / 2, (Math.max(r.top, top) + Math.min(r.bottom, bottom)) / 2], [r.left + i, r.top + i], [r.right - i, r.top + i], [r.left + i, y1], [r.right - i, y1]];
    const vis = pts.filter(([x, y]) => x >= 0 && y >= 0 && x < vw && y < vh);
    const missed = vis.filter(([x, y]) => !hits(el, x, y));
    if (missed.length) problems.push(`${missed.length}/${vis.length} points hit ${describe(document.elementFromPoint(missed[0][0], missed[0][1]))}`);
    if (problems.length) out.bad.push(`${el.tagName.toLowerCase()} "${label(el)}": ${problems.join('; ')}`);
  }
  return out;
}

/** Runs in the page: from the bottom of the page, scrollIntoView (what focus and in-page links do) must bring
 *  the first few controls back below the sticky header, not under it. */
async function checkScrollClearance() {
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const headerBottom = () => document.querySelector('header.header')?.getBoundingClientRect().bottom ?? 0;
  const els = [...document.querySelectorAll('main :is(button, select, a[href], input)')].filter((e) => e.getBoundingClientRect().height > 0 && !e.closest('svg'));
  const bad = [];
  for (const el of els.slice(0, 4)) {
    window.scrollTo(0, document.documentElement.scrollHeight);
    await frame();
    el.scrollIntoView({ block: 'start' });
    await frame();
    const r = el.getBoundingClientRect();
    const atEnd = window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 1;
    if (r.top < headerBottom() - 0.5 && !atEnd) bad.push(`scrollIntoView puts "${(el.textContent || el.tagName).trim().slice(0, 30)}" under the header (${r.top.toFixed(0)} < ${headerBottom().toFixed(0)})`);
  }
  window.scrollTo(0, 0);
  return bad;
}

async function checkRoute(page, url, route) {
  await page.goto(url + '#/' + route);
  await page.waitForSelector('main .card, main h1, main h2', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
  const res = await page.evaluate(checkTopControls);
  const scrollBad = await page.evaluate(checkScrollClearance);
  return { ...res, bad: [...res.bad, ...scrollBad] };
}

async function runCombo(browser, { url, shots }, scheme, vp, state) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, colorScheme: scheme, serviceWorkers: 'block' });
  // The header's collapsed state is remembered; set it before the app starts.
  await ctx.addInitScript((s) => { try { localStorage.setItem('mrs.headerCollapsed', s === 'collapsed' ? '1' : '0'); } catch { /* ignore */ } }, state);
  const page = await ctx.newPage();
  let checked = 0;
  let problems = 0;
  for (const route of ROUTES) {
    const res = await checkRoute(page, url, route);
    checked += res.checked;
    problems += res.bad.length;
    console.log(`${res.bad.length ? 'FAIL' : 'PASS'} ${scheme} ${vp.name} ${state} /${route}: ${res.checked} controls, header bottom ${res.headerBottom}px`);
    for (const b of res.bad) console.log('    ' + b);
    if (shots && SHOT_ROUTES.has(route)) {
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.screenshot({ path: `${shots}/${vp.name}-${scheme}-${state}-${route.split(/[/?]/)[0] || 'home'}.png` });
    }
  }
  await ctx.close();
  return { checked, problems };
}

const opts = parseArgs(process.argv.slice(2));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true });
let checked = 0;
let problems = 0;
for (const scheme of SCHEMES)
  for (const vp of VIEWPORTS)
    for (const state of opts.states) {
      const r = await runCombo(browser, opts, scheme, vp, state);
      checked += r.checked;
      problems += r.problems;
    }
await browser.close();
console.log(`${problems ? 'FAIL' : 'PASS'} ${checked} control checks, ${problems} problems`);
if (problems) process.exitCode = 1;
