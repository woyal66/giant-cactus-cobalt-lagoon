import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendTrail,
  destPoint,
  reverseWaypoints,
  simplifyPath,
  simplifyTrack,
  haversineMeters,
  thinTrail,
  chartBearing,
  hullScreenHeading,
  lerpBearing,
  turnDegrees,
  wrapDegrees,
} from "./geo.ts";

describe("chart up", () => {
  it("turns the short way across north", () => {
    assert.equal(Math.round(turnDegrees(350, 10)), 20);
    assert.equal(Math.round(turnDegrees(10, 350)), -20);
  });

  it("lerps a heading-up spin without going the long way", () => {
    const mid = lerpBearing(350, 10, 0.5);
    assert.ok(mid > 359 || mid < 11);
  });

  it("puts the boat heading at the top in heading-up", () => {
    assert.equal(chartBearing("heading", 125), 125);
    assert.equal(chartBearing("north", 125), 0);
    assert.equal(chartBearing("heading", null), 0);
  });

  it("keeps the hull bow-up when the chart is heading-up", () => {
    assert.equal(hullScreenHeading("heading", 125), 0);
    assert.equal(hullScreenHeading("north", 125), 125);
    assert.equal(wrapDegrees(-10), 350);
  });
});

describe("breadcrumb reverse", () => {
  it("keeps a corner a straight shortcut would cut", () => {
    const pts = [];
    for (let i = 0; i < 40; i++) pts.push({ lat: -23.9, lng: 152.4 + i * 0.00004 });
    const thin = thinTrail(pts, 20);
    assert.ok(thin.length < pts.length);
    const rev = reverseWaypoints(pts);
    assert.equal(rev[0]?.label, "WP 1");
    assert.equal(rev[rev.length - 1]?.label, `WP ${rev.length}`);
    assert.ok(Math.abs((rev[0]?.lng ?? 0) - pts[pts.length - 1]!.lng) < 1e-6);
    assert.ok(Math.abs((rev[rev.length - 1]?.lng ?? 0) - pts[0]!.lng) < 1e-6);
    const a = { lat: -23.9, lng: 152.4 };
    const corner = destPoint(destPoint(a, 0, 40), 90, 12);
    const c = destPoint(a, 0, 80);
    const kept = simplifyPath([a, corner, c], 1);
    assert.equal(kept.length, 3);
    const straight = [];
    for (let i = 0; i < 30; i++) straight.push(destPoint(a, 90, i * 15));
    assert.equal(simplifyTrack(straight).length, 2);
    const bend = [a, destPoint(a, 0, 40), destPoint(destPoint(a, 0, 40), 50, 40)];
    assert.equal(simplifyTrack(bend).length, 3);
  });

  it("GPS wobble on a recorded track does not become waypoints, real corners do", () => {
    const a = { lat: -23.9, lng: 152.4 };
    // 200 m north then 200 m east, a fix every 2 m with up to ±3 m of wobble.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 6;
    const raw = [];
    for (let d = 0; d <= 200; d += 2) raw.push(destPoint(destPoint(a, 0, d), 90, rnd()));
    const corner = destPoint(a, 0, 200);
    for (let d = 2; d <= 200; d += 2) raw.push(destPoint(destPoint(corner, 90, d), 0, rnd()));
    const kept = simplifyTrack(raw);
    assert.ok(kept.length <= 8, `kept ${kept.length} of ${raw.length}`);
    const nearCorner = kept.some((p) => haversineMeters(p, corner) < 6);
    assert.ok(nearCorner, "corner kept");
  });

  it("skips crumbs closer than the step", () => {
    const a = { lat: -23.9, lng: 152.4 };
    const near = { lat: -23.9, lng: 152.40001 };
    const far = { lat: -23.9, lng: 152.401 };
    const one = appendTrail([], a, 8, 10);
    const two = appendTrail(one, near, 8, 10);
    const three = appendTrail(two, far, 8, 10);
    assert.equal(two.length, 1);
    assert.equal(three.length, 2);
  });
});
