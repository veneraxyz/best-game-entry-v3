// The Keeper of EMBERFALL KEEP.
// One file, one job: the player character — movement, the lantern-flail,
// the dash, health, XP, and the level-up draft. The Keeper is the only
// thing the player directly controls; everything else is the world reacting.
//
// The Keeper is a plain object: { x, y, hp, maxHp, level, xp, xpNeed,
// boons, aimAngle, swingTimer, swingCooldown, dashTimer, dashCooldown,
// iframes, secondWind, alive }.
//
// Boons are stored as a map from boon id to rank. Every derived number the
// Keeper needs (damage, speed, dash cooldown, pickup radius) is computed
// from the boon map by the helpers below, so a level-up never has to patch
// half a dozen fields by hand.

import { KEEPER, BOONS } from './config.js';

export function makeKeeper() {
  return {
    x: 640,
    y: 560,
    hp: KEEPER.hp,
    maxHp: KEEPER.hp,
    level: 1,
    xp: 0,
    xpNeed: KEEPER.xpPerLevel[1],
    boons: {},
    aimAngle: -Math.PI / 2,
    swingTimer: 0,
    swingCooldown: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashDirX: 0,
    dashDirY: -1,
    iframes: 0,
    secondWind: 0,
    alive: true,
    hurtFlash: 0,
  };
}

export function boonRank(keeper, id) {
  return keeper.boons[id] || 0;
}

export function flailDamage(keeper) {
  return KEEPER.flailDamage * (1 + 0.25 * boonRank(keeper, 'sharper'));
}

export function moveSpeed(keeper) {
  return KEEPER.speed * (1 + 0.12 * boonRank(keeper, 'swift'));
}

export function dashCooldownMax(keeper) {
  return KEEPER.dashCooldown * (1 - 0.25 * boonRank(keeper, 'dash'));
}

export function pickupRadius(keeper) {
  return KEEPER.pickupRadius * (1 + 0.45 * boonRank(keeper, 'magnet'));
}

// Grant XP. Returns true when a level-up is earned (the caller opens the
// draft and pauses the night until the player picks).
export function grantXp(keeper, amount) {
  if (!keeper.alive) return false;
  keeper.xp += amount;
  if (keeper.xp >= keeper.xpNeed) {
    keeper.xp -= keeper.xpNeed;
    keeper.level += 1;
    const next = KEEPER.xpPerLevel[Math.min(keeper.level, KEEPER.xpPerLevel.length - 1)];
    keeper.xpNeed = next;
    return true;
  }
  return false;
}

// Apply a drafted boon. Returns a one-line summary for the draft screen.
export function applyBoon(keeper, id) {
  const def = BOONS[id];
  keeper.boons[id] = (keeper.boons[id] || 0) + 1;
  const rank = keeper.boons[id];
  if (id === 'hide') {
    keeper.maxHp += 25;
    keeper.hp = Math.min(keeper.maxHp, keeper.hp + 25);
  }
  if (id === 'secondwind') keeper.secondWind += 1;
  return `${def.name} — rank ${rank}`;
}

// Damage the Keeper. Returns 'dead', 'second-wind' or 'hurt'.
export function hurtKeeper(keeper, amount) {
  if (!keeper.alive || keeper.iframes > 0 || keeper.dashTimer > 0) return 'ignored';
  keeper.hp -= amount;
  keeper.hurtFlash = 0.25;
  if (keeper.hp <= 0) {
    if (keeper.secondWind > 0) {
      keeper.secondWind -= 1;
      keeper.hp = Math.round(keeper.maxHp * 0.5);
      keeper.iframes = 1.5;
      return 'second-wind';
    }
    keeper.hp = 0;
    keeper.alive = false;
    return 'dead';
  }
  return 'hurt';
}

// Heal the Keeper, capped at max HP.
export function healKeeper(keeper, amount) {
  keeper.hp = Math.min(keeper.maxHp, keeper.hp + amount);
}

// The draft: three boons the Keeper may pick, each at most its max rank.
// Already-maxed boons are excluded; if fewer than three remain, the list
// is padded with a heal (a full heal is always a valid pick).
export function draftOptions(keeper, rng) {
  const available = Object.keys(BOONS).filter(
    (id) => (keeper.boons[id] || 0) < BOONS[id].max,
  );
  const shuffled = available.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const picks = shuffled.slice(0, 3).map((id) => ({ id, ...BOONS[id], rank: keeper.boons[id] || 0 }));
  while (picks.length < 3) {
    picks.push({ id: '__heal', name: 'Lantern Rest', desc: 'Restore 50 HP at once.', rank: 0, max: 99 });
  }
  return picks;
}
