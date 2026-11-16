// The lighthouse beam of EMBERFALL KEEP.
// One file, one job: the sweeping cone of light at the heart of the game.
// The beam rotates steadily around the lighthouse; shadows caught in it
// burn and slow down, and Wraiths — which weapons cannot touch in the dark
// — can only be hurt inside it. The beam is both a weapon and the game's
// central idea: light is the only safe ground.
//
// The beam is a plain object: { angle, period, range, halfAngle }.
// angle advances with sim time; it never depends on the frame clock, so a
// fixed seed replays the same sweep.

import { BEAM, KEEP } from './config.js';

export function makeBeam() {
  return {
    angle: -Math.PI / 2,
    period: BEAM.sweepPeriod,
    range: BEAM.range,
    halfAngle: BEAM.halfAngle,
    // A boss can drink the beam: while a Night-That-Walks lives, the sweep
    // stalls near it. drank is 0..1, the fraction of the beam swallowed.
    drank: 0,
  };
}

// Advance the sweep. dt is sim seconds; the beam turns at a fixed rate.
export function updateBeam(beam, dt, drinking) {
  if (drinking) {
    beam.drank = Math.min(1, beam.drank + dt * 0.5);
  } else {
    beam.drank = Math.max(0, beam.drank - dt * 0.8);
  }
  const speed = (Math.PI * 2) / beam.period;
  // A drunk beam crawls: the darker it gets, the slower it turns.
  beam.angle += speed * dt * (1 - 0.7 * beam.drank);
}

// Is a point inside the beam cone right now?
export function inBeam(beam, x, y) {
  const dx = x - KEEP.x;
  const dy = y - KEEP.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > beam.range) return false;
  let a = Math.atan2(dy, dx) - beam.angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return Math.abs(a) < beam.halfAngle;
}

// The beam's far end, for drawing the cone and its glow.
export function beamEnd(beam) {
  return {
    x: KEEP.x + Math.cos(beam.angle) * beam.range,
    y: KEEP.y + Math.sin(beam.angle) * beam.range,
  };
}
