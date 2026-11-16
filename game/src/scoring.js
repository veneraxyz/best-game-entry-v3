// Scoring for EMBERFALL KEEP.
// One file, one job: what a run is worth. Score, combo, embers earned and
// the run statistics the results screen reports. Nothing here draws or
// simulates; it is pure accounting, so the numbers on the results screen
// can never disagree with the numbers the game awarded.
//
// The combo is the heart of it: kills chained within a 3-second window
// raise a multiplier up to x8, and the multiplier feeds both the score and
// the embers a kill drops. A hot streak is worth more than the same kills
// spread out, which is what makes the player chase one more shadow instead
// of retreating to safety.
//
// The run stats (kills, best combo, embers earned, traps built, bosses
// felled, nights cleared) are the same numbers the victory and defeat
// screens show, kept in one object so the screens and the scoring can
// never drift apart.

import { COMBO, SCORE } from './config.js';

export function makeScore() {
  return {
    score: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    kills: 0,
    embersEarned: 0,
    trapsBuilt: 0,
    bossesKilled: 0,
    nightsCleared: 0,
  };
}

// Award a kill: raise the combo, score the kill with the multiplier, and
// return the ember value the kill is worth (before the drop is spawned).
// The multiplier grows with the combo: x1 at the first kill, up to x8.
export function awardKill(score, killScore, killEmbers) {
  score.kills += 1;
  score.combo = Math.min(COMBO.max, score.combo + 1);
  score.comboTimer = COMBO.window;
  score.bestCombo = Math.max(score.bestCombo, score.combo);
  const mult = 1 + 0.15 * (score.combo - 1);
  score.score += Math.round(killScore * mult);
  return Math.ceil(killEmbers * mult);
}

// A boss is worth a flat bonus on top of its kill score.
export function awardBoss(score) {
  score.bossesKilled += 1;
  score.score += SCORE.bossKill;
}

// Clearing a night pays a flat bonus plus the per-night ember bonus.
export function awardNightClear(score, emberBonus) {
  score.nightsCleared += 1;
  score.score += SCORE.nightClear;
  score.embersEarned += emberBonus;
  return emberBonus;
}

// A wave cleared inside a night (reserved for future waves-in-a-night).
export function awardWaveClear(score) {
  score.score += SCORE.waveClear;
}

// The combo decays when its window runs out.
export function decayCombo(score, dt) {
  if (score.comboTimer > 0) {
    score.comboTimer -= dt;
    if (score.comboTimer <= 0) score.combo = 0;
  }
}

// Embers collected from the ground count toward the run total.
export function collectEmbers(score, value) {
  score.embersEarned += value;
}
