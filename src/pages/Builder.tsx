import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { applyXLabel, KIND_DEFS, makeElement, type PaletteItem } from '../builder/catalog';
import { getClientId, isSignedIn, loadDriveMap, saveDriveMap, setClientId, signIn, syncAll, trashRemote, uploadProblem, DRIVE_FOLDER, type DriveMap } from '../builder/drive';
import { hazards } from '../builder/extents';
import { buildTopo, cellRect, makeGeo, snap } from '../builder/geometry';
import { editLayout, openingName, openingState, type LayoutOp } from '../builder/layoutEdit';
import { makeBoard } from '../builder/graph';
import { blankProblem, newId, sideDepth, type El, type Problem } from '../builder/model';
import { BUILT_IN, loadNumbering, normalizeNumbering, saveNumbering, type PillarNumbering } from '../builder/pillars';
import { SAMPLES } from '../builder/samples';
import { designChecks, solve } from '../builder/solve';
import { downloadProblem, loadCurrentId, loadProblems, readProblemFile, saveCurrentId, saveProblems } from '../builder/storage';
import { SelectField } from '../components/SelectField';
import { mapMargins, MapView, type Overlays, type Tool } from '../builder/ui/MapView';
import { CableRing, OpeningRing, RadialMenu, type CablePick, type RadialAction } from '../builder/ui/RadialMenu';
import { ProblemPicker } from '../builder/ui/ProblemPicker';
import { XLabelPicker } from '../builder/ui/XLabelPicker';
import { usePanZoom } from '../builder/ui/panZoom';
import { Checks, ElementList, Inspector, LayoutBar, NumberingPanel, Palette, ProblemPanel, Section, type LayoutBarOp } from '../builder/ui/panels';
import { applyScenario, emptyScenario, SolvePanel, VentPanel, type Scenario } from '../builder/ui/solvePanels';
import { airflow, ventFindings } from '../builder/vent';

type Tab = 'build' | 'solve' | 'vent';

/** Close the <details> drop-down a menu item sits in. */
const closeMenu = (e: { currentTarget: Element }) => {
  const d = e.currentTarget.closest('details');
  if (d) d.open = false;
};
const HISTORY = 80;

function initialProblems(): { list: Problem[]; current: string } {
  // First visit: start on a blank map. The sample problems stay one click away in the Samples menu.
  let list = loadProblems();
  if (!list.length) list = [blankProblem('New problem')];
  const cur = loadCurrentId();
  const current = list.find((p) => p.id === cur)?.id ?? list[0].id;
  return { list, current };
}

