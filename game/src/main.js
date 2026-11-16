// EMBERFALL KEEP — the game itself.
// One file, one job: the state machine, the fixed-step simulation, input,
// and the frame loop. Everything else (rendering, HUD, enemies, traps,
// audio) is a module this file calls; this file decides what happens when.
//
// Phases: title → build → night → build → night … (five nights) → victory,
// or defeat when the core falls or the Keeper dies. A level-up opens a
// draft that pauses the night until the Keeper picks a boon. Pause freezes
// everything except the pause screen.
//
// The simulation runs at a fixed 60 steps a second, driven by sim time —
// never by the wall clock — so a fixed seed replays the same run, and the
// screenshot scenes in shots.js render deterministically. The demo mode
// (?demo=1) plays the game with a simple bot so the build can prove the
// whole loop works headlessly with zero JavaScript errors.

import { VIEW, KEEP, GRID, NIGHTS, BUILD_TIME, NIGHT_BONUS_EMBERS, TRAPS } from './config.js';
import { makeRng, hashSeed, pickThree } from './random.js';
import { buildPlots, plotAt, trapCost, makeTrap, upgradeTrap, trapStats, inLight } from './traps.js';
import { makeKeeper, flailDamage, moveSpeed, dashCooldownMax, pickupRadius, grantXp, applyBoon, hurtKeeper, healKeeper, draftOptions } from './keeper.js';
import { makeBeam, updateBeam, inBeam } from './beam.js';
import { makeNight, updateNight, nightWon, nightBanner } from './waves.js';
import { makeEnemy } from './enemies.js';
import { makeParticles, burst, updateParticles } from './particles.js';
import { makeProjectiles, fireBolt, fireGlob, stepProjectiles as stepShots } from './projectiles.js';
import { makeTips, note as tipNote, updateTips } from './tutorial.js';
import { makeScore, awardKill, awardBoss, awardNightClear, decayCombo, collectEmbers } from './scoring.js';
import { makeInput, updateMoveVector, pressKey, releaseKey, moveMouse, trapKeyIndex, draftKeyIndex } from './input.js';
import { drawWorld } from './render.js';
import { drawHud, drawShop, drawDraft, drawTitle, drawResults, drawPause, drawBossBanner, drawTip } from './hud.js';
import { setupShot } from './shots.js';
import * as sfx from './audio.js';

const STEP = 1 / 60;
const params = new URLSearchParams(location.search);
const SEED = parseInt(params.get('seed') || '7', 10);
const SHOT = params.get('shot') || null;
const DEMO = params.get('demo') === '1';

// --- State ---

export function createState(seed) {
  const rng = makeRng(seed);
  return {
    seed,
    rng,
    phase: 'title',
    paused: false,
    time: 0,
    night: 1,
    scoreCard: makeScore(),
    embers: 0,
    coreHp: KEEP.coreHp,
    keeper: makeKeeper(),
    plots: buildPlots(),
    beam: makeBeam(),
    enemies: [],
    projectiles: makeProjectiles(),
    particles: makeParticles(),
    tips: makeTips(),
    emberDrops: [],
    nightState: null,
    buildTimer: BUILD_TIME,
    selectedTrap: 'spikes',
    hoverPlot: null,
    draftOptions: [],
    banner: null,
    bannerTimer: 0,
    bossBanner: null,
    bossBannerTimer: 0,
    lastHurt: -99,
    shake: 0,
    stats: { swings: 0, hits: 0 },
  };
}

let state = createState(SEED);
let errors = [];

// --- Helpers ---

function addParticles(x, y, color, count, speed) {
  burst(state.particles, state.rng, x, y, color, count, speed);
}

function dropEmbers(x, y, value) {
  for (let i = 0; i < value; i++) {
    state.emberDrops.push({
      x: x + (state.rng() - 0.5) * 30,
      y: y + (state.rng() - 0.5) * 30,
      value: 1,
      phase: state.rng() * Math.PI * 2,
    });
  }
}

function showBanner(text, dur) {
  state.banner = text;
  state.bannerTimer = dur || 2.6;
}

// --- Damage ---

