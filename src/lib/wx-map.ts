/**
 * Weather on the chart: the grid for the visible area, and the maths to draw it
 * (vector components, isobar contours, highs and lows). Pure where possible, so it is tested.
 */
import type { BBox } from "./routing/land.ts";
import type { WeatherField } from "./routing/field.ts";
import type { CorridorGrid } from "./routing/fetch-field.ts";

export type WxMapLayer = "wind" | "gust" | "current" | "waves" | "pressure" | "rain" | "storm";

export const WX_MAP_LAYERS: Array<{ id: WxMapLayer; label: string }> = [
  { id: "wind", label: "Wind" },
  { id: "gust", label: "Gusts" },
  { id: "current", label: "Current" },
  { id: "waves", label: "Waves" },
  { id: "pressure", label: "Pressure" },
  { id: "rain", label: "Rain" },
  { id: "storm", label: "Storms" },
];

const MAX_POINTS = 144;

/** A grid over the view (padded 20%), at most 144 points (12 × 12), snapped so small pans reuse it. */
export function viewGrid(b: BBox): CorridorGrid & { key: string } {
  const padLat = (b.north - b.south) * 0.2;
  const padLng = (b.east - b.west) * 0.2;
  let step = Math.max(0.05, Math.max(b.north - b.south + 2 * padLat, b.east - b.west + 2 * padLng) / 11);
  step = Number((Math.ceil(step / 0.05) * 0.05).toFixed(2));
  const snap = (v: number, down: boolean) => (down ? Math.floor(v / step) : Math.ceil(v / step)) * step;
  const south = snap(b.south - padLat, true);
  const north = snap(b.north + padLat, false);
  const west = snap(b.west - padLng, true);
  const east = snap(b.east + padLng, false);
  let ny = Math.round((north - south) / step) + 1;
  let nx = Math.round((east - west) / step) + 1;
  while (nx * ny > MAX_POINTS) {
    step *= 1.2;
    ny = Math.round((north - south) / step) + 1;
    nx = Math.round((east - west) / step) + 1;
  }
  const lats = Array.from({ length: ny }, (_, i) => south + i * step);
  const lngs = Array.from({ length: nx }, (_, i) => west + i * step);
  return { south, west, north: lats[ny - 1]!, east: lngs[nx - 1]!, lats, lngs, key: `${south.toFixed(2)},${west.toFixed(2)},${step.toFixed(3)},${nx}x${ny}` };
}

/** Index of the hourly layer nearest to `at`. */
export function layerIndex(f: { times: number[] }, at: number): number {
  let best = 0;
  for (let i = 1; i < f.times.length; i++) if (Math.abs(f.times[i]! - at) < Math.abs(f.times[best]! - at)) best = i;
  return best;
}

/**
 * Bilinear value of one layer at a point. Corners with no data (e.g. waves over land) are left
 * out and the rest re-weighted, so shading reaches the coast; NaN outside the grid or when less
 * than a quarter of the weight has data.
 */
export function valueAt(f: WeatherField, layer: Float32Array, lat: number, lng: number): number {
  const fy = (lat - f.lat0) / f.dLat;
  const fx = (lng - f.lng0) / f.dLng;
  if (fx < 0 || fy < 0 || fx > f.nx - 1 || fy > f.ny - 1) return NaN;
  if (f.nx < 2 || f.ny < 2) return layer[0]!;
  const x0 = Math.min(f.nx - 2, Math.floor(fx));
  const y0 = Math.min(f.ny - 2, Math.floor(fy));
  const tx = fx - x0;
  const ty = fy - y0;
  let sum = 0;
  let w = 0;
  for (const [x, y, wt] of [
    [x0, y0, (1 - tx) * (1 - ty)],
    [x0 + 1, y0, tx * (1 - ty)],
    [x0, y0 + 1, (1 - tx) * ty],
    [x0 + 1, y0 + 1, tx * ty],
  ] as const) {
    const v = layer[y * f.nx + x]!;
    if (!Number.isFinite(v)) continue;
    sum += v * wt;
    w += wt;
  }
  return w >= 0.25 ? sum / w : NaN;
}

/** East/north components (knots) of a speed and a direction. `toward` false = direction it comes FROM. */
export function components(kn: number, dirDeg: number, toward: boolean): { u: number; v: number } {
  const r = ((toward ? dirDeg : dirDeg + 180) * Math.PI) / 180;
  return { u: kn * Math.sin(r), v: kn * Math.cos(r) };
}

