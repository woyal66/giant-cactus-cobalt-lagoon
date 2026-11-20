import {
  bearingDegrees,
  closestOnSegment,
  crossTrackMeters,
  destPoint,
  haversineMeters,
  turnDegrees,
  wrapDegrees,
  type LatLng,
} from "./geo.ts";

export type SteerSense = "cut" | "track" | "open";

export const STEER_PRESETS: Record<
  SteerSense,
  { lookAheadM: number; scaleM: number; label: string; detail: string }
> = {
  cut: {
    lookAheadM: 4,
    scaleM: 2,
    label: "Cut",
    detail: "Reef entrance. Stay inside 2 m.",
  },
  track: {
    lookAheadM: 8,
    scaleM: 3,
    label: "Track",
    detail: "Tight lead. A few metres.",
  },
  open: {
    lookAheadM: 20,
    scaleM: 8,
    label: "Open",
    detail: "Wider water.",
  },
};

export const XTE_ALARM_PRESETS = [0, 1, 2, 3, 5] as const;

export function isSteerSense(v: unknown): v is SteerSense {
  return v === "cut" || v === "track" || v === "open";
}

export type NextMark = {
  index: number;
  label: string;
  rangeM: number;
  bearing: number;
  ttgS: number | null;
  pinned: boolean;
  last: boolean;
};

/** Inside the tube. The ear cue and the alarm use this. Progress along the track does not. */
export const MARK_PASS_M = 1;

export type RouteFix = {
  /** Next vertex ahead of the boat. */
  index: number;
  chainM: number;
  distM: number;
};

/**
 * Where the boat is on the route.
 * Passed marks stay passed. If you leave the line and come back beside a later mark,
 * that later mark is where the guide resumes — it does not rewind, and it does not
 * hop to a parallel leg that is only a hair closer.
 */
export function locateOnRoute(boat: LatLng, pts: LatLng[], floor = 0): RouteFix | null {
  if (pts.length === 0) return null;
  const chain: number[] = [0];
  for (let i = 1; i < pts.length; i += 1) {
    chain.push(chain[i - 1]! + haversineMeters(pts[i - 1]!, pts[i]!));
  }
  if (pts.length === 1) {
    return { index: 0, chainM: 0, distM: haversineMeters(boat, pts[0]!) };
  }
  const floorI = Math.max(0, Math.min(floor, pts.length - 1));
  const floorChain = chain[floorI]!;
  const hits: Array<{ chainM: number; distM: number; t: number }> = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const hit = closestOnSegment(boat, pts[i]!, pts[i + 1]!);
    const seg = chain[i + 1]! - chain[i]!;
    const chainM = chain[i]! + hit.t * seg;
    if (chainM >= floorChain - 8) hits.push({ chainM, distM: hit.distM, t: hit.t });
  }
  const pool =
    hits.length > 0
      ? hits
      : [{ chainM: floorChain, distM: haversineMeters(boat, pts[floorI]!), t: 0 }];
  let bestDist = pool[0]!.distM;
  for (const h of pool) if (h.distM < bestDist) bestDist = h.distM;
  const close = pool.filter((h) => h.distM <= bestDist + 6);
  let best = close[0]!;
  for (const h of close) if (h.chainM < best.chainM) best = h;
  const onward = close.filter((h) => h.chainM > best.chainM + 1 && h.t < 0.98);
  if (best.t > 0.98 && onward.length > 0) {
    best = onward[0]!;
    for (const h of onward) if (h.chainM < best.chainM) best = h;
  }
  let index = pts.length - 1;
  for (let i = 0; i < pts.length; i += 1) {
    if (chain[i]! >= best.chainM - 4) {
      index = i;
      break;
    }
  }
  if (index < floorI) index = floorI;
  if (
    index < pts.length - 1 &&
    haversineMeters(boat, pts[index]!) <= 12 &&
    best.chainM + 4 >= chain[index]!
  ) {
    index += 1;
  }
  if (index < floorI) index = floorI;
  return { index, chainM: best.chainM, distM: best.distM };
}

/** Next mark on the course. `floor` never rewinds — a passed mark stays passed. */
export function courseTarget(boat: LatLng, pts: LatLng[], floor = 0): number {
  return locateOnRoute(boat, pts, floor)?.index ?? -1;
}

export function nextVertexIndex(
  boat: LatLng,
  pts: LatLng[],
  pinned: number | null,
  floor = 0,
): number {
  if (pts.length === 0) return -1;
  if (pinned != null && pinned >= 0 && pinned < pts.length) return pinned;
  return courseTarget(boat, pts, floor);
}

