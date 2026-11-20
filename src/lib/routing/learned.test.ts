import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_LEARNED, MIN_SAMPLES, addSample, binKey, isCleanSample, learnedFactor, polarInsight, readLearned, throughWater } from "./learned.ts";

const base = { twsKn: 12, twaDeg: 90, stwKn: 6, polarKn: 7, engineOn: false, turnDeg: 2, speedChangeKn: 0.2 };

test("bins by nearest wind speed and angle, either tack", () => {
  assert.equal(binKey(11.2, 88), "12|90");
  assert.equal(binKey(11.2, -88), "12|90");
  assert.equal(binKey(40, 200), "30|165");
});

test("rejects engine, turns and odd ratios", () => {
  assert.ok(isCleanSample(base));
  assert.ok(!isCleanSample({ ...base, engineOn: true }));
  assert.ok(!isCleanSample({ ...base, turnDeg: 40 }));
  assert.ok(!isCleanSample({ ...base, stwKn: 14 }));
});

test("learns a ratio and only applies it once trusted", () => {
  let lp = EMPTY_LEARNED;
  for (let i = 0; i < MIN_SAMPLES - 1; i++) lp = addSample(lp, base);
  assert.equal(learnedFactor(lp, 12, 90), 1);
  lp = addSample(lp, base);
  assert.ok(Math.abs(learnedFactor(lp, 12, 90) - 6 / 7) < 1e-9);
  assert.equal(learnedFactor(lp, 20, 150), 1);
  assert.deepEqual(readLearned(JSON.parse(JSON.stringify(lp))), lp);
  assert.deepEqual(readLearned({ bins: { bad: { n: 1, ratio: 1 } } }), { bins: {}, samples: 0 });
});

test("insight spots fouling", () => {
  let lp = EMPTY_LEARNED;
  for (const twa of [45, 90, 150]) for (let i = 0; i < MIN_SAMPLES; i++) lp = addSample(lp, { ...base, twaDeg: twa, stwKn: 5.6, polarKn: 7 });
  assert.match(polarInsight(lp) ?? "", /fouling/);
});

test("through the water: a 1 kn current astern adds 1 kn over ground", () => {
  const w = throughWater(7, 0, 1, 0);
  assert.ok(Math.abs(w.stwKn - 6) < 1e-9);
  assert.ok(w.headingDeg < 1e-6 || w.headingDeg > 359.999);
  const cross = throughWater(6, 90, 1, 0);
  assert.ok(cross.headingDeg > 90 && cross.headingDeg < 101, String(cross.headingDeg));
});
