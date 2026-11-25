/**
 * The online track library: skippers share a track (labelled by location and a short comment),
 * others search, preview and save it to their phone for offline use.
 *
 * Backed by a Supabase project (Postgres + its REST API; free tier). Set
 * VITE_TRACK_LIBRARY_URL (https://<project>.supabase.co) and VITE_TRACK_LIBRARY_KEY (the
 * project's public "anon" key, safe to ship in the app). Table, security rules and functions:
 * docs/track-library.md. Without them the Library says it isn't set up and nothing is sent.
 *
 * No sign-in: each shared track gets a random secret kept on the sharing phone, which is the
 * only way to remove it. Three reports from other users hide a track until it is reviewed.
 */

export type LatLngPt = { lat: number; lng: number };

export type LibraryTrack = {
  id: string;
  title: string;
  location: string;
  comment: string;
  lat: number;
  lng: number;
  lengthM: number;
  points: number;
  createdAt: string;
};

export const LIMITS = { title: 60, location: 80, comment: 280, points: 2000 } as const;

type Env = Record<string, string | undefined>;
const env = (): Env => ((import.meta as unknown as { env?: Env }).env ?? {});

export function libraryConfig(e: Env = env()): { url: string; key: string } | null {
  const url = (e.VITE_TRACK_LIBRARY_URL ?? "").trim().replace(/\/+$/, "");
  const key = (e.VITE_TRACK_LIBRARY_KEY ?? "").trim();
  if (!/^https:\/\//.test(url) || !key) return null;
  return { url, key };
}

const SUMMARY = "id,title,location,comment,lat,lng,length_m,point_count,created_at";

/** PostgREST "ilike" pattern, with the characters that would break the filter removed. */
export function likePattern(q: string): string {
  const clean = q.replace(/[%*,()"\\:]/g, " ").replace(/\s+/g, " ").trim();
  return clean ? `*${clean}*` : "";
}

/** Query string for a search: text over title, location and comment, or tracks in a box. */
export function searchQuery(q: string, box?: { s: number; w: number; n: number; e: number } | null, limit = 30): string {
  const p = new URLSearchParams();
  p.set("select", SUMMARY);
  const like = likePattern(q);
  if (like) p.set("or", `(location.ilike.${like},title.ilike.${like},comment.ilike.${like})`);
  else if (box) {
    p.append("lat", `gte.${box.s.toFixed(4)}`);
    p.append("lat", `lte.${box.n.toFixed(4)}`);
    p.append("lng", `gte.${box.w.toFixed(4)}`);
    p.append("lng", `lte.${box.e.toFixed(4)}`);
  }
  p.set("order", "created_at.desc");
  p.set("limit", String(limit));
  return p.toString();
}

export function rowToTrack(r: Record<string, unknown>): LibraryTrack | null {
  const lat = Number(r.lat);
  const lng = Number(r.lng);
  if (typeof r.id !== "string" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: r.id,
    title: String(r.title ?? "Track").slice(0, LIMITS.title),
    location: String(r.location ?? "").slice(0, LIMITS.location),
    comment: String(r.comment ?? "").slice(0, LIMITS.comment),
    lat,
    lng,
    lengthM: Number(r.length_m) || 0,
    points: Number(r.point_count) || 0,
    createdAt: String(r.created_at ?? ""),
  };
}

/** Points as compact [lat, lng] pairs at about 10 cm, checked. */
export function packPoints(pts: LatLngPt[]): Array<[number, number]> {
  return pts
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180)
    .slice(0, LIMITS.points)
    .map((p) => [Math.round(p.lat * 1e6) / 1e6, Math.round(p.lng * 1e6) / 1e6]);
}

export function unpackPoints(v: unknown): LatLngPt[] {
  if (!Array.isArray(v)) return [];
  const out: LatLngPt[] = [];
  for (const q of v.slice(0, LIMITS.points)) {
    if (!Array.isArray(q)) continue;
    const lat = Number(q[0]);
    const lng = Number(q[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) out.push({ lat, lng });
  }
  return out;
}

export function randomSecret(): string {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const cfg = libraryConfig();
  if (!cfg) throw new Error("The track library isn't set up in this build.");
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Library error ${res.status}`);
  return res;
}

export async function searchLibrary(q: string, box?: { s: number; w: number; n: number; e: number } | null): Promise<LibraryTrack[]> {
  const res = await call(`tracks?${searchQuery(q, box)}`);
  const rows = (await res.json()) as unknown;
  return Array.isArray(rows) ? rows.map((r) => rowToTrack(r as Record<string, unknown>)).filter((t): t is LibraryTrack => t != null) : [];
}

export async function loadLibraryPoints(id: string): Promise<LatLngPt[]> {
  const res = await call(`tracks?select=pts&id=eq.${encodeURIComponent(id)}&limit=1`);
  const rows = (await res.json()) as Array<{ pts?: unknown }>;
  return unpackPoints(rows[0]?.pts);
}

/** Share a track. Returns its library id and the secret this phone keeps to remove it later. */
export async function shareToLibrary(input: {
  title: string;
  location: string;
  comment: string;
  points: LatLngPt[];
  lengthM: number;
}): Promise<{ id: string; secret: string }> {
  const pts = packPoints(input.points);
  if (pts.length < 2) throw new Error("A track needs at least two points.");
  const secret = randomSecret();
  const res = await call("rpc/share_track", {
    method: "POST",
    body: JSON.stringify({
      p_title: input.title.trim().slice(0, LIMITS.title) || "Track",
      p_location: input.location.trim().slice(0, LIMITS.location),
      p_comment: input.comment.trim().slice(0, LIMITS.comment),
      p_pts: pts,
      p_length_m: Math.round(input.lengthM),
      p_secret: secret,
    }),
  });
  const id = (await res.json()) as unknown;
  if (typeof id !== "string") throw new Error("The library didn't return an id.");
  return { id, secret };
}

export async function removeFromLibrary(id: string, secret: string): Promise<void> {
  await call("rpc/remove_track", { method: "POST", body: JSON.stringify({ p_id: id, p_secret: secret }) });
}

export async function reportLibraryTrack(id: string): Promise<void> {
  await call("rpc/report_track", { method: "POST", body: JSON.stringify({ p_id: id }) });
}
