// Rewrites public/starter-problems/ (the starter problem files kept in the repo) from the sample and contest
// problems in src/builder. Works on Windows, macOS and Linux.
import { spawnSync } from 'node:child_process';

const r = spawnSync('npx', ['vitest', 'run', 'src/builder/starters.test.ts'], { stdio: 'inherit', shell: true, env: { ...process.env, WRITE_STARTERS: '1' } });
process.exit(r.status ?? 1);
