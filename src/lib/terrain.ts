/**
 * Land relief for the chart: hill shading (light from the north-west, as on paper charts) and
 * the heights for contour lines. Pure, so it is tested; the chart layer feeds it tile heights.
 */

/** Height lines on land: every 50 m, labelled every 100 m. */
export const LAND_LINE_STEP_M = 50;

/**
 * Shading for each cell of a height grid (n × n, row by row from the top), 0 = full shadow,
 * 1 = full light, NaN where the cell is water (height ≤ 0) or has no data. `cellM` is the cell
 * size in metres. Standard hillshade: sun from azimuth 315°, 45° up.
 */
export function hillshade(h: Float32Array, n: number, cellM: number, exaggerate = 1.5): Float32Array {
  const out = new Float32Array(n * n).fill(NaN);
  const az = (315 * Math.PI) / 180;
  const alt = (45 * Math.PI) / 180;
  const at = (x: number, y: number) => h[Math.max(0, Math.min(n - 1, y)) * n + Math.max(0, Math.min(n - 1, x))]!;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = at(x, y);
      if (!(v > 0)) continue;
      // Slope from the neighbours (east − west, south − north), metres per metre.
      const dzdx = ((at(x + 1, y) - at(x - 1, y)) / (2 * cellM)) * exaggerate;
      const dzdy = ((at(x, y + 1) - at(x, y - 1)) / (2 * cellM)) * exaggerate;
      const slope = Math.atan(Math.hypot(dzdx, dzdy));
      // Aspect measured clockwise from north; image y grows southwards.
      const aspect = Math.atan2(dzdx, -dzdy);
      const s = Math.cos(alt) * Math.cos(slope) + Math.sin(alt) * Math.sin(slope) * Math.cos(az - aspect - Math.PI);
      out[y * n + x] = Math.max(0, Math.min(1, s));
    }
  }
  return out;
}

/** Colour and opacity for a shade value over the photo: dark on shadowed slopes, light on lit ones. */
export function shadeRgba(s: number): [number, number, number, number] | null {
  if (!Number.isFinite(s)) return null;
  const flat = 0.707; // cos 45°: level ground
  if (s < flat) return [10, 20, 30, Math.round(Math.min(170, ((flat - s) / flat) * 260))];
  return [255, 250, 235, Math.round(Math.min(90, ((s - flat) / (1 - flat)) * 120))];
}
