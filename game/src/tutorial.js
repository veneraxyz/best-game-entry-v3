// Tutorial toasts for EMBERFALL KEEP.
// One file, one job: the small contextual tips that teach the game while
// it is being played, instead of front-loading everything onto the title
// screen. A tip is a line of text with a trigger: the first time the
// player meets a situation, the tip appears near the bottom of the screen
// for a few seconds, then never again.
//
// The tips fire in order, one at a time, only during the first two nights:
// the first swing, the first dash, the first wraith, the first time the
// core is hit, the first level-up. A player who already knows the game
// never sees them twice; a new player is never left guessing what a
// button does. The module is pure state — the renderer draws the current
// tip, and main.js calls note() when the triggering event happens.

export function makeTips() {
  return {
    // Each tip: { id, text, shown, timer }. shown means it has fired once.
    list: [
      { id: 'swing', text: 'Hold CLICK to swing your flail.', shown: false, timer: 0 },
      { id: 'dash', text: 'SPACE dashes through danger — you cannot be hurt mid-dash.', shown: false, timer: 0 },
      { id: 'beam', text: 'Shadows in the lighthouse beam BURN. Fight inside the light.', shown: false, timer: 0 },
      { id: 'wraith', text: 'A Wraith! Weapons pass through it in the dark — only light can hold it.', shown: false, timer: 0 },
      { id: 'core', text: 'The core is taking damage! Shadows that reach the lighthouse hurt it directly.', shown: false, timer: 0 },
      { id: 'draft', text: 'Level up! Pick a boon — it stays with you for the whole run.', shown: false, timer: 0 },
    ],
    current: null,
  };
}

// Fire a tip by id, if it has never fired and nothing else is showing.
export function note(tips, id) {
  const tip = tips.list.find((t) => t.id === id);
  if (!tip || tip.shown || tips.current) return;
  tip.shown = true;
  tip.timer = 4;
  tips.current = tip;
}

// Advance the current tip's timer; clear it when it expires.
export function updateTips(tips, dt) {
  if (!tips.current) return;
  tips.current.timer -= dt;
  if (tips.current.timer <= 0) tips.current = null;
}

// The text of the tip on screen now, or null.
export function currentTip(tips) {
  return tips.current ? tips.current.text : null;
}
