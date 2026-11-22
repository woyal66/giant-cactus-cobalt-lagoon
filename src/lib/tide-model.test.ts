import { test } from "node:test";
import assert from "node:assert/strict";
import { astro, chunkOf, constantsAt, CONSTITUENTS, lowestTide, predict, tideSeries, unpackChunk } from "./tide-model.ts";

// EOT20 constants at two points and pyTMD 3.1 predictions there (infer_minor off), metres.
const FIXTURE: Record<string, { k: number[]; samples: [number, number][] }> = {"-22.0,150.5": {"k": [1.494, 0.508, 0.573, 0.128, 0.361, 0.045, 0.163, 0.029, 0.318, 0.141, 0.174, -0.014, 0.093, 0.038, 0.025, -0.012, 0.056, -0.002, 0.03, -0.003, 0.018, 0.018, -0.023, -0.004, 0.001, -0.004, 0.008, -0.001, 0.003, 0.003, -0.003, 0.027, 0.004, 0], "samples": [[1795305600000, 1.6337], [1795318200000, -1.4644], [1795339800000, 1.3816], [1795365000000, -2.3085], [1795487400000, 0.9082]]}, "21.3,-157.9": {"k": [0.1184, 0.1242, 0.0422, 0.05, 0.0226, 0.0202, 0.0108, 0.011, -0.102, -0.1106, -0.065, -0.0518, -0.0312, -0.0348, -0.011, -0.005, 0.004, 0.002, -0.0022, 0.001, -0.01, -0.004, 0.001, -0.002, 0.0028, 0.001, 0.005, 0.004, 0.005, 0.001, 0, -0.0142, 0.004, 0.001], "samples": [[1795305600000, 0.0632], [1795318200000, -0.2504], [1795339800000, 0.1533], [1795365000000, 0.0449], [1795487400000, -0.1033]]}};

test("matches pyTMD to the centimetre (Broad Sound, QLD; Honolulu)", () => {
  for (const [key, f] of Object.entries(FIXTURE)) {
    const k = Float64Array.from(f.k);
    for (const [at, want] of f.samples) {
      const got = predict(k, at);
      assert.ok(Math.abs(got - want) < 0.01, `${key} ${new Date(at).toISOString()}: ${got.toFixed(3)} vs ${want}`);
    }
  }
});

test("chunk addressing: lon 0–360 in 5° chunks, rows from the south", () => {
  const g = chunkOf(-19.2, 146.9);
  assert.equal(g.i, 29);
  assert.equal(g.j, 14);
  assert.ok(Math.abs(g.row - 6.4) < 1e-6 && Math.abs(g.col - 15.2) < 1e-6);
  const w = chunkOf(21.3, -157.9);
  assert.equal(w.i, 40);
  assert.equal(w.j, 22);
});

test("unpack, interpolate between sea points, ignore land", () => {
  const N = 41;
  const NC = CONSTITUENTS.length;
  const vals = new Int16Array(N * N * NC * 2).fill(-32768);
  const put = (r: number, c: number, mm: number) => {
    const o = (r * N + c) * NC * 2;
    for (let k = 0; k < NC * 2; k++) vals[o + k] = 0;
    vals[o] = mm; // M2 real part
  };
  put(10, 10, 1000);
  put(10, 11, 2000);
  // pack big-endian into RGBA bytes as the PNG decoder would give them
  const bytes: number[] = [];
  for (const v of vals) bytes.push((v >> 8) & 255, v & 255);
  const rgba = new Uint8ClampedArray(Math.ceil(bytes.length / 3) * 4);
  bytes.forEach((b, i) => (rgba[Math.floor(i / 3) * 4 + (i % 3)] = b));
  const ch = unpackChunk(rgba);
  assert.equal(ch[(10 * N + 11) * NC * 2], 2000);
  const mid = constantsAt(ch, 10, 10.5)!;
  assert.ok(Math.abs(mid.k[0]! - 1.5) < 1e-9);
  const near = constantsAt(ch, 11.5, 10)!; // on land, nearest sea one cell away
  assert.ok(near.k[0]! >= 1 && near.k[0]! <= 2);
  assert.equal(constantsAt(ch, 30, 30), null);
});

test("series, lowest tide and a sane lunar day", () => {
  const k = Float64Array.from(FIXTURE["21.3,-157.9"]!.k);
  const s = tideSeries(k, Date.UTC(2026, 10, 22), 24, 30);
  assert.equal(s.length, 49);
  const low = lowestTide(k, Date.UTC(2026, 0, 1));
  assert.ok(low < 0 && low > -1.5, String(low));
  const a = astro(Date.UTC(2000, 0, 1, 12));
  assert.ok(Math.abs(a.s - 218.3164477) < 0.01);
});
