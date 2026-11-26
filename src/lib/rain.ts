/*
 * Rain intensity, radar motion and the next-hour outlook. Pure maths, so it is tested.
 *
 * Radar reflectivity (dBZ) is turned into a rain rate with Marshall–Palmer (Z = 200 R^1.6).
 * The outlook is "persistence + advection", the classic short-range nowcast: the rain pattern
 * of the latest frame is moved along the track it has followed over the last frames. It is good
 * for about an hour; cells that grow or die in that time are not foreseen.
 */

export type RainBand = { min: number; label: string; color: [number, number, number] };

/** Rain rate bands, mm/h (lower bound). Colours run light blue → blue → yellow → red → magenta. */
export const RAIN_BANDS: RainBand[] = [
  { min: 0.2, label: "Light", color: [110, 190, 250] },
  { min: 2.5, label: "Moderate", color: [30, 110, 235] },
  { min: 10, label: "Heavy", color: [250, 200, 40] },
  { min: 25, label: "Very heavy", color: [240, 80, 40] },
  { min: 50, label: "Storm", color: [210, 40, 200] },
];

/** dBZ for a storm core (hail and lightning likely above this). */
export const STORM_DBZ = 50;

/** Band index for a rain rate, or -1 for none. */
export function rainBandIndex(mmh: number): number {
  if (!Number.isFinite(mmh)) return -1;
  let k = -1;
  for (let i = 0; i < RAIN_BANDS.length; i++) if (mmh >= RAIN_BANDS[i]!.min) k = i;
  return k;
}

export function rainBand(mmh: number): RainBand | null {
  const k = rainBandIndex(mmh);
  return k < 0 ? null : RAIN_BANDS[k]!;
}

/** Rain rate, mm/h, from reflectivity (Marshall–Palmer). */
export function rainRateFromDbz(dbz: number): number {
  if (!Number.isFinite(dbz) || dbz < 5) return 0;
  return Math.pow(Math.pow(10, dbz / 10) / 200, 1 / 1.6);
}

/** Plain words for a rate: "Moderate rain, 4 mm/h". */
export function rainWords(mmh: number): string {
  const b = rainBand(mmh);
  if (!b) return "Dry";
  const n = mmh < 10 ? mmh.toFixed(1).replace(/\.0$/, "") : String(Math.round(mmh));
  return b.label === "Storm" ? `Storm rain, ${n} mm/h` : `${b.label} rain, ${n} mm/h`;
}

/**
 * Motion between two rain grids, as the shift (in grid cells) that best maps `a` onto `b`.
 * Block matching on wet cells: tries every shift within `maxShift` and keeps the one with the
 * smallest mean difference. Returns null when there is too little rain to tell.
 */
export function estimateMotion(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  w: number,
  h: number,
  maxShift: number,
  wet = 15,
): { dx: number; dy: number } | null {
  let wetA = 0;
  for (let k = 0; k < w * h; k++) if (a[k]! >= wet) wetA++;
  if (wetA < 8) return null;
  // Work on a coarser copy for speed when the grid is big.
  const f = Math.max(1, Math.floor(Math.max(w, h) / 160));
  const cw = Math.floor(w / f);
  const ch = Math.floor(h / f);
  const down = (src: ArrayLike<number>) => {
    const out = new Float32Array(cw * ch);
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++) {
        let m = 0;
        for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) m = Math.max(m, clean(src[(y * f + j) * w + x * f + i]!));
        out[y * cw + x] = m;
      }
    return out;
  };
  const A = f > 1 ? down(a) : Float32Array.from({ length: w * h }, (_, k) => clean(a[k]!));
  const B = f > 1 ? down(b) : Float32Array.from({ length: w * h }, (_, k) => clean(b[k]!));
  const ms = Math.max(1, Math.round(maxShift / f));
  let best: { dx: number; dy: number; e: number } | null = null;
  for (let dy = -ms; dy <= ms; dy++) {
    for (let dx = -ms; dx <= ms; dx++) {
      let e = 0;
      let n = 0;
      for (let y = Math.max(0, -dy); y < Math.min(ch, ch - dy); y++) {
        for (let x = Math.max(0, -dx); x < Math.min(cw, cw - dx); x++) {
          const va = A[y * cw + x]!;
          const vb = B[(y + dy) * cw + x + dx]!;
          if (va < wet && vb < wet) continue;
          e += Math.abs(va - vb);
          n++;
        }
      }
      if (n < 4) continue;
      // A small pull towards no motion, so a flat match doesn't pick a far shift.
      const score = e / n + 0.15 * Math.hypot(dx, dy);
      if (!best || score < best.e) best = { dx, dy, e: score };
    }
  }
  return best ? { dx: best.dx * f, dy: best.dy * f } : null;
}

