// Seeded randomness for EMBERFALL KEEP.
// One file, one job: every random choice in the game flows through this
// module, so a fixed seed replays the same run. The screenshots and the
// autopilot playtest both depend on that determinism.
//
// mulberry32 is a small, fast, well-behaved 32-bit PRNG. It is not crypto;
// it is a game dice roller, and it is all a game needs.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Roll a float in [min, max).
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// Roll an integer in [min, max] inclusive.
export function int(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

// Pick one element of an array, uniformly.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Pick three distinct elements of an array (for the level-up draft).
// If the array is shorter than three, return a shuffled copy of all of it.
export function pickThree(rng, arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, 3);
}

// A stable hash of a string, for turning names into seeds.
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
