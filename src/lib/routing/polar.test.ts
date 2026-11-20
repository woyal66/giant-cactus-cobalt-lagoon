import { test } from "node:test";
import assert from "node:assert/strict";
import { boatSpeed, sailSpeed, waveFactor, type BoatPerf } from "./polar.ts";

const cruiser: BoatPerf = { type: "cruiser", loaM: 12, motorBelowKn: 0, motorKn: 6 };

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
