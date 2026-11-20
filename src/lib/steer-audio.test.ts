import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifySteer, steerGapMs } from "./steer-audio.ts";

describe("steer by ear", () => {
  it("stays a plain tick inside 2 m and names the correction past it", () => {
    assert.equal(classifySteer(0.4, false), "plain");
    assert.equal(classifySteer(1.8, false), "plain");
    assert.equal(classifySteer(2.2, false), "port");
    assert.equal(classifySteer(-3, false), "starboard");
  });

  it("does not flicker back to plain until inside 1.4 m", () => {
    assert.equal(classifySteer(1.6, true), "port");
    assert.equal(classifySteer(-1.5, true), "starboard");
    assert.equal(classifySteer(1.2, true), "plain");
  });

  it("speeds up as you leave the line", () => {
    assert.ok(steerGapMs("port", 6) < steerGapMs("port", 2.2));
    assert.equal(steerGapMs("plain", 0), 2000);
  });
});
