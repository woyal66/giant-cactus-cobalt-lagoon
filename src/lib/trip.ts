/**
 * Trip log: timestamped fixes recorded while a trip runs, and the stats worked out from them
 * (times, distance, average and top speed, plan against actual). Pure, so it is tested.
 */
import { haversineMeters, type LatLng } from "./geo.ts";

export type TripFix = {
  at: number;
  lat: number;
  lng: number;
  /** Speed over ground, m/s (NaN if the GPS gave none). */
  sog: number;
  /** GPS accuracy, metres (NaN if unknown). */
  acc: number;
  /** Engine running (from the Engine on switch) at this fix. */
  eng?: boolean;
};

/** The plan a trip followed, kept with it for the comparison. */
export type TripPlan = {
  title: string;
  departAt: number;
  arriveAt: number;
  distM: number;
  /** Planned track with times, thinned to at most ~80 points. */
  points: Array<{ lat: number; lng: number; at: number }>;
};

export type TripStats = {
  startAt: number;
  endAt: number;
  /** First and last moments actually moving (departure and arrival). */
  departAt: number;
  arriveAt: number;
  totalMs: number;
  movingMs: number;
  stoppedMs: number;
  distM: number;
  straightM: number;
  avgMovingKn: number;
  avgKn: number;
  /** Highest speed held for at least 30 s (GPS spikes can't count). */
  topKn: number;
  /** Highest single reading after filtering, shown as "peak". */
  peakKn: number;
  engineMs: number;
  /** Against the plan, when there was one. */
  plan?: {
    departLateMin: number;
    arriveLateMin: number;
    plannedMs: number;
    plannedDistM: number;
    maxOffM: number;
    /** Share of moving time within 100 m of the planned track. */
    onRoutePct: number;
    /** Ahead (−) or behind (+) the plan at each planned point passed, minutes. */
    checkpoints: Array<{ lat: number; lng: number; plannedAt: number; actualAt: number; lateMin: number }>;
  };
};

const KN = 1.943844;
/** Faster than this between two fixes is a GPS jump, not the boat. */
export const MAX_PLAUSIBLE_KN = 45;
/** Below this the boat is stopped (drifting at anchor, waiting for a bridge). */
export const MOVING_KN = 0.8;

/**
 * Keep a fix for the trip log: precise enough, not a jump, and not too soon after the last
 * one unless the boat has moved. Every 5 s at speed, every 30 s when barely moving.
 */
export function keepFix(prev: TripFix | undefined, f: TripFix): boolean {
  if (!Number.isFinite(f.lat) || !Number.isFinite(f.lng) || !Number.isFinite(f.at)) return false;
  if (Number.isFinite(f.acc) && f.acc > 30) return false;
  if (!prev) return true;
  const dt = (f.at - prev.at) / 1000;
  if (dt <= 0) return false;
  const d = haversineMeters(prev, f);
  if ((d / dt) * KN > MAX_PLAUSIBLE_KN) return false;
  if (dt >= 30) return true;
  return dt >= 5 && d >= 10;
}

/** Speed of each fix in knots: the GPS value when given, else from the move since the last fix. */
function speeds(fixes: TripFix[]): number[] {
  return fixes.map((f, i) => {
    if (Number.isFinite(f.sog) && f.sog >= 0) return f.sog * KN;
    const p = fixes[i - 1];
    if (!p) return 0;
    const dt = (f.at - p.at) / 1000;
    return dt > 0 ? (haversineMeters(p, f) / dt) * KN : 0;
  });
}

/** Thin a planned route to at most `max` points with times. */
export function thinPlan(points: Array<{ lat: number; lng: number; at: number }>, max = 80): TripPlan["points"] {
  if (points.length <= max) return points.map((p) => ({ lat: p.lat, lng: p.lng, at: p.at }));
  const out: TripPlan["points"] = [];
  for (let i = 0; i < max; i++) {
    const p = points[Math.round((i / (max - 1)) * (points.length - 1))]!;
    out.push({ lat: p.lat, lng: p.lng, at: p.at });
  }
  return out;
}

function distToPolyline(p: LatLng, line: LatLng[]): number {
  let best = Infinity;
  const mPerLat = 111_320;
  const mPerLng = mPerLat * Math.cos((p.lat * Math.PI) / 180);
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const ax = (a.lng - p.lng) * mPerLng;
    const ay = (a.lat - p.lat) * mPerLat;
    const bx = (b.lng - p.lng) * mPerLng;
    const by = (b.lat - p.lat) * mPerLat;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return line.length === 1 ? haversineMeters(p, line[0]!) : best;
}

