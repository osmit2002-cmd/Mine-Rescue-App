/**
 * Saved problems in a folder on the user's computer: one `<title>.mrs-problem.json` file per saved problem.
 *
 * Chrome and Edge (File System Access API): the user links a folder once; Save writes the problem's file there,
 * the problem list reads every problem file in it, and the link is remembered (the browser asks again for
 * permission after a restart, with one click). Other browsers (Firefox, Safari): Save downloads the file and
 * "Open files…" brings chosen problem files in.
 */
import { normalizeProblem, type Problem } from './model';

const MAP_KEY = 'mrs.builder.folder.v1';
const DB = 'mrs-builder';
const STORE = 'handles';
const HANDLE_KEY = 'problems-folder';

// ------------------------------------------------------------ pure helpers (tested)

/** File name for a problem: its title made safe for Windows, macOS and Linux, plus the problem file extension. */
export function problemFileName(p: Pick<Problem, 'title'>): string {
  const t = p.title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').replace(/[. ]+$/, '').trim().slice(0, 120);
  return `${t || 'Untitled problem'}.mrs-problem.json`;
}

/** A file name for `p` that no other problem's file is using (adds " (2)", " (3)", … before the extension). */
export function uniqueFileName(p: Pick<Problem, 'id' | 'title'>, taken: Record<string, string>): string {
  const base = problemFileName(p);
  const others = new Set(Object.entries(taken).filter(([id]) => id !== p.id).map(([, n]) => n.toLowerCase()));
  if (!others.has(base.toLowerCase())) return base;
  const stem = base.replace(/\.mrs-problem\.json$/, '');
  for (let i = 2; ; i++) {
    const n = `${stem} (${i}).mrs-problem.json`;
    if (!others.has(n.toLowerCase())) return n;
  }
}

/**
 * Bring problems read from files into the list. A problem already in the list is replaced only when the file's
 * copy is newer (by `updated`); new ones are added at the end. Returns the list and how many were added or updated.
 */
export function mergeIn(list: Problem[], incoming: Problem[]): { list: Problem[]; added: number; updated: number } {
  const out = [...list];
  let added = 0;
  let updated = 0;
  for (const p of incoming) {
    const i = out.findIndex((x) => x.id === p.id);
    if (i < 0) {
      out.push(p);
      added++;
    } else if ((Date.parse(p.updated) || 0) > (Date.parse(out[i].updated) || 0)) {
      out[i] = p;
      updated++;
    }
  }
  return { list: out, added, updated };
}

// ------------------------------------------------------------ which problem is in which file (kept on this device)

/** problem id → file name in the linked folder. */
export type FileMap = Record<string, string>;

export function loadFileMap(): FileMap {
  try {
    const m = JSON.parse(localStorage.getItem(MAP_KEY) || '{}');
    return m && typeof m === 'object' && !Array.isArray(m) ? (m as FileMap) : {};
  } catch {
    return {};
  }
}
export function saveFileMap(m: FileMap) {
  try {
    localStorage.setItem(MAP_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------ File System Access API

/** Minimal types for the parts of the File System Access API used here (not in every TS DOM lib). */
interface FileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(d: string): Promise<void>; close(): Promise<void> }>;
}
export interface DirHandle {
  kind: 'directory';
  name: string;
  values(): AsyncIterable<FileHandle | DirHandle>;
  getFileHandle(name: string, o?: { create?: boolean }): Promise<FileHandle>;
  removeEntry(name: string): Promise<void>;
  queryPermission(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(o: { mode: 'readwrite' }): Promise<PermissionState>;
}

/** True where a folder can be linked (Chrome, Edge, Opera on desktop). */
export const canLinkFolder = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onerror = () => resolve(undefined);
      open.onsuccess = () => {
        const tx = open.result.transaction(STORE, mode);
        const r = fn(tx.objectStore(STORE));
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(undefined);
      };
    } catch {
      resolve(undefined);
    }
  });
}

/** The folder linked earlier, if any (permission may still need to be granted again: see ensurePermission). */
export const loadFolder = () => idb<DirHandle>('readonly', (s) => s.get(HANDLE_KEY) as IDBRequest<DirHandle>);
export const forgetFolder = () => idb('readwrite', (s) => s.delete(HANDLE_KEY));

/** Ask the user to choose the problems folder. Null when they cancel. */
export async function pickFolder(): Promise<DirHandle | null> {
  try {
    const d = await (window as unknown as { showDirectoryPicker: (o: object) => Promise<DirHandle> }).showDirectoryPicker({ id: 'mrs-problems', mode: 'readwrite' });
    await idb('readwrite', (s) => s.put(d, HANDLE_KEY));
    return d;
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return null;
    throw e;
  }
}

/** True when the app may read and write the folder; asks (needs a click) when `ask` is set. */
export async function ensurePermission(d: DirHandle, ask: boolean): Promise<boolean> {
  if ((await d.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  return ask && (await d.requestPermission({ mode: 'readwrite' })) === 'granted';
}

/** Every problem file in the folder (top level only), with its file name. Files that are not problems are skipped. */
export async function readFolder(d: DirHandle): Promise<{ name: string; problem: Problem }[]> {
  const out: { name: string; problem: Problem }[] = [];
  for await (const h of d.values()) {
    if (h.kind !== 'file' || !/\.json$/i.test(h.name)) continue;
    try {
      const f = await h.getFile();
      if (f.size > 2_000_000) continue;
      out.push({ name: h.name, problem: normalizeProblem(JSON.parse(await f.text())) });
    } catch {
      /* not a problem file */
    }
  }
  return out;
}

/** Write a problem to the folder under `name`; removes `oldName` when the file was renamed. */
export async function writeToFolder(d: DirHandle, p: Problem, name: string, oldName?: string) {
  const w = await (await d.getFileHandle(name, { create: true })).createWritable();
  await w.write(JSON.stringify(p, null, 2) + '\n');
  await w.close();
  if (oldName && oldName !== name) await d.removeEntry(oldName).catch(() => undefined);
}

export async function removeFromFolder(d: DirHandle, name: string) {
  await d.removeEntry(name).catch(() => undefined);
}

// ------------------------------------------------------------ fallback for other browsers

/** Read problem files the user picked with a file input. Returns the problems and the names that were not problems. */
export async function readPickedFiles(files: FileList | File[]): Promise<{ problems: Problem[]; bad: string[] }> {
  const problems: Problem[] = [];
  const bad: string[] = [];
  for (const f of Array.from(files)) {
    try {
      if (f.size > 2_000_000) throw new Error('too large');
      problems.push(normalizeProblem(JSON.parse(await f.text())));
    } catch {
      bad.push(f.name);
    }
  }
  return { problems, bad };
}
