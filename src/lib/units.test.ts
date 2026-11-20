import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatDepth,
  formatLength,
  fromDepth,
  fromLength,
  setUnits,
  toDepth,
} from "./units.ts";
import { formatMeters } from "./geo.ts";

test("depth converts both ways", () => {
  assert.equal(Math.round(toDepth(10, "ft") * 100) / 100, 32.81);
  assert.equal(Math.round(toDepth(18.288, "fm") * 100) / 100, 10);
  assert.ok(Math.abs(fromDepth(toDepth(7.3, "fm"), "fm") - 7.3) < 1e-9);
  assert.ok(Math.abs(fromLength(100, "ft") - 30.48) < 1e-9);
});

test("formatDepth per unit, with signs", () => {
  assert.equal(formatDepth(8, { unit: "m" }), "8.0 m");
  assert.equal(formatDepth(8, { unit: "ft" }), "26 ft");
  assert.equal(formatDepth(8, { unit: "fm" }), "4.4 fm");
  assert.equal(formatDepth(1.24, { unit: "m", signed: true }), "+1.2 m");
  assert.equal(formatDepth(-0.6, { unit: "m", signed: true }), "−0.6 m");
  assert.equal(formatDepth(0.01, { unit: "m", signed: true }), "0.0 m");
});

test("distances follow the length unit and switch to nm past 1 km", () => {
  setUnits({ length: "m" });
  assert.equal(formatMeters(45), "45 m");
  assert.equal(formatLength(45, "ft"), "148 ft");
  setUnits({ length: "ft" });
  assert.equal(formatMeters(45), "148 ft");
  assert.equal(formatMeters(3704), "2.0 nm");
  setUnits({ length: "m" });
});
