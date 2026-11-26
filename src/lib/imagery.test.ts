import { test } from "node:test";
import assert from "node:assert/strict";
import { autoSatOrder, isImageryId, parseGoogleSession, satTileTemplate } from "./imagery.ts";

test("Google sessions are kept only while more than a day is left", () => {
  const now = Date.UTC(2026, 10, 25);
  const inTwoWeeks = Math.floor((now + 14 * 86_400_000) / 1000);
  assert.deepEqual(parseGoogleSession({ session: "abc", expiry: String(inTwoWeeks) }, now), { session: "abc", expiry: inTwoWeeks * 1000 });
  assert.equal(parseGoogleSession({ session: "abc", expiry: String(Math.floor((now + 3_600_000) / 1000)) }, now), null);
  assert.equal(parseGoogleSession({ expiry: "1" }, now), null);
  assert.equal(parseGoogleSession(null, now), null);
});

test("new sources are valid ids, and none appear without their key", () => {
  assert.ok(isImageryId("mapbox") && isImageryId("here"));
  assert.ok(!autoSatOrder(18).includes("mapbox"));
  assert.ok(!autoSatOrder(18).includes("here"));
  assert.ok(satTileTemplate("mapbox")?.includes("mapbox.satellite"));
});
