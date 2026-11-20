/**
 * Isochrone weather router: the standard method behind most sailing routing
 * software. From the start, try every heading for one time step, keep the
 * furthest-forward point in each direction (the isochrone), repeat until the
 * finish is in reach, then trace back the best path.
 *
 * Three plans share the engine and differ only in what a step "costs":
 *   fastest - real time, inside your limits
 *   comfort - time, plus penalties for upwind work, steep seas and gusts
 *   safest  - time, with a margin below your limits, plus wind-against-current
 *             and night-arrival penalties
 * Each node carries the real clock (`at`) for weather lookups and ETAs, and the
 * effective cost used to choose between routes.
 */
import { bearingDegrees, destPoint, haversineMeters, type LatLng } from "../geo.ts";
import { conditionsAt, fieldEnd, type Conditions, type WeatherField } from "./field.ts";
import { boatSpeed, noGoDeg, waveFactor, type BoatPerf } from "./polar.ts";
import { effectiveWave } from "./waves.ts";
import { isSquall, thunderRisk, type Risk, type Treat } from "./storm.ts";

/** How each hazard is handled. Chosen on the Routing Settings page. */
export type RouteRules = {
  thunder: Treat;
  squall: Treat;
  windOverTide: Treat;
  /** Arriving in the dark (applied when choosing departures). */
  night: Treat;
  /** 0 = speed matters most, 1 = comfort matters most (scales comfort penalties). */
  comfortWeight: number;
};

export const DEFAULT_RULES: RouteRules = {
  thunder: "penalise",
  squall: "penalise",
  windOverTide: "penalise",
  night: "warn",
  comfortWeight: 0.5,
};

export type RouteMode = "fastest" | "comfort" | "safest";

export type Limits = {
  maxWindKn: number;
  maxGustKn: number;
  maxWaveM: number;
};

export const DEFAULT_LIMITS: Limits = { maxWindKn: 25, maxGustKn: 32, maxWaveM: 2.5 };

/** Segment crosses land (or other no-go area). */
export type Obstacle = (a: LatLng, b: LatLng) => boolean;

/** Daylight test for arrival scoring. */
export type IsDay = (lat: number, lng: number, at: number) => boolean;

export type RouteInput = {
  start: LatLng;
  finish: LatLng;
  departAt: number;
  field: WeatherField;
  boat: BoatPerf;
  mode: RouteMode;
  limits: Limits;
  obstacle?: Obstacle;
  isDay?: IsDay;
  rules?: RouteRules;
};

export type RoutePoint = LatLng & {
  at: number;
  windKn: number;
  windDir: number;
  gustKn: number;
  /** Wave height after wind-over-tide steepening. */
  waveM: number;
  /** How much the current raised the waves (1 = not at all). */
  waveAmp: number;
  /** Current along the boat's track, knots (+ fair, − foul). */
  curAlongKn: number;
  /** Thunderstorm risk 0–3 and rain squall flag on this leg. */
  thunder: Risk;
  squall: boolean;
  curKn: number;
  curDir: number;
  /** True wind angle on this leg, 0–180 (wind over the water). */
  twa: number;
  /** True wind speed over the water, knots. */
  twsKn: number;
  /** Which side the wind is on: 1 starboard, -1 port, 0 under engine. */
  tack: number;
  stwKn: number;
  sogKn: number;
  motoring: boolean;
};

export type RouteMetrics = {
  hours: number;
  distanceNm: number;
  maxWindKn: number;
  maxGustKn: number;
  maxWaveM: number;
  upwindPct: number;
  motorHours: number;
  windAgainstCurrentHours: number;
  /** Hours where an opposing current raised the seas by 15% or more. */
  steepSeaHours: number;
  /** Largest wind-over-tide height increase, e.g. 1.4 = 40% higher. */
  maxWaveAmp: number;
  /** Average current along the track, knots (+ fair, − foul). */
  avgCurrentKn: number;
  maxThunder: Risk;
  /** Hours with thunderstorm risk "likely" or worse. */
  thunderHours: number;
  squallHours: number;
  arrivesInDark: boolean;
};

export type RouteResult =
  | {
      ok: true;
      mode: RouteMode;
      model: string;
      departAt: number;
      arriveAt: number;
      points: RoutePoint[];
      metrics: RouteMetrics;
      warnings: string[];
    }
  | { ok: false; mode: RouteMode; model: string; departAt: number; reason: string };

