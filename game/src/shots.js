// Deterministic screenshot scenes for EMBERFALL KEEP.
// One file, one job: build the exact scenes the four screenshots show.
// Each scene is hand-placed, not simulated: a fixed seed, fixed enemy
// positions, a fixed beam angle and fixed HUD numbers, so the same scene
// renders the same way every time main.ts runs. The game never has to be
// played to take these pictures — but everything in them is real game state
// drawn by the real renderer, never a mock-up.
//
// Scenes:
//   cover   — night three, the Hollow King and a dense swarm under the beam.
//   title   — the title screen over a quiet night scene.
//   build   — the daylight build phase, traps placed, shop open.
//   results — the dawn victory screen with a full run of stats.

import { makeEnemy } from './enemies.js';
import { makeTrap } from './traps.js';

function placeTrapAt(state, type, col, row, level) {
  const plot = state.plots.find((p) => p.col === col && p.row === row);
  if (!plot || plot.blocked) return;
  const trap = makeTrap(type, plot.x, plot.y);
  for (let i = 1; i < (level || 1); i++) {
    trap.level += 1;
    trap.maxHp = Math.round(trap.maxHp * 1.5);
    trap.hp = trap.maxHp;
  }
  plot.trap = trap;
}

function placeEnemy(state, kind, x, y, hpFrac) {
  const e = makeEnemy(kind, x, y, state.night, state.rng);
  if (hpFrac !== undefined) e.hp = Math.round(e.maxHp * hpFrac);
  state.enemies.push(e);
  return e;
}

// A shared night backdrop: traps on the grid, a few embers on the ground.
function nightBackdrop(state) {
  placeTrapAt(state, 'brazier', 6, 3, 2);
  placeTrapAt(state, 'spikes', 8, 3, 1);
  placeTrapAt(state, 'frost', 5, 6, 2);
  placeTrapAt(state, 'ballista', 10, 5, 1);
  placeTrapAt(state, 'rod', 9, 7, 2);
  placeTrapAt(state, 'spikes', 4, 4, 1);
  for (let i = 0; i < 6; i++) {
    state.emberDrops.push({
      x: 480 + i * 70,
      y: 620 + (i % 2) * 30,
      value: 2,
      phase: i,
    });
  }
}

export function setupShot(state, name) {
  state.time = 42.5;
  state.beam.angle = -0.6;
  state.beam.drank = 0;

  if (name === 'cover') {
    // Night three at its loudest: the Hollow King, a swarm, the beam
    // sweeping across them, the Keeper mid-swing at combo x6.
    state.phase = 'night';
    state.night = 3;
    state.scoreCard.score = 18752;
    state.embers = 214;
    state.coreHp = 78;
    state.scoreCard.combo = 6;
    state.scoreCard.comboTimer = 2.1;
    state.scoreCard.kills = 222;
    state.keeper.x = 640;
    state.keeper.y = 470;
    state.keeper.hp = 82;
    state.keeper.level = 8;
    state.keeper.xp = 60;
    state.keeper.xpNeed = 162;
    state.keeper.aimAngle = -0.5;
    state.keeper.swingTimer = 0.12;
    nightBackdrop(state);
    const boss = placeEnemy(state, 'hollowKing', 900, 220, 0.62);
    boss.summonTimer = 3;
    placeEnemy(state, 'shambler', 520, 300, 0.8);
    placeEnemy(state, 'shambler', 760, 330, 0.6);
    placeEnemy(state, 'shambler', 420, 480, 0.9);
    placeEnemy(state, 'shambler', 860, 300, 0.7);
    placeEnemy(state, 'skitterer', 700, 250, 1);
    placeEnemy(state, 'skitterer', 580, 380, 0.7);
    placeEnemy(state, 'skitterer', 830, 420, 1);
    placeEnemy(state, 'skitterer', 460, 560, 0.8);
    placeEnemy(state, 'skitterer', 950, 380, 0.9);
    placeEnemy(state, 'skitterer', 620, 300, 0.8);
    placeEnemy(state, 'spitter', 980, 480, 1);
    placeEnemy(state, 'wraith', 760, 560, 0.75);
    placeEnemy(state, 'wraith', 380, 260, 1);
    placeEnemy(state, 'brute', 300, 620, 0.85);
    placeEnemy(state, 'brute', 1020, 300, 0.7);
    state.banner = 'NIGHT THREE — The Hollow King wakes.';
    state.bannerTimer = 1.6;
    return;
  }

  if (name === 'title') {
    // The title screen over a quiet night: a few shadows at the edges,
    // the beam sweeping, the keep lit.
    state.phase = 'title';
    state.night = 1;
    state.scoreCard.score = 0;
    state.embers = 0;
    placeEnemy(state, 'shambler', 220, 180, 1);
    placeEnemy(state, 'skitterer', 1060, 620, 1);
    placeEnemy(state, 'wraith', 980, 160, 1);
    state.keeper.x = 640;
    state.keeper.y = 560;
    return;
  }

  if (name === 'build') {
    // Daylight before night two: a half-built defence, embers to spend,
    // the shop open, the Keeper standing by the keep.
    state.phase = 'build';
    state.night = 2;
    state.scoreCard.score = 8210;
    state.embers = 246;
    state.coreHp = 100;
    state.buildTimer = 18.5;
    state.selectedTrap = 'rod';
    state.hoverPlot = state.plots.find((p) => p.col === 9 && p.row === 4) || null;
    placeTrapAt(state, 'brazier', 6, 3, 2);
    placeTrapAt(state, 'spikes', 8, 3, 1);
    placeTrapAt(state, 'frost', 5, 6, 1);
    placeTrapAt(state, 'ballista', 10, 5, 3);
    placeTrapAt(state, 'rod', 9, 7, 1);
    placeTrapAt(state, 'spikes', 4, 4, 2);
    placeTrapAt(state, 'frost', 11, 3, 1);
    state.keeper.x = 640;
    state.keeper.y = 560;
    state.keeper.hp = 100;
    state.keeper.level = 5;
    state.keeper.xp = 30;
    state.keeper.xpNeed = 72;
    return;
  }

  if (name === 'results') {
    // Dawn after night five: the victory screen with a full run behind it.
    state.phase = 'victory';
    state.night = 5;
    state.scoreCard.score = 24780;
    state.embers = 412;
    state.coreHp = 34;
    state.scoreCard.kills = 312;
    state.scoreCard.bestCombo = 8;
    state.scoreCard.embersEarned = 412;
    state.scoreCard.trapsBuilt = 14;
    state.scoreCard.bossesKilled = 2;
    state.scoreCard.nightsCleared = 5;
    state.keeper.level = 12;
    state.keeper.x = 640;
    state.keeper.y = 560;
    state.keeper.hp = 41;
    nightBackdrop(state);
    placeEnemy(state, 'wraith', 300, 300, 0.4);
    return;
  }

  // Unknown shot name: fall back to a plain night scene.
  state.phase = 'night';
  state.night = 1;
  nightBackdrop(state);
  placeEnemy(state, 'shambler', 520, 300, 1);
  placeEnemy(state, 'skitterer', 700, 380, 1);
}
