# Mine Rescue Study (v0.1.0)

Offline study aid for the **2026 MSHA mine rescue contest rules**. It is a Vite + React + TypeScript app that installs as a progressive web app and works with no connection after the first load. It covers all six coal contest events (654 statements of fact).

**Live app:** https://osmit2002-cmd.github.io/Mine-rescue-study/

## Build

Use the current Node.js LTS (Node 24). From the repository root:

```bash
npm ci
npm test
npm run build
```

`npm run build` runs `scripts/copy-content.mjs` first. That script reads the committed `content/` folder (override with the `CONTENT_DIR` environment variable), copies the JSON into `public/content`, and downscales figures. The production site is `dist/`.

Pushes to `main`, and manual **workflow_dispatch** runs, do the same steps in `.github/workflows/pages.yml` and deploy `dist/` to GitHub Pages. The repository's Pages source has to be **GitHub Actions** (Settings → Pages → Build and deployment → Source).

## MSHA 2026 source

Rule books and statements of fact are the 2026 MSHA Unified Mine Rescue Rules for the six coal contest events, taken from the PDFs published on [msha.gov](https://www.msha.gov/training/mine-rescue-training/mine-rescue-contests/2026-unified-mine-rescue-rules-and) and downloaded on 2026-10-15. Wording is kept verbatim, including printed typos. This is a study aid; check the official rule book for the contest you are entering. Editions, counts, and processing notes are in `content/sources.md`.

## Events

| Event | Rule book | Rules | Statements of fact | Parts tables | Mock exam |
|---|---|---|---|---|---|
| Coal Mine Rescue | `rules.json` (approved 1/15/2026) | 100 | 200 (nos. 1–200, rule book pp. 71–80) | – | 10 statements, 15 min (Written Examination rule 3, p. 7) |
| First Aid | `rules-first-aid.json` | 163 | 100 | – | 15 statements, 20 min |
| Bench – BioPak 240-R | `rules-bench-biopak.json` | 63 | 89 | 13 | 20 statements, 20 min |
| Bench – Dräger BG-4 | `rules-bench-bg4.json` | 80 | 88 | 11 | 20 statements, 20 min |
| Bench – Dräger BG ProAir | `rules-bench-proair.json` | 85 | 77 | 18 | 20 statements, 20 min |
| Preshift | `rules-preshift.json` | 56 | 100 | – | 10 statements, 15 min |

(Counts are from the content loaded at build time.)

Mock exams use **statements of fact only**. Sizes and official times come from `facts.json` → `events`, with fallbacks in `src/quiz/quizConfig.ts` → `mockExams`, all in `src/quiz/mock.ts`. For bench events the metadata's whole exam length (`questions: 20`) is asked as statements; without metadata the size is 20 (`benchMockStatements`). Set `mockIncludesParts: true` to go back to 10 statements + 10 parts.

## What the app does

- **Event picker** in the header. Your choice is saved on the device (`localStorage`) and filters Rules, Facts, Search, Parts, Figures and Quiz. Facts and Search also have an **All events** option.
- **Rules:** a collapsible section → group → rule tree with a filter, deep-linkable rule pages (`#/rules/<id>`), and prev/next within the same event. Sub-items (A., 1., a.) are indented paragraphs. Skill sheets and forms (`format: "pre"`) appear in a monospace block with whitespace exactly as printed. Wording is never changed: typos stay as printed.
- **Statements of fact:** each one is shown verbatim, with its event, its printed reference, any `edit_note`, the source document and the edition.
- **Identification of Parts** (bench events): event → table → numbered rows, with the parts drawing.
- **Figures:** 103 page images, downscaled to WebP and linked to their rules and sections.
- **Search:** offline full text (MiniSearch) across rules, statements, parts tables and section notes. Results show highlights and have type and section chips.
- **Quiz:**
  - Three-choice multiple choice is the default (the 2026 exam format). Fill-in is optional practice.
  - Questions blank a key term or number in the verbatim statement. The wrong options are the same kind of token (same unit, a related term, nearby statements) taken from the **same event**. Printed references such as "Ch.-3 pg. 39" are never blanked.
  - Bench practice can add parts questions (the source defaults to Statements): given a part number, pick the printed name. Wrong options come from the same table first, then from the same event. Mock exams never include parts.
  - **Mock exam:** the event's exam size. It scores out of the full length (unanswered questions count as wrong) and then shows a full review.
  - **Timer** (mock exams and practice): an on/off switch and a length in minutes, saved on the device (`mrs.timer.v1`). Mock exams are timed by default when the event has an official limit; practice is untimed by default. The length defaults to the official time (15 minutes for Coal Mine Rescue, per rule 3 on p. 7), or 15 minutes for an event without one. When time runs out, answers are submitted automatically.
  - Practice sessions show score and streak and let you retry the questions you missed.
- **About:** each event's document, edition, publisher, exam format and rules file, plus the redline notes, the figure size report, content-check results and `sources.md`.
- **Installable PWA:** after the first load, everything (app, all JSON, all figures) works with no connection.

## Run

```bash
npm ci             # first time, or after dependency changes
npm run dev        # http://localhost:5173
npm test           # vitest
npm run build      # copy content + typecheck + production build into dist/
npm run preview    # serve dist/ on :4173 to check the service worker
node scripts/offline-check.mjs   # headless end-to-end + offline check (needs preview running + Chrome)
```

## Deploy

`dist/` is a static site (relative paths, hash routing). Serve it from any static host, at a domain root or in a sub-folder:

- **GitHub Pages / any static host:** upload the contents of `dist/` (or unzip `mine-rescue-app-dist.zip`).
- **Phone or PC:** open it once while online, then install it (browser menu → "Install app" / "Add to Home screen").
- The service worker precaches everything: about 126 files, 4.7 MB. When you deploy new content, the app shows a "new version available" prompt.

## Dropping in content

Content lives in `content/` at the repository root (override with `CONTENT_DIR`). `npm run dev` and `npm run build` run `scripts/copy-content.mjs`, which rebuilds `public/content` from scratch:

| File | Handling |
|---|---|
| `facts.json` | All events. `counts_by_event` and `events` (exam formats, rules files, documents) are validated and used. |
| `rules.json` | The Coal Mine Rescue rule book. |
| `rules-{event}.json` | Found from `events[].rules_file` and from any `rules-*.json`. Same layout as `rules.json`. |
| `parts.json` | Bench Identification of Parts tables (`count_tables`/`count_rows` are checked). |
| `figures/**` | Converted with sharp to **WebP, quality 75, at most 1400 px wide**. 103 images: 12.6 MB → 3.6 MB. If sharp is missing, the files are copied as they are. |
| `sources.md` | Shown on the About page. |

If rules or facts are missing, empty, invalid or have no records, the build uses the bundled **SAMPLE** placeholders (`src/data/sample/`) and the app shows a yellow SAMPLE DATA banner. `build-info.json` records what was used.

All field names are mapped in **one file, `src/data/adapter.ts`**. Bad records are skipped and reported on the About page, so they never crash the app. Per-event counts are compared with `counts_by_event`, `count_tables` and `count_rows`. Quiz tuning (choice count, session sizes, mock exam fallbacks, typo tolerance, term groups, lexicon) is all in `src/quiz/quizConfig.ts`.

### Figures: precache vs download button

All figures are precached. As WebP the whole content folder is 4.7 MB, so the first install stays small, and the app needs neither a runtime cache nor a "download all" button. If the figures grow a lot, switch the image glob in `vite.config.ts` to a runtime CacheFirst route.

## Tests

`npm test` runs vitest. It covers:

- the cloze candidate finder and the multiple-choice/fill-in generators;
- protection of the printed reference and the distractor source order;
- parts questions;
- the answer checker, fact picking and stats;
- the content validator;
- two checks against the real files when `content/` is present: every record of every event loads with zero errors, and every statement and part row yields a valid three-choice question.

## Deferred (known issues for after v0.1.0)

From King Grok's testing and the reviews:

- **Weak or oddly capitalized distractors** on some statements (e.g. Mine Rescue #186, #70). Improve term grouping and casing for those token kinds.
- **A repeated word is blanked everywhere** (e.g. Preshift #19, Mine Rescue #54/#70). The real exam allows at most 2 blanks per statement, so the cloze should cap at 2 occurrences and show the rest.
- **The "Ready to work offline" toast covers content** on small screens. Auto-dismiss it or move it clear of the bottom nav.
- **Opening `index.html` from `file://` shows a blank page.** The app and service worker need http(s) hosting (GitHub Pages, any static host, or `npm run preview` locally). Add a no-JS/file:// hint.
- A one-question "Practice this one" from a statement page always runs without a timer.
- The practice timer keeps running while answer feedback is shown.
- Opening a rule from another event keeps the header edition of the selected event.
- Event chips have no roving tabindex.
- Mine Rescue #128: "non-apparatus" vs "nonapparatus". The hyphen falls at a line break in the PDF.
