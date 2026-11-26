import { test } from "node:test";
import assert from "node:assert/strict";
import { libraryConfig, likePattern, packPoints, rowToTrack, searchQuery, unpackPoints } from "./track-library.ts";

test("library config needs an https url and a key", () => {
  assert.equal(libraryConfig({}), null);
  assert.equal(libraryConfig({ VITE_TRACK_LIBRARY_URL: "http://x", VITE_TRACK_LIBRARY_KEY: "k" }), null);
  assert.deepEqual(libraryConfig({ VITE_TRACK_LIBRARY_URL: "https://a.supabase.co/", VITE_TRACK_LIBRARY_KEY: "k" }), { url: "https://a.supabase.co", key: "k" });
});

test("search text cannot break the filter", () => {
  assert.equal(likePattern("  Lady (Musgrave), *cut*  "), "*Lady Musgrave cut*");
  assert.equal(likePattern("%%"), "");
  const q = new URLSearchParams(searchQuery("musgrave"));
  assert.match(q.get("or")!, /location\.ilike\.\*musgrave\*/);
  const box = new URLSearchParams(searchQuery("", { s: -24, w: 152, n: -23, e: 153 }));
  assert.deepEqual(box.getAll("lat"), ["gte.-24.0000", "lte.-23.0000"]);
});

test("points round-trip and bad values are dropped", () => {
  const packed = packPoints([{ lat: -23.9123456789, lng: 152.3987654321 }, { lat: NaN, lng: 1 }, { lat: 95, lng: 0 }]);
  assert.deepEqual(packed, [[-23.912346, 152.398765]]);
  assert.deepEqual(unpackPoints([[1, 2], ["x", 3], [1], 5]), [{ lat: 1, lng: 2 }]);
});

test("rows become tracks, broken rows are skipped", () => {
  assert.equal(rowToTrack({ id: 3, lat: 1, lng: 1 }), null);
  const t = rowToTrack({ id: "a", title: "Cut", location: "Lady Musgrave", comment: "High tide only", lat: "-23.9", lng: "152.4", length_m: 820, point_count: 14 });
  assert.equal(t?.lat, -23.9);
  assert.equal(t?.lengthM, 820);
});
