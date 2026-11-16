// The shadows of EMBERFALL KEEP.
// One file, one job: what each enemy is, how it moves, what it wants, and
// how a night's spawn schedule is built. The simulation never touches the
// canvas here; render.js draws what this module decides.
//
// Every enemy is a plain object: { kind, x, y, hp, maxHp, speed, radius,
// damage, target, slowUntil, burnUntil, burnDps, isBoss, score, embers }.
// Movement is steering: each enemy picks a target (the Keeper or the core,
// whichever its kind prefers) and walks toward it, with a little wobble so
// a swarm does not march in a single file. Separation keeps them from
// stacking on one pixel.

// kind -> base stats. Night scaling multiplies hp and damage.
export const ENEMY_TYPES = {
  shambler: {
    name: 'Shambler', hp: 34, speed: 42, radius: 15, damage: 6, score: 10,
    embers: 2, color: '#7a86a3', eye: '#cdd6e8', prefers: 'core',
    desc: 'Slow, numberless, and patient. It walks at the light until it falls.',
  },
  skitterer: {
    name: 'Skitterer', hp: 12, speed: 148, radius: 10, damage: 3, score: 10,
    embers: 1, color: '#b08cc9', eye: '#f2e3ff', prefers: 'keeper',
    desc: 'Small and fast. It hunts the Keeper first and comes in packs.',
  },
  spitter: {
    name: 'Spitter', hp: 22, speed: 58, radius: 13, damage: 5, score: 15,
    embers: 2, color: '#6fb98a', eye: '#e2ffe9', prefers: 'ranged',
    desc: 'It keeps its distance and looses globs of dark at the Keeper.',
    range: 260, shotInterval: 2.6,
  },
  brute: {
    name: 'Brute', hp: 130, speed: 34, radius: 24, damage: 15, score: 30,
    embers: 5, color: '#a3543f', eye: '#ffd9c9', prefers: 'core',
    desc: 'A walking wall. It smashes traps in its path and pounds the core.',
    smashesTraps: true,
  },
  wraith: {
    name: 'Wraith', hp: 44, speed: 88, radius: 14, damage: 8, score: 25,
    embers: 3, color: '#8fd6e8', eye: '#ffffff', prefers: 'keeper',
    desc: 'Half here, half not. Weapons pass through it in the dark — only light can hold it.',
    lightOnly: true,
  },
};

// Bosses are built from the same object shape with bigger numbers.
export const BOSS_TYPES = {
  hollowKing: {
    name: 'The Hollow King', hp: 950, speed: 30, radius: 40, damage: 22,
    score: 600, embers: 40, color: '#c9a86a', eye: '#ffdf8a', prefers: 'core',
    desc: 'A crowned husk of the first night. It calls skitterers to its side.',
    summons: 'skitterer', summonInterval: 7,
  },
  nightWalks: {
    name: 'The Night That Walks', hp: 1500, speed: 38, radius: 46, damage: 26,
    score: 900, embers: 60, color: '#5b4a8a', eye: '#e8d5ff', prefers: 'core',
    desc: 'Darkness given legs. It spawns wraiths and drinks the beam.',
    summons: 'wraith', summonInterval: 9, drinksBeam: true,
  },
};

export function makeEnemy(kind, x, y, night, rng) {
  const base = ENEMY_TYPES[kind] || BOSS_TYPES[kind];
  const isBoss = kind in BOSS_TYPES;
  const hpScale = 1 + (night - 1) * 0.22 + (isBoss ? 0 : 0);
  const dmgScale = 1 + (night - 1) * 0.12;
  return {
    kind,
    name: base.name,
    x, y,
    hp: Math.round(base.hp * hpScale),
    maxHp: Math.round(base.hp * hpScale),
    speed: base.speed * (0.92 + rng() * 0.16),
    radius: base.radius,
    damage: Math.round(base.damage * dmgScale),
    score: base.score,
    embers: base.embers,
    color: base.color,
    eye: base.eye,
    prefers: base.prefers,
    range: base.range || 0,
    shotTimer: base.shotInterval ? 1 + rng() * 1.5 : 0,
    shotInterval: base.shotInterval || 0,
    smashesTraps: !!base.smashesTraps,
    lightOnly: !!base.lightOnly,
    isBoss,
    summons: base.summons || null,
    summonTimer: base.summonInterval || 0,
    summonInterval: base.summonInterval || 0,
    drinksBeam: !!base.drinksBeam,
    slowUntil: 0,
    burnUntil: 0,
    burnDps: 0,
    wobble: rng() * Math.PI * 2,
    hitFlash: 0,
    attackTimer: 0,
    dead: false,
  };
}

// Where a night's enemies enter: the four edges of the courtyard, biased
// toward the sides farthest from the Keeper so the player must reposition.
export function spawnPoint(rng, w, h) {
  const side = Math.floor(rng() * 4);
  const m = 24;
  if (side === 0) return { x: m + rng() * (w - 2 * m), y: m };
  if (side === 1) return { x: m + rng() * (w - 2 * m), y: h - m };
  if (side === 2) return { x: m, y: m + rng() * (h - 2 * m) };
  return { x: w - m, y: m + rng() * (h - 2 * m) };
}

// A night's spawn schedule: a list of { at, kind, count } events.
// Nights get longer, denser and meaner; bosses arrive on nights 3 and 5.
export function buildNightSchedule(night, rng) {
  const events = [];
  const duration = 75 + night * 12; // seconds of combat per night
  let t = 2;
  const budget = 10 + night * 7; // total spawn groups
  for (let i = 0; i < budget; i++) {
    const pool = ['shambler', 'skitterer'];
    if (night >= 2) pool.push('skitterer', 'spitter');
    if (night >= 3) pool.push('brute', 'wraith');
    if (night >= 4) pool.push('spitter', 'brute', 'wraith');
    if (night >= 5) pool.push('wraith', 'brute');
    const kind = pool[Math.floor(rng() * pool.length)];
    const count = 1 + Math.floor(rng() * (2 + Math.floor(night / 2)));
    events.push({ at: t, kind, count });
    t += Math.max(3.5, 9 - night * 0.8) + rng() * 4;
  }
  // Bosses anchor the middle and the end of the campaign.
  if (night === 3) events.push({ at: duration * 0.55, kind: 'hollowKing', count: 1 });
  if (night === 5) events.push({ at: duration * 0.5, kind: 'nightWalks', count: 1 });
  events.sort((a, b) => a.at - b.at);
  return { events, duration };
}
