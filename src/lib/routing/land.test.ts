import { test } from "node:test";
import assert from "node:assert/strict";
import { clearAround, isLand, landObstacle, rasterize, shelterAround, type Polygon } from "./land.ts";

const island: Polygon = [[[152.2, -23.6], [152.3, -23.6], [152.3, -23.4], [152.2, -23.4], [152.2, -23.6]]];
const lagoon: Polygon = [
  [[152.6, -23.7], [152.9, -23.7], [152.9, -23.4], [152.6, -23.4], [152.6, -23.7]],
  [[152.7, -23.6], [152.8, -23.6], [152.8, -23.5], [152.7, -23.5], [152.7, -23.6]],
];
const box = { south: -24, west: 152, north: -23, east: 153 };

test("rasterises polygons with holes", () => {
  const m = rasterize([island, lagoon], box, 0.01);
  assert.equal(isLand(m, { lat: -23.5, lng: 152.25 }), true);
  assert.equal(isLand(m, { lat: -23.5, lng: 152.1 }), false);
  assert.equal(isLand(m, { lat: -23.65, lng: 152.65 }), true);
  assert.equal(isLand(m, { lat: -23.55, lng: 152.75 }), false, "hole is water");
});

test("segment test catches a crossing, clearAround frees an anchorage", () => {
  const m = rasterize([island], box, 0.01);
  const blocked = landObstacle(m);
  assert.equal(blocked({ lat: -23.5, lng: 152.1 }, { lat: -23.5, lng: 152.4 }), true);
  assert.equal(blocked({ lat: -23.3, lng: 152.1 }, { lat: -23.3, lng: 152.4 }), false);
  clearAround(m, [{ lat: -23.5, lng: 152.21 }], 2000);
  assert.equal(isLand(m, { lat: -23.5, lng: 152.21 }), false);
  assert.equal(isLand(m, { lat: -23.5, lng: 152.28 }), true);
});

test("shelter: land to the east shelters an anchorage from easterlies only", () => {
  const m = rasterize([island], box, 0.005);
  const s = shelterAround(m, { lat: -23.5, lng: 152.185 }, 3000);
  assert.equal(s[4], true, "east (index 4) is the island");
  assert.equal(s[12], false, "west is open water");
});
