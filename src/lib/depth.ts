/**
 * Seabed depth from elevation tiles in "terrarium" PNG format (height = R·256 + G + B/256 − 32768 m,
 * relative to mean sea level; negative under water).
 *
 * Sources merged tile by tile (DEPTH_SOURCES, then the base):
 *  - Fine: VITE_DEPTH_TILES, terrarium tiles built by scripts/build-depth-tiles.py from the
 *    Geoscience Australia "Great Barrier Reef bathymetry 2020 30 m" grids (CC BY 4.0, MSL).
 *    Covers 142–156° E, 10–29° S to zoom 12 (about 35 m a pixel). Deep-ocean and inland tiles are
 *    left out (404) and pixels with no data are 0,0,0.
 *  - Global: VITE_DEPTH_GLOBAL_TILES, GEBCO_2026 (public domain, about 450 m) to zoom 8 where
 *    there is water shallower than 200 m (scripts/build-gebco-tiles.py), enlarged beyond that.
 *  - Base: AWS Terrain Tiles (ETOPO1 offshore, about 1.8 km): deep ocean, inland, and gaps.
 *
 * Approximate. Never a substitute for the sounder, the chart or your eyes.
 */
const ENV = ((import.meta as { env?: Record<string, string | undefined> }).env ?? {}) as Record<string, string | undefined>;

export const BASE_DEPTH_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
/** The fine (GBR 30 m) tile template, or "" when this build has none. */
export const FINE_DEPTH_TILES = ENV.VITE_DEPTH_TILES || "";
export const FINE_MAX_Z = Number(ENV.VITE_DEPTH_FINE_MAX_Z) || 12;
/** [west, south, east, north] of the fine model. */
export const FINE_BOUNDS: [number, number, number, number] = [142, -29, 156, -10];
/** Worldwide shelf tiles from GEBCO (about 450 m), or "" when this build has none. */
export const GLOBAL_DEPTH_TILES = ENV.VITE_DEPTH_GLOBAL_TILES || "";
export const GLOBAL_MAX_Z = Number(ENV.VITE_DEPTH_GLOBAL_MAX_Z) || 8;
/** Deepest zoom fetched; beyond it tiles are enlarged (the models are no finer). */
export const DEPTH_MAX_Z = Number(ENV.VITE_DEPTH_MAX_Z) || (FINE_DEPTH_TILES || GLOBAL_DEPTH_TILES ? 12 : 14);
/** For MapLibre (3D view): served from loadDemTile through the depthdem:// protocol. */
export const DEPTH_TILES = "depthdem://{z}/{x}/{y}";
export const ATTR_DEPTH = [
  FINE_DEPTH_TILES ? "Depth: GBR 30 m bathymetry 2020 (Beaman, Geoscience Australia, CC BY 4.0)" : null,
  GLOBAL_DEPTH_TILES ? "GEBCO_2026 Grid (GEBCO Compilation Group)" : null,
  FINE_DEPTH_TILES || GLOBAL_DEPTH_TILES ? "elsewhere AWS Terrain Tiles" : "Seabed: AWS Terrain Tiles (GEBCO, ETOPO, GMRT and others)",
]
  .filter(Boolean)
  .join("; ");

/** A depth tile source, most detailed first; each fills the gaps of the one before. */
export type DepthSource = { template: string; maxZ: number; bounds?: [number, number, number, number] };

export const DEPTH_SOURCES: DepthSource[] = [
  ...(FINE_DEPTH_TILES ? [{ template: FINE_DEPTH_TILES, maxZ: FINE_MAX_Z, bounds: FINE_BOUNDS }] : []),
  ...(GLOBAL_DEPTH_TILES ? [{ template: GLOBAL_DEPTH_TILES, maxZ: GLOBAL_MAX_Z }] : []),
];

export function terrariumHeight(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

/** Heights at or below this are "no data" in the fine tiles (encoded 0,0,0). */
export const NO_DATA_M = -32000;

function fill(template: string, z: number, x: number, y: number): string {
  return template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

export function depthTileUrl(z: number, x: number, y: number): string {
  return fill(BASE_DEPTH_TILES, z, x, y);
}

/** Does tile z/x/y overlap the fine model's area? */
export function inFineArea(z: number, x: number, y: number, bounds = FINE_BOUNDS): boolean {
  const n = 2 ** z;
  const lng = (t: number) => (t / n) * 360 - 180;
  const lat = (t: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * t) / n))) * 180) / Math.PI;
  const [w, s, e, nn] = bounds;
  return lng(x + 1) > w && lng(x) < e && lat(y) > s && lat(y + 1) < nn;
}

