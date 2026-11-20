import { test } from "node:test";
import assert from "node:assert/strict";
import { haversineMeters } from "../geo.ts";
import { uniformField } from "./field.ts";
import { DEFAULT_LIMITS, route, windAgainstCurrent } from "./router.ts";
import type { BoatPerf } from "./polar.ts";

const boat: BoatPerf = { type: "cruiser", loaM: 12, motorBelowKn: 0, motorKn: 6 };
const box = { south: -24.5, west: 151.5, north: -22.5, east: 153.5 };
const t0 = Date.parse("2026-11-21T00:00:00Z");
const A = { lat: -23.5, lng: 152.0 };
const EAST = { lat: -23.5, lng: 152.5 }; // ~27.5 nm east
const NORTH = { lat: -23.05, lng: 152.0 }; // ~27 nm north

function ok<T extends { ok: boolean }>(r: T): asserts r is T & { ok: true } {
  assert.ok(r.ok, JSON.stringify(r));
}

test("beam reach goes nearly straight at polar speed", () => {
  const field = uniformField({ windKn: 15, windDir: 0 }, box, t0, 48);
  const r = route({ start: A, finish: EAST, departAt: t0, field, boat, mode: "fastest", limits: DEFAULT_LIMITS });
  ok(r);
  const direct = haversineMeters(A, EAST) / 1852;
  assert.ok(r.metrics.hours > direct / 8.5 && r.metrics.hours < direct / 6.5, `${r.metrics.hours} h`);
  assert.ok(r.metrics.distanceNm < direct * 1.05, `${r.metrics.distanceNm} nm`);
  assert.equal(r.points[r.points.length - 1]!.lat, EAST.lat);
});

test("dead upwind it tacks, sails further and takes longer", () => {
  const field = uniformField({ windKn: 15, windDir: 0 }, box, t0, 48);
  const r = route({ start: A, finish: NORTH, departAt: t0, field, boat, mode: "fastest", limits: DEFAULT_LIMITS });
  ok(r);
  const direct = haversineMeters(A, NORTH) / 1852;
  assert.ok(r.metrics.distanceNm > direct * 1.25, `${r.metrics.distanceNm} vs ${direct}`);
  assert.ok(r.metrics.upwindPct >= 80);
  const offLine = Math.max(...r.points.map((p) => Math.abs(p.lng - A.lng)));
  assert.ok(offLine > 0.05, "should leave the rhumb line to tack");
});

test("wind over the limit means no route, unless limits allow it", () => {
  const field = uniformField({ windKn: 30, windDir: 0 }, box, t0, 48);
  const r = route({ start: A, finish: EAST, departAt: t0, field, boat, mode: "fastest", limits: DEFAULT_LIMITS });
  assert.equal(r.ok, false);
  const r2 = route({ start: A, finish: EAST, departAt: t0, field, boat, mode: "fastest", limits: { ...DEFAULT_LIMITS, maxWindKn: 35, maxGustKn: 45 } });
  ok(r2);
});

test("goes around an obstacle", () => {
  const field = uniformField({ windKn: 15, windDir: 0 }, box, t0, 48);
  // A wall at lng 152.25 from lat -23.62 to -23.38.
  const wall = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    if ((a.lng - 152.25) * (b.lng - 152.25) > 0) return false;
    const t = (152.25 - a.lng) / (b.lng - a.lng || 1e-9);
    const lat = a.lat + (b.lat - a.lat) * t;
    return lat > -23.62 && lat < -23.38;
  };
  const r = route({ start: A, finish: EAST, departAt: t0, field, boat, mode: "fastest", limits: DEFAULT_LIMITS, obstacle: wall });
  ok(r);
  for (let i = 1; i < r.points.length; i += 1) assert.equal(wall(r.points[i - 1]!, r.points[i]!), false);
  assert.ok(r.metrics.distanceNm > haversineMeters(A, EAST) / 1852 + 1);
});

test("a fair current makes it faster", () => {
  const calm = uniformField({ windKn: 12, windDir: 0 }, box, t0, 48);
  const fair = uniformField({ windKn: 12, windDir: 0, curKn: 2, curDir: 90 }, box, t0, 48);
  const a = route({ start: A, finish: EAST, departAt: t0, field: calm, boat, mode: "fastest", limits: DEFAULT_LIMITS });
  const b = route({ start: A, finish: EAST, departAt: t0, field: fair, boat, mode: "fastest", limits: DEFAULT_LIMITS });
  ok(a);
  ok(b);
  assert.ok(b.metrics.hours < a.metrics.hours * 0.85);
});

test("comfort is never faster than fastest, and the engine runs in a calm", () => {
  const field = uniformField({ windKn: 15, windDir: 0, waveM: 2 }, box, t0, 48);
  const f = route({ start: A, finish: NORTH, departAt: t0, field, boat, mode: "fastest", limits: DEFAULT_LIMITS });
  const c = route({ start: A, finish: NORTH, departAt: t0, field, boat, mode: "comfort", limits: DEFAULT_LIMITS });
  ok(f);
  ok(c);
  assert.ok(c.metrics.hours >= f.metrics.hours - 0.05);
  const calm = uniformField({ windKn: 2, windDir: 0 }, box, t0, 48);
  const m = route({ start: A, finish: EAST, departAt: t0, field: calm, boat: { ...boat, motorBelowKn: 3 }, mode: "fastest", limits: DEFAULT_LIMITS });
  ok(m);
  assert.ok(m.metrics.motorHours > 3);
});

test("wind against current is detected", () => {
  assert.equal(windAgainstCurrent({ windKn: 18, windDir: 0, curKn: 2, curDir: 0 }), true);
  assert.equal(windAgainstCurrent({ windKn: 18, windDir: 0, curKn: 2, curDir: 180 }), false);
});

test("night arrival is flagged", () => {
  const field = uniformField({ windKn: 15, windDir: 0 }, box, t0, 48);
  const r = route({ start: A, finish: EAST, departAt: t0, field, boat, mode: "fastest", limits: DEFAULT_LIMITS, isDay: () => false });
  ok(r);
  assert.equal(r.metrics.arrivesInDark, true);
  assert.match(r.warnings.join(" "), /after dark/);
});

test("prefers a few long tacks to a zigzag", () => {
  const field = uniformField({ windKn: 15, windDir: 0 }, box, t0, 48);
  const r = route({ start: A, finish: NORTH, departAt: t0, field, boat, mode: "fastest", limits: DEFAULT_LIMITS });
  ok(r);
  let tacks = 0;
  for (let i = 2; i < r.points.length; i += 1) {
    const s1 = Math.sign(r.points[i - 1]!.lng - r.points[i - 2]!.lng);
    const s2 = Math.sign(r.points[i]!.lng - r.points[i - 1]!.lng);
    if (s1 && s2 && s1 !== s2) tacks += 1;
  }
  assert.ok(tacks <= 4, `${tacks} tacks`);
});
