import { test } from "node:test";
import assert from "node:assert/strict";
import { compassPoint, pointOfSail, seaState } from "./explain.ts";

test("plain words for sea, angle and direction", () => {
  assert.equal(seaState(0.8).name, "Slight");
  assert.equal(seaState(1.8).name, "Moderate");
  assert.equal(seaState(7).name, "High");
  assert.equal(pointOfSail(40, false).name, "Close-hauled");
  assert.equal(pointOfSail(95, false).name, "Beam reach");
  assert.equal(pointOfSail(170, false).name, "Running");
  assert.equal(pointOfSail(90, true).name, "Under engine");
  assert.equal(compassPoint(135), "SE");
  assert.equal(compassPoint(-10), "N");
});
