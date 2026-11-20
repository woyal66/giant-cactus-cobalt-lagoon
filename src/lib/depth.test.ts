import { test } from "node:test";
import assert from "node:assert/strict";
import { depthColor, sampleTile, shallowColor, terrariumHeight, waterDepthM } from "./depth.ts";

test("terrarium decoding", () => {
  assert.equal(terrariumHeight(128, 0, 0), 0);
  assert.equal(terrariumHeight(127, 231, 0), -25);
});

test("water depth includes the tide", () => {
  assert.equal(waterDepthM(-3, 1.2), 4.2);
  assert.equal(waterDepthM(-3, -1), 2);
});

test("colours: land none, shallow red, too-shallow for the draft red/amber/none", () => {
  assert.equal(depthColor(-1), null);
  assert.equal(depthColor(1)![0], 230);
  assert.deepEqual(shallowColor(2, 2.5)!.slice(0, 3), [230, 40, 40]);
  assert.deepEqual(shallowColor(3, 2.5)!.slice(0, 3), [240, 170, 40]);
  assert.equal(shallowColor(5, 2.5), null);
  assert.equal(shallowColor(-2, 2.5), null);
});

test("bilinear sampling", () => {
  const t = { z: 0, x: 0, y: 0, size: 2, h: new Float32Array([0, -10, -20, -30]) };
  assert.equal(sampleTile(t, 0.5, 0.5), 0);
  assert.equal(sampleTile(t, 1, 1), -15);
  assert.equal(sampleTile(t, 1.5, 1.5), -30);
});
