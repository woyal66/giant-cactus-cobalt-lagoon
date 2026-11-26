import { test } from "node:test";
import assert from "node:assert/strict";
import { keepFix, paceFactor, speedColor, speedSeries, thinPlan, tripCsv, tripGpx, tripStats, type TripFix } from "./trip.ts";

const KN = 0.514444; // m/s per knot
const t0 = Date.parse("2026-11-27T06:14:00+10:00");

/** A trip heading east along a line: `segs` = [minutes, knots] pieces. */
function trip(segs: Array<[number, number]>, everyS = 10): TripFix[] {
  const out: TripFix[] = [];
  let at = t0;
  let lng = 149;
  const lat = -20.3;
  out.push({ at, lat, lng, sog: 0, acc: 5 });
  for (const [min, kn] of segs) {
    const n = Math.round((min * 60) / everyS);
    for (let i = 0; i < n; i++) {
      at += everyS * 1000;
      lng += (kn * KN * everyS) / (111_320 * Math.cos((lat * Math.PI) / 180));
      out.push({ at, lat, lng, sog: kn * KN, acc: 5 });
    }
  }
  return out;
}

test("times, distance and speeds for a simple trip", () => {
  // 10 min stopped, 60 min at 6 kn, a 2-min burst at 8 kn, 20 min stopped.
  const s = tripStats(trip([[10, 0], [60, 6], [2, 8], [20, 0]]))!;
  assert.ok(Math.abs(s.distM / 1852 - (6 + 8 / 30)) < 0.1, `${s.distM / 1852} nm`);
  assert.ok(Math.abs(s.movingMs / 60_000 - 62) < 1.5, `${s.movingMs / 60_000} min moving`);
  assert.ok(Math.abs((s.departAt - t0) / 60_000 - 10) < 1, "departs when it starts moving");
  assert.ok(Math.abs(s.avgMovingKn - 6.06) < 0.15, `avg ${s.avgMovingKn}`);
  assert.ok(s.topKn > 7.5 && s.topKn <= 8.05, `top ${s.topKn}`);
});

test("a GPS jump doesn't become the top speed", () => {
  const f = trip([[30, 5]]);
  const spike = { ...f[100]!, at: f[100]!.at + 2000, lng: f[100]!.lng + 0.01, sog: 60 * KN };
  assert.equal(keepFix(f[100], spike), false);
  // Even if one slipped in, top speed needs 30 s held.
  f.splice(101, 0, { ...spike, sog: 20 * KN });
  const s = tripStats(f)!;
  assert.ok(s.topKn < 7, `top ${s.topKn}`);
});

test("keepFix: vague fixes and too-frequent ones are dropped", () => {
  const a: TripFix = { at: t0, lat: -20, lng: 149, sog: 0, acc: 5 };
  assert.equal(keepFix(a, { ...a, at: t0 + 2000, lng: 149.001 }), false); // 2 s later
  assert.equal(keepFix(a, { ...a, at: t0 + 6000, lng: 149.001 }), true);
  assert.equal(keepFix(a, { ...a, at: t0 + 6000, lng: 149.001, acc: 80 }), false);
  assert.equal(keepFix(a, { ...a, at: t0 + 31_000 }), true); // standing still: every 30 s
});

test("against the plan: late departure and arrival, checkpoints, distance off", () => {
  const f = trip([[60, 6]]);
  const plannedStart = t0 - 14 * 60_000; // planned 06:00, left 06:14
  const pts = f.filter((_, i) => i % 30 === 0).map((p, i) => ({ lat: p.lat, lng: p.lng, at: plannedStart + i * 300_000 }));
  const plan = { title: "Plan", departAt: plannedStart, arriveAt: pts[pts.length - 1]!.at, distM: 11_100, points: thinPlan(pts) };
  const s = tripStats(f, plan)!;
  assert.equal(s.plan!.departLateMin, 14);
  assert.ok(Math.abs(s.plan!.arriveLateMin - 14) <= 1);
  assert.ok(s.plan!.maxOffM < 5);
  assert.ok(s.plan!.onRoutePct > 90);
  assert.ok(s.plan!.checkpoints.length >= 3 && s.plan!.checkpoints.every((c) => Math.abs(c.lateMin - 14) <= 1));
});

test("series, colours and exports", () => {
  const f = trip([[20, 4], [20, 7]]);
  const ser = speedSeries(f, 50);
  assert.equal(ser.length, 50);
  assert.ok(ser[0]!.kn < ser[49]!.kn);
  assert.notEqual(speedColor(1, 8), speedColor(8, 8));
  const gpx = tripGpx("Trip <1>", f);
  assert.match(gpx, /<time>2026-11-26T20:14:00.000Z<\/time>/);
  assert.match(gpx, /Trip &lt;1&gt;/);
  assert.equal(tripCsv(f).trim().split("\n").length, f.length + 1);
});

test("pace factor from trips that followed a plan", () => {
  const mk = (actualKn: number) => ({
    stats: { distM: actualKn * 1852, movingMs: 3_600_000, plan: { plannedMs: 3_600_000, plannedDistM: 6 * 1852 } } as never,
  });
  assert.equal(paceFactor([mk(5.4)]), null);
  assert.equal(paceFactor([mk(5.4), mk(5.4), mk(6)]), 0.9);
  assert.equal(paceFactor([mk(20), mk(20)]), 1.3);
});
