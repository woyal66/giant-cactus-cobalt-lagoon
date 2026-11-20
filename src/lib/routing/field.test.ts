import { test } from "node:test";
import assert from "node:assert/strict";
import { conditionsAt, uniformField, type WeatherField } from "./field.ts";

const box = { south: -24, west: 152, north: -23, east: 153 };

test("uniform field reads the same everywhere", () => {
  const f = uniformField({ windKn: 15, windDir: 120, waveM: 1.2 }, box, 0, 6);
  const c = conditionsAt(f, -23.5, 152.5, 2.5 * 3_600_000);
  assert.ok(Math.abs(c.windKn - 15) < 1e-4);
  assert.ok(Math.abs(c.windDir - 120) < 1e-3);
  assert.ok(Math.abs(c.waveM - 1.2) < 1e-4);
});

test("directions average as vectors across north", () => {
  const f = uniformField({ windKn: 10, windDir: 350 }, box, 0, 2);
  f.windDir[1] = new Float32Array(9).fill(10);
  const c = conditionsAt(f, -23.5, 152.5, 0.5 * 3_600_000);
  assert.ok(c.windDir < 1 || c.windDir > 359, String(c.windDir));
});

test("interpolates in time and space, clamps outside the grid", () => {
  const f: WeatherField = uniformField({ windKn: 10, windDir: 90 }, box, 0, 2);
  f.windKn[1] = new Float32Array(9).fill(20);
  assert.ok(Math.abs(conditionsAt(f, -23.5, 152.5, 1_800_000).windKn - 15) < 1e-3);
  assert.ok(Math.abs(conditionsAt(f, -30, 140, 99 * 3_600_000).windKn - 10) < 1e-3); // last layer is hour 2 = 10
});

test("missing marine data reads as calm sea, gust falls back to 1.3x wind", () => {
  const f = uniformField({ windKn: 10, windDir: 90 }, box, 0, 2);
  f.waveM = f.waveM.map(() => new Float32Array(9).fill(NaN));
  f.gustKn = f.gustKn.map(() => new Float32Array(9).fill(NaN));
  const c = conditionsAt(f, -23.5, 152.5, 0);
  assert.equal(c.waveM, 0);
  assert.ok(Math.abs(c.gustKn - 13) < 1e-3);
});
