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
  route,
  type IsDay,
  type Limits,
  type Obstacle,
  type RouteMode,
  type RouteResult,
  type RouteRules,
} from "./router.ts";

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
};

export type PlanInput = {
  start: LatLng;
  finish: LatLng;
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
  for (const departAt of departureTimes(input.windowStart, input.windowEnd, input.maxDepartures)) {
    const results = {} as Record<RouteMode, RouteResult>;
    for (const mode of MODES) {
      results[mode] = route({ ...input, departAt, field: main, mode });
    }
    let spreadH: number | null = null;
    if (results.fastest.ok && others.length) {
      const arrivals = [results.fastest.arriveAt];
      for (const f of others) {
        const r = route({ ...input, departAt, field: f, mode: "fastest" });
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
  return {
    rows,
    best: {
      fastest: pick("fastest", (r) => r.metrics.hours),
      comfort: pick("comfort", (r) => comfortScore(r)),
      safest: pick("safest", (r, row) => safetyScore(r, input.limits, row.spreadH)),
    },
  };
}
