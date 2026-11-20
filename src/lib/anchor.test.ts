import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_RODE,
  clampRode,
  formatScope,
  hoursUntil,
  hookAstern,
  laybackM,
  boatInsideWatch,
  anchorPollMs,
  ANCHOR_POLL_FAST_MS,
  ANCHOR_POLL_SLOW_MS,
  rodeDropNote,
  rodeMath,
  snapToLayback,
  suggestedPayOutM,
  swingRadiusM,
  fixPreciseForWatch,
  tautHorizM,
  appendSwingTrail,
} from "./anchor.ts";
import { destPoint, haversineMeters } from "./geo.ts";

describe("rodeMath", () => {
  it("warns when 40 m of chain is short of 5:1 after a 2 m rise", () => {
    const math = rodeMath({
      ...DEFAULT_RODE,
      depthM: 6,
      chainM: 40,
      bowM: 1.5,
      loaM: 12,
      chainTotalM: 60,
      scopeTarget: 5,
      tideRiseM: 2,
    });
    assert.equal(math.nowDepthM, 7.5);
    assert.equal(math.hwDepthM, 9.5);
    assert.equal(math.needHwM, 47.5);
    assert.equal(math.shortHwM, 7.5);
    assert.equal(math.status, "short");
    assert.equal(math.scopeHw.toFixed(1), "4.2");
    assert.equal(math.radiusM, 45);
    assert.equal(math.overTotal, false);
    assert.equal(math.laybackM, 32.5);
  });

  it("is critical under 3:1 at high water", () => {
    const math = rodeMath({
      ...DEFAULT_RODE,
      depthM: 10,
      chainM: 20,
      bowM: 1.5,
      tideRiseM: 2,
      scopeTarget: 5,
    });
    assert.equal(math.status, "critical");
    assert.ok(math.scopeHw < 3);
  });

  it("is ok when chain meets 5:1 at HW", () => {
    const math = rodeMath({
      ...DEFAULT_RODE,
      depthM: 6,
      chainM: 48,
      bowM: 1.5,
      tideRiseM: 2,
      scopeTarget: 5,
    });
    assert.equal(math.status, "ok");
    assert.equal(math.shortHwM, 0);
  });

  it("flags when the needed rode is more than what is onboard", () => {
    const math = rodeMath({
      ...DEFAULT_RODE,
      depthM: 8,
      chainM: 40,
      bowM: 1.5,
      chainTotalM: 40,
      tideRiseM: 2,
      scopeTarget: 5,
    });
    assert.equal(math.overTotal, true);
  });

  it("sizes the swing for the shallowest water, not high water", () => {
    const math = rodeMath({
      ...DEFAULT_RODE,
      depthM: 5,
      chainM: 20,
      bowM: 1.5,
      loaM: 12,
      tideRiseM: 3,
    });
    // taut horizontal at 6.5 m (now) is longer than at 9.5 m (HW)
    assert.equal(math.radiusM, swingRadiusM(20, 6.5, 12));
    assert.ok(math.radiusM > swingRadiusM(20, 9.5, 12));
  });

  it("grows the swing when the phone sits 15 m aft of the roller", () => {
    const math = rodeMath(
      {
        ...DEFAULT_RODE,
        depthM: 6,
        chainM: 40,
        bowM: 1.5,
        loaM: 18,
        tideRiseM: 0,
      },
      15,
    );
    assert.equal(math.radiusM, swingRadiusM(40, 7.5, 18, 15));
    assert.ok(math.radiusM >= 54);
  });
});

describe("suggestedPayOutM", () => {
  it("rounds up to the metres needed, capped by chain onboard", () => {
    const rode = {
      ...DEFAULT_RODE,
      depthM: 6,
      chainM: 40,
      bowM: 1.5,
      chainTotalM: 60,
      tideRiseM: 2,
      scopeTarget: 5 as const,
    };
    assert.equal(suggestedPayOutM(rode), 48);
    assert.equal(suggestedPayOutM({ ...rode, chainTotalM: 44 }), 44);
  });
});

describe("swing and copy", () => {
  it("computes a horizontal swing plus half LOA", () => {
    assert.equal(swingRadiusM(40, 9.5, 12), 45);
  });

  it("uses GPS reach when the phone is further aft than midships", () => {
    assert.equal(swingRadiusM(40, 7.5, 18, 15), Math.round(tautHorizM(40, 7.5) + 15));
  });

  it("formats scope and drop notes", () => {
    assert.equal(formatScope(4.21), "4.2:1");
    assert.equal(formatScope(0), "—");
    const short = rodeDropNote({
      ...DEFAULT_RODE,
      depthM: 6,
      chainM: 40,
      tideRiseM: 2,
    });
    assert.match(short ?? "", /short 8 m for 5:1/);
    const t0 = 1_700_000_000_000;
    assert.equal(hoursUntil(t0 + 3 * 3_600_000, t0), "3 h");
    assert.equal(hoursUntil(t0 + 2 * 3_600_000 + 59.6 * 60_000, t0), "3 h");
  });

  it("clamps junk rode values", () => {
    const rode = clampRode({ depthM: -4, chainM: Number.NaN, scopeTarget: 12 as never });
    assert.equal(rode.depthM, 0);
    assert.equal(rode.chainM, DEFAULT_RODE.chainM);
    assert.equal(rode.scopeTarget, 5);
    assert.equal(clampRode({ scopeTarget: 9 }).scopeTarget, 9);
  });
});

