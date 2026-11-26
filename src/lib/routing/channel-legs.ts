/**
 * Run the channel finder on each short leg of a passage and turn what it finds into extra
 * waypoints, with a fine obstacle check for the legs between them. Runs in the routing worker.
 */
import { haversineMeters, type LatLng } from "../geo.ts";
import { findChannel, type DepthGrid } from "./channel.ts";
import { landObstacle, rasterize, type LandMask, type Polygon } from "./land.ts";
import { markReefs } from "./reefs.ts";
import type { Obstacle } from "./router.ts";
import { heightGrid, type LoadTile } from "./shallow-mask.ts";

/** Legs longer than this go offshore; the coarse grid is fine there. */
const MAX_LEG_M = 60_000;
const MAX_CELLS = 260;

export type ChannelPlan = {
  /** All waypoints between start and finish: the skipper's plus the channel's, in order. */
  via: LatLng[];
  /** Obstacle per leg (start→via[0], …, via[n−1]→finish); undefined = the coarse one. */
  legObstacles: (Obstacle | undefined)[];
  /** How many waypoints the channel finder added. */
  added: number;
  /** Legs checked on the fine depth grid. */
  checked: number;
};

export async function planChannels(
  stops: LatLng[],
  minDepthM: number,
  land: Polygon[],
  reefs: Polygon[] | null,
  load: LoadTile,
): Promise<ChannelPlan> {
  const via: LatLng[] = [];
  const legObstacles: (Obstacle | undefined)[] = [];
  let added = 0;
  let checked = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    const lenM = haversineMeters(a, b);
    let pts: LatLng[] | null = null;
    let fine: Obstacle | undefined;
    if (minDepthM > 0 && lenM > 150 && lenM <= MAX_LEG_M) {
      const padM = Math.max(1200, lenM * 0.35);
      const padLat = padM / 111_320;
      const padLng = padM / (111_320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180));
      const box = {
        south: Math.min(a.lat, b.lat) - padLat,
        north: Math.max(a.lat, b.lat) + padLat,
        west: Math.min(a.lng, b.lng) - padLng,
        east: Math.max(a.lng, b.lng) + padLng,
      };
      const spanM = Math.max((box.north - box.south) * 111_320, (box.east - box.west) * 111_320 * Math.cos((a.lat * Math.PI) / 180));
      const cellM = Math.max(30, spanM / MAX_CELLS);
      const cellDeg = cellM / 111_320;
      const mask: LandMask = rasterize(land, box, cellDeg);
      if (reefs) markReefs(mask, reefs, rasterize);
      const h = await heightGrid(mask, load).catch(() => null);
      if (h) {
        const depth = new Float32Array(h.length);
        for (let k = 0; k < h.length; k++) depth[k] = Number.isFinite(h[k]!) ? -h[k]! : NaN;
        const grid: DepthGrid = { ...box, nx: mask.nx, ny: mask.ny, depth, land: mask.cells };
        pts = findChannel(grid, a, b, { minDepthM });
        if (pts) {
          // The legs through the channel are checked on this fine grid (shallow cells blocked,
          // except right at the leg's own ends).
          const blocked: LandMask = { ...box, nx: mask.nx, ny: mask.ny, cells: new Uint8Array(mask.cells) };
          for (let k = 0; k < depth.length; k++) if (depth[k]! < minDepthM) blocked.cells[k] = 1;
          const clear = (p: LatLng) => {
            const ix = Math.floor(((p.lng - box.west) / (box.east - box.west)) * mask.nx);
            const iy = Math.floor(((p.lat - box.south) / (box.north - box.south)) * mask.ny);
            for (let y = iy - 1; y <= iy + 1; y++) for (let x = ix - 1; x <= ix + 1; x++) if (x >= 0 && y >= 0 && x < mask.nx && y < mask.ny) blocked.cells[y * mask.nx + x] = 0;
          };
          clear(a);
          clear(b);
          fine = landObstacle(blocked);
        }
      }
    }
    if (pts) checked += 1;
    if (pts && pts.length) {
      for (const p of pts) {
        legObstacles.push(fine);
        via.push(p);
      }
      added += pts.length;
    }
    legObstacles.push(pts ? fine : undefined);
    if (i < stops.length - 2) via.push(b);
  }
  return { via, legObstacles, added, checked };
}
