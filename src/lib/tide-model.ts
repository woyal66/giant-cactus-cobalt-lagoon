/**
 * Offline tide predictions anywhere in the ocean from EOT20, DGFI-TUM's global ocean tide model
 * from satellite altimetry (Hart-Davis et al. 2021, CC BY 4.0). 17 constituents on a 0.125° grid
 * (about 14 km), ocean tide relative to mean sea level.
 *
 * Files: VITE_TIDE_MODEL (base URL) + "{i}_{j}.png" — 5° chunks built by
 * scripts/build-tide-chunks.py, real/imag parts in mm as big-endian int16 packed into PNG RGB.
 * Each chunk is about 20 KB and is kept in the offline tile store once fetched.
 *
 * Good offshore and along open coasts; less reliable deep inside bays, estuaries and reef
 * lagoons, where a nearby official station is better. Not for navigation.
 */
const ENV = ((import.meta as { env?: Record<string, string | undefined> }).env ?? {}) as Record<string, string | undefined>;

export const TIDE_MODEL_URL = ENV.VITE_TIDE_MODEL || "";
export const TIDE_MODEL_NAME = "EOT20 global tide model";
export const ATTR_TIDE_MODEL = "Tides: EOT20, DGFI-TUM (CC BY 4.0)";

export const CONSTITUENTS = ["M2", "S2", "N2", "K2", "K1", "O1", "P1", "Q1", "2N2", "T2", "J1", "M4", "S1", "MF", "MM", "SA", "SSA"] as const;
export type Constituent = (typeof CONSTITUENTS)[number];
const NC = CONSTITUENTS.length;
const STEP = 0.125;
const CHUNK = 5;
const N = CHUNK / STEP + 1; // 41
const LAND = -32768;

/**
 * Doodson multipliers of (τ, s, h, p, N', p') and the phase offset in degrees (Schureman's
 * convention, which EOT20's phases follow; checked against pyTMD to the millimetre).
 */
const DOODSON: Record<Constituent, [number, number, number, number, number, number, number]> = {
  M2: [2, 0, 0, 0, 0, 0, 0],
  S2: [2, 2, -2, 0, 0, 0, 0],
  N2: [2, -1, 0, 1, 0, 0, 0],
  K2: [2, 2, 0, 0, 0, 0, 0],
  "2N2": [2, -2, 0, 2, 0, 0, 0],
  T2: [2, 2, -3, 0, 0, 1, 0],
  M4: [4, 0, 0, 0, 0, 0, 0],
  K1: [1, 1, 0, 0, 0, 0, -90],
  O1: [1, -1, 0, 0, 0, 0, 90],
  P1: [1, 1, -2, 0, 0, 0, 90],
  Q1: [1, -2, 0, 1, 0, 0, 90],
  J1: [1, 2, 0, -1, 0, 0, -90],
  S1: [1, 1, -1, 0, 0, 0, 0],
  MF: [0, 2, 0, 0, 0, 0, 0],
  MM: [0, 1, 0, -1, 0, 0, 0],
  SA: [0, 0, 1, 0, 0, -1, 0],
  SSA: [0, 0, 2, 0, 0, 0, 0],
};

const RAD = Math.PI / 180;

/** Mean longitudes (degrees) at a time: moon s, sun h, lunar perigee p, node N, solar perigee p'. */
export function astro(ms: number): { tau: number; s: number; h: number; p: number; n: number; pp: number } {
  const T = (ms / 86_400_000 + 2440587.5 - 2451545.0) / 36525; // Julian centuries from J2000
  const s = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T;
  const h = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const p = 83.3532465 + 4069.0137287 * T - 0.01032 * T * T;
  const n = 125.04452 - 1934.136261 * T + 0.0020708 * T * T;
  const pp = 282.93735 + 1.71946 * T + 0.00046 * T * T;
  const utHours = ((ms / 3_600_000) % 24 + 24) % 24;
  const tau = 180 + 15 * utHours + h - s;
  return { tau, s, h, p, n, pp };
}

