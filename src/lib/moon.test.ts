import { test } from "node:test";
import assert from "node:assert/strict";
import { moonInfo, moonNote, phaseName } from "./moon.ts";

// Reference events (UTC): new moon 2024-01-11 11:57, full moon 2024-01-25 17:54.
const LADY_MUSGRAVE = { lat: -23.9, lng: 152.4 };

test("full and new moon are recognised", () => {
  const full = moonInfo(LADY_MUSGRAVE.lat, LADY_MUSGRAVE.lng, Date.parse("2024-01-25T17:54:00Z"));
  assert.ok(full.illumination > 0.99, `full ${full.illumination}`);
  assert.equal(full.phaseName, "Full moon");
  const nu = moonInfo(LADY_MUSGRAVE.lat, LADY_MUSGRAVE.lng, Date.parse("2024-01-11T11:57:00Z"));
  assert.ok(nu.illumination < 0.01, `new ${nu.illumination}`);
  assert.equal(nu.phaseName, "New moon");
});

test("next rise and set are in the future and within two days", () => {
  const at = Date.parse("2024-01-20T00:00:00Z");
  const m = moonInfo(LADY_MUSGRAVE.lat, LADY_MUSGRAVE.lng, at);
  for (const t of [m.nextRise, m.nextSet]) {
    assert.ok(t != null && t > at && t - at < 2 * 86_400_000);
  }
});

test("phase names and night notes", () => {
  assert.equal(phaseName(0.25), "First quarter");
  assert.equal(phaseName(0.75), "Last quarter");
  assert.equal(phaseName(0.99), "New moon");
  assert.match(moonNote({ illumination: 0.02, phase: 0, phaseName: "", waxing: true, nextRise: null, nextSet: null, upNow: false }), /Dark night/);
});