function damageEnemy(e, amount, opts) {
  opts = opts || {};
  // Wraiths cannot be hurt in the dark: only light counts.
  if (e.lightOnly && !opts.fromBeam) {
    const lit = inBeam(state.beam, e.x, e.y) || inLight(e.x, e.y, state.plots, state.beam.angle);
    if (!lit) return false;
  }
  e.hp -= amount;
  e.hitFlash = 0.18;
  if (opts.burn) {
    e.burnUntil = state.time + 3;
    e.burnDps = 8 * (opts.burnRank || 1);
  }
  if (opts.slow) {
    e.slowUntil = state.time + 1.5;
  }
  if (opts.knockback) {
    const a = Math.atan2(e.y - state.keeper.y, e.x - state.keeper.x);
    e.x += Math.cos(a) * opts.knockback;
    e.y += Math.sin(a) * opts.knockback;
  }
  if (e.hp <= 0 && !e.dead) killEnemy(e);
  return true;
}

function killEnemy(e) {
  e.dead = true;
  // Scoring lives in scoring.js: the combo, the multiplier, the run stats.
  const emberValue = awardKill(state.scoreCard, e.score, e.embers);
  dropEmbers(e.x, e.y, emberValue);
  addParticles(e.x, e.y, 'rgba(255,179,71,A)', 12, 160);
  addParticles(e.x, e.y, 'rgba(180,190,220,A)', 8, 120);
  sfx.sfxKill();
  if (e.isBoss) {
    awardBoss(state.scoreCard);
    state.shake = 0.5;
    showBanner(`${e.name} has fallen!`, 3);
    dropEmbers(e.x, e.y, 12);
  }
  // XP: a fifth of the score value, rounded up.
  const xp = Math.max(1, Math.ceil(e.score / 5));
  if (grantXp(state.keeper, xp)) {
    state.draftOptions = draftOptions(state.keeper, state.rng);
    state.phase = 'draft';
    tipNote(state.tips, 'draft');
    sfx.sfxLevelUp();
  }
}

// --- Phases ---

function startRun() {
  state = createState(SEED);
  state.phase = 'build';
  state.night = 1;
  state.embers = 120; // The Keeper starts with enough for two traps.
  state.buildTimer = BUILD_TIME;
  showBanner('DAY ONE — Build your defence.', 3);
}

function startNight() {
  state.phase = 'night';
  state.nightState = makeNight(state.night, state.rng);
  state.enemies = [];
  state.projectiles = [];
  showBanner(nightBanner(state.night), 3);
  sfx.sfxNightStart();
}

function startBuild() {
  state.phase = 'build';
  state.night += 1;
  state.buildTimer = BUILD_TIME;
  state.enemies = [];
  state.projectiles = [];
  healKeeper(state.keeper, 20);
  showBanner(`DAY ${state.night} — Build, then hold the night.`, 3);
}

function endNightVictory() {
  const bonus = NIGHT_BONUS_EMBERS[state.night - 1] || 60;
  awardNightClear(state.scoreCard, bonus);
  state.embers += bonus;
  if (state.night >= NIGHTS) {
    state.phase = 'victory';
    sfx.sfxVictory();
  } else {
    startBuild();
  }
}

function endRunDefeat() {
  state.phase = 'defeat';
  sfx.sfxDefeat();
}

// --- The simulation step ---

function stepNight(dt) {
  const nightState = state.nightState;
  // Spawn the night's shadows on schedule.
  const spawned = updateNight(nightState, dt, state.rng, VIEW.w, VIEW.h);
  for (const e of spawned) {
    state.enemies.push(e);
    if (e.kind === 'wraith') tipNote(state.tips, 'wraith');
    if (e.isBoss) {
      state.bossBanner = e.name;
      state.bossBannerTimer = 2.8;
      sfx.sfxBoss();
    }
  }
  // The beam is a clock: on the first night, remind the player to use it.
  if (nightState.night === 1 && nightState.time > 10) tipNote(state.tips, 'beam');
  // The beam: drunk by a Night That Walks, steady otherwise.
  const drinking = state.enemies.some((e) => e.drinksBeam);
  updateBeam(state.beam, dt, drinking);
  // Traps act.
  stepTraps(dt);
  // Enemies move and attack.
  stepEnemies(dt);
  // Projectiles fly and land (the module resolves the hits).
  state.projectiles = stepShots(state.projectiles, dt, state.enemies, state.keeper, { x: KEEP.x, y: KEEP.y, radius: KEEP.radius }, {
    onEnemyHit: (e, dmg, x, y) => {
      damageEnemy(e, dmg);
      addParticles(x, y, 'rgba(255,210,122,A)', 6, 120);
    },
    onKeeperHit: (dmg) => {
      const res = hurtKeeper(state.keeper, dmg);
      state.lastHurt = state.time;
      if (res === 'dead') endRunDefeat();
    },
    onCoreHit: (dmg) => {
      state.coreHp -= dmg;
      if (state.coreHp <= 0) {
        state.coreHp = 0;
        endRunDefeat();
      }
    },
  });
  // Embers drift to the Keeper and are collected.
  stepEmbers(dt);
  // The night is won when the clock runs out and nothing stands.
  if (nightWon(nightState, state.enemies.length)) endNightVictory();
}