/** Nodal corrections: amplitude factor f and phase u (degrees), from the node longitude N. */
export function nodal(c: Constituent, nDeg: number): { f: number; u: number } {
  const N1 = nDeg * RAD;
  const cN = Math.cos(N1);
  const c2N = Math.cos(2 * N1);
  const sN = Math.sin(N1);
  const s2N = Math.sin(2 * N1);
  const m2 = { f: 1 - 0.037 * cN, u: -2.1 * sN };
  switch (c) {
    case "M2":
    case "N2":
    case "2N2":
      return m2;
    case "M4":
      return { f: m2.f * m2.f, u: 2 * m2.u };
    case "K2":
      return { f: 1.024 + 0.286 * cN + 0.008 * c2N, u: -17.7 * sN + 0.7 * s2N };
    case "K1":
      return { f: 1.006 + 0.115 * cN - 0.009 * c2N, u: -8.9 * sN + 0.7 * s2N };
    case "O1":
    case "Q1":
      return { f: 1.009 + 0.187 * cN - 0.015 * c2N, u: 10.8 * sN - 1.3 * s2N };
    case "J1":
      return { f: 1.013 + 0.168 * cN - 0.017 * c2N, u: -12.9 * sN + 1.3 * s2N };
    case "MM":
      return { f: 1 - 0.13 * cN, u: 0 };
    case "MF":
      return { f: 1.043 + 0.414 * cN, u: -23.7 * sN + 2.7 * s2N };
    default:
      return { f: 1, u: 0 };
  }
}

/** Equilibrium argument V (degrees) of a constituent. */
export function argument(c: Constituent, a: ReturnType<typeof astro>): number {
  const [t, s, h, p, n, pp, off] = DOODSON[c];
  return t * a.tau + s * a.s + h * a.h + p * a.p - n * a.n + pp * a.pp + off;
}

/** Real and imaginary parts (metres, A cos G and A sin G) per constituent at a point. */
export type TideConstants = Float64Array; // [re0, im0, re1, im1, ...]

/** Tide height (m above mean sea level) at a time from a point's constants. */
export function predict(k: TideConstants, ms: number): number {
  const a = astro(ms);
  let sum = 0;
  for (let i = 0; i < NC; i++) {
    const c = CONSTITUENTS[i]!;
    const { f, u } = nodal(c, a.n);
    const arg = (argument(c, a) + u) * RAD;
    sum += f * (k[i * 2]! * Math.cos(arg) + k[i * 2 + 1]! * Math.sin(arg));
  }
  return sum;
}

/** Which chunk holds a point, and its row/column inside it (fractional). */
export function chunkOf(lat: number, lng: number): { i: number; j: number; row: number; col: number } {
  const lon = ((lng % 360) + 360) % 360;
  const i = Math.min(71, Math.floor(lon / CHUNK));
  const j = Math.min(35, Math.max(0, Math.floor((lat + 90) / CHUNK)));
  return { i, j, row: (lat + 90 - j * CHUNK) / STEP, col: (lon - i * CHUNK) / STEP };
}

/** Raw chunk values: int16 per (row, col, constituent, part). */
export type TideChunk = Int16Array;

function cell(ch: TideChunk, r: number, c: number): Float64Array | null {
  if (r < 0 || c < 0 || r >= N || c >= N) return null;
  const o = (r * N + c) * NC * 2;
  if (ch[o] === LAND) return null;
  const out = new Float64Array(NC * 2);
  for (let k = 0; k < NC * 2; k++) out[k] = ch[o + k]! / 1000;
  return out;
}

/**
 * Constants at a point: bilinear between the four surrounding grid points that are sea. A point
 * on land or in a narrow inlet takes the nearest sea points within about 2 grid steps (≈ 30 km).
 */
export function constantsAt(ch: TideChunk, row: number, col: number): { k: TideConstants; offGridKm: number } | null {
  const r0 = Math.floor(row);
  const c0 = Math.floor(col);
  const fr = row - r0;
  const fc = col - c0;
  const sum = new Float64Array(NC * 2);
  let w = 0;
  for (const [dr, dc, wt] of [
    [0, 0, (1 - fr) * (1 - fc)],
    [0, 1, (1 - fr) * fc],
    [1, 0, fr * (1 - fc)],
    [1, 1, fr * fc],
  ] as const) {
    const v = cell(ch, r0 + dr, c0 + dc);
    if (!v || wt <= 0) continue;
    for (let k = 0; k < sum.length; k++) sum[k]! += v[k]! * wt;
    w += wt;
  }
  if (w > 0.25) {
    for (let k = 0; k < sum.length; k++) sum[k]! /= w;
    return { k: sum, offGridKm: 0 };
  }
  // Inverse-distance from sea points within 2 steps.
  let best: { k: Float64Array; d: number }[] = [];
  for (let r = r0 - 2; r <= r0 + 3; r++) {
    for (let c = c0 - 2; c <= c0 + 3; c++) {
      const v = cell(ch, r, c);
      if (!v) continue;
      const d = Math.hypot(r - row, c - col);
      if (d <= 2.6) best.push({ k: v, d });
    }
  }
  if (!best.length) return null;
  best = best.sort((a, b) => a.d - b.d).slice(0, 4);
  const out = new Float64Array(NC * 2);
  let ws = 0;
  for (const b of best) {
    const wt = 1 / Math.max(0.2, b.d) ** 2;
    for (let k = 0; k < out.length; k++) out[k]! += b.k[k]! * wt;
    ws += wt;
  }
  for (let k = 0; k < out.length; k++) out[k]! /= ws;
  return { k: out, offGridKm: Math.round(best[0]!.d * STEP * 111) };
}