export type Pt = { lat: number; lng: number };

/**
 * Contour lines (marching squares) of a grid at `level`, as line segments in lat/lng.
 * Values are [iy * nx + ix], rows from the south.
 */
export function contourSegments(
  g: { lat0: number; lng0: number; dLat: number; dLng: number; nx: number; ny: number },
  values: ArrayLike<number>,
  level: number,
): Array<[Pt, Pt]> {
  const out: Array<[Pt, Pt]> = [];
  const at = (x: number, y: number) => values[y * g.nx + x]!;
  const P = (x: number, y: number): Pt => ({ lat: g.lat0 + y * g.dLat, lng: g.lng0 + x * g.dLng });
  const lerp = (x0: number, y0: number, x1: number, y1: number): Pt => {
    const a = at(x0, y0);
    const b = at(x1, y1);
    const t = a === b ? 0.5 : (level - a) / (b - a);
    const p0 = P(x0, y0);
    const p1 = P(x1, y1);
    return { lat: p0.lat + (p1.lat - p0.lat) * t, lng: p0.lng + (p1.lng - p0.lng) * t };
  };
  for (let y = 0; y < g.ny - 1; y++) {
    for (let x = 0; x < g.nx - 1; x++) {
      const a = at(x, y);
      const b = at(x + 1, y);
      const c = at(x + 1, y + 1);
      const d = at(x, y + 1);
      if (![a, b, c, d].every(Number.isFinite)) continue;
      const idx = (a >= level ? 1 : 0) | (b >= level ? 2 : 0) | (c >= level ? 4 : 0) | (d >= level ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const bottom = () => lerp(x, y, x + 1, y);
      const right = () => lerp(x + 1, y, x + 1, y + 1);
      const top = () => lerp(x, y + 1, x + 1, y + 1);
      const left = () => lerp(x, y, x, y + 1);
      switch (idx) {
        case 1: case 14: out.push([left(), bottom()]); break;
        case 2: case 13: out.push([bottom(), right()]); break;
        case 3: case 12: out.push([left(), right()]); break;
        case 4: case 11: out.push([right(), top()]); break;
        case 6: case 9: out.push([bottom(), top()]); break;
        case 7: case 8: out.push([left(), top()]); break;
        case 5: out.push([left(), top()], [bottom(), right()]); break;
        case 10: out.push([left(), bottom()], [right(), top()]); break;
      }
    }
  }
  return out;
}

/** Isobar levels every `step` hPa across the grid's range. */
export function isobarLevels(values: ArrayLike<number>, step = 2): number[] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (!Number.isFinite(v)) continue;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  if (!Number.isFinite(lo)) return [];
  const out: number[] = [];
  for (let l = Math.ceil(lo / step) * step; l <= hi; l += step) out.push(l);
  return out;
}

/** Interior highs and lows: a cell higher (lower) than all eight neighbours by at least 0.5 hPa. */
export function extremes(
  g: { lat0: number; lng0: number; dLat: number; dLng: number; nx: number; ny: number },
  values: ArrayLike<number>,
): Array<Pt & { kind: "H" | "L"; hPa: number }> {
  const out: Array<Pt & { kind: "H" | "L"; hPa: number }> = [];
  for (let y = 1; y < g.ny - 1; y++) {
    for (let x = 1; x < g.nx - 1; x++) {
      const v = values[y * g.nx + x]!;
      if (!Number.isFinite(v)) continue;
      let high = true;
      let low = true;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          if (!i && !j) continue;
          const n = values[(y + j) * g.nx + x + i]!;
          if (!(v - n >= 0.5)) high = false;
          if (!(n - v >= 0.5)) low = false;
        }
      }
      if (high || low) out.push({ lat: g.lat0 + y * g.dLat, lng: g.lng0 + x * g.dLng, kind: high ? "H" : "L", hPa: Math.round(v) });
    }
  }
  return out;
}

/**
 * Highs and lows placed where the pressure really peaks, not snapped to the forecast grid:
 * searched on the smooth (bicubic) field `k` times finer than the grid, over a window one grid
 * cell wide, then refined between points with a parabola. So an L moves smoothly as the low
 * moves, instead of jumping a whole grid cell (which can be 100 km zoomed out). Weak bumps
 * (under 1 hPa below or above their surroundings) are left out.
 */
