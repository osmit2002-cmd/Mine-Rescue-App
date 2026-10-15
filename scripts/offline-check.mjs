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
ok((await page.textContent('[data-testid=footer-version]')).trim() === 'v0.2.1', 'footer shows v0.2.1');
await page.goto(url + '#/about');
await page.waitForSelector('[data-testid=app-version]');
ok((await page.textContent('main')).includes('v0.2.1'), 'About shows v0.2.1');

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
// v0.2.0: the header menu is the only event control, and "Facts" is now "Statements".
await page.selectOption('[data-testid=event-select]', 'all');
await page.goto(url + '#/statements');
await page.waitForSelector('.fact-list li');
const allCount = await page.textContent('main');
ok(/654 of 654 statements/.test(allCount), 'Statements list with "All events" (header) shows 654 statements');
let pickers = 0;
for (const h of ['#/', '#/statements', '#/search?q=oxygen', '#/parts', '#/quiz', '#/rules', '#/figures']) {
  await page.goto(url + h);
  await page.waitForSelector('main h1');
  pickers += (await page.$$('[aria-label="Contest event"][role=radiogroup], main select')).length;
}
ok(pickers === 0, 'no event selector inside any page (header menu only)');
await page.goto(url + '#/quiz');
await page.waitForSelector('[data-testid=pick-event]');
ok((await page.textContent('[data-testid=pick-event]')).includes('header'), 'Quiz with "All events" asks to choose an event in the header');
const nav = await page.textContent('nav.nav');
ok(nav.includes('Statements') && !nav.includes('Facts'), 'nav says Statements, not Facts');
await page.goto(url + '#/facts/coal-mr-sof-001');
await page.waitForSelector('.statement');
ok((await page.evaluate(() => location.hash)).startsWith('#/statements/coal-mr-sof-001'), 'old #/facts links redirect to #/statements');
await page.goto(url + '#/search?q=oxygen');
await page.waitForSelector('.results li');
ok(/Statements \(\d+\)/.test(await page.textContent('main')), 'search filter chip says Statements');
await page.selectOption('[data-testid=event-select]', 'mine-rescue');

// Rules quiz (Coal Mine Rescue): verbatim sentence, 3 choices, rule reference with a link.
await page.goto(url + '#/quiz?kind=rules');
await page.reload();
await page.waitForSelector('[data-testid=rules-pool]');
ok(/\d+ sentences from \d+ of 100 rules/.test(await page.textContent('[data-testid=rules-pool]')), `Rules quiz pool: ${(await page.textContent('[data-testid=rules-pool]')).trim()}`);
await page.click('button.primary:has-text("Start")');
await page.waitForSelector('[data-testid=choice]');
ok((await page.$$('[data-testid=choice]')).length === 3, 'Rules quiz question has three choices');
ok(/of 10/.test(await page.textContent('.quiz-status')), 'Rules quiz defaults to 10 questions');
await page.click('[data-testid=choice] >> nth=0');
await page.waitForSelector('[data-testid=rule-ref] a');
const ref = await page.textContent('[data-testid=rule-ref]');
const sentence = await page.textContent('.feedback .statement');
const ruleHref = await page.getAttribute('[data-testid=rule-ref] a', 'href');
ok(/rule book p/.test(ref), `after answering, the rule reference is shown (${ref.trim().slice(0, 80)})`);
await page.click('[data-testid=rule-ref] a');
await page.waitForSelector('.rule-text');
const ruleText = (await page.textContent('.rule-text')).replace(/\s+/g, ' ');
ok(ruleText.includes(sentence.replace(/\s+/g, ' ').trim()), 'the quizzed sentence appears verbatim on the linked rule page');
ok(ruleHref.includes('#/rules/'), 'rule reference links to the rule detail page');

// "Practice this one" deep link to another event's statement switches the event and stays within it.
await page.goto(url + '#/quiz?fact=first-aid-sof-001');
await page.waitForSelector('[data-testid=choice]');
ok((await page.inputValue('[data-testid=event-select]')) === 'first-aid', 'deep link to a First Aid statement switches the event');
await page.selectOption('[data-testid=event-select]', 'mine-rescue');
await page.waitForTimeout(300);
ok((await page.$$('[data-testid=choice]')).length === 3, 'changing the event mid-quiz keeps the running question intact');
await page.goto(url + '#/');

