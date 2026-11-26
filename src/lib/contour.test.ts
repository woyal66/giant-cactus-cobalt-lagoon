import { test } from "node:test";
import assert from "node:assert/strict";
import { contourGrid } from "./contour.ts";

test("a slope gives a straight contour at the right place", () => {
  // Depth grows left to right: 0, 4, 8, 12 m. The 6 m line sits halfway between x=1 and x=2.
  const n = 4;
  const v = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) v[y * n + x] = x * 4;
  const segs = contourGrid(v, n, 6);
  assert.equal(segs.length, 3);
  for (const s of segs) {
    assert.ok(Math.abs(s[0] - 1.5) < 1e-6 && Math.abs(s[2] - 1.5) < 1e-6);
  }
});

test("no line where the level isn't crossed or data is missing", () => {
  const v = new Float32Array([1, 1, 1, 1]);
  assert.equal(contourGrid(v, 2, 5).length, 0);
  const w = new Float32Array([0, 10, NaN, 10]);
  assert.equal(contourGrid(w, 2, 5).length, 0);
});

test("every metre from 1 to 5 m has its own line colour", async () => {
  const { DEPTH_LINES, depthLineColor } = await import("./contour.ts");
  assert.deepEqual(DEPTH_LINES.slice(0, 5), [1, 2, 3, 4, 5]);
  assert.equal(new Set([1, 2, 3, 4, 5].map(depthLineColor)).size, 5);
});