type Node = LatLng & {
  at: number;
  cost: number;
  parent: Node | null;
  /** Which side the wind is on (-1 / 1), 0 at the start or under engine. */
  side: number;
  /** Leg sailed to reach this node. */
  leg: Omit<RoutePoint, "lat" | "lng" | "at" | "tack"> | null;
};

const H = 3_600_000;
const NM = 1852;
const HEADING_STEP = 10;
/** Time lost per tack or gybe. Stops the router zigzagging like no skipper would. */
export const MANOEUVRE_H = 0.05;

function sideOf(windDir: number, heading: number, motoring: boolean): number {
  if (motoring) return 0;
  const d = ((heading - windDir + 540) % 360) - 180;
  return d >= 0 ? 1 : -1;
}

function manoeuvre(parentSide: number, side: number): number {
  return parentSide !== 0 && side !== 0 && side !== parentSide ? MANOEUVRE_H : 0;
}

function norm180(d: number): number {
  return Math.abs(((d + 540) % 360) - 180);
}

/** Is this wind-against-current (short, steep seas)? */
export function windAgainstCurrent(c: Pick<Conditions, "windKn" | "windDir" | "curKn" | "curDir">): boolean {
  if (c.windKn < 12 || c.curKn < 1) return false;
  const windToward = (c.windDir + 180) % 360;
  return norm180(windToward - c.curDir) > 120;
}

type Step = {
  sogKn: number;
  cogDeg: number;
  stwKn: number;
  motoring: boolean;
  twa: number;
  twsKn: number;
  waveM: number;
  waveAmp: number;
  curAlongKn: number;
  thunder: Risk;
  squall: boolean;
  /** Multiplier ≥ 1 on time for this step, or Infinity if not allowed. */
  penalty: number;
};

/** Sail one heading through the water at these conditions. */
/** Wind relative to the water: forecast (ground) wind minus the current. */
export function waterWind(c: Pick<Conditions, "windKn" | "windDir" | "curKn" | "curDir">): { kn: number; dir: number } {
  if (!(c.curKn > 0.05)) return { kn: c.windKn, dir: c.windDir };
  const to = ((c.windDir + 180) * Math.PI) / 180;
  const cr = (c.curDir * Math.PI) / 180;
  const x = c.windKn * Math.sin(to) - c.curKn * Math.sin(cr);
  const y = c.windKn * Math.cos(to) - c.curKn * Math.cos(cr);
  const kn = Math.hypot(x, y);
  // Back to "blowing FROM".
  const dir = ((Math.atan2(-x, -y) * 180) / Math.PI + 360) % 360;
  return { kn, dir };
}

