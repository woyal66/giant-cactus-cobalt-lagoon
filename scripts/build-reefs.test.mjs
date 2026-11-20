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
