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

test("government aerial picks the service by where the tile is", async () => {
  const { govRegion, govTileUrl } = await import("./imagery.ts");
  const tile = (lat: number, lng: number, z: number) => {
    const n = 2 ** z;
    const x = Math.floor(((lng + 180) / 360) * n);
    const r = (lat * Math.PI) / 180;
    const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
    return [x, y] as const;
  };
  const [sx, sy] = tile(-33.86, 151.21, 16); // Sydney
  assert.equal(govRegion(sx, sy, 16), "nsw");
  assert.match(govTileUrl(sx, sy, 16), /maps\.six\.nsw\.gov\.au/);
  const [cx, cy] = tile(-16.92, 145.78, 16); // Cairns
  assert.equal(govRegion(cx, cy, 16), "qld");
  assert.match(govTileUrl(cx, cy, 16), /exportImage\?bbox=/);
  const [mx, my] = tile(25.76, -80.19, 15); // Miami
  assert.equal(govRegion(mx, my, 15), "usa");
  assert.equal(govTileUrl(mx, my, 17), ""); // USGS only to z16
  const [fx, fy] = tile(-17.7, 178.0, 14); // Fiji: no free service
  assert.equal(govTileUrl(fx, fy, 14), "");
});
