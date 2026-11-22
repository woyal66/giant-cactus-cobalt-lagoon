import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReefFile, simplifyRing } from "./build-reefs.mjs";

test("keeps reefs, drops the mainland, and simplifies outlines", () => {
  const circle = Array.from({ length: 200 }, (_, i) => [152.5 + 0.01 * Math.cos((i / 199) * 2 * Math.PI), -23.5 + 0.01 * Math.sin((i / 199) * 2 * Math.PI)]);
  const geo = {
    type: "FeatureCollection",
    features: [
      { properties: { FEAT_NAME: "Reef" }, geometry: { type: "Polygon", coordinates: [circle] } },
      { properties: { FEAT_NAME: "Mainland" }, geometry: { type: "Polygon", coordinates: [circle] } },
      { properties: { FEAT_NAME: "Cay" }, geometry: { type: "MultiPolygon", coordinates: [[circle], [circle]] } },
    ],
  };
  const f = buildReefFile(geo);
  assert.equal(f.v, 1);
  assert.equal(f.polys.length, 3);
  assert.ok(f.polys[0].length < 200 * 2, String(f.polys[0].length));
  assert.equal(f.polys[0][0], 15251000);
  assert.equal(simplifyRing([[0, 0], [1, 0], [1, 1], [0, 0]], 0.1).length, 4);
});

test("hazard file: kinds, names, delta-encoded rings", async () => {
  const { buildHazardFile } = await import("./build-reefs.mjs");
  const sq = [[146.8, -19.2], [146.81, -19.2], [146.81, -19.19], [146.8, -19.19], [146.8, -19.2]];
  const f = buildHazardFile(
    {
      features: [
        { properties: { FEAT_NAME: "Reef", GBR_NAME: "Test Reef" }, geometry: { type: "Polygon", coordinates: [sq] } },
        { properties: { FEAT_NAME: "Rock", GBR_NAME: "U/N Rock" }, geometry: { type: "Polygon", coordinates: [sq] } },
        { properties: { FEAT_NAME: "Mainland" }, geometry: { type: "Polygon", coordinates: [sq] } },
      ],
    },
    { features: [{ properties: {}, geometry: { type: "MultiPolygon", coordinates: [[sq]] } }] },
  );
  assert.deepEqual(f.items.map((i) => i.k), ["reef", "rock", "dry"]);
  assert.equal(f.items[0].n, "Test Reef");
  assert.equal(f.items[1].n, undefined);
  assert.deepEqual(f.items[0].r[0].slice(0, 4), [14680000, -1920000, 1000, 0]);
});
