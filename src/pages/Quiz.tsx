import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EventPicker } from '../components/EventPicker';
import { ALL_EVENTS, useData, useEvent } from '../data/DataContext';
import type { Fact } from '../data/types';
import { checkAnswer } from '../quiz/check';
import { buildCandidateIndex, generateQuestion, type Question, type QuestionType } from '../quiz/generate';
import { generatePartQuestion, partItems, type PartItem } from '../quiz/parts';
import { loadTimerSettings, mockPlan, saveTimerSettings, sessionMinutes, timerMinutes, timerOn, withTimerMinutes, withTimerOn, type TimerMode } from '../quiz/mock';
import { buildSession } from '../quiz/picker';
import { quizConfig } from '../quiz/quizConfig';
import { shuffle } from '../quiz/rng';
import { loadStats, recordAnswer, saveStats } from '../quiz/stats';

type Mode = 'mc' | 'fill' | 'mock';
type Size = number | 'all';
type Source = 'facts' | 'parts' | 'both';
type Item = { id: string; fact?: Fact; part?: PartItem; category?: string };

interface Answered {
  q: Question;
  given: string;
  correct: boolean;
  typo: boolean;
}

const MODE_LABEL: Record<Mode, string> = {
  mc: `Multiple choice (${quizConfig.distractorCount + 1} options)`,
  fill: 'Fill-in practice',
  mock: 'Mock exam'
};

/** Fact-number blocks ("1–50", "51–100", …) for filtering when the content has no categories. */
function blocksOf(facts: Fact[]) {
  const size = quizConfig.numberBlockSize;
  const blocks: { key: string; label: string; ids: Set<string> }[] = [];
  facts.forEach((f, i) => {
    const b = Math.floor(i / size);
    if (!blocks[b]) blocks[b] = { key: String(b), label: '', ids: new Set() };
    blocks[b].ids.add(f.id);
  });
  blocks.forEach((b, i) => {
    const first = facts[i * size];
    const last = facts[Math.min(facts.length, (i + 1) * size) - 1];
    b.label = `${first.number ?? i * size + 1}–${last.number ?? Math.min(facts.length, (i + 1) * size)}`;
  });
  return blocks;
}

function Prompt({ q }: { q: Question }) {
  return (
    <p className="prompt">
      {q.segments.map((s, i) => (
        <span key={i}>
          {s}
          {i < q.segments.length - 1 && (
            <span className="blank">
              <span aria-hidden="true">{'\u2009'}_____{'\u2009'}</span>
              <span className="sr-only">blank</span>
            </span>
          )}
        </span>
      ))}
    </p>
  );
}