/** Drop fixes that would mean an impossible jump from the last good one (GPS glitches). */
export function cleanFixes(fixes: TripFix[]): TripFix[] {
  const out: TripFix[] = [];
  for (const f of fixes) {
    const p = out[out.length - 1];
    if (p) {
      const dt = (f.at - p.at) / 1000;
      if (dt <= 0) continue;
      if ((haversineMeters(p, f) / dt) * KN > MAX_PLAUSIBLE_KN) continue;
    }
    out.push(f);
  }
  return out;
}

export function tripStats(raw: TripFix[], plan?: TripPlan): TripStats | null {
  const fixes = cleanFixes(raw);
  if (fixes.length < 2) return null;
  const kn = speeds(fixes);
  const startAt = fixes[0]!.at;
  const endAt = fixes[fixes.length - 1]!.at;
  let movingMs = 0;
  let distM = 0;
  let engineMs = 0;
  let departAt = NaN;
  let arriveAt = NaN;
  let peakKn = 0;
  for (let i = 1; i < fixes.length; i++) {
    const a = fixes[i - 1]!;
    const b = fixes[i]!;
    const dt = b.at - a.at;
    const d = haversineMeters(a, b);
    const segKn = dt > 0 ? (d / (dt / 1000)) * KN : 0;
    const moving = segKn >= MOVING_KN || kn[i]! >= MOVING_KN;
    if (moving) {
      // A long gap (phone asleep, GPS off) counts only up to 2 min of moving time.
      movingMs += Math.min(dt, 120_000);
      distM += d;
      if (!Number.isFinite(departAt)) departAt = a.at;
      arriveAt = b.at;
      if (a.eng) engineMs += dt;
    }
    peakKn = Math.max(peakKn, Math.min(kn[i]!, MAX_PLAUSIBLE_KN));
  }
  // Top speed held for 30 s: best distance over any window of at least 30 s.
  let topKn = 0;
  let j = 0;
  for (let i = 1; i < fixes.length; i++) {
    while (j < i && fixes[i]!.at - fixes[j + 1]!.at >= 30_000) j++;
    const span = fixes[i]!.at - fixes[j]!.at;
    if (span < 30_000) continue;
    let d = 0;
    for (let k = j + 1; k <= i; k++) d += haversineMeters(fixes[k - 1]!, fixes[k]!);
    topKn = Math.max(topKn, (d / (span / 1000)) * KN);
  }
  if (!Number.isFinite(departAt)) {
    departAt = startAt;
    arriveAt = startAt;
  }
  const totalMs = endAt - startAt;
  const tripMs = Math.max(1, arriveAt - departAt);
  const stats: TripStats = {
    startAt,
    endAt,
    departAt,
    arriveAt,
    totalMs,
    movingMs: Math.min(movingMs, tripMs),
    stoppedMs: Math.max(0, tripMs - Math.min(movingMs, tripMs)),
    distM,
    straightM: haversineMeters(fixes[0]!, fixes[fixes.length - 1]!),
    avgMovingKn: movingMs > 0 ? (distM / (movingMs / 1000)) * KN : 0,
    avgKn: (distM / (tripMs / 1000)) * KN,
    topKn: Math.min(topKn, peakKn || topKn),
    peakKn,
    engineMs,
  };
  if (plan && plan.points.length >= 2) {
    const line = plan.points;
    let maxOffM = 0;
    let onMs = 0;
    for (let i = 1; i < fixes.length; i++) {
      const off = distToPolyline(fixes[i]!, line);
      if (fixes[i]!.at >= departAt && fixes[i]!.at <= arriveAt) maxOffM = Math.max(maxOffM, off);
      if (off <= 100 && kn[i]! >= MOVING_KN) onMs += fixes[i]!.at - fixes[i - 1]!.at;
    }
    // Checkpoints: up to 8 planned points, each matched to the closest pass within 2 km.
    const checkpoints: NonNullable<TripStats["plan"]>["checkpoints"] = [];
    const step = Math.max(1, Math.floor((line.length - 1) / 8));
    let from = 0;
    for (let p = step; p < line.length; p += step) {
      const pt = line[Math.min(p, line.length - 1)]!;
      let best = -1;
      let bestD = 2000;
      for (let i = from; i < fixes.length; i++) {
        const d = haversineMeters(fixes[i]!, pt);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best < 0) continue;
      from = best;
      checkpoints.push({ lat: pt.lat, lng: pt.lng, plannedAt: pt.at, actualAt: fixes[best]!.at, lateMin: Math.round((fixes[best]!.at - pt.at) / 60_000) });
    }
    stats.plan = {
      departLateMin: Math.round((departAt - plan.departAt) / 60_000),
      arriveLateMin: Math.round((arriveAt - plan.arriveAt) / 60_000),
      plannedMs: plan.arriveAt - plan.departAt,
      plannedDistM: plan.distM,
      maxOffM,
      onRoutePct: stats.movingMs > 0 ? Math.min(100, Math.round((onMs / stats.movingMs) * 100)) : 0,
      checkpoints,
    };
  }
  return stats;
}

