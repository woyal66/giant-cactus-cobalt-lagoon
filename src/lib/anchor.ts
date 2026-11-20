import type { LatLng } from "./geo.ts";
import { bearingDegrees, destPoint, haversineMeters, pointInPolygon } from "./geo.ts";

export type ScopeRatio = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type RodeSetup = {
  depthM: number;
  chainM: number;
  bowM: number;
  loaM: number;
  chainTotalM: number;
  scopeTarget: ScopeRatio;
  tideRiseM: number;
  tideHighAt: number | null;
  tideManual: boolean;
};

export const DEFAULT_RODE: RodeSetup = {
  depthM: 8,
  chainM: 40,
  bowM: 1.5,
  loaM: 12,
  chainTotalM: 60,
  scopeTarget: 5,
  tideRiseM: 0,
  tideHighAt: null,
  tideManual: false,
};

export type RodeMath = {
  nowDepthM: number;
  hwDepthM: number;
  needHwM: number;
  shortHwM: number;
  scopeNow: number;
  scopeHw: number;
  status: "ok" | "short" | "critical";
  radiusM: number;
  overTotal: boolean;
  laybackM: number;
};

export function laybackM(rode: Pick<RodeSetup, "depthM" | "chainM" | "bowM">): number {
  return Math.max(0, rode.chainM - rode.depthM - rode.bowM);
}

export function tautHorizM(chainM: number, depthM: number): number {
  if (chainM <= depthM) return 0;
  return Math.sqrt(chainM * chainM - depthM * depthM);
}

export function swingRadiusM(
  chainM: number,
  depthM: number,
  loaM: number,
  gpsReachM?: number,
): number {
  const extra =
    gpsReachM != null && gpsReachM > loaM / 2 ? gpsReachM : loaM / 2;
  return Math.round(tautHorizM(chainM, depthM) + extra);
}

export function rodeMath(rode: RodeSetup, gpsReachM?: number): RodeMath {
  const nowDepthM = rode.depthM + rode.bowM;
  const hwDepthM = nowDepthM + Math.max(0, rode.tideRiseM);
  const needHwM = rode.scopeTarget * hwDepthM;
  const shortHwM = Math.max(0, needHwM - rode.chainM);
  const scopeNow = rode.chainM / Math.max(0.1, nowDepthM);
  const scopeHw = rode.chainM / Math.max(0.1, hwDepthM);
  const status: RodeMath["status"] =
    shortHwM <= 0.05
      ? "ok"
      : scopeHw < 3 && rode.scopeTarget >= 3
        ? "critical"
        : "short";
  return {
    nowDepthM,
    hwDepthM,
    needHwM,
    shortHwM,
    scopeNow,
    scopeHw,
    status,
    radiusM: swingRadiusM(rode.chainM, hwDepthM, rode.loaM, gpsReachM),
    overTotal: needHwM > rode.chainTotalM,
    laybackM: laybackM(rode),
  };
}

export function suggestedPayOutM(rode: RodeSetup, math = rodeMath(rode)): number {
  const need = Math.ceil(math.needHwM);
  return Math.min(rode.chainTotalM, Math.max(rode.chainM, need));
}

export function clampRode(
  partial: Partial<RodeSetup>,
  base: RodeSetup = DEFAULT_RODE,
): RodeSetup {
  const n = (v: unknown, fallback: number, min: number, max: number) => {
    if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, v));
  };
  const raw = partial.scopeTarget;
  const scope: ScopeRatio =
    typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 10
      ? raw
      : base.scopeTarget;
  return {
    depthM: n(partial.depthM, base.depthM, 0, 80),
    chainM: n(partial.chainM, base.chainM, 5, 400),
    bowM: n(partial.bowM, base.bowM, 0, 8),
    loaM: n(partial.loaM, base.loaM, 4, 80),
    chainTotalM: n(partial.chainTotalM, base.chainTotalM, 10, 400),
    scopeTarget: scope,
    tideRiseM: n(partial.tideRiseM, base.tideRiseM, 0, 12),
    tideHighAt:
      typeof partial.tideHighAt === "number" && Number.isFinite(partial.tideHighAt)
        ? partial.tideHighAt
        : (partial.tideHighAt === null ? null : base.tideHighAt),
    tideManual:
      typeof partial.tideManual === "boolean" ? partial.tideManual : base.tideManual,
  };
}

