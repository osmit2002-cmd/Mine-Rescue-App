# Changelog

## 0.2.1

- **Search bar on the Rules page**, at the top, the same component as on the Statements page (`src/components/SearchBar.tsx` + `src/lib/textSearch.ts`). It searches the rule number, title and verbatim wording of every rule, skill sheets and parts lists (`format: "pre"`) included, scoped to the event in the header.
  - Live results as you type: every word must match, words match as prefixes, and longer words (5+ letters) tolerate a small typo. A clear button (or Esc) empties the box; the result count ("N of M rules match") is announced to screen readers. The search is kept in the URL (`#/rules?q=…`).
  - Results show as the rule tree narrowed to the matching rules (parents kept as context), sections expanded, matched words highlighted, and a verbatim excerpt of the rule wording around the match. Opening a rule highlights the words there too. An empty search brings back the full tree.
- **The rule filter is now an option directly below the search bar:** section chips (All sections + each top-level section) narrow the tree, with or without a search, next to Expand all / Collapse all.
- **The Statements page uses the same search bar:** it now matches word prefixes and small typos, highlights matched words, and has the clear button. The "N of M statements" count moved under the box.
- Text is still shown exactly as printed (plain text, no HTML), and everything works offline.

## 0.2.0

- **The header event menu is the only event control.** The per-page event chips are gone from Home, Statements, Search, Parts and Quiz; every page follows the header (Rules, Figures and Parts included). "All events" exists only in the header menu. With "All events" selected, the Quiz asks you to choose an event in the header.
- **"Facts" is now "Statements"** in the UI: nav, page titles, quiz labels, search filter, Home and About. The routes are `#/statements` and `#/statements/<id>`, and old `#/facts…` links redirect.
- **New Rules quiz**, next to the Statements quiz on the Quiz page (`#/quiz?kind=rules`):
  - A key token is blanked in one verbatim sentence of the selected event's rules: a number with its unit, a defined or quoted term, an acronym, or a technical or capitalized term. Plain words are never blanked, and there are at most 2 blanks per sentence; a token that appears more often is not used.
  - Skill sheets and forms (`format: "pre"`) are skipped, as are list fragments, sentences that are too short or too long, and score-column rows.
  - The three choices are the same kind of token from other rules of the same event: numbers with the same unit, then terms from the same section, then the whole event. Options that contain the answer are never offered, and options follow the answer's case style.
  - After each answer the app shows the rule reference (event › section › rule, page) with a link to the rule.
  - Options: 10/20/all questions, three-choice or fill-in (a bare number is accepted for a number-with-unit blank), and the timer (separate on/off switch, off by default).
  - Generator: `src/quiz/rulesQuiz.ts`. Tests check that every generated question is verbatim from its rule and has three distinct options.
- Bench mock exams are unchanged (statements only, 20).
- Option dedupe now also ignores spacing and punctuation ("BG-4" vs "BG4").
- Version 0.2.0.

## Deferred

- Weak or oddly capitalized distractors in the Statements quiz (e.g. Mine Rescue #186, #70).
- The Statements quiz blanks a repeated word everywhere (e.g. Preshift #19, Mine Rescue #54/#70); the real exam caps it at 2. The Rules quiz already caps at 2.
- The "Ready to work offline" toast covers content on small screens.
- Opening `index.html` from `file://` shows a blank page; it needs http(s) hosting.
- In the Rules quiz, "All" counts sentences that have a blankable token. A few cannot produce three good options and are skipped, so a session can be slightly shorter than shown.
- Rules quiz distractors are sometimes loosely related (e.g. a person's role versus a place); there is no semantic typing beyond token kind, section and unit.
- One-question "Practice this one" is untimed; the practice timer runs while feedback is shown; there is no roving tabindex on chips; Mine Rescue #128 hyphen (non-apparatus vs nonapparatus).
