/**
 * Shared anchorages: where other skippers anchored, with depth, bottom, holding, which winds
 * it is sheltered from and a comment. Same Supabase project as the track library
 * (docs/track-library.md has the table and functions). No sign-in; each share keeps a secret on
 * the sharing phone to remove it; three reports hide one.
 */
import { libraryConfig, libraryRequest, randomSecret } from "./track-library.ts";

export const BOTTOMS = ["sand", "mud", "weed", "coral rubble", "rock", "unknown"] as const;
export type Bottom = (typeof BOTTOMS)[number];
export const HOLDINGS = ["good", "fair", "poor"] as const;
export type Holding = (typeof HOLDINGS)[number];
/** Eight compass points, clockwise from north. */
export const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export type SharedAnchorage = {
  id: string;
  lat: number;
  lng: number;
  depthM: number | null;
  bottom: Bottom;
  holding: Holding;
  /** Bit i set = sheltered from wind from POINTS[i]. */
  shelter: number;
  comment: string;
  createdAt: string;
};

export const ANCHORAGE_LIMITS = { comment: 280, perView: 200 } as const;

export const anchoragesOn = () => Boolean(libraryConfig());

export function shelterText(bits: number): string {
  const pts = POINTS.filter((_, i) => bits & (1 << i));
  if (!pts.length) return "Shelter not noted";
  if (pts.length === 8) return "Sheltered all round";
  return `Sheltered from ${pts.join(", ")}`;
}

/** Whether wind from `dirDeg` is one this anchorage is sheltered from. */
export function shelteredFrom(bits: number, dirDeg: number): boolean {
  const i = Math.round((((dirDeg % 360) + 360) % 360) / 45) % 8;
  return Boolean(bits & (1 << i));
}

export function viewQuery(b: { s: number; w: number; n: number; e: number }): string {
  const p = new URLSearchParams();
  p.set("select", "id,lat,lng,depth_m,bottom,holding,shelter,comment,created_at");
  p.append("lat", `gte.${b.s.toFixed(4)}`);
  p.append("lat", `lte.${b.n.toFixed(4)}`);
  p.append("lng", `gte.${b.w.toFixed(4)}`);
  p.append("lng", `lte.${b.e.toFixed(4)}`);
  p.set("order", "created_at.desc");
  p.set("limit", String(ANCHORAGE_LIMITS.perView));
  return p.toString();
}

export function rowToAnchorage(r: Record<string, unknown>): SharedAnchorage | null {
  const lat = Number(r.lat);
  const lng = Number(r.lng);
  if (typeof r.id !== "string" || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const d = Number(r.depth_m);
  return {
    id: r.id,
    lat,
    lng,
    depthM: r.depth_m != null && Number.isFinite(d) && d > 0 && d < 200 ? d : null,
    bottom: (BOTTOMS as readonly string[]).includes(String(r.bottom)) ? (r.bottom as Bottom) : "unknown",
    holding: (HOLDINGS as readonly string[]).includes(String(r.holding)) ? (r.holding as Holding) : "fair",
    shelter: Number.isInteger(Number(r.shelter)) ? Number(r.shelter) & 255 : 0,
    comment: String(r.comment ?? "").slice(0, ANCHORAGE_LIMITS.comment),
    createdAt: String(r.created_at ?? ""),
  };
}

export async function anchoragesInView(b: { s: number; w: number; n: number; e: number }): Promise<SharedAnchorage[]> {
  const res = await libraryRequest(`anchorages?${viewQuery(b)}`);
  const rows = (await res.json()) as unknown;
  return Array.isArray(rows) ? rows.map((r) => rowToAnchorage(r as Record<string, unknown>)).filter((a): a is SharedAnchorage => a != null) : [];
}

export async function shareAnchorage(a: Omit<SharedAnchorage, "id" | "createdAt">): Promise<{ id: string; secret: string }> {
  const secret = randomSecret();
  const res = await libraryRequest("rpc/share_anchorage", {
    method: "POST",
    body: JSON.stringify({
      p_lat: Math.round(a.lat * 1e6) / 1e6,
      p_lng: Math.round(a.lng * 1e6) / 1e6,
      p_depth_m: a.depthM != null ? Math.round(a.depthM * 10) / 10 : null,
      p_bottom: a.bottom,
      p_holding: a.holding,
      p_shelter: a.shelter & 255,
      p_comment: a.comment.trim().slice(0, ANCHORAGE_LIMITS.comment),
      p_secret: secret,
    }),
  });
  const id = (await res.json()) as unknown;
  if (typeof id !== "string") throw new Error("The library didn't return an id.");
  return { id, secret };
}

export async function removeAnchorage(id: string, secret: string): Promise<void> {
  await libraryRequest("rpc/remove_anchorage", { method: "POST", body: JSON.stringify({ p_id: id, p_secret: secret }) });
}

export async function reportAnchorage(id: string): Promise<void> {
  await libraryRequest("rpc/report_anchorage", { method: "POST", body: JSON.stringify({ p_id: id }) });
}
