// EMBERFALL KEEP — the entrypoint (Node 22, standard library only).
//
// The game is plain static files under game/ and four screenshots under
// screenshots/. This program hands them in: it copies both folders from
// beside this file into /output and writes /output/dossier.json, the summary
// the judge reads, with the vendored make.fun library.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The program is deterministic: it reads the same files and writes the same
// bytes on every run, so the grader's two runs match byte for byte. The
// screenshots are taken during the build (scripts/capture-shots.mjs renders
// the game's own code headlessly); this program never launches a browser,
// because the grader's container has no network and no browser in it.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

// Fail fast and loud when the entry is incomplete: a missing game folder or
// a missing index.html is a build error, not a silent empty dossier.
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error(`game/index.html is missing in ${gameDir}; the entry is incomplete`);
}
if (!existsSync(shotsDir) || readdirSync(shotsDir).filter((f) => !f.startsWith('.')).length === 0) {
  throw new Error(`screenshots/ is empty in ${shotsDir}; take the four shots first`);
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
// of game files in all; a path under game/ over 1000 bytes). game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// A short receipt on stdout so the build log shows what was handed in.
const shotNames = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((f) => !f.startsWith('.')).sort()
  : [];
if (shotNames.length > 4) {
  throw new Error(`screenshots/ holds ${shotNames.length} images; the gate allows at most 4`);
}
const shotBytes = shotNames.reduce(
  (sum, f) => sum + statSync(join(out, 'screenshots', f)).size,
  0,
);
console.log(
  `emberfall-keep: game/ + ${shotNames.length} screenshots (${shotBytes} bytes) -> ${out}/dossier.json`,
);