describe("layback and snap", () => {
  const rode = {
    ...DEFAULT_RODE,
    depthM: 6,
    chainM: 40,
    bowM: 1.5,
  };
  const boat = { lat: -23.9058, lng: 152.3964 };

  it("is chain on the sand, not the taut hypotenuse", () => {
    assert.equal(laybackM(rode), 32.5);
    assert.equal(laybackM({ ...DEFAULT_RODE, depthM: 8, bowM: 1.5, chainM: 40 }), 30.5);
    assert.equal(laybackM({ ...DEFAULT_RODE, depthM: 10, bowM: 1.5, chainM: 10 }), 0);
  });

  it("keeps √(chain² − depth²) for the taut swing, not the mark", () => {
    assert.equal(tautHorizM(40, 7.5).toFixed(1), "39.3");
    assert.equal(tautHorizM(40, 9.5).toFixed(1), "38.9");
    assert.equal(tautHorizM(10, 10), 0);
  });

  it("locks the hook to that distance — finger only aims", () => {
    const north = destPoint(boat, 0, 120);
    const hooked = snapToLayback(boat, north, rode);
    assert.ok(Math.abs(haversineMeters(boat, hooked) - laybackM(rode)) < 0.6);
    const west = destPoint(boat, 270, 80);
    const hookedW = snapToLayback(boat, west, rode);
    assert.ok(Math.abs(haversineMeters(boat, hookedW) - laybackM(rode)) < 0.6);
  });

  it("places the first ghost astern of the fallen-back bow", () => {
    const ghost = hookAstern({ ...boat, heading: 125 }, rode);
    assert.ok(Math.abs(haversineMeters(boat, ghost) - Math.max(8, laybackM(rode))) < 0.6);
  });
});

describe("alarm zone", () => {
  const hook = { lat: -23.9058, lng: 152.3964 };

  it("uses the circle when no fence is set", () => {
    const watch = { ...hook, radiusM: 40, fence: null };
    assert.equal(boatInsideWatch(hook, watch), true);
    assert.equal(boatInsideWatch(destPoint(hook, 90, 20), watch), true);
    assert.equal(boatInsideWatch(destPoint(hook, 90, 50), watch), false);
  });

  it("uses a drawn polygon for rivers and keep-in water", () => {
    const fence = [
      destPoint(hook, 0, 80),
      destPoint(hook, 90, 80),
      destPoint(hook, 180, 80),
      destPoint(hook, 270, 80),
    ];
    const watch = { ...hook, radiusM: 15, fence };
    assert.equal(boatInsideWatch(hook, watch), true);
    assert.equal(boatInsideWatch(destPoint(hook, 45, 30), watch), true);
    assert.equal(boatInsideWatch(destPoint(hook, 45, 200), watch), false);
  });

  it("samples slowly inside the swing and faster near the edge", () => {
    const watch = { ...hook, radiusM: 40, fence: null };
    assert.equal(anchorPollMs(hook, watch), ANCHOR_POLL_SLOW_MS);
    assert.equal(anchorPollMs(destPoint(hook, 90, 20), watch), ANCHOR_POLL_SLOW_MS);
    assert.equal(anchorPollMs(destPoint(hook, 90, 30), watch), ANCHOR_POLL_FAST_MS);
    assert.equal(anchorPollMs(destPoint(hook, 90, 50), watch), ANCHOR_POLL_FAST_MS);
    const fence = [
      destPoint(hook, 0, 80),
      destPoint(hook, 90, 80),
      destPoint(hook, 180, 80),
      destPoint(hook, 270, 80),
    ];
    const fenced = { ...hook, radiusM: 15, fence };
    assert.equal(anchorPollMs(hook, fenced), ANCHOR_POLL_SLOW_MS);
    assert.equal(anchorPollMs(destPoint(hook, 45, 200), fenced), ANCHOR_POLL_FAST_MS);
  });
});

describe("swing trail", () => {
  it("skips jitter under 3 m and caps length", () => {
    const a = { lat: -23.9, lng: 152.4 };
    const near = destPoint(a, 90, 1);
    const far = destPoint(a, 90, 8);
    assert.equal(appendSwingTrail([a], near).length, 1);
    assert.equal(appendSwingTrail([a], far).length, 2);
  });
});

describe("fixPreciseForWatch", () => {
  it("ignores fixes too vague to judge the circle", () => {
    assert.equal(fixPreciseForWatch(5, 30), true);
    assert.equal(fixPreciseForWatch(22, 30), true);
    assert.equal(fixPreciseForWatch(40, 30), false);
    assert.equal(fixPreciseForWatch(9, 12), true); // floor of 10 m for tiny circles
    assert.equal(fixPreciseForWatch(null, 30), true);
  });
});
