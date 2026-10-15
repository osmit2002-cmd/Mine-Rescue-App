// Headless end-to-end check: load, wait for the service worker, exercise pages, go offline, reload.
// Usage: node scripts/offline-check.mjs [url]   (needs `npm run preview` running and Chrome installed)
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:4173/';
const executablePath = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const browser = await chromium.launch({ executablePath, headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) process.exitCode = 1; };

await page.goto(url);
await page.waitForSelector('.tiles');
ok(await page.evaluate(async () => !!(await navigator.serviceWorker.ready)), 'service worker registered and active');
await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'page is controlled by the service worker');
const home = await page.textContent('main');
ok(/100 rules/.test(home) && /\d{3} statements/.test(home), `home shows rule and statement counts (${(home.match(/\d+ statements[^A-Z]*/) ?? [""])[0].trim()})`);
ok((await page.textContent('header')).includes('2026 MSHA rules, approved 1/15/2026'), 'edition shown in header');
ok(!(await page.$('.sample-banner')), 'no SAMPLE banner with real content');

await page.goto(url + '#/rules');
await page.click('text=Expand all');
ok((await page.$$('.rule-link')).length >= 100, 'rules tree lists all rules');
await page.goto(url + '#/rules/scba-1');
ok((await page.$$('.rule-text p.lvl-1')).length > 0, 'rule detail renders sub-item paragraphs');
await page.goto(url + '#/section/' + encodeURIComponent('mine-rescue:figures'));
await page.waitForSelector('.figure-card img');
await page.goto(url + '#/search?q=methane');
await page.waitForSelector('.results li');
ok((await page.$$('.results mark')).length > 0, 'search highlights matches');

// Mock exam: answer 10 three-choice questions.
await page.goto(url + '#/quiz?mode=mock');
await page.click('button.primary:has-text("Start")');
for (let i = 0; i < 10; i++) {
  await page.waitForSelector('[data-testid=choice]');
  const n = (await page.$$('[data-testid=choice]')).length;
  if (i === 0) ok(n === 3, 'mock exam questions have three choices');
  if (i === 0) ok((await page.textContent('[role=timer]').catch(() => '')).includes('15:00') || /14:5\d/.test(await page.textContent('[role=timer]').catch(() => '')), 'mine rescue mock is timed at 15 min by default');
  await page.click('[data-testid=choice] >> nth=0');
}
const score = await page.textContent('[data-testid=final-score]');
ok(/\/ 10/.test(score), `mine rescue mock exam scored out of 10 (${score.trim()})`);

// Event picker: switch to a bench event (persisted), check parts, preformatted rules and the timed mock.
await page.goto(url + '#/');
await page.selectOption('[data-testid=event-select]', 'bench-biopak');
await page.reload();
await page.waitForSelector('.tiles');
ok((await page.inputValue('[data-testid=event-select]')) === 'bench-biopak', 'selected event persists across reloads');
ok((await page.textContent('header')).includes('1/5/2026'), 'header edition follows the event');
await page.goto(url + '#/parts');
await page.waitForSelector('.rule-link');
const tables = (await page.$$('.rule-link')).length;
ok(tables === 13, `BioPak parts browser lists ${tables} tables`);
await page.click('.rule-link >> nth=0');
await page.waitForSelector('.parts-table tbody tr');
ok((await page.$$('.parts-table tbody tr')).length > 0, 'parts table rows render');
const partsHash = await page.evaluate(() => location.hash);
await page.goto(url + '#/rules');
await page.click('text=Expand all');
const benchRules = (await page.$$('.rule-link')).length;
ok(benchRules === 63, `rules page shows only the BioPak rule book (${benchRules} rules)`);
await page.goto(url + '#/quiz?mode=mock');
await page.click('button.primary:has-text("Start")');
await page.waitForSelector('[data-testid=choice]');
ok(!!(await page.$('[role=timer]')), `bench mock exam shows a countdown (${(await page.textContent('[role=timer]')).trim()})`);
const status = await page.textContent('.quiz-status');
ok(/of 20/.test(status), `bench mock exam has 20 questions (${status.match(/Question \d+ of \d+/)?.[0]})`);
let sawPart = false;
for (let i = 0; i < 20; i++) {
  await page.waitForSelector('[data-testid=choice]');
  if ((await page.textContent('.prompt')).includes('Identification of Parts')) sawPart = true;
  await page.click('[data-testid=choice] >> nth=0');
}
ok(!sawPart, 'bench mock exam is statements of fact only (no parts questions)');
ok(/\/ 20/.test(await page.textContent('[data-testid=final-score]')), 'bench mock scored out of 20');
await page.goto(url + '#/quiz');
await page.reload();
await page.waitForSelector('[role=radiogroup][aria-label="Question source"]');
ok((await page.getAttribute('[role=radiogroup][aria-label="Question source"] [role=radio] >> nth=0', 'aria-checked')) === 'true', 'bench practice defaults to Statements (parts practice still offered)');

