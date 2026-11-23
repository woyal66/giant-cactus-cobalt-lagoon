import { test } from "node:test";
import assert from "node:assert/strict";
import { boatSpeed, defaultTune, noGoDeg, readBoatType, sailSpeed, waveFactor, type BoatPerf } from "./polar.ts";

const cruiser: BoatPerf = { type: "mono", loaM: 12, motorBelowKn: 0, motorKn: 6 };

test("cruiser speeds look like a real 12 m boat", () => {
  const beam = sailSpeed(cruiser, 15, 90);
  assert.ok(beam > 7 && beam < 8, String(beam));
  assert.equal(sailSpeed(cruiser, 15, 30), 0); // no-go
  assert.ok(sailSpeed(cruiser, 15, 45) < beam);
  assert.equal(sailSpeed(cruiser, 15, 90), sailSpeed(cruiser, 15, -90)); // symmetric
});

test("longer boats are faster, gale reefs down", () => {
  assert.ok(sailSpeed({ ...cruiser, loaM: 16 }, 12, 90) > sailSpeed(cruiser, 12, 90));
  assert.ok(sailSpeed(cruiser, 40, 120) < sailSpeed(cruiser, 30, 120));
});

test("engine takes over in light air when allowed", () => {
  const p = { ...cruiser, motorBelowKn: 3 };
  assert.deepEqual(boatSpeed(p, 2, 90), { stwKn: 6, motoring: true });
  assert.equal(boatSpeed(p, 12, 90).motoring, false);
  assert.equal(boatSpeed(cruiser, 2, 90).motoring, false);
  assert.equal(boatSpeed({ ...cruiser, type: "motor" }, 30, 0).stwKn, 6);
  // A good breeze on the nose means tacking, not motoring.
  assert.deepEqual(boatSpeed(p, 15, 20), { stwKn: 0, motoring: false });
});

test("head seas cost more than following seas", () => {
  assert.ok(waveFactor(2.5, 0, 12) < waveFactor(2.5, 90, 12));
  assert.ok(waveFactor(2.5, 90, 12) < waveFactor(2.5, 180, 12));
  assert.equal(waveFactor(0.2, 0, 12), 1);
});

test("old saved boat types read as monohull", () => {
  assert.equal(readBoatType("cruiser"), "mono");
  assert.equal(readBoatType("performance"), "mono");
  assert.equal(readBoatType("catamaran"), "catamaran");
  assert.equal(readBoatType("motor"), "motor");
  assert.equal(readBoatType(undefined), "mono");
});

test("motor boats run at cruising speed whatever the wind", () => {
  const motor: BoatPerf = { type: "motor", loaM: 8, motorBelowKn: 0, motorKn: 22 };
  assert.deepEqual(boatSpeed(motor, 0, 0), { stwKn: 22, motoring: true });
  assert.deepEqual(boatSpeed(motor, 25, 180), { stwKn: 22, motoring: true });
  assert.equal(sailSpeed(motor, 15, 90), 0);
});

test("a fast motor boat slows more than a yacht in a head sea, little in a following sea", () => {
  const yacht = waveFactor(2, 0, 8);
  const fast = waveFactor(2, 0, 8, 22);
  assert.ok(fast < yacht);
  assert.ok(fast >= 0.3);
  assert.ok(waveFactor(2, 180, 8, 22) > fast);
  assert.equal(waveFactor(0.2, 0, 8, 22), 1);
});

test("the skipper's own numbers set speeds at 15 kn and the pointing angle", () => {
  const base: BoatPerf = { type: "mono", loaM: 12, motorBelowKn: 0, motorKn: 6 };
  const d = defaultTune(base);
  const tuned: BoatPerf = { ...base, tune: { pointingDeg: 30, closeHauledKn: 5.5, closeReachKn: 7.2, beamKn: 8, runKn: 6.4 } };
  assert.equal(noGoDeg(tuned), 30);
  assert.equal(sailSpeed(base, 15, 33), 0); // built-in can't point at 33°
  assert.ok(sailSpeed(tuned, 15, 33) > 4);
  assert.ok(Math.abs(sailSpeed(tuned, 15, 90) - 8) < 0.05);
  assert.ok(Math.abs(sailSpeed(tuned, 15, 60) - 7.2) < 0.05);
  assert.ok(Math.abs(sailSpeed(tuned, 15, 180) - 6.4) < 0.05);
  // Same shape at other wind speeds, scaled.
  const k = 8 / d.beamKn;
  assert.ok(Math.abs(sailSpeed(tuned, 10, 90) - sailSpeed(base, 10, 90) * k) < 0.05);
});
