// EMBERFALL KEEP — tuning constants.
// One file, one job: every number the game balances on lives here, so a
// designer can retune the whole game without touching the simulation.
// All distances are canvas pixels, all times are seconds, all damage is HP.

export const VIEW = { w: 1280, h: 800 };

// The lighthouse stands at the centre of the courtyard. Everything orbits it.
export const KEEP = { x: 640, y: 400, radius: 58, coreHp: 100 };

// The build grid: a ring of plots around the lighthouse. Plots are square
// cells of 64 px; the centre 3x3 block is the lighthouse itself, the outer
// ring is the wall. A plot is either empty, holding a trap, or blocked.
export const GRID = {
  cell: 64,
  cols: 16,
  rows: 10,
  originX: 128,
  originY: 80,
  // Plots inside this radius of the lighthouse are the keep itself.
  keepClear: 150,
  // Plots outside this radius are the wall / moat and cannot hold traps.
  wallClear: 470,
};

// The Keeper: the player character. A lantern-flail fighter with a dash.
export const KEEPER = {
  radius: 16,
  speed: 235,
  hp: 100,
  regen: 1.6, // HP per second, out of combat
  flailRange: 96,
  flailArc: 1.9, // radians of the swing arc
  flailCooldown: 0.34,
  flailDamage: 16,
  dashSpeed: 720,
  dashTime: 0.16,
  dashCooldown: 2.4,
  dashIFrames: 0.28,
  pickupRadius: 90,
  xpPerLevel: [0, 8, 18, 32, 50, 72, 98, 128, 162, 200, 245, 295, 350, 410, 480],
};

// The lighthouse beam: a sweeping cone of light. Enemies caught in it burn
// and slow; Wraiths can only be hurt inside light at all.
export const BEAM = {
  range: 400,
  halfAngle: 0.42, // radians either side of the beam direction
  sweepPeriod: 9, // seconds for one full revolution
  burnDps: 26,
  slowFactor: 0.55, // speed multiplier while lit
};

// Nights: five nights, dawn after the fifth. Each night is one build phase
// (day) followed by one combat phase (night). Spawn schedules live in waves.js.
export const NIGHTS = 5;
export const BUILD_TIME = 30; // seconds of daylight per build phase
export const NIGHT_BONUS_EMBERS = [60, 80, 110, 140, 180]; // per night cleared

// Traps: bought with embers in the build phase, placed on grid plots.
// cost is the level-1 price; upgrading costs 1.5x the base, rounded.
export const TRAPS = {
  spikes: {
    name: 'Spike Pit',
    key: '1',
    cost: 60,
    hp: 60,
    desc: 'Hidden spikes wound anything that crosses this plot.',
    dps: 34,
    radius: 30,
  },
  brazier: {
    name: 'Ember Brazier',
    key: '2',
    cost: 80,
    hp: 70,
    desc: 'A burning bowl. Scorches nearby shadows and makes a pool of light.',
    dps: 22,
    radius: 96,
    lightRadius: 110,
  },
  frost: {
    name: 'Frost Ward',
    key: '3',
    cost: 70,
    hp: 60,
    desc: 'Cold runes chill the ground. Shadows crossing it crawl.',
    slowFactor: 0.45,
    radius: 100,
  },
  rod: {
    name: 'Lightning Rod',
    key: '4',
    cost: 120,
    hp: 80,
    desc: 'Crackling iron. Strikes the nearest shadows with chain lightning.',
    damage: 42,
    interval: 1.6,
    range: 220,
    chains: 3,
  },
  ballista: {
    name: 'Ballista',
    key: '5',
    cost: 150,
    hp: 90,
    desc: 'A creaking engine that looses heavy bolts at the nearest shadow.',
    damage: 38,
    interval: 0.9,
    range: 300,
    projectileSpeed: 620,
  },
};

// Boons: the keeper drafts one of three at each level-up. Each boon has
// three ranks; drafting the same boon again raises its rank.
export const BOONS = {
  sharper: { name: 'Sharper Flail', desc: '+25% flail damage per rank.', max: 3 },
  swift: { name: 'Swift Boots', desc: '+12% move speed per rank.', max: 3 },
  hide: { name: 'Thick Hide', desc: '+25 max HP and heal 25 per rank.', max: 3 },
  dash: { name: 'Long Dash', desc: '-25% dash cooldown per rank.', max: 3 },
  magnet: { name: 'Ember Magnet', desc: '+45% ember pickup radius per rank.', max: 3 },
  oil: { name: 'Burning Oil', desc: 'Flail hits set shadows burning (8/s) per rank.', max: 3 },
  frostedge: { name: 'Frost Edge', desc: 'Flail hits slow shadows 35% for 1.5s per rank.', max: 3 },
  secondwind: { name: 'Second Wind', desc: 'Cheat death once per rank, reviving at 50% HP.', max: 2 },
};

// Combo: kills chained within the window raise the multiplier. It multiplies
// score and the embers a kill drops.
export const COMBO = { window: 3.0, max: 8 };

// Scoring: what a run is measured by on the results screen.
export const SCORE = { kill: 10, waveClear: 150, nightClear: 400, bossKill: 600 };

// Palette: warm ember light against cold night. Every render reads from here.
export const PALETTE = {
  night: '#0a0e1a',
  ground: '#141a26',
  groundAlt: '#161d2d',
  wall: '#232c3d',
  keepStone: '#3a455c',
  keepRoof: '#c96f2e',
  beam: 'rgba(255, 196, 90, 0.20)',
  beamCore: 'rgba(255, 214, 130, 0.34)',
  ember: '#ffb347',
  emberBright: '#ffd27a',
  hpGood: '#5fd68a',
  hpBad: '#ff5d5d',
  text: '#e8ecf4',
  textDim: '#9aa5b8',
  gold: '#f2c14e',
};
