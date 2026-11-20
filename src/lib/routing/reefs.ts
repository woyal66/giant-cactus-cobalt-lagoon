/**
 * Reef obstacles for the passage router. The coastline (Natural Earth) has no reefs, so
 * reef outlines come from a bundled file built by scripts/build-reefs.mjs from the GBRMPA
 * "Great Barrier Reef Features" dataset (CC BY). When the file is not in the build, the
 * planner says so and routes do not avoid reefs.
 *
 * File format (public/reefs/gbr.json):
 *   { v: 1, source: string, polys: number[][] }
 *   each poly is one outer ring, flattened [lng, lat, lng, lat, ...] at 1e-5° (about 1 m).
 */
import type { LandMask, Polygon } from "./land.ts";

export const REEF_ASSET_PATH = "/reefs/gbr.json";
export const REEF_SCALE = 1e5;

export type ReefFile = { v: 1; source: string; polys: number[][] };

export function decodeReefs(json: unknown): Polygon[] {
  const f = json as Partial<ReefFile> | null;
  if (!f || f.v !== 1 || !Array.isArray(f.polys)) return [];
  const out: Polygon[] = [];
  for (const flat of f.polys) {
    if (!Array.isArray(flat) || flat.length < 6 || flat.length % 2) continue;
    const ring: [number, number][] = [];
    for (let i = 0; i < flat.length; i += 2) ring.push([flat[i]! / REEF_SCALE, flat[i + 1]! / REEF_SCALE]);
    out.push([ring]);
  }
  return out;
}

/**
 * Mark reef cells on the router's grid. A cell counts as reef when its centre is inside a
 * reef or any reef vertex falls in it, so a reef smaller than a cell is never missed. This
 * also closes passes narrower than a cell: the planner is for passages, not reef entrances.
 */
export function markReefs(mask: LandMask, reefs: Polygon[], rasterize: (p: Polygon[], box: LandMask, cellDeg: number) => LandMask): number {
  const dx = (mask.east - mask.west) / mask.nx;
  const dy = (mask.north - mask.south) / mask.ny;
  const local = reefs.filter((poly) =>
    poly[0]!.some(([x, y]) => x >= mask.west - dx && x <= mask.east + dx && y >= mask.south - dy && y <= mask.north + dy),
  );
  if (!local.length) return 0;
  const filled = rasterize(local, mask, dx);
  let n = 0;
  const mark = (k: number) => {
    if (!mask.cells[k]) n += 1;
    mask.cells[k] = 1;
  };
  if (filled.nx === mask.nx && filled.ny === mask.ny) {
    for (let k = 0; k < filled.cells.length; k += 1) if (filled.cells[k]) mark(k);
  }
  for (const poly of local) {
    for (const [x, y] of poly[0]!) {
      const ix = Math.floor((x - mask.west) / dx);
      const iy = Math.floor((y - mask.south) / dy);
      if (ix >= 0 && iy >= 0 && ix < mask.nx && iy < mask.ny) mark(iy * mask.nx + ix);
    }
  }
  return n;
}

let cache: Promise<Polygon[] | null> | null = null;

/** Bundled reef outlines, or null when this build has none. */
export function loadReefPolygons(origin: string): Promise<Polygon[] | null> {
  cache ??= fetch(`${origin}${REEF_ASSET_PATH}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j ? decodeReefs(j) : null))
    .catch(() => null);
  return cache;
}
