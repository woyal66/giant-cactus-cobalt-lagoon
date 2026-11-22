/**
 * Search for places on the phone, offline: the reef atlas, the BOM tide ports (harbours and
 * anchorages around Australia), and your saved tracks. Optional online place search through
 * OpenStreetMap Nominatim can be added by the caller.
 */
import { BOM_PORTS } from "./bom-ports.ts";
import { REEFS } from "./reefs.ts";

export type Place = { name: string; detail: string; lat: number; lng: number; zoom: number; kind: "reef" | "port" | "track" };

export function searchPlaces(query: string, extra: Place[] = [], limit = 8): Place[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const all: Place[] = [
    ...REEFS.map((r) => ({ name: r.name, detail: r.region, lat: r.lat, lng: r.lng, zoom: r.zoom, kind: "reef" as const })),
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
