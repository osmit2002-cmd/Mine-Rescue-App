# Sources – Mine Rescue Study App content

Compiled 2026-10-15 (updated the same day to add First Aid, all three 2026 coal bench events, and Preshift). All documents downloaded from msha.gov on that date. Originals are in `/workspace/mine-rescue/sources/` with `pdftotext -layout` extractions (`.txt`) next to them. Strike-through-aware extractions live in `/workspace/mine-rescue/work/*.clean.json`.

Index page: https://www.msha.gov/training/mine-rescue-training/mine-rescue-contests/2026-unified-mine-rescue-rules-and

## Layout of content/

| File | Role |
|---|---|
| `facts.json` / `facts.md` | **All** statements of fact for every coal contest event, each with an `event` field. First array-valued key is `facts` (required by the app's copy-content). |
| `rules.json` / `rules.md` | Coal mine rescue rules only (`event: "mine-rescue"`). Kept at this path for the existing app. |
| `rules-{event}.json` / `.md` | Per-event rule books: `first-aid`, `bench-biopak`, `bench-bg4`, `bench-proair`, `preshift`. |
| `parts.json` | Bench "Identification of Parts" tables (Cons. No. → Designation) with figure paths. Ten of the 20 bench written-exam questions come from these. |
| `figures/` | Page images. Mine-rescue map/figure pages stay at `figures/page-NN.png`. Other events live under `figures/{event}/page-NN.png` (PDF page number). |
| `sources.md` | This file. |

`event` values: `mine-rescue`, `first-aid`, `bench-biopak`, `bench-bg4`, `bench-proair`, `preshift`.

## Documents and counts

| Event | Document | Edition | SOF | Rules file | Written exam |
|---|---|---|---|---|---|
| Coal mine rescue | [Section I, Coal Mine Rescue Rules](https://www.msha.gov/sites/default/files/Mine%20Rescue/I-2026%20Coal%20MR%20Rules.pdf) | Approved – 1/15/2026 | **200** (rulebook pp. 71–80) | `rules.json` | **10** statements of fact, multiple choice with **three choices**, taken verbatim from the contest rules (Written Examination rules 1–5). The 2026 redline deleted the fill-in-the-blank option. |
| First Aid | [Section III, First Aid Rules](https://www.msha.gov/sites/default/files/Mine%20Rescue/III-2026%20First%20Aid%20Rules.pdf) | Approved 1/6/2026 | **100** (pp. 59–65) | `rules-first-aid.json` | **15** multiple-choice questions from the Statements of Fact; three choices; key-word blanks (max two consecutive); 20 minutes; taken by the three working team members. Source books: Brady *Emergency Medical Responder* **Twelfth** Edition (Ch. 3, 4, 6, 9–23, 27) and the current AHA BLS Student Handbook as of Jan 1 of the contest year. |
| Bench – BioPak 240-R | [Section IV, Bench Rules – Bio 240-R](https://www.msha.gov/sites/default/files/Mine%20Rescue/IV-2026%20Bio%20240R%20Bench%20Rules.pdf) | Approved – 1/5/2026 | **89** (pp. 14–20) | `rules-bench-biopak.json` | **20** questions: **10** from Statements of Fact (multiple choice, three choices, key-word blanks) + **10** verbatim from Identification of Parts; 20 minutes. |
| Bench – BG-4 | [Section V, Bench Rules – BG-4](https://www.msha.gov/sites/default/files/Mine%20Rescue/V-2026%20BG-4%20Bench%20Rules.pdf) | Approved – 1/5/2026 | **88** (pp. 15–19) | `rules-bench-bg4.json` | Same format as BioPak: 10 SOF + 10 Identification of Parts; 20 minutes. |
| Bench – BG ProAir | [Section VI, Bench Rules – BG ProAir on Demand Oxygen Dosage](https://www.msha.gov/sites/default/files/Mine%20Rescue/VI-2026%20LDV%20BG-ProAir%20Bench%20Rules.pdf) | Approved – 1/5/2026 | **77** (pp. 16–20) | `rules-bench-proair.json` | Same format as BioPak: 10 SOF + 10 Identification of Parts; 20 minutes. |
| Preshift | [Section VII, Preshift Rules](https://www.msha.gov/sites/default/files/Mine%20Rescue/VII-2026%20Preshift%20Rules.pdf) | Approved – 11/10/2025 | **100** (pp. 14–20) | `rules-preshift.json` | **10** multiple-choice questions with three choices taken verbatim from the published statements of fact; key-word blanks (max two consecutive; keywords cannot be shall/must/should); no "none of the above"; 15 minutes. |

**Total statements of fact: 654.**

## Supporting documents (downloaded, not structured as quiz content)

| Doc | URL | Notes |
|---|---|---|
| 2026 Rules Questions & Answers | https://www.msha.gov/sites/default/files/events/2026%20Rules%20Questions%20and%20Answers.pdf | Official interpretations across events. |
| Section VIII, Technician Team Rules (01-29-26) | https://www.msha.gov/sites/default/files/Mine%20Rescue/2026_Technician_Team_Rules_01-29-26.pdf | **No statements of fact.** Questions come from MSHA 3027 modules and instrument manuals (per the 2026 Q&A). Not included in facts.json. |
| Section II, Metal/Nonmetal Mine Rescue Rules | https://www.msha.gov/sites/default/files/Mine%20Rescue/II-2026%20MNM%20MR%20Rules.pdf | Not downloaded: coal-only scope. |
| Preshift Record Report (blank) | https://www.msha.gov/sites/default/files/Mine%20Rescue/2026%20PRESHIFT%20RECORD%20REPORT%20-%20BLANK.pdf | Blank form; also page 21 of the Preshift rules PDF (image in `figures/preshift/`). |

No other 2026 coal bench events appear on the MSHA Unified Rules page beyond BioPak 240-R, BG-4, and BG ProAir.

## Schema (facts)

Each fact:
```
{
  "id": "{event}-sof-NNN",        // coal mine rescue keeps "coal-mr-sof-NNN"
  "number": N,
  "text": "...",                   // verbatim, including the printed citation at the end
  "section": "… Statements of Fact …",
  "category": null,                // source does not categorize
  "page": <printed rulebook page>,
  "source": "<document id>",
  "event": "mine-rescue|first-aid|bench-biopak|bench-bg4|bench-proair|preshift",
  "reference": "<citation>" | null,  // citation pulled from the end of the text when present
  "edit_note": "…"                 // only when a redline leftover is left as printed and flagged
}
```

## Schema (rules)

Per-event rules files use the same nested shape as the existing coal `rules.json`:
```
{ "document": {…, "event": "…"}, "event": "…", "generated": "…",
  "redline_note": "…", "written_exam": {questions, format, detail, …},
  "sections": [{ "id", "title", "event", "pages":[a,b], "intro?", "note?",
                 "images?":[{file,pdf_page,printed_page}],
                 "items":[{ "id", "number", "title?", "text", "format?" ("pre" for skill sheets / forms),
                            "pages", "event", "group?" ({letter,title}), "images?" }] }] }
```

Rules for First Aid, the three benches and Preshift are **separate files** (`rules-{event}.json`), not merged into `rules.json`, so the existing app keeps working on coal mine rescue alone and Nadeen can load the other events when ready.

## Processing decisions

1. **"Eastern" contest.** No separate Eastern coal rule book. Eastern-region contests follow these national MSHA-recognized rules.
2. **Redline PDFs.** Red text marks 2026 additions; red struck-through text marks deletions. Deleted glyphs (red characters crossed by a thin strike rule) are dropped before extraction (`redline.py`). Additions are kept. Notable deletions:
   - Coal mine rescue Written Examination rule 2: fill-in option removed → three-choice multiple choice only.
   - Coal mine rescue B Card rule 19: "command center" → "briefing officer".
   - First Aid: Brady edition "Eleventh" → "Twelfth"; START triage *table* text deleted (flowchart kept); entire "Two-Rescuer CPR with AED (With Spinal Injury – Manikin Only)" skill sheet struck (PDF pp. 29–31) even though the index still lists it; SOF 1 "Pertussis" → "Covid-19"; SOF 5 "part of the" → "most of the"; SOF 17 "Over" → "On"; SOF 52 "stabilize" → "immobilize"; SOF 71 "proving" → "providing"; SOF 91 "intervention" → "intention".
   - BioPak SOF 3: "Panasonic" and "Rayovac" batteries deleted (Energizer 522 and Duracell MN 1604 remain).
   - Preshift: "report page" / "record page" wording replaced with "Preshift Record Report" in several rules; field scorecard rule 15A "Entering or remaining in" → "Passing or not immediately retreating from".
3. **Typos kept as printed.** Examples: First Aid SOF 26 "metal status", SOF 90 "only, ,", SOF 71 trailing "providing", SOF 91 trailing "intention not intervention." (the last two are flagged with `edit_note`).
4. **Skill sheets (First Aid).** Stored as `format: "pre"` line-by-line text plus page images. The struck spinal-injury AED sheet is omitted from the items (its pages are fully deleted).
5. **Identification of Parts (bench).** Structured in `parts.json` (42 assembly tables, 354 rows) with the matching diagram page images. Ten of each bench written exam's 20 questions come from these.
6. **Fact categories.** Left null; any topical grouping would be ours.
7. **Superseded editions** (2023–2025) exist on msha.gov. Numbering can change year to year; the app should show the edition.
8. **Rebuild.** `build.py` (coal mine rescue only) then `build_events.py` (the other five events + merge into `facts.json`). Both use the `.venv` in `/workspace/mine-rescue`.
