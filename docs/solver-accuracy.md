# Solver accuracy

The solver in `src/builder/explore.ts` is checked against official step-by-step solutions that are already written down in this repo. `npm run score:solver` prints a score for each one. A score of 100% means every check passed. The first check that disagrees is the divergence, and the report quotes the rule that applies.

`npm test` runs the same checks and fails if any official fixture is under 100%.

## Fixtures

| Id | Source | What the official solution fixes | Score |
|---|---|---|---|
| `figure-7` | 2026 Coal Mine Rescue Rules, Figure 7, page 49 | Nine team stops, numbered on the figure in Rule 44D order. No patients, no ventilation, no withdrawal. | 11/11, 100% |
| `post5-2016-day1` | `problems/msha-archive/coal/2016/2016_Post_5_Day_1_Mine_Rescue.pdf`, team-stop map and Keys to Problem | Team-stop numbers the judges accept (a "45" on the map is stop 4 or 5), three rescues, the two vents, timbering the person under unsafe roof in No. 3 before stop 12, and not using the broken timbers. | 26/26, 100% |
| `national-2024-day1` | [2024 National Coal Day 1](https://minerescuecenter.com/media/problems/2024_national_Coal_Mine_Rescue_2024_National_Coal_Rescue_Day_1.pdf) (packet not committed; minerescuecenter.com states no license) | Twelve team stops, vents 1–4 (the placards marked Cleared), vents 1 and 2 before either pump, the pump cable moved out of the 5.7% mixture before it is energized, both waters in either order with the airlock put back after each, the barricade opened only after the 18.3% O2 is removed, and the finds inby that barricade. The 5.7% mixture is not cleared. Scored on the 2026 rule text. The 2024 judges cite Rule 31C for moving explosive mixture over a cave or unsafe roof; the 2026 text of Rule 31C is an unexplored area, with Rule 30F for the low oxygen and Rule 42 for putting the airlock back. | 32/32, 100% |

Before the Rule 44B change, Figure 7 was already 11/11. The 2016 judge key was 17/21 (81%). The first divergence was the team stop at No. 2 Entry, crosscut row 4: the judges number it 10 and the solver numbered it 11, so the barricade patient there was rescued after stop 11 (Rule 41) instead of before it.

2024 National Day 1 was 10/16 on the twelve printed stops before the two-break, borehole, and barricade-hold rules, then 16/16 when the vents and the finds inby the barricade were left out of the key. It is now 32/32. That count includes vents 1 and 2 before either pump, the pump-cable move, and the airlock put back after each water. Placards that stay face down until a water placard is flipped are still not encoded: the judges' text does not give them a location.

## Not encoded

These were opened in the same pass. No route was invented, so they are not scored.

| Problem | Why it is not scored |
|---|---|
| [2026 National Coal Day 2](https://minerescuecenter.com/media/problems/2026_national_Coal_Day_2_Field_26_Nationals_Day_2.pdf) | The judges' packet is image-only. The briefing lists team stops 1–12 and ventilations 1–5, and it does not say which intersection each stop is. The circled numbers on the map did not read out to positions. |
| 2019 National Coal Day 1 | The field packet is a scan with no text layer. Not transcribed. |
| 2017 National Coal Day 1 | The text layer has a blank "Team Working Order" sheet. The stop route is on the map, which was not read into positions. |
| 2011 National Coal Day 2 | The MSHA file (public domain) writes team stops 1–12. The gas placards are in a spaced map text layer with no coordinates, so placing them would be a guess. Left unscored. |
| 2007 National Coal Day 1 | The problem file is a scan with no text layer. Not transcribed. |
| 2016 Post 5 Day 2, 2017 Post 5, 2018 Post 5 | Still in `problems/`. Not transcribed in this pass. |

## How to add a problem

1. Transcribe the map into a builder problem, the way `src/builder/cases/post5-2016-day1.ts` does. Positions only have to fall in the right openings.
2. Add an `OfficialFixture` in `src/builder/golden/official.ts`.
   - `key.stops` is the team-stop numbers the official solution accepts at each intersection. When the judge map writes "45", set `n` to `[4, 5]`. When it writes one number, set `n` to that number alone.
   - `key.rescue`, `key.vents`, `key.reachBefore`, and `key.withdrawal` cover patients, ventilation order, and Rule 31B.
   - `extras` is for a requirement the key fields cannot say, such as "put this barricade back up on the first vent" or "timber this body before stop 12". Each extra names the rule it comes from.
   - Set `pdf` to the file under `problems/` when the solution came from a contest PDF. That file is then official instead of unverified.
3. Do not run the solver and paste its route in as the official solution. A contest packet that cannot be committed (minerescuecenter.com states no license) is still a fixture when the facts and the official stops are transcribed and the source URL is cited. If the official route is not in the source, leave the problem unverified.
4. Run `npm run score:solver`. A miss prints the first divergence and the rule text.

## Rule interpretations

These are the readings the solver uses where the rule book allows more than one picture. They are general; nothing in the solver is switched on a problem id.

- **Rule 44B.** "As the team advances into a contaminated entry and subsequently encounters a placard(s) indicating that all contaminants are cleared prior to reaching an intersection, the team must make further advances in the other contaminated or adjacent entry." The solver treats a contaminant as ended once the team has reached the inby intersection of an impassable opening the contaminant sits on. Further moves in that entry then wait while another entry is still contaminated ahead. Figure 7 has no contaminants, so its printed order is unchanged. On the 2016 problem this is what puts stops 10, 11, and 12 at No. 2, No. 3, and No. 1.
- **Rules 48E and 35.** A line curtain wings contaminants from an airtight separation. When an explosive mixture is outby a barricade the team has already breached, and irrespirable air is inby that barricade, the first vent puts the barricade back up and the next vent takes it down before the irrespirable air is moved. Rule 35 still requires that irrespirable air to be gone before the inby barricade is breached.
- **Rule 30F.** The 19.0% oxygen must not be carried through the opening where the person under unsafe roof in No. 3 is lying. The 2016 vent maps also mark some temporary stoppings "Either", so they do not fix one set of arrows. The solver's course meets the key and stays off that opening; it does not copy one of the "Either" layouts.
- **Rule 32.** A body under unsafe roof, including elongated unsafe roof that does not reach rib to rib, is timbered to after every missing person has been found and before the next team stop. A timber placard with count 0 ("cannot use") is not a usable set (Rule 30A: timbers that cannot serve as the required supports are not counted).
- **Rule 44E.** Where a crosscut is blocked by a stopping or a door, the team does not advance past the inby corner of the second crosscut until that crosscut has been tied into. On 2024 National Day 1 this is the airlock of the permanent stopping at stop 1 before stop 5. A barricade is not this limit. Figure 7 and the 2016 problem have no intact crosscut stopping, so their orders stay the same.
- **Rules 24A and 24E.** A gas placard extends in the direction of travel only as far as the next required test. An open borehole is one of those tests, so the 5.7% CH4 in No. 2 on the 2024 problem stops at the borehole and does not reach the battery ram car in the intersection.
- **Miscellaneous rule 4.** An exhausting fan draws intake from the fresh openings that are not the fan: the other fresh-air-base entries, air shafts, and outby openings. The fan's own entry is the return. Irrespirable air may leave along that return without crossing the briefing officer's place in the fresh air base (Rule 30H). Intake air is not brought into the return through the fresh air base.
- **Rule 31A.** A course that would sweep a different explosive mixture onto an ignition source is sealed between that mixture and the source, then checked again. Explosive mixtures are ventilated in the order the team found them. A later mixture is not started while an earlier one is still unsafe for a reason that pumping or exploring can change.
- **Rule 35.** An airtight barricade with irrespirable air still immediately outby it is not breached. The 2024 18.3% oxygen is moved to the exhausting fan on the No. 3 return, and the barricade is opened only after that. The conscious person, the body, and the two timbers inby the barricade are then found. That ventilation waits while a water roofed the team has reached is still not pumped.
- **Rules 31A and 48E.** Vents 1 and 2 on the 2024 problem are legal before either water is pumped. The No. 1 cave stops travel and does not seal the airway, so intake air can move up that entry. The gas outby the airtight water is winged from that separation. The course does not carry the 5.7% mixture onto the ram car. Mixtures found only by opening a water wait until every reached water roofed has been pumped.
- **Rule 31D.** A cable that is not yet energized and lies in an explosive mixture is moved to the nearest explored intersection outside that mixture before a pump energizes it. The mixture is left in place.
- **Rules 42, 31C and 30F.** After water roofed is pumped while a fan is already running, the airlock is put back before the team leaves the opening. Leaving it down would change the ventilation. In the 2026 text that change is Rule 31C when it moves explosive mixture over an unexplored area, and Rule 30F when it moves irrespirable air over unexplored ground while persons are missing. The 2024 judges cite Rule 31C for the same moment and describe the mixture moving over a cave or unsafe roof.

## Contest PDF triage

`src/builder/golden/triage.ts` lists all 141 PDFs under `problems/`. A file is **yes** only when that file contains a team-stop route, a keys-to-problem list, a judges' exploration briefing, or a judges' ventilation answer. **Unconfirmed** means the scan could not be read. Nothing was marked yes by guessing a route that is not in the file.

| | Count |
|---|---|
| Official solution or judge key in the PDF | 81 |
| No solution recovered | 59 |
| Unconfirmed (scan could not be read) | 1 |
| Transcribed into a fixture | 2 |

The 59 without a recovered solution are problem statements, team maps, written exams, contest results, first-aid problems, preshift records, or bench-apparatus problems. Metal and nonmetal solutions are counted as yes and are not scored by the coal solver. The one unconfirmed file is `problems/msha-archive/coal/2004/2004PaStateminerescue.pdf`.

| PDF | Official solution | Transcribed | Score | What was found |
|---|---|---|---|---|
| `msha-archive/BenchResources/BG-4.pdf` | no | no | — | Bench apparatus contest, not a mine exploration problem. |
| `msha-archive/BenchResources/Bio-Pac 240-R.pdf` | no | no | — | Bench apparatus contest, not a mine exploration problem. |
| `msha-archive/BenchResources/Bio-Pac 240-S.pdf` | no | no | — | Bench apparatus contest, not a mine exploration problem. |
| `msha-archive/coal/2004/2004GovsCupBooklets.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `msha-archive/coal/2004/2004KMI.pdf` | yes | no | — | Scanned judges notes include Team Stop No. 13 and airlock instructions. |
| `msha-archive/coal/2004/2004PaStateminerescue.pdf` | unconfirmed | no | — | Image-only. OCR of the first, middle, and last pages did not recover a sentence. Not marked yes. |
| `msha-archive/coal/2004/2004PaoniaColoradoContest.pdf` | yes | no | — | Judges ventilation / final map and placard-location pages. |
| `msha-archive/coal/2004/2004Post11.pdf` | yes | no | — | Scanned pages labeled as the vent, with areas marked clear. |
| `msha-archive/coal/2004/2004PriceUtahContest.pdf` | yes | no | — | Labeled ventilation-change maps (change 2 and change 3). |
| `msha-archive/coal/2004/2004WesternKYMiningInstitute.pdf` | yes | no | — | Pages titled as outby / alternate ventilation. OCR of the drawings is poor. |
| `msha-archive/coal/2004/ACA2004/2004ACAMINERESCUECONTESTexploration.pdf` | yes | no | — | Written team stops (TS-8, TS-13, TS-15, TS-16) in the exploration narrative. |
| `msha-archive/coal/2004/ACA2004/2004ACAsupersstatement.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `msha-archive/coal/2004/ACA2004/alabama contest 04.pdf` | yes | no | — | Ventilation maps numbered 3 and 4. |
| `msha-archive/coal/2005/AlabamaMineRescue2005.pdf` | yes | no | — | Written team stops TS-3 through TS-12, five ventilation maps, and a team-stop map. |
| `msha-archive/coal/2005/CraigColorado2005.pdf` | yes | no | — | Page titled 3rd Right team stops. |
| `msha-archive/coal/2005/MorgantownContestProblem2005.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `msha-archive/coal/2005/PriceUtah2005.pdf` | yes | no | — | Step 2 ventilation map, with areas marked clear and stoppings to build or close. |
| `msha-archive/coal/2005/illinois2005.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `msha-archive/coal/2005/pastate2005.pdf` | yes | no | — | Judges exploration briefing with Team Stop No. 1 onward, plus a final ventilation map. |
| `msha-archive/coal/2005/stclairesvillejudgesbriefing2005.pdf` | yes | no | — | Judges briefing. Page titled 1st Ventilation, with builds marked. The opening pages are the superintendent statement. |
| `msha-archive/coal/2006/2006AlabamaMineRescueContest.pdf` | yes | no | — | Team-stop instructions (TS-1 and later) and the discount rulings for this problem. |
| `msha-archive/coal/2006/GovenorsCup2006VA.pdf` | yes | no | — | Second ventilation map in the judges' set. |
| `msha-archive/coal/2006/KyStateMRContest.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `msha-archive/coal/2006/MorgantownWV.pdf` | yes | no | — | Team Stops page. |
| `msha-archive/coal/2006/Pennsylvania.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `msha-archive/coal/2006/SouthernWVMRContest2006.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `msha-archive/coal/2006/StClairesville.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `msha-archive/coal/2006/VAMiningInstitueDay12006.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `msha-archive/coal/2006/VAMiningInstitueDay22006.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `msha-archive/coal/2006/WVStateMRContest2006.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `msha-archive/coal/2006/WesternKentucy2006.pdf` | yes | no | — | Page titled ventilation after the area is explored. |
| `msha-archive/coal/2007/2007 KMI Mine Rescue Contest.pdf` | yes | no | — | Judges packet. Page 16 states the Rule 31B and Rule 42 conditions the team must not break. |
| `msha-archive/coal/2007/FIRST AID NATIONAL NO1.pdf` | no | no | — | First-aid problem, not mine exploration. |
| `msha-archive/coal/2007/First Aid NATIONAL NO2.pdf` | no | no | — | First-aid problem, not mine exploration. |
| `msha-archive/coal/2007/MR Day 2(8-29).pdf` | yes | no | — | Final ventilation map. Companion to the 2007 national Day 1 judges briefing. |
| `msha-archive/coal/2007/MR Day1 (8-28).pdf` | yes | no | — | Judges exploration briefing with Team Stop No. 1, and a final ventilation map. |
| `msha-archive/coal/2007/Preshift/Contestant Statement.pdf` | no | no | — | Preshift exam or record, not mine exploration. |
| `msha-archive/coal/2007/Preshift/Nationals.pdf` | no | no | — | Preshift exam or record, not mine exploration. |
| `msha-archive/coal/2007/Preshift/Preshift Record Blank.pdf` | no | no | — | Preshift exam or record, not mine exploration. |
| `msha-archive/coal/2007/Preshift/Preshift Record Completed (2).pdf` | no | no | — | Preshift exam or record, not mine exploration. |
| `msha-archive/coal/2007/Preshift/Preshift Record Completed.pdf` | no | no | — | Preshift exam or record, not mine exploration. |
| `msha-archive/coal/2007/WesternKentucy2007.pdf` | yes | no | — | Judges briefing with roof/rib/gas-test and map-judge pages. |
| `msha-archive/coal/2008/Post11MRC2008.pdf` | yes | no | — | Judges briefing packet with the patient statement and the working maps. |
| `msha-archive/coal/2008/VMI Day 1 Problem 080708.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `msha-archive/coal/2008/VMI Day 2 Problem 080708.pdf` | yes | no | — | Last page is a judges map: gas that must be ventilated, build and remove notes. |
| `msha-archive/coal/2009/2009NationalDay1.pdf` | yes | no | — | Written Team Stop No. 1 through 13, including two captain's options, and the ventilation maps. |
| `msha-archive/coal/2009/2009NationalDay2.pdf` | yes | no | — | Written team stops (Team Stop No. 3 recovered) and an extent-of-gases map. |
| `msha-archive/coal/2009/2009NationalFirstAidProb1.pdf` | no | no | — | First-aid problem, not mine exploration. |
| `msha-archive/coal/2009/2009NationalFirstAidProb2.pdf` | no | no | — | First-aid problem, not mine exploration. |
| `msha-archive/coal/2009/AlabamaCoalAssoc2009.pdf` | yes | no | — | Keys to Problem. |
| `msha-archive/coal/2009/Craig Mine Rescue Problem.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `msha-archive/coal/2009/Farmington NM 2009 Mine Rescue.pdf` | yes | no | — | Ventilation map labeled for the novice class. |
| `msha-archive/coal/2009/Post5MineRescueContest.pdf` | yes | no | — | Team-stop conditions in the text (irrespirable air outby a stopping). |
| `msha-archive/coal/2009/Price Mine Rescue Contest.pdf` | yes | no | — | Compliance ventilation map, step 2. |
| `msha-archive/coal/2009/StClairsville2009.pdf` | yes | no | — | Keys to Problem. |
| `msha-archive/coal/2010/2010AlabamaMRC.pdf` | yes | no | — | Keys to Problem, including ventilate the refuge alternative before team stop 12. |
| `msha-archive/coal/2010/2010NationalSkillsMRChamp.pdf` | yes | no | — | Keys to Problem, including why team stop 5 is at the overcast. |
| `msha-archive/coal/2010/Delta 2010 - Problem A revised.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `msha-archive/coal/2010/Delta Problem B.pdf` | yes | no | — | Team stops page. |
| `msha-archive/coal/2010/Farmington Mine Rescue Problem0001.pdf` | yes | no | — | Index team-stop map. |
| `msha-archive/coal/2010/Price Mine Rescue Problem.pdf` | yes | no | — | Page titled Judges vent / final map. |
| `msha-archive/coal/2011/2011AlabamaMRC.pdf` | yes | no | — | Keys to Problem. |
| `msha-archive/coal/2011/2011PARegionalSkills.pdf` | yes | no | — | Keys to Problem. |
| `msha-archive/coal/2011/NMRC Day 1 Problem.pdf` | yes | no | — | Judges briefing with Team Stop #1 onward. |
| `msha-archive/coal/2011/NMRC Day 2 Problem.pdf` | yes | no | — | Team-stop briefing, Team Stop 1 onward. |
| `msha-archive/coal/2012/2012 KY River Results.pdf` | no | no | — | Contest results, not a solution. |
| `msha-archive/coal/2012/2012 PA Regional Skills Contest.pdf` | yes | no | — | Keys to Problem. |
| `msha-archive/coal/2012/2012ACADay1.pdf` | yes | no | — | Keys to Problem. |
| `msha-archive/coal/2012/2012ACADay2.pdf` | yes | no | — | Keys to Problem. |
| `msha-archive/coal/2012/2012KCASkillsMineRescueProblem.pdf` | yes | no | — | Keys to Problem. |
| `msha-archive/coal/2012/2012KCAresults.pdf` | no | no | — | Contest results, not a solution. |
| `msha-archive/coal/2012/2012NMRAPost5Problem.pdf` | yes | no | — | Team-stop map (stops 9 and 10 called out) and first and second ventilation maps. The same PDF also holds a written exam. |
| `msha-archive/coal/2012/Harlan 2012 Mine Rescue Day 1.pdf` | yes | no | — | Judges briefing, Team Stop #1 through #16, and three ventilation maps. |
| `msha-archive/coal/2012/Harlan 2012 Mine Rescue Day 2.pdf` | yes | no | — | Judges briefing with numbered team stops. |
| `msha-archive/coal/2012/Harlan 2012 Pre-Shift Contest.pdf` | no | no | — | Preshift exam or record, not mine exploration. |
| `msha-archive/coal/2012/Ky River Mine Rescue  Day 1.pdf` | yes | no | — | Ventilation #2 map with the builds marked. |
| `msha-archive/coal/2012/Ky River Mine Rescue Day 2.pdf` | yes | no | — | Ventilation #3 map with the builds marked. |
| `msha-archive/coal/2013/2013 MTTCPaskills.pdf` | yes | no | — | Keys to Problem. |
| `msha-archive/coal/2013/2013AlabamaCoalAssocDay1.pdf` | yes | no | — | Keys to Problem, including team stop 10. |
| `msha-archive/coal/2013/2013AlabamaCoalAssocDay2.pdf` | yes | no | — | Keys to Problem. |
| `msha-archive/coal/2013/2013KCASkills.pdf` | yes | no | — | Keys to Problem. |
| `msha-archive/coal/2014/2014-ACA-DAY-1-JUDGES-BOOK.pdf` | yes | no | — | Keys to Problem for four ventilations. |
| `msha-archive/coal/2014/2014-mttc-nationwide-minerescue.pdf` | yes | no | — | Keys to Problem. |
| `msha-archive/coal/2014/2014KCASkillsContest.pdf` | yes | no | — | Keys to Problem. |
| `msha-archive/coal/2014/2014KYRiverContestProblems.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `msha-archive/coal/2015/2015-ACA-DAY1.pdf` | yes | no | — | Judges book. Problem Keys page: move the battery phone before the first ventilation. |
| `msha-archive/coal/2015/2015-ACA-DAY2.pdf` | yes | no | — | Text points at the team-stop map in the same book. |
| `msha-archive/coal/2015/2015-kca-skills-contest.pdf` | yes | no | — | Keys to Problem. |
| `msha-archive/coal/2015/2015-nationwide-pennsylvania-skills.pdf` | yes | no | — | Keys to Problem: wing the explosive mixture before pumping water roofed, then airlock. |
| `msha-archive/coal/2016/2016 -kca-regionalskills-contest.pdf` | yes | no | — | Keys to Problem. |
| `msha-archive/coal/2016/2016-kca-nationwide-championship-contest.pdf` | yes | no | — | Keys to Problem. Follow the contaminated entry; see the team-stop map. |
| `msha-archive/coal/2016/2016_Illinois_State_Problem_Briefing.pdf` | yes | no | — | Keys to Problem. |
| `msha-archive/coal/2016/2016_Post_5_Day_1_Mine_Rescue.pdf` | yes | yes | 26/26 (100%) | Team-stop map and Keys to Problem. Transcribed. |
| `msha-archive/coal/2016/2016_Post_5_Day_2_Mine_Rescue.pdf` | yes | no | — | Keys to Problem: timber before stop 9, two vents, do not pass the explosive mixture at stop 11. |
| `msha-archive/coal/2017/2017_Post_5_Day_1_Mine_Rescue.pdf` | yes | no | — | Team-stop map and Keys to Problem: stops 9, 10, 11 in that order before 12, vent the barricade before 12, post to the body. |
| `msha-archive/coal/2017/2017_Post_5_Day_2_Mine_Rescue.pdf` | yes | no | — | Keys to Problem and team-stop map: ventilate the first barricade before stop 9, make stop 12 before the second vent. |
| `msha-archive/coal/2018/2018 Post 5 Day 1 mine rescue .pdf` | yes | no | — | Written team stops 1 through 12 and the conditions at each stop. |
| `msha-archive/coal/2018/2018 Post 5 Day 2 mine rescue problem.pdf` | yes | no | — | Written team stops through stop 16, including where the team must not pass an explosive mixture. |
| `msha-archive/coal/international/inatproblem.pdf` | yes | no | — | Judges briefings for team stops 1 through 7 and later, with a map for each stretch. |
| `msha-archive/metal/carlsbad/carlsbad2000.pdf` | yes | no | — | Written solution. Metal/nonmetal rules, not the coal solver. |
| `msha-archive/metal/north/98north.pdf` | yes | no | — | Problem solution. Metal/nonmetal rules, not the coal solver. |
| `msha-archive/metal/north/99north.pdf` | yes | no | — | Problem solution with two options. Metal/nonmetal rules, not the coal solver. |
| `msha-archive/metal/rolla/2000rolla.pdf` | no | no | — | First-aid discount sheets. No exploration solution was found. |
| `msha-archive/metal/rolla/98rolla.pdf` | yes | no | — | Problem solution, plus a first-aid discount sheet. Metal/nonmetal rules. |
| `msha-archive/metal/south/98south.pdf` | yes | no | — | Written solution. Metal/nonmetal rules, not the coal solver. |
| `virginia-energy/2026/Indiana/IndianaMap.pdf` | yes | no | — | BO/CCA ventilation maps with the cleared areas and airflow. The team-working-order sheet is blank, so there is no numbered team-stop key. |
| `virginia-energy/2026/MorgantownWV/2026 post 5 day 1 packet.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `virginia-energy/2026/MorgantownWV/2026 post 5 day 2 packet.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `virginia-energy/2026/MorgantownWV/Day 1 MR_NMRA Post 5_07.28.26.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `virginia-energy/2026/MorgantownWV/Day 2 MR Overall_NMRA Post 5_07.29.26.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `virginia-energy/2026/MorgantownWV/Day 2 MR_NMRA Post 5_07.29.26.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `virginia-energy/2026/MorgantownWV/Day 3 BG4_NMRA Post 5_07.30.26.pdf` | no | no | — | Bench apparatus contest, not a mine exploration problem. |
| `virginia-energy/2026/MorgantownWV/Day 3 BioPak 240R_NMRA Post 5_07.30.26.pdf` | no | no | — | Bench apparatus contest, not a mine exploration problem. |
| `virginia-energy/2026/MorgantownWV/Day 3 First Aid_NMRA Post 5_07.30.26.pdf` | no | no | — | First-aid problem, not mine exploration. |
| `virginia-energy/2026/MorgantownWV/Day 3 Preshift_NMRA Post 5_07.30.26.pdf` | no | no | — | Preshift exam or record, not mine exploration. |
| `virginia-energy/2026/MorgantownWV/Day 3 ProAir_NMRA Post 5_07.30.26.pdf` | no | no | — | Bench apparatus contest, not a mine exploration problem. |
| `virginia-energy/2026/MorgantownWV/Day 3 Two Day Combo Results_NMRA Post 5_07.30.26.pdf` | no | no | — | Contest results, not a solution. |
| `virginia-energy/2026/Ohio/Ohio NMRA Post 6 Day 1.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `virginia-energy/2026/Ohio/Ohio NMRA Post 6 Day 2.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `virginia-energy/2026/Tennessee/2025 Tenn Preshift Judges Book.pdf` | no | no | — | Preshift exam or record, not mine exploration. |
| `virginia-energy/2026/Tennessee/Day 1-Judge Packet.pdf` | yes | no | — | Judges' instructions and a Solutions section. This packet is the metal/nonmetal problem, not coal. |
| `virginia-energy/2026/Tennessee/Day 1.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `virginia-energy/2026/Tennessee/Day 2-Judge Packet.pdf` | yes | no | — | Judges' instructions and a Solutions section. Metal/nonmetal, not coal. |
| `virginia-energy/2026/Tennessee/Day 2.pdf` | no | no | — | Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges' ventilation answer was recovered from the text or from OCR of sample pages. |
| `virginia-energy/2026/Tennessee/Nationals/26 Nationals Day 1 Written.pdf` | no | no | — | Written examination, not the field problem's team-stop key. |
| `virginia-energy/2026/Tennessee/Nationals/26 Nationals Day 1.pdf` | yes | no | — | Coal judges packet. Team Stop #4 and #5 are written; a final vent map is included. |
| `virginia-energy/2026/Tennessee/Nationals/26 Nationals Day 2 Written.pdf` | no | no | — | Written examination, not the field problem's team-stop key. |
| `virginia-energy/2026/Tennessee/Nationals/26 Nationals Day 2.pdf` | yes | no | — | Coal judges packet. Sampled map pages did not OCR; the packet is the judges' copy and includes the patient statements. |
| `virginia-energy/2026/Utah/PriceDay1WrittenStatement.pdf` | no | no | — | Written examination, not the field problem's team-stop key. |
| `virginia-energy/2026/Utah/PriceDay2WrittenStatement.pdf` | yes | no | — | Vent 3 and Vent 4 maps are in the packet with the written statement. |
| `virginia-energy/2026/Utah/PriceTest.pdf` | no | no | — | Written examination, not the field problem's team-stop key. |
| `virginia-energy/2026/Virginia/NCPA-Post 7-2026Day1WrittenExam.pdf` | no | no | — | Written examination, not the field problem's team-stop key. |
| `virginia-energy/2026/Virginia/NCPA-Post 7-2026Day2WrittenExam.pdf` | no | no | — | Written examination, not the field problem's team-stop key. |
| `virginia-energy/2026/Virginia/Post7-Day1-Problem.pdf` | yes | no | — | Ventilation maps through Vent 8. |
| `virginia-energy/2026/Virginia/Post7-Day2-Problem.pdf` | yes | no | — | Final ventilation map. |
| `virginia-energy/2026/WVU_BenchBash/240 Day 1a.pdf` | no | no | — | Bench apparatus contest, not a mine exploration problem. |
| `virginia-energy/2026/WVU_BenchBash/240 Day 2.pdf` | no | no | — | Bench apparatus contest, not a mine exploration problem. |
| `virginia-energy/2026/WVU_BenchBash/BG4 Day 1.pdf` | no | no | — | Bench apparatus contest, not a mine exploration problem. |
| `virginia-energy/2026/WVU_BenchBash/BG4 Day 2.pdf` | no | no | — | Bench apparatus contest, not a mine exploration problem. |
| `virginia-energy/2026/WVU_BenchBash/Pro Air Day 1.pdf` | no | no | — | Bench apparatus contest, not a mine exploration problem. |
| `virginia-energy/2026/WVU_BenchBash/Pro Air Day 2.pdf` | no | no | — | Bench apparatus contest, not a mine exploration problem. |

## Unverified

These are in the repo and are not scored. No official route was invented for them.

- **Rule book Figure 5** (page 47). The figure shows the 25-foot limit and the direction of travel at a team stop. It does not number a route.
- **Practice 1.** Written for this app. Not a contest problem.
- Every contest PDF above whose Transcribed cell is no. The score test treats a PDF as unverified until a fixture names it in `pdf`.
