import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advect,
  estimateMotion,
  medianMotion,
  outlookText,
  rainBand,
  rainRateFromDbz,
  rainWords,
  reefLight,
  stormCells,
} from "./rain.ts";

test("Marshall–Palmer rates and bands", () => {
  assert.equal(rainRateFromDbz(0), 0);
  // 20 dBZ is light rain, ~0.6 mm/h; 40 dBZ heavy showers, ~12 mm/h; 55 dBZ storm, ~100 mm/h.
  assert.ok(Math.abs(rainRateFromDbz(20) - 0.65) < 0.05);
  assert.ok(Math.abs(rainRateFromDbz(40) - 11.5) < 0.6);
  assert.equal(rainBand(rainRateFromDbz(40))?.label, "Heavy");
  assert.equal(rainBand(rainRateFromDbz(55))?.label, "Storm");
  assert.equal(rainBand(0.1), null);
  assert.equal(rainWords(0), "Dry");
  assert.equal(rainWords(4), "Moderate rain, 4 mm/h");
});

function blob(w: number, h: number, cx: number, cy: number, r: number, v = 40) {
  const g = new Float32Array(w * h).fill(-Infinity);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (Math.hypot(x - cx, y - cy) <= r) g[y * w + x] = v;
  return g;
}

test("motion is found from two frames and the outlook moves the rain on", () => {
  const w = 60;
  const h = 50;
  const a = blob(w, h, 20, 20, 5);
  const b = blob(w, h, 24, 22, 5);
  const m = estimateMotion(a, b, w, h, 8);
  assert.deepEqual(m, { dx: 4, dy: 2 });
  const next = advect(b, w, h, m!.dx, m!.dy);
  assert.ok(next[24 * w + 28]! > 30, "the centre moved on by the same step");
  assert.ok(!(next[20 * w + 18]! > 0), "the old spot dries out");
  assert.equal(estimateMotion(new Float32Array(w * h), b, w, h, 8), null);
  assert.deepEqual(medianMotion([{ dx: 4, dy: 2 }, { dx: 5, dy: 2 }, null, { dx: 40, dy: -9 }]), { dx: 5, dy: 2 });
});

test("storm cores are grouped", () => {
  const w = 30;
  const h = 30;
  const g = blob(w, h, 8, 8, 2, 55);
  const g2 = blob(w, h, 22, 20, 3, 52);
  for (let k = 0; k < w * h; k++) g[k] = Math.max(g[k]!, g2[k]!);
  g[0] = 60; // one speckle pixel: ignored
  const cells = stormCells(g, w, h);
  assert.equal(cells.length, 2);
  assert.equal(cells[0]!.maxDbz, 55);
  assert.ok(Math.abs(cells[1]!.x - 22) < 0.5 && Math.abs(cells[1]!.y - 20) < 0.5);
});

test("next-hour outlook in words", () => {
  const t0 = Date.UTC(2026, 0, 1, 4, 0);
  const steps = (r: number[]) => r.map((mmh, i) => ({ at: t0 + i * 600_000, mmh }));
  const fmt = (at: number) => `${(at - t0) / 60_000}m`;
  assert.equal(outlookText(steps([0, 0, 0, 0, 0, 0, 0]), fmt), "Dry for the next hour.");
  assert.equal(outlookText(steps([0, 0, 3, 12, 4, 0, 0]), fmt), "Heavy rain from about 20m, for about 30 min.");
  assert.equal(outlookText(steps([4, 4, 0, 0, 0, 0, 0]), fmt), "Moderate rain now, easing in about 20 min.");
  assert.equal(outlookText(steps([1, 1, 1, 1, 1, 1, 1]), fmt), "Light rain now, for at least the next hour.");
});

test("reef light", () => {
  assert.equal(reefLight({ cloudPct: 20, lowCloudPct: 10, sunAltDeg: 50 }).grade, "good");
  assert.equal(reefLight({ cloudPct: 90, lowCloudPct: 70, sunAltDeg: 50 }).grade, "poor");
  assert.equal(reefLight({ cloudPct: 20, lowCloudPct: 10, sunAltDeg: 8 }).grade, "poor");
  assert.equal(reefLight({ cloudPct: 55, lowCloudPct: 35, sunAltDeg: 40 }).grade, "fair");
});

test("satellite pick and frame times", async () => {
  const { satFor, satFrames, satTime } = await import("./sat-cloud.ts");
  assert.equal(satFor(-16.9, 145.8).id, "himawari");
  assert.equal(satFor(21, -157).id, "goes-w");
  assert.equal(satFor(25, -80).id, "goes-e");
  assert.equal(satFor(43, 5).id, "viirs");
  const now = Date.UTC(2026, 10, 26, 3, 17);
  const f = satFrames(satFor(-16.9, 145.8), now);
  assert.equal(f.length, 7);
  assert.equal(new Date(f[6]!).toISOString(), "2026-11-26T02:30:00.000Z");
  assert.equal(satTime(satFor(-16.9, 145.8), f[6]!), "2026-11-26T02:30:00Z");
  assert.equal(satTime(satFor(43, 5), now), "2026-11-26");
});
