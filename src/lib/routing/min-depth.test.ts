import { test } from "node:test";
import assert from "node:assert/strict";
import { mslLimitM, wantedDepthM } from "./min-depth.ts";

test("depth for the router: own figure or draft + 1 m, plus the low-tide drop when asked", () => {
  assert.equal(wantedDepthM({ minDepthM: null, depthAt: "msl" }, 1.8), 2.8);
  assert.equal(wantedDepthM({ minDepthM: 3, depthAt: "msl" }, 1.8), 3);
  assert.equal(mslLimitM({ minDepthM: 3, depthAt: "msl" }, 1.8, -1.6), 3);
  assert.equal(mslLimitM({ minDepthM: 3, depthAt: "low" }, 1.8, -1.6), 4.6);
  // No tide data: mean sea level.
  assert.equal(mslLimitM({ minDepthM: 3, depthAt: "low" }, 1.8, null), 3);
});