/** Speed over time for the graph: at most `max` points, each the average over its slice. */
export function speedSeries(raw: TripFix[], max = 240): Array<{ at: number; kn: number; lat: number; lng: number }> {
  const fixes = cleanFixes(raw);
  if (fixes.length < 2) return [];
  const kn = speeds(fixes);
  const n = Math.min(max, fixes.length);
  const out: Array<{ at: number; kn: number; lat: number; lng: number }> = [];
  for (let s = 0; s < n; s++) {
    const i0 = Math.floor((s / n) * fixes.length);
    const i1 = Math.max(i0 + 1, Math.floor(((s + 1) / n) * fixes.length));
    let sum = 0;
    for (let i = i0; i < i1; i++) sum += Math.min(kn[i]!, MAX_PLAUSIBLE_KN);
    const mid = fixes[Math.floor((i0 + i1 - 1) / 2)]!;
    out.push({ at: mid.at, kn: sum / (i1 - i0), lat: mid.lat, lng: mid.lng });
  }
  return out;
}

/** Colour for a speed relative to the trip's top speed: blue (slow) to green, yellow, red (fast). */
export function speedColor(kn: number, topKn: number): string {
  const t = Math.max(0, Math.min(1, topKn > 0 ? kn / topKn : 0));
  const stops: Array<[number, [number, number, number]]> = [
    [0, [59, 130, 246]],
    [0.4, [34, 197, 94]],
    [0.7, [250, 204, 21]],
    [1, [239, 68, 68]],
  ];
  for (let i = 1; i < stops.length; i++) {
    const [b, cb] = stops[i]!;
    const [a, ca] = stops[i - 1]!;
    if (t <= b) {
      const u = (t - a) / (b - a);
      return `rgb(${cb.map((v, k) => Math.round(ca[k]! + (v - ca[k]!) * u)).join(",")})`;
    }
  }
  return "rgb(239,68,68)";
}

function esc(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}

/** GPX track with a time on every point, which other apps and fitness sites can read. */
export function tripGpx(name: string, fixes: TripFix[]): string {
  const pts = fixes
    .map((f) => `      <trkpt lat="${f.lat.toFixed(6)}" lon="${f.lng.toFixed(6)}"><time>${new Date(f.at).toISOString()}</time>${Number.isFinite(f.sog) ? `<extensions><speed>${f.sog.toFixed(2)}</speed></extensions>` : ""}</trkpt>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Anchor Mate" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(name)}</name><time>${new Date(fixes[0]?.at ?? 0).toISOString()}</time></metadata>
  <trk>
    <name>${esc(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}

/** One row per fix: time, position, speed in knots. */
export function tripCsv(fixes: TripFix[]): string {
  const kn = speeds(fixes);
  const rows = fixes.map((f, i) => `${new Date(f.at).toISOString()},${f.lat.toFixed(6)},${f.lng.toFixed(6)},${kn[i]!.toFixed(2)},${Number.isFinite(f.acc) ? Math.round(f.acc) : ""},${f.eng ? 1 : 0}`);
  return ["time,lat,lon,speed_kn,accuracy_m,engine", ...rows].join("\n") + "\n";
}

/**
 * How this boat really goes compared with the planner, from recent trips that followed a plan:
 * actual moving speed over planned speed, middle value of up to the last 6, kept within 0.7–1.3.
 * Null until there are two such trips.
 */
export function paceFactor(trips: Array<{ stats: TripStats }>): number | null {
  const ratios: number[] = [];
  for (const t of trips) {
    const p = t.stats.plan;
    if (!p || p.plannedMs <= 0 || t.stats.movingMs < 20 * 60_000 || p.plannedDistM <= 0) continue;
    const planned = p.plannedDistM / (p.plannedMs / 1000);
    const actual = t.stats.distM / (t.stats.movingMs / 1000);
    if (planned > 0 && actual > 0) ratios.push(actual / planned);
    if (ratios.length >= 6) break;
  }
  if (ratios.length < 2) return null;
  ratios.sort((a, b) => a - b);
  const mid = ratios[Math.floor(ratios.length / 2)]!;
  return Math.round(Math.max(0.7, Math.min(1.3, mid)) * 100) / 100;
}
