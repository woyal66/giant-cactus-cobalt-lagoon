import { test } from "node:test";
import assert from "node:assert/strict";
import { rowToAnchorage, shelterText, shelteredFrom, viewQuery } from "./anchorage-library.ts";

test("rows are checked and cleaned", () => {
  assert.equal(rowToAnchorage({ id: "a", lat: 95, lng: 0 }), null);
  const a = rowToAnchorage({ id: "a", lat: "-20.1", lng: "148.9", depth_m: 6, bottom: "sand", holding: "good", shelter: 0b00000111, comment: "Good in SE trades" })!;
  assert.equal(a.bottom, "sand");
  assert.equal(a.depthM, 6);
  const b = rowToAnchorage({ id: "b", lat: 0, lng: 0, bottom: "lava", holding: "?", depth_m: -3 })!;
  assert.equal(b.bottom, "unknown");
  assert.equal(b.holding, "fair");
  assert.equal(b.depthM, null);
});

test("shelter bits read as compass points", () => {
  assert.equal(shelterText(0), "Shelter not noted");
  assert.equal(shelterText(255), "Sheltered all round");
  assert.equal(shelterText(0b00001100), "Sheltered from E, SE");
  assert.ok(shelteredFrom(0b00001000, 130)); // SE
  assert.ok(!shelteredFrom(0b00001000, 0));
});

test("view query filters by the box", () => {
  const q = new URLSearchParams(viewQuery({ s: -21, w: 148, n: -20, e: 149 }));
  assert.deepEqual(q.getAll("lng"), ["gte.148.0000", "lte.149.0000"]);
});
