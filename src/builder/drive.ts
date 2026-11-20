/**
 * Saved problems in Google Drive: one `<title>.mrs-problem.json` file per problem in the folder
 * "Mine Rescue Problems" in the signed-in user's My Drive.
 *
 * Runs entirely in the browser: Google Identity Services gives a short-lived access token and the Drive REST API
 * is called with fetch. It needs an OAuth 2.0 Web client ID (VITE_GOOGLE_CLIENT_ID at build time, or pasted into
 * the app and kept in localStorage). The full `drive` scope is used so the app also sees problem files that were
 * put in the folder by hand or by other tools, not only the ones it created itself.
 */
import { normalizeProblem, type Problem } from './model';

export const DRIVE_FOLDER = 'Mine Rescue Problems';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const CLIENT_KEY = 'mrs.builder.googleClientId';
const MAP_KEY = 'mrs.builder.drive.v1';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

// ------------------------------------------------------------ settings kept on this device

const ls = () => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

export function getClientId(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_GOOGLE_CLIENT_ID;
  return (ls()?.getItem(CLIENT_KEY) || env || '').trim();
}
export function setClientId(id: string) {
  try {
    if (id.trim()) ls()?.setItem(CLIENT_KEY, id.trim());
    else ls()?.removeItem(CLIENT_KEY);
  } catch {
    /* ignore */
  }
}

/** Which Drive file holds which problem (problem id → Drive file id), plus the folder id. */
export interface DriveMap {
  folderId?: string;
  files: Record<string, string>;
}
export function loadDriveMap(): DriveMap {
  try {
    const m = JSON.parse(ls()?.getItem(MAP_KEY) || '{}') as DriveMap;
    return { folderId: typeof m.folderId === 'string' ? m.folderId : undefined, files: m.files && typeof m.files === 'object' ? m.files : {} };
  } catch {
    return { files: {} };
  }
}
export function saveDriveMap(m: DriveMap) {
  try {
    ls()?.setItem(MAP_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------ pure helpers (tested)

/** File name for a problem: its title made safe for Drive, plus the problem file extension. */
export function driveFileName(p: Pick<Problem, 'title'>): string {
  const t = p.title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120);
  return `${t || 'Untitled problem'}.mrs-problem.json`;
}

/**
 * Merge the problems on this device with the ones in Drive. The newer copy (by `updated`) of each problem wins.
 * Returns the merged list (local order first, then problems only in Drive) and the ids that Drive needs a fresh
 * copy of (newer here, or not in Drive yet).
 */
export function mergeProblems(local: Problem[], remote: Problem[]): { list: Problem[]; upload: string[] } {
  const r = new Map(remote.map((p) => [p.id, p]));
  const list: Problem[] = [];
  const upload: string[] = [];
  for (const p of local) {
    const d = r.get(p.id);
    if (!d) upload.push(p.id);
    else if (Date.parse(d.updated) > Date.parse(p.updated)) {
      list.push(d);
      r.delete(p.id);
      continue;
    } else if (Date.parse(p.updated) > Date.parse(d.updated)) upload.push(p.id);
    list.push(p);
    r.delete(p.id);
  }
  for (const d of r.values()) list.push(d);
  return { list, upload };
}

// ------------------------------------------------------------ sign-in

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  requestAccessToken: (o?: { prompt?: string }) => void;
}
interface Gis {
  accounts: { oauth2: { initTokenClient: (o: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { message?: string; type?: string }) => void }) => TokenClient } };
}

let gisLoading: Promise<Gis> | null = null;
function loadGis(): Promise<Gis> {
  const w = window as unknown as { google?: Gis };
  if (w.google?.accounts?.oauth2) return Promise.resolve(w.google);
  if (!gisLoading)
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => (w.google?.accounts?.oauth2 ? resolve(w.google) : reject(new Error('Google sign-in did not load.')));
      s.onerror = () => {
        gisLoading = null;
        reject(new Error('Could not reach Google sign-in. Check the connection.'));
      };
      document.head.appendChild(s);
    });
  return gisLoading;
}

let token: { value: string; expires: number } | null = null;
export const isSignedIn = () => !!token && token.expires > Date.now();
export function signOut() {
  token = null;
}

/** Get an access token, showing Google's sign-in / consent popup if needed. Call from a click handler the first time. */
export async function signIn(interactive = true): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const clientId = getClientId();
  if (!clientId) throw new Error('No Google client ID set. Open the Drive menu and paste the client ID first.');
  const gis = await loadGis();
  return new Promise((resolve, reject) => {
    const client = gis.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (r) => {
        if (!r.access_token) return reject(new Error(r.error_description || r.error || 'Google sign-in was cancelled.'));
        token = { value: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000 };
        resolve(r.access_token);
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'Google sign-in was closed.' : e.message || 'Google sign-in failed.'))
    });
    client.requestAccessToken({ prompt: interactive ? '' : 'none' });
  });
}

