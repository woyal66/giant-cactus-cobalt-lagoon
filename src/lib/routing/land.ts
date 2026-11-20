/**
 * Land avoidance. Natural Earth 1:10m land polygons (public domain) are
 * rasterised once into a fine grid over the route corridor; checking a route
 * step is then a few array lookups.
 *
 * Limits: the coastline is generalised (a few hundred metres) and does not include
 * reefs, shoals, bommies or small rocks. Routes must still be checked on a chart.
 */
import type { LatLng } from "../geo.ts";
import { haversineMeters } from "../geo.ts";

export type BBox = { south: number; west: number; north: number; east: number };
export type Ring = [number, number][]; // [lng, lat]
export type Polygon = Ring[]; // outer ring + holes

export type LandMask = BBox & { nx: number; ny: number; cells: Uint8Array };

function ringBox(r: Ring): BBox {
  let south = 90;
  let north = -90;
  let west = 180;
  let east = -180;
  for (const [x, y] of r) {
    if (y < south) south = y;
    if (y > north) north = y;
    if (x < west) west = x;
    if (x > east) east = x;
  }
  return { south, west, north, east };
}

function overlaps(a: BBox, b: BBox) {
  return a.west <= b.east && a.east >= b.west && a.south <= b.north && a.north >= b.south;
}

/** Even-odd scanline fill of every polygon into a grid over `box`. */
export function rasterize(polys: Polygon[], box: BBox, cellDeg: number): LandMask {
  const nx = Math.max(1, Math.ceil((box.east - box.west) / cellDeg));
  const ny = Math.max(1, Math.ceil((box.north - box.south) / cellDeg));
  const cells = new Uint8Array(nx * ny);
  const dx = (box.east - box.west) / nx;
  const dy = (box.north - box.south) / ny;
  for (const poly of polys) {
    const outer = poly[0];
    if (!outer || !overlaps(ringBox(outer), box)) continue;
    for (let iy = 0; iy < ny; iy += 1) {
      const y = box.south + (iy + 0.5) * dy;
      const xs: number[] = [];
      for (const ring of poly) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [x1, y1] = ring[i]!;
          const [x2, y2] = ring[j]!;
          if (y1 > y !== y2 > y) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
        }
      }
      if (xs.length < 2) continue;
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const from = Math.max(0, Math.ceil((xs[k]! - box.west) / dx - 0.5));
        const to = Math.min(nx - 1, Math.floor((xs[k + 1]! - box.west) / dx - 0.5));
        for (let ix = from; ix <= to; ix += 1) cells[iy * nx + ix] = 1;
      }
    }
  }
  return { ...box, nx, ny, cells };
}

export function isLand(m: LandMask, p: LatLng): boolean {
  const ix = Math.floor(((p.lng - m.west) / (m.east - m.west)) * m.nx);
  const iy = Math.floor(((p.lat - m.south) / (m.north - m.south)) * m.ny);
  if (ix < 0 || iy < 0 || ix >= m.nx || iy >= m.ny) return false;
  return m.cells[iy * m.nx + ix] === 1;
}

/**
 * Clear land cells near the start and finish: an anchorage in a bay can fall
 * inside the generalised coastline, and the route must still be able to leave it.
 */
export function clearAround(m: LandMask, pts: LatLng[], radiusM: number) {
  const dx = (m.east - m.west) / m.nx;
  const dy = (m.north - m.south) / m.ny;
  for (const p of pts) {
    const ry = Math.ceil(radiusM / 111_320 / dy) + 1;
    const rx = Math.ceil(radiusM / (111_320 * Math.cos((p.lat * Math.PI) / 180)) / dx) + 1;
    const cx = Math.floor((p.lng - m.west) / dx);
    const cy = Math.floor((p.lat - m.south) / dy);
    for (let iy = cy - ry; iy <= cy + ry; iy += 1) {
      for (let ix = cx - rx; ix <= cx + rx; ix += 1) {
        if (ix < 0 || iy < 0 || ix >= m.nx || iy >= m.ny) continue;
        const c = { lat: m.south + (iy + 0.5) * dy, lng: m.west + (ix + 0.5) * dx };
        if (haversineMeters(c, p) <= radiusM) m.cells[iy * m.nx + ix] = 0;
      }
    }
  }
}

/**
 * Shelter at an anchorage: for 16 compass points, is there land within `withinM`
 * in that direction? Wind FROM a sheltered direction blows over land first.
 * Run on the mask before clearAround(), which empties the cells near the finish.
 */
export function shelterAround(m: LandMask, p: LatLng, withinM = 3000): boolean[] {
  const out: boolean[] = [];
  for (let k = 0; k < 16; k += 1) {
    const brg = (k * 22.5 * Math.PI) / 180;
    let hit = false;
    for (let d = 250; d <= withinM && !hit; d += 150) {
      const q = {
        lat: p.lat + (d * Math.cos(brg)) / 111_320,
        lng: p.lng + (d * Math.sin(brg)) / (111_320 * Math.cos((p.lat * Math.PI) / 180)),
      };
      if (isLand(m, q)) hit = true;
    }
    out.push(hit);
  }
  return out;
}

/** Obstacle test for the router: samples the segment every half cell. */
export function landObstacle(m: LandMask) {
  const step = Math.min((m.east - m.west) / m.nx, (m.north - m.south) / m.ny) / 2;
  return (a: LatLng, b: LatLng): boolean => {
    const d = Math.max(Math.abs(b.lat - a.lat), Math.abs(b.lng - a.lng));
    const n = Math.max(1, Math.ceil(d / step));
    for (let i = 1; i <= n; i += 1) {
      const t = i / n;
      if (isLand(m, { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t })) return true;
    }
    return false;
  };
}

/** Load Natural Earth 1:10m land (bundled, ~3 MB, loaded only when routing). */
export async function loadLandPolygons(): Promise<Polygon[]> {
  const [{ feature }, topo] = await Promise.all([
    import("topojson-client"),
    import("world-atlas/land-10m.json"),
  ]);
  const t = (topo as { default?: unknown }).default ?? topo;
  const geo = feature(t as any, (t as any).objects.land) as unknown as {
    features?: { geometry: { type: string; coordinates: unknown } }[];
    geometry?: { type: string; coordinates: unknown };
  };
  const geoms = geo.features ? geo.features.map((f) => f.geometry) : geo.geometry ? [geo.geometry] : [];
  const out: Polygon[] = [];
  for (const g of geoms) {
    if (g.type === "Polygon") out.push(g.coordinates as Polygon);
    else if (g.type === "MultiPolygon") out.push(...(g.coordinates as Polygon[]));
  }
  return out;
}