export function extremesSmooth(
  g: { lat0: number; lng0: number; dLat: number; dLng: number; nx: number; ny: number },
  values: ArrayLike<number>,
  k = 4,
): Array<Pt & { kind: "H" | "L"; hPa: number }> {
  if (g.nx < 3 || g.ny < 3) return [];
  const up = upsample(g, values, k);
  const u = up.values;
  const G = up.grid;
  const at = (x: number, y: number) => u[y * G.nx + x]!;
  const out: Array<Pt & { kind: "H" | "L"; hPa: number }> = [];
  const r = k;
  for (let y = r; y < G.ny - r; y++) {
    for (let x = r; x < G.nx - r; x++) {
      const v = at(x, y);
      if (!Number.isFinite(v)) continue;
      let isMin = true;
      let isMax = true;
      let lo = v;
      let hi = v;
      for (let j = -r; j <= r && (isMin || isMax); j++) {
        for (let i = -r; i <= r; i++) {
          if (!i && !j) continue;
          const n = at(x + i, y + j);
          if (!Number.isFinite(n)) {
            isMin = false;
            isMax = false;
            break;
          }
          // Ties go to the earlier point, so a flat top gives one mark.
          const before = j < 0 || (j === 0 && i < 0);
          if (n < v || (n === v && before)) isMin = false;
          if (n > v || (n === v && before)) isMax = false;
          lo = Math.min(lo, n);
          hi = Math.max(hi, n);
        }
      }
      const kind = isMin && hi - v >= 1 ? "L" : isMax && v - lo >= 1 ? "H" : null;
      if (!kind) continue;
      // Parabola through the neighbours on each axis: the peak between points.
      const off = (a: number, b: number, c: number) => {
        const d = a - 2 * b + c;
        return d !== 0 ? Math.max(-0.5, Math.min(0.5, (a - c) / (2 * d))) : 0;
      };
      const ox = off(at(x - 1, y), v, at(x + 1, y));
      const oy = off(at(x, y - 1), v, at(x, y + 1));
      out.push({ lat: G.lat0 + (y + oy) * G.dLat, lng: G.lng0 + (x + ox) * G.dLng, kind, hPa: Math.round(v) });
    }
  }
  return out;
}

/**
 * Speed and east/north components at a point, blending the four corners as vectors (so 350°
 * and 10° average to north, not south). `toward` false = direction it comes FROM.
 */
export function vectorAt(
  f: WeatherField,
  kn: Float32Array,
  dir: Float32Array,
  lat: number,
  lng: number,
  toward: boolean,
): { kn: number; u: number; v: number } | null {
  const fy = (lat - f.lat0) / f.dLat;
  const fx = (lng - f.lng0) / f.dLng;
  if (fx < 0 || fy < 0 || fx > f.nx - 1 || fy > f.ny - 1 || f.nx < 2 || f.ny < 2) return null;
  const x0 = Math.min(f.nx - 2, Math.floor(fx));
  const y0 = Math.min(f.ny - 2, Math.floor(fy));
  const tx = fx - x0;
  const ty = fy - y0;
  let u = 0;
  let v = 0;
  let wsum = 0;
  for (const [x, y, wgt] of [
    [x0, y0, (1 - tx) * (1 - ty)],
    [x0 + 1, y0, tx * (1 - ty)],
    [x0, y0 + 1, (1 - tx) * ty],
    [x0 + 1, y0 + 1, tx * ty],
  ] as const) {
    const s = kn[y * f.nx + x]!;
    const d = dir[y * f.nx + x]!;
    if (!Number.isFinite(s) || !Number.isFinite(d)) continue;
    const c = components(s, d, toward);
    u += c.u * wgt;
    v += c.v * wgt;
    wsum += wgt;
  }
  if (wsum < 0.25) return null;
  u /= wsum;
  v /= wsum;
  return { kn: Math.hypot(u, v), u, v };
}