// ------------------------------------------------------------ Drive REST

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const t = await signIn(false).catch(() => signIn(true));
  const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${t}` } });
  if (res.status === 401) token = null;
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      msg = ((await res.json()) as { error?: { message?: string } }).error?.message || msg;
    } catch {
      /* not JSON */
    }
    throw new Error(`Google Drive: ${msg}`);
  }
  return res;
}

const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** The problems folder: the remembered one if it still exists, else the first folder with that name, else a new one. */
export async function ensureFolder(map: DriveMap): Promise<string> {
  if (map.folderId) {
    try {
      const f = (await (await call(`${API}/files/${map.folderId}?fields=id,trashed`)).json()) as { trashed?: boolean };
      if (!f.trashed) return map.folderId;
    } catch {
      /* gone: look it up again */
    }
  }
  const query = `name = ${q(DRIVE_FOLDER)} and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const found = (await (await call(`${API}/files?q=${encodeURIComponent(query)}&fields=files(id)&orderBy=createdTime`)).json()) as { files: { id: string }[] };
  if (found.files[0]) return found.files[0].id;
  const made = (await (await call(`${API}/files?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: DRIVE_FOLDER, mimeType: FOLDER_MIME }) })).json()) as { id: string };
  return made.id;
}

export interface RemoteProblem {
  fileId: string;
  problem: Problem;
}

/** Every problem file in the folder (files that are not problems are skipped). */
export async function listRemote(folderId: string): Promise<RemoteProblem[]> {
  const out: RemoteProblem[] = [];
  let page = '';
  do {
    const query = `${q(folderId)} in parents and trashed = false and mimeType != '${FOLDER_MIME}'`;
    const r = (await (await call(`${API}/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name)&pageSize=200${page ? `&pageToken=${page}` : ''}`)).json()) as {
      files: { id: string; name: string }[];
      nextPageToken?: string;
    };
    const batch = await Promise.all(
      r.files
        .filter((f) => /\.json$/i.test(f.name))
        .map(async (f) => {
          try {
            const json = await (await call(`${API}/files/${f.id}?alt=media`)).json();
            return { fileId: f.id, problem: normalizeProblem(json) };
          } catch {
            return null;
          }
        })
    );
    out.push(...batch.filter((x): x is RemoteProblem => !!x));
    page = r.nextPageToken ?? '';
  } while (page);
  return out;
}

/** Create or overwrite the Drive file for a problem. Returns the file id. */
export async function uploadProblem(p: Problem, folderId: string, fileId?: string): Promise<string> {
  const boundary = `mrs${Math.random().toString(36).slice(2)}`;
  const meta = fileId ? { name: driveFileName(p) } : { name: driveFileName(p), parents: [folderId], mimeType: 'application/json' };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(p, null, 2)}\r\n--${boundary}--`;
  const url = fileId ? `${UPLOAD}/files/${fileId}?uploadType=multipart&fields=id` : `${UPLOAD}/files?uploadType=multipart&fields=id`;
  const r = (await (await call(url, { method: fileId ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body })).json()) as { id: string };
  return r.id;
}

/** Move a problem's Drive file to the Drive trash (recoverable there for 30 days). */
export async function trashRemote(fileId: string) {
  await call(`${API}/files/${fileId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
}

/**
 * Full sync: find the folder, read every problem in it, merge with the local list (newer wins) and upload what Drive
 * is missing or has an older copy of. Returns the merged list and the updated map.
 */
export async function syncAll(local: Problem[], map: DriveMap): Promise<{ list: Problem[]; map: DriveMap; uploaded: number; downloaded: number }> {
  const folderId = await ensureFolder(map);
  const remote = await listRemote(folderId);
  const files: Record<string, string> = {};
  for (const r of remote) files[r.problem.id] = r.fileId;
  const { list, upload } = mergeProblems(local, remote.map((r) => r.problem));
  const fromDrive = new Set(remote.map((r) => r.problem));
  const downloaded = list.filter((p) => fromDrive.has(p)).length;
  for (const id of upload) {
    const p = list.find((x) => x.id === id)!;
    files[id] = await uploadProblem(p, folderId, files[id]);
  }
  const next = { folderId, files };
  saveDriveMap(next);
  return { list, map: next, uploaded: upload.length, downloaded };
}
