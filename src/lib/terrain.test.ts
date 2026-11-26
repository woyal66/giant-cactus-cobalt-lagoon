import { test } from "node:test";
import assert from "node:assert/strict";
import { hillshade, shadeRgba } from "./terrain.ts";

test("a hill is lit on its north-west side and shadowed on the south-east", () => {
  const n = 21;
  const h = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = 400 * Math.exp(-((x - 10) ** 2 + (y - 10) ** 2) / 20);
  const s = hillshade(h, n, 30);
  const nw = s[6 * n + 6]!;
  const se = s[14 * n + 14]!;
  assert.ok(nw > se + 0.3, `nw ${nw} se ${se}`);
});

test("water and no data get no shading", () => {
  const h = new Float32Array([-5, -5, 10, -5]);
  const s = hillshade(h, 2, 30);
  assert.ok(Number.isNaN(s[0]!) && Number.isFinite(s[2]!));
  assert.equal(shadeRgba(NaN), null);
});
