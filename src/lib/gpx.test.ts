import { test } from "node:test";
import assert from "node:assert/strict";
import { gpxFileName, toGpx } from "./gpx.ts";

test("toGpx writes a route and a track with escaped names", () => {
  const xml = toGpx("Lady Musgrave <in> & out", [
    { lat: -23.9, lng: 152.39, label: "Outer cut" },
    { lat: -23.905, lng: 152.396 },
  ], new Date("2026-11-20T00:00:00Z"));
  assert.match(xml, /<gpx version="1.1"/);
  assert.match(xml, /<name>Lady Musgrave &lt;in&gt; &amp; out<\/name>/);
  assert.match(xml, /<rtept lat="-23.9000000" lon="152.3900000"><name>Outer cut<\/name>/);
  assert.match(xml, /<name>WP002<\/name>/);
  assert.equal((xml.match(/<trkpt /g) ?? []).length, 2);
});

test("toGpx drops broken points", () => {
  const xml = toGpx("x", [{ lat: Number.NaN, lng: 1 }, { lat: 1, lng: 2 }]);
  assert.equal((xml.match(/<trkpt /g) ?? []).length, 1);
});

test("gpxFileName is safe for every filesystem", () => {
  assert.equal(gpxFileName("Lady Musgrave / Outer cut!"), "Lady-Musgrave-Outer-cut.gpx");
  assert.equal(gpxFileName(""), "track.gpx");
});