export function stepOn(
  boat: BoatPerf,
  c: Conditions,
  headingDeg: number,
  mode: RouteMode,
  limits: Limits,
  rules: RouteRules = DEFAULT_RULES,
): Step {
  // The boat sails in the wind over the moving water, not the forecast (ground) wind:
  // a current against the wind adds to the breeze, a current with it takes away.
  const ww = waterWind(c);
  const twa = norm180(ww.dir - headingDeg);
  const sp = boatSpeed(boat, ww.kn, twa);
  // Waves running into an opposing current stand up.
  const wave = effectiveWave(c.waveM, c.wavePerS, c.waveDir, c.curKn, c.curDir);
  const stw = sp.stwKn * waveFactor(wave.heightM, c.waveDir - headingDeg, boat.loaM);
  // Ground velocity = water velocity + current.
  const hr = (headingDeg * Math.PI) / 180;
  const cr = (c.curDir * Math.PI) / 180;
  const vx = stw * Math.sin(hr) + c.curKn * Math.sin(cr);
  const vy = stw * Math.cos(hr) + c.curKn * Math.cos(cr);
  const sog = Math.hypot(vx, vy);
  const cog = ((Math.atan2(vx, vy) * 180) / Math.PI + 360) % 360;
  const curAlong = c.curKn * Math.cos(((c.curDir - cog) * Math.PI) / 180);

  const thunder = thunderRisk(c);
  const squall = isSquall(c);
  const wot = wave.amp >= 1.15 || windAgainstCurrent(c);

  const margin = mode === "safest" ? 0.85 : 1;
  const over =
    c.windKn > limits.maxWindKn * margin ||
    c.gustKn > limits.maxGustKn * margin ||
    wave.heightM > limits.maxWaveM * margin ||
    (mode === "safest" && wave.blocked) ||
    (rules.thunder === "avoid" && thunder >= 2) ||
    (rules.squall === "avoid" && squall) ||
    (rules.windOverTide === "avoid" && (wave.amp >= 1.3 || wave.blocked));
  let penalty = over ? Infinity : 1;
  // Hazards the skipper asked to "prefer to avoid" cost time in every plan, more in Safest.
  if (penalty !== Infinity) {
    const k = mode === "safest" ? 2 : 1;
    if (rules.thunder === "penalise" && thunder >= 1) penalty += 0.25 * thunder * k;
    if (rules.squall === "penalise" && squall) penalty += 0.4 * k;
    if (rules.windOverTide === "penalise" && wot && mode !== "fastest") penalty += 0.3 * k;
  }
  if (penalty !== Infinity && mode === "comfort") {
    const w = 0.5 + Math.min(1, Math.max(0, rules.comfortWeight));
    if (!sp.motoring && twa < 60) penalty += 0.45 * w;
    if (wave.heightM > 1.2) penalty += 0.25 * (wave.heightM - 1.2) * w;
    // Short, steep wind-over-tide chop is the most uncomfortable sea there is.
    if (wave.steep > 1.3 && wave.heightM > 0.6) penalty += 0.4 * (wave.steep - 1.3) * w;
    if (c.gustKn > 22) penalty += 0.03 * (c.gustKn - 22) * w;
    if (norm180(c.waveDir - headingDeg) > 60 && norm180(c.waveDir - headingDeg) < 120 && wave.heightM > 1.5) {
      penalty += 0.2 * w; // rolling in beam seas
    }
  }
  if (penalty !== Infinity && mode === "safest") {
    penalty += 0.8 * Math.pow(c.windKn / limits.maxWindKn, 4);
    penalty += 0.8 * Math.pow(wave.heightM / limits.maxWaveM, 4);
    if (wave.blocked) penalty += 2;
  }
  return {
    sogKn: sog,
    cogDeg: cog,
    stwKn: stw,
    motoring: sp.motoring,
    twa,
    twsKn: ww.kn,
    waveM: wave.heightM,
    waveAmp: wave.amp,
    curAlongKn: curAlong,
    thunder,
    squall,
    penalty,
  };
}

function stepHours(directNm: number): number {
  return Math.min(2, Math.max(0.25, directNm / 6 / 30));
}

function trace(n: Node): Node[] {
  const out: Node[] = [];
  for (let c: Node | null = n; c; c = c.parent) out.push(c);
  return out.reverse();
}

function toPoints(nodes: Node[]): RoutePoint[] {
  return nodes.map((n, i) => {
    const leg = nodes[i + 1]?.leg ?? n.leg;
    return {
      lat: n.lat,
      lng: n.lng,
      at: n.at,
      windKn: leg?.windKn ?? 0,
      windDir: leg?.windDir ?? 0,
      gustKn: leg?.gustKn ?? 0,
      waveM: leg?.waveM ?? 0,
      waveAmp: leg?.waveAmp ?? 1,
      curAlongKn: leg?.curAlongKn ?? 0,
      thunder: leg?.thunder ?? 0,
      squall: leg?.squall ?? false,
      curKn: leg?.curKn ?? 0,
      curDir: leg?.curDir ?? 0,
      twa: leg?.twa ?? 0,
      twsKn: leg?.twsKn ?? 0,
      tack: nodes[i + 1]?.side ?? n.side,
      stwKn: leg?.stwKn ?? 0,
      sogKn: leg?.sogKn ?? 0,
      motoring: leg?.motoring ?? false,
    };
  });
}

