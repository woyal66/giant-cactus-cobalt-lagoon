import { test } from "node:test";
import assert from "node:assert/strict";
import { describeProgress, logToCsv, meaningfulChange, progressOnPlan, upcoming } from "./underway.ts";
import type { RouteMetrics, RoutePoint } from "./router.ts";

const H = 3_600_000;
const t0 = Date.parse("2026-11-21T00:00:00Z");
const pt = (i: number): RoutePoint => ({
  lat: -23.5, lng: 152 + i * 0.05, at: t0 + i * H, windKn: 12, windDir: 90, gustKn: 15, waveM: 1, waveAmp: 1,
  curAlongKn: 0, thunder: 0, squall: false, curKn: 0, curDir: 0, twa: 90, twsKn: 12, tack: 1, stwKn: 6, sogKn: 6, motoring: false,
});
const route = Array.from({ length: 7 }, (_, i) => pt(i));
const metrics: RouteMetrics = {
  hours: 6, distanceNm: 16, maxWindKn: 12, maxGustKn: 15, maxWaveM: 1, upwindPct: 0, motorHours: 0,
  windAgainstCurrentHours: 0, steepSeaHours: 0, maxWaveAmp: 1, avgCurrentKn: 0, maxThunder: 0, thunderHours: 0, squallHours: 0, arrivesInDark: false,
};

test("progress: behind the plan when the boat is late at a planned point", () => {
  const p = progressOnPlan(route, { lat: -23.5, lng: 152.1 }, t0 + 2 * H + 40 * 60_000)!;
  assert.equal(p.index, 2);
  assert.ok(Math.abs(p.behindMin - 40) < 2, String(p.behindMin));
  assert.equal(describeProgress(p), "40 min behind plan");
  assert.equal(describeProgress({ ...p, behindMin: -75 }), "1 h 15 min ahead of plan");
  assert.equal(describeProgress({ ...p, behindMin: 4 }), "On plan");
});

test("upcoming shifts the plan by the delay", () => {
  const now = t0 + 2 * H + 40 * 60_000;
  const p = progressOnPlan(route, { lat: -23.5, lng: 152.1 }, now)!;
  const next = upcoming(route, p, now, 3);
  assert.equal(next[0]!.at, t0 + 2 * H + 40 * 60_000);
  assert.ok(next.every((x) => x.at <= now + 3 * H));
});

test("only meaningful changes are reported", () => {
  const cur = { arriveAt: t0 + 6 * H, metrics, points: route };
  assert.deepEqual(meaningfulChange(cur, { arriveAt: t0 + 6 * H + 10 * 60_000, metrics, points: route }), []);
  assert.match(meaningfulChange(cur, { arriveAt: t0 + 7 * H, metrics, points: route }).join(), /Arrival 60 min later/);
  assert.match(meaningfulChange(cur, { arriveAt: cur.arriveAt, metrics: { ...metrics, maxThunder: 2 }, points: route }).join(), /Storm risk/);
  const moved = route.map((p) => ({ ...p, lat: p.lat + 0.06 }));
  assert.match(meaningfulChange(cur, { arriveAt: cur.arriveAt, metrics, points: moved }).join(), /different way/);
  assert.match(meaningfulChange(cur, { failed: "gale" }).join(), /no route/);
});

test("log exports as CSV", () => {
  const csv = logToCsv([{ at: t0, lat: -23.5, lng: 152, sogKn: 6.2, cogDeg: 91, windKn: 14, windDir: 120, sails: "Full main + Genoa", note: 'reef, "early"' }]);
  assert.match(csv, /^time,lat,lon/);
  assert.match(csv, /2026-11-21T00:00:00.000Z,-23.50000,152.00000,6.2,91,14,120,Full main \+ Genoa,"reef, ""early"""/);
});

test("pace and ETA when sailing slower than planned", async () => {
  const { paceFrom, etaAtPace } = await import("./underway.ts");
  const M = 60_000;
  // 40 real minutes covering 36 planned minutes: 10% slow.
  const samples = [0, 10, 20, 30, 40].map((m) => ({ at: m * M, plannedAt: m * 0.9 * M }));
  const pace = paceFrom(samples)!;
  assert.ok(Math.abs(pace - 0.9) < 1e-9);
  // 3 h of plan left at 90% pace takes 3 h 20 min.
  assert.equal(etaAtPace(36 * M + 180 * M, 36 * M, 40 * M, pace), 40 * M + 200 * M);
  assert.equal(paceFrom(samples.slice(0, 2)), null); // under 20 minutes of data
});
