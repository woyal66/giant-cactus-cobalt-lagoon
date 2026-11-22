/**
 * When and how sharp is the satellite photo under the chart centre?
 *
 * Esri (Maxar) publishes capture date and resolution per area through its World Imagery
 * metadata service. The request and field names below follow Esri's published service;
 * they could not be tested from the development sandbox, so everything is read defensively
 * and the app simply shows "date not published" if the reply isn't understood.
 */
export const ESRI_METADATA_IDENTIFY =
  "https://metadata.maptiles.arcgis.com/arcgis/rest/services/World_Imagery_Metadata/MapServer/identify";

export type PhotoInfo = {
  /** Capture date (UTC ms), if known. */
  date: number | null;
  /** Ground resolution in metres per pixel, if known. */
  resM: number | null;
  /** Sensor or provider, e.g. "WorldView-3" or "Maxar". */
  source: string | null;
};

export function esriIdentifyUrl(lat: number, lng: number, z: number): string {
  const d = 0.001;
  const u = new URL(ESRI_METADATA_IDENTIFY);
  u.searchParams.set("geometry", `${lng},${lat}`);
  u.searchParams.set("geometryType", "esriGeometryPoint");
  u.searchParams.set("sr", "4326");
  u.searchParams.set("layers", "all");
  u.searchParams.set("tolerance", "0");
  u.searchParams.set("mapExtent", `${lng - d},${lat - d},${lng + d},${lat + d}`);
  u.searchParams.set("imageDisplay", "256,256,96");
  u.searchParams.set("returnGeometry", "false");
  u.searchParams.set("f", "json");
  u.searchParams.set("zoom", String(Math.round(z)));
  return u.toString();
}

function pick(a: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    for (const key of Object.keys(a)) if (key.toLowerCase() === k.toLowerCase()) return a[key];
  }
  return undefined;
}

/** "20230514", 20230514, "2023/05/14", "5/14/2023" or epoch ms → UTC ms. */
export function parseDate(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v > 19000000 && v < 21000000) return Date.UTC(Math.floor(v / 10000), Math.floor(v / 100) % 100 - 1, v % 100);
    if (v > 1e11) return v;
    return null;
  }
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim();
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!);
  m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(s);
  if (m) return Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return Date.UTC(+m[3]!, +m[1]! - 1, +m[2]!);
  return null;
}

/** Reads an identify reply; prefers the record whose zoom range covers `z`. */
export function parseEsriMetadata(json: unknown, z: number): PhotoInfo | null {
  const results = (json as { results?: { attributes?: Record<string, unknown> }[] } | null)?.results;
  if (!Array.isArray(results) || !results.length) return null;
  const rows = results.map((r) => r.attributes ?? {}).filter((a) => Object.keys(a).length);
  if (!rows.length) return null;
  const inRange = rows.find((a) => {
    const lo = Number(pick(a, "MinMapLevel", "MIN_LEVEL"));
    const hi = Number(pick(a, "MaxMapLevel", "MAX_LEVEL"));
    return Number.isFinite(lo) && Number.isFinite(hi) && z >= lo && z <= hi;
  });
  const a = inRange ?? rows[0]!;
  const date = parseDate(pick(a, "SRC_DATE2", "SRC_DATE", "AcquisitionDate", "DATE"));
  const res = Number(pick(a, "SRC_RES", "Resolution", "RES"));
  const src = pick(a, "NICE_DESC", "SRC_DESC", "NICE_NAME", "Source");
  const info: PhotoInfo = {
    date,
    resM: Number.isFinite(res) && res > 0 && res < 100 ? res : null,
    source: typeof src === "string" && src.trim() ? src.trim() : null,
  };
  return info.date == null && info.resM == null && info.source == null ? null : info;
}

const cache = new Map<string, Promise<PhotoInfo | null>>();

export function fetchEsriPhotoInfo(lat: number, lng: number, z: number): Promise<PhotoInfo | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)},${Math.round(z)}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(esriIdentifyUrl(lat, lng, z))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j ? parseEsriMetadata(j, z) : null))
      .catch(() => null);
    cache.set(key, p);
  }
  return p;
}

/** What we can say about each source without asking a server. */
export const SOURCE_NOTE: Record<string, string> = {
  sentinel: "Sentinel-2 cloudless mosaic, about 10 m per pixel",
  google: "Google doesn't publish photo dates to other apps",
  bing: "Bing doesn't publish photo dates to other apps",
  maptiler: "MapTiler mixes providers; dates not published per area",
};

export function describePhoto(info: PhotoInfo | null): string {
  if (!info) return "date not published";
  const parts = [
    info.source,
    info.date != null ? new Date(info.date).toLocaleDateString([], { month: "short", year: "numeric", timeZone: "UTC" }) : null,
    info.resM != null ? `${info.resM < 1 ? info.resM.toFixed(1) : Math.round(info.resM)} m per pixel` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "date not published";
}
