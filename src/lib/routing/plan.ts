/**
 * Departure planner: try departures across a window, route each with all three
 * plans, compare weather models for confidence, and pick the best departure for
 * each plan.
 */
import type { LatLng } from "../geo.ts";
import type { WeatherField } from "./field.ts";
import type { BoatPerf } from "./polar.ts";
import {
  DEFAULT_RULES,
  metricsOf,
  route,
  type IsDay,
  type Limits,
  type Obstacle,
  type RouteInput,
  type RouteMode,
  type RouteResult,
  type RouteRules,
} from "./router.ts";

/**
 * Waypoints still ahead of the boat when re-planning underway: a waypoint counts as passed once
 * the boat is nearer the next target than that waypoint is.
 */
export function remainingVia(boat: LatLng, via: LatLng[], finish: LatLng): LatLng[] {
  const d = (a: LatLng, b: LatLng) => Math.hypot(a.lat - b.lat, (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180));
  let k = 0;
  while (k < via.length) {
    const next = via[k + 1] ?? finish;
    if (d(boat, next) < d(via[k]!, next)) k += 1;
    else break;
  }
  return via.slice(k);
}

/**
 * Route through the skipper's own waypoints: start → via… → finish, each leg starting when
 * the one before arrives, joined into one route. With no waypoints it is a plain route.
 * The skipper's waypoints steer it round islands and reefs the coarse coastline misses.
 */
export function routeVia(input: RouteInput & { via?: LatLng[]; legObstacles?: (Obstacle | undefined)[] }): RouteResult {
  const via = input.via ?? [];
  if (!via.length) return route(input);
  const stops = [input.start, ...via, input.finish];
  let at = input.departAt;
  let joined: Extract<RouteResult, { ok: true }> | null = null;
  const warnings = new Set<string>();
  for (let i = 0; i < stops.length - 1; i += 1) {
    const obstacle = input.legObstacles?.[i] ?? input.obstacle;
    const leg = route({ ...input, obstacle, start: stops[i]!, finish: stops[i + 1]!, departAt: at });
    if (!leg.ok) {
      const name = i === 0 ? "start to waypoint 1" : i === stops.length - 2 ? `waypoint ${i} to the finish` : `waypoint ${i} to waypoint ${i + 1}`;
      return { ok: false, mode: input.mode, model: leg.model, departAt: input.departAt, reason: `Leg ${name}: ${leg.reason}` };
    }
    for (const w of leg.warnings) warnings.add(w);
    if (!joined) joined = { ...leg, points: leg.points.slice() };
    else joined.points.push(...leg.points.slice(1));
    at = leg.arriveAt;
  }
  if (!joined) return route(input);
  return {
    ...joined,
    departAt: input.departAt,
    arriveAt: at,
    metrics: metricsOf(joined.points, input.isDay),
    warnings: [...warnings],
  };
}

export type Light = "green" | "amber" | "red";

export type DepartureRow = {
  departAt: number;
  results: Record<RouteMode, RouteResult>;
  /** Spread of arrival times across models, hours (null if only one model). */
  spreadH: number | null;
  light: Light;
};

export type Choice = { row: DepartureRow; result: Extract<RouteResult, { ok: true }> };

export type PlanOutput = {
  rows: DepartureRow[];
  best: Record<RouteMode, Choice | null>;
  /** 16 compass points around the finish: true = land within ~3 km (sheltered from wind from there). */
  shelter?: boolean[];
  /** Whether reef outlines were in this build and avoided. */
  reefData?: "used" | "missing";
  /** Depth model check: "used" kept routes out of shallow water; "relaxed" found no route that way. */
  depthCheck?: "used" | "relaxed" | "off";
  /** Waypoints the channel finder added to keep to the deepest water. */
  channelPoints?: number;
};

export type PlanInput = {
  start: LatLng;
  finish: LatLng;
  /** The skipper's turning points between start and finish, in order. */
  via?: LatLng[];
  /** Per-leg obstacle (from the channel finder), overriding `obstacle` for that leg. */
  legObstacles?: (Obstacle | undefined)[];
  windowStart: number;
  windowEnd: number;
  /** First is the main model; the rest are used for agreement. */
  fields: WeatherField[];
  boat: BoatPerf;
  limits: Limits;
  obstacle?: Obstacle;
  isDay?: IsDay;
  rules?: RouteRules;
  /** Max departures to try (default 13: a 24 h window in 2 h steps). */
  maxDepartures?: number;
};

