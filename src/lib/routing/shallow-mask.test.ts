import { test } from "node:test";
import assert from "node:assert/strict";
import { markShallow, maskTiles } from "./shallow-mask.ts";

test("cells shallower than the limit are blocked, deep water and missing tiles are not", async () => {
  const m = { south: -20.1, west: 148.9, north: -20.0, east: 149.0, nx: 10, ny: 10, cells: new Uint8Array(100) };
  const r = maskTiles(m);
  assert.ok(r.z >= 6 && r.z <= 12);
  // Seabed: west half 1 m deep, east half 20 m deep.
  const load = async (z: number, x: number) => {
    const size = 64;
    const h = new Float32Array(size * size);
    const n = 2 ** z;
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const lng = ((x + (px + 0.5) / size) / n) * 360 - 180;
        h[py * size + px] = lng < 148.95 ? -1 : -20;
      }
    }
    return { size, h };
  };
  const n = await markShallow(m, 3, load);
  assert.ok(n >= 20 && n <= 70, String(n));
  assert.equal(m.cells[0], 1); // west: 1 m deep < 3 m
  assert.equal(m.cells[9], 0); // east: 20 m deep
  const m2 = { ...m, cells: new Uint8Array(100) };
  assert.equal(await markShallow(m2, 3, async () => null), 0);
});
