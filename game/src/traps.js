// Traps and the build grid of EMBERFALL KEEP.
// One file, one job: the plots the Keeper builds on, the five trap types,
// what they cost, what they do, and how they level up.
//
// A trap is a plain object: { type, level, x, y, hp, maxHp, timer }.
// Traps live on grid plots; the grid itself is a list of plots, each with
// a centre, a state (empty / trap / blocked) and a reference to its trap.
// Brutes smash traps in their path, so traps carry HP and can be destroyed.

import { TRAPS, GRID } from './config.js';

// Build the plot list for a fresh run. The lighthouse occupies the centre;
// the wall ring is outside the courtyard and cannot hold a trap.
export function buildPlots() {
  const plots = [];
  for (let r = 0; r < GRID.rows; r++) {
    for (let c = 0; c < GRID.cols; c++) {
      const x = GRID.originX + c * GRID.cell + GRID.cell / 2;
      const y = GRID.originY + r * GRID.cell + GRID.cell / 2;
      const dx = x - 640;
      const dy = y - 400;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const blocked = dist < GRID.keepClear || dist > GRID.wallClear;
      plots.push({ col: c, row: r, x, y, blocked, trap: null });
    }
  }
  return plots;
}

export function plotAt(plots, px, py) {
  let best = null;
  let bestD = Infinity;
  for (const p of plots) {
    if (p.blocked) continue;
    const dx = p.x - px;
    const dy = p.y - py;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  if (best && bestD < (GRID.cell * 0.75) * (GRID.cell * 0.75)) return best;
  return null;
}

export function trapCost(type, level) {
  // Level 1 pays the base cost; each upgrade costs 1.5x the base, rounded.
  const base = TRAPS[type].cost;
  if (level <= 1) return base;
  return Math.round(base * 1.5 * (level - 1));
}

export function makeTrap(type, x, y) {
  const def = TRAPS[type];
  return {
    type,
    level: 1,
    x, y,
    hp: def.hp,
    maxHp: def.hp,
    timer: 0,
    flash: 0,
  };
}

export function upgradeTrap(trap) {
  const def = TRAPS[trap.type];
  trap.level += 1;
  trap.maxHp = Math.round(def.hp * (1 + 0.5 * (trap.level - 1)));
  trap.hp = trap.maxHp;
}

// The trap's effective numbers at its current level.
export function trapStats(trap) {
  const def = TRAPS[trap.type];
  const lvl = trap.level - 1;
  const out = { ...def };
  if (def.dps) out.dps = def.dps * (1 + 0.45 * lvl);
  if (def.damage) out.damage = Math.round(def.damage * (1 + 0.4 * lvl));
  if (def.radius) out.radius = def.radius * (1 + 0.12 * lvl);
  if (def.range) out.range = def.range * (1 + 0.1 * lvl);
  if (def.interval) out.interval = Math.max(0.5, def.interval * (1 - 0.12 * lvl));
  if (def.chains) out.chains = def.chains + lvl;
  return out;
}

// Is this point inside a pool of light? Light comes from braziers and the
// lighthouse beam; wraiths are only vulnerable inside it.
export function inLight(x, y, plots, beamAngle) {
  // Braziers make pools of light.
  for (const p of plots) {
    if (p.trap && p.trap.type === 'brazier') {
      const stats = trapStats(p.trap);
      const dx = x - p.trap.x;
      const dy = y - p.trap.y;
      const r = stats.lightRadius || 110;
      if (dx * dx + dy * dy < r * r) return true;
    }
  }
  // The beam is a cone from the lighthouse.
  const dx = x - 640;
  const dy = y - 400;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 400) {
    let a = Math.atan2(dy, dx) - beamAngle;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    if (Math.abs(a) < 0.42) return true;
  }
  return false;
}
