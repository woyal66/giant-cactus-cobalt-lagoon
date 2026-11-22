import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeHazards, hazardName, hazardsAlong, hazardsInBox, hazardsNear } from "./hazards.ts";

// A square reef 0.01° (about 1.1 km) across at 146.80–146.81 E, 19.20–19.19 S, and a rock east of it.
const sq = [14680000, -1920000, 1000, 0, 0, 1000, -1000, 0, 0, -1000];
const rock = [14682000, -1919500, 10, 0, 0, 10, -10, 0, 0, -10];
const file = {
  v: 1,
  source: "test",
  items: [
    { k: "reef", n: "Test Reef", c: [14680500, -1919500], b: [14680000, -1920000, 14681000, -1919000], r: [sq] },
    { k: "rock", c: [14682005, -1919495], b: [14682000, -1919500, 14682010, -1919490], r: [rock] },
    { k: "nonsense", c: [0, 0], b: [0, 0, 0, 0], r: [sq] },
  ],
};

test("decodes delta-encoded rings and skips unknown kinds", () => {
  const idx = decodeHazards(file)!;
  assert.equal(idx.items.length, 2);
  const r = idx.items[0]!.rings[0]!;
  assert.deepEqual([...r.slice(0, 4)].map((v) => +v.toFixed(5)), [146.8, -19.2, 146.81, -19.2]);
  assert.equal(decodeHazards({ v: 2 }), null);
});

test("inside a reef is distance 0; the rock is found nearby; far away finds nothing", () => {
  const idx = decodeHazards(file)!;
  assert.equal(hazardsNear(idx, -19.195, 146.805, 100)[0]!.distM, 0);
  const near = hazardsNear(idx, -19.195, 146.8195, 300);
  assert.equal(near[0]!.hazard.kind, "rock");
  assert.ok(near[0]!.distM > 50 && near[0]!.distM < 150, String(near[0]!.distM));
  assert.equal(hazardsNear(idx, -19.5, 147.2, 500).length, 0);
  assert.equal(hazardsInBox(idx, 146.0, -19.3, 146.9, -19.1).length, 2);
});

test("a route across the reef reports it once; one around it reports nothing", () => {
  const idx = decodeHazards(file)!;
  const across = hazardsAlong(idx, [{ lat: -19.195, lng: 146.79 }, { lat: -19.195, lng: 146.815 }]);
  assert.equal(across.length, 1);
  assert.equal(across[0]!.distM, 0);
  assert.equal(hazardName(across[0]!.hazard), "Test Reef (reef)");
  const clear = hazardsAlong(idx, [{ lat: -19.21, lng: 146.79 }, { lat: -19.21, lng: 146.83 }]);
  assert.equal(clear.length, 0);
});