// v0.2.1: Rules page search bar (shared with Statements), with the section filter as an option below it.
await page.goto(url + '#/rules');
await page.reload();
await page.waitForSelector('input[aria-label="Search rules"]');
const rq = 'input[aria-label="Search rules"]';
const count = async () => (await page.textContent('[data-testid=search-count]')).trim();
ok(/^100 rules/.test(await count()), `Rules page result count without a search: "${await count()}"`);
const firstInMain = await page.evaluate(() => { const els = [...document.querySelectorAll('main input, main button, main select, main details')]; return els[0]?.getAttribute('aria-label'); });
ok(firstInMain === 'Search rules', 'search bar is the first control on the Rules page');
const boxIn = await page.locator(rq).boundingBox();
const boxFilter = await page.locator('[data-testid=rule-section-filter]').boundingBox();
ok(boxFilter && boxFilter.y >= boxIn.y + boxIn.height && boxFilter.y - (boxIn.y + boxIn.height) < 40, 'section filter sits directly below the search bar');
await page.fill(rq, 'lifeline');
await page.waitForSelector('[data-testid=rule-hit]');
const fullCount = await count();
const nFull = Number(fullCount.split(' ')[0]);
ok(/^\d+ of 100 rules match/.test(fullCount) && nFull > 0, `live search "lifeline": ${fullCount}`);
ok((await page.$$('[data-testid=rule-hit]')).length === nFull, 'every matching rule is listed (filtered tree)');
ok((await page.$$('[data-testid=rule-hit]:not(:has(mark))')).length === 0, 'every matching rule has highlighted words');
ok((await page.$$('main details:not([open])')).length === 0, 'sections holding matches are expanded');
const snip = (await page.textContent('[data-testid=rule-snippet] >> nth=0')).replace(/^…|…$/g, '');
const hitHref = await page.getAttribute('[data-testid=rule-snippet] >> nth=0 >> xpath=ancestor::a', 'href');
await page.fill(rq, 'lifel');
await page.waitForTimeout(200);
ok(Number((await count()).split(' ')[0]) >= nFull, `prefix "lifel" matches too (${await count()})`);
await page.fill(rq, 'lifelinr');
await page.waitForTimeout(200);
ok(Number((await count()).split(' ')[0]) > 0, `typo "lifelinr" still matches (${await count()})`);
await page.fill(rq, 'lifeline');
await page.waitForTimeout(200);
const chips = page.locator('[data-testid=rule-section-filter] button');
let narrowed = null;
for (let i = 1; i < (await chips.count()); i++) {
  await chips.nth(i).click();
  const c = await count();
  if (/in this section/.test(c) && Number(c.split(' ')[0]) > 0) { narrowed = c; break; }
}
ok(narrowed && Number(narrowed.split(' ')[0]) <= nFull, `section filter narrows the search results (${narrowed})`);
await chips.nth(0).click();
await page.waitForTimeout(300);
await page.reload();
await page.waitForSelector('[data-testid=rule-hit]');
ok((await page.inputValue(rq)) === 'lifeline', 'the search survives a reload (#/rules?q=…)');
await page.click('.search-clear');
ok((await page.inputValue(rq)) === '' && /^100 rules/.test(await count()), 'clear button empties the search');
await page.click('text=Expand all');
ok((await page.$$('.rule-link')).length >= 100 && (await page.$$('main mark')).length === 0, 'empty search brings back the full tree');
await page.goto(url + hitHref);
await page.waitForSelector('.rule-text');
const hitRuleText = (await page.textContent('.rule-text')).replace(/\s+/g, ' ');
ok(hitRuleText.includes(snip.replace(/\s+/g, ' ').trim()), 'matched snippet is verbatim rule text');
ok((await page.$$('.rule-text mark')).length > 0, 'the rule opened from a search highlights the words');
await page.selectOption('[data-testid=event-select]', 'bench-biopak');
await page.goto(url + '#/rules?q=diaphragm');
await page.reload();
await page.waitForSelector('[data-testid=rule-hit]');
ok((await page.$$('.rule-snippet.pre mark')).length > 0, "search covers 'pre' parts lists and skill sheets (BioPak: diaphragm)");
ok(/of 63 rules match/.test(await count()), `search is scoped to the header event (${await count()})`);
await page.selectOption('[data-testid=event-select]', 'mine-rescue');
await page.goto(url + '#/statements?q=lifelin');
await page.reload();
await page.waitForSelector('.fact-list li');
ok((await page.$$('.fact-list mark')).length > 0 && (await page.$$('.search-clear')).length === 1 && /^\d+ of \d+ statements/.test(await count()), `Statements uses the same search bar: highlights, clear button, count (${await count()})`);
await page.goto(url + '#/');

// Offline: reload and navigate.
await ctx.setOffline(true);
await page.goto(url + '#/statements/coal-mr-sof-102');
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
await page.goto(url + '#/quiz?kind=rules');
await page.reload();
await page.waitForSelector('[data-testid=rules-pool]');
await page.click('button.primary:has-text("Start")');
await page.waitForSelector('[data-testid=choice]');
ok(true, 'Rules quiz runs offline');
await page.goto(url + '#/rules?q=oxygen');
await page.reload();
await page.waitForSelector('[data-testid=rule-hit]', { timeout: 10000 });
ok(/of 100 rules match/.test(await count()), `Rules search works offline (${await count()})`);
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
