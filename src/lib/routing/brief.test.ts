import { test } from "node:test";
import assert from "node:assert/strict";
import { exposureLine, passageBrief, stretches } from "./brief.ts";
import { DEFAULT_SAILS } from "./sails.ts";
import { metricsOf, type RoutePoint } from "./router.ts";

const H = 3_600_000;
const t0 = Date.UTC(2026, 5, 1, 0); // 10:00 in Queensland, daylight
const pts: RoutePoint[] = Array.from({ length: 9 }, (_, i) => ({
  lat: -23.9 - i * 0.05,
  lng: 152.4 + i * 0.05,
  at: t0 + i * H,
  windKn: 12 + i,
  windDir: 120,
  gustKn: 16 + i,
  waveM: 1.2,
  waveAmp: i === 4 ? 1.3 : 1,
  curAlongKn: 0.5,
  thunder: i === 6 ? 2 : 0,
  squall: false,
  curKn: 0.5,
  curDir: 200,
  twa: 80,
  twsKn: 12 + i,
  tack: 1,
  stwKn: 6,
  sogKn: 6.5,
  motoring: false,
})) as RoutePoint[];

test("splits the route into about 3-hour stretches with flags", () => {
  const st = stretches(pts);
  assert.equal(st.length, 3);
  assert.match(st[0].wind, /^ESE 12–14 kn, gusts 18$/);
  assert.equal(st[0].sailing, "reaching");
  assert.equal(st[0].current, "+0.5 kn fair");
  assert.ok(st[1].flags.includes("wind over tide"));
  assert.ok(st[2].flags.includes("storm risk likely"));
});

test("brief text has the key sections and positions", () => {
  const b = passageBrief({
    title: "Fastest · Mon 10:00",
    start: pts[0],
    finish: pts[8],
    departAt: t0,
    arriveAt: t0 + 8 * H,
    points: pts,
    metrics: metricsOf(pts),
    warnings: ["Thunderstorms likely for 1 h."],
    sails: DEFAULT_SAILS,
    models: ["ecmwf", "gfs"],
    forecastAt: t0 - 2 * H,
    shelter: Array.from({ length: 16 }, (_, k) => k < 8),
    time: (ms) => `T+${(ms - t0) / H}`,
  });
  for (const s of ["CONDITIONS", "SAILS", "HAZARDS", "POSITIONS", "Thunderstorms likely", "Open to S, SSW", "ECMWF, GFS", "23°54.00'S"]) {
    assert.ok(b.text.includes(s), s);
  }
  assert.match(b.html, /^<!doctype html>/);
  assert.ok(!b.html.includes("<script"));
});

test("exposure line", () => {
  assert.equal(exposureLine(undefined), null);
  assert.match(exposureLine(Array(16).fill(false))!, /no shelter/);
});