function stepTraps(dt) {
  for (const p of state.plots) {
    const trap = p.trap;
    if (!trap) continue;
    trap.flash = Math.max(0, trap.flash - dt * 4);
    const stats = trapStats(trap);
    if (trap.type === 'spikes' || trap.type === 'brazier' || trap.type === 'frost') {
      for (const e of state.enemies) {
        if (e.dead) continue;
        const dx = e.x - trap.x;
        const dy = e.y - trap.y;
        const r = stats.radius + e.radius;
        if (dx * dx + dy * dy < r * r) {
          if (trap.type === 'spikes' && !e.lightOnly) damageEnemy(e, stats.dps * dt);
          if (trap.type === 'brazier') {
            damageEnemy(e, stats.dps * dt, { fromBeam: true });
            e.burnUntil = state.time + 0.5;
            e.burnDps = 6;
          }
          if (trap.type === 'frost') e.slowUntil = state.time + 0.4;
        }
      }
    } else {
      trap.timer -= dt;
      if (trap.timer > 0) continue;
      if (trap.type === 'rod') {
        const inRange = state.enemies
          .filter((e) => !e.dead)
          .map((e) => ({ e, d: Math.hypot(e.x - trap.x, e.y - trap.y) }))
          .filter((o) => o.d < stats.range)
          .sort((a, b) => a.d - b.d)
          .slice(0, stats.chains);
        if (inRange.length > 0) {
          trap.timer = stats.interval;
          trap.flash = 1;
          for (const o of inRange) {
            damageEnemy(o.e, stats.damage, { fromBeam: o.e.lightOnly && inLight(o.e.x, o.e.y, state.plots, state.beam.angle) });
            addParticles(o.e.x, o.e.y, 'rgba(255,240,160,A)', 6, 140);
          }
          sfx.sfxZap();
        }
      } else if (trap.type === 'ballista') {
        let best = null;
        let bestD = Infinity;
        for (const e of state.enemies) {
          if (e.dead) continue;
          const d = Math.hypot(e.x - trap.x, e.y - trap.y);
          if (d < stats.range && d < bestD) {
            bestD = d;
            best = e;
          }
        }
        if (best) {
          trap.timer = stats.interval;
          trap.aimAngle = Math.atan2(best.y - trap.y, best.x - trap.x);
          fireBolt(state.projectiles, trap.x, trap.y, trap.aimAngle, stats.damage, best);
        }
      }
    }
  }
}

