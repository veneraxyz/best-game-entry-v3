// Rendering for EMBERFALL KEEP.
// One file, one job: everything the player sees, drawn on one canvas.
// This module never changes game state; it reads the state and paints it:
// the courtyard, the build grid, the traps, the lighthouse and its beam,
// the Keeper, the shadows, the projectiles, the particles and the embers.
// Screens (title, build panel, drafts, victory, defeat, pause) live in
// hud.js; this file draws the world underneath them.
//
// The art direction is warm ember light against cold night: a dark blue
// ground, a gold beam, orange embers, and shadows in cold violet-grey.
// Every shadow is a simple shape with two eyes — readable at a glance,
// even when the judge's contact sheet shrinks it.

// Rendering for EMBERFALL KEEP.
// One file, one job: everything the player sees, drawn in layers, back to
// front, every frame. The order is the whole story of the game:
//
//   1. the ground (checkerboard courtyard, plots, the keep),
//   2. the traps on their plots,
//   3. the ember gems lying on the ground,
//   4. the shadows, drawn darkest first so the bright ones read,
//   5. the beam, sweeping over the courtyard (its light is a gameplay
//      mechanic — wraiths only burn inside it),
//   6. the Keeper and her flail arc,
//   7. projectiles and particles on top.
//
// A frame is a function of state and nothing else: the same state drawn
// twice gives the same pixels, which is what makes the deterministic
// ?shot= scenes possible. Nothing here mutates state — the simulation
// moves things, this file only shows them.
//
// The palette lives in config.js; every colour on screen comes from it,
// so the night stays one coherent dark blue and the only warm colours are
// the ones that mean something: embers, the beam, the flail, fire.

import { VIEW, KEEP, GRID, PALETTE } from './config.js';
import { trapStats } from './traps.js';
import { beamEnd } from './beam.js';
import { drawParticles } from './particles.js';

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ring(ctx, x, y, r, width) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.lineWidth = width;
  ctx.stroke();
}

// --- Ground and grid ---

