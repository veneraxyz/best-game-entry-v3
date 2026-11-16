// Synthesized sound for EMBERFALL KEEP.
// One file, one job: every sound the game makes is built here from raw
// WebAudio oscillators and filtered noise. There are no audio files: the
// game loads nothing over the network and ships no assets.
//
// The module is lazy: the AudioContext is created on the first user gesture
// (a click or keypress), because browsers refuse audio before interaction.
// Every effect is a small function that schedules a few nodes and lets them
// die on their own; nothing is kept alive between calls except the master
// gain and the ambient wind loop.

let ctx = null;
let master = null;
let muted = false;
let windNodes = null;

function ensure() {
  if (ctx) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.42;
    master.connect(ctx.destination);
    return true;
  } catch (e) {
    return false;
  }
}

// Call from any user gesture. Safe to call repeatedly.
export function unlockAudio() {
  if (!ensure()) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  startWind();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.42;
  return muted;
}

export function isMuted() {
  return muted;
}

// A short tone: an oscillator with an exponential decay envelope.
function tone(freq, dur, type, vol, slideTo) {
  if (!ensure() || muted) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// A burst of filtered noise: whooshes, thuds, crackles.
function noise(dur, vol, filterFreq, filterType) {
  if (!ensure() || muted) return;
  const t0 = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType || 'bandpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

// --- The game's voice, one effect per action. ---

export function sfxSwing() {
  noise(0.14, 0.22, 1400, 'bandpass');
}

export function sfxHit() {
  tone(180, 0.09, 'square', 0.16, 90);
  noise(0.06, 0.12, 500, 'lowpass');
}

export function sfxKill() {
  tone(520, 0.12, 'sine', 0.18, 780);
  tone(780, 0.16, 'sine', 0.12, 1040);
}

export function sfxEmber() {
  tone(1180, 0.07, 'sine', 0.1, 1560);
}

export function sfxPlace() {
  tone(140, 0.12, 'triangle', 0.24, 70);
  noise(0.08, 0.14, 300, 'lowpass');
}

export function sfxUpgrade() {
  tone(440, 0.1, 'triangle', 0.16);
  setTimeout(() => tone(554, 0.1, 'triangle', 0.16), 70);
  setTimeout(() => tone(659, 0.14, 'triangle', 0.16), 140);
}

export function sfxDash() {
  noise(0.18, 0.18, 2400, 'highpass');
}

export function sfxHurt() {
  tone(220, 0.18, 'sawtooth', 0.2, 110);
}

export function sfxCoreHit() {
  tone(98, 0.3, 'sawtooth', 0.24, 55);
  noise(0.2, 0.16, 240, 'lowpass');
}

export function sfxLevelUp() {
  [523, 659, 784, 1047].forEach((f, i) =>
    setTimeout(() => tone(f, 0.16, 'triangle', 0.16), i * 80),
  );
}

export function sfxBoss() {
  tone(70, 0.9, 'sawtooth', 0.26, 38);
  tone(93, 0.9, 'sawtooth', 0.18, 46);
  noise(0.7, 0.14, 200, 'lowpass');
}

export function sfxNightStart() {
  tone(196, 0.4, 'triangle', 0.14, 147);
  tone(147, 0.5, 'triangle', 0.12, 98);
}

export function sfxVictory() {
  [392, 494, 587, 784, 988].forEach((f, i) =>
    setTimeout(() => tone(f, 0.3, 'triangle', 0.16), i * 110),
  );
}

export function sfxDefeat() {
  [220, 185, 147, 110].forEach((f, i) =>
    setTimeout(() => tone(f, 0.5, 'sawtooth', 0.12), i * 160),
  );
}

export function sfxZap() {
  tone(1400, 0.08, 'square', 0.1, 220);
  noise(0.05, 0.1, 3200, 'highpass');
}

// --- Ambient wind: a quiet looped noise bed, started once. ---

function startWind() {
  if (!ensure() || windNodes || muted) return;
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    // Brown-ish noise: a random walk, low-passed by its own inertia.
    last = (last + (Math.random() * 2 - 1) * 0.02) * 0.98;
    data[i] = last * 3;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  const gain = ctx.createGain();
  gain.gain.value = 0.05;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start();
  windNodes = { src, gain };
}
