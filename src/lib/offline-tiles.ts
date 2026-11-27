import { destPoint, haversineMeters, type LatLng } from "./geo.ts";
import {
  ESRI_URL,
  LICENSED_IMAGERY_ONLY,
  SENTINEL_URL,
  STUB_TILE_BYTES,
  satTileUrl,
  sourceReady,
} from "./imagery.ts";
import { nearestReef } from "./reefs.ts";

export type OfflineSource = "maxar" | "sentinel" | "maptiler" | "gov";
export type PackQuality = "helm" | "close";
export type PackZoom = 16 | 17 | 18 | 19 | 20;

export type BBox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type OfflinePack = {
  id: string;
  name: string;
  bounds: BBox;
  minZ: number;
  maxZ: number;
  sources: OfflineSource[];
  tiles: number;
  /** Tiles that still failed after a retry (the pack is usable, with gaps). */
  missing?: number;
  bytes: number;
  savedAt: string;
};

export type PackEstimate = {
  tiles: number;
  bytes: number;
  minZ: number;
  maxZ: number;
  km: number;
  tooWide: boolean;
};

const DB_NAME = "reefpilot-tiles";
const DB_VER = 1;
const AVG_TILE = 28_000;
const MAX_TILES = 8_000;
/**
 * Sources saved into an offline pack. Bulk-saving tiles is only allowed where the
 * provider's terms permit device caching: MapTiler does on paid plans; the free
 * Esri and EOX endpoints are kept for development builds only.
 */
function packSources(): OfflineSource[] {
  const out: OfflineSource[] = [];
  if (sourceReady("maptiler")) out.push("maptiler");
  if (!LICENSED_IMAGERY_ONLY) out.push("sentinel", "maxar");
  // Openly licensed (CC BY 4.0 / public domain), so they may be saved: Sentinel-2 2016 and the
  // government aerial photos where one covers the area.
  else out.push("gov", "sentinel");
  return out;
}
const SOURCES: OfflineSource[] = packSources();
export const PACK_ZOOMS: PackZoom[] = [16, 17, 18, 19, 20];
/**
 * Deepest level worth saving per source. z20 ("maximum detail") suits the sharp-photo mode,
 * which shows the level one deeper than the map zoom; it is only saved where the source
 * really has it, so packs don't fill with stretched copies.
 */
export const SOURCE_MAX_Z: Record<OfflineSource, number> = { maptiler: 20, maxar: 19, sentinel: LICENSED_IMAGERY_ONLY ? 15 : 19, gov: 19 };

let abort: AbortController | null = null;

export function lngToTile(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

export function latToTile(lat: number, z: number): number {
  const n = 2 ** z;
  const φ = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(φ) + 1 / Math.cos(φ)) / Math.PI) / 2) * n;
  return Math.floor(y);
}

export function tileRange(b: BBox, z: number) {
  const n = 2 ** z;
  const x0 = Math.max(0, lngToTile(b.west, z));
  const x1 = Math.min(n - 1, lngToTile(b.east, z));
  const y0 = Math.max(0, latToTile(b.north, z));
  const y1 = Math.min(n - 1, latToTile(b.south, z));
  const dx = Math.max(0, x1 - x0 + 1);
  const dy = Math.max(0, y1 - y0 + 1);
  return { x0, x1, y0, y1, count: dx * dy };
}

export function countTiles(b: BBox, minZ: number, maxZ: number): number {
  let n = 0;
  for (let z = minZ; z <= maxZ; z += 1) n += tileRange(b, z).count;
  return n;
}

export function boxShortM(b: BBox): number {
  const midLat = (b.south + b.north) / 2;
  const midLng = (b.west + b.east) / 2;
  const ns = haversineMeters(
    { lat: b.south, lng: midLng },
    { lat: b.north, lng: midLng },
  );
  const ew = haversineMeters(
    { lat: midLat, lng: b.west },
    { lat: midLat, lng: b.east },
  );
  return Math.min(ns, ew);
}

export function boxKm(b: BBox): number {
  const midLat = (b.south + b.north) / 2;
  const midLng = (b.west + b.east) / 2;
  const ns = haversineMeters(
    { lat: b.south, lng: midLng },
    { lat: b.north, lng: midLng },
  );
  const ew = haversineMeters(
    { lat: midLat, lng: b.west },
    { lat: midLat, lng: b.east },
  );
  return Math.max(ns, ew) / 1000;
}

