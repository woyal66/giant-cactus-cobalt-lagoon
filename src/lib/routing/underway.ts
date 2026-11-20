/**
 * Underway: how the boat is doing against the plan, what's coming, and whether a
 * newer forecast changes the plan enough to say so.
 */
import { haversineMeters, type LatLng } from "../geo.ts";
import type { RouteMetrics, RoutePoint } from "./router.ts";

export type Progress = {
  /** Index of the planned point the boat is closest to. */
  index: number;
  /** When the plan expected the boat to be here. */
  plannedAt: number;
  /** Minutes behind the plan (+) or ahead (−). */
  behindMin: number;
  /** Distance from the planned route, metres. */
  offRouteM: number;
};

/** Closest point on the planned route, searching forward from the last known index. */
export function progressOnPlan(points: RoutePoint[], boat: LatLng, now: number, fromIndex = 0): Progress | null {
  if (points.length < 2) return null;
  let best = Math.max(0, Math.min(fromIndex, points.length - 1));
  let bestD = Infinity;
  for (let i = Math.max(0, fromIndex - 2); i < points.length; i += 1) {
    const d = haversineMeters(points[i]!, boat);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  // Interpolate the planned time along the leg the boat is on.
  const a = points[best]!;
  const b = points[best + 1];
  let plannedAt = a.at;
  if (b) {
    const leg = haversineMeters(a, b);
    const along = Math.min(leg, Math.max(0, leg - haversineMeters(boat, b)));
    plannedAt = a.at + (leg > 0 ? (along / leg) * (b.at - a.at) : 0);
  }
  return { index: best, plannedAt, behindMin: (now - plannedAt) / 60_000, offRouteM: bestD };
}

/** Planned points for the next `hours`, shifted by how far behind (or ahead) the boat is. */
export function upcoming(points: RoutePoint[], p: Progress, now: number, hours = 3): RoutePoint[] {
  const shift = p.behindMin * 60_000;
  return points
    .slice(p.index)
    .map((pt) => ({ ...pt, at: pt.at + shift }))
    .filter((pt) => pt.at >= now - 10 * 60_000 && pt.at <= now + hours * 3_600_000);
}

export function describeProgress(p: Progress): string {
  const m = Math.round(p.behindMin);
  if (Math.abs(m) < 10) return "On plan";
  const h = Math.floor(Math.abs(m) / 60);
  const mm = Math.abs(m) % 60;
  const t = h ? `${h} h ${mm} min` : `${mm} min`;
  return m > 0 ? `${t} behind plan` : `${t} ahead of plan`;
}

type PlanLike = { arriveAt: number; metrics: RouteMetrics; points: LatLng[] };

/**
 * Should a re-plan on a newer forecast be shown to the skipper? Only for real
 * changes: ETA, limits, storms, or a different way to go.
 */
export function meaningfulChange(
  current: PlanLike,
  next: PlanLike | { failed: string },
  opts: { etaMin?: number; etaPct?: number; routeShiftM?: number } = {},
): string[] {
  if ("failed" in next) return [`The new forecast has no route inside your limits: ${next.failed}`];
  const reasons: string[] = [];
  const dMin = (next.arriveAt - current.arriveAt) / 60_000;
  const etaMin = opts.etaMin ?? 30;
  const etaPct = opts.etaPct ?? 0.1;
  const tripMin = current.metrics.hours * 60;
  if (Math.abs(dMin) >= Math.max(etaMin, tripMin * etaPct)) {
    reasons.push(`Arrival ${Math.round(Math.abs(dMin))} min ${dMin > 0 ? "later" : "earlier"}`);
  }
  if (next.metrics.maxThunder >= 2 && next.metrics.maxThunder > current.metrics.maxThunder) reasons.push("Storm risk has risen along the way");
  if (next.metrics.maxWindKn >= current.metrics.maxWindKn + 5) reasons.push(`Stronger wind: up to ${Math.round(next.metrics.maxWindKn)} kn`);
  if (next.metrics.maxWaveM >= current.metrics.maxWaveM + 0.5) reasons.push("Bigger seas ahead");
  // Route shape: average distance from the new route's points to the old route.
  const shift = averageGap(next.points, current.points);
  if (shift >= (opts.routeShiftM ?? 3704)) reasons.push(`A different way: about ${(shift / 1852).toFixed(1)} nm from the current route`);
  return reasons;
}

function averageGap(a: LatLng[], b: LatLng[]): number {
  if (!a.length || !b.length) return 0;
  let sum = 0;
  for (const p of a) {
    let m = Infinity;
    for (const q of b) m = Math.min(m, haversineMeters(p, q));
    sum += m;
  }
  return sum / a.length;
}

export type LogEntry = {
  at: number;
  lat: number;
  lng: number;
  sogKn: number;
  cogDeg: number | null;
  windKn: number | null;
  windDir: number | null;
  sails: string;
  note?: string;
};

export function logToCsv(entries: LogEntry[]): string {
  const head = "time,lat,lon,sog_kn,cog_deg,wind_kn,wind_from_deg,sails,note";
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = entries.map((e) =>
    [
      new Date(e.at).toISOString(),
      e.lat.toFixed(5),
      e.lng.toFixed(5),
      e.sogKn.toFixed(1),
      e.cogDeg == null ? "" : Math.round(e.cogDeg),
      e.windKn == null ? "" : Math.round(e.windKn),
      e.windDir == null ? "" : Math.round(e.windDir),
      esc(e.sails),
      esc(e.note ?? ""),
    ].join(","),
  );
  return [head, ...rows].join("\n") + "\n";
}
