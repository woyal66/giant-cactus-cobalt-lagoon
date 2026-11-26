import { test } from "node:test";
import assert from "node:assert/strict";
import { findChannel, type DepthGrid } from "./channel.ts";

// 60 × 60 cells over about 3 km. A bank 1 m deep runs north–south across the middle with a
// 4-cell channel 8 m deep through it near the top; deep water (15 m) either side.
function bankWithChannel(): DepthGrid {
  const nx = 60, ny = 60;
  const depth = new Float32Array(nx * ny).fill(15);
  for (let y = 0; y < ny; y++) for (let x = 26; x < 34; x++) depth[y * nx + x] = y >= 44 && y < 48 ? 8 : 1;
  return { south: -23.5, west: 152.0, north: -23.473, east: 152.03, nx, ny, depth, land: new Uint8Array(nx * ny) };
}

const A = { lat: -23.495, lng: 152.003 };
const B = { lat: -23.495, lng: 152.027 };

test("finds the channel through a bank too shallow for the boat", () => {
  const g = bankWithChannel();
  const via = findChannel(g, A, B, { minDepthM: 2.8 });
  assert.ok(via && via.length >= 1, "needs turning points");
  // Some turning point sits in the channel's latitude band (rows 44–47).
  const rowOf = (lat: number) => Math.floor(((lat - g.south) / (g.north - g.south)) * g.ny);
  assert.ok(via!.some((p) => rowOf(p.lat) >= 42 && rowOf(p.lat) <= 49), JSON.stringify(via!.map((p) => rowOf(p.lat))));
});

test("no path when the bank has no gap; nothing added when the straight line is deep", () => {
  const g = bankWithChannel();
  for (let y = 44; y < 48; y++) for (let x = 26; x < 34; x++) g.depth[y * g.nx + x] = 1;
  assert.equal(findChannel(g, A, B, { minDepthM: 2.8 }), null);
  const deep = bankWithChannel();
  deep.depth.fill(20);
  assert.deepEqual(findChannel(deep, A, B, { minDepthM: 2.8 }), []);
});

test("land cells are never crossed", () => {
  const g = bankWithChannel();
  // A solid wall of land north to south: no way round inside the grid.
  for (let y = 0; y < g.ny; y++) for (let x = 29; x < 31; x++) g.land[y * g.nx + x] = 1;
  assert.equal(findChannel(g, A, B, { minDepthM: 0.5 }), null);
});