export default function Builder() {
  const init = useMemo(initialProblems, []);
  const [problems, setProblems] = useState<Problem[]>(init.list);
  const [currentId, setCurrentId] = useState(init.current);
  const [past, setPast] = useState<Problem[]>([]);
  const [future, setFuture] = useState<Problem[]>([]);
  const [tab, setTab] = useState<Tab>('build');
  const [tool, setTool] = useState<Tool>({ type: 'select' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Element whose placement options ring is open on the map. */
  const [radialId, setRadialId] = useState<string | null>(null);
  /** X placard whose label picker is open beside it. */
  const [labelFor, setLabelFor] = useState<string | null>(null);
  /** Google Drive: which problems have a file there, and what the last sync said. */
  const [driveMap, setDriveMap] = useState<DriveMap>(() => loadDriveMap());
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveOn, setDriveOn] = useState(false);
  const [driveNote, setDriveNote] = useState<string | null>(null);
  /** `updated` of the copy last written to Drive, per problem id (to skip unchanged uploads). */
  const driveSent = useRef<Record<string, string>>({});
  const [zoom, setZoom] = useState(3);
  const [showLabels, setShowLabels] = useState(true);
  const [showExtents, setShowExtents] = useState(true);
  const [stepIdx, setStepIdx] = useState<number | null>(null);
  const [scenario, setScenario] = useState<Scenario>(emptyScenario());
  const [printMode, setPrintMode] = useState<'blank' | 'key' | null>(null);
  const [printContest, setPrintContest] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const numberingInput = useRef<HTMLInputElement>(null);
  /** Opening whose layout ring is open (layout tool). */
  const [activeCell, setActiveCell] = useState<{ cx: number; cy: number } | null>(null);
  const [numbering, setNumberingState] = useState<PillarNumbering>(() => loadNumbering());
  const numberingIsDefault = JSON.stringify(numbering) === JSON.stringify(BUILT_IN);
  const setNumbering = (n: PillarNumbering | null) => {
    setNumberingState(n ?? BUILT_IN);
    saveNumbering(n && JSON.stringify(n) !== JSON.stringify(BUILT_IN) ? n : null);
  };

  const problem = problems.find((p) => p.id === currentId) ?? problems[0];
  const topo = useMemo(() => buildTopo(makeGeo(problem.layout)), [problem.layout]);

  // Autosave (debounced).
  useEffect(() => {
    const t = setTimeout(() => {
      setSaveOk(saveProblems(problems));
      saveCurrentId(currentId);
    }, 400);
    return () => clearTimeout(t);
  }, [problems, currentId]);

  const pz = usePanZoom(scroller, zoom, setZoom);
  const panZoom = useRef(pz);
  panZoom.current = pz;

  const fit = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const g = makeGeo(problem.layout);
    const M = mapMargins(problem.layout);
    const vbW = g.width + M.l + M.r;
    const vbH = g.height + M.t + M.b;
    const z = Math.min((el.clientWidth - 4) / vbW, Math.max(320, el.clientHeight - 4) / vbH);
    panZoom.current.zoomCentered(Math.max(0.6, Math.min(12, z)));
  }, [problem.layout]);

  // Wide screens: the map pane fills the window below the toolbars, so Fit shows the whole map on screen.
  useLayoutEffect(() => {
    const size = () => {
      const el = scroller.current;
      if (!el) return;
      if (window.innerWidth < 1000) return void el.style.removeProperty('height');
      const top = el.getBoundingClientRect().top + window.scrollY;
      el.style.height = `${Math.round(Math.max(360, Math.min(window.innerHeight - top - 12, window.innerHeight - 90)))}px`;
    };
    size();
    window.addEventListener('resize', size);
    return () => window.removeEventListener('resize', size);
  }, [tool.type, tab]);

  // Fit the map when a problem is opened (not on every edit).
  const fitRef = useRef(fit);
  fitRef.current = fit;
  useEffect(() => fitRef.current(), [currentId]);

  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage((x) => (x === m ? null : x)), 4000);
  };

  const update = useCallback(
    (fn: (p: Problem) => Problem) => {
      const next = { ...fn(problem), updated: new Date().toISOString() };
      setPast((h) => [...h.slice(-HISTORY), problem]);
      setFuture([]);
      setProblems((list) => list.map((p) => (p.id === next.id ? next : p)));
      setScenario(emptyScenario());
    },
    [problem]
  );

  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast(past.slice(0, -1));
    setFuture([problem, ...future]);
    setProblems((list) => list.map((p) => (p.id === currentId ? prev : p)));
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture(future.slice(1));
    setPast([...past, problem]);
    setProblems((list) => list.map((p) => (p.id === currentId ? next : p)));
  };

  const switchTo = (id: string) => {
    setCurrentId(id);
    setLabelFor(null);
    setRadialId(null);
    setPast([]);
    setFuture([]);
    setSelectedId(null);
    setStepIdx(null);
    setScenario(emptyScenario());
    setTool({ type: 'select' });
  };

  const addProblem = (p: Problem) => {
    setProblems((list) => [...list.filter((x) => x.id !== p.id), p]);
    switchTo(p.id);
  };

  const selected = problem.elements.find((e) => e.id === selectedId) ?? null;
  const patchEl = (id: string, patch: Partial<El>) => update((p) => ({ ...p, elements: p.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const deleteEl = (id: string) => {
    update((p) => ({ ...p, elements: p.elements.filter((e) => e.id !== id) }));
    setSelectedId(null);
  };
  const duplicateEl = (el: El) => {
    const kind = KIND_DEFS[el.kind];
    const s = snap(topo, el.x + 8, el.y, kind.place) ?? snap(topo, el.x, el.y + 8, kind.place);
    const copy = { ...el, id: newId(), x: s?.x ?? el.x, y: s?.y ?? el.y };
    update((p) => ({ ...p, elements: [...p.elements, copy] }));
    setSelectedId(copy.id);
    return copy;
  };

  const place = (x: number, y: number, keep: boolean) => {
    if (tool.type !== 'place') return;
    const s = snap(topo, x, y, KIND_DEFS[tool.kind].place);
    if (!s) {
      flash('Click inside an entry, crosscut or intersection.');
      return;
    }
    const el = makeElement({ kind: tool.kind, sub: tool.sub }, s.x, s.y, newId());
    if (el.kind === 'gas') el.text = '';
    update((p) => ({ ...p, elements: [...p.elements, el] }));
    setSelectedId(el.id);
    if (el.kind === 'x' && el.sub === 'cable') {
      // Cable: the path starts at the placard; each click adds a point, Enter (or End on the ring) finishes.
      setRadialId(null);
      setTool({ type: 'cable', id: el.id });
      return;
    }
    if (el.kind === 'x' && !tool.sub) {
      // X placard: pick its label from the list beside it.
      setRadialId(null);
      setLabelFor(el.id);
      setTool({ type: 'select' });
      return;
    }
    setRadialId(el.id);
    if (!keep) setTool({ type: 'select' });
  };

  // ------------------------------------------------------------ cable path drawing

  const cableEl = tool.type === 'cable' ? problem.elements.find((e) => e.id === tool.id) ?? null : null;
  const addCablePoint = (x: number, y: number) => {
    if (!cableEl) return;
    const s = snap(topo, x, y, 'point');
    if (!s) return flash('Click inside an entry, crosscut or intersection.');
    patchEl(cableEl.id, { path: [...(cableEl.path ?? []), { x: s.x, y: s.y }] });
  };
  const cablePick = (pick: CablePick) => {
    if (!cableEl) return;
    if (pick === 'undo') patchEl(cableEl.id, { path: (cableEl.path ?? []).slice(0, -1) });
    else if (pick === 'cancel') patchEl(cableEl.id, { path: [] });
    else {
      setTool({ type: 'select' });
      setSelectedId(cableEl.id);
      setRadialId(cableEl.id);
    }
  };
  const shiftDown = useRef(false);

  // ------------------------------------------------------------ layout editing

  const layoutOp = (op: LayoutOp) => {
    const r = editLayout(problem, op);
    if (r.refused) return flash(r.refused);
    if (r.lost.length) {
      const names = [...new Set(r.lost.map((e) => KIND_DEFS[e.kind].name.toLowerCase()))].join(', ');
      if (!window.confirm(`This removes ${r.lost.length} placed item${r.lost.length > 1 ? 's' : ''} (${names}) in the part of the map being taken away. Continue?`)) return;
    }
    update(() => r.problem);
    if (r.lost.some((e) => e.id === selectedId)) setSelectedId(null);
    setActiveCell(null);
  };
  const setLayoutTool = (on: boolean) => {
    setTool(on ? { type: 'layout' } : { type: 'select' });
    setActiveCell(null);
    if (on) {
      setSelectedId(null);
      setRadialId(null);
    }
  };
  const onLayoutBar = (op: LayoutBarOp) => (op.type === 'done' ? setLayoutTool(false) : layoutOp(op));

  const importNumbering = async (f: File | undefined) => {
    if (!f) return;
    try {
      if (f.size > 100_000) throw new Error('That file is too large to be a pillar numbering file.');
      const n = normalizeNumbering(JSON.parse(await f.text()));
      setNumbering(n);
      flash(`Pillar numbering: ${n.name}.`);
    } catch (e) {
      flash(e instanceof SyntaxError ? 'That file is not JSON.' : (e as Error).message);
    }
  };
  const exportNumbering = () => {
    const blob = new Blob([JSON.stringify(numbering, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pillar-numbering.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Keyboard shortcuts on the map.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      shiftDown.current = e.shiftKey;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (tool.type === 'cable') {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          return cablePick('end');
        }
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          return cablePick('undo');
        }
      }
      if (e.key === 'Escape') {
        if (labelFor) {
          setLabelFor(null);
          return;
        }
        if (activeCell) {
          setActiveCell(null);
          return;
        }
        if (radialId) {
          setRadialId(null);
          return;
        }
        setTool({ type: 'select' });
        setSelectedId(null);
        return;
      }
      if (tab !== 'build' || !selected) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteEl(selected.id);
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const d = e.shiftKey ? 5 : 1;
        const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
        const dy = e.key === 'ArrowUp' ? d : e.key === 'ArrowDown' ? -d : 0;
        const s = snap(topo, selected.x + dx, selected.y + dy, KIND_DEFS[selected.kind].place);
        if (s) patchEl(selected.id, { x: s.x, y: s.y });
      } else if (e.key.toLowerCase() === 'r') {
        if (selected.kind === 'diagonal') patchEl(selected.id, { diag: selected.diag === '\\' ? '/' : '\\' });
        else if (selected.dir !== undefined) patchEl(selected.id, { dir: ((selected.dir ?? 0) + 45) % 360 });
      }
    };
    const onUp = (e: KeyboardEvent) => (shiftDown.current = e.shiftKey);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onUp);
    };
  });

  // ------------------------------------------------------------ placement options ring

  const radialEl = tab === 'build' && radialId && radialId === selectedId ? selected : null;
  const radialAction = (a: RadialAction) => {
    if (!selected) return;
    if (a === 'delete') deleteEl(selected.id);
    else if (a === 'duplicate') setRadialId(duplicateEl(selected).id);
    else if (a === 'label') {
      setRadialId(null);
      setLabelFor(selected.id);
    } else if (a === 'path') {
      setRadialId(null);
      if (selected.path?.length) patchEl(selected.id, { path: [] });
      setTool({ type: 'cable', id: selected.id });
    }
    else {
      setRadialId(null);
      // Edit: jump to the first field in the inspector (gas readings, placard wording, …).
      if (a === 'edit')
        setTimeout(() => {
          const insp = document.querySelector('.inspector');
          const f = insp?.querySelector<HTMLElement>(selected.kind === 'gas' ? 'input[type=number]' : 'textarea, input, select');
          insp?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          f?.focus();
        }, 0);
    }
  };
  const stage = (() => {
    const g = makeGeo(problem.layout);
    const M = mapMargins(problem.layout);
    const vbW = g.width + M.l + M.r;
    const vbH = g.height + M.t + M.b;
    const w = Math.round(vbW * zoom);
    const h = Math.round(vbH * zoom);
    return { w, h, px: (x: number) => ((x + M.l) * w) / vbW, py: (y: number) => ((g.height - y + M.t) * h) / vbH };
  })();

  // ------------------------------------------------------------ analysis

  const buildBoard = useMemo(() => (tab === 'build' ? makeBoard(problem) : null), [problem, tab]);
  const buildHazards = useMemo(() => (buildBoard && showExtents ? hazards(buildBoard) : undefined), [buildBoard, showExtents]);
  const buildChecks = useMemo(() => (buildBoard ? designChecks(problem, buildBoard) : []), [buildBoard, problem]);
  const sol = useMemo(() => (tab === 'build' ? null : solve(problem)), [problem, tab]);

  const ventBase = useMemo(() => (tab === 'vent' && sol ? airflow(sol.board) : null), [tab, sol]);
  const ventScenario = useMemo(() => {
    if (tab !== 'vent' || !sol) return null;
    const els = applyScenario(problem, scenario);
    const board = makeBoard(problem, els);
    const af = airflow(board);
    const extinguished = new Set([...sol.plan.changed].filter(([, w]) => w === 'extinguished').map(([id]) => id));
    const removedPersons = new Set([...sol.plan.changed].filter(([, w]) => w === 'taken to the FAB').map(([id]) => id));
    const findings = ventFindings(board, af, sol.plan.hazards, {
      explored: sol.plan.explored,
      seen: sol.plan.seen,
      unaccounted: Math.max(0, problem.missing - sol.plan.personsFound),
      extinguished,
      removedPersons
    });
    return { af, findings };
  }, [tab, sol, problem, scenario]);

  const overlays: Overlays = {};
  if (tab === 'build') overlays.hazards = buildHazards;
  if (tab === 'solve' && sol) {
    const steps = sol.plan.steps;
    const upto = stepIdx ?? steps.length - 1;
    if (showExtents) overlays.hazards = sol.plan.hazards;
    if (stepIdx !== null) {
      const vis = new Set([...sol.plan.found].filter(([, i]) => i <= upto).map(([id]) => id));
      overlays.visible = vis;
      if (showExtents) overlays.hazards = sol.plan.hazards.filter((h) => vis.has(h.el.id));
      // Explored area so far: intersections reached and openings seen up to this step.
      const ex = new Set<string>();
      for (const n of topo.nodes.values()) if (n.fab) ex.add(n.id);
      steps.slice(0, upto + 1).forEach((s) => s.route.forEach((r) => ex.add(r.split('#')[0])));
      overlays.explored = ex;
      overlays.seen = steps[upto].seen;
      const st = steps[upto];
      overlays.route = st.route.map((r) => topo.nodes.get(r.split('#')[0])).filter((n): n is NonNullable<typeof n> => !!n).map((n) => ({ x: n.x, y: n.y }));
    } else overlays.seen = sol.plan.seen;
    overlays.stops = steps
      .slice(0, upto + 1)
      .filter((s) => s.n && s.at)
      .map((s) => {
        const n = topo.nodes.get(s.at!.split('#')[0])!;
        return { n: s.n!, x: n.x, y: n.y, current: stepIdx !== null && s === steps[upto] };
      });
  }
  if (tab === 'vent' && ventScenario) {
    overlays.flow = ventScenario.af.flow;
    if (showExtents && sol) overlays.hazards = sol.plan.hazards;
    overlays.faded = new Set(scenario.removed);
    overlays.extras = scenario.added;
  }

  const ventToggle = (id: string) => {
    const el = problem.elements.find((e) => e.id === id) ?? scenario.added.find((e) => e.id === id);
    if (!el) return;
    if (scenario.added.some((e) => e.id === id)) {
      setScenario({ ...scenario, added: scenario.added.filter((e) => e.id !== id) });
      return;
    }
    if (el.kind === 'door') {
      const cur = { ...el, ...(scenario.overrides[id] ?? {}) };
      setScenario({ ...scenario, overrides: { ...scenario.overrides, [id]: { ...(scenario.overrides[id] ?? {}), open: !cur.open } } });
    } else if (['perm-stopping', 'temp-stopping', 'seal', 'barricade', 'diagonal', 'fire', 'overcast'].includes(el.kind) || (el.kind === 'caved' && el.airtight) || (el.kind === 'water' && el.roofed)) {
      setScenario({ ...scenario, removed: scenario.removed.includes(id) ? scenario.removed.filter((x) => x !== id) : [...scenario.removed, id] });
    } else flash('Pick a stopping, door, seal, barricade, diagonal or fire.');
  };
  const ventBuild = (x: number, y: number) => {
    const s = snap(topo, x, y, 'across');
    if (!s) return flash('Click an entry or crosscut.');
    const near = scenario.added.find((e) => Math.hypot(e.x - s.x, e.y - s.y) < 6);
    if (near) setScenario({ ...scenario, added: scenario.added.filter((e) => e !== near) });
    else setScenario({ ...scenario, added: [...scenario.added, { ...makeElement({ kind: 'temp-stopping' }, s.x, s.y, newId('w')), text: 'TEMPORARY STOPPING (built)' }] });
  };

  // ------------------------------------------------------------ X placard label

  const labelEl = tab === 'build' && labelFor ? problem.elements.find((e) => e.id === labelFor && e.kind === 'x') ?? null : null;
  const pickLabel = (patch: Partial<El>) => {
    if (!labelEl) return;
    patchEl(labelEl.id, patch);
    setLabelFor(null);
    setSelectedId(labelEl.id);
    if (patch.sub === 'cable' && labelEl.sub !== 'cable' && !labelEl.path?.length) setTool({ type: 'cable', id: labelEl.id });
    else setRadialId(labelEl.id);
  };

  // ------------------------------------------------------------ Google Drive

  const driveIds = useMemo(() => new Set(Object.keys(driveMap.files)), [driveMap]);
  const driveRun = async (what: string, fn: () => Promise<string | void>) => {
    if (driveBusy) return;
    setDriveBusy(true);
    setDriveNote(`${what}…`);
    try {
      const note = await fn();
      setDriveOn(isSignedIn());
      setDriveNote(note || null);
    } catch (e) {
      setDriveOn(isSignedIn());
      setDriveNote((e as Error).message);
    } finally {
      setDriveBusy(false);
    }
  };
  const askClientId = () => {
    const id = window.prompt(
      'Paste the Google OAuth client ID for this app (Google Cloud console → APIs & Services → Credentials → OAuth 2.0 Client IDs, type "Web application"). It is kept on this device only.',
      getClientId()
    );
    if (id === null) return false;
    setClientId(id);
    return !!id.trim();
  };
  const driveSync = () =>
    driveRun('Syncing with Google Drive', async () => {
      if (!getClientId() && !askClientId()) return 'Drive not connected: no client ID.';
      await signIn(true);
      const r = await syncAll(problems, driveMap);
      setProblems(r.list);
      setDriveMap(r.map);
      for (const p of r.list) if (r.map.files[p.id]) driveSent.current[p.id] = p.updated;
      return `Synced with “${DRIVE_FOLDER}”: ${r.list.length} problems, ${r.uploaded} uploaded, ${r.downloaded} from Drive.`;
    });
  /** Write one problem to Drive now (used by Save, and by the auto-save while Drive is connected). */
  const driveSave = useCallback(
    async (p: Problem, map: DriveMap) => {
      const folderId = map.folderId ?? (await syncAll([], map)).map.folderId!;
      const fileId = await uploadProblem(p, folderId, map.files[p.id]);
      const next = { folderId, files: { ...map.files, [p.id]: fileId } };
      saveDriveMap(next);
      setDriveMap(next);
      driveSent.current[p.id] = p.updated;
      return next;
    },
    []
  );
  // While Drive is connected, each edited problem is written to Drive a few seconds after the last change.
  useEffect(() => {
    if (!driveOn || driveBusy || !isSignedIn()) return;
    const dirty = problems.filter((p) => driveMap.files[p.id] && driveSent.current[p.id] !== p.updated);
    if (!dirty.length) return;
    const t = setTimeout(async () => {
      let map = driveMap;
      try {
        for (const p of dirty) map = await driveSave(p, map);
        setDriveNote(`Saved to Drive ${new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`);
      } catch (e) {
        setDriveNote((e as Error).message);
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [problems, driveOn, driveBusy, driveMap, driveSave]);

  /** Name the problem (asking if it still has the default name) and save it to Drive. */
  const saveNamed = () => {
    let title = problem.title;
    if (/^(new problem|untitled problem)$/i.test(title.trim()) || !title.trim()) {
      const t = window.prompt('Name this problem:', '');
      if (!t?.trim()) return;
      title = t.trim().slice(0, 120);
      update((p) => ({ ...p, title }));
    }
    const p = { ...problem, title, updated: new Date().toISOString() };
    driveRun('Saving to Google Drive', async () => {
      if (!getClientId() && !askClientId()) return 'Saved on this device. Set up Drive to save it there too.';
      await signIn(true);
      await driveSave(p, driveMap);
      return `Saved “${title}” to “${DRIVE_FOLDER}”.`;
    });
  };
  const newNamed = () => {
    const t = window.prompt('Name for the new problem:', '');
    if (t === null) return;
    addProblem(blankProblem(t.trim().slice(0, 120) || 'New problem'));
  };

  // ------------------------------------------------------------ problems menu

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const p = await readProblemFile(f);
      if (problems.some((x) => x.id === p.id)) p.id = newId('p');
      addProblem(p);
      flash(`Imported “${p.title}”.`);
    } catch (e) {
      flash((e as Error).message);
    }
  };

  const doPrint = (mode: 'blank' | 'key', contestScale = false) => {
    setPrintMode(mode);
    setPrintContest(contestScale);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintMode(null), 500);
    }, 150);
  };

  const sample = SAMPLES.find((s) => s.id === problem.id);
  const mapTool: Tool = tab === 'vent' ? (tool.type === 'vent-build' || tool.type === 'vent-toggle' ? tool : { type: 'select' }) : tab === 'solve' ? { type: 'select' } : tool;
  // The blank map shows only what A Card 5B puts on every map: objects in the FAB and air shafts.
  const blankForPrint = useMemo(() => {
    if (printMode !== 'blank') return null;
    const b = makeBoard(problem);
    const fab = (id: string) => !!b.topo.nodes.get(id)?.fab;
    const keep = (e: El) => {
      const q = b.placed.get(e.id);
      if (e.preMapped || (e.kind === 'x' && e.sub === 'shaft')) return true;
      if (!q) return false;
      if (q.loc.type === 'node') return fab(q.loc.node);
      if (q.loc.type === 'edge') {
        const ed = b.topo.edges.get(q.loc.edge)!;
        return fab(ed.a) && fab(ed.b);
      }
      return false;
    };
    return { ...problem, elements: problem.elements.filter(keep) };
  }, [printMode, problem]);
  const keySol = printMode === 'key' ? sol ?? solve(problem) : null;

  return (
    <div className="builder">
      <div className="builder-top">
        <h1 className="sr-only">Mine rescue problem builder</h1>
        <ProblemPicker problems={problems} currentId={currentId} inDrive={driveIds} onOpen={switchTo} />
        <div className="top-actions">
          <button type="button" onClick={newNamed} title="Start a new problem on a blank map and name it">
            New
          </button>
          <button type="button" onClick={saveNamed} disabled={driveBusy} title={`Name this problem and save it to the Google Drive folder “${DRIVE_FOLDER}”`}>
            Save
          </button>
          <details className="menu">
            <summary className="button" title="Google Drive">
              Drive{driveOn ? ' ✓' : ''}
            </summary>
            <div className="menu-pop">
              <button type="button" disabled={driveBusy} onClick={(e) => (closeMenu(e), driveSync())}>
                <strong>{driveOn ? 'Sync now' : 'Connect and sync'}</strong>
                <span className="small muted">Uploads the problems on this device to “{DRIVE_FOLDER}” and brings in the ones already there (newer copy wins)</span>
              </button>
              <button type="button" onClick={(e) => (closeMenu(e), askClientId())}>
                <strong>Google client ID…</strong>
                <span className="small muted">{getClientId() ? 'Set. Change it here.' : 'Needed once before connecting'}</span>
              </button>
            </div>
          </details>
          <details className="menu">
            <summary className="button">Samples</summary>
            <div className="menu-pop">
              {SAMPLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={(e) => {
                    closeMenu(e);
                    const fresh = s.make();
                    if (problems.some((p) => p.id === s.id)) fresh.id = newId('p');
                    addProblem(fresh);
                  }}
                >
                  <strong>{s.make().title}</strong>
                  <span className="small muted">{s.blurb}</span>
                </button>
              ))}
            </div>
          </details>
          <button type="button" onClick={() => addProblem({ ...JSON.parse(JSON.stringify(problem)), id: newId('p'), title: `${problem.title} (copy)` })}>
            Duplicate
          </button>
          <button type="button" onClick={() => fileInput.current?.click()}>
            Import
          </button>
          <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(e) => onImport(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
          <button type="button" onClick={() => downloadProblem(problem)}>
            Export
          </button>
          <details className="menu">
            <summary className="button">Print</summary>
            <div className="menu-pop">
              <button type="button" onClick={(e) => (closeMenu(e), doPrint('blank'))}>
                <strong>Blank map — fit to page</strong>
                <span className="small muted">With only FAB objects and air shafts (A Card 5B)</span>
              </button>
              <button type="button" onClick={(e) => (closeMenu(e), doPrint('blank', true))}>
                <strong>Blank map — 1 in = 10 ft</strong>
                <span className="small muted">Contest scale for large-format paper; spans several letter pages</span>
              </button>
              <button type="button" onClick={(e) => (closeMenu(e), doPrint('key'))}>
                <strong>Key map and solution</strong>
                <span className="small muted">Statement, key map, mapping key and team stops</span>
              </button>
            </div>
          </details>
          <button
            type="button"
            className="danger"
            onClick={() => {
              const fileId = driveMap.files[problem.id];
              if (!window.confirm(`Delete “${problem.title}” from this device${fileId ? ' and move its Google Drive copy to the Drive trash' : ''}?`)) return;
              if (fileId) {
                const files = { ...driveMap.files };
                delete files[problem.id];
                const next = { ...driveMap, files };
                setDriveMap(next);
                saveDriveMap(next);
                driveRun('Moving the Drive copy to the trash', async () => {
                  await trashRemote(fileId);
                  return 'Drive copy moved to the Drive trash.';
                });
              }
              const rest = problems.filter((p) => p.id !== problem.id);
              const list = rest.length ? rest : [blankProblem('New problem')];
              setProblems(list);
              switchTo(list[0].id);
            }}
          >
            Delete
          </button>
        </div>
      </div>
      {driveNote && <p className="drive-status muted" role="status">{driveNote}</p>}
      {!saveOk && <p className="warn small">This browser is not saving problems (storage blocked). Use Export to keep your work.</p>}
      {sample && <p className="small muted">{problem.source}. Edits are saved on this device; open it again from Samples for a fresh copy.</p>}

      <div className="builder-tabs">
        <SelectField
          label="View"
          value={tab}
          onChange={(v) => {
            const next = v as Tab;
            setTab(next);
            setTool({ type: 'select' });
            if (next !== 'build') setSelectedId(null);
          }}
          options={[
            { value: 'build', label: 'Build' },
            { value: 'solve', label: 'Solve' },
            { value: 'vent', label: 'Ventilation' }
          ]}
        />
        <span className="spacer" />
        <div className="view-ctl">
          <span className="map-hint">Scroll to zoom · drag to pan</span>
          <button type="button" onClick={() => pz.zoomBy(1 / 1.25)} aria-label="Zoom out">
            −
          </button>
          <button type="button" onClick={() => pz.zoomBy(1.25)} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={fit}>
            Fit
          </button>
          <label className="field check">
            <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /> <span>Text</span>
          </label>
          <label className="field check">
            <input type="checkbox" checked={showExtents} onChange={(e) => setShowExtents(e.target.checked)} /> <span>Gas/smoke extent</span>
          </label>
          {tab === 'build' && (
            <>
              <button type="button" className={tool.type === 'layout' ? 'primary' : ''} onClick={() => setLayoutTool(tool.type !== 'layout')} aria-pressed={tool.type === 'layout'} title="Add or remove entries and crosscuts, change sizes, set openings mined or not">
                Edit layout
              </button>
              <button type="button" onClick={undo} disabled={!past.length} aria-label="Undo" title="Undo (Ctrl+Z)">
                ↶
              </button>
              <button type="button" onClick={redo} disabled={!future.length} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
                ↷
              </button>
            </>
          )}
        </div>
      </div>

      <div className={`builder-grid tab-${tab}`}>
        {tab === 'build' && (
          <aside className="b-left">
            <Palette
              active={tool.type === 'place' ? (tool.sub ? `x:${tool.sub}` : tool.kind) : tool.type === 'cable' ? 'x:cable' : null}
              onPick={(it: PaletteItem) => {
                const off = tool.type === 'place' && tool.kind === it.kind && tool.sub === it.sub;
                setTool(off ? { type: 'select' } : { type: 'place', kind: it.kind, sub: it.sub, name: it.name });
                // On phones the palette is below the map: bring the map back into view.
                if (!off && window.innerWidth < 1000) scroller.current?.closest('.b-center')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />
          </aside>
        )}
        <div className="b-center">
          {tool.type === 'place' && tab === 'build' && (
            <p className="tool-hint" role="status">
              Click the map to place: <strong>{tool.name}</strong>. Shift-click to place several · Esc to stop.
            </p>
          )}
          {tool.type === 'cable' && tab === 'build' && (
            <p className="tool-hint" role="status">
              Drawing the cable: click to add points along its path. <strong>Enter</strong> or <strong>End</strong> finishes · Backspace removes the last point.
            </p>
          )}
          {tool.type === 'layout' && tab === 'build' && (
            <>
              <LayoutBar l={problem.layout} onOp={onLayoutBar} />
              <p className="tool-hint" role="status">
                Click an entry, crosscut or stub to set it mined, projected or not mined. Drag the handle at either end of a crosscut outward to pull a side room out (all rooms on a side share one depth), or back to the entry to close it. Placed items stay in their openings when the layout changes.
              </p>
            </>
          )}
          {message && (
            <p className="tool-hint warn" role="alert">
              {message}
            </p>
          )}
          <div className="map-scroll" ref={scroller} {...pz.handlers}>
            <div className="map-stage" style={{ width: stage.w, height: stage.h }}>
              <MapView
                problem={problem}
                zoom={zoom}
                selectedId={selectedId}
                tool={mapTool}
                numbering={numbering}
                activeCell={activeCell && tool.type === 'layout' ? `${activeCell.cx},${activeCell.cy}` : null}
                showLabels={showLabels}
                overlays={overlays}
                editable={tab === 'build'}
                onSelect={(id) => {
                  setSelectedId(id);
                  if (id !== labelFor) setLabelFor(null);
                  if (id !== radialId) setRadialId(null);
                }}
                onElementTap={setRadialId}
                onMove={(id, x, y) => {
                  patchEl(id, { x, y });
                  setRadialId(null);
                }}
                onPlace={(x, y) => place(x, y, shiftDown.current)}
                onCablePoint={addCablePoint}
                onCell={(cx, cy) => setActiveCell({ cx, cy })}
                onRoom={(side, row, depth) => {
                  const l = problem.layout;
                  const open = openingState(l, side === 'left' ? 0 : 2 * l.entries, 2 * row) !== 'solid' && sideDepth(l, side) > 0;
                  // A tap toggles the room (opening it at the side's depth, or the face stub depth if that side has none).
                  const d = depth ?? (open ? 0 : sideDepth(l, side) || l.stubLength);
                  layoutOp({ type: 'room', side, row, depth: d });
                }}
                onElementClick={ventToggle}
                onOpeningClick={ventBuild}
              />
              {activeCell && tool.type === 'layout' && tab === 'build' && (() => {
                const g = makeGeo(problem.layout);
                if (activeCell.cx > 2 * g.E || activeCell.cy > 2 * g.R - 1) return null;
                const rc = cellRect(g, activeCell.cx, activeCell.cy);
                return (
                  <OpeningRing
                    name={openingName(problem.layout, activeCell.cx, activeCell.cy)}
                    state={openingState(problem.layout, activeCell.cx, activeCell.cy)}
                    x={stage.px(rc.x + rc.w / 2)}
                    y={stage.py(rc.y + rc.h / 2)}
                    width={stage.w}
                    height={stage.h}
                    onPick={(pick) => (pick === 'done' ? setActiveCell(null) : layoutOp({ type: 'cell', cx: activeCell.cx, cy: activeCell.cy, state: pick }))}
                  />
                );
              })()}
              {cableEl && tab === 'build' && (() => {
                const last = cableEl.path?.length ? cableEl.path[cableEl.path.length - 1] : cableEl;
                return <CableRing x={stage.px(last.x)} y={stage.py(last.y)} width={stage.w} height={stage.h} points={cableEl.path?.length ?? 0} onPick={cablePick} />;
              })()}
              {labelEl && (
                <XLabelPicker
                  key={labelEl.id}
                  x={stage.px(labelEl.x)}
                  y={stage.py(labelEl.y)}
                  width={stage.w}
                  height={stage.h}
                  current={labelEl.text}
                  onPick={(l) => pickLabel(applyXLabel(l))}
                  onCustom={(text) => pickLabel({ sub: 'other', text })}
                  onClose={() => setLabelFor(null)}
                />
              )}
              {radialEl && !labelEl && tool.type !== 'cable' && (
                <RadialMenu el={radialEl} x={stage.px(radialEl.x)} y={stage.py(radialEl.y)} width={stage.w} height={stage.h} onPatch={(patch) => patchEl(radialEl.id, patch)} onAction={radialAction} />
              )}
            </div>
          </div>
        </div>
        <aside className="b-right">
          {tab === 'build' &&
            (selected ? (
              <Inspector el={selected} topo={topo} onChange={(patch) => patchEl(selected.id, patch)} onDelete={() => deleteEl(selected.id)} onDuplicate={() => duplicateEl(selected)} onClose={() => setSelectedId(null)} />
            ) : (
              <>
                <ProblemPanel
                  p={problem}
                  onChange={(patch) => update((p) => ({ ...p, ...patch }))}
                  onLayout={(patch) => layoutOp({ type: 'set', patch })}
                  layoutTool={tool.type === 'layout'}
                  onLayoutTool={setLayoutTool}
                  numberingPanel={
                    <NumberingPanel n={numbering} isDefault={numberingIsDefault} onChange={setNumbering} onReset={() => setNumbering(null)} onImport={() => numberingInput.current?.click()} onExport={exportNumbering} />
                  }
                />
                <input ref={numberingInput} type="file" accept=".json,application/json" hidden onChange={(e) => importNumbering(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
                <ElementList p={problem} topo={topo} selectedId={selectedId} onSelect={setSelectedId} />
                <Section title="Design checks" count={buildChecks.length} open={buildChecks.some((c) => c.level !== 'info')}>
                  <Checks checks={buildChecks} onSelect={setSelectedId} />
                </Section>
              </>
            ))}
          {tab === 'solve' && sol && (
            <SolvePanel
              sol={sol}
              stepIdx={stepIdx}
              setStepIdx={setStepIdx}
              onSelectEl={(id) => {
                setSelectedId(id);
                const i = sol.plan.found.get(id);
                if (stepIdx !== null && i !== undefined && i > stepIdx) setStepIdx(i);
              }}
            />
          )}
          {tab === 'vent' && ventScenario && ventBase && (
            <VentPanel p={problem} sc={scenario} setSc={setScenario} af={ventScenario.af} base={ventBase} findings={ventScenario.findings} tool={tool.type} setTool={(t) => setTool({ type: t })} />
          )}
        </aside>
      </div>

      {printMode && (
        <div className="print-sheet" aria-hidden="true">
          {printMode === 'key' && keySol && (
            <>
              <h2>{problem.title} — key map</h2>
              {problem.statement && <p className="print-text">{problem.statement}</p>}
              {problem.instructions && (
                <p className="print-text">
                  <strong>Written instructions:</strong> {problem.instructions}
                </p>
              )}
              <p>
                Missing persons: {problem.missing}. {problem.timeLimit ? `Time limit: ${problem.timeLimit} min.` : 'No time limit.'}
              </p>
            </>
          )}
          <MapView problem={printMode === 'blank' && blankForPrint ? blankForPrint : problem} numbering={numbering} zoom={1} selectedId={null} tool={{ type: 'select' }} showLabels printMode={printMode} printScale={printContest ? 10 : null} />
          {printMode === 'key' && keySol && (
            <div className="print-key">
              <h3>Mapping key</h3>
              <ol>
                {keySol.items.map((it) => (
                  <li key={it.el.id}>
                    {it.text} — {it.where} {it.bo ? '(Team + BO)' : '(Team)'}
                  </li>
                ))}
              </ol>
              <h3>Team stops</h3>
              <ol>
                {keySol.plan.steps.map((s, i) => (
                  <li key={i}>{s.n ? `#${s.n} ` : ''}{s.title}</li>
                ))}
              </ol>
              {problem.keyNotes && (
                <>
                  <h3>Key notes</h3>
                  <p className="print-text">{problem.keyNotes}</p>
                </>
              )}
            </div>
          )}
        </div>
      )}
      <p className="small muted builder-foot">
        Symbols follow the MSHA Mine Map Legend (2026 Coal Mine Rescue Rules, pp. 51–55). Problems are saved on this device; Save (or Drive → Sync) also keeps them in your Google Drive folder “{DRIVE_FOLDER}”.
      </p>
    </div>
  );
}
