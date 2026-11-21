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

const MAX_POINTS = 100;

/** A grid over the view (padded 20%), at most 100 points, snapped so small pans reuse it. */
export function viewGrid(b: BBox): CorridorGrid & { key: string } {
  const padLat = (b.north - b.south) * 0.2;
  const padLng = (b.east - b.west) * 0.2;
  let step = Math.max(0.05, Math.max(b.north - b.south + 2 * padLat, b.east - b.west + 2 * padLng) / 9);
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

/** Bilinear value of one layer at a point (NaN outside the grid or where data is missing). */
export function valueAt(f: WeatherField, layer: Float32Array, lat: number, lng: number): number {
  const fy = (lat - f.lat0) / f.dLat;
  const fx = (lng - f.lng0) / f.dLng;
  if (fx < 0 || fy < 0 || fx > f.nx - 1 || fy > f.ny - 1) return NaN;
  const x0 = Math.min(f.nx - 2, Math.floor(fx));
  const y0 = Math.min(f.ny - 2, Math.floor(fy));
  const tx = fx - x0;
  const ty = fy - y0;
  const v = (x: number, y: number) => layer[y * f.nx + x]!;
  if (f.nx < 2 || f.ny < 2) return layer[0]!;
  return v(x0, y0) * (1 - tx) * (1 - ty) + v(x0 + 1, y0) * tx * (1 - ty) + v(x0, y0 + 1) * (1 - tx) * ty + v(x0 + 1, y0 + 1) * tx * ty;
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
  for (const [x, y, wgt] of [
    [x0, y0, (1 - tx) * (1 - ty)],
    [x0 + 1, y0, tx * (1 - ty)],
    [x0, y0 + 1, (1 - tx) * ty],
    [x0 + 1, y0 + 1, tx * ty],
  ] as const) {
    const s = kn[y * f.nx + x]!;
    const d = dir[y * f.nx + x]!;
    if (!Number.isFinite(s) || !Number.isFinite(d)) return null;
    const c = components(s, d, toward);
    u += c.u * wgt;
    v += c.v * wgt;
  }
  return { kn: Math.hypot(u, v), u, v };
}

/** Grid upsampled k times (bilinear), so contours come out smooth instead of angular. */
export function upsample(
  g: { lat0: number; lng0: number; dLat: number; dLng: number; nx: number; ny: number },
  values: ArrayLike<number>,
  k: number,
): { grid: { lat0: number; lng0: number; dLat: number; dLng: number; nx: number; ny: number }; values: Float32Array } {
  const nx = (g.nx - 1) * k + 1;
  const ny = (g.ny - 1) * k + 1;
  const out = new Float32Array(nx * ny);
  for (let y = 0; y < ny; y++) {
    const fy = y / k;
    const y0 = Math.min(g.ny - 2, Math.floor(fy));
    const ty = fy - y0;
    for (let x = 0; x < nx; x++) {
      const fx = x / k;
      const x0 = Math.min(g.nx - 2, Math.floor(fx));
      const tx = fx - x0;
      const v = (i: number, j: number) => values[j * g.nx + i]!;
      out[y * nx + x] =
        v(x0, y0) * (1 - tx) * (1 - ty) + v(x0 + 1, y0) * tx * (1 - ty) + v(x0, y0 + 1) * (1 - tx) * ty + v(x0 + 1, y0 + 1) * tx * ty;
    }
  }
  return { grid: { lat0: g.lat0, lng0: g.lng0, dLat: g.dLat / k, dLng: g.dLng / k, nx, ny }, values: out };
}
