import { test } from "node:test";
import assert from "node:assert/strict";
import { uniformField, type WeatherField } from "./field.ts";
import { departureTimes, findWindows, planPassage } from "./plan.ts";
import { DEFAULT_LIMITS } from "./router.ts";
import type { BoatPerf } from "./polar.ts";

const boat: BoatPerf = { type: "mono", loaM: 12, motorBelowKn: 3, motorKn: 6 };
const box = { south: -24.5, west: 151.5, north: -22.5, east: 153.5 };
const t0 = Date.parse("2026-11-21T00:00:00Z");
const H = 3_600_000;
const A = { lat: -23.5, lng: 152.0 };
const B = { lat: -23.5, lng: 152.5 };

test("hourly departures, widening to fit the cap", () => {
  assert.equal(departureTimes(t0, t0 + 6 * H).length, 7);
  assert.equal(departureTimes(t0, t0 + 12 * H).length, 13); // hourly
  assert.equal(departureTimes(t0, t0 + 24 * H).length, 13); // 2 h steps
  assert.ok(departureTimes(t0, t0 + 72 * H).length <= 13);
  assert.deepEqual(departureTimes(t0, t0), [t0]);
});

test("catches the fair tide", () => {
  // Tidal stream flips every 6 h: east-going (fair for an eastward trip) for hours 0-5, 12-17...
  const f: WeatherField = uniformField({ windKn: 14, windDir: 0 }, box, t0, 48);
  for (let i = 0; i <= 48; i += 1) {
    f.curKn[i] = new Float32Array(9).fill(2);
    f.curDir[i] = new Float32Array(9).fill(Math.floor(i / 6) % 2 === 0 ? 90 : 270);
  }
  const out = planPassage({ start: A, finish: B, windowStart: t0 + 3 * H, windowEnd: t0 + 9 * H, fields: [f], boat, limits: DEFAULT_LIMITS });
  const best = out.best.fastest!;
  const hourOfDay = (best.row.departAt - t0) / H;
  assert.ok(hourOfDay >= 6 || hourOfDay <= 3 || best.result.metrics.avgCurrentKn > 0, `left at +${hourOfDay} h`);
  const worst = out.rows.filter((r) => r.results.fastest.ok).map((r) => (r.results.fastest as { metrics: { hours: number } }).metrics.hours);
  assert.ok(best.result.metrics.hours < Math.max(...worst) - 0.3, "tide timing should matter");
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

test("window finder groups good departures and ranks a calm window first", () => {
  // Three days: a gale on day 1 (hours 0-30), then a fair breeze.
  const f: WeatherField = uniformField({ windKn: 14, windDir: 0 }, box, t0, 96);
  for (let i = 0; i <= 30; i += 1) f.windKn[i] = new Float32Array(9).fill(36);
  const scan = findWindows({ start: A, finish: B, from: t0, to: t0 + 72 * H, fields: [f], boat, limits: DEFAULT_LIMITS });
  assert.ok(scan.slots.length >= 20);
  assert.equal(scan.slots[0]!.light, "red");
  const best = scan.windows[0]!;
  assert.ok(best.from >= t0 + 27 * H, `best window starts +${(best.from - t0) / H} h`);
  assert.equal(best.confidence, best.leadDays <= 3 ? "good" : "fair");
});

test("routes through the skipper's waypoints in order, legs back to back", async () => {
  const { routeVia } = await import("./plan.ts");
  const f: WeatherField = uniformField({ windKn: 14, windDir: 0 }, box, t0, 48);
  const via = [{ lat: -23.3, lng: 152.25 }];
  const direct = routeVia({ start: A, finish: B, departAt: t0, field: f, boat, mode: "fastest", limits: DEFAULT_LIMITS });
  const r = routeVia({ start: A, finish: B, via, departAt: t0, field: f, boat, mode: "fastest", limits: DEFAULT_LIMITS });
  assert.ok(r.ok && direct.ok);
  // Passes close to the waypoint and takes longer than going straight.
  const near = Math.min(...r.points.map((p) => Math.hypot(p.lat - via[0]!.lat, p.lng - via[0]!.lng)));
  assert.ok(near < 0.01, `closest ${near}`);
  assert.ok(r.arriveAt > direct.arriveAt);
  assert.equal(r.departAt, t0);
  // Times never go backwards across the join.
  for (let i = 1; i < r.points.length; i += 1) assert.ok(r.points[i]!.at >= r.points[i - 1]!.at);
  // The plan carries the waypoints through.
  const out = planPassage({ start: A, finish: B, via, windowStart: t0, windowEnd: t0, fields: [f], boat, limits: DEFAULT_LIMITS });
  assert.ok(out.best.fastest!.result.arriveAt > direct.arriveAt);
});

test("re-routing underway keeps only the waypoints still ahead", async () => {
  const { remainingVia } = await import("./plan.ts");
  const via = [{ lat: -23.5, lng: 152.1 }, { lat: -23.5, lng: 152.3 }];
  const fin = { lat: -23.5, lng: 152.5 };
  assert.equal(remainingVia({ lat: -23.5, lng: 152.0 }, via, fin).length, 2); // not there yet
  assert.equal(remainingVia({ lat: -23.5, lng: 152.15 }, via, fin).length, 1); // past the first
  assert.equal(remainingVia({ lat: -23.5, lng: 152.4 }, via, fin).length, 0); // past both
});
