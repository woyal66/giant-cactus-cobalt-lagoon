import { test } from "node:test";
import assert from "node:assert/strict";
import { haversineMeters, bearingDegrees } from "./geo.ts";
import { driftAt, driftCone, formatDmm } from "./mob.ts";

const mob = { lat: -23.9, lng: 152.4 };

test("drifts with the current plus a little downwind", () => {
  const p = driftAt(mob, 10, { curKn: 1, curDir: 90, windKn: 0, windDir: 0 });
  const d = haversineMeters(mob, p);
  assert.ok(Math.abs(d - 308.7) < 2, String(d)); // 1 kn for 10 min ≈ 309 m
  assert.ok(Math.abs(bearingDegrees(mob, p) - 90) < 1);
  const w = driftAt(mob, 10, { curKn: 0, curDir: 0, windKn: 20, windDir: 0 }); // northerly pushes south
  assert.ok(bearingDegrees(mob, w) > 170 && bearingDegrees(mob, w) < 190);
  assert.ok(haversineMeters(mob, w) < 120);
});

test("the cone widens with time", () => {
  const [a, b, c] = driftCone(mob, { curKn: 1.5, curDir: 45, windKn: 15, windDir: 120 });
  assert.ok(a!.radiusM < b!.radiusM && b!.radiusM < c!.radiusM);
  assert.deepEqual([a!.minutes, b!.minutes, c!.minutes], [5, 10, 20]);
});

test("position for the radio in degrees and decimal minutes", () => {
  assert.equal(formatDmm(-23.904, 152.395), "23°54.24'S 152°23.70'E");
  assert.equal(formatDmm(1.5, -5.25), "01°30.00'N 005°15.00'W");
});