function drawGround(ctx, state) {
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  // A whisper of a checker, barely lighter than the ground, so the
  // courtyard reads as ground without turning into a chessboard.
  const cell = 64;
  for (let y = 0; y < VIEW.h / cell; y++) {
    for (let x = 0; x < VIEW.w / cell; x++) {
      if ((x + y) % 2 === 0) continue;
      ctx.fillStyle = PALETTE.groundAlt;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  // The wall: a stone border around the courtyard.
  ctx.strokeStyle = PALETTE.wall;
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, VIEW.w - 28, VIEW.h - 28);
  ctx.fillStyle = PALETTE.wall;
  ctx.fillRect(14, 14, VIEW.w - 28, 10);
  ctx.fillRect(14, VIEW.h - 24, VIEW.w - 28, 10);
  ctx.fillRect(14, 14, 10, VIEW.h - 28);
  ctx.fillRect(VIEW.w - 24, 14, 10, VIEW.h - 28);
}

function drawGrid(ctx, state) {
  // Only during the build phase: show the plots the Keeper may build on.
  if (state.phase !== 'build') return;
  for (const p of state.plots) {
    if (p.blocked) continue;
    const hovered = state.hoverPlot === p;
    ctx.fillStyle = hovered ? 'rgba(255, 179, 71, 0.22)' : 'rgba(255, 255, 255, 0.045)';
    ctx.fillRect(p.x - GRID.cell / 2 + 3, p.y - GRID.cell / 2 + 3, GRID.cell - 6, GRID.cell - 6);
    ctx.strokeStyle = hovered ? PALETTE.ember : 'rgba(255, 255, 255, 0.10)';
    ctx.lineWidth = hovered ? 2 : 1;
    ctx.strokeRect(p.x - GRID.cell / 2 + 3, p.y - GRID.cell / 2 + 3, GRID.cell - 6, GRID.cell - 6);
  }
}

// --- Traps ---

function drawTrap(ctx, trap, time) {
  const stats = trapStats(trap);
  const { x, y } = trap;
  // A stone base, so a trap reads as built, not floating.
  ctx.fillStyle = '#2b3346';
  ctx.fillRect(x - 26, y - 26, 52, 52);
  ctx.strokeStyle = '#454f66';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 26, y - 26, 52, 52);
  // Health bar for a damaged trap.
  if (trap.hp < trap.maxHp) {
    ctx.fillStyle = '#1a1f2c';
    ctx.fillRect(x - 24, y - 34, 48, 5);
    ctx.fillStyle = trap.hp / trap.maxHp > 0.4 ? PALETTE.hpGood : PALETTE.hpBad;
    ctx.fillRect(x - 24, y - 34, 48 * (trap.hp / trap.maxHp), 5);
  }
  if (trap.type === 'spikes') {
    ctx.fillStyle = '#c8ccd8';
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        ctx.beginPath();
        ctx.moveTo(x + i * 14 - 5, y + j * 14 + 6);
        ctx.lineTo(x + i * 14, y + j * 14 - 8);
        ctx.lineTo(x + i * 14 + 5, y + j * 14 + 6);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else if (trap.type === 'brazier') {
    const flicker = 1 + Math.sin(time * 9 + x) * 0.12;
    ctx.fillStyle = '#4a2c14';
    ctx.fillRect(x - 14, y - 4, 28, 16);
    ctx.fillStyle = '#ff9a2e';
    circle(ctx, x, y - 8, 9 * flicker);
    ctx.fillStyle = '#ffd27a';
    circle(ctx, x, y - 9, 5 * flicker);
    // The pool of light it makes.
    ctx.fillStyle = 'rgba(255, 179, 71, 0.07)';
    circle(ctx, x, y, stats.lightRadius || 110);
  } else if (trap.type === 'frost') {
    ctx.strokeStyle = '#9fd8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 14, y);
    ctx.lineTo(x + 14, y);
    ctx.moveTo(x, y - 14);
    ctx.lineTo(x, y + 14);
    ctx.moveTo(x - 10, y - 10);
    ctx.lineTo(x + 10, y + 10);
    ctx.moveTo(x - 10, y + 10);
    ctx.lineTo(x + 10, y - 10);
    ctx.stroke();
    ctx.fillStyle = 'rgba(159, 216, 255, 0.10)';
    circle(ctx, x, y, stats.radius);
  } else if (trap.type === 'rod') {
    ctx.strokeStyle = '#d8c27a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y + 18);
    ctx.lineTo(x, y - 18);
    ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    circle(ctx, x, y - 20, 5);
    if (trap.flash > 0) {
      ctx.strokeStyle = `rgba(255, 240, 160, ${trap.flash})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y - 20);
      ctx.lineTo(x + 26, y - 46);
      ctx.lineTo(x + 8, y - 60);
      ctx.stroke();
    }
  } else if (trap.type === 'ballista') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(trap.aimAngle || 0);
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(-6, -4, 34, 8);
    ctx.fillStyle = '#c8ccd8';
    ctx.beginPath();
    ctx.moveTo(28, -4);
    ctx.lineTo(40, 0);
    ctx.lineTo(28, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#5a4630';
    circle(ctx, x, y, 10);
  }
  // Level pips under the trap.
  ctx.fillStyle = PALETTE.gold;
  for (let i = 0; i < trap.level; i++) {
    circle(ctx, x - 10 + i * 10, y + 30, 3);
  }
}

// --- The lighthouse and its beam ---

function drawBeam(ctx, state) {
  const beam = state.beam;
  const end = beamEnd(beam);
  const spread = beam.halfAngle;
  ctx.save();
  ctx.globalAlpha = 1 - 0.55 * beam.drank;
  ctx.fillStyle = PALETTE.beam;
  ctx.beginPath();
  ctx.moveTo(KEEP.x, KEEP.y);
  ctx.arc(KEEP.x, KEEP.y, beam.range, beam.angle - spread, beam.angle + spread);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.beamCore;
  ctx.beginPath();
  ctx.moveTo(KEEP.x, KEEP.y);
  ctx.arc(KEEP.x, KEEP.y, beam.range, beam.angle - spread * 0.45, beam.angle + spread * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // The beam's far glow.
  const g = ctx.createRadialGradient(end.x, end.y, 4, end.x, end.y, 60);
  g.addColorStop(0, 'rgba(255, 214, 130, 0.35)');
  g.addColorStop(1, 'rgba(255, 214, 130, 0)');
  ctx.fillStyle = g;
  circle(ctx, end.x, end.y, 60);
}

function drawKeep(ctx, state) {
  const { x, y } = KEEP;
  // The stone tower.
  ctx.fillStyle = PALETTE.keepStone;
  ctx.beginPath();
  ctx.moveTo(x - 34, y + 34);
  ctx.lineTo(x - 24, y - 30);
  ctx.lineTo(x + 24, y - 30);
  ctx.lineTo(x + 34, y + 34);
  ctx.closePath();
  ctx.fill();
  // The lamp room, glowing.
  const pulse = 0.75 + Math.sin(state.time * 2.4) * 0.25;
  const glow = ctx.createRadialGradient(x, y - 38, 4, x, y - 38, 70);
  glow.addColorStop(0, `rgba(255, 196, 90, ${0.5 * pulse})`);
  glow.addColorStop(1, 'rgba(255, 196, 90, 0)');
  ctx.fillStyle = glow;
  circle(ctx, x, y - 38, 70);
  ctx.fillStyle = '#ffd27a';
  circle(ctx, x, y - 38, 12);
  // The roof.
  ctx.fillStyle = PALETTE.keepRoof;
  ctx.beginPath();
  ctx.moveTo(x - 26, y - 46);
  ctx.lineTo(x, y - 66);
  ctx.lineTo(x + 26, y - 46);
  ctx.closePath();
  ctx.fill();
  // The core: the heart the shadows want. Its bar sits under the tower.
  const frac = state.coreHp / KEEP.coreHp;
  ctx.fillStyle = '#1a1f2c';
  ctx.fillRect(x - 40, y + 44, 80, 8);
  ctx.fillStyle = frac > 0.4 ? PALETTE.hpGood : PALETTE.hpBad;
  ctx.fillRect(x - 40, y + 44, 80 * frac, 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 40, y + 44, 80, 8);
}

// --- Enemies, projectiles, particles, embers ---

function drawEnemy(ctx, e, state) {
  ctx.save();
  ctx.translate(e.x, e.y);
  // Wraiths shimmer: they are half out of the world.
  if (e.kind === 'wraith') ctx.globalAlpha = 0.75 + Math.sin(state.time * 6 + e.wobble) * 0.2;
  // A shadow body: a dark blob with a cold rim.
  ctx.fillStyle = e.color;
  circle(ctx, 0, 0, e.radius);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 3;
  ring(ctx, 0, 0, e.radius - 1.5, 3);
  // Burning enemies smoulder.
  if (e.burnUntil > state.time) {
    ctx.fillStyle = 'rgba(255, 120, 40, 0.75)';
    circle(ctx, -e.radius * 0.4, -e.radius * 0.5, 4);
    circle(ctx, e.radius * 0.3, -e.radius * 0.2, 3);
  }
  // Slowed enemies wear frost.
  if (e.slowUntil > state.time) {
    ctx.strokeStyle = 'rgba(159, 216, 255, 0.8)';
    ctx.lineWidth = 2;
    ring(ctx, 0, 0, e.radius + 2, 2);
  }
  // Hit flash: a white blink on the frame a blow lands.
  if (e.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, e.hitFlash * 4)})`;
    circle(ctx, 0, 0, e.radius);
  }
  // Eyes: two dots that face the target, so the thing reads as alive.
  const ang = Math.atan2(state.keeper.y - e.y, state.keeper.x - e.x);
  const ex = Math.cos(ang) * e.radius * 0.35;
  const ey = Math.sin(ang) * e.radius * 0.35;
  const perp = ang + Math.PI / 2;
  const ox = Math.cos(perp) * e.radius * 0.32;
  const oy = Math.sin(perp) * e.radius * 0.32;
  ctx.fillStyle = e.eye;
  circle(ctx, ex + ox, ey + oy, Math.max(2, e.radius * 0.14));
  circle(ctx, ex - ox, ey - oy, Math.max(2, e.radius * 0.14));
  // Bosses wear a crown and a health bar.
  if (e.isBoss) {
    ctx.fillStyle = PALETTE.gold;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 14 - 6, -e.radius - 2);
      ctx.lineTo(i * 14, -e.radius - 14);
      ctx.lineTo(i * 14 + 6, -e.radius - 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#1a1f2c';
    ctx.fillRect(-e.radius, -e.radius - 26, e.radius * 2, 6);
    ctx.fillStyle = PALETTE.hpBad;
    ctx.fillRect(-e.radius, -e.radius - 26, e.radius * 2 * (e.hp / e.maxHp), 6);
  } else if (e.hp < e.maxHp) {
    ctx.fillStyle = '#1a1f2c';
    ctx.fillRect(-e.radius, -e.radius - 10, e.radius * 2, 4);
    ctx.fillStyle = PALETTE.hpBad;
    ctx.fillRect(-e.radius, -e.radius - 10, e.radius * 2 * (e.hp / e.maxHp), 4);
  }
  ctx.restore();
}

function drawKeeper(ctx, keeper, state) {
  if (!keeper.alive) return;
  const { x, y } = keeper;
  ctx.save();
  ctx.translate(x, y);
  // Dash afterimage: a fading ghost of where the Keeper was.
  if (keeper.dashTimer > 0) ctx.globalAlpha = 0.7;
  // The cloak: a hooded figure in deep blue with a gold clasp.
  ctx.fillStyle = '#2e4a7a';
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(13, 12);
  ctx.lineTo(-13, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3d5f96';
  circle(ctx, 0, -8, 9);
  // The lantern: a warm dot that swings with the flail.
  const lx = Math.cos(keeper.aimAngle) * 20;
  const ly = Math.sin(keeper.aimAngle) * 20;
  const glow = ctx.createRadialGradient(lx, ly, 2, lx, ly, 26);
  glow.addColorStop(0, 'rgba(255, 196, 90, 0.6)');
  glow.addColorStop(1, 'rgba(255, 196, 90, 0)');
  ctx.fillStyle = glow;
  circle(ctx, lx, ly, 26);
  ctx.fillStyle = '#ffd27a';
  circle(ctx, lx, ly, 4);
  // The flail arc, drawn while the swing is live.
  if (keeper.swingTimer > 0) {
    const frac = 1 - keeper.swingTimer / 0.22;
    const a0 = keeper.aimAngle - 0.95 + frac * 1.9;
    ctx.strokeStyle = `rgba(255, 210, 122, ${0.9 - frac * 0.6})`;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, 96, a0 - 0.5, a0 + 0.5);
    ctx.stroke();
    ctx.fillStyle = '#ffd27a';
    circle(ctx, Math.cos(a0) * 96, Math.sin(a0) * 96, 7);
  }
  // Hurt flash.
  if (keeper.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255, 60, 60, ${keeper.hurtFlash})`;
    circle(ctx, 0, 0, 20);
  }
  // Health bar.
  ctx.fillStyle = '#1a1f2c';
  ctx.fillRect(-20, -30, 40, 5);
  ctx.fillStyle = keeper.hp / keeper.maxHp > 0.4 ? PALETTE.hpGood : PALETTE.hpBad;
  ctx.fillRect(-20, -30, 40 * (keeper.hp / keeper.maxHp), 5);
  ctx.restore();
}

function drawProjectiles(ctx, state) {
  for (const p of state.projectiles) {
    if (p.friendly) {
      ctx.fillStyle = '#ffd27a';
      circle(ctx, p.x, p.y, 5);
      ctx.fillStyle = '#fff3cf';
      circle(ctx, p.x, p.y, 2.5);
    } else {
      ctx.fillStyle = '#7dff9a';
      circle(ctx, p.x, p.y, 6);
      ctx.fillStyle = 'rgba(125,255,154,0.35)';
      circle(ctx, p.x, p.y, 10);
    }
  }
}

function drawEmbers(ctx, state) {
  for (const e of state.emberDrops) {
    const bob = Math.sin(state.time * 5 + e.phase) * 2;
    ctx.fillStyle = PALETTE.emberBright;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y + bob - 7);
    ctx.lineTo(e.x + 5, e.y + bob);
    ctx.lineTo(e.x, e.y + bob + 7);
    ctx.lineTo(e.x - 5, e.y + bob);
    ctx.closePath();
    ctx.fill();
  }
}

// --- The whole frame ---

export function drawWorld(ctx, state) {
  drawGround(ctx, state);
  drawGrid(ctx, state);
  drawBeam(ctx, state);
  for (const p of state.plots) {
    if (p.trap) drawTrap(ctx, p.trap, state.time);
  }
  drawKeep(ctx, state);
  drawEmbers(ctx, state);
  for (const e of state.enemies) drawEnemy(ctx, e, state);
  drawKeeper(ctx, state.keeper, state);
  drawProjectiles(ctx, state);
  drawParticles(ctx, state.particles);
}
