import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GPS_LOST_MS,
  HOLD_MS,
  WAKE_GRACE_MS,
  freshGuard,
  isGoodFix,
  stepGuard,
} from "./watch-guard.ts";

const t0 = 1_000_000;

describe("watch guard", () => {
  it("does not call GPS lost because the phone slept", () => {
    let g = freshGuard(t0, true);
    let r = stepGuard(g, {
      now: t0,
      visible: true,
      goodFix: true,
      dragging: false,
      offTrack: false,
      armed: true,
    });
    r = stepGuard(r.state, {
      now: t0 + GPS_LOST_MS + 5_000,
      visible: false,
      goodFix: false,
      dragging: false,
      offTrack: false,
      armed: true,
    });
    assert.equal(r.alarms.gpsLost, false);
  });

  it("waits 60s of no fix while the page is actually running", () => {
    let g = freshGuard(t0, true);
    let r = stepGuard(g, {
      now: t0,
      visible: true,
      goodFix: true,
      dragging: false,
      offTrack: false,
      armed: true,
    });
    r = stepGuard(r.state, {
      now: t0 + 20_000,
      visible: true,
      goodFix: false,
      dragging: false,
      offTrack: false,
      armed: true,
    });
    assert.equal(r.alarms.gpsLost, false);
    r = stepGuard(r.state, {
      now: t0 + GPS_LOST_MS + 1_000,
      visible: true,
      goodFix: false,
      dragging: false,
      offTrack: false,
      armed: true,
    });
    assert.equal(r.alarms.gpsLost, true);
  });

  it("gives a grace after waking so GPS can reacquire", () => {
    let g = freshGuard(t0, true);
    let r = stepGuard(g, {
      now: t0,
      visible: true,
      goodFix: true,
      dragging: false,
      offTrack: false,
      armed: true,
    });
    r = stepGuard(r.state, {
      now: t0 + 10_000,
      visible: false,
      goodFix: false,
      dragging: false,
      offTrack: false,
      armed: true,
    });
    r = stepGuard(r.state, {
      now: t0 + GPS_LOST_MS + 30_000,
      visible: true,
      goodFix: false,
      dragging: false,
      offTrack: false,
      armed: true,
    });
    assert.equal(r.alarms.gpsLost, false);
    r = stepGuard(r.state, {
      now: t0 + GPS_LOST_MS + 30_000 + WAKE_GRACE_MS + 1_000,
      visible: true,
      goodFix: false,
      dragging: false,
      offTrack: false,
      armed: true,
    });
    assert.equal(r.alarms.gpsLost, true);
  });

  it("ignores a short wander outside the circle", () => {
    let g = freshGuard(t0, true);
    let r = stepGuard(g, {
      now: t0,
      visible: true,
      goodFix: true,
      dragging: true,
      offTrack: false,
      armed: true,
    });
    r = stepGuard(r.state, {
      now: t0 + HOLD_MS - 2_000,
      visible: true,
      goodFix: true,
      dragging: true,
      offTrack: false,
      armed: true,
    });
    assert.equal(r.alarms.drag, false);
    r = stepGuard(r.state, {
      now: t0 + HOLD_MS - 1_000,
      visible: true,
      goodFix: true,
      dragging: false,
      offTrack: false,
      armed: true,
    });
    assert.equal(r.alarms.drag, false);
    const out = t0 + HOLD_MS + 5_000;
    r = stepGuard(r.state, {
      now: out,
      visible: true,
      goodFix: true,
      dragging: true,
      offTrack: false,
      armed: true,
    });
    assert.equal(r.alarms.drag, false);
    r = stepGuard(r.state, {
      now: out + HOLD_MS + 500,
      visible: true,
      goodFix: true,
      dragging: true,
      offTrack: false,
      armed: true,
    });
    assert.equal(r.alarms.drag, true);
  });

  it("rejects a coarse fix as evidence of drag", () => {
    assert.equal(isGoodFix(120, "gps"), false);
    assert.equal(isGoodFix(12, "gps"), true);
    assert.equal(isGoodFix(8, "demo"), true);
  });

  it("starts the 60s clock when armed with no fix yet", () => {
    let g = freshGuard(t0, true);
    let r = stepGuard(g, {
      now: t0,
      visible: true,
      goodFix: false,
      dragging: false,
      offTrack: false,
      armed: true,
    });
    assert.equal(r.alarms.gpsLost, false);
    r = stepGuard(r.state, {
      now: t0 + GPS_LOST_MS + 1_000,
      visible: true,
      goodFix: false,
      dragging: false,
      offTrack: false,
      armed: true,
    });
    assert.equal(r.alarms.gpsLost, true);
  });

  it("alarms a drag from a fresh fix while the screen is off", () => {
    let g = freshGuard(t0, true);
    let r = stepGuard(g, {
      now: t0,
      visible: true,
      goodFix: true,
      dragging: false,
      offTrack: false,
      armed: true,
    });
    r = stepGuard(r.state, {
      now: t0 + 1_000,
      visible: false,
      goodFix: true,
      dragging: true,
      offTrack: false,
      armed: true,
    });
    assert.equal(r.alarms.drag, false);
    assert.equal(r.alarms.gpsLost, false);
    r = stepGuard(r.state, {
      now: t0 + 1_000 + HOLD_MS + 500,
      visible: false,
      goodFix: true,
      dragging: true,
      offTrack: false,
      armed: true,
    });
    assert.equal(r.alarms.drag, true);
    assert.equal(r.alarms.gpsLost, false);
    r = stepGuard(r.state, {
      now: t0 + 1_000 + HOLD_MS + 1_000,
      visible: false,
      goodFix: true,
      dragging: false,
      offTrack: false,
      armed: true,
    });
    assert.equal(r.alarms.drag, false);
    assert.equal(r.state.dragSince, null);
  });

  it("does not mature a drag from a stale fix while the screen is off", () => {
    let g = freshGuard(t0, true);
    let r = stepGuard(g, {
      now: t0,
      visible: true,
      goodFix: true,
      dragging: true,
      offTrack: false,
      armed: true,
    });
    r = stepGuard(r.state, {
      now: t0 + HOLD_MS + 30_000,
      visible: false,
      goodFix: false,
      dragging: true,
      offTrack: false,
      armed: true,
    });
    assert.equal(r.alarms.drag, false);
    assert.equal(r.alarms.gpsLost, false);
    assert.equal(r.state.dragSince, t0);
  });
});