/** Fill no-data heights in `fine` from `base` (same size). Returns how many were filled. */
export function mergeHeights(fine: Float32Array, base: Float32Array | null, keepGaps = false): number {
  let n = 0;
  for (let i = 0; i < fine.length; i++) {
    if (fine[i]! <= NO_DATA_M) {
      if (base) fine[i] = base[i]!;
      else if (!keepGaps) fine[i] = 0;
      else continue;
      n += 1;
    }
  }
  return n;
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

type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function canvas(size: number): { c: OffscreenCanvas | HTMLCanvasElement; g: Canvas2D | null } {
  const c: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(size, size) : Object.assign(document.createElement("canvas"), { width: size, height: size });
  return { c, g: c.getContext("2d") as Canvas2D | null };
}

async function decode(blob: Blob): Promise<{ size: number; h: Float32Array }> {
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: "none", colorSpaceConversion: "none" });
  const size = bmp.width;
  const { g } = canvas(size);
  if (!g) throw new Error("no canvas");
  g.drawImage(bmp, 0, 0);
  bmp.close();
  const px = g.getImageData(0, 0, size, size).data;
  const h = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) h[i] = terrariumHeight(px[i * 4]!, px[i * 4 + 1]!, px[i * 4 + 2]!);
  return { size, h };
}

async function encode(size: number, h: Float32Array): Promise<Blob | null> {
  const { c, g } = canvas(size);
  if (!g) return null;
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.max(0, Math.min(65535.99, h[i]! + 32768));
    const r = Math.floor(v / 256);
    const gg = Math.floor(v - r * 256);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = gg;
    img.data[i * 4 + 2] = Math.floor((v - r * 256 - gg) * 256);
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return "convertToBlob" in c ? c.convertToBlob({ type: "image/png" }) : new Promise((res) => (c as HTMLCanvasElement).toBlob(res, "image/png"));
}

async function get(url: string): Promise<Blob | null> {
  try {
    const r = await fetch(url, { mode: "cors" });
    return r.ok ? await r.blob() : null;
  } catch {
    return null;
  }
}

/**
 * Enlarge part of a parent tile: the sub-square for tile (x, y) at `scale` times the zoom,
 * bilinear, as a full-size tile.
 */
export function cropParent(h: Float32Array, size: number, scale: number, qx: number, qy: number): Float32Array {
  const out = new Float32Array(size * size);
  const span = size / scale;
  for (let j = 0; j < size; j++) {
    const sy = qy * span + ((j + 0.5) / size) * span - 0.5;
    const y0 = Math.max(0, Math.min(size - 1, Math.floor(sy)));
    const y1 = Math.min(size - 1, y0 + 1);
    const fy = Math.max(0, Math.min(1, sy - y0));
    for (let i = 0; i < size; i++) {
      const sx = qx * span + ((i + 0.5) / size) * span - 0.5;
      const x0 = Math.max(0, Math.min(size - 1, Math.floor(sx)));
      const x1 = Math.min(size - 1, x0 + 1);
      const fx = Math.max(0, Math.min(1, sx - x0));
      const a = h[y0 * size + x0]!;
      const b = h[y0 * size + x1]!;
      const c = h[y1 * size + x0]!;
      const d = h[y1 * size + x1]!;
      // Don't blend real heights with "no data".
      out[j * size + i] =
        a <= NO_DATA_M || b <= NO_DATA_M || c <= NO_DATA_M || d <= NO_DATA_M
          ? [a, b, c, d][(fy < 0.5 ? 0 : 2) + (fx < 0.5 ? 0 : 1)]!
          : a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
    }
  }
  return out;
}

const parents = new Map<string, Promise<{ size: number; h: Float32Array } | null>>();