function stepEnemies(dt) {
  const k = state.keeper;
  for (const e of state.enemies) {
    if (e.dead) continue;
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    e.attackTimer -= dt;
    // Burning ticks.
    if (e.burnUntil > state.time) {
      e.hp -= e.burnDps * dt;
      if (e.hp <= 0) {
        killEnemy(e);
        continue;
      }
    }
    // Speed: slowed in the beam, in frost, or both.
    let speed = e.speed;
    if (inBeam(state.beam, e.x, e.y)) {
      speed *= 0.55;
      e.hp -= 26 * dt; // The beam burns.
      if (e.hp <= 0) {
        killEnemy(e);
        continue;
      }
    }
    if (e.slowUntil > state.time) speed *= 0.45;
    // Pick a target: the Keeper, the core, or a ranged perch.
    let tx;
    let ty;
    if (e.prefers === 'keeper') {
      tx = k.x;
      ty = k.y;
    } else if (e.prefers === 'ranged') {
      tx = k.x;
      ty = k.y;
      const d = Math.hypot(tx - e.x, ty - e.y);
      if (d < 180) {
        tx = e.x + (e.x - k.x);
        ty = e.y + (e.y - k.y);
      }
    } else {
      tx = KEEP.x;
      ty = KEEP.y;
    }
    const dx = tx - e.x;
    const dy = ty - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    // Spitters shoot from range instead of closing in.
    if (e.prefers === 'ranged' && dist < (e.range || 260) && dist > 120) {
      e.shotTimer -= dt;
      if (e.shotTimer <= 0) {
        e.shotTimer = e.shotInterval;
        const a = Math.atan2(k.y - e.y, k.x - e.x);
        fireGlob(state.projectiles, e.x, e.y, a, e.damage);
      }
    } else if (dist > 4) {
      // Wobble so a swarm does not march in a single file.
      const wob = Math.sin(state.time * 2 + e.wobble) * 0.35;
      const a = Math.atan2(dy, dx) + wob;
      e.x += Math.cos(a) * speed * dt;
      e.y += Math.sin(a) * speed * dt;
    }
    // Separation: shadows do not stack on one pixel.
    for (const o of state.enemies) {
      if (o === e || o.dead) continue;
      const sx = e.x - o.x;
      const sy = e.y - o.y;
      const sd = Math.hypot(sx, sy);
      const min = e.radius + o.radius - 2;
      if (sd > 0 && sd < min) {
        const push = (min - sd) * 0.5;
        e.x += (sx / sd) * push;
        e.y += (sy / sd) * push;
      }
    }
    // Keep inside the courtyard.
    e.x = Math.max(30, Math.min(VIEW.w - 30, e.x));
    e.y = Math.max(30, Math.min(VIEW.h - 30, e.y));
    // Bosses summon help.
    if (e.summons) {
      e.summonTimer -= dt;
      if (e.summonTimer <= 0) {
        e.summonTimer = e.summonInterval;
        for (let i = 0; i < 2; i++) {
          const m = makeEnemy(e.summons, e.x + (state.rng() - 0.5) * 60, e.y + (state.rng() - 0.5) * 60, state.night, state.rng);
          state.enemies.push(m);
        }
        showBanner(`${e.name} calls for aid!`, 1.6);
      }
    }
    // Attack: the Keeper, the core, or a trap in the way.
    attackIfInRange(e, dt);
  }
  state.enemies = state.enemies.filter((e) => !e.dead);
}

function attackIfInRange(e, dt) {
  const k = state.keeper;
  if (e.attackTimer > 0) return;
  // The Keeper, if close and preferred (or any enemy that reaches him).
  const dk = Math.hypot(k.x - e.x, k.y - e.y);
  if (k.alive && dk < e.radius + 16 + 6) {
    e.attackTimer = 0.9;
    const res = hurtKeeper(k, e.damage);
    state.lastHurt = state.time;
    if (res === 'hurt' || res === 'second-wind') {
      sfx.sfxHurt();
      addParticles(k.x, k.y, 'rgba(255,93,93,A)', 8, 140);
      if (res === 'second-wind') showBanner('SECOND WIND — the lantern refuses to die!', 2.5);
    }
    if (res === 'dead') endRunDefeat();
    return;
  }
  // The core, if close.
  const dc = Math.hypot(KEEP.x - e.x, KEEP.y - e.y);
  if (dc < KEEP.radius + e.radius) {
    e.attackTimer = 1.0;
    state.coreHp -= e.damage;
    state.shake = 0.3;
    tipNote(state.tips, 'core');
    sfx.sfxCoreHit();
    addParticles(KEEP.x, KEEP.y - 20, 'rgba(255,93,93,A)', 10, 160);
    if (state.coreHp <= 0) {
      state.coreHp = 0;
      endRunDefeat();
    }
    return;
  }
  // Brutes smash traps standing between them and the core.
  if (e.smashesTraps) {
    for (const p of state.plots) {
      if (!p.trap) continue;
      const dt2 = Math.hypot(p.trap.x - e.x, p.trap.y - e.y);
      if (dt2 < e.radius + 30) {
        e.attackTimer = 1.1;
        p.trap.hp -= e.damage;
        addParticles(p.trap.x, p.trap.y, 'rgba(200,204,216,A)', 8, 120);
        if (p.trap.hp <= 0) {
          addParticles(p.trap.x, p.trap.y, 'rgba(255,179,71,A)', 14, 180);
          p.trap = null;
        }
        return;
      }
    }
  }
}