/** Grid upsampled k times (bilinear), so contours come out smooth instead of angular. */
export function upsample(
  g: { lat0: number; lng0: number; dLat: number; dLng: number; nx: number; ny: number },
  values: ArrayLike<number>,
  k: number,
): { grid: { lat0: number; lng0: number; dLat: number; dLng: number; nx: number; ny: number }; values: Float32Array } {
  // Catmull-Rom (bicubic) through the grid points: smooth curves that still pass through every
  // model value, so isobars are accurate at the grid points and round between them.
  const nx = (g.nx - 1) * k + 1;
  const ny = (g.ny - 1) * k + 1;
  const out = new Float32Array(nx * ny);
  const at = (i: number, j: number) => values[Math.max(0, Math.min(g.ny - 1, j)) * g.nx + Math.max(0, Math.min(g.nx - 1, i))]!;
  const cr = (p0: number, p1: number, p2: number, p3: number, t: number) =>
    0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  for (let y = 0; y < ny; y++) {
    const fy = y / k;
    const y1 = Math.min(g.ny - 2, Math.floor(fy));
    const ty = fy - y1;
    for (let x = 0; x < nx; x++) {
      const fx = x / k;
      const x1 = Math.min(g.nx - 2, Math.floor(fx));
      const tx = fx - x1;
      if (g.nx < 2 || g.ny < 2) {
        out[y * nx + x] = values[0]!;
        continue;
      }
      const row = (j: number) => cr(at(x1 - 1, j), at(x1, j), at(x1 + 1, j), at(x1 + 2, j), tx);
      out[y * nx + x] = cr(row(y1 - 1), row(y1), row(y1 + 1), row(y1 + 2), ty);
    }
  }
  return { grid: { lat0: g.lat0, lng0: g.lng0, dLat: g.dLat / k, dLng: g.dLng / k, nx, ny }, values: out };
}

/**
 * Join contour segments into whole lines (matching shared end points), then round them with two
 * passes of Chaikin corner-cutting so isobars draw as smooth curves.
 */
export function smoothLines(segs: Array<[Pt, Pt]>, passes = 2): Pt[][] {
  const key = (p: Pt) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  const ends = new Map<string, number[]>();
  segs.forEach(([a, b], i) => {
    for (const k of [key(a), key(b)]) {
      const l = ends.get(k);
      if (l) l.push(i);
      else ends.set(k, [i]);
    }
  });
  const used = new Uint8Array(segs.length);
  const lines: Pt[][] = [];
  const grow = (line: Pt[], atEnd: boolean) => {
    for (;;) {
      const tip = atEnd ? line[line.length - 1]! : line[0]!;
      const next = (ends.get(key(tip)) ?? []).find((j) => !used[j]);
      if (next === undefined) return;
      used[next] = 1;
      const [a, b] = segs[next]!;
      const other = key(a) === key(tip) ? b : a;
      if (atEnd) line.push(other);
      else line.unshift(other);
    }
  };
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const line = [segs[i]![0], segs[i]![1]];
    grow(line, true);
    grow(line, false);
    lines.push(line);
  }
  return lines.map((l) => {
    let pts = l;
    const closed = pts.length > 3 && key(pts[0]!) === key(pts[pts.length - 1]!);
    for (let pass = 0; pass < passes; pass++) {
      if (pts.length < 3) break;
      const out: Pt[] = closed ? [] : [pts[0]!];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!;
        const b = pts[i + 1]!;
        out.push(
          { lat: a.lat * 0.75 + b.lat * 0.25, lng: a.lng * 0.75 + b.lng * 0.25 },
          { lat: a.lat * 0.25 + b.lat * 0.75, lng: a.lng * 0.25 + b.lng * 0.75 },
        );
      }
      if (closed) out.push(out[0]!);
      else out.push(pts[pts.length - 1]!);
      pts = out;
    }
    return pts;
  });
}

/** A colour scale: value stops with RGB colours, blended smoothly between stops (like Windy). */
export type Ramp = Array<[number, [number, number, number]]>;

/** Wind and gust, knots: calm blue → green → yellow → orange → red → purple. */
export const WIND_RAMP: Ramp = [
  [0, [40, 80, 160]],
  [6, [30, 140, 200]],
  [11, [40, 180, 120]],
  [16, [200, 200, 60]],
  [21, [240, 150, 40]],
  [27, [225, 60, 50]],
  [34, [190, 40, 140]],
  [45, [110, 40, 180]],
];
/** Significant wave height, metres. */
export const WAVE_RAMP: Ramp = [
  [0, [40, 110, 190]],
  [0.5, [40, 160, 200]],
  [1, [60, 190, 150]],
  [1.5, [200, 200, 70]],
  [2.5, [240, 140, 40]],
  [4, [220, 50, 60]],
  [6, [160, 40, 150]],
];
/** Rain, mm per hour. */
export const RAIN_RAMP: Ramp = [
  [0.1, [120, 190, 250]],
  [1, [50, 140, 240]],
  [3, [40, 80, 220]],
  [6, [150, 60, 220]],
  [12, [230, 50, 120]],
];
/** Current, knots. */
export const CURRENT_RAMP: Ramp = [
  [0, [60, 70, 150]],
  [0.5, [80, 120, 200]],
  [1, [120, 170, 230]],
  [2, [200, 160, 240]],
  [3, [240, 120, 200]],
];
/** Thunderstorm risk from CAPE, J/kg (shown only where rain or instability makes storms possible). */
export const CAPE_RAMP: Ramp = [
  [300, [250, 220, 80]],
  [1000, [245, 160, 40]],
  [2000, [230, 80, 40]],
  [3500, [200, 30, 90]],
];

