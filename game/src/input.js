// Input for EMBERFALL KEEP.
// One file, one job: everything the player presses, clicks and points at,
// turned into a plain input state the simulation reads. Nothing here
// changes game state directly; the handlers in main.js decide what a
// press means. Keeping input in one place means the simulation never has
// to know whether a key is called KeyW or ArrowUp, and the autopilot demo
// can drive the same input state a human would.
//
// The input state: { keys, mouseX, mouseY, mouseDown, moveX, moveY, dash }.
// moveX/moveY are a normalised movement vector from the held keys; dash is
// a one-shot flag the simulation consumes when it starts a dash.

import { VIEW } from './config.js';

export function makeInput() {
  return {
    keys: new Set(),
    mouseX: 640,
    mouseY: 300,
    mouseDown: false,
    moveX: 0,
    moveY: 0,
    dash: false,
  };
}

// Recompute the movement vector from the keys currently held.
export function updateMoveVector(input) {
  let x = 0;
  let y = 0;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) y -= 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) y += 1;
  const len = Math.hypot(x, y) || 1;
  input.moveX = x / len;
  input.moveY = y / len;
}

// Track a key press. Returns the code, so the caller can act on it.
export function pressKey(input, code) {
  input.keys.add(code);
  updateMoveVector(input);
  return code;
}

export function releaseKey(input, code) {
  input.keys.delete(code);
  updateMoveVector(input);
}

// Track the mouse position, converted from page pixels to game pixels.
export function moveMouse(input, canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  input.mouseX = ((clientX - rect.left) / rect.width) * VIEW.w;
  input.mouseY = ((clientY - rect.top) / rect.height) * VIEW.h;
}

// The trap-picker keys: 1–5 select a trap type. Returns the index or -1.
export function trapKeyIndex(code) {
  const n = parseInt(code.slice(-1), 10);
  if (code.startsWith('Digit') && n >= 1 && n <= 5) return n - 1;
  return -1;
}

// The draft-picker keys: 1–3 choose a boon card. Returns the index or -1.
export function draftKeyIndex(code) {
  const n = parseInt(code.slice(-1), 10);
  if (code.startsWith('Digit') && n >= 1 && n <= 3) return n - 1;
  return -1;
}
