/**
 * Seabed depth from elevation tiles in "terrarium" PNG format (height = R·256 + G + B/256 − 32768 m,
 * relative to mean sea level; negative under water).
 *
 * Default source: AWS Terrain Tiles (open data; seabed from global bathymetry such as GEBCO/ETOPO
 * and GMRT). Around reefs it resolves the reef and its drop-off at a few hundred metres, not
 * bommies. Set VITE_DEPTH_TILES to a terrarium tile URL template ({z}/{x}/{y}) built from a finer
 * model such as the GBR 100 m or 30 m depth grids (see STORE-RELEASE) to use that instead.
 *
 * Approximate. Never a substitute for the sounder, the chart or your eyes.
 */
const ENV = ((import.meta as { env?: Record<string, string | undefined> }).env ?? {}) as Record<string, string | undefined>;

export const DEPTH_TILES =
  ENV.VITE_DEPTH_TILES || "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
export const DEPTH_MAX_Z = Number(ENV.VITE_DEPTH_MAX_Z) || 14;
export const ATTR_DEPTH = ENV.VITE_DEPTH_TILES
  ? "Depth model: see app credits"
  : "Seabed: AWS Terrain Tiles (GEBCO, ETOPO, GMRT and others)";

export function terrariumHeight(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

export function depthTileUrl(z: number, x: number, y: number): string {
  return DEPTH_TILES.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

/** Water depth now: tide height above mean sea level minus the seabed height. */
export function waterDepthM(seabedM: number, tideMslM: number): number {
  return tideMslM - seabedM;
}

/** Shading colour for a water depth (RGBA 0–255), or null for land / no shading. */
export function depthColor(depthM: number): [number, number, number, number] | null {
  if (!(depthM > 0)) return null;
  if (depthM < 2) return [230, 60, 60, 150];
  if (depthM < 5) return [240, 170, 50, 120];
  if (depthM < 10) return [240, 230, 90, 80];
  if (depthM < 20) return [80, 200, 220, 55];
  if (depthM < 50) return [40, 110, 210, 50];
  return [20, 40, 140, 55];
}

export const DEPTH_LEGEND: Array<{ label: string; rgba: [number, number, number, number] }> = [
  { label: "< 2 m", rgba: [230, 60, 60, 150] },
  { label: "2–5", rgba: [240, 170, 50, 120] },
  { label: "5–10", rgba: [240, 230, 90, 80] },
  { label: "10–20", rgba: [80, 200, 220, 55] },
  { label: "20–50", rgba: [40, 110, 210, 50] },
  { label: "> 50", rgba: [20, 40, 140, 55] },
];

/** "Too shallow" colour: red under the limit, amber within 1 m of it. */
export function shallowColor(depthM: number, limitM: number): [number, number, number, number] | null {
  if (!(depthM > -0.5)) return null; // land
  if (depthM < limitM) return [230, 40, 40, 160];
  if (depthM < limitM + 1) return [240, 170, 40, 110];
  return null;
}

export type DemTile = { z: number; x: number; y: number; size: number; h: Float32Array };

const cache = new Map<string, Promise<DemTile | null>>();

/** Decoded heights for one tile (cached). Works in the page and in a worker. */
export function loadDemTile(z: number, x: number, y: number): Promise<DemTile | null> {
  const key = `${z}/${x}/${y}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      try {
        // Saved with an offline pack? Use that; otherwise download (and keep it).
        const cacheKey = `depth/${z}/${x}/${y}`;
        const tiles = typeof indexedDB !== "undefined" ? await import("./offline-tiles.ts") : null;
        let blob = tiles ? await tiles.readTile(cacheKey) : null;
        if (!blob) {
          const r = await fetch(depthTileUrl(z, x, y), { mode: "cors" });
          if (!r.ok) return null;
          blob = await r.blob();
          if (tiles) void tiles.putTile(cacheKey, blob).catch(() => undefined);
        }
        const bmp = await createImageBitmap(blob);
        const size = bmp.width;
        const canvas: OffscreenCanvas | HTMLCanvasElement =
          typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(size, size) : Object.assign(document.createElement("canvas"), { width: size, height: size });
        const g = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
        if (!g) return null;
        g.drawImage(bmp, 0, 0);
        bmp.close();
        const px = g.getImageData(0, 0, size, size).data;
        const h = new Float32Array(size * size);
        for (let i = 0; i < size * size; i++) h[i] = terrariumHeight(px[i * 4]!, px[i * 4 + 1]!, px[i * 4 + 2]!);
        return { z, x, y, size, h };
      } catch {
        return null;
      }
    })();
    cache.set(key, p);
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
  }
  return p;
}

function worldXY(lat: number, lng: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n };
}

/** Seabed height (m, MSL) at a point, bilinear within the tile; null if the tile isn't available. */
export async function seabedAt(lat: number, lng: number, z = Math.min(12, DEPTH_MAX_Z)): Promise<number | null> {
  const w = worldXY(lat, lng, z);
  const tx = Math.floor(w.x);
  const ty = Math.floor(w.y);
  const t = await loadDemTile(z, tx, ty);
  if (!t) return null;
  return sampleTile(t, (w.x - tx) * t.size, (w.y - ty) * t.size);
}

export function sampleTile(t: DemTile, px: number, py: number): number {
  const x0 = Math.max(0, Math.min(t.size - 1, Math.floor(px - 0.5)));
  const y0 = Math.max(0, Math.min(t.size - 1, Math.floor(py - 0.5)));
  const x1 = Math.min(t.size - 1, x0 + 1);
  const y1 = Math.min(t.size - 1, y0 + 1);
  const fx = Math.max(0, Math.min(1, px - 0.5 - x0));
  const fy = Math.max(0, Math.min(1, py - 0.5 - y0));
  const a = t.h[y0 * t.size + x0]!;
  const b = t.h[y0 * t.size + x1]!;
  const c = t.h[y1 * t.size + x0]!;
  const d = t.h[y1 * t.size + x1]!;
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

/**
 * Shallow stretches along a route: samples every ~200 m and reports where the depth (at mean
 * sea level, i.e. without tide) is under the limit. Returns one entry per stretch.
 */
export async function shallowAlong(
  pts: { lat: number; lng: number }[],
  limitM: number,
  stepM = 200,
): Promise<Array<{ lat: number; lng: number; depthM: number }>> {
  const out: Array<{ lat: number; lng: number; depthM: number }> = [];
  let inShallow = false;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const dLat = (b.lat - a.lat) * 111_320;
    const dLng = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
    const n = Math.max(1, Math.ceil(Math.hypot(dLat, dLng) / stepM));
    for (let k = 0; k < n; k++) {
      const lat = a.lat + ((b.lat - a.lat) * k) / n;
      const lng = a.lng + ((b.lng - a.lng) * k) / n;
      const h = await seabedAt(lat, lng);
      if (h == null) continue;
      const depth = -h;
      const shallow = depth > -0.5 && depth < limitM;
      if (shallow && !inShallow) out.push({ lat, lng, depthM: depth });
      else if (shallow && depth < out[out.length - 1]!.depthM) out[out.length - 1] = { lat, lng, depthM: depth };
      inShallow = shallow;
    }
  }
  return out;
}
