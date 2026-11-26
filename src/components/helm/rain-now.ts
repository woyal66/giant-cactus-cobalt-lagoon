import type { LatLngBounds } from "leaflet";
import { RADAR_MAX_NATIVE_ZOOM, dbzFromGrey, fetchRadarFrames, kmPerPxAt, radarDataTileUrl, worldPx, type RadarFrame } from "@/lib/radar";
import { advect, estimateMotion, medianMotion } from "@/lib/rain";
import { dbzFromRadarColor, usRadarAvailable, usRadarRegion, usRadarUrl } from "@/lib/us-radar";

/** A radar grid: one cell per pixel of zoom `z` (256 px tiles), top-left at world pixel x0, y0. */
export type RainGrid = { z: number; x0: number; y0: number; w: number; h: number };
/** `grid` when the frame is on a finer grid than the rest (NOAA's US radar). */
export type RainFrame = { at: number; dbz: Float32Array; outlook: boolean; grid?: RainGrid };
export type RainNow = {
  grid: RainGrid;
  frames: RainFrame[];
  latestAt: number;
  /** Motion in grid cells per minute, when the radar shows a clear track. */
  motion: { dx: number; dy: number } | null;
  /** Speed and direction the rain is moving toward. */
  speedKn: number | null;
  towardDeg: number | null;
  /** Where the newest frame came from: RainViewer, or NOAA's sharper US mosaic. */
  source: "rainviewer" | "noaa";
};

const OUTLOOK_MIN = [10, 20, 30, 40, 50, 60];
const MAX_CELLS = 900;
const PAST_FRAMES = 7;
const tileCache = new Map<string, Promise<Float32Array | null>>();

/** One radar data tile as dBZ (null when it can't be read: no CORS, no tile, no signal). */
function loadTile(host: string, f: RadarFrame, z: number, x: number, y: number): Promise<Float32Array | null> {
  const n = 2 ** z;
  const key = `${f.path}|${z}|${x}|${y}`;
  const hit = tileCache.get(key);
  if (hit) return hit;
  const p = new Promise<Float32Array | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 256;
      const g = c.getContext("2d", { willReadFrequently: true });
      if (!g) return resolve(null);
      g.drawImage(img, 0, 0);
      try {
        const px = g.getImageData(0, 0, 256, 256).data;
        const out = new Float32Array(256 * 256);
        for (let k = 0; k < out.length; k++) out[k] = dbzFromGrey(px[k * 4]!, px[k * 4 + 3]!);
        resolve(out);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = radarDataTileUrl(host, f, z, ((x % n) + n) % n, y);
  });
  tileCache.set(key, p);
  if (tileCache.size > 600) tileCache.delete(tileCache.keys().next().value!);
  return p;
}

/** The radar grid zoom for a view: as fine as the free tier allows, at most 900 cells across. */
export function rainGridFor(b: LatLngBounds, maxZ = RADAR_MAX_NATIVE_ZOOM): RainGrid {
  for (let z = maxZ; z >= 2; z--) {
    const nw = worldPx(b.getNorth(), b.getWest(), z);
    const se = worldPx(b.getSouth(), b.getEast(), z);
    const x0 = Math.floor(nw.x / 256) * 256;
    const y0 = Math.max(0, Math.floor(nw.y / 256) * 256);
    const x1 = Math.ceil(se.x / 256) * 256;
    const y1 = Math.min(256 * 2 ** z, Math.ceil(se.y / 256) * 256);
    if ((x1 - x0 <= MAX_CELLS && y1 - y0 <= MAX_CELLS) || z === 2) return { z, x0, y0, w: x1 - x0, h: y1 - y0 };
  }
  return { z: 2, x0: 0, y0: 0, w: 1024, h: 1024 };
}

async function frameGrid(host: string, f: RadarFrame, g: RainGrid): Promise<Float32Array | null> {
  const out = new Float32Array(g.w * g.h).fill(-Infinity);
  const loads: Promise<boolean>[] = [];
  for (let ty = g.y0 / 256; ty < (g.y0 + g.h) / 256; ty++) {
    for (let tx = g.x0 / 256; tx < (g.x0 + g.w) / 256; tx++) {
      loads.push(
        loadTile(host, f, g.z, tx, ty).then((t) => {
          if (!t) return false;
          const ox = tx * 256 - g.x0;
          const oy = ty * 256 - g.y0;
          for (let y = 0; y < 256; y++) out.set(t.subarray(y * 256, y * 256 + 256), (oy + y) * g.w + ox);
          return true;
        }),
      );
    }
  }
  const ok = await Promise.all(loads);
  return ok.some(Boolean) ? out : null;
}

/**
 * Radar for the view: the last hour of frames, read as reflectivity, and an outlook for the next
 * hour made by moving the latest frame along the rain's own track. Null when radar can't be read.
 */