export function boxAround(p: LatLng, radiusM: number): BBox {
  const n = destPoint(p, 0, radiusM);
  const s = destPoint(p, 180, radiusM);
  const e = destPoint(p, 90, radiusM);
  const w = destPoint(p, 270, radiusM);
  return { north: n.lat, south: s.lat, east: e.lng, west: w.lng };
}

export function packName(b: BBox): string {
  const lat = (b.south + b.north) / 2;
  const lng = (b.west + b.east) / 2;
  const reef = nearestReef(lat, lng, 14_000);
  if (reef) return reef.name;
  return "This view";
}

export function boxFromCorners(a: LatLng, b: LatLng): BBox {
  return {
    south: Math.min(a.lat, b.lat),
    north: Math.max(a.lat, b.lat),
    west: Math.min(a.lng, b.lng),
    east: Math.max(a.lng, b.lng),
  };
}

/** A drag is one diagonal of a square, so a sideways swipe still covers water, not a line. */
export function squareFromCorners(a: LatLng, b: LatLng): BBox {
  const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
  const ns = haversineMeters(
    { lat: a.lat, lng: mid.lng },
    { lat: b.lat, lng: mid.lng },
  );
  const ew = haversineMeters(
    { lat: mid.lat, lng: a.lng },
    { lat: mid.lat, lng: b.lng },
  );
  return boxAround(mid, Math.max(ns, ew, 1) / 2);
}

export function packCovers(pack: OfflinePack, lat: number, lng: number, needZ = 16): boolean {
  const b = pack.bounds;
  return (
    pack.maxZ >= needZ &&
    lat >= b.south &&
    lat <= b.north &&
    lng >= b.west &&
    lng <= b.east
  );
}

export function packOnPhone(
  packs: OfflinePack[],
  lat: number,
  lng: number,
  needZ = 16,
): OfflinePack | null {
  return packs.find((p) => packCovers(p, lat, lng, needZ)) ?? null;
}

function resolveMaxZ(quality: PackQuality | PackZoom): PackZoom {
  if (quality === "helm") return 18;
  if (quality === "close") return 19;
  return quality;
}

export function estimatePack(b: BBox, quality: PackQuality | PackZoom = 18): PackEstimate {
  const km = boxKm(b);
  const maxZ = resolveMaxZ(quality);
  const minZ = 16 as const;
  const tiles = SOURCES.reduce((n, src) => n + countTiles(b, minZ, Math.min(maxZ, SOURCE_MAX_Z[src])), 0);
  const tooWide = km > 40 || tiles > MAX_TILES || boxShortM(b) < 80;
  return {
    tiles,
    bytes: tiles * AVG_TILE,
    minZ,
    maxZ,
    km,
    tooWide,
  };
}