/** Unpack a chunk PNG's RGB bytes (as read from a canvas, RGBA) into int16 values. */
export function unpackChunk(rgba: Uint8ClampedArray): TideChunk {
  const len = N * N * NC * 2;
  const out = new Int16Array(len);
  let b = 0;
  const byte = () => {
    const px = Math.floor(b / 3);
    const v = rgba[px * 4 + (b % 3)]!;
    b++;
    return v;
  };
  for (let k = 0; k < len; k++) {
    const hi = byte();
    const lo = byte();
    const v = (hi << 8) | lo;
    out[k] = v >= 0x8000 ? v - 0x10000 : v;
  }
  return out;
}

const chunks = new Map<string, Promise<TideChunk | null>>();

async function loadChunk(i: number, j: number): Promise<TideChunk | null> {
  const key = `tide/eot20/${i}_${j}`;
  const tiles = typeof indexedDB !== "undefined" ? await import("./offline-tiles.ts") : null;
  let blob = tiles ? await tiles.readTile(key) : null;
  if (!blob) {
    if (!TIDE_MODEL_URL) return null;
    const r = await fetch(`${TIDE_MODEL_URL.replace(/\/?$/, "/")}${i}_${j}.png`, { mode: "cors" });
    if (!r.ok) return null;
    blob = await r.blob();
    if (tiles) void tiles.putTile(key, blob).catch(() => undefined);
  }
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: "none", colorSpaceConversion: "none" });
  const c: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement("canvas"), { width: bmp.width, height: bmp.height });
  const g = c.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!g) return null;
  g.drawImage(bmp, 0, 0);
  bmp.close();
  return unpackChunk(g.getImageData(0, 0, c.width, c.height).data);
}

function chunk(i: number, j: number): Promise<TideChunk | null> {
  const key = `${i}_${j}`;
  let p = chunks.get(key);
  if (!p) {
    p = loadChunk(i, j).catch(() => null);
    chunks.set(key, p);
    p.then((v) => {
      if (!v) chunks.delete(key); // try again next time (maybe back online)
    });
  }
  return p;
}

/** Tidal constants at a point, or null (no model file, offline and not saved, or inland). */
export async function tideConstants(lat: number, lng: number): Promise<{ k: TideConstants; offGridKm: number } | null> {
  if (Math.abs(lat) > 89) return null;
  const at = chunkOf(lat, lng);
  const ch = await chunk(at.i, at.j);
  return ch ? constantsAt(ch, at.row, at.col) : null;
}

/** Save the chunks covering a box for offline use (region packs). Returns how many are stored. */
export async function saveTideChunks(west: number, south: number, east: number, north: number): Promise<number> {
  const a = chunkOf(south, west);
  const b = chunkOf(north, east);
  let n = 0;
  for (let j = a.j; j <= b.j; j++) {
    for (let i = a.i; i !== (b.i + 1) % 72; i = (i + 1) % 72) {
      if (await chunk(i, j)) n += 1;
    }
  }
  return n;
}

/** Heights (m above mean sea level) every `stepMin` minutes over a window. */
export function tideSeries(k: TideConstants, fromMs: number, hours: number, stepMin = 20): Array<{ at: number; m: number }> {
  const out: Array<{ at: number; m: number }> = [];
  const step = stepMin * 60_000;
  const start = Math.floor(fromMs / step) * step;
  for (let t = start; t <= fromMs + hours * 3_600_000; t += step) out.push({ at: t, m: Math.round(predict(k, t) * 100) / 100 });
  return out;
}

/**
 * Lowest tide over the coming year (m below mean sea level), a stand-in for LAT (Lowest
 * Astronomical Tide, the chart datum), which strictly needs 18.6 years.
 */
export function lowestTide(k: TideConstants, fromMs: number): number {
  let min = Infinity;
  for (let t = fromMs; t < fromMs + 365 * 86_400_000; t += 30 * 60_000) min = Math.min(min, predict(k, t));
  return Math.round(min * 100) / 100;
}
