import { test } from "node:test";
import assert from "node:assert/strict";
import { cellTrend, nearestEcho, parseRadarFrames, worldPx } from "./radar.ts";

test("parses RainViewer frames oldest first", () => {
  const p = parseRadarFrames({
    host: "https://tilecache.rainviewer.com",
    radar: { past: [{ time: 200, path: "/v2/radar/200" }, { time: 100, path: "/v2/radar/100" }], nowcast: [] },
  });
  assert.equal(p?.frames.length, 2);
  assert.equal(p?.frames[0].at, 100_000);
  assert.equal(parseRadarFrames({}), null);
});

function grid(w: number, h: number, cells: [number, number][]) {
  const g = new Float32Array(w * h).fill(-99);
  for (const [cx, cy] of cells) for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) g[y * w + x] = 45;
  return g;
}

test("finds the nearest solid echo and ignores speckle", () => {
  const g = grid(100, 100, [[50, 30]]);
  g[50 * 100 + 55] = 50; // a lone pixel next to the boat
  const e = nearestEcho(g, 100, 100, 50, 50, 1);
  assert.ok(e);
  assert.ok(Math.abs(e.distKm - 19) < 1.5, String(e.distKm));
  assert.ok(e.bearing < 5 || e.bearing > 355, String(e.bearing)); // north
});

test("closing cell gives an ETA, a passing one does not", () => {
  const t = (m: number) => m * 60_000;
  const closing = [0, 10, 20, 30].map((m, i) => ({ at: t(m), echo: { distKm: 40 - i * 5, bearing: 225 } }));
  const tr = cellTrend(closing);
  assert.ok(tr);
  assert.ok(tr.closingKn > 15 && tr.closingKn < 17, String(tr.closingKn));
  assert.ok(tr.etaMin! > 45 && tr.etaMin! < 55, String(tr.etaMin));
  const steady = [0, 10, 20].map((m) => ({ at: t(m), echo: { distKm: 20, bearing: 90 } }));
  assert.equal(cellTrend(steady), null);
});

test("web mercator pixel at zoom 0", () => {
  const p = worldPx(0, 0, 0);
  assert.equal(p.x, 128);
  assert.ok(Math.abs(p.y - 128) < 1e-9);
});
