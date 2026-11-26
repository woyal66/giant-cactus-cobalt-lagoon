import { test } from "node:test";
import assert from "node:assert/strict";
import { build, centre, featureName } from "./build-places.mjs";

test("build places from GeoJSON", () => {
  assert.deepEqual(centre({ type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2]]] }), [1, 1]);
  assert.equal(featureName({ SITE_NAME: "  Shute   Harbour " }), "Shute Harbour");
  const out = build([
    { kind: "ramp", credit: "QLD", json: { features: [{ geometry: { type: "Point", coordinates: [148.78, -20.29] }, properties: { NAME: "Shute Harbour" } }, { geometry: null }] } },
  ]);
  assert.deepEqual(out, { v: 1, credits: ["QLD"], rows: [[1, -2029000, 14878000, "Shute Harbour", 0]] });
});
