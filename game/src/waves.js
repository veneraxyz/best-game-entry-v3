// Nights and waves of EMBERFALL KEEP.
// One file, one job: the schedule of a night — when shadows arrive, what
// they are, when the night ends, and what the Keeper earns for surviving it.
//
// A night is driven by its schedule (built in enemies.js): a sorted list of
// { at, kind, count } events plus a duration. This module owns the clock:
// it fires events as their time comes, tracks what is still alive, and
// reports when the night is won (clock past the duration and nothing left
// standing) or still going.
//
// Nights: 1 and 2 teach the loop, 3 brings the Hollow King, 4 is the
// attrition night, 5 brings the Night That Walks and then the dawn.

import { buildNightSchedule, makeEnemy, spawnPoint } from './enemies.js';

export function makeNight(night, rng) {
  const schedule = buildNightSchedule(night, rng);
  return {
    night,
    schedule,
    eventIndex: 0,
    time: 0,
    duration: schedule.duration,
    spawned: 0,
    // Bosses announce themselves once, with a roar and a banner.
    bossAnnounced: false,
  };
}

// Fire every schedule event whose time has come. Returns the enemies spawned.
export function updateNight(nightState, dt, rng, w, h) {
  nightState.time += dt;
  const spawned = [];
  while (
    nightState.eventIndex < nightState.schedule.events.length &&
    nightState.schedule.events[nightState.eventIndex].at <= nightState.time
  ) {
    const ev = nightState.schedule.events[nightState.eventIndex];
    nightState.eventIndex += 1;
    for (let i = 0; i < ev.count; i++) {
      const p = spawnPoint(rng, w, h);
      const enemy = makeEnemy(ev.kind, p.x, p.y, nightState.night, rng);
      spawned.push(enemy);
      nightState.spawned += 1;
    }
  }
  return spawned;
}

// Has the night ended in victory? The clock must be past the duration and
// no enemy may remain (bosses included).
export function nightWon(nightState, aliveEnemies) {
  return nightState.time >= nightState.duration && aliveEnemies === 0;
}

// How far through the night are we, 0..1, for the HUD progress bar?
export function nightProgress(nightState) {
  return Math.min(1, nightState.time / nightState.duration);
}

// A one-line banner for the night's opening, shown when the night starts.
export function nightBanner(night) {
  const banners = {
    1: 'NIGHT ONE — They smell the light.',
    2: 'NIGHT TWO — The dark sends runners.',
    3: 'NIGHT THREE — The Hollow King wakes.',
    4: 'NIGHT FOUR — Hold. Just hold.',
    5: 'NIGHT FIVE — The Night That Walks. Dawn is coming.',
  };
  return banners[night] || `NIGHT ${night}`;
}
