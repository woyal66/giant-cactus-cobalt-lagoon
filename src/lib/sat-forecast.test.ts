import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeSat, encodeSat, splitSat, type SatForecast } from "./sat-forecast.ts";

const base = Date.UTC(2026, 10, 6, 6);
const f: SatForecast = {
  base,
  points: [
    { lat: -23.9, lng: 152.4, steps: [0, 3, 6, 9].map((h) => ({ at: base + h * 3600e3, windKn: 12 + h, windDir: 135, gustKn: 18 + h, seaM: 1.2, periodS: 6, currentKn: h % 2 ? -0.2 : 0.4, risk: h === 9 ? 2 : 0 })) },
    { lat: -23.6, lng: 152.9, steps: [{ at: base, windKn: 10, windDir: 90 }] },
  ],
};

test("round trip through text", () => {
  const txt = encodeSat(f);
  assert.ok(txt.startsWith("AM1 0611T06|P-23.90,152.40|T0 12/135 G18 S1.2/6 C+0.4 R0|T3 15/135"));
  assert.deepEqual(decodeSat(txt, base), f);
});

test("split into messenger-sized parts, pasted out of order with noise", () => {
  const parts = splitSat(encodeSat(f), 80);
  assert.ok(parts.length > 1 && parts.every((p) => p.length <= 80), parts.join("\n"));
  const pasted = ["From: inReach", ...parts.reverse(), "Sent via satellite"].join("\n");
  assert.deepEqual(decodeSat(pasted, base + 3600e3), f);
});

test("year is inferred nearest to now; junk gives null", () => {
  const nye = decodeSat("AM1 3112T18|P-23.00,152.00|T0 10/90", Date.UTC(2027, 0, 1, 2));
  assert.equal(nye?.base, Date.UTC(2026, 11, 31, 18));
  assert.equal(decodeSat("hello"), null);
  assert.equal(decodeSat("AM1 9912T18|P1,2|T0 1/2"), null);
});
