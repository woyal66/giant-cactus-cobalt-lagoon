import { test } from "node:test";
import assert from "node:assert/strict";
import { uniformField, type WeatherField } from "./field.ts";
import { departureTimes, planPassage } from "./plan.ts";
import { DEFAULT_LIMITS } from "./router.ts";
import type { BoatPerf } from "./polar.ts";

const boat: BoatPerf = { type: "cruiser", loaM: 12, motorBelowKn: 3, motorKn: 6 };
const box = { south: -24.5, west: 151.5, north: -22.5, east: 153.5 };
const t0 = Date.parse("2026-11-21T00:00:00Z");
const H = 3_600_000;
const A = { lat: -23.5, lng: 152.0 };
const B = { lat: -23.5, lng: 152.5 };

test("departures every 3 h, widening to fit the cap", () => {
  assert.equal(departureTimes(t0, t0 + 12 * H).length, 5);
  assert.ok(departureTimes(t0, t0 + 72 * H, 8).length <= 8);
  assert.deepEqual(departureTimes(t0, t0), [t0]);
});

test("picks the departure that avoids a gale and reports model spread", () => {
  // A gale for the first 9 hours, then a fair breeze.
  const f: WeatherField = uniformField({ windKn: 15, windDir: 0 }, box, t0, 60);
  for (let i = 0; i <= 9; i += 1) f.windKn[i] = new Float32Array(9).fill(34);
  const g = uniformField({ windKn: 12, windDir: 0 }, box, t0, 60);
  g.model = "gfs";
  const out = planPassage({ start: A, finish: B, windowStart: t0, windowEnd: t0 + 24 * H, fields: [f, g], boat, limits: DEFAULT_LIMITS });
  assert.equal(out.rows[0]!.light, "red");
  assert.ok(out.best.fastest && out.best.fastest.row.departAt >= t0 + 9 * H);
  assert.ok(out.best.safest);
  const later = out.rows.find((r) => r.results.fastest.ok);
  assert.ok(later && later.spreadH != null && later.spreadH > 0);
});
