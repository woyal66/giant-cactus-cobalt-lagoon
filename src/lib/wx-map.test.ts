import { test } from "node:test";
import assert from "node:assert/strict";
import { components, contourSegments, extremes, isobarLevels, layerIndex, valueAt, viewGrid } from "./wx-map.ts";

test("view grid covers the view, stays under 100 points, and snaps", () => {
  const g = viewGrid({ south: -24.2, west: 152.1, north: -23.6, east: 152.7 });
  assert.ok(g.lats.length * g.lngs.length <= 100);
  assert.ok(g.south <= -24.2 && g.north >= -23.6 && g.west <= 152.1 && g.east >= 152.7);
  const moved = viewGrid({ south: -24.19, west: 152.11, north: -23.59, east: 152.71 });
  assert.equal(moved.key, g.key);
});

test("wind from the south blows north; current toward east is east", () => {
  const w = components(10, 180, false);
  assert.ok(Math.abs(w.u) < 1e-9 && Math.abs(w.v - 10) < 1e-9);
  const c = components(2, 90, true);
  assert.ok(Math.abs(c.u - 2) < 1e-9 && Math.abs(c.v) < 1e-9);
});

const g = { lat0: 0, lng0: 0, dLat: 1, dLng: 1, nx: 5, ny: 5 };
// A bowl: low of 1000 in the middle rising to 1010 at the edges.
const bowl = Float32Array.from({ length: 25 }, (_, k) => 1000 + 2.5 * Math.hypot((k % 5) - 2, Math.floor(k / 5) - 2));

test("isobars and a low in the middle", () => {
  assert.deepEqual(isobarLevels(bowl, 2), [1000, 1002, 1004, 1006]);
  const segs = contourSegments(g, bowl, 1004);
  assert.ok(segs.length >= 4);
  for (const [a] of segs) assert.ok(Math.abs(Math.hypot(a.lat - 2, a.lng - 2) - 1.6) < 0.5);
  const ex = extremes(g, bowl);
  assert.equal(ex.length, 1);
  assert.equal(ex[0].kind, "L");
  assert.equal(ex[0].lat, 2);
});

test("bilinear values and nearest hour", () => {
  const f = { ...g, times: [0, 3600e3, 7200e3] } as unknown as Parameters<typeof valueAt>[0];
  const ramp = Float32Array.from({ length: 25 }, (_, k) => k % 5);
  assert.equal(valueAt(f, ramp, 1, 2.5), 2.5);
  assert.ok(Number.isNaN(valueAt(f, ramp, 9, 9)));
  assert.equal(layerIndex(f, 3000e3), 1);
});

test("directions blend as vectors, not numbers", async () => {
  const { vectorAt } = await import("./wx-map.ts");
  const f = { lat0: 0, lng0: 0, dLat: 1, dLng: 1, nx: 2, ny: 2, times: [0] } as unknown as Parameters<typeof vectorAt>[0];
  const kn = Float32Array.from([10, 10, 10, 10]);
  const dir = Float32Array.from([350, 10, 350, 10]); // wind from about north
  const r = vectorAt(f, kn, dir, 0.5, 0.5, false)!;
  assert.ok(r.v < -9.5, `blows south, got v=${r.v}`);
  assert.ok(Math.abs(r.u) < 1e-6);
});

test("upsampling keeps the corners and interpolates between", async () => {
  const { upsample } = await import("./wx-map.ts");
  const g2 = { lat0: 0, lng0: 0, dLat: 1, dLng: 1, nx: 2, ny: 2 };
  const u = upsample(g2, [0, 4, 8, 12], 4);
  assert.equal(u.grid.nx, 5);
  assert.equal(u.values[0], 0);
  assert.equal(u.values[24], 12);
  assert.equal(u.values[2], 2); // halfway along the bottom edge
});