function stepEmbers(dt) {
  const k = state.keeper;
  const radius = pickupRadius(k);
  for (const e of state.emberDrops) {
    const dx = k.x - e.x;
    const dy = k.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d < radius && k.alive) {
      const pull = 420 * dt;
      e.x += (dx / (d || 1)) * pull;
      e.y += (dy / (d || 1)) * pull;
    }
    if (d < 26 && k.alive) {
      e.taken = true;
      state.embers += e.value;
      collectEmbers(state.scoreCard, e.value);
      sfx.sfxEmber();
    }
  }
  state.emberDrops = state.emberDrops.filter((e) => !e.taken);
}

function stepKeeper(dt, input) {
  const k = state.keeper;
  if (!k.alive) return;
  k.hurtFlash = Math.max(0, k.hurtFlash - dt);
  k.swingCooldown = Math.max(0, k.swingCooldown - dt);
  k.swingTimer = Math.max(0, k.swingTimer - dt);
  k.dashCooldown = Math.max(0, k.dashCooldown - dt);
  k.iframes = Math.max(0, k.iframes - dt);
  // Regeneration after five quiet seconds.
  if (state.time - state.lastHurt > 5) k.hp = Math.min(k.maxHp, k.hp + 1.6 * dt);
  // Aim at the mouse.
  k.aimAngle = Math.atan2(input.mouseY - k.y, input.mouseX - k.x);
  // Dash.
  if (input.dash && k.dashCooldown <= 0 && k.dashTimer <= 0) {
    tipNote(state.tips, 'dash');
    const mx = input.moveX;
    const my = input.moveY;
    const len = Math.hypot(mx, my) || 1;
    k.dashDirX = mx / len;
    k.dashDirY = my / len;
    if (mx === 0 && my === 0) {
      k.dashDirX = Math.cos(k.aimAngle);
      k.dashDirY = Math.sin(k.aimAngle);
    }
    k.dashTimer = 0.16;
    k.dashCooldown = dashCooldownMax(k);
    k.iframes = Math.max(k.iframes, 0.28);
    sfx.sfxDash();
    input.dash = false;
  }
  // Movement.
  const speed = moveSpeed(k);
  if (k.dashTimer > 0) {
    k.dashTimer -= dt;
    k.x += k.dashDirX * 720 * dt;
    k.y += k.dashDirY * 720 * dt;
  } else {
    k.x += input.moveX * speed * dt;
    k.y += input.moveY * speed * dt;
  }
  k.x = Math.max(30, Math.min(VIEW.w - 30, k.x));
  k.y = Math.max(30, Math.min(VIEW.h - 30, k.y));
  // The flail: hold the mouse to swing. One swing, one hit check.
  if (input.mouseDown && k.swingCooldown <= 0 && state.phase === 'night') {
    tipNote(state.tips, 'swing');
    k.swingCooldown = 0.34;
    k.swingTimer = 0.22;
    state.stats.swings += 1;
    sfx.sfxSwing();
    const dmg = flailDamage(k);
    const burnRank = state.keeper.boons.oil || 0;
    const slowRank = state.keeper.boons.frostedge || 0;
    let hits = 0;
    for (const e of state.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - k.x, e.y - k.y);
      if (d > 96 + e.radius) continue;
      let a = Math.atan2(e.y - k.y, e.x - k.x) - k.aimAngle;
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      if (Math.abs(a) > 0.95 + 0.3) continue;
      if (damageEnemy(e, dmg, { burn: burnRank > 0, burnRank, slow: slowRank > 0, knockback: 14 })) {
        hits += 1;
        state.stats.hits += 1;
      }
    }
    if (hits > 0) sfx.sfxHit();
  }
  // Combo decay, scored in scoring.js.
  decayCombo(state.scoreCard, dt);
}

// --- One fixed step ---

