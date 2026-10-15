/** All quiz tuning knobs live here. Generators read these values but never mutate them. */
export const quizConfig = {
  /** Session length choices shown on the setup screen. */
  sessionSizes: [10, 20, 'all'] as const,
  defaultSessionSize: 10 as number | 'all',
  /** Share of multiple-choice questions in "mixed" mode (0..1). */
  mixedMcRatio: 0.5,
  /** Number of wrong options in multiple choice. The 2026 written exam is three-choice (1 correct + 2). */
  distractorCount: 2,
  /** Default quiz mode on the setup screen. */
  defaultMode: 'mc' as 'mc' | 'fill' | 'mixed',
  /** Mock exam default when an event has no metadata: ten verbatim statements, three choices, no timer. */
  mockExamSize: 10,
  /**
   * Mock exam fallbacks per event, used when facts.json `events[].written_exam` lacks a value.
   * facts = statement-of-fact questions, parts = Identification of Parts questions, minutes = time limit (null = no timer).
   */
  mockExams: {
    'mine-rescue': { facts: 10, parts: 0, minutes: 15 }, // Written Examination rule 3 (p. 7): fifteen minutes max
    'first-aid': { facts: 15, parts: 0, minutes: 20 },
    'bench-biopak': { facts: 20, parts: 0, minutes: 20 },
    'bench-bg4': { facts: 20, parts: 0, minutes: 20 },
    'bench-proair': { facts: 20, parts: 0, minutes: 20 },
    preshift: { facts: 10, parts: 0, minutes: 15 }
  } as Record<string, { facts: number; parts: number; minutes: number | null }>,
  /** Mock exams use statements of fact only (Odin, v0.1.0). Set true to add Identification of Parts questions from the events metadata. */
  mockIncludesParts: false,
  /** Default statement count for a statements-only bench mock when the metadata gives none. */
  benchMockStatements: 20,
  /** Timer length used when an event has no official time limit. */
  defaultTimerMinutes: 15,
  /** Allowed timer range in minutes. */
  timerRange: [1, 180] as [number, number],
  /** When picking distractor terms from other facts, facts within this many numbers are tried first. */
  nearbyFactWindow: 15,
  /** Fact-number blocks offered as a quiz filter when the content has no categories. */
  numberBlockSize: 50,
  /** How many recently seen fact ids are remembered (localStorage) and pushed to the back of new sessions. */
  recentWindow: 60,
  /** Max Levenshtein distance accepted for word answers, by expected length (normalized chars). */
  typoTolerance: [
    { maxLen: 3, distance: 0 },
    { maxLen: 7, distance: 1 },
    { maxLen: Infinity, distance: 2 }
  ],
  /** Answer fields that are short enough (in words) to ask as a typed answer. */
  maxTypedAnswerWords: 4,
  /** Candidates scoring within this many points of the best are all eligible, for variety. */
  blankTierSpread: 12,
  /** Scores per candidate kind (higher = more likely to be blanked). */
  blankScores: {
    keyTerm: 100,
    number: 85,
    quoted: 80,
    acronym: 75,
    unit: 60,
    lexicon: 70,
    capitalized: 55,
    word: 20
  },
  /** Minimum length for the plain-word fallback. */
  minFallbackWordLength: 6,
  /** Words never blanked (lower case). */
  ignoreTerms: ['shall', 'must', 'may', 'sample', 'placeholder', 'example', 'statement', 'statements', 'fact', 'question', 'should', 'would', 'which', 'there', 'their', 'these', 'those', 'where', 'when', 'under', 'before', 'after', 'other', 'every', 'being', 'during', 'within', 'without', 'through', 'between', 'against', 'always', 'never', 'about', 'because', 'whether', 'cannot', 'circumstances'],
  /**
   * Units recognised after a number, grouped into families (used for plausible unit distractors).
   * Keys are family names; values are the unit spellings (lower case).
   */
  units: {
    length: ['feet', 'foot', 'ft', 'inches', 'inch', 'in', 'yards', 'yard', 'meters', 'meter', 'metres', 'metre', 'miles', 'mile'],
    time: ['seconds', 'second', 'minutes', 'minute', 'min', 'hours', 'hour', 'hrs', 'days', 'day'],
    concentration: ['percent', '%', 'ppm', 'lel'],
    pressure: ['psi', 'psig', 'bar', 'inches of water', 'in. w.g.'],
    flow: ['cfm', 'fpm', 'feet per minute', 'cubic feet per minute'],
    mass: ['pounds', 'pound', 'lbs', 'lb', 'kilograms', 'kg'],
    volume: ['gallons', 'gallon', 'liters', 'liter', 'litres', 'litre', 'cubic feet'],
    temperature: ['degrees', 'degree', '°f', '°c'],
    electrical: ['volts', 'volt', 'amps', 'amp', 'amperes']
  } as Record<string, string[]>,
  /**
   * Groups of interchangeable terms. When the blank is in a group, other members (not already in the
   * statement) are preferred as distractors, so options are plausible ("methane" vs "hydrogen").
   */
  termGroups: [
    ['methane', 'hydrogen', 'carbon monoxide', 'carbon dioxide', 'hydrogen sulfide', 'nitrogen dioxide', 'sulfur dioxide', 'oxygen', 'nitrogen', 'acetylene'],
    ['blackdamp', 'whitedamp', 'firedamp', 'stinkdamp', 'afterdamp'],
    ['Class A', 'Class B', 'Class C', 'Class D'],
    ['intake', 'return', 'overcast', 'undercast', 'stopping', 'regulator', 'check curtain', 'line curtain', 'brattice', 'airlock'],
    ['intakes', 'returns', 'overcasts', 'stoppings', 'regulators', 'seals'],
    ['roof', 'floor', 'ribs', 'face'],
    ['lighter', 'heavier'],
    ['explosive', 'nonexplosive', 'flammable', 'nonflammable', 'toxic', 'nontoxic'],
    ['colorless', 'odorless', 'tasteless'],
    ['captain', 'briefing officer', 'map man', 'gas man', 'tail captain', 'command center attendant'],
    ['team safety', 'rescue of survivors', 'recovery of the mine'],
    ['first', 'second', 'third', 'fourth', 'fifth']
  ] as string[][],
  /** Technical vocabulary worth blanking (multi-word phrases are matched before single words). */
  lexicon: [
    'carbon monoxide', 'carbon dioxide', 'hydrogen sulfide', 'nitrogen dioxide', 'sulfur dioxide', 'methane', 'oxygen',
    'hydrogen', 'nitrogen', 'acetylene', 'afterdamp', 'blackdamp', 'whitedamp', 'firedamp', 'stinkdamp',
    'fresh air base', 'command center', 'permanent seals', 'permanent seal', 'temporary seals', 'temporary seal', 'seals',
    'ventilation', 'returns', 'return', 'intakes', 'intake', 'overcast', 'undercast', 'stoppings', 'stopping', 'regulator',
    'brattice', 'check curtain', 'line curtain', 'curtain', 'airlock', 'apparatus', 'explosion', 'explosive', 'ignition',
    'fuel', 'heat', 'coal dust', 'rock dust', 'roof bolts', 'cribs', 'crib', 'posts', 'barefaced', 'captain',
    'briefing officer', 'lifeline', 'tether', 'team safety', 'survivors', 'recovery', 'dead ends', 'ribs', 'roof',
    'floor', 'smoke', 'water', 'dry chemicals', 'nonconducting', 'cooling', 'blanketing', 'high volatile', 'main fan',
    'fan', 'pressure', 'sampling', 'bore holes', 'boreholes', 'flame safety lamp', 'multi-gas', 'self-rescuer',
    'stretcher', 'backboard', 'first aid', 'hypothermia', 'shock', 'tourniquet', 'map', 'mapman', 'gas tests',
    'unconscious', 'trapped', 'nonexplosive', 'flammable', 'toxic', 'colorless', 'odorless', 'lighter', 'heavier', 'map man', 'gas man', 'tail captain', 'command center attendant', 'class a', 'class b', 'class c', 'class d', 'inert gases', 'fire triangle', 'smoke rollback', 'gas layering', 'debriefing', 'line brattice', 'oxygen indicator', 'hydrocarbons', 'coking', 'barricade', 'escapeway', 'escapeways', 'belt entry', 'face', 'gob', 'pillar', 'entry'
  ]
};

export type QuizConfig = typeof quizConfig;