const H = 3_600_000;
const MODES: RouteMode[] = ["fastest", "comfort", "safest"];

/** Hourly departures where the window allows, so the planner can catch the tide. */
export function departureTimes(windowStart: number, windowEnd: number, max = 13): number[] {
  const span = Math.max(0, windowEnd - windowStart);
  let stepH = 1;
  while (span / (stepH * H) + 1 > max) stepH *= 2;
  const out: number[] = [];
  for (let t = windowStart; t <= windowEnd + 1; t += stepH * H) out.push(t);
  return out.length ? out : [windowStart];
}

type Ok = Extract<RouteResult, { ok: true }>;

function comfortScore(r: Ok): number {
  const m = r.metrics;
  return (
    m.hours +
    m.upwindPct * 0.06 +
    m.maxWaveM * 2 +
    Math.max(0, m.maxWindKn - 15) * 0.4 +
    Math.max(0, m.maxGustKn - 22) * 0.2 +
    m.windAgainstCurrentHours +
    (m.arrivesInDark ? 2 : 0)
  );
}

function safetyScore(r: Ok, l: Limits, spreadH: number | null): number {
  const m = r.metrics;
  return (
    m.maxWindKn / l.maxWindKn +
    m.maxGustKn / l.maxGustKn +
    m.maxWaveM / l.maxWaveM +
    m.windAgainstCurrentHours * 0.3 +
    (m.arrivesInDark ? 1.5 : 0) +
    (spreadH ?? 0) * 0.1 +
    m.hours * 0.01
  );
}

function lightFor(results: Record<RouteMode, RouteResult>, l: Limits, spreadH: number | null, rules: RouteRules): Light {
  const f = results.fastest;
  if (!f.ok) return "red";
  const m = f.metrics;
  if (rules.thunder !== "ignore" && m.maxThunder >= 3) return "red";
  if ((rules.thunder !== "ignore" && m.maxThunder >= 2) || (rules.squall !== "ignore" && m.squallHours >= 0.5)) return "amber";
  const near = m.maxWindKn > l.maxWindKn * 0.85 || m.maxGustKn > l.maxGustKn * 0.85 || m.maxWaveM > l.maxWaveM * 0.85;
  if (near || m.arrivesInDark || m.windAgainstCurrentHours >= 1 || (spreadH ?? 0) > 3) return "amber";
  return "green";
}

export function planPassage(input: PlanInput): PlanOutput {
  const [main, ...others] = input.fields;
  if (!main) throw new Error("No weather to route on.");
  const rules = input.rules ?? DEFAULT_RULES;
  const rows: DepartureRow[] = [];
  const times = departureTimes(input.windowStart, input.windowEnd, input.maxDepartures);
  // Many departures: scan them with a quicker pass, then route the chosen ones in full.
  const coarse = times.length > 3;
  for (const departAt of times) {
    const results = {} as Record<RouteMode, RouteResult>;
    for (const mode of MODES) {
      results[mode] = routeVia({ ...input, departAt, field: main, mode, coarse });
    }
    let spreadH: number | null = null;
    if (results.fastest.ok && others.length) {
      const arrivals = [results.fastest.arriveAt];
      for (const f of others) {
        const r = routeVia({ ...input, departAt, field: f, mode: "fastest", coarse: true });
        if (r.ok) arrivals.push(r.arriveAt);
      }
      if (arrivals.length > 1) spreadH = (Math.max(...arrivals) - Math.min(...arrivals)) / H;
    }
    rows.push({ departAt, results, spreadH, light: lightFor(results, input.limits, spreadH, rules) });
  }
  // Night arrivals: "avoid" skips them when there is any daylight alternative; "penalise" weighs them.
  const anyDay = (mode: RouteMode) => rows.some((row) => row.results[mode].ok && !(row.results[mode] as Ok).metrics.arrivesInDark);
  const pick = (mode: RouteMode, score: (r: Ok, row: DepartureRow) => number): Choice | null => {
    let best: Choice | null = null;
    let bestScore = Infinity;
    const dayOnly = rules.night === "avoid" && anyDay(mode);
    for (const row of rows) {
      const r = row.results[mode];
      if (!r.ok) continue;
      if (dayOnly && r.metrics.arrivesInDark) continue;
      const s = score(r, row) * (rules.night === "penalise" && r.metrics.arrivesInDark ? 1.25 : 1);
      if (s < bestScore) {
        bestScore = s;
        best = { row, result: r };
      }
    }
    return best;
  };
  const best: Record<RouteMode, Choice | null> = {
    fastest: pick("fastest", (r) => r.metrics.hours),
    comfort: pick("comfort", (r) => comfortScore(r)),
    safest: pick("safest", (r, row) => safetyScore(r, input.limits, row.spreadH)),
  };
  if (coarse) {
    // Re-route the winners at full detail so the route shown and followed is precise.
    for (const mode of MODES) {
      const c = best[mode];
      if (!c) continue;
      const fine = routeVia({ ...input, departAt: c.row.departAt, field: main, mode });
      if (fine.ok) {
        c.row.results[mode] = fine;
        best[mode] = { row: c.row, result: fine };
      }
    }
  }
  return { rows, best };
}

