import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeReefs, markReefs, REEF_SCALE } from "./reefs.ts";
import { isLand, rasterize } from "./land.ts";

const box = { south: -24, west: 152, north: -23, east: 153 };
const sq = (x: number, y: number, s: number) =>
  [x, y, x + s, y, x + s, y + s, x, y + s].map((v) => Math.round(v * REEF_SCALE));

test("decodes the compact reef file", () => {
  const p = decodeReefs({ v: 1, source: "test", polys: [sq(152.5, -23.5, 0.1), [1, 2]] });
  assert.equal(p.length, 1);
  assert.deepEqual(p[0][0][1], [152.6, -23.5]);
  assert.deepEqual(decodeReefs({ v: 2 }), []);
});

test("marks big and sub-cell reefs as obstacles", () => {
  const mask = rasterize([], box, 0.01);
  const big = decodeReefs({ v: 1, source: "t", polys: [sq(152.5, -23.5, 0.1)] });
  const tiny = decodeReefs({ v: 1, source: "t", polys: [sq(152.2031, -23.8031, 0.002)] });
  const n = markReefs(mask, [...big, ...tiny], rasterize);
  assert.ok(n > 90, String(n));
  assert.ok(isLand(mask, { lat: -23.45, lng: 152.55 }));
  assert.ok(isLand(mask, { lat: -23.8025, lng: 152.2035 }), "tiny reef caught");
  assert.ok(!isLand(mask, { lat: -23.2, lng: 152.9 }));
});