// Version in the footer and on About.
ok((await page.textContent('[data-testid=footer-version]')).trim() === 'v0.1.0', 'footer shows v0.1.0');
await page.goto(url + '#/about');
await page.waitForSelector('[data-testid=app-version]');
ok((await page.textContent('main')).includes('v0.1.0'), 'About shows v0.1.0');

// Mine rescue: mock timed at 15 min by default (rule 3, p. 7); the toggle and a custom length are remembered.
await page.goto(url + '#/');
await page.selectOption('[data-testid=event-select]', 'mine-rescue');
await page.goto(url + '#/quiz?mode=mock');
await page.waitForSelector('[data-testid=timer-toggle]');
ok(await page.isChecked('[data-testid=timer-toggle]'), 'mine rescue mock timer is on by default');
ok((await page.inputValue('[data-testid=timer-minutes]')) === '15', 'mine rescue mock timer defaults to 15 minutes');
await page.uncheck('[data-testid=timer-toggle]');
await page.reload();
await page.waitForSelector('[data-testid=timer-toggle]');
ok(!(await page.isChecked('[data-testid=timer-toggle]')), 'turning the mine rescue timer off is remembered');
await page.check('[data-testid=timer-toggle]');
await page.fill('[data-testid=timer-minutes]', '12');
await page.press('[data-testid=timer-minutes]', 'Enter');
await page.reload();
await page.waitForSelector('[data-testid=timer-toggle]');
ok((await page.isChecked('[data-testid=timer-toggle]')) && (await page.inputValue('[data-testid=timer-minutes]')) === '12', 'timer setting is saved on the device');
await page.click('button.primary:has-text("Start")');
await page.waitForSelector('[role=timer]');
ok(/12:00|11:5\d/.test(await page.textContent('[role=timer]')), 'mine rescue mock runs with the chosen 12 min timer');
await page.goto(url + '#/quiz');
await page.reload();
await page.waitForSelector('[data-testid=timer-toggle]');
ok(!(await page.isChecked('[data-testid=timer-toggle]')), 'practice timer is off by default');
await page.check('[data-testid=timer-toggle]');
ok((await page.inputValue('[data-testid=timer-minutes]')) === '12', 'practice uses the saved per-event length');
await page.click('button.primary:has-text("Start")');
await page.waitForSelector('[role=timer]');
ok(true, 'practice session shows a countdown when the timer is on');
await page.evaluate(() => localStorage.removeItem('mrs.timer.v1'));

// First aid: timed 15-question exam; find a preformatted rule and check it renders in <pre>.
await page.goto(url + '#/');
await page.selectOption('[data-testid=event-select]', 'first-aid');
await page.goto(url + '#/rules/first-aid-materials-1');
await page.waitForSelector('pre.rule-pre');
const preText = await page.textContent('pre.rule-pre');
ok(preText.includes('6    Adhesive compresses'), 'format "pre" rule renders in <pre> with whitespace kept exactly');
await page.goto(url + '#/rules');
await page.click('text=Expand all');
const firstAidRules = (await page.$$('.rule-link')).length;
ok(firstAidRules >= 100, `first aid rule book lists ${firstAidRules} rules`);
await page.goto(url + '#/quiz?mode=mock');
await page.click('button.primary:has-text("Start")');
await page.waitForSelector('[data-testid=choice]');
ok(/of 15/.test(await page.textContent('.quiz-status')), 'first aid mock has 15 questions');
ok(/^⏱ (20:00|19:5\d)/.test((await page.textContent('[role=timer]')).trim()), 'first aid timer starts at 20 minutes');
await page.goto(url + '#/facts');
await page.click('[role=radiogroup][aria-label="Contest event"] >> text=All events');
const allCount = await page.textContent('main');
ok(/654 of 654 statements/.test(allCount), 'facts list with All events shows 654 statements');
await page.selectOption('[data-testid=event-select]', 'mine-rescue');
// "Practice this one" deep link to another event's statement switches the event and stays within it.
await page.goto(url + '#/quiz?fact=first-aid-sof-001');
await page.waitForSelector('[data-testid=choice]');
ok((await page.inputValue('[data-testid=event-select]')) === 'first-aid', 'deep link to a First Aid statement switches the event');
await page.selectOption('[data-testid=event-select]', 'mine-rescue');
await page.waitForTimeout(300);
ok((await page.$$('[data-testid=choice]')).length === 3, 'changing the event mid-quiz keeps the running question intact');
await page.goto(url + '#/');

