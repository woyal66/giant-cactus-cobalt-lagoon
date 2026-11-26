import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WIND_RAMP,
  components,
  contourSegments,
  extremes,
  isobarLevels,
  isobarStep,
  layerIndex,
  layerMax,
  probeAt,
  rampColor,
  valueAt,
  viewGrid,
  smoothLines,
  upsample,
} from "./wx-map.ts";

test("view grid covers the view, stays under 144 points, and snaps", () => {
  const g = viewGrid({ south: -24.2, west: 152.1, north: -23.6, east: 152.7 });
  assert.ok(g.lats.length * g.lngs.length <= 144);
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

test("colour ramp blends between stops and clamps at the ends", () => {
  assert.deepEqual(rampColor(WIND_RAMP, -5), WIND_RAMP[0]![1]);
  assert.deepEqual(rampColor(WIND_RAMP, 99), WIND_RAMP[WIND_RAMP.length - 1]![1]);
  const mid = rampColor([[0, [0, 0, 0]], [10, [100, 200, 50]]], 5);
  assert.deepEqual(mid, [50, 100, 25]);
});

test("isobar spacing adapts to the pressure range; layer max ignores missing data", () => {
  assert.equal(isobarStep([1012, 1013, 1014]), 1);
  assert.equal(isobarStep([1000, 1010]), 2);
  assert.equal(isobarStep([990, 1020]), 4);
  assert.equal(layerMax(new Float32Array([NaN, 2, 5, NaN])), 5);
  assert.ok(Number.isNaN(layerMax(new Float32Array([NaN]))));
});

test("probe reads wind from, gusts and waves at a point; waves reach the coast", () => {
  const n = 4;
  const L = (v: number) => [new Float32Array(n).fill(v)];
  const f = {
    model: "t", lat0: -20, lng0: 150, dLat: 0.1, dLng: 0.1, nx: 2, ny: 2, times: [0],
    windKn: L(15), windDir: L(135), gustKn: L(22),
    waveM: [new Float32Array([1.5, NaN, 1.5, NaN])], waveDir: [new Float32Array([90, NaN, 90, NaN])], wavePer: L(8),
    curKn: L(NaN), curDir: L(NaN),
  } as unknown as Parameters<typeof probeAt>[0];
  const p = probeAt(f, 0, -19.95, 150.05);
  assert.ok(Math.abs(p.windKn! - 15) < 1e-6);
  assert.ok(Math.abs(p.windFrom! - 135) < 1e-6);
  assert.equal(p.gustKn, 22);
  assert.ok(Math.abs(p.waveM! - 1.5) < 1e-6); // half the corners are land: still 1.5 m
  assert.equal(p.curKn, null);
});

test("bicubic upsample passes through every grid value", () => {
  const g = { lat0: 0, lng0: 0, dLat: 1, dLng: 1, nx: 4, ny: 3 };
  const vals = [1010, 1012, 1015, 1013, 1011, 1014, 1018, 1016, 1009, 1012, 1016, 1014];
  const up = upsample(g, vals, 4);
  assert.equal(up.grid.nx, 13);
  assert.equal(up.grid.ny, 9);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) assert.ok(Math.abs(up.values[j * 4 * 13 + i * 4]! - vals[j * 4 + i]!) < 1e-3);
});

test("smoothLines joins contour segments into one line", () => {
  const segs: Array<[{ lat: number; lng: number }, { lat: number; lng: number }]> = [
    [{ lat: 0, lng: 1 }, { lat: 0, lng: 2 }],
    [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }],
    [{ lat: 1, lng: 2 }, { lat: 0, lng: 2 }],
  ];
  const lines = smoothLines(segs, 0);
  assert.equal(lines.length, 1);
  assert.equal(lines[0]!.length, 4);
  const smooth = smoothLines(segs, 2);
  assert.equal(smooth.length, 1);
  assert.ok(smooth[0]!.length > 4);
  assert.deepEqual(smooth[0]![0], lines[0]![0]);
});

test("an L moves smoothly with the low, not grid point by grid point", async () => {
  const { extremesSmooth } = await import("./wx-map.ts");
  const g = { lat0: 0, lng0: 0, dLat: 1, dLng: 1, nx: 9, ny: 9 };
  const field = (cx: number) => {
    const v: number[] = [];
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) v.push(1012 - 12 * Math.exp(-((x - cx) ** 2 + (y - 4) ** 2) / 6));
    return v;
  };
  const xs = [3.6, 4.0, 4.4].map((cx) => {
    const ls = extremesSmooth(g, field(cx)).filter((e) => e.kind === "L");
    assert.equal(ls.length, 1, `one low at ${cx}`);
    return ls[0]!.lng;
  });
  // Each step of 0.4 grid cells moves the L, and close to where the low really is.
  assert.ok(xs[0]! < xs[1]! && xs[1]! < xs[2]!, JSON.stringify(xs));
  assert.ok(Math.abs(xs[0]! - 3.6) < 0.15 && Math.abs(xs[2]! - 4.4) < 0.15, JSON.stringify(xs));
});

test("no H or L on a gentle slope", async () => {
  const { extremesSmooth } = await import("./wx-map.ts");
  const g = { lat0: 0, lng0: 0, dLat: 1, dLng: 1, nx: 6, ny: 6 };
  const v: number[] = [];
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) v.push(1010 + x * 0.5);
  assert.equal(extremesSmooth(g, v).length, 0);
});
