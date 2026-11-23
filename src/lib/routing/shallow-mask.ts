/**
 * Block land and water too shallow for the boat on the router's grid, from the seabed depth
 * model (GBR 30 m, GEBCO worldwide, AWS elsewhere; see depth.ts). The coastline alone
 * (Natural Earth 1:10m) misses small islands and is a kilometre or more off along some coasts.
 */
import type { LandMask } from "./land.ts";

export type HeightTile = { size: number; h: Float32Array } | null;
export type LoadTile = (z: number, x: number, y: number) => Promise<HeightTile>;

/** Zoom whose pixels are about one grid cell (6–12), and the tiles covering the mask. */
export function maskTiles(m: LandMask, maxTiles = 48): { z: number; x0: number; x1: number; y0: number; y1: number } {
  const cellDeg = Math.min((m.east - m.west) / m.nx, (m.north - m.south) / m.ny);
  let z = Math.max(6, Math.min(12, Math.round(Math.log2(360 / (256 * cellDeg)))));
  const tx = (lng: number, zz: number) => Math.floor(((lng + 180) / 360) * 2 ** zz);
  const ty = (lat: number, zz: number) => {
    const s = Math.sin((lat * Math.PI) / 180);
    return Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** zz);
  };
  for (;;) {
    const r = { z, x0: tx(m.west, z), x1: tx(m.east, z), y0: ty(m.north, z), y1: ty(m.south, z) };
    if ((r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1) <= maxTiles || z <= 6) return r;
    z -= 1;
  }
}

/**
 * Mark cells where the seabed is above −minDepthM (relative to mean sea level): land, drying
 * banks and water shallower than the boat needs. Cells with no depth data are left as they are.
 * Returns how many cells were newly blocked.
 */
export async function markShallow(m: LandMask, minDepthM: number, load: LoadTile): Promise<number> {
  const { z, x0, x1, y0, y1 } = maskTiles(m);
  const tiles = new Map<string, HeightTile>();
  await Promise.all(
    Array.from({ length: (x1 - x0 + 1) * (y1 - y0 + 1) }, async (_, k) => {
      const x = x0 + (k % (x1 - x0 + 1));
      const y = y0 + Math.floor(k / (x1 - x0 + 1));
      tiles.set(`${x}/${y}`, await load(z, x, y).catch(() => null));
    }),
  );
  const n = 2 ** z;
  let blocked = 0;
  const dx = (m.east - m.west) / m.nx;
  const dy = (m.north - m.south) / m.ny;
  for (let iy = 0; iy < m.ny; iy++) {
    const lat = m.south + (iy + 0.5) * dy;
    const s = Math.sin((lat * Math.PI) / 180);
    const wy = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
    for (let ix = 0; ix < m.nx; ix++) {
      const k = iy * m.nx + ix;
      if (m.cells[k]) continue;
      const lng = m.west + (ix + 0.5) * dx;
      const wx = ((lng + 180) / 360) * n;
      const t = tiles.get(`${Math.floor(wx)}/${Math.floor(wy)}`);
      if (!t) continue;
      const px = Math.min(t.size - 1, Math.floor((wx - Math.floor(wx)) * t.size));
      const py = Math.min(t.size - 1, Math.floor((wy - Math.floor(wy)) * t.size));
      const h = t.h[py * t.size + px]!;
      if (h > -32000 && h > -minDepthM) {
        m.cells[k] = 1;
        blocked += 1;
      }
    }
  }
  return blocked;
}