/** One source's heights for a tile (enlarged from its deepest zoom when needed), or null. */
async function sourceHeights(src: DepthSource, z: number, x: number, y: number): Promise<{ size: number; h: Float32Array; blob?: Blob } | null> {
  if (src.bounds && !inFineArea(z, x, y, src.bounds)) return null;
  if (z <= src.maxZ) {
    const blob = await get(fill(src.template, z, x, y));
    return blob ? { ...(await decode(blob)), blob } : null;
  }
  const scale = 2 ** (z - src.maxZ);
  const px = Math.floor(x / scale);
  const py = Math.floor(y / scale);
  const key = `${src.template}|${px}/${py}`;
  let p = parents.get(key);
  if (!p) {
    p = get(fill(src.template, src.maxZ, px, py)).then((b) => (b ? decode(b) : null));
    parents.set(key, p);
    if (parents.size > 40) parents.delete(parents.keys().next().value!);
  }
  const parent = await p;
  if (!parent) return null;
  return { size: parent.size, h: cropParent(parent.h, parent.size, scale, x - px * scale, y - py * scale) };
}

/**
 * One depth tile as a terrarium PNG: each source in DEPTH_SOURCES fills what the ones before
 * left as no data, then the base source fills the rest. Saved in the offline tile store (key
 * depth/z/x/y) once fetched, so offline packs and the 3D view read the same merged tile.
 */
async function loadDepthTile(z: number, x: number, y: number): Promise<{ blob: Blob; size: number; h: Float32Array } | null> {
  const cacheKey = `depth/${z}/${x}/${y}`;
  const tiles = typeof indexedDB !== "undefined" ? await import("./offline-tiles.ts") : null;
  const saved = tiles ? await tiles.readTile(cacheKey) : null;
  if (saved) return { blob: saved, ...(await decode(saved)) };
  let out: { size: number; h: Float32Array; blob?: Blob } | null = null;
  let merged = false;
  for (const src of DEPTH_SOURCES) {
    if (out && !out.h.some((v) => v <= NO_DATA_M)) break;
    const t = await sourceHeights(src, z, x, y).catch(() => null);
    if (!t) continue;
    if (!out) out = t;
    else if (t.size === out.size) {
      mergeHeights(out.h, t.h, true);
      merged = true;
    }
  }
  if (!out || out.h.some((v) => v <= NO_DATA_M)) {
    const base = await get(depthTileUrl(z, x, y));
    const b = base ? await decode(base) : null;
    if (!out) {
      if (!base || !b) return null;
      out = { ...b, blob: base };
    } else {
      mergeHeights(out.h, b && b.size === out.size ? b.h : null);
      merged = true;
    }
  }
  const blob = !merged && out.blob ? out.blob : await encode(out.size, out.h);
  if (!blob) return null;
  if (tiles) void tiles.putTile(cacheKey, blob).catch(() => undefined);
  return { blob, size: out.size, h: out.h };
}

const cache = new Map<string, Promise<{ blob: Blob; size: number; h: Float32Array } | null>>();

function cached(z: number, x: number, y: number) {
  const key = `${z}/${x}/${y}`;
  let p = cache.get(key);
  if (!p) {
    p = loadDepthTile(z, x, y).catch(() => null);
    cache.set(key, p);
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
  }
  return p;
}

/** Decoded heights for one tile (cached). Works in the page and in a worker. */
export async function loadDemTile(z: number, x: number, y: number): Promise<DemTile | null> {
  const t = await cached(z, x, y);
  return t ? { z, x, y, size: t.size, h: t.h } : null;
}

/** The merged tile as PNG bytes, for MapLibre's depthdem:// protocol. */
export async function depthTilePng(z: number, x: number, y: number): Promise<ArrayBuffer | null> {
  const t = await cached(z, x, y);
  return t ? t.blob.arrayBuffer() : null;
}

/** Let MapLibre read depth tiles through loadDemTile (merged, cached, offline). */
export function registerDepthProtocol(maplibre: { addProtocol: (name: string, fn: (p: { url: string }) => Promise<{ data: unknown }>) => void }) {
  maplibre.addProtocol("depthdem", async (params) => {
    const m = /depthdem:\/\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
    const data = m ? await depthTilePng(+m[1]!, +m[2]!, +m[3]!) : null;
    if (!data) throw new Error("no depth tile");
    return { data };
  });
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