const fmtTime = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function Quiz() {
  const data = useData();
  const { facts: allFacts, factsById, factEvents, parts, partsById } = data;
  const { event: globalEvent, setEvent } = useEvent();
  const [params, setParams] = useSearchParams();

  // A quiz always runs inside one event, so distractors never mix contests.
  const eventId = globalEvent === ALL_EVENTS ? '' : globalEvent;
  const needsEvent = factEvents.length > 1 && !eventId;
  const facts = useMemo(() => (eventId ? allFacts.filter((f) => f.event === eventId) : allFacts), [allFacts, eventId]);
  const eventTables = useMemo(() => (eventId ? parts.filter((t) => t.event === eventId) : parts), [parts, eventId]);
  const pItems = useMemo(() => partItems(eventTables), [eventTables]);
  const ev = data.eventInfo(eventId);
  const plan = mockPlan(eventId, ev, pItems.length > 0);
  const mockParts = plan.parts;
  const mockFacts = plan.facts;
  const [timer, setTimer] = useState(loadTimerSettings);

  const categories = useMemo(() => [...new Set(facts.map((f) => f.category).filter((c): c is string => !!c))], [facts]);
  const blocks = useMemo(() => blocksOf(facts), [facts]);

  const [mode, setMode] = useState<Mode>(() => {
    const m = params.get('mode');
    return m === 'mc' || m === 'fill' || m === 'mock' ? m : quizConfig.defaultMode === 'fill' ? 'fill' : 'mc';
  });
  const [source, setSource] = useState<Source>('facts');
  const [size, setSize] = useState<Size>(quizConfig.defaultSessionSize);
  const [cats, setCats] = useState<string[]>([]);
  const [blockSel, setBlockSel] = useState<string[]>([]);
  useEffect(() => {
    setBlockSel([]);
    setCats([]);
    setSource('facts');
  }, [eventId]);

  const [phase, setPhase] = useState<'setup' | 'run' | 'done'>('setup');
  // The running session keeps its own event, so changing the header picker mid-quiz never mixes events.
  const [sessionEvent, setSessionEvent] = useState('');
  const sessionFacts = useMemo(() => (sessionEvent ? allFacts.filter((f) => f.event === sessionEvent) : allFacts), [allFacts, sessionEvent]);
  const sessionTables = useMemo(() => (sessionEvent ? parts.filter((t) => t.event === sessionEvent) : parts), [parts, sessionEvent]);
  const index = useMemo(() => (phase === 'setup' ? null : buildCandidateIndex(sessionFacts)), [sessionFacts, phase === 'setup']);
  const [runMode, setRunMode] = useState<Mode>('mc');
  const [session, setSession] = useState<Item[]>([]);
  const [pos, setPos] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answered[]>([]);
  const [current, setCurrent] = useState<Answered | null>(null);
  const [typed, setTyped] = useState('');
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [timedOut, setTimedOut] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const factPool = useMemo(() => {
    let p = facts;
    if (cats.length) p = p.filter((f) => cats.includes(f.category ?? ''));
    if (blockSel.length) {
      const ids = new Set(blockSel.flatMap((k) => [...(blocks.find((b) => b.key === k)?.ids ?? [])]));
      p = p.filter((f) => ids.has(f.id));
    }
    return p;
  }, [facts, cats, blockSel, blocks]);
  const effectiveSource: Source = pItems.length ? source : 'facts';
  const pool: Item[] = useMemo(() => {
    const fi = factPool.map((f) => ({ id: f.id, fact: f, category: f.category }));
    const pi = pItems.map((p) => ({ id: p.id, part: p }));
    return effectiveSource === 'facts' ? fi : effectiveSource === 'parts' ? pi : [...fi, ...pi];
  }, [factPool, pItems, effectiveSource]);

  const start = useCallback((list: Item[], m: Mode, minutes: number | null = null) => {
    if (!list.length) return;
    setSessionEvent(list[0].fact?.event ?? list[0].part?.table.event ?? '');
    setSession(list);
    setRunMode(m);
    setPos(0);
    setAnswers([]);
    setCurrent(null);
    setTyped('');
    setStreak(0);
    setBestStreak(0);
    setQuestion(null);
    setTimedOut(false);
    setDeadline(minutes ? Date.now() + minutes * 60_000 : null);
    setNow(Date.now());
    setPhase('run');
  }, []);

  const startFromSetup = () => {
    const recent = loadStats().recent;
    if (mode === 'mock') {
      // Statements first, then parts, like the bench written exam.
      const f = buildSession(facts.map((x) => ({ id: x.id, fact: x })), { size: mockFacts, recent }, Math.random);
      const p = mockParts ? buildSession(pItems.map((x) => ({ id: x.id, part: x })), { size: mockParts, recent }, Math.random) : [];
      start([...f, ...p], 'mock', sessionMinutes(timer, 'mock', eventId, plan.officialMinutes));
    } else {
      const s = buildSession(pool, { size, recent }, Math.random);
      start(effectiveSource === 'both' ? shuffle(s, Math.random) : s, mode, sessionMinutes(timer, 'practice', eventId, plan.officialMinutes));
    }
  };

  // A link to /quiz?mode=… while the page is open (e.g. the Home "Mock exam" tile) switches the setup mode,
  // unless a session is running.
  const modeParam = params.get('mode');
  useEffect(() => {
    if (modeParam !== 'mc' && modeParam !== 'fill' && modeParam !== 'mock') return;
    setMode(modeParam);
    setPhase((ph) => (ph === 'done' ? 'setup' : ph));
  }, [modeParam]);

  // Deep link: /quiz?fact=<id> practises one statement.
  useEffect(() => {
    const id = params.get('fact');
    if (!id) return;
    const f = factsById.get(id);
    if (f) {
      if (f.event && f.event !== globalEvent) setEvent(f.event);
      start([{ id: f.id, fact: f }], 'mc');
    }
    const next = new URLSearchParams(params);
    next.delete('fact');
    setParams(next, { replace: true });
  }, [params, factsById, setParams, start, globalEvent, setEvent]);

  const finish = useCallback(() => {
    const s = loadStats();
    saveStats({ ...s, sessions: s.sessions + 1 });
    setDeadline(null);
    setPhase('done');
  }, []);

  // Generate the question for the current position (skipping items that cannot produce one).
  useEffect(() => {
    if (phase !== 'run' || !index) return;
    let p = pos;
    const qt: QuestionType = runMode === 'fill' ? 'fill' : 'mc';
    while (p < session.length) {
      const it = session[p];
      const q = it.fact ? generateQuestion(it.fact, qt, { facts: sessionFacts, index, rng: Math.random }) : it.part ? generatePartQuestion(it.part, sessionTables, qt, Math.random) : null;
      if (q) {
        if (p !== pos) {
          // Drop items that cannot produce a question (e.g. too few distractors) so they are not
          // counted as unanswered in a mock exam; the effect re-runs on the shorter session.
          setSession((s) => [...s.slice(0, pos), ...s.slice(p)]);
          return;
        }
        setQuestion(q);
        return;
      }
      p++;
    }
    if (pos < session.length) setSession((s) => s.slice(0, pos));
    finish();
  }, [phase, pos, session, runMode, sessionFacts, index, sessionTables, finish]);

  // Countdown: auto-submits when time runs out.
  useEffect(() => {
    if (phase !== 'run' || deadline === null) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= deadline) {
        setTimedOut(true);
        finish();
      }
    }, 500);
    return () => clearInterval(t);
  }, [phase, deadline, finish]);

  useEffect(() => {
    if (question?.type === 'fill' && !current) inputRef.current?.focus();
    if (current) nextRef.current?.focus();
  }, [question, current]);

  const advance = useCallback(() => {
    setCurrent(null);
    setTyped('');
    setQuestion(null);
    if (pos + 1 >= session.length) finish();
    else setPos(pos + 1);
  }, [pos, session.length, finish]);

  const submit = useCallback(
    (given: string) => {
      if (!question || current || phase !== 'run') return;
      const res = question.type === 'mc' ? { correct: given === question.answer, typo: false } : checkAnswer(given, question.answer);
      const a: Answered = { q: question, given, correct: res.correct, typo: res.typo };
      const nextStreak = res.correct ? streak + 1 : 0;
      setStreak(nextStreak);
      setBestStreak((b) => Math.max(b, nextStreak));
      setAnswers((xs) => [...xs, a]);
      saveStats(recordAnswer(loadStats(), question.factId, res.correct, nextStreak));
      if (runMode === 'mock') advance(); // exam conditions: no feedback until the end
      else setCurrent(a);
    },
    [question, current, phase, streak, runMode, advance]
  );

  // Keyboard: 1–9 picks a choice.
  useEffect(() => {
    if (phase !== 'run') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!current && question?.type === 'mc' && /^[1-9]$/.test(e.key)) {
        const c = question.choices?.[Number(e.key) - 1];
        if (c !== undefined) submit(c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, current, question, submit]);

  if (needsEvent && phase === 'setup')
    return (
      <div className="card">
        <h1>Quiz</h1>
        <p>Choose the contest event to study. Questions and wrong options always come from one event.</p>
        <EventPicker allowAll={false} />
      </div>
    );
  if (!facts.length && !pItems.length) return <div className="card"><h1>Quiz</h1><p>No statements of fact are loaded for this event.</p></div>;

  if (phase === 'setup') {
    const stats = loadStats();
    const mockTotal = mockFacts + mockParts;
    return (
      <div className="card">
        <h1>Quiz{ev ? ` — ${ev.name}` : ''}</h1>
        {factEvents.length > 1 && <EventPicker allowAll={false} compact />}
        <p className="muted small">
          Questions blank a key term or number in a verbatim statement of fact, like the written exam
          {pItems.length > 0 && ', or ask for a part name from the Identification of Parts'}.
          {stats.answered > 0 && ` Lifetime: ${stats.correct}/${stats.answered} correct, best streak ${stats.bestStreak}.`}
        </p>
        <h2>Mode</h2>
        <div className="chips" role="radiogroup" aria-label="Mode">
          {(['mc', 'mock', 'fill'] as Mode[]).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} className={`chip ${mode === m ? 'on' : ''}`} onClick={() => setMode(m)}>
              {m === 'mock' ? `${MODE_LABEL.mock} (${mockTotal})` : MODE_LABEL[m]}
            </button>
          ))}
        </div>
        {mode === 'mock' ? (
          <p className="small">
            {mockFacts} random statements of fact{mockParts ? ` + ${mockParts} Identification of Parts questions` : ''}, {quizConfig.distractorCount + 1} choices each, no feedback until the end,
            scored out of {mockTotal}.{plan.officialMinutes ? ` Official time limit: ${plan.officialMinutes} minutes.` : ' No official time limit.'}
            {ev?.examDetail && <span className="muted"> Exam format: {ev.examDetail}</span>}
          </p>
        ) : (
          <>
            {pItems.length > 0 && (
              <>
                <h2>Questions from</h2>
                <div className="chips" role="radiogroup" aria-label="Question source">
                  {(['facts', 'parts', 'both'] as Source[]).map((s) => (
                    <button key={s} role="radio" aria-checked={source === s} className={`chip ${source === s ? 'on' : ''}`} onClick={() => setSource(s)}>
                      {s === 'facts' ? `Statements (${facts.length})` : s === 'parts' ? `Parts (${pItems.length})` : 'Both'}
                    </button>
                  ))}
                </div>
              </>
            )}
            <h2>Length</h2>
            <div className="chips" role="radiogroup" aria-label="Length">
              {quizConfig.sessionSizes.map((s) => (
                <button key={String(s)} role="radio" aria-checked={size === s} className={`chip ${size === s ? 'on' : ''}`} onClick={() => setSize(s)}>
                  {s === 'all' ? `All (${pool.length})` : s}
                </button>
              ))}
            </div>
            {effectiveSource !== 'parts' && categories.length > 0 && (
              <>
                <h2>Categories</h2>
                <div className="chips">
                  {categories.map((c) => (
                    <button key={c} aria-pressed={cats.includes(c)} className={`chip ${cats.includes(c) ? 'on' : ''}`} onClick={() => setCats((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]))}>
                      {c}
                    </button>
                  ))}
                </div>
              </>
            )}
            {effectiveSource !== 'parts' && blocks.length > 1 && (
              <>
                <h2>Statements</h2>
                <div className="chips">
                  <button aria-pressed={blockSel.length === 0} className={`chip ${blockSel.length === 0 ? 'on' : ''}`} onClick={() => setBlockSel([])}>All</button>
                  {blocks.map((b) => (
                    <button key={b.key} aria-pressed={blockSel.includes(b.key)} className={`chip ${blockSel.includes(b.key) ? 'on' : ''}`} onClick={() => setBlockSel((xs) => (xs.includes(b.key) ? xs.filter((x) => x !== b.key) : [...xs, b.key]))}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
        <TimerControls
          mode={mode === 'mock' ? 'mock' : 'practice'}
          on={timerOn(timer, mode === 'mock' ? 'mock' : 'practice', eventId, plan.officialMinutes)}
          minutes={timerMinutes(timer, eventId, plan.officialMinutes)}
          official={plan.officialMinutes}
          onToggle={(on) => {
            const next = withTimerOn(timer, mode === 'mock' ? 'mock' : 'practice', eventId, on);
            setTimer(next);
            saveTimerSettings(next);
          }}
          onMinutes={(m) => {
            const next = withTimerMinutes(timer, eventId, m);
            setTimer(next);
            saveTimerSettings(next);
          }}
        />
        <div className="actions">
          <button className="primary" onClick={startFromSetup} disabled={mode !== 'mock' && pool.length === 0}>
            Start
          </button>
        </div>
      </div>
    );
  }

  const score = answers.filter((a) => a.correct).length;
  // A mock exam is always scored out of its full length; unanswered questions count as wrong.
  const total = runMode === 'mock' ? session.length : answers.length;

  if (phase === 'done') {
    const review = runMode === 'mock' ? answers : answers.filter((a) => !a.correct);
    const missed = answers.filter((a) => !a.correct).map((a) => session.find((it) => it.id === a.q.factId)).filter((x): x is Item => !!x);
    return (
      <div className="card">
        <h1>{runMode === 'mock' ? `Mock exam result${data.eventName(sessionEvent) ? ` — ${data.eventName(sessionEvent)}` : ''}` : 'Quiz complete'}</h1>
        {timedOut && <p className="warn">Time is up — your answers were submitted automatically.</p>}
        <p className="big-score" data-testid="final-score">
          {score} / {total}
        </p>
        <p className="muted">
          {total ? Math.round((100 * score) / total) : 0}% · best streak {bestStreak}
          {total > answers.length && ` · ${total - answers.length} not answered`}
        </p>
        {review.length > 0 && (
          <>
            <h2>{runMode === 'mock' ? 'Review' : `Missed (${review.length})`}</h2>
            <ol className="review">
              {review.map((a, i) => (
                <ReviewItem key={i} a={a} fact={factsById.get(a.q.factId)} />
              ))}
            </ol>
          </>
        )}
        {runMode === 'mock' && total > answers.length && (
          <p className="small muted">
            Not answered:{' '}
            {session.slice(answers.length).map((it, i) => (
              <span key={it.id}>
                {i > 0 && ', '}
                {it.fact ? <Link to={`/facts/${encodeURIComponent(it.fact.id)}`}>Statement {it.fact.number ?? ''}</Link> : it.part ? <Link to={`/parts/${encodeURIComponent(it.part.table.id)}`}>Part {it.part.table.rows[it.part.row].no}</Link> : null}
              </span>
            ))}
          </p>
        )}
        <div className="actions">
          {missed.length > 0 && <button onClick={() => start(missed, runMode === 'fill' ? 'fill' : 'mc', sessionMinutes(timer, 'practice', sessionEvent, mockPlan(sessionEvent, data.eventInfo(sessionEvent), false).officialMinutes))}>Retry missed ({missed.length})</button>}
          <button className="primary" onClick={() => setPhase('setup')}>New quiz</button>
        </div>
      </div>
    );
  }

  // Running
  const fact = question ? factsById.get(question.factId) : undefined;
  const table = question?.partTableId ? partsById.get(question.partTableId) : undefined;
  return (
    <div className="card quiz">
      <div className="quiz-status">
        <span>
          {runMode === 'mock' ? 'Mock exam · ' : ''}Question {Math.min(pos + 1, session.length)} of {session.length}
        </span>
        {deadline !== null && (
          <span className={`timer ${deadline - now < 60_000 ? 'warn' : ''}`} role="timer" aria-label="Time left">
            ⏱ {fmtTime(deadline - now)}
          </span>
        )}
        {runMode !== 'mock' && (
          <span>
            Score {score}/{answers.length} · Streak {streak}
          </span>
        )}
      </div>
      <progress max={session.length} value={answers.length} aria-label="Progress" />
      {question && (
        <>
          <p className="muted small">
            {question.source === 'part' ? 'Identification of Parts' : fact?.number ? `Statement ${fact.number}` : 'Statement'}
            {question.source === 'cloze' ? ' — fill the blank' : ''}
          </p>
          <Prompt q={question} />
          {question.type === 'mc' ? (
            <div className="choices">
              {question.choices!.map((c, i) => {
                const state = current ? (c === question.answer ? 'right' : c === current.given ? 'wrong' : '') : '';
                return (
                  <button key={c} className={`choice ${state}`} onClick={() => submit(c)} disabled={!!current} data-testid="choice">
                    <span className="key">{i + 1}</span> {c}
                  </button>
                );
              })}
            </div>
          ) : (
            <form
              className="fill"
              onSubmit={(e) => {
                e.preventDefault();
                if (typed.trim()) submit(typed);
              }}
            >
              <input
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={!!current}
                placeholder={question.source === 'part' ? 'Type the part name' : 'Type the missing word or number'}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-label="Your answer"
              />
              <button type="submit" disabled={!!current || !typed.trim()}>Check</button>
            </form>
          )}
          {current && (
            <div className={`feedback ${current.correct ? 'ok' : 'bad'}`} role="status">
              <strong>{current.correct ? (current.typo ? 'Correct (small typo forgiven)' : 'Correct') : 'Not quite'}</strong>
              {!current.correct && (
                <span>
                  {' '}— answer: <b>{question.answer}</b>
                  {current.given && question.type === 'fill' && <> (you typed “{current.given}”)</>}
                </span>
              )}
              {fact && (
                <p className="statement small">
                  {question.source === 'cloze' ? <FilledStatement statement={fact.statement} q={question} /> : fact.statement}
                  {fact.page !== undefined && <span className="muted"> — rule book p. {fact.page}</span>}
                </p>
              )}
              {table && (
                <p className="small">
                  <Link to={`/parts/${encodeURIComponent(table.id)}`}>View the {table.assembly} parts table</Link>
                </p>
              )}
              <button ref={nextRef} className="primary" onClick={advance}>
                {pos + 1 >= session.length ? 'See results' : 'Next'}
              </button>
            </div>
          )}
        </>
      )}
      <div className="actions">
        <button
          className="link"
          onClick={() => {
            if (!answers.length) setPhase('setup');
            else if (runMode !== 'mock' || confirm('Submit the exam now? Unanswered questions count as wrong.')) finish();
          }}
        >
          {answers.length ? (runMode === 'mock' ? 'Submit exam' : 'End quiz') : 'Cancel'}
        </button>
      </div>
    </div>
  );
}

function TimerControls(props: { mode: TimerMode; on: boolean; minutes: number; official: number | null; onToggle: (on: boolean) => void; onMinutes: (m: number) => void }) {
  const { mode, on, minutes, official, onToggle, onMinutes } = props;
  const [draft, setDraft] = useState(String(minutes));
  useEffect(() => setDraft(String(minutes)), [minutes]);
  const [lo, hi] = quizConfig.timerRange;
  const commit = () => {
    const n = Number(draft);
    if (draft.trim() && Number.isFinite(n)) onMinutes(n);
    else setDraft(String(minutes));
  };
  return (
    <fieldset className="timer-controls">
      <legend>Timer</legend>
      <label className="switch">
        <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} data-testid="timer-toggle" />{' '}
        {mode === 'mock' ? 'Time the mock exam' : 'Time this practice session'}
      </label>
      {on && (
        <label className="minutes">
          <input
            type="number"
            inputMode="numeric"
            min={lo}
            max={hi}
            step={1}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              // Save valid values right away so Start always uses what is shown.
              const n = Number(e.target.value);
              if (e.target.value.trim() && Number.isInteger(n) && n >= lo && n <= hi) onMinutes(n);
            }}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            aria-label="Timer length in minutes"
            data-testid="timer-minutes"
          />{' '}
          minutes
          <span className="muted small">
            {' '}
            ({official ? `official: ${official} min` : `no official limit; default ${quizConfig.defaultTimerMinutes} min`}
            {(official ?? quizConfig.defaultTimerMinutes) !== minutes && (
              <>
                {' · '}
                <button type="button" className="link" onClick={() => onMinutes(official ?? quizConfig.defaultTimerMinutes)}>reset</button>
              </>
            )}
            )
          </span>
        </label>
      )}
      <p className="muted small">Answers are submitted automatically when time runs out. Saved on this device{mode === 'mock' ? ' for mock exams' : ' for practice'}; the length is shared per event.</p>
    </fieldset>
  );
}