function step(dt) {
  state.time += dt;
  state.bannerTimer = Math.max(0, state.bannerTimer - dt);
  state.bossBannerTimer = Math.max(0, state.bossBannerTimer - dt);
  state.shake = Math.max(0, state.shake - dt);
  // Particles always animate, and the tutorial tips always tick.
  state.particles = updateParticles(state.particles, dt);
  updateTips(state.tips, dt);
  for (const p of state.plots) {
    if (p.trap) p.trap.flash = Math.max(0, (p.trap.flash || 0) - dt * 4);
  }
  if (state.phase === 'build') {
    state.buildTimer -= dt;
    updateBeam(state.beam, dt, false);
    if (state.buildTimer <= 0) startNight();
  } else if (state.phase === 'night') {
    stepKeeper(dt, input);
    stepNight(dt);
  }
}

// --- Input ---
// The input state lives in input.js; these handlers translate DOM events
// into it, and the simulation reads the state. Nothing here changes game
// state except through the phase actions below.

const input = makeInput();

function onKeyDown(e) {
  sfx.unlockAudio();
  if (e.code === 'KeyM') {
    sfx.toggleMute();
    return;
  }
  if (e.code === 'KeyR' && (state.phase === 'victory' || state.phase === 'defeat')) {
    startRun();
    return;
  }
  if ((e.code === 'KeyP' || e.code === 'Escape') && (state.phase === 'night' || state.phase === 'build')) {
    state.paused = !state.paused;
    return;
  }
  if (state.paused) return;
  if (e.code === 'Enter') {
    if (state.phase === 'title') {
      startRun();
      return;
    }
    if (state.phase === 'build') {
      startNight();
      return;
    }
  }
  if (e.code === 'Space') {
    input.dash = true;
    e.preventDefault();
    return;
  }
  if (state.phase === 'draft') {
    const di = draftKeyIndex(e.code);
    if (di >= 0) {
      pickDraft(di);
      return;
    }
  }
  if (state.phase === 'build') {
    const ti = trapKeyIndex(e.code);
    if (ti >= 0) {
      const types = Object.keys(TRAPS);
      state.selectedTrap = types[ti];
      return;
    }
  }
  pressKey(input, e.code);
}

function onKeyUp(e) {
  releaseKey(input, e.code);
}

function onMouseMove(e) {
  moveMouse(input, canvas, e.clientX, e.clientY);
  if (state.phase === 'build') {
    state.hoverPlot = plotAt(state.plots, input.mouseX, input.mouseY);
  }
}

function onMouseDown(e) {
  sfx.unlockAudio();
  if (e.button !== 0) return;
  onMouseMove(e);
  if (state.phase === 'title') {
    startRun();
    return;
  }
  if (state.phase === 'victory' || state.phase === 'defeat') return;
  if (state.phase === 'draft') {
    // Click a draft card.
    state.draftOptions.forEach((opt, i) => {
      const x = 320 + i * 230;
      const y = 300;
      if (input.mouseX >= x && input.mouseX <= x + 210 && input.mouseY >= y && input.mouseY <= y + 230) {
        pickDraft(i);
      }
    });
    return;
  }
  if (state.phase === 'build') {
    const plot = plotAt(state.plots, input.mouseX, input.mouseY);
    if (plot) {
      if (!plot.trap) {
        const cost = trapCost(state.selectedTrap, 1);
        if (state.embers >= cost) {
          plot.trap = makeTrap(state.selectedTrap, plot.x, plot.y);
          state.embers -= cost;
          state.scoreCard.trapsBuilt += 1;
          sfx.sfxPlace();
        }
      } else if (plot.trap.level < 3) {
        const cost = trapCost(plot.trap.type, plot.trap.level + 1);
        if (state.embers >= cost) {
          state.embers -= cost;
          upgradeTrap(plot.trap);
          sfx.sfxUpgrade();
        }
      }
    }
    return;
  }
  input.mouseDown = true;
}

function onMouseUp() {
  input.mouseDown = false;
}

function pickDraft(i) {
  const opt = state.draftOptions[i];
  if (!opt) return;
  if (opt.id === '__heal') {
    healKeeper(state.keeper, 50);
  } else {
    applyBoon(state.keeper, opt.id);
  }
  state.draftOptions = [];
  state.phase = 'night';
}

