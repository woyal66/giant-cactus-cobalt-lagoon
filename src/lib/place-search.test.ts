import { test } from "node:test";
import assert from "node:assert/strict";
import { nearestPlaceName, searchPlaces, zoomToFit } from "./place-search.ts";

test("search finds named features passed in and tide ports", () => {
  const extra = [{ name: "Lady Musgrave Reef", detail: "Reef", lat: -23.9, lng: 152.4, zoom: 14, kind: "reef" as const }];
  assert.ok(searchPlaces("lady musg", extra).some((p) => p.name === "Lady Musgrave Reef"));
  assert.ok(searchPlaces("lady", extra).every((p) => p.name.toLowerCase().includes("lady")));
  assert.deepEqual(searchPlaces("x"), []);
});

test("nearest place labels a spot, blank when nothing is close", () => {
  const named = [{ name: "Lady Musgrave Reef", lat: -23.9, lng: 152.4 }];
  assert.equal(nearestPlaceName(-23.91, 152.41, named), "Lady Musgrave Reef");
  assert.equal(nearestPlaceName(0, 0, named), "");
});

test("zoom to fit gets closer for a short track", () => {
  const short = zoomToFit([{ lat: -23.9, lng: 152.4 }, { lat: -23.902, lng: 152.402 }])!;
  const long = zoomToFit([{ lat: -23.9, lng: 152.4 }, { lat: -23.0, lng: 151.4 }])!;
  assert.ok(short.zoom > long.zoom);
  assert.equal(zoomToFit([]), null);
});