export function rampColor(r: Ramp, v: number): [number, number, number] {
  if (!(v > r[0]![0])) return r[0]![1];
  for (let i = 1; i < r.length; i++) {
    const [b, cb] = r[i]!;
    if (v <= b) {
      const [a, ca] = r[i - 1]!;
      const t = (v - a) / (b - a);
      return [0, 1, 2].map((k) => Math.round(ca[k]! + (cb[k]! - ca[k]!) * t)) as [number, number, number];
    }
  }
  return r[r.length - 1]![1];
}

/** CSS linear-gradient for a ramp's legend bar. */
export function rampGradient(r: Ramp): string {
  const lo = r[0]![0];
  const hi = r[r.length - 1]![0];
  return `linear-gradient(to right, ${r.map(([v, c]) => `rgb(${c.join(",")}) ${(((v - lo) / (hi - lo)) * 100).toFixed(1)}%`).join(", ")})`;
}

export type WxProbe = {
  windKn: number | null;
  windFrom: number | null;
  gustKn: number | null;
  waveM: number | null;
  waveFrom: number | null;
  periodS: number | null;
  curKn: number | null;
  curToward: number | null;
  rainMm: number | null;
  pressureHpa: number | null;
  capeJkg: number | null;
};

const fin = (v: number) => (Number.isFinite(v) ? v : null);

/** Everything the grid knows at a point and hour (for the tap-anywhere readout). */
export function probeAt(f: WeatherField, at: number, lat: number, lng: number): WxProbe {
  const t = layerIndex(f, at);
  const wind = vectorAt(f, f.windKn[t]!, f.windDir[t]!, lat, lng, false);
  const cur = vectorAt(f, f.curKn[t]!, f.curDir[t]!, lat, lng, true);
  const wave = vectorAt(f, f.waveM[t]!, f.waveDir[t]!, lat, lng, false);
  const dirOf = (u: number, v: number, from: boolean) => (((Math.atan2(u, v) * 180) / Math.PI + (from ? 180 : 0) + 360) % 360);
  return {
    windKn: wind ? wind.kn : null,
    windFrom: wind ? dirOf(wind.u, wind.v, true) : null,
    gustKn: fin(valueAt(f, f.gustKn[t]!, lat, lng)),
    waveM: fin(valueAt(f, f.waveM[t]!, lat, lng)),
    waveFrom: wave ? dirOf(wave.u, wave.v, true) : null,
    periodS: f.wavePer ? fin(valueAt(f, f.wavePer[t]!, lat, lng)) : null,
    curKn: cur ? cur.kn : null,
    curToward: cur ? dirOf(cur.u, cur.v, false) : null,
    rainMm: f.precipMm ? fin(valueAt(f, f.precipMm[t]!, lat, lng)) : null,
    pressureHpa: f.pressureHpa ? fin(valueAt(f, f.pressureHpa[t]!, lat, lng)) : null,
    capeJkg: f.capeJkg ? fin(valueAt(f, f.capeJkg[t]!, lat, lng)) : null,
  };
}

/** Largest value of a layer at an hour (NaN-safe), e.g. to say "no rain in view". */
export function layerMax(layer: Float32Array | undefined): number {
  if (!layer) return NaN;
  let m = -Infinity;
  for (const v of layer) if (Number.isFinite(v) && v > m) m = v;
  return m === -Infinity ? NaN : m;
}

/** Isobar spacing that gives a few lines whatever the view: 1, 2 or 4 hPa. */
export function isobarStep(values: ArrayLike<number>): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (!Number.isFinite(v)) continue;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const range = hi - lo;
  return range < 5 ? 1 : range < 16 ? 2 : 4;
}