// --- Rendering ---

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function render() {
  ctx.save();
  if (state.shake > 0) {
    const s = state.shake * 8;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  drawWorld(ctx, state);
  if (state.phase === 'title') {
    drawTitle(ctx, state);
  } else {
    drawHud(ctx, state);
    drawTip(ctx, state);
    if (state.phase === 'build') drawShop(ctx, state);
    if (state.phase === 'draft') drawDraft(ctx, state);
    if (state.phase === 'victory') drawResults(ctx, state, true);
    if (state.phase === 'defeat') drawResults(ctx, state, false);
    if (state.paused) drawPause(ctx, state);
    drawBossBanner(ctx, state);
  }
  ctx.restore();
}

// --- Demo autopilot: plays the whole game headlessly ---

function demoAct() {
  const k = state.keeper;
  if (state.phase === 'title') {
    startRun();
    return;
  }
  if (state.phase === 'build') {
    // Spend embers on traps, cheapest first, then start the night.
    const types = Object.keys(TRAPS);
    let placed = false;
    for (const type of types) {
      const cost = trapCost(type, 1);
      if (state.embers < cost) continue;
      const empty = state.plots.filter((p) => !p.blocked && !p.trap);
      if (empty.length === 0) break;
      const plot = empty[Math.floor(state.rng() * empty.length)];
      plot.trap = makeTrap(type, plot.x, plot.y);
      state.embers -= cost;
      state.scoreCard.trapsBuilt += 1;
      placed = true;
      break;
    }
    if (!placed || state.embers < 60) startNight();
    return;
  }
  if (state.phase === 'draft') {
    pickDraft(0);
    return;
  }
  if (state.phase === 'night') {
    // Chase the nearest shadow, swing when close, dash when crowded.
    let nearest = null;
    let nearestD = Infinity;
    for (const e of state.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - k.x, e.y - k.y);
      if (d < nearestD) {
        nearestD = d;
        nearest = e;
      }
    }
    if (nearest) {
      input.mouseX = nearest.x;
      input.mouseY = nearest.y;
      const dx = nearest.x - k.x;
      const dy = nearest.y - k.y;
      const len = Math.hypot(dx, dy) || 1;
      input.moveX = dx / len;
      input.moveY = dy / len;
      input.mouseDown = nearestD < 110;
      let close = 0;
      for (const e of state.enemies) {
        if (!e.dead && Math.hypot(e.x - k.x, e.y - k.y) < 130) close += 1;
      }
      if (close >= 3 && k.dashCooldown <= 0) input.dash = true;
    } else {
      // Nothing near: drift back to the keep.
      input.moveX = (KEEP.x - k.x) / (Math.hypot(KEEP.x - k.x, KEEP.y - k.y) || 1);
      input.moveY = (KEEP.y - k.y) / (Math.hypot(KEEP.x - k.x, KEEP.y - k.y) || 1);
      input.mouseDown = false;
    }
  }
}

// --- Boot ---

window.addEventListener('error', (e) => {
  errors.push(String(e.message || e.error));
});
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
canvas.addEventListener('mousemove', onMouseMove);
canvas.addEventListener('mousedown', onMouseDown);
window.addEventListener('mouseup', onMouseUp);

if (SHOT) {
  // A screenshot scene: build it, paint one frame, announce readiness.
  setupShot(state, SHOT);
  render();
  window.__shotReady = true;
} else if (DEMO) {
  // The autopilot: play until the run ends or 300 sim seconds pass.
  startRun();
  let steps = 0;
  const maxSteps = 300 * 60;
  const timer = setInterval(() => {
    for (let i = 0; i < 600; i++) {
      if (state.phase === 'victory' || state.phase === 'defeat' || steps >= maxSteps) break;
      if (!state.paused) {
        demoAct();
        step(STEP);
      }
      steps += 1;
    }
    render();
    if (state.phase === 'victory' || state.phase === 'defeat' || steps >= maxSteps) {
      clearInterval(timer);
      window.__demoDone = true;
      window.__demoStats = {
        phase: state.phase,
        score: state.scoreCard.score,
        kills: state.scoreCard.kills,
        nightsCleared: state.scoreCard.nightsCleared,
        level: state.keeper.level,
        trapsBuilt: state.scoreCard.trapsBuilt,
        bossesKilled: state.scoreCard.bossesKilled,
        simSeconds: Math.round(steps / 60),
        errors,
      };
    }
  }, 0);
} else {
  // The real game: a fixed-step loop on requestAnimationFrame.
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!state.paused) {
      acc += dt;
      while (acc >= STEP) {
        step(STEP);
        acc -= STEP;
      }
    }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
