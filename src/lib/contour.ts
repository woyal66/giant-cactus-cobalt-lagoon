/**
 * Contour lines (marching squares) on a square grid of values, for depth lines on the chart.
 * Pure, so it is tested. Grid coordinates: x across, y down, 0 … n−1.
 */
export type Seg = [number, number, number, number];

/** Chart depth lines, metres: every metre from 1 to 5 (where keels touch), then wider. */
export const DEPTH_LINES = [1, 2, 3, 4, 5, 10, 20, 50, 100, 200] as const;

/** Line colour per depth: red at 1 m through orange and amber to pale yellow at 5 m, white deeper. */
export function depthLineColor(level: number): string {
  if (level <= 1) return "#ff4d4f";
  if (level <= 2) return "#ff8a3d";
  if (level <= 3) return "#ffb340";
  if (level <= 4) return "#ffd666";
  if (level <= 5) return "#fff1a8";
  return "rgba(255,255,255,0.85)";
}

export function contourGrid(values: ArrayLike<number>, n: number, level: number): Seg[] {
  const out: Seg[] = [];
  const v = (x: number, y: number) => values[y * n + x]!;
  const lerp = (a: number, b: number) => (level - a) / (b - a);
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const a = v(x, y);
      const b = v(x + 1, y);
      const c = v(x + 1, y + 1);
      const d = v(x, y + 1);
      if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c) || !Number.isFinite(d)) continue;
      const idx = (a >= level ? 8 : 0) | (b >= level ? 4 : 0) | (c >= level ? 2 : 0) | (d >= level ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const top: [number, number] = [x + lerp(a, b), y];
      const right: [number, number] = [x + 1, y + lerp(b, c)];
      const bottom: [number, number] = [x + lerp(d, c), y + 1];
      const left: [number, number] = [x, y + lerp(a, d)];
      const seg = (p: [number, number], q: [number, number]) => out.push([p[0], p[1], q[0], q[1]]);
      switch (idx) {
        case 1: case 14: seg(left, bottom); break;
        case 2: case 13: seg(bottom, right); break;
        case 3: case 12: seg(left, right); break;
        case 4: case 11: seg(top, right); break;
        case 6: case 9: seg(top, bottom); break;
        case 7: case 8: seg(left, top); break;
        case 5: seg(left, top); seg(bottom, right); break;
        case 10: seg(top, right); seg(left, bottom); break;
      }
    }
  }
  return out;
}
