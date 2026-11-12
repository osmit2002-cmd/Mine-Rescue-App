# Solver accuracy

The solver in `src/builder/explore.ts` is checked against official step-by-step solutions that are already written down in this repo. `npm run score:solver` prints a score for each one. A score of 100% means every check passed. The first check that disagrees is the divergence, and the report quotes the rule that applies.

`npm test` runs the same checks and fails if any official fixture is under 100%.

## Fixtures

| Id | Source | What the official solution fixes | Score |
|---|---|---|---|
| `figure-7` | 2026 Coal Mine Rescue Rules, Figure 7, page 49 | Nine team stops, numbered on the figure in Rule 44D order. No patients, no ventilation, no withdrawal. | 11/11, 100% |
| `post5-2016-day1` | `problems/msha-archive/coal/2016/2016_Post_5_Day_1_Mine_Rescue.pdf`, team-stop map and Keys to Problem | Team-stop numbers the judges accept (a "45" on the map is stop 4 or 5), three rescues, the two vents, timbering the person under unsafe roof in No. 3 before stop 12, and not using the broken timbers. | 26/26, 100% |

Before the Rule 44B change, Figure 7 was already 11/11. The 2016 judge key was 17/21 (81%). The first divergence was the team stop at No. 2 Entry, crosscut row 4: the judges number it 10 and the solver numbered it 11, so the barricade patient there was rescued after stop 11 (Rule 41) instead of before it.

## How to add a problem

1. Transcribe the map into a builder problem, the way `src/builder/cases/post5-2016-day1.ts` does. Positions only have to fall in the right openings.
2. Add an `OfficialFixture` in `src/builder/golden/official.ts`.
   - `key.stops` is the team-stop numbers the official solution accepts at each intersection. When the judge map writes "45", set `n` to `[4, 5]`. When it writes one number, set `n` to that number alone.
   - `key.rescue`, `key.vents`, `key.reachBefore`, and `key.withdrawal` cover patients, ventilation order, and Rule 31B.
   - `extras` is for a requirement the key fields cannot say, such as "put this barricade back up on the first vent" or "timber this body before stop 12". Each extra names the rule it comes from.
   - Set `pdf` to the file under `problems/` when the solution came from a contest PDF. That file is then official instead of unverified.
3. Do not run the solver and paste its route in as the official solution. If the judge book is not in the repo, leave the problem unverified.
4. Run `npm run score:solver`. A miss prints the first divergence and the rule text.

## Rule interpretations

These are the readings the solver uses where the rule book allows more than one picture. They are general; nothing in the solver is switched on a problem id.

- **Rule 44B.** "As the team advances into a contaminated entry and subsequently encounters a placard(s) indicating that all contaminants are cleared prior to reaching an intersection, the team must make further advances in the other contaminated or adjacent entry." The solver treats a contaminant as ended once the team has reached the inby intersection of an impassable opening the contaminant sits on. Further moves in that entry then wait while another entry is still contaminated ahead. Figure 7 has no contaminants, so its printed order is unchanged. On the 2016 problem this is what puts stops 10, 11, and 12 at No. 2, No. 3, and No. 1.
- **Rules 48E and 35.** A line curtain wings contaminants from an airtight separation. When an explosive mixture is outby a barricade the team has already breached, and irrespirable air is inby that barricade, the first vent puts the barricade back up and the next vent takes it down before the irrespirable air is moved. Rule 35 still requires that irrespirable air to be gone before the inby barricade is breached.
- **Rule 30F.** The 19.0% oxygen must not be carried through the opening where the person under unsafe roof in No. 3 is lying. The 2016 vent maps also mark some temporary stoppings "Either", so they do not fix one set of arrows. The solver's course meets the key and stays off that opening; it does not copy one of the "Either" layouts.
- **Rule 32.** A body under unsafe roof, including elongated unsafe roof that does not reach rib to rib, is timbered to after every missing person has been found and before the next team stop. A timber placard with count 0 ("cannot use") is not a usable set (Rule 30A: timbers that cannot serve as the required supports are not counted).

## Unverified

These are in the repo and are not scored. No official route was invented for them.

- **Rule book Figure 5** (page 47). The figure shows the 25-foot limit and the direction of travel at a team stop. It does not number a route.
- **Practice 1.** Written for this app. Not a contest problem.
- **140 contest PDFs** under `problems/`. The folder holds 141 PDFs (96 coal archive, 6 metal archive, 3 bench references, 36 from the 2026 Virginia Energy set). Only 2016 Post 5 Day 1 is transcribed. The score test treats every other PDF as unverified until a fixture names it in `pdf`.
