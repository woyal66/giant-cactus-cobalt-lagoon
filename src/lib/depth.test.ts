import { test } from "node:test";
import assert from "node:assert/strict";
import { cropParent, depthColor, inFineArea, mergeHeights, NO_DATA_M, sampleTile, shallowColor, terrariumHeight, waterDepthM } from "./depth.ts";

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

test("fine model area: tiles over the reef yes, Sydney and Perth no", () => {
  const tile = (lat: number, lng: number, z: number) => {
    const n = 2 ** z;
    const s = Math.sin((lat * Math.PI) / 180);
    return [Math.floor(((lng + 180) / 360) * n), Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n)] as const;
  };
  const [x, y] = tile(-19.15, 146.83, 12);
  assert.equal(inFineArea(12, x, y), true);
  const [sx, sy] = tile(-33.86, 151.2, 12);
  assert.equal(inFineArea(12, sx, sy), false);
  const [px, py] = tile(-31.95, 115.86, 10);
  assert.equal(inFineArea(10, px, py), false);
});

test("no-data pixels in the fine tile are filled from the base tile", () => {
  const fine = new Float32Array([-5, -32768, -12, -32768]);
  const base = new Float32Array([-50, -60, -70, -80]);
  assert.equal(mergeHeights(fine, base), 2);
  assert.deepEqual([...fine], [-5, -60, -12, -80]);
  assert.ok(terrariumHeight(0, 0, 0) <= NO_DATA_M);
});

test("enlarging a parent tile: the right quarter, bilinear, and no blending into no-data", () => {
  // 4×4 parent, depth increasing to the east: -10, -20, -30, -40 by column.
  const h = new Float32Array(16).map((_, i) => -10 * ((i % 4) + 1));
  const east = cropParent(h, 4, 2, 1, 1); // bottom-right quarter covers columns 2–3
  assert.ok(east.every((v) => v <= -25 && v >= -40), String([...east]));
  const west = cropParent(h, 4, 2, 0, 0);
  assert.ok(west.every((v) => v <= -10 && v >= -25));
  assert.equal(east[3], -40); // far edge clamps to the last column
  h[3] = -32768; // a no-data cell in the top-right
  const ne = cropParent(h, 4, 2, 1, 0);
  assert.ok(ne.every((v) => v === -32768 || (v <= -25 && v >= -40)), String([...ne]));
});
