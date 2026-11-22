/**
 * Reef hazards bundled with the app (public/reefs/gbr-hazards.json, built by
 * scripts/build-reefs.mjs from GBRMPA "Great Barrier Reef Features", CC BY 4.0):
 * reefs, drying reef, rocks, cays and islands. Works offline.
 *
 * Outlines are GBRMPA's mapping, good to tens of metres; not every bommie or rock is in it.
 * Not for navigation.
 */
export type HazardKind = "reef" | "dry" | "rock" | "cay" | "island";

export type Hazard = {
  kind: HazardKind;
  name?: string;
  /** Centre [lng, lat]. */
  c: [number, number];
  /** Bounding box [west, south, east, north]. */
  b: [number, number, number, number];
  /** Outer rings as flat [lng, lat, lng, lat, ...] in degrees. */
  rings: Float64Array[];
};

export type HazardIndex = { items: Hazard[]; cells: Map<string, number[]>; source: string };

export const HAZARD_ASSET = "reefs/gbr-hazards.json";
export const ATTR_HAZARDS = "Reefs, rocks and cays © Great Barrier Reef Marine Park Authority (CC BY 4.0)";
const SCALE = 1e5;
const CELL = 0.1; // degrees, for the lookup grid

export const HAZARD_LABEL: Record<HazardKind, string> = {
  reef: "Reef",
  dry: "Reef that dries at low tide",
  rock: "Rock",
  cay: "Cay or sand bank",
  island: "Island",
};

const KINDS = new Set<HazardKind>(["reef", "dry", "rock", "cay", "island"]);

/** Decode the bundled file (delta-encoded 1e-5° rings) into a searchable index. */
export function decodeHazards(json: unknown): HazardIndex | null {
  const f = json as { v?: number; source?: string; items?: unknown[] } | null;
  if (!f || f.v !== 1 || !Array.isArray(f.items)) return null;
  const items: Hazard[] = [];
  for (const raw of f.items) {
    const it = raw as { k?: string; n?: string; c?: number[]; b?: number[]; r?: number[][] };
    if (!it || !KINDS.has(it.k as HazardKind) || !Array.isArray(it.r) || !it.b || !it.c) continue;
    const rings: Float64Array[] = [];
    for (const d of it.r) {
      if (!Array.isArray(d) || d.length < 6 || d.length % 2) continue;
      const out = new Float64Array(d.length);
      let x = 0;
      let y = 0;
      for (let i = 0; i < d.length; i += 2) {
        x += d[i]!;
        y += d[i + 1]!;
        out[i] = x / SCALE;
        out[i + 1] = y / SCALE;
      }
      rings.push(out);
    }
    if (!rings.length) continue;
    items.push({
      kind: it.k as HazardKind,
      ...(it.n ? { name: it.n } : {}),
      c: [it.c[0]! / SCALE, it.c[1]! / SCALE],
      b: [it.b[0]! / SCALE, it.b[1]! / SCALE, it.b[2]! / SCALE, it.b[3]! / SCALE],
      rings,
    });
  }
  return indexHazards(items, f.source ?? "GBRMPA");
}

export function indexHazards(items: Hazard[], source = ""): HazardIndex {
  const cells = new Map<string, number[]>();
  items.forEach((h, i) => {
    for (let cx = Math.floor(h.b[0] / CELL); cx <= Math.floor(h.b[2] / CELL); cx++) {
      for (let cy = Math.floor(h.b[1] / CELL); cy <= Math.floor(h.b[3] / CELL); cy++) {
        const k = `${cx},${cy}`;
        const list = cells.get(k);
        if (list) list.push(i);
        else cells.set(k, [i]);
      }
    }
  });
  return { items, cells, source };
}

/** Hazards whose box overlaps [west, south, east, north]. */
export function hazardsInBox(idx: HazardIndex, w: number, s: number, e: number, n: number): Hazard[] {
  const seen = new Set<number>();
  const out: Hazard[] = [];
  for (let cx = Math.floor(w / CELL); cx <= Math.floor(e / CELL); cx++) {
    for (let cy = Math.floor(s / CELL); cy <= Math.floor(n / CELL); cy++) {
      for (const i of idx.cells.get(`${cx},${cy}`) ?? []) {
        if (seen.has(i)) continue;
        seen.add(i);
        const h = idx.items[i]!;
        if (h.b[0] <= e && h.b[2] >= w && h.b[1] <= n && h.b[3] >= s) out.push(h);
      }
    }
  }
  return out;
}

function inRing(r: Float64Array, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i]!;
    const yi = r[i + 1]!;
    const xj = r[j]!;
    const yj = r[j + 1]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Metres from a point to a hazard outline (0 when inside it). */
export function distanceToHazard(h: Hazard, lat: number, lng: number): number {
  const kx = 111_320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110_540;
  let best = Infinity;
  for (const r of h.rings) {
    if (inRing(r, lng, lat)) return 0;
    for (let i = 0; i + 3 < r.length; i += 2) {
      const ax = (r[i]! - lng) * kx;
      const ay = (r[i + 1]! - lat) * ky;
      const bx = (r[i + 2]! - lng) * kx;
      const by = (r[i + 3]! - lat) * ky;
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best;
}

/** Hazards within `radiusM` of a point, nearest first. Islands are left out unless asked. */
export function hazardsNear(
  idx: HazardIndex,
  lat: number,
  lng: number,
  radiusM: number,
  withIslands = false,
): Array<{ hazard: Hazard; distM: number }> {
  const dLat = radiusM / 110_540;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return hazardsInBox(idx, lng - dLng, lat - dLat, lng + dLng, lat + dLat)
    .filter((h) => withIslands || h.kind !== "island")
    .map((hazard) => ({ hazard, distM: distanceToHazard(hazard, lat, lng) }))
    .filter((x) => x.distM <= radiusM)
    .sort((a, b) => a.distM - b.distM);
}

/**
 * Hazards a route passes over or close by (default 50 m), in route order, one entry per hazard.
 * Samples every ~25 m.
 */
export function hazardsAlong(
  idx: HazardIndex,
  pts: Array<{ lat: number; lng: number }>,
  clearM = 50,
): Array<{ hazard: Hazard; distM: number; lat: number; lng: number }> {
  const out: Array<{ hazard: Hazard; distM: number; lat: number; lng: number }> = [];
  const seen = new Map<Hazard, number>();
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const dy = (b.lat - a.lat) * 110_540;
    const dx = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 25));
    for (let k = 0; k <= n; k++) {
      const lat = a.lat + ((b.lat - a.lat) * k) / n;
      const lng = a.lng + ((b.lng - a.lng) * k) / n;
      for (const { hazard, distM } of hazardsNear(idx, lat, lng, clearM)) {
        const at = seen.get(hazard);
        if (at === undefined) {
          seen.set(hazard, out.length);
          out.push({ hazard, distM, lat, lng });
        } else if (distM < out[at]!.distM) {
          out[at] = { hazard, distM, lat, lng };
        }
      }
    }
  }
  return out;
}

/** "Monkman Reef (reef)" / "Rock" / "Reef that dries at low tide". */
export function hazardName(h: Hazard): string {
  return h.name ? `${h.name} (${HAZARD_LABEL[h.kind].toLowerCase()})` : HAZARD_LABEL[h.kind];
}

let loading: Promise<HazardIndex | null> | null = null;

/** The bundled hazards (cached); null when this build has none. */
export function loadHazards(): Promise<HazardIndex | null> {
  loading ??= fetch(new URL(HAZARD_ASSET, document.baseURI).href)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j ? decodeHazards(j) : null))
    .catch(() => null);
  return loading;
}