export function clampAlarmRadius(m: number): number {
  if (!Number.isFinite(m)) return 40;
  return Math.max(12, Math.min(800, Math.round(m)));
}

export function snapToLayback(
  boat: LatLng,
  finger: LatLng,
  rode: Pick<RodeSetup, "depthM" | "chainM" | "bowM">,
): LatLng {
  const lay = Math.max(8, laybackM(rode));
  const brg = bearingDegrees(boat, finger);
  return destPoint(boat, brg, lay);
}

export function hookAstern(
  boat: LatLng & { heading?: number | null },
  rode: Pick<RodeSetup, "depthM" | "chainM" | "bowM">,
): LatLng {
  const lay = Math.max(8, laybackM(rode));
  const hdg = boat.heading ?? 0;
  return destPoint(boat, hdg + 180, lay);
}

export function boatInsideWatch(
  boat: LatLng,
  watch: { lat: number; lng: number; radiusM: number; fence: LatLng[] | null },
): boolean {
  if (watch.fence && watch.fence.length >= 3) {
    return pointInPolygon(boat, watch.fence);
  }
  return haversineMeters(boat, watch) <= watch.radiusM;
}

/** Slow GPS while well inside the swing. Faster near the edge or outside. */
export const ANCHOR_POLL_SLOW_MS = 30_000;
export const ANCHOR_POLL_FAST_MS = 8_000;

export function anchorPollMs(
  boat: LatLng | null,
  watch: { lat: number; lng: number; radiusM: number; fence: LatLng[] | null } | null,
): number {
  if (!boat || !watch) return ANCHOR_POLL_SLOW_MS;
  if (watch.fence && watch.fence.length >= 3) {
    return boatInsideWatch(boat, watch) ? ANCHOR_POLL_SLOW_MS : ANCHOR_POLL_FAST_MS;
  }
  return haversineMeters(boat, watch) > watch.radiusM * 0.7
    ? ANCHOR_POLL_FAST_MS
    : ANCHOR_POLL_SLOW_MS;
}

export function rodeDropNote(rode: RodeSetup): string | null {
  const math = rodeMath(rode);
  if (math.status === "ok") return null;
  const extra = Math.ceil(math.shortHwM);
  if (math.status === "critical") {
    return `Under 3:1 at high water — let ${extra} m more chain.`;
  }
  return `short ${extra} m for ${rode.scopeTarget}:1 at HW`;
}

export function formatScope(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${n.toFixed(1)}:1`;
}

export function formatTideClock(at: number | null): string {
  if (!at) return "—";
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function hoursUntil(at: number | null, now = Date.now()): string {
  if (!at) return "";
  const h = (at - now) / 3_600_000;
  if (h < 0.08) return "now";
  if (h < 1) return `${Math.round(h * 60)} min`;
  const hr = Math.floor(h);
  const min = Math.round((h - hr) * 60);
  if (min === 60) return `${hr + 1} h`;
  return min ? `${hr} h ${min} m` : `${hr} h`;
}

export const SWING_TRAIL_STEP_M = 3;
export const SWING_TRAIL_MAX = 800;

export function appendSwingTrail(trail: LatLng[], p: LatLng): LatLng[] {
  const last = trail[trail.length - 1];
  if (last && haversineMeters(last, p) < SWING_TRAIL_STEP_M) return trail;
  const next = [...trail, { lat: p.lat, lng: p.lng }];
  return next.length > SWING_TRAIL_MAX ? next.slice(-SWING_TRAIL_MAX) : next;
}