/* ---------------- Weather window finder ---------------- */

export type WindowSlot = { departAt: number; light: Light; score: number; hours: number | null };

export type WeatherWindow = {
  from: number;
  to: number;
  light: Light;
  /** Best single departure inside the window. */
  bestDepart: number;
  hours: number;
  maxWindKn: number;
  maxWaveM: number;
  /** Days from now to the window's start; confidence falls with lead time. */
  leadDays: number;
  confidence: "good" | "fair" | "low";
  note: string;
};

export type WindowScan = { slots: WindowSlot[]; windows: WeatherWindow[] };

/**
 * Scan departures across the whole forecast (every `stepH` hours) with the quick
 * router, then group consecutive good departures into windows, best first.
 */
export function findWindows(
  input: Omit<PlanInput, "windowStart" | "windowEnd"> & { from: number; to: number; stepH?: number; marineUntil?: number },
): WindowScan {
  const [main] = input.fields;
  if (!main) throw new Error("No weather to route on.");
  const rules = input.rules ?? DEFAULT_RULES;
  const stepH = input.stepH ?? 3;
  const slots: (WindowSlot & { r?: Ok })[] = [];
  for (let t = input.from; t <= input.to; t += stepH * H) {
    const r = routeVia({ ...input, departAt: t, field: main, mode: "safest", coarse: true });
    if (!r.ok) {
      slots.push({ departAt: t, light: "red", score: Infinity, hours: null });
      continue;
    }
    const results = { fastest: r, comfort: r, safest: r } as Record<RouteMode, RouteResult>;
    const light = lightFor(results, input.limits, null, rules);
    const night = rules.night === "avoid" && r.metrics.arrivesInDark ? 1.5 : rules.night === "penalise" && r.metrics.arrivesInDark ? 0.6 : 0;
    slots.push({ departAt: t, light, score: safetyScore(r, input.limits, null) + night, hours: r.metrics.hours, r });
  }
  // Group consecutive non-red slots of the same or better colour into windows.
  const windows: WeatherWindow[] = [];
  let i = 0;
  while (i < slots.length) {
    if (slots[i]!.light === "red") {
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < slots.length && slots[j + 1]!.light !== "red") j += 1;
    const run = slots.slice(i, j + 1).filter((s) => s.r);
    const best = run.reduce((a, b) => (b.score < a.score ? b : a));
    const allGreen = run.every((s) => s.light === "green");
    const leadDays = (run[0]!.departAt - input.from) / 86_400_000;
    const m = best.r!.metrics;
    const noWaves = input.marineUntil != null && best.r!.arriveAt > input.marineUntil;
    windows.push({
      from: run[0]!.departAt,
      to: run[run.length - 1]!.departAt,
      light: allGreen ? "green" : best.light,
      bestDepart: best.departAt,
      hours: m.hours,
      maxWindKn: m.maxWindKn,
      maxWaveM: m.maxWaveM,
      leadDays,
      confidence: leadDays <= 3 ? "good" : leadDays <= 5 ? "fair" : "low",
      note: [
        m.maxThunder >= 2 ? "storms possible" : "",
        m.arrivesInDark ? "night arrival" : "",
        m.steepSeaHours >= 1 ? "wind over tide" : "",
        noWaves ? "no wave forecast this far out" : "",
      ]
        .filter(Boolean)
        .join(" · "),
    });
    i = j + 1;
  }
  const rank = (w: WeatherWindow) =>
    (w.light === "green" ? 0 : 10) + slots.find((s) => s.departAt === w.bestDepart)!.score + w.leadDays * 0.15;
  windows.sort((a, b) => rank(a) - rank(b));
  return { slots: slots.map(({ r: _r, ...s }) => s), windows: windows.slice(0, 6) };
}
