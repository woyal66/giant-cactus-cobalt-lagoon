import { test } from "node:test";
import assert from "node:assert/strict";
import { currentAlongWaves, effectiveWave, waveInCurrent } from "./waves.ts";

test("opposing current makes waves higher and much steeper; following flattens them", () => {
  const against = waveInCurrent(6, -1.03); // 2 kn against 6 s waves
  assert.ok(against.amp > 1.15 && against.amp < 1.35, String(against.amp));
  assert.ok(against.steep > against.amp);
  const withIt = waveInCurrent(6, 1.03);
  assert.ok(withIt.amp < 1 && withIt.steep < 1);
  assert.deepEqual(waveInCurrent(6, 0), { amp: 1, steep: 1, blocked: false });
});

test("short wind-sea against a strong tide is blocked and breaks", () => {
  const w = waveInCurrent(3, -1.5);
  assert.equal(w.blocked, true);
  assert.equal(w.amp, 2);
});

test("direction matters: waves from the north, current setting north = opposing", () => {
  assert.ok(currentAlongWaves(2, 0, 0) < -1); // waves travel south, current goes north
  assert.ok(currentAlongWaves(2, 180, 0) > 1);
  assert.ok(Math.abs(currentAlongWaves(2, 90, 0)) < 1e-9);
});

test("effective wave uses a guessed period when the model has none", () => {
  const e = effectiveWave(1.5, 0, 0, 2.5, 0);
  assert.ok(e.heightM > 1.5 && e.amp > 1);
  assert.deepEqual(effectiveWave(1.5, 7, 0, 0, 0), { heightM: 1.5, amp: 1, steep: 1, blocked: false });
});
