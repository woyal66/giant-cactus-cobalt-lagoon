import { test } from "node:test";
import assert from "node:assert/strict";
import { destPoint } from "./geo.ts";
import { formatDuration, measure } from "./measure.ts";

test("measures legs, total and time at speed", () => {
  const a = { lat: -23.9, lng: 152.4 };
  const b = destPoint(a, 90, 1852);
  const c = destPoint(b, 0, 926);
  const m = measure([a, b, c], 6);
  assert.equal(m.legs.length, 2);
  assert.ok(Math.abs(m.legs[0].bearing - 90) < 0.5);
  assert.ok(Math.abs(m.totalM - 2778) < 2);
  assert.ok(Math.abs(m.hours! - 0.25) < 0.001);
  assert.equal(formatDuration(0.25), "15 min");
  assert.equal(formatDuration(2.5), "2 h 30 min");
  assert.equal(measure([a]).totalM, 0);
  assert.equal(measure([a, b]).hours, null);
});