export function markNav(
  boat: LatLng & { speedMs?: number | null },
  pts: Array<LatLng & { label?: string }>,
  pinned: number | null,
  floor = 0,
): NextMark | null {
  const index = nextVertexIndex(boat, pts, pinned, floor);
  if (index < 0) return null;
  const mark = pts[index]!;
  const rangeM = haversineMeters(boat, mark);
  const speed = boat.speedMs ?? 0;
  const ttgS = speed >= 0.25 && rangeM > 1 ? rangeM / speed : null;
  const label =
    mark.label && mark.label.trim()
      ? mark.label.trim()
      : `WP ${index + 1}`;
  return {
    index,
    label,
    rangeM,
    bearing: bearingDegrees(boat, mark),
    ttgS,
    pinned: pinned === index,
    last: index === pts.length - 1,
  };
}

export function formatTtg(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 90) return `${Math.max(1, Math.round(seconds))} s`;
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

/** Cross-track for the helm: metres and P/S. Positive XTE is starboard of the line. */
export function formatXte(xteM: number | null | undefined): {
  value: string;
  unit: string;
  side: "P" | "S" | null;
} {
  if (xteM == null || !Number.isFinite(xteM)) return { value: "—", unit: "", side: null };
  const m = Math.abs(xteM);
  if (m < 0.4) return { value: "0", unit: "m", side: null };
  const side = xteM >= 0 ? "S" : "P";
  const value = m < 10 ? `${m.toFixed(1)}${side}` : `${Math.round(m)}${side}`;
  return { value, unit: "m", side };
}

export type SteerCue = {
  xteM: number;
  cts: number;
  trackBrg: number;
  steerDeg: number;
  cdi: number;
  offTrack: boolean;
  remainM: number;
  aim: LatLng;
};

function alongRoute(
  pts: LatLng[],
  startI: number,
  t: number,
  aheadM: number,
): LatLng {
  const last = pts[pts.length - 1]!;
  if (pts.length < 2) return last;
  let left = Math.max(0, aheadM);
  let i = startI;
  let fromT = t;
  while (i < pts.length - 1) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const from =
      fromT <= 0.001 ? a : destPoint(a, bearingDegrees(a, b), fromT * haversineMeters(a, b));
    const rest = haversineMeters(from, b);
    if (left <= rest || i === pts.length - 2) {
      if (rest < 1) return b;
      return destPoint(from, bearingDegrees(from, b), Math.min(left, rest));
    }
    left -= rest;
    i += 1;
    fromT = 0;
  }
  return last;
}

export function steerCue(
  boat: LatLng & { heading?: number | null },
  pts: LatLng[],
  sense: SteerSense,
  alarmM: number,
  toIndex?: number | null,
): SteerCue | null {
  if (pts.length < 2) return null;
  let bestI = 0;
  let best = closestOnSegment(boat, pts[0]!, pts[1]!);
  const locked =
    toIndex != null && toIndex >= 0 && toIndex < pts.length ? toIndex : null;
  if (locked == null) {
    for (let i = 1; i < pts.length - 1; i += 1) {
      const c = closestOnSegment(boat, pts[i]!, pts[i + 1]!);
      if (c.distM < best.distM) {
        best = c;
        bestI = i;
      }
    }
  } else if (locked === 0) {
    bestI = 0;
    best = closestOnSegment(boat, pts[0]!, pts[1]!);
  } else {
    bestI = locked - 1;
    best = closestOnSegment(boat, pts[bestI]!, pts[bestI + 1]!);
  }
  const a = pts[bestI]!;
  const b = pts[bestI + 1]!;
  const trackBrg = bearingDegrees(a, b);
  const xteM = crossTrackMeters(boat, a, b);
  const preset = STEER_PRESETS[sense];
  const aim = alongRoute(pts, bestI, best.t, preset.lookAheadM);
  const toAim = haversineMeters(boat, aim);
  const cts = wrapDegrees(toAim < 1.5 ? trackBrg : bearingDegrees(boat, aim));
  const heading =
    boat.heading == null || !Number.isFinite(boat.heading)
      ? trackBrg
      : boat.heading;
  const steerDeg = turnDegrees(heading, cts);
  const remainM = (() => {
    let n = haversineMeters(best.point, b);
    for (let i = bestI + 1; i < pts.length - 1; i += 1) {
      n += haversineMeters(pts[i]!, pts[i + 1]!);
    }
    return n;
  })();
  const scale = Math.max(1, preset.scaleM);
  const cdi = Math.max(-1, Math.min(1, xteM / scale));
  return {
    xteM,
    cts,
    trackBrg,
    steerDeg,
    cdi,
    offTrack: alarmM > 0 && Math.abs(xteM) >= alarmM,
    remainM,
    aim,
  };
}