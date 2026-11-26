import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeOpenPlaces, nearestPlace, placeViewQuery, rowToPlace } from "./place-library.ts";

test("place rows are checked and cleaned", () => {
  assert.equal(rowToPlace({ id: "a", kind: "castle", lat: 1, lng: 1 }), null);
  assert.equal(rowToPlace({ id: "a", kind: "ramp", lat: 91, lng: 1 }), null);
  const p = rowToPlace({ id: "a", kind: "rescue", lat: -20.27, lng: 148.72, name: "  VMR   Whitsunday ", vhf: "16, 81<script>", phone: "07 4946 7207;x" })!;
  assert.equal(p.name, "VMR Whitsunday");
  assert.equal(p.vhf, "16, 81script");
  assert.equal(p.phone, "07 4946 7207x".replace("x", ""));
});

test("open data decodes and the nearest base is found", () => {
  const list = decodeOpenPlaces({
    v: 1,
    credits: ["Test data"],
    rows: [
      [1, -2027000, 14872000, "Shute Harbour ramp", 0],
      [7, -2010000, 14870000, "Base A", 0, "16"],
      [7, -2100000, 14900000, "Base B", 0],
      [99, 0, 0, "bad", 0],
    ],
  });
  assert.equal(list.length, 3);
  assert.equal(list[0]!.kind, "ramp");
  assert.equal(list[0]!.credit, "Test data");
  assert.equal(nearestPlace(list, "rescue", { lat: -20.2, lng: 148.7 })?.name, "Base A");
  assert.equal(nearestPlace(list, "fuel", { lat: -20.2, lng: 148.7 }), null);
});

test("place view query", () => {
  const q = new URLSearchParams(placeViewQuery({ s: -21, w: 148, n: -20, e: 149 }));
  assert.deepEqual(q.getAll("lat"), ["gte.-21.0000", "lte.-20.0000"]);
});

test("AHO chart tile URL", async () => {
  const { arcgisTileUrl, chartsInView } = await import("./official-charts.ts");
  const u = arcgisTileUrl("https://x/ImageServer", 0, 0, 0);
  assert.match(u, /exportImage\?bbox=-20037508\.34,-20037508\.34,20037508\.34,20037508\.34&bboxSR=3857/);
  assert.deepEqual(chartsInView(148, -21, 149, -20).map((c) => c.id), ["aho"]);
});