function clean(v: number) {
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** Median of several motion estimates (frame pairs), robust to one bad match. */
export function medianMotion(list: Array<{ dx: number; dy: number } | null>): { dx: number; dy: number } | null {
  const ok = list.filter((m): m is { dx: number; dy: number } => m != null);
  if (!ok.length) return null;
  const med = (xs: number[]) => {
    const s = [...xs].sort((p, q) => p - q);
    const m = s.length >> 1;
    return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
  };
  return { dx: med(ok.map((m) => m.dx)), dy: med(ok.map((m) => m.dy)) };
}

/** The grid moved by (dx, dy) cells; cells shifted in from outside are dry. Bilinear for fractions. */
export function advect(src: ArrayLike<number>, w: number, h: number, dx: number, dy: number): Float32Array {
  const out = new Float32Array(w * h).fill(-Infinity);
  for (let y = 0; y < h; y++) {
    const sy = y - dy;
    const y0 = Math.floor(sy);
    const ty = sy - y0;
    if (y0 < 0 || y0 >= h - (ty > 0 ? 1 : 0)) continue;
    for (let x = 0; x < w; x++) {
      const sx = x - dx;
      const x0 = Math.floor(sx);
      const tx = sx - x0;
      if (x0 < 0 || x0 >= w - (tx > 0 ? 1 : 0)) continue;
      const v = (i: number, j: number) => clean(src[Math.min(h - 1, j) * w + Math.min(w - 1, i)]!);
      const top = v(x0, y0) * (1 - tx) + v(x0 + 1, y0) * tx;
      const bot = v(x0, y0 + 1) * (1 - tx) + v(x0 + 1, y0 + 1) * tx;
      const r = top * (1 - ty) + bot * ty;
      out[y * w + x] = r > 0 ? r : -Infinity;
    }
  }
  return out;
}

/** Strongest dBZ within `r` cells of a point (rain at a spot, allowing for the radar's blur). */
export function dbzNear(grid: ArrayLike<number>, w: number, h: number, x: number, y: number, r = 1): number {
  let m = -Infinity;
  const cx = Math.round(x);
  const cy = Math.round(y);
  for (let j = cy - r; j <= cy + r; j++)
    for (let i = cx - r; i <= cx + r; i++) if (i >= 0 && j >= 0 && i < w && j < h) m = Math.max(m, grid[j * w + i]!);
  return m;
}

export type OutlookStep = { at: number; mmh: number };

/**
 * One line for the next hour at a spot, from the rain rate at 10-minute steps (first = now).
 * "Dry for the next hour" / "Moderate rain now, easing in about 20 min" / "Heavy rain from
 * about 2:40 pm, for about 30 min".
 */
export function outlookText(steps: OutlookStep[], fmt: (at: number) => string): string {
  if (!steps.length) return "";
  const wet = (s: OutlookStep) => s.mmh >= RAIN_BANDS[0]!.min;
  const peak = steps.reduce((m, s) => Math.max(m, s.mmh), 0);
  const words = (mmh: number) => rainBand(mmh)?.label.toLowerCase() ?? "light";
  const step = steps.length > 1 ? steps[1]!.at - steps[0]!.at : 600_000;
  const mins = (ms: number) => `${Math.max(step / 60_000, Math.round(ms / 60_000 / 10) * 10)} min`;
  if (!steps.some(wet)) return "Dry for the next hour.";
  if (wet(steps[0]!)) {
    const end = steps.findIndex((s) => !wet(s));
    const now = words(steps[0]!.mmh);
    const worse = peak > steps[0]!.mmh * 1.5 && rainBandIndex(peak) > rainBandIndex(steps[0]!.mmh) ? `, ${words(peak)} at times` : "";
    return end < 0
      ? `${cap(now)} rain now${worse}, for at least the next hour.`
      : `${cap(now)} rain now${worse}, easing in about ${mins(steps[end]!.at - steps[0]!.at)}.`;
  }
  const start = steps.findIndex(wet);
  const after = steps.slice(start);
  const stop = after.findIndex((s) => !wet(s));
  const lasts = stop < 0 ? "" : `, for about ${mins(after[stop]!.at - after[0]!.at)}`;
  return `${cap(words(peak))} rain from about ${fmt(steps[start]!.at)}${lasts}.`;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type StormCell = { x: number; y: number; cells: number; maxDbz: number };

/** Storm cores: connected areas of at least `minDbz` (4-neighbour), at least `minCells` big. */
export function stormCells(grid: ArrayLike<number>, w: number, h: number, minDbz = STORM_DBZ, minCells = 3): StormCell[] {
  const seen = new Uint8Array(w * h);
  const out: StormCell[] = [];
  const stack: number[] = [];
  for (let k = 0; k < w * h; k++) {
    if (seen[k] || !(grid[k]! >= minDbz)) continue;
    let n = 0;
    let sx = 0;
    let sy = 0;
    let m = -Infinity;
    stack.push(k);
    seen[k] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      const x = c % w;
      const y = (c - x) / w;
      n++;
      sx += x;
      sy += y;
      m = Math.max(m, grid[c]!);
      const nb = [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, y > 0 ? c - w : -1, y < h - 1 ? c + w : -1];
      for (const q of nb) {
        if (q >= 0 && !seen[q] && grid[q]! >= minDbz) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    if (n >= minCells) out.push({ x: sx / n, y: sy / n, cells: n, maxDbz: m });
  }
  return out.sort((p, q) => q.maxDbz - p.maxDbz);
}

/** Cloud cover words for the reef: what matters is low cloud and the sun's height. */
export function reefLight(opts: { cloudPct: number; lowCloudPct?: number; sunAltDeg: number }): {
  grade: "good" | "fair" | "poor";
  text: string;
} {
  const low = Number.isFinite(opts.lowCloudPct) ? opts.lowCloudPct! : opts.cloudPct;
  const total = Number.isFinite(opts.cloudPct) ? opts.cloudPct : low;
  if (opts.sunAltDeg < 15) {
    return { grade: "poor", text: opts.sunAltDeg < 0 ? "After dark: you can't read the water." : "Sun low: glare and shadows, reefs are hard to see." };
  }
  if (low >= 60 || total >= 85) return { grade: "poor", text: `Mostly cloudy (${Math.round(total)}%): reefs and bommies hard to see.` };
  const sunHigh = opts.sunAltDeg >= 30;
  if (low <= 25 && total <= 50 && sunHigh) return { grade: "good", text: `Mostly clear (${Math.round(total)}% cloud), sun high: good light to read the reef.` };
  return {
    grade: "fair",
    text: `${Math.round(total)}% cloud${sunHigh ? "" : ", sun fairly low"}: patchy light, keep a bow lookout.`,
  };
}