export async function loadRainNow(b: LatLngBounds): Promise<RainNow | null> {
  const got = await fetchRadarFrames();
  if (!got) return null;
  const past = got.frames.filter((f) => !f.nowcast).slice(-PAST_FRAMES);
  if (!past.length) return null;
  const grid = rainGridFor(b.pad(0.15));
  const grids = await Promise.all(past.map((f) => frameGrid(got.host, f, grid)));
  const frames: RainFrame[] = [];
  past.forEach((f, i) => {
    const d = grids[i];
    if (d) frames.push({ at: f.at, dbz: d, outlook: false });
  });
  if (!frames.length) return null;
  const last = frames[frames.length - 1]!;
  // Motion from the last few frame pairs, in cells per minute.
  const lat = (b.getNorth() + b.getSouth()) / 2;
  const kmPx = kmPerPxAt(lat, grid.z);
  const pairs = frames.slice(-4);
  const est: Array<{ dx: number; dy: number } | null> = [];
  for (let i = 1; i < pairs.length; i++) {
    const a = pairs[i - 1]!;
    const c = pairs[i]!;
    const mins = (c.at - a.at) / 60_000;
    if (mins <= 0) continue;
    // Rain rarely moves faster than 60 kn: about 19 km in 10 minutes.
    const maxShift = Math.max(2, Math.ceil((1.852 * 60 * (mins / 60)) / kmPx));
    const m = estimateMotion(a.dbz, c.dbz, grid.w, grid.h, maxShift);
    est.push(m ? { dx: m.dx / mins, dy: m.dy / mins } : null);
  }
  const motion = medianMotion(est);
  if (motion) {
    for (const m of OUTLOOK_MIN) {
      frames.push({ at: last.at + m * 60_000, dbz: advect(last.dbz, grid.w, grid.h, motion.dx * m, motion.dy * m), outlook: true });
    }
  }
  const kmPerMin = motion ? Math.hypot(motion.dx, motion.dy) * kmPx : 0;
  const speedKn = motion ? (kmPerMin * 60) / 1.852 : null;
  // US waters: NOAA's 2-minute mosaic, about four times sharper than the free RainViewer zoom.
  // It replaces the newest frame and the outlook (moved along the same track); the past hour
  // stays RainViewer's.
  let latestAt = last.at;
  let source: RainNow["source"] = "rainviewer";
  const c = b.getCenter();
  const region = usRadarAvailable() ? usRadarRegion(c.lat, c.lng) : null;
  if (region) {
    const fine = rainGridFor(b.pad(0.15), 10);
    const dbz = fine.z > grid.z ? await loadUsFrame(region, fine) : null;
    if (dbz) {
      const at = Date.now() - 3 * 60_000; // the mosaic is usually 2–4 minutes old
      const k = 2 ** (fine.z - grid.z);
      const keep = frames.filter((f) => !f.outlook && f.at < at - 4 * 60_000);
      keep.push({ at, dbz, outlook: false, grid: fine });
      if (motion) {
        for (const m of OUTLOOK_MIN) {
          keep.push({ at: at + m * 60_000, dbz: advect(dbz, fine.w, fine.h, motion.dx * m * k, motion.dy * m * k), outlook: true, grid: fine });
        }
      }
      frames.splice(0, frames.length, ...keep);
      latestAt = at;
      source = "noaa";
    }
  }
  return {
    grid,
    frames,
    latestAt,
    source,
    motion,
    speedKn,
    towardDeg: motion && speedKn != null && speedKn >= 2 ? ((Math.atan2(motion.dx, -motion.dy) * 180) / Math.PI + 360) % 360 : null,
  };
}

/** NOAA's mosaic for a grid as dBZ, read back from its colours (null if it can't be read). */
function loadUsFrame(region: NonNullable<ReturnType<typeof usRadarRegion>>, g: RainGrid): Promise<Float32Array | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = g.w;
      c.height = g.h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0, g.w, g.h);
      try {
        const px = ctx.getImageData(0, 0, g.w, g.h).data;
        const out = new Float32Array(g.w * g.h);
        for (let k = 0; k < out.length; k++) out[k] = dbzFromRadarColor(px[k * 4]!, px[k * 4 + 1]!, px[k * 4 + 2]!, px[k * 4 + 3]!);
        resolve(out);
      } catch {
        resolve(null); // no CORS: stay on RainViewer
      }
    };
    img.onerror = () => resolve(null);
    window.setTimeout(() => resolve(null), 15_000);
    img.src = usRadarUrl(region, g.z, g.x0, g.y0, g.w, g.h);
  });
}

/** Grid cell of a position. */
export function cellOf(g: RainGrid, lat: number, lng: number): { x: number; y: number } {
  const p = worldPx(lat, lng, g.z);
  return { x: p.x - g.x0, y: p.y - g.y0 };
}

/** Does the grid still cover this view (so a pan doesn't need a new download)? */
export function gridCovers(g: RainGrid, b: LatLngBounds): boolean {
  const target = rainGridFor(b);
  if (target.z !== g.z) return false;
  return target.x0 >= g.x0 && target.y0 >= g.y0 && target.x0 + target.w <= g.x0 + g.w && target.y0 + target.h <= g.y0 + g.h;
}

/** Position of a world pixel at zoom z (inverse of worldPx). */
export function latLngOfWorld(x: number, y: number, z: number): { lat: number; lng: number } {
  const n = 256 * 2 ** z;
  const lng = (x / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return { lat, lng };
}