// Offline: reload and navigate.
await ctx.setOffline(true);
await page.goto(url + '#/facts/coal-mr-sof-102');
await page.reload();
await page.waitForSelector('.statement', { timeout: 10000 });
ok((await page.textContent('.statement')).includes('IDHL'), 'offline reload works and fact text is verbatim (IDHL typo kept)');
await page.goto(url + '#/figures');
await page.waitForSelector('.figure-card img');
const imgOk = await page.evaluate(async () => {
  const imgs = [...document.querySelectorAll('.figure-card img')];
  imgs.forEach((i) => (i.loading = 'eager'));
  await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
  return imgs.length > 0 && imgs.every((i) => i.naturalWidth > 0);
});
ok(imgOk, 'figures load offline');
const webp = await page.evaluate(() => [...document.querySelectorAll('.figure-card img')].every((i) => i.src.endsWith('.webp')));
ok(webp, 'figures are served as WebP');
await page.goto(url + partsHash);
await page.reload();
await page.waitForSelector('.parts-table tbody tr', { timeout: 10000 });
const partImg = await page.evaluate(async () => {
  const i = document.querySelector('.figure-card img');
  if (!i) return 'no-figure';
  i.loading = 'eager';
  if (!i.complete) await new Promise((r) => { i.onload = i.onerror = r; });
  return i.naturalWidth > 0 ? 'ok' : 'broken';
});
ok(partImg !== 'broken', `parts table and its figure load offline after reload (${partImg})`);
await page.goto(url + '#/quiz');
await page.click('button.primary:has-text("Start")');
await page.waitForSelector('[data-testid=choice]');
ok(true, 'quiz runs offline');
await ctx.setOffline(false);

// Timer auto-submit (fake clock): preshift mock is 10 questions / 15 minutes.
{
  const c2 = await browser.newContext();
  const p2 = await c2.newPage();
  await p2.clock.install();
  await p2.goto(url);
  await p2.waitForSelector('[data-testid=event-select]');
  await p2.selectOption('[data-testid=event-select]', 'preshift');
  await p2.goto(url + '#/quiz?mode=mock');
  await p2.click('button.primary:has-text("Start")');
  await p2.waitForSelector('[data-testid=choice]');
  ok((await p2.textContent('[role=timer]')).includes('15:00'), 'preshift mock timer starts at 15:00');
  await p2.click('[data-testid=choice] >> nth=0');
  await p2.clock.runFor(15 * 60 * 1000 + 2000);
  await p2.waitForSelector('[data-testid=final-score]', { timeout: 5000 });
  const sc = (await p2.textContent('[data-testid=final-score]')).trim();
  ok(/\/ 10$/.test(sc) && (await p2.textContent('main')).includes('Time is up'), `timer auto-submits; unanswered count as wrong (${sc})`);
  // Practice with the timer on also auto-submits.
  await p2.goto(url + '#/quiz');
  await p2.reload();
  await p2.waitForSelector('[data-testid=timer-toggle]');
  await p2.check('[data-testid=timer-toggle]');
  await p2.fill('[data-testid=timer-minutes]', '2');
  await p2.press('[data-testid=timer-minutes]', 'Enter');
  await p2.click('button.primary:has-text("Start")');
  await p2.waitForSelector('[data-testid=choice]');
  await p2.click('[data-testid=choice] >> nth=0');
  await p2.clock.runFor(2 * 60 * 1000 + 2000);
  await p2.waitForSelector('[data-testid=final-score]', { timeout: 5000 });
  ok((await p2.textContent('main')).includes('Time is up'), `timed practice auto-submits (${(await p2.textContent('[data-testid=final-score]')).trim()})`);
  await c2.close();
}
ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
