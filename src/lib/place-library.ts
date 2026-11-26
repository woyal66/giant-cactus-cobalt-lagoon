/**
 * Places other skippers share, and open government data bundled with the app: public moorings,
 * boat ramps, marinas, fuel, water, pump-out, dinghy landings and marine rescue bases.
 * Same Supabase project as the track library (docs/track-library.md has the `places` table);
 * no sign-in, a secret on the sharing phone removes one, three reports hide it.
 * Open data (`public/places/places.json`) is built by `scripts/build-places.mjs`.
 */
import { libraryConfig, libraryRequest, randomSecret } from "./track-library.ts";

export const PLACE_KINDS = ["mooring", "ramp", "marina", "fuel", "water", "pumpout", "landing", "rescue"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export const PLACE_LABEL: Record<PlaceKind, string> = {
  mooring: "Public mooring",
  ramp: "Boat ramp",
  marina: "Marina",
  fuel: "Fuel",
  water: "Water",
  pumpout: "Pump-out",
  landing: "Dinghy landing",
  rescue: "Marine rescue",
};

/** Short labels for the filter chips. */
export const PLACE_CHIP: Record<PlaceKind, string> = {
  mooring: "Moorings",
  ramp: "Ramps",
  marina: "Marinas",
  fuel: "Fuel",
  water: "Water",
  pumpout: "Pump-out",
  landing: "Landings",
  rescue: "Rescue",
};

export type SharedPlace = {
  id: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
  name: string;
  comment: string;
  /** VHF channel(s), e.g. "16, 73"; phone number. */
  vhf: string;
  phone: string;
  createdAt: string;
  /** "open" = bundled government data, "shared" = a skipper's. */
  source: "shared" | "open";
  /** Licence credit for open data. */
  credit?: string;
};

export const PLACE_LIMITS = { name: 60, comment: 280, vhf: 20, phone: 24, perView: 300 } as const;

export const placesOn = () => Boolean(libraryConfig());

const clean = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export function rowToPlace(r: Record<string, unknown>, source: SharedPlace["source"] = "shared"): SharedPlace | null {
  const lat = Number(r.lat);
  const lng = Number(r.lng);
  if (typeof r.id !== "string" || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (!(PLACE_KINDS as readonly string[]).includes(String(r.kind))) return null;
  return {
    id: r.id,
    kind: r.kind as PlaceKind,
    lat,
    lng,
    name: clean(r.name, PLACE_LIMITS.name),
    comment: clean(r.comment, PLACE_LIMITS.comment),
    vhf: clean(r.vhf, PLACE_LIMITS.vhf).replace(/[^\d ,/A-Za-z]/g, ""),
    phone: clean(r.phone, PLACE_LIMITS.phone).replace(/[^\d +()-]/g, ""),
    createdAt: String(r.created_at ?? ""),
    source,
    credit: typeof r.credit === "string" ? r.credit.slice(0, 120) : undefined,
  };
}

export function placeViewQuery(b: { s: number; w: number; n: number; e: number }): string {
  const p = new URLSearchParams();
  p.set("select", "id,kind,lat,lng,name,comment,vhf,phone,created_at");
  p.append("lat", `gte.${b.s.toFixed(4)}`);
  p.append("lat", `lte.${b.n.toFixed(4)}`);
  p.append("lng", `gte.${b.w.toFixed(4)}`);
  p.append("lng", `lte.${b.e.toFixed(4)}`);
  p.set("order", "created_at.desc");
  p.set("limit", String(PLACE_LIMITS.perView));
  return p.toString();
}

export async function placesInView(b: { s: number; w: number; n: number; e: number }): Promise<SharedPlace[]> {
  const res = await libraryRequest(`places?${placeViewQuery(b)}`);
  const rows = (await res.json()) as unknown;
  return Array.isArray(rows) ? rows.map((r) => rowToPlace(r as Record<string, unknown>)).filter((a): a is SharedPlace => a != null) : [];
}

export async function sharePlace(p: Pick<SharedPlace, "kind" | "lat" | "lng" | "name" | "comment" | "vhf" | "phone">): Promise<{ id: string; secret: string }> {
  const secret = randomSecret();
  const res = await libraryRequest("rpc/share_place", {
    method: "POST",
    body: JSON.stringify({
      p_kind: p.kind,
      p_lat: Math.round(p.lat * 1e6) / 1e6,
      p_lng: Math.round(p.lng * 1e6) / 1e6,
      p_name: clean(p.name, PLACE_LIMITS.name),
      p_comment: clean(p.comment, PLACE_LIMITS.comment),
      p_vhf: clean(p.vhf, PLACE_LIMITS.vhf),
      p_phone: clean(p.phone, PLACE_LIMITS.phone),
      p_secret: secret,
    }),
  });
  const id = (await res.json()) as unknown;
  if (typeof id !== "string") throw new Error("The library didn't return an id.");
  return { id, secret };
}

export async function removePlace(id: string, secret: string): Promise<void> {
  await libraryRequest("rpc/remove_place", { method: "POST", body: JSON.stringify({ p_id: id, p_secret: secret }) });
}

export async function reportPlace(id: string): Promise<void> {
  await libraryRequest("rpc/report_place", { method: "POST", body: JSON.stringify({ p_id: id }) });
}

/** Bundled open data: compact rows [kind index, lat×1e5, lng×1e5, name, credit index, vhf?, phone?]. */
export type OpenPlaces = { v: 1; credits: string[]; rows: Array<[number, number, number, string, number, string?, string?]> };

export function decodeOpenPlaces(j: unknown): SharedPlace[] {
  const o = j as OpenPlaces;
  if (!o || o.v !== 1 || !Array.isArray(o.rows)) return [];
  const out: SharedPlace[] = [];
  o.rows.forEach((r, i) => {
    const kind = PLACE_KINDS[r[0]];
    const p = kind ? rowToPlace({ id: `open-${i}`, kind, lat: r[1] / 1e5, lng: r[2] / 1e5, name: r[3], vhf: r[5], phone: r[6], credit: o.credits?.[r[4]] }, "open") : null;
    if (p) out.push(p);
  });
  return out;
}

/** The nearest place of a kind (e.g. the closest marine rescue base). */
export function nearestPlace(list: SharedPlace[], kind: PlaceKind, at: { lat: number; lng: number }): SharedPlace | null {
  let best: SharedPlace | null = null;
  let bd = Infinity;
  const k = Math.cos((at.lat * Math.PI) / 180);
  for (const p of list) {
    if (p.kind !== kind) continue;
    const d = (p.lat - at.lat) ** 2 + ((p.lng - at.lng) * k) ** 2;
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}
