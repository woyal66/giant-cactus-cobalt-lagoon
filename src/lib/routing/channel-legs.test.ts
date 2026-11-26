import { test } from "node:test";
import assert from "node:assert/strict";
import { planChannels } from "./channel-legs.ts";
import { routeVia } from "./plan.ts";
import { uniformField } from "./field.ts";
import { DEFAULT_LIMITS } from "./router.ts";
import type { BoatPerf } from "./polar.ts";

// A seabed: deep (15 m) water with a bank 1 m deep running north–south at lng 152.010–152.016,
// and a gap 8 m deep through it between lat −23.488 and −23.485.
function seabed(lat: number, lng: number): number {
  const onBank = lng > 152.01 && lng < 152.016;
  if (!onBank) return -15;
  return lat > -23.488 && lat < -23.485 ? -8 : -1;
}
const load = async (z: number, x: number, y: number) => {
  const size = 128;
  const h = new Float32Array(size * size);
  const n = 2 ** z;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const lng = ((x + (i + 0.5) / size) / n) * 360 - 180;
      const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + (j + 0.5) / size)) / n))) * 180) / Math.PI;
      h[j * size + i] = seabed(lat, lng);
    }
  }
  return { size, h };
};

const A = { lat: -23.495, lng: 152.0 };
const B = { lat: -23.495, lng: 152.026 };

test("adds turning points through the gap in a bank, and the route keeps to them", async () => {
  const plan = await planChannels([A, B], 2.8, [], null, load);
  assert.ok(plan.added >= 1, "should add waypoints");
  assert.equal(plan.legObstacles.length, plan.via.length + 1);
  // Some waypoint is at the gap's latitude.
  assert.ok(plan.via.some((p) => p.lat > -23.4895 && p.lat < -23.4835), JSON.stringify(plan.via));

  const boat: BoatPerf = { type: "motor", loaM: 10, motorBelowKn: 0, motorKn: 6 };
  const box = { south: -23.6, west: 151.9, north: -23.4, east: 152.1 };
  const t0 = Date.parse("2026-11-21T00:00:00Z");
  const field = uniformField({ windKn: 10, windDir: 90 }, box, t0, 24);
  const r = routeVia({ start: A, finish: B, via: plan.via, legObstacles: plan.legObstacles, departAt: t0, field, boat, mode: "fastest", limits: DEFAULT_LIMITS });
  assert.ok(r.ok, r.ok ? "" : r.reason);
  // Where the route crosses the bank's longitudes it is inside the gap.
  for (const p of r.points) {
    if (p.lng > 152.0105 && p.lng < 152.0155) assert.ok(p.lat > -23.4895 && p.lat < -23.4835, `on the bank at ${p.lat}`);
  }
});

test("nothing added over deep water; offshore legs are left to the coarse grid", async () => {
  const deep = async (_z: number, _x: number, _y: number) => ({ size: 16, h: new Float32Array(256).fill(-40) });
  const plan = await planChannels([A, B], 2.8, [], null, deep);
  assert.equal(plan.added, 0);
  assert.equal(plan.checked, 1);
  const far = await planChannels([A, { lat: -22.5, lng: 153 }], 2.8, [], null, deep);
  assert.equal(far.checked, 0);
});
