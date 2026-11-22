import { test } from "node:test";
import assert from "node:assert/strict";
import { capeThreshold, isSquall, thunderRisk, type StormInputs } from "./storm.ts";

const calm: StormInputs = { capeJkg: 200, liftedIndex: 2, cinJkg: NaN, precipMm: 0, gustKn: 15, tempC: 26, code: 1 };

test("CAPE threshold scales with temperature", () => {
  assert.equal(capeThreshold(15), 1000);
  assert.equal(capeThreshold(25), 2000);
  assert.equal(capeThreshold(32), 3000);
});

test("risk climbs from none to severe", () => {
  assert.equal(thunderRisk(calm), 0);
  assert.equal(thunderRisk({ ...calm, capeJkg: 2200 }), 1);
  assert.equal(thunderRisk({ ...calm, capeJkg: 3200, precipMm: 2 }), 2);
  assert.equal(thunderRisk({ ...calm, code: 96, precipMm: 4, gustKn: 40 }), 3);
  assert.equal(thunderRisk({ ...calm, capeJkg: 2600, liftedIndex: -7 }), 3);
  // Same CAPE counts for more in cool air.
  assert.equal(thunderRisk({ ...calm, capeJkg: 1200, tempC: 16 }), 1);
});

test("a strong cap holds storms back", () => {
  assert.equal(thunderRisk({ ...calm, capeJkg: 3200, precipMm: 2, cinJkg: 250 }), 1);
});

test("rain squall needs both heavy rain and strong gusts", () => {
  assert.equal(isSquall({ precipMm: 4, gustKn: 28 }), true);
  assert.equal(isSquall({ precipMm: 4, gustKn: 20 }), false);
  assert.equal(isSquall({ precipMm: 1, gustKn: 30 }), false);
});
