// Copies the real content from ./content (or CONTENT_DIR) into public/content so Vite serves it and
// the service worker precaches it. Content JSON is copied byte-for-byte; nothing is rewritten.
//
//  - facts.json, rules.json: used if present, non-empty, valid JSON with records; otherwise the bundled
//    SAMPLE files are used and the UI shows a SAMPLE DATA banner.
//  - rules-*.json (other events) and parts.json: copied when present and valid (real content only).
//  - figures/**: downscaled to max 1400 px wide and re-encoded as WebP q75 with sharp (falls back to a
//    plain copy if sharp is unavailable). build-info.json maps original paths to the built files.
//  - sources.md: copied for the About page.
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, statSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '..');
const contentDir = resolve(process.env.CONTENT_DIR ?? join(appDir, 'content'));
const sampleDir = join(appDir, 'src', 'data', 'sample');
const outDir = join(appDir, 'public', 'content');
const FIG_MAX_WIDTH = 1400;
const FIG_QUALITY = 75;

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

/** Count records in an array or in the first array-valued property of a wrapper object. */
function countRecords(json) {
  if (Array.isArray(json)) return json.length;
  if (json && typeof json === 'object') {
    for (const v of Object.values(json)) if (Array.isArray(v)) return v.length;
  }
  return 0;
}

/** Returns { json, reason } for a usable file, or { json: null, reason } otherwise. */
function readUsable(path) {
  if (!existsSync(path)) return { json: null, reason: 'not found' };
  if (statSync(path).size === 0) return { json: null, reason: 'empty file' };
  try {
    const json = JSON.parse(readFileSync(path, 'utf8'));
    const n = countRecords(json);
    return n > 0 ? { json, reason: `${n} top-level records` } : { json: null, reason: 'no records' };
  } catch (e) {
    return { json: null, reason: `invalid JSON (${e.message})` };
  }
}

const info = { generatedAt: new Date().toISOString() };
let factsJson = null;
for (const kind of ['rules', 'facts']) {
  const real = join(contentDir, `${kind}.json`);
  const r = readUsable(real);
  const used = r.json ? 'real' : 'sample';
  copyFileSync(used === 'real' ? real : join(sampleDir, `sample-${kind}.json`), join(outDir, `${kind}.json`));
  info[kind] = { used, reason: r.reason };
  if (kind === 'facts' && r.json) factsJson = r.json;
  const loud = used === 'sample' && !['not found', 'empty file'].includes(r.reason);
  (loud ? console.warn : console.log)(`[copy-content] ${kind}: ${used === 'real' ? `using ${real} (${r.reason})` : `using SAMPLE data (${r.reason})`}`);
}

// Rule books per event. facts.json `events[id].rules_file` says which file belongs to which event.
const eventsMeta = factsJson && typeof factsJson.events === 'object' && factsJson.events ? factsJson.events : {};
const fileToEvent = {};
for (const [id, e] of Object.entries(eventsMeta)) if (e && typeof e.rules_file === 'string') fileToEvent[e.rules_file] = id;
info.ruleFiles = [];
if (info.rules.used === 'real') {
  info.ruleFiles.push({ file: 'rules.json', event: fileToEvent['rules.json'] ?? null });
  const extra = new Set([...Object.keys(fileToEvent), ...readdirSync(contentDir).filter((f) => /^rules-.+\.json$/.test(f))]);
  for (const f of [...extra].filter((f) => f !== 'rules.json').sort()) {
    const r = readUsable(join(contentDir, f));
    if (!r.json) {
      console.warn(`[copy-content] ${f}: skipped (${r.reason})`);
      continue;
    }
    copyFileSync(join(contentDir, f), join(outDir, f));
    info.ruleFiles.push({ file: f, event: fileToEvent[f] ?? (typeof r.json.event === 'string' ? r.json.event : null) });
  }
  console.log(`[copy-content] rule books: ${info.ruleFiles.map((r) => `${r.file}${r.event ? ` (${r.event})` : ''}`).join(', ')}`);
}

// Identification of Parts tables.
info.parts = { used: false };
if (info.rules.used === 'real') {
  const r = readUsable(join(contentDir, 'parts.json'));
  if (r.json) {
    copyFileSync(join(contentDir, 'parts.json'), join(outDir, 'parts.json'));
    info.parts = { used: true, reason: r.reason };
  } else if (r.reason !== 'not found') console.warn(`[copy-content] parts.json: skipped (${r.reason})`);
}

// Figures: downscale + WebP.
info.figures = { count: 0, originalBytes: 0, builtBytes: 0, format: 'none', map: {} };
const figDir = join(contentDir, 'figures');
if (info.rules.used === 'real' && existsSync(figDir)) {
  let sharp = null;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.warn('[copy-content] sharp not available: figures copied unchanged');
  }
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  const images = walk(figDir).filter((p) => /\.(png|jpe?g|webp)$/.test(p));
  for (const src of images) {
    const rel = relative(contentDir, src).split('\\').join('/');
    const before = statSync(src).size;
    let outRel = rel;
    if (sharp) {
      outRel = rel.slice(0, -extname(rel).length) + '.webp';
      mkdirSync(dirname(join(outDir, outRel)), { recursive: true });
      await sharp(src).resize({ width: FIG_MAX_WIDTH, withoutEnlargement: true }).webp({ quality: FIG_QUALITY }).toFile(join(outDir, outRel));
    } else {
      mkdirSync(dirname(join(outDir, outRel)), { recursive: true });
      copyFileSync(src, join(outDir, outRel));
    }
    info.figures.count++;
    info.figures.originalBytes += before;
    info.figures.builtBytes += statSync(join(outDir, outRel)).size;
    info.figures.map[rel] = outRel;
  }
  info.figures.format = sharp ? 'webp' : 'original';
  const mb = (n) => (n / 1048576).toFixed(1);
  console.log(`[copy-content] figures: ${info.figures.count} image(s), ${mb(info.figures.originalBytes)} MB -> ${mb(info.figures.builtBytes)} MB (${info.figures.format})`);
}

const sources = join(contentDir, 'sources.md');
info.sources = info.rules.used === 'real' && existsSync(sources);
if (info.sources) copyFileSync(sources, join(outDir, 'sources.md'));

writeFileSync(join(outDir, 'build-info.json'), JSON.stringify(info, null, 2));
