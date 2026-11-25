/**
 * Search for places on the phone, offline: named GBRMPA reefs, islands and cays (passed in by
 * the caller from the bundled hazards), the BOM tide ports (harbours and
 * anchorages around Australia), and your saved tracks. Optional online place search through
 * OpenStreetMap Nominatim can be added by the caller.
 */
import { BOM_PORTS } from "./bom-ports.ts";

export type Place = { name: string; detail: string; lat: number; lng: number; zoom: number; kind: "reef" | "port" | "track" };

export function searchPlaces(query: string, extra: Place[] = [], limit = 8): Place[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const all: Place[] = [
    ...BOM_PORTS.map((p) => ({ name: p.name, detail: "Tide port", lat: p.lat, lng: p.lng, zoom: 14, kind: "port" as const })),
    ...extra,
  ];
  const score = (p: Place) => {
    const n = p.name.toLowerCase();
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    if (n.split(/[\s-]+/).some((w) => w.startsWith(q))) return 2;
    if (n.includes(q)) return 3;
    return 9;
  };
  return all
    .map((p) => ({ p, s: score(p) }))
    .filter((x) => x.s < 9)
    .sort((a, b) => a.s - b.s || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map((x) => x.p);
}

/**
 * A short place label for a spot, offline: the nearest named GBRMPA reef, island or cay, or
 * BOM tide port, within `maxM`. Used to label a shared track ("Lady Musgrave Reef").
 */
export function nearestPlaceName(
  lat: number,
  lng: number,
  named: Array<{ name: string; lat: number; lng: number }> = [],
  maxM = 15_000,
): string {
  const mPerDeg = 111_320;
  let best = "";
  let bestD = maxM;
  const all = [...named, ...BOM_PORTS.map((p) => ({ name: p.name, lat: p.lat, lng: p.lng }))];
  for (const p of all) {
    const dx = (p.lng - lng) * mPerDeg * Math.cos((lat * Math.PI) / 180);
    const dy = (p.lat - lat) * mPerDeg;
    const d = Math.hypot(dx, dy);
    if (d < bestD) {
      bestD = d;
      best = p.name;
    }
  }
  return best;
}

/** Zoom that fits a track on a phone screen (about 360 px across). */
export function zoomToFit(pts: Array<{ lat: number; lng: number }>): { lat: number; lng: number; zoom: number } | null {
  if (!pts.length) return null;
  let s = 90, n = -90, w = 180, e = -180;
  for (const p of pts) {
    s = Math.min(s, p.lat); n = Math.max(n, p.lat); w = Math.min(w, p.lng); e = Math.max(e, p.lng);
  }
  const lat = (s + n) / 2;
  const spanM = Math.max((n - s) * 111_320, (e - w) * 111_320 * Math.cos((lat * Math.PI) / 180), 50);
  const zoom = Math.log2((156_543 * Math.cos((lat * Math.PI) / 180) * 300) / spanM);
  return { lat, lng: (w + e) / 2, zoom: Math.max(3, Math.min(18, Math.floor(zoom))) };
}
