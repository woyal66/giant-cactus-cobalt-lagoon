import { test } from "node:test";
import assert from "node:assert/strict";
import { dedupeLines, parseGpx } from "./gpx-import.ts";
import { toGpx } from "./gpx.ts";

test("reads a route with names and entities", () => {
  const xml = `<?xml version="1.0"?><gpx version="1.1" creator="x"><rte><name>Reef &amp; back</name>
    <rtept lat="-23.9" lon="152.39"><name>Start</name></rtept>
    <rtept lat='-23.91' lon='152.40'/></rte></gpx>`;
  const [r] = parseGpx(xml);
  assert.equal(r!.name, "Reef & back");
  assert.equal(r!.kind, "route");
  assert.deepEqual(r!.points, [{ lat: -23.9, lng: 152.39, label: "Start" }, { lat: -23.91, lng: 152.4 }]);
});

test("reads tracks across segments and skips bad points", () => {
  const xml = `<gpx><trk><name>Log</name><trkseg><trkpt lat="1" lon="2"></trkpt><trkpt lat="x" lon="2"/></trkseg>
    <trkseg><trkpt lat="1.001" lon="2.001"><ele>0</ele></trkpt></trkseg></trk></gpx>`;
  const [t] = parseGpx(xml);
  assert.equal(t!.points.length, 2);
  assert.equal(t!.name, "Log");
});

test("falls back to waypoints, rejects non-GPX", () => {
  const xml = `<gpx><wpt lat="1" lon="2"><name>A</name></wpt><wpt lat="1.1" lon="2.1"/></gpx>`;
  assert.equal(parseGpx(xml)[0]!.kind, "waypoints");
  assert.throws(() => parseGpx("<kml></kml>"), /isn't a GPX/);
  assert.throws(() => parseGpx("<gpx></gpx>"), /No route or track/);
});

test("our own export round-trips to one line", () => {
  const xml = toGpx("Lady M", [{ lat: -23.9, lng: 152.39 }, { lat: -23.91, lng: 152.4 }]);
  const lines = dedupeLines(parseGpx(xml));
  assert.equal(lines.length, 1);
  assert.equal(lines[0]!.name, "Lady M");
});

test("thins a huge logged track", () => {
  const pts = Array.from({ length: 6000 }, (_, i) => `<trkpt lat="${(-23.9 + i * 0.00002).toFixed(6)}" lon="152.4"/>`).join("");
  const [t] = parseGpx(`<gpx><trk><trkseg>${pts}</trkseg></trk></gpx>`);
  assert.ok(t!.points.length <= 2000 && t!.points.length > 100, String(t!.points.length));
});
