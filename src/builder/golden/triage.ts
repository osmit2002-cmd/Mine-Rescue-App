/**
 * Every contest PDF under problems/, classified by whether an official solution was recovered.
 * official is yes only when the file itself contains a team-stop route, a keys-to-problem list,
 * a judges' exploration briefing, or a judges' ventilation answer. It is unconfirmed when the
 * scan could not be read. A new PDF is not given a yes by guessing.
 */
export interface TriageRow {
  pdf: string;
  official: 'yes' | 'no' | 'unconfirmed';
  transcribed: boolean;
  /** Score of the transcribed fixture. Empty when the PDF is not a fixture. */
  score: string;
  note: string;
}

export const TRIAGE: TriageRow[] = [
  {
    pdf: 'problems/msha-archive/BenchResources/BG-4.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Bench apparatus contest, not a mine exploration problem.'
  },
  {
    pdf: 'problems/msha-archive/BenchResources/Bio-Pac 240-R.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Bench apparatus contest, not a mine exploration problem.'
  },
  {
    pdf: 'problems/msha-archive/BenchResources/Bio-Pac 240-S.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Bench apparatus contest, not a mine exploration problem.'
  },
  {
    pdf: 'problems/msha-archive/coal/2004/2004GovsCupBooklets.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/msha-archive/coal/2004/2004KMI.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Scanned judges notes include Team Stop No. 13 and airlock instructions.'
  },
  {
    pdf: 'problems/msha-archive/coal/2004/2004PaStateminerescue.pdf',
    official: 'unconfirmed',
    transcribed: false,
    score: '',
    note: 'Image-only. OCR of the first, middle, and last pages did not recover a sentence. Not marked yes.'
  },
  {
    pdf: 'problems/msha-archive/coal/2004/2004PaoniaColoradoContest.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Judges ventilation / final map and placard-location pages.'
  },
  {
    pdf: 'problems/msha-archive/coal/2004/2004Post11.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Scanned pages labeled as the vent, with areas marked clear.'
  },
  {
    pdf: 'problems/msha-archive/coal/2004/2004PriceUtahContest.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Labeled ventilation-change maps (change 2 and change 3).'
  },
  {
    pdf: 'problems/msha-archive/coal/2004/2004WesternKYMiningInstitute.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Pages titled as outby / alternate ventilation. OCR of the drawings is poor.'
  },
  {
    pdf: 'problems/msha-archive/coal/2004/ACA2004/2004ACAMINERESCUECONTESTexploration.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Written team stops (TS-8, TS-13, TS-15, TS-16) in the exploration narrative.'
  },
  {
    pdf: 'problems/msha-archive/coal/2004/ACA2004/2004ACAsupersstatement.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/msha-archive/coal/2004/ACA2004/alabama contest 04.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Ventilation maps numbered 3 and 4.'
  },
  {
    pdf: 'problems/msha-archive/coal/2005/AlabamaMineRescue2005.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Written team stops TS-3 through TS-12, five ventilation maps, and a team-stop map.'
  },
  {
    pdf: 'problems/msha-archive/coal/2005/CraigColorado2005.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Page titled 3rd Right team stops.'
  },
  {
    pdf: 'problems/msha-archive/coal/2005/MorgantownContestProblem2005.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/msha-archive/coal/2005/PriceUtah2005.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Step 2 ventilation map, with areas marked clear and stoppings to build or close.'
  },
  {
    pdf: 'problems/msha-archive/coal/2005/illinois2005.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/msha-archive/coal/2005/pastate2005.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Judges exploration briefing with Team Stop No. 1 onward, plus a final ventilation map.'
  },
  {
    pdf: 'problems/msha-archive/coal/2005/stclairesvillejudgesbriefing2005.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Judges briefing. Page titled 1st Ventilation, with builds marked. The opening pages are the superintendent statement.'
  },
  {
    pdf: 'problems/msha-archive/coal/2006/2006AlabamaMineRescueContest.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Team-stop instructions (TS-1 and later) and the discount rulings for this problem.'
  },
  {
    pdf: 'problems/msha-archive/coal/2006/GovenorsCup2006VA.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Second ventilation map in the judges\' set.'
  },
  {
    pdf: 'problems/msha-archive/coal/2006/KyStateMRContest.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/msha-archive/coal/2006/MorgantownWV.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Team Stops page.'
  },
  {
    pdf: 'problems/msha-archive/coal/2006/Pennsylvania.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/msha-archive/coal/2006/SouthernWVMRContest2006.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/msha-archive/coal/2006/StClairesville.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/msha-archive/coal/2006/VAMiningInstitueDay12006.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/msha-archive/coal/2006/VAMiningInstitueDay22006.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/msha-archive/coal/2006/WVStateMRContest2006.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/msha-archive/coal/2006/WesternKentucy2006.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Page titled ventilation after the area is explored.'
  },
  {
    pdf: 'problems/msha-archive/coal/2007/2007 KMI Mine Rescue Contest.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Judges packet. Page 16 states the Rule 31B and Rule 42 conditions the team must not break.'
  },
  {
    pdf: 'problems/msha-archive/coal/2007/FIRST AID NATIONAL NO1.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'First-aid problem, not mine exploration.'
  },
  {
    pdf: 'problems/msha-archive/coal/2007/First Aid NATIONAL NO2.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'First-aid problem, not mine exploration.'
  },
  {
    pdf: 'problems/msha-archive/coal/2007/MR Day 2(8-29).pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Final ventilation map. Companion to the 2007 national Day 1 judges briefing.'
  },
  {
    pdf: 'problems/msha-archive/coal/2007/MR Day1 (8-28).pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Judges exploration briefing with Team Stop No. 1, and a final ventilation map.'
  },
  {
    pdf: 'problems/msha-archive/coal/2007/Preshift/Contestant Statement.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Preshift exam or record, not mine exploration.'
  },
  {
    pdf: 'problems/msha-archive/coal/2007/Preshift/Nationals.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Preshift exam or record, not mine exploration.'
  },
  {
    pdf: 'problems/msha-archive/coal/2007/Preshift/Preshift Record Blank.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Preshift exam or record, not mine exploration.'
  },
  {
    pdf: 'problems/msha-archive/coal/2007/Preshift/Preshift Record Completed (2).pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Preshift exam or record, not mine exploration.'
  },
  {
    pdf: 'problems/msha-archive/coal/2007/Preshift/Preshift Record Completed.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Preshift exam or record, not mine exploration.'
  },
  {
    pdf: 'problems/msha-archive/coal/2007/WesternKentucy2007.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Judges briefing with roof/rib/gas-test and map-judge pages.'
  },
  {
    pdf: 'problems/msha-archive/coal/2008/Post11MRC2008.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Judges briefing packet with the patient statement and the working maps.'
  },
  {
    pdf: 'problems/msha-archive/coal/2008/VMI Day 1 Problem 080708.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/msha-archive/coal/2008/VMI Day 2 Problem 080708.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Last page is a judges map: gas that must be ventilated, build and remove notes.'
  },
  {
    pdf: 'problems/msha-archive/coal/2009/2009NationalDay1.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Written Team Stop No. 1 through 13, including two captain\'s options, and the ventilation maps.'
  },
  {
    pdf: 'problems/msha-archive/coal/2009/2009NationalDay2.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Written team stops (Team Stop No. 3 recovered) and an extent-of-gases map.'
  },
  {
    pdf: 'problems/msha-archive/coal/2009/2009NationalFirstAidProb1.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'First-aid problem, not mine exploration.'
  },
  {
    pdf: 'problems/msha-archive/coal/2009/2009NationalFirstAidProb2.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'First-aid problem, not mine exploration.'
  },
  {
    pdf: 'problems/msha-archive/coal/2009/AlabamaCoalAssoc2009.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem.'
  },
  {
    pdf: 'problems/msha-archive/coal/2009/Craig Mine Rescue Problem.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/msha-archive/coal/2009/Farmington NM 2009 Mine Rescue.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Ventilation map labeled for the novice class.'
  },
  {
    pdf: 'problems/msha-archive/coal/2009/Post5MineRescueContest.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Team-stop conditions in the text (irrespirable air outby a stopping).'
  },
  {
    pdf: 'problems/msha-archive/coal/2009/Price Mine Rescue Contest.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Compliance ventilation map, step 2.'
  },
  {
    pdf: 'problems/msha-archive/coal/2009/StClairsville2009.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem.'
  },
  {
    pdf: 'problems/msha-archive/coal/2010/2010AlabamaMRC.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem, including ventilate the refuge alternative before team stop 12.'
  },
  {
    pdf: 'problems/msha-archive/coal/2010/2010NationalSkillsMRChamp.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem, including why team stop 5 is at the overcast.'
  },
  {
    pdf: 'problems/msha-archive/coal/2010/Delta 2010 - Problem A revised.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/msha-archive/coal/2010/Delta Problem B.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Team stops page.'
  },
  {
    pdf: 'problems/msha-archive/coal/2010/Farmington Mine Rescue Problem0001.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Index team-stop map.'
  },
  {
    pdf: 'problems/msha-archive/coal/2010/Price Mine Rescue Problem.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Page titled Judges vent / final map.'
  },
  {
    pdf: 'problems/msha-archive/coal/2011/2011AlabamaMRC.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem.'
  },
  {
    pdf: 'problems/msha-archive/coal/2011/2011PARegionalSkills.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem.'
  },
  {
    pdf: 'problems/msha-archive/coal/2011/NMRC Day 1 Problem.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Judges briefing with Team Stop #1 onward.'
  },
  {
    pdf: 'problems/msha-archive/coal/2011/NMRC Day 2 Problem.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Team-stop briefing, Team Stop 1 onward.'
  },
  {
    pdf: 'problems/msha-archive/coal/2012/2012 KY River Results.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Contest results, not a solution.'
  },
  {
    pdf: 'problems/msha-archive/coal/2012/2012 PA Regional Skills Contest.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem.'
  },
  {
    pdf: 'problems/msha-archive/coal/2012/2012ACADay1.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem.'
  },
  {
    pdf: 'problems/msha-archive/coal/2012/2012ACADay2.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem.'
  },
  {
    pdf: 'problems/msha-archive/coal/2012/2012KCASkillsMineRescueProblem.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem.'
  },
  {
    pdf: 'problems/msha-archive/coal/2012/2012KCAresults.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Contest results, not a solution.'
  },
  {
    pdf: 'problems/msha-archive/coal/2012/2012NMRAPost5Problem.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Team-stop map (stops 9 and 10 called out) and first and second ventilation maps. The same PDF also holds a written exam.'
  },
  {
    pdf: 'problems/msha-archive/coal/2012/Harlan 2012 Mine Rescue Day 1.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Judges briefing, Team Stop #1 through #16, and three ventilation maps.'
  },
  {
    pdf: 'problems/msha-archive/coal/2012/Harlan 2012 Mine Rescue Day 2.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Judges briefing with numbered team stops.'
  },
  {
    pdf: 'problems/msha-archive/coal/2012/Harlan 2012 Pre-Shift Contest.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Preshift exam or record, not mine exploration.'
  },
  {
    pdf: 'problems/msha-archive/coal/2012/Ky River Mine Rescue  Day 1.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Ventilation #2 map with the builds marked.'
  },
  {
    pdf: 'problems/msha-archive/coal/2012/Ky River Mine Rescue Day 2.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Ventilation #3 map with the builds marked.'
  },
  {
    pdf: 'problems/msha-archive/coal/2013/2013 MTTCPaskills.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem.'
  },
  {
    pdf: 'problems/msha-archive/coal/2013/2013AlabamaCoalAssocDay1.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem, including team stop 10.'
  },
  {
    pdf: 'problems/msha-archive/coal/2013/2013AlabamaCoalAssocDay2.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem.'
  },
  {
    pdf: 'problems/msha-archive/coal/2013/2013KCASkills.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem.'
  },
  {
    pdf: 'problems/msha-archive/coal/2014/2014-ACA-DAY-1-JUDGES-BOOK.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem for four ventilations.'
  },
  {
    pdf: 'problems/msha-archive/coal/2014/2014-mttc-nationwide-minerescue.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem.'
  },
  {
    pdf: 'problems/msha-archive/coal/2014/2014KCASkillsContest.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem.'
  },
  {
    pdf: 'problems/msha-archive/coal/2014/2014KYRiverContestProblems.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/msha-archive/coal/2015/2015-ACA-DAY1.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Judges book. Problem Keys page: move the battery phone before the first ventilation.'
  },
  {
    pdf: 'problems/msha-archive/coal/2015/2015-ACA-DAY2.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Text points at the team-stop map in the same book.'
  },
  {
    pdf: 'problems/msha-archive/coal/2015/2015-kca-skills-contest.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem.'
  },
  {
    pdf: 'problems/msha-archive/coal/2015/2015-nationwide-pennsylvania-skills.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem: wing the explosive mixture before pumping water roofed, then airlock.'
  },
  {
    pdf: 'problems/msha-archive/coal/2016/2016 -kca-regionalskills-contest.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem.'
  },
  {
    pdf: 'problems/msha-archive/coal/2016/2016-kca-nationwide-championship-contest.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem. Follow the contaminated entry; see the team-stop map.'
  },
  {
    pdf: 'problems/msha-archive/coal/2016/2016_Illinois_State_Problem_Briefing.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem.'
  },
  {
    pdf: 'problems/msha-archive/coal/2016/2016_Post_5_Day_1_Mine_Rescue.pdf',
    official: 'yes',
    transcribed: true,
    score: '26/26 (100%)',
    note: 'Team-stop map and Keys to Problem. Transcribed.'
  },
  {
    pdf: 'problems/msha-archive/coal/2016/2016_Post_5_Day_2_Mine_Rescue.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem: timber before stop 9, two vents, do not pass the explosive mixture at stop 11.'
  },
  {
    pdf: 'problems/msha-archive/coal/2017/2017_Post_5_Day_1_Mine_Rescue.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Team-stop map and Keys to Problem: stops 9, 10, 11 in that order before 12, vent the barricade before 12, post to the body.'
  },
  {
    pdf: 'problems/msha-archive/coal/2017/2017_Post_5_Day_2_Mine_Rescue.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Keys to Problem and team-stop map: ventilate the first barricade before stop 9, make stop 12 before the second vent.'
  },
  {
    pdf: 'problems/msha-archive/coal/2018/2018 Post 5 Day 1 mine rescue .pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Written team stops 1 through 12 and the conditions at each stop.'
  },
  {
    pdf: 'problems/msha-archive/coal/2018/2018 Post 5 Day 2 mine rescue problem.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Written team stops through stop 16, including where the team must not pass an explosive mixture.'
  },
  {
    pdf: 'problems/msha-archive/coal/international/inatproblem.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Judges briefings for team stops 1 through 7 and later, with a map for each stretch.'
  },
  {
    pdf: 'problems/msha-archive/metal/carlsbad/carlsbad2000.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Written solution. Metal/nonmetal rules, not the coal solver.'
  },
  {
    pdf: 'problems/msha-archive/metal/north/98north.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Problem solution. Metal/nonmetal rules, not the coal solver.'
  },
  {
    pdf: 'problems/msha-archive/metal/north/99north.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Problem solution with two options. Metal/nonmetal rules, not the coal solver.'
  },
  {
    pdf: 'problems/msha-archive/metal/rolla/2000rolla.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/msha-archive/metal/rolla/98rolla.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Problem solution, plus a first-aid discount sheet. Metal/nonmetal rules.'
  },
  {
    pdf: 'problems/msha-archive/metal/south/98south.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Written solution. Metal/nonmetal rules, not the coal solver.'
  },
  {
    pdf: 'problems/virginia-energy/2026/Indiana/IndianaMap.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'BO/CCA ventilation maps with the cleared areas and airflow. The team-working-order sheet is blank, so there is no numbered team-stop key.'
  },
  {
    pdf: 'problems/virginia-energy/2026/MorgantownWV/2026 post 5 day 1 packet.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/virginia-energy/2026/MorgantownWV/2026 post 5 day 2 packet.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/virginia-energy/2026/MorgantownWV/Day 1 MR_NMRA Post 5_07.28.26.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/virginia-energy/2026/MorgantownWV/Day 2 MR Overall_NMRA Post 5_07.29.26.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/virginia-energy/2026/MorgantownWV/Day 2 MR_NMRA Post 5_07.29.26.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/virginia-energy/2026/MorgantownWV/Day 3 BG4_NMRA Post 5_07.30.26.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Bench apparatus contest, not a mine exploration problem.'
  },
  {
    pdf: 'problems/virginia-energy/2026/MorgantownWV/Day 3 BioPak 240R_NMRA Post 5_07.30.26.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Bench apparatus contest, not a mine exploration problem.'
  },
  {
    pdf: 'problems/virginia-energy/2026/MorgantownWV/Day 3 First Aid_NMRA Post 5_07.30.26.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'First-aid problem, not mine exploration.'
  },
  {
    pdf: 'problems/virginia-energy/2026/MorgantownWV/Day 3 Preshift_NMRA Post 5_07.30.26.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Preshift exam or record, not mine exploration.'
  },
  {
    pdf: 'problems/virginia-energy/2026/MorgantownWV/Day 3 ProAir_NMRA Post 5_07.30.26.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Bench apparatus contest, not a mine exploration problem.'
  },
  {
    pdf: 'problems/virginia-energy/2026/MorgantownWV/Day 3 Two Day Combo Results_NMRA Post 5_07.30.26.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Contest results, not a solution.'
  },
  {
    pdf: 'problems/virginia-energy/2026/Ohio/Ohio NMRA Post 6 Day 1.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/virginia-energy/2026/Ohio/Ohio NMRA Post 6 Day 2.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/virginia-energy/2026/Tennessee/2025 Tenn Preshift Judges Book.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Preshift exam or record, not mine exploration.'
  },
  {
    pdf: 'problems/virginia-energy/2026/Tennessee/Day 1-Judge Packet.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Judges\' instructions and a Solutions section. This packet is the metal/nonmetal problem, not coal.'
  },
  {
    pdf: 'problems/virginia-energy/2026/Tennessee/Day 1.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/virginia-energy/2026/Tennessee/Day 2-Judge Packet.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Judges\' instructions and a Solutions section. Metal/nonmetal, not coal.'
  },
  {
    pdf: 'problems/virginia-energy/2026/Tennessee/Day 2.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Problem statement, team map, or instructions. No numbered team stops, keys-to-problem, or judges\' ventilation answer was recovered from the text or from OCR of sample pages.'
  },
  {
    pdf: 'problems/virginia-energy/2026/Tennessee/Nationals/26 Nationals Day 1 Written.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Written examination, not the field problem\'s team-stop key.'
  },
  {
    pdf: 'problems/virginia-energy/2026/Tennessee/Nationals/26 Nationals Day 1.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Coal judges packet. Team Stop #4 and #5 are written; a final vent map is included.'
  },
  {
    pdf: 'problems/virginia-energy/2026/Tennessee/Nationals/26 Nationals Day 2 Written.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Written examination, not the field problem\'s team-stop key.'
  },
  {
    pdf: 'problems/virginia-energy/2026/Tennessee/Nationals/26 Nationals Day 2.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Coal judges packet. Sampled map pages did not OCR; the packet is the judges\' copy and includes the patient statements.'
  },
  {
    pdf: 'problems/virginia-energy/2026/Utah/PriceDay1WrittenStatement.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Written examination, not the field problem\'s team-stop key.'
  },
  {
    pdf: 'problems/virginia-energy/2026/Utah/PriceDay2WrittenStatement.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Vent 3 and Vent 4 maps are in the packet with the written statement.'
  },
  {
    pdf: 'problems/virginia-energy/2026/Utah/PriceTest.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Written examination, not the field problem\'s team-stop key.'
  },
  {
    pdf: 'problems/virginia-energy/2026/Virginia/NCPA-Post 7-2026Day1WrittenExam.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Written examination, not the field problem\'s team-stop key.'
  },
  {
    pdf: 'problems/virginia-energy/2026/Virginia/NCPA-Post 7-2026Day2WrittenExam.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Written examination, not the field problem\'s team-stop key.'
  },
  {
    pdf: 'problems/virginia-energy/2026/Virginia/Post7-Day1-Problem.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Ventilation maps through Vent 8.'
  },
  {
    pdf: 'problems/virginia-energy/2026/Virginia/Post7-Day2-Problem.pdf',
    official: 'yes',
    transcribed: false,
    score: '',
    note: 'Final ventilation map.'
  },
  {
    pdf: 'problems/virginia-energy/2026/WVU_BenchBash/240 Day 1a.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Bench apparatus contest, not a mine exploration problem.'
  },
  {
    pdf: 'problems/virginia-energy/2026/WVU_BenchBash/240 Day 2.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Bench apparatus contest, not a mine exploration problem.'
  },
  {
    pdf: 'problems/virginia-energy/2026/WVU_BenchBash/BG4 Day 1.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Bench apparatus contest, not a mine exploration problem.'
  },
  {
    pdf: 'problems/virginia-energy/2026/WVU_BenchBash/BG4 Day 2.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Bench apparatus contest, not a mine exploration problem.'
  },
  {
    pdf: 'problems/virginia-energy/2026/WVU_BenchBash/Pro Air Day 1.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Bench apparatus contest, not a mine exploration problem.'
  },
  {
    pdf: 'problems/virginia-energy/2026/WVU_BenchBash/Pro Air Day 2.pdf',
    official: 'no',
    transcribed: false,
    score: '',
    note: 'Bench apparatus contest, not a mine exploration problem.'
  },
];