export function formatBytes(n: number): string {
  if (n < 900_000) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1_048_576).toFixed(n >= 10_485_760 ? 0 : 1)} MB`;
}

export function tileKey(source: OfflineSource, z: number, x: number, y: number) {
  return `${source}/${z}/${x}/${y}`;
}

export function tileUrl(source: OfflineSource, z: number, x: number, y: number) {
  if (source === "maptiler") return satTileUrl("maptiler", x, y, z);
  if (source === "gov") return satTileUrl("gov", x, y, z);
  const t = source === "maxar" ? ESRI_URL : SENTINEL_URL;
  return t
    .replace("{z}", String(z))
    .replace("{y}", String(y))
    .replace("{x}", String(x));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("tiles")) db.createObjectStore("tiles");
      if (!db.objectStoreNames.contains("packs")) db.createObjectStore("packs");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function readTile(key: string): Promise<Blob | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("tiles", "readonly");
      const req = tx.objectStore("tiles").get(key);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function putTile(key: string, blob: Blob) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("tiles", "readwrite");
    tx.objectStore("tiles").put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listPacks(): Promise<OfflinePack[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("packs", "readonly");
      const req = tx.objectStore("packs").getAll();
      req.onsuccess = () => {
        const rows = (req.result as OfflinePack[]) ?? [];
        rows.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function deletePack(id: string) {
  const packs = await listPacks();
  const pack = packs.find((p) => p.id === id);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["tiles", "packs"], "readwrite");
    const tiles = tx.objectStore("tiles");
    if (pack) {
      for (const source of pack.sources) {
        for (let z = pack.minZ; z <= pack.maxZ; z += 1) {
          const r = tileRange(pack.bounds, z);
          for (let x = r.x0; x <= r.x1; x += 1) {
            for (let y = r.y0; y <= r.y1; y += 1) {
              tiles.delete(tileKey(source, z, x, y));
            }
          }
        }
      }
    }
    tx.objectStore("packs").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function savePackMeta(pack: OfflinePack) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("packs", "readwrite");
    tx.objectStore("packs").put(pack, pack.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function cancelPackDownload() {
  abort?.abort();
}

export type PackProgress = {
  done: number;
  total: number;
  bytes: number;
};

export async function downloadPack(
  b: BBox,
  quality: PackQuality | PackZoom,
  name: string,
  onProgress: (p: PackProgress) => void,
): Promise<OfflinePack> {
  const est = estimatePack(b, quality);
  if (est.tooWide) {
    throw new Error("Zoom in on the reef — packs cover a lagoon, not the ocean.");
  }
  void navigator.storage?.persist?.();
  abort?.abort();
  abort = new AbortController();
  const signal = abort.signal;
  const jobs: { source: OfflineSource; z: number; x: number; y: number }[] = [];
  for (const source of SOURCES) {
    for (let z = est.minZ; z <= Math.min(est.maxZ, SOURCE_MAX_Z[source]); z += 1) {
      const r = tileRange(b, z);
      for (let x = r.x0; x <= r.x1; x += 1) {
        for (let y = r.y0; y <= r.y1; y += 1) {
          // No free government service here: nothing to save for that source.
          if (source === "gov" && !tileUrl(source, z, x, y)) continue;
          jobs.push({ source, z, x, y });
        }
      }
    }
  }
  let done = 0;
  let bytes = 0;
  let missing = 0;
  const workers = 6;
  /** One flaky tile (a signal drop, a 503) must not throw away the whole pack. */
  const fetchTile = async (url: string): Promise<Blob | null> => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await fetch(url, { mode: "cors", signal });
        if (res.ok) return await res.blob();
        if (res.status === 404) return null;
      } catch (err) {
        if (signal.aborted) throw err;
      }
    }
    return null;
  };
  let cursor = 0;
  const run = async () => {
    while (cursor < jobs.length) {
      if (signal.aborted) throw new DOMException("cancelled", "AbortError");
      const i = cursor;
      cursor += 1;
      const job = jobs[i]!;
      const key = tileKey(job.source, job.z, job.x, job.y);
      const hit = await readTile(key);
      if (hit && hit.size >= STUB_TILE_BYTES) {
        bytes += hit.size;
      } else {
        const url = tileUrl(job.source, job.z, job.x, job.y);
        const blob = await fetchTile(url);
        if (blob && blob.size >= STUB_TILE_BYTES) {
          await putTile(key, blob);
          bytes += blob.size;
        } else if (!blob) {
          missing += 1;
        }
      }
      done += 1;
      if (done % 8 === 0 || done === jobs.length) {
        onProgress({ done, total: jobs.length, bytes });
      }
    }
  };
  await Promise.all(Array.from({ length: workers }, () => run()));
  const pack: OfflinePack = {
    id: `${Date.now().toString(36)}-${Math.round(Math.random() * 1e4).toString(36)}`,
    name,
    bounds: b,
    minZ: est.minZ,
    maxZ: est.maxZ,
    sources: [...SOURCES],
    tiles: jobs.length,
    missing,
    bytes,
    savedAt: new Date().toISOString(),
  };
  await savePackMeta(pack);
  abort = null;
  return pack;
}
/** The box round a track, `padM` beyond its marks each way (so the approach shows too). */
export function trackBox(pts: LatLng[], padM = 300): BBox | null {
  if (!pts.length) return null;
  let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity;
  for (const p of pts) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
  }
  const sw = destPoint(destPoint({ lat: south, lng: west }, 180, padM), 270, padM);
  const ne = destPoint(destPoint({ lat: north, lng: east }, 0, padM), 90, padM);
  return { south: sw.lat, west: sw.lng, north: ne.lat, east: ne.lng };
}

/** The finest photo detail that fits for a track's box (full detail first), or null if too big. */
export function trackPackZoom(b: BBox): PackZoom | null {
  for (const z of [20, 19, 18, 17] as const) if (!estimatePack(b, z).tooWide) return z;
  return null;
}