export function metricsOf(points: RoutePoint[], isDay?: IsDay): RouteMetrics {
  let dist = 0;
  let upwind = 0;
  let sailing = 0;
  let motor = 0;
  let wac = 0;
  let steep = 0;
  let maxAmp = 1;
  let curSum = 0;
  let maxThunder: Risk = 0;
  let thunderH = 0;
  let squallH = 0;
  let maxWind = 0;
  let maxGust = 0;
  let maxWave = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const h = (b.at - a.at) / H;
    dist += haversineMeters(a, b) / NM;
    maxWind = Math.max(maxWind, a.windKn);
    maxGust = Math.max(maxGust, a.gustKn);
    maxWave = Math.max(maxWave, a.waveM);
    if (a.motoring) motor += h;
    else {
      sailing += h;
      if (a.twa < 60) upwind += h;
    }
    if (windAgainstCurrent(a)) wac += h;
    if (a.waveAmp >= 1.15) steep += h;
    maxAmp = Math.max(maxAmp, a.waveAmp);
    curSum += a.curAlongKn * h;
    if (a.thunder > maxThunder) maxThunder = a.thunder;
    if (a.thunder >= 2) thunderH += h;
    if (a.squall) squallH += h;
  }
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return {
    hours: (last.at - first.at) / H,
    distanceNm: dist,
    maxWindKn: maxWind,
    maxGustKn: maxGust,
    maxWaveM: maxWave,
    upwindPct: sailing > 0 ? Math.round((upwind / sailing) * 100) : 0,
    motorHours: motor,
    windAgainstCurrentHours: wac,
    steepSeaHours: steep,
    maxWaveAmp: maxAmp,
    avgCurrentKn: (last.at - first.at) / H > 0 ? curSum / ((last.at - first.at) / H) : 0,
    maxThunder,
    thunderHours: thunderH,
    squallHours: squallH,
    arrivesInDark: isDay ? !isDay(last.lat, last.lng, last.at) : false,
  };
}

function warningsFor(m: RouteMetrics, limits: Limits, rules: RouteRules = DEFAULT_RULES): string[] {
  const w: string[] = [];
  if (rules.thunder !== "ignore" && m.maxThunder >= 1) {
    w.push(
      m.maxThunder >= 3
        ? `Severe thunderstorms possible (${Math.max(1, Math.round(m.thunderHours))} h). Strongly consider another departure.`
        : m.maxThunder >= 2
          ? `Thunderstorms likely for about ${Math.max(1, Math.round(m.thunderHours))} h. Reef early and watch the sky.`
          : "Thunderstorms possible on the way (unstable air).",
    );
  }
  if (rules.squall !== "ignore" && m.squallHours >= 0.5) {
    w.push(`Rain squalls (heavy rain with gusts over 25 kn) for about ${Math.max(1, Math.round(m.squallHours))} h.`);
  }
  if (rules.night !== "ignore" && m.arrivesInDark) w.push("Arrives after dark. Leave earlier or later to see reefs and marks.");
  if (rules.windOverTide === "ignore") {
    // no wind-over-tide warnings
  } else if (m.steepSeaHours >= 0.5) {
    w.push(
      `About ${Math.max(1, Math.round(m.steepSeaHours))} h of wind over tide: seas up to ${Math.round((m.maxWaveAmp - 1) * 100)}% higher and steeper. Try a departure that carries the tide with the wind.`,
    );
  } else if (m.windAgainstCurrentHours >= 1) {
    w.push(`About ${Math.round(m.windAgainstCurrentHours)} h of wind against current: short, steep seas.`);
  }
  if (m.avgCurrentKn <= -0.4) w.push(`Foul tide and current: about ${Math.abs(m.avgCurrentKn).toFixed(1)} kn against you on average.`);
  if (m.maxGustKn > limits.maxGustKn * 0.9) w.push(`Gusts up to ${Math.round(m.maxGustKn)} kn.`);
  if (m.upwindPct >= 50) w.push(`${m.upwindPct}% of the sailing is upwind.`);
  if (m.motorHours >= 1) w.push(`About ${Math.round(m.motorHours)} h under engine.`);
  return w;
}