/** The verbatim statement with the blanked text marked, using the exact blank positions. */
function FilledStatement({ statement, q }: { statement: string; q: Question }) {
  const out: ReactNode[] = [];
  let pos = 0;
  q.segments.forEach((seg, i) => {
    out.push(<span key={`s${i}`}>{seg}</span>);
    pos += seg.length;
    if (i < q.segments.length - 1) {
      const len = q.answer.length;
      out.push(<mark key={`m${i}`}>{statement.slice(pos, pos + len)}</mark>);
      pos += len;
    }
  });
  return <>{out}</>;
}

function ReviewItem({ a, fact }: { a: Answered; fact?: Fact }) {
  return (
    <li className={a.correct ? 'ok' : 'bad'}>
      <Prompt q={a.q} />
      <p className="small">
        {a.correct ? '✓' : '✗'} Your answer: <b>{a.given || '—'}</b>
        {!a.correct && (
          <>
            {' '}· Correct: <b>{a.q.answer}</b>
          </>
        )}
      </p>
      {fact && (
        <p className="small muted">
          <Link to={`/facts/${encodeURIComponent(fact.id)}`}>{fact.number ? `Statement ${fact.number}` : 'Statement'}</Link>: {fact.statement}
        </p>
      )}
      {a.q.partTableId && (
        <p className="small muted">
          <Link to={`/parts/${encodeURIComponent(a.q.partTableId)}`}>Parts table</Link>
        </p>
      )}
    </li>
  );
}