/** Route one departure, one model, one plan. */
export function route(input: RouteInput): RouteResult {
  const { start, finish, departAt, field, boat, mode, limits, obstacle, isDay } = input;
  const rules = input.rules ?? DEFAULT_RULES;
  const fail = (reason: string): RouteResult => ({ ok: false, mode, model: field.model, departAt, reason });
  const directM = haversineMeters(start, finish);
  if (directM < 200) return fail("Start and finish are too close together.");
  const directNm = directM / NM;
  const dtH = stepHours(directNm);
  const end = fieldEnd(field);
  const maxSteps = Math.ceil(Math.min((end - departAt) / H, 24 * 10) / dtH);
  // Sector width for pruning: finer for short trips.
  const sectorDeg = directNm < 20 ? 2 : directNm < 100 ? 1.5 : 1;
  const maxRange = directM * 1.8;

  let front: Node[] = [{ ...start, at: departAt, cost: 0, parent: null, leg: null, side: 0 }];
  let best: Node | null = null;

  for (let step = 0; step < maxSteps && front.length; step += 1) {
    const sectors = new Map<number, Node>();
    for (const n of front) {
      if (n.at > end) continue;
      const c = conditionsAt(field, n.lat, n.lng, n.at);
      // Try to finish from here first.
      const toFinish = bearingDegrees(n, finish);
      const remainM = haversineMeters(n, finish);
      for (const h of finishHeadings(boat, c, toFinish)) {
        const s = stepOn(boat, c, h, mode, limits, rules);
        if (!Number.isFinite(s.penalty) || s.sogKn < 0.5) continue;
        // Component of ground speed toward the finish.
        const made = s.sogKn * Math.cos(((s.cogDeg - toFinish) * Math.PI) / 180);
        if (made <= 0.3) continue;
        const hours = remainM / NM / made;
        if (hours > dtH) continue;
        if (obstacle?.(n, finish)) continue;
        const side = sideOf(c.windDir, h, s.motoring);
        const turn = manoeuvre(n.side, side);
        const at = n.at + (hours + turn) * H;
        const cost = n.cost + hours * s.penalty + turn;
        if (!best || cost < best.cost) {
          best = {
            ...finish,
            at,
            cost,
            parent: n,
            leg: legOf(c, s),
            side,
          };
        }
      }
      for (let h = 0; h < 360; h += HEADING_STEP) {
        const s = stepOn(boat, c, h, mode, limits, rules);
        if (!Number.isFinite(s.penalty) || s.sogKn < 0.3) continue;
        const p = destPoint(n, s.cogDeg, s.sogKn * dtH * NM);
        if (haversineMeters(p, finish) > maxRange) continue;
        if (obstacle?.(n, p)) continue;
        const side = sideOf(c.windDir, h, s.motoring);
        const turn = manoeuvre(n.side, side);
        const node: Node = {
          ...p,
          at: n.at + (dtH + turn) * H,
          cost: n.cost + dtH * s.penalty + turn,
          parent: n,
          leg: legOf(c, s),
          side,
        };
        const key = Math.round(bearingDegrees(start, p) / sectorDeg);
        const d = haversineMeters(start, p);
        const prev = sectors.get(key);
        // Keep the furthest point in each sector; on a near tie prefer the cheaper one.
        if (!prev || d > haversineMeters(start, prev) + 1 || (Math.abs(d - haversineMeters(start, prev)) <= 1 && node.cost < prev.cost)) {
          sectors.set(key, node);
        }
      }
    }
    // Stop once the best finish beats anything still on the front.
    if (best && [...sectors.values()].every((n) => n.cost >= best!.cost)) break;
    front = [...sectors.values()];
  }

  if (!best) {
    return fail(
      mode === "fastest"
        ? "No route inside your limits in this forecast. Try another departure, relax the limits, or allow the engine."
        : "No route inside the safety margins in this forecast.",
    );
  }
  const points = toPoints(trace(best));
  const metrics = metricsOf(points, isDay);
  return {
    ok: true,
    mode,
    model: field.model,
    departAt,
    arriveAt: best.at,
    points,
    metrics,
    warnings: warningsFor(metrics, limits, rules),
  };
}

/** Headings to try for the final hop: straight at it, and both close-hauled tacks. */
function finishHeadings(boat: BoatPerf, c: Conditions, toFinish: number): number[] {
  const ng = noGoDeg(boat.type) + 2;
  return [toFinish, (c.windDir + ng) % 360, (c.windDir - ng + 360) % 360];
}

function legOf(c: Conditions, s: Step): NonNullable<Node["leg"]> {
  return {
    windKn: c.windKn,
    windDir: c.windDir,
    gustKn: c.gustKn,
    curKn: c.curKn,
    curDir: c.curDir,
    twa: s.twa,
    twsKn: s.twsKn,
    stwKn: s.stwKn,
    sogKn: s.sogKn,
    motoring: s.motoring,
    waveM: s.waveM,
    waveAmp: s.waveAmp,
    curAlongKn: s.curAlongKn,
    thunder: s.thunder,
    squall: s.squall,
  };
}
