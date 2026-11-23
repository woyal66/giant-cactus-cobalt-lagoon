import { learnedFactor, type LearnedPolar } from "./learned.ts";

/**
 * Boat performance (polars): speed through the water for a true wind speed (TWS)
 * and true wind angle (TWA). Built-in tables are typical cruising figures for a
 * ~12 m boat, scaled by √(waterline) — Froude scaling. They can be 10–20% off a
 * real boat; an imported polar (later) replaces them.
 */
export type BoatType = "mono" | "catamaran" | "motor";

export type BoatPerf = {
  type: BoatType;
  loaM: number;
  /** Engine on when the predicted sailing speed is below this (0 = off). */
  motorBelowKn: number;
  /** Engine on when the wind is below this, whatever the sailing speed (0 = off). */
  motorWindBelowKn?: number;
  /**
   * Wind on the nose (inside the no-go zone): false = tack, as a sailor would in a
   * working breeze; true = motor straight into it at motor speed.
   */
  motorOnNose?: boolean;
  /** Cruising speed under engine. */
  motorKn: number;
  /** This boat's learned speed ratios; applied when present. */
  learned?: LearnedPolar;
  /** The skipper's own numbers: best speeds in 15 kn of true wind, and how close it points. */
  tune?: PolarTune;
};

/** Boat speed (kn) through the water in 15 kn of true wind at four points of sail, and pointing. */
export type PolarTune = {
  /** Closest useful angle to the true wind, degrees (the no-go edge). */
  pointingDeg: number;
  closeHauledKn: number;
  closeReachKn: number;
  beamKn: number;
  runKn: number;
};

/** Angles the tune numbers are for (close-hauled is at the pointing angle). */
export const TUNE_ANGLES = { closeReach: 60, beam: 90, run: 180 } as const;

export const BOAT_TYPES: { id: BoatType; label: string }[] = [
  { id: "mono", label: "Monohull" },
  { id: "catamaran", label: "Catamaran" },
  { id: "motor", label: "Motor boat" },
];

/** Saved settings from older versions ("cruiser", "performance") read as a monohull. */
export function readBoatType(v: unknown): BoatType {
  return v === "catamaran" || v === "motor" ? v : "mono";
}

export function isSail(type: BoatType): boolean {
  return type !== "motor";
}

const TWA = [40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180];
const TWS = [4, 6, 8, 10, 12, 14, 16, 20, 25, 30];
// Reference cruising monohull, LWL ≈ 10.5 m. Rows: TWS. Columns: TWA. Knots.
const CRUISER: number[][] = [
  [2.4, 2.9, 3.2, 3.5, 3.6, 3.5, 3.3, 2.9, 2.4, 2.0, 1.8],
  [3.6, 4.3, 4.6, 5.0, 5.1, 5.0, 4.8, 4.4, 3.8, 3.3, 3.0],
  [4.6, 5.4, 5.7, 6.1, 6.2, 6.1, 5.9, 5.5, 4.9, 4.3, 4.0],
  [5.3, 6.0, 6.3, 6.7, 6.9, 6.9, 6.8, 6.4, 5.8, 5.2, 4.9],
  [5.7, 6.4, 6.7, 7.0, 7.2, 7.3, 7.2, 7.0, 6.5, 5.9, 5.6],
  [5.9, 6.6, 6.9, 7.2, 7.4, 7.6, 7.6, 7.4, 7.0, 6.5, 6.2],
  [6.0, 6.7, 7.0, 7.3, 7.6, 7.8, 7.9, 7.8, 7.4, 7.0, 6.7],
  [6.0, 6.8, 7.1, 7.4, 7.8, 8.1, 8.3, 8.3, 8.0, 7.6, 7.3],
  [5.8, 6.6, 7.0, 7.4, 7.8, 8.2, 8.5, 8.7, 8.5, 8.1, 7.8],
  [5.2, 6.2, 6.6, 7.1, 7.6, 8.0, 8.3, 8.6, 8.6, 8.3, 8.0],
];
const REF_LWL = 10.5;

/** Closest a type can sail to the true wind, degrees. */
export function noGoDeg(type: BoatType | BoatPerf): number {
  if (typeof type !== "string") return type.tune ? Math.max(20, Math.min(60, type.tune.pointingDeg)) : noGoDeg(type.type);
  return type === "catamaran" ? 45 : 40;
}

function lwl(p: BoatPerf): number {
  return p.loaM * (p.type === "catamaran" ? 0.95 : 0.87);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function bracket(xs: number[], x: number): [number, number, number] {
  if (x <= xs[0]!) return [0, 0, 0];
  const last = xs.length - 1;
  if (x >= xs[last]!) return [last, last, 0];
  let i = 0;
  while (xs[i + 1]! < x) i += 1;
  return [i, i + 1, (x - xs[i]!) / (xs[i + 1]! - xs[i]!)];
}

/** Table speed for the reference cruiser, bilinear. TWA below 40° returns the 40° value. */
function table(tws: number, twa: number): number {
  if (tws <= 0) return 0;
  const [r0, r1, rt] = bracket(TWS, tws);
  const [c0, c1, ct] = bracket(TWA, twa);
  const top = lerp(CRUISER[r0]![c0]!, CRUISER[r0]![c1]!, ct);
  const bot = lerp(CRUISER[r1]![c0]!, CRUISER[r1]![c1]!, ct);
  // Below the lowest row, fade to zero.
  const base = lerp(top, bot, rt);
  return tws < TWS[0]! ? base * (tws / TWS[0]!) : base;
}

/** Built-in speed for the hull type and length (no tune, no learning), before gale reefing. */
function baseSpeed(p: BoatPerf, twsKn: number, twa: number): number {
  const scale = Math.sqrt(lwl(p) / REF_LWL);
  let v = table(twsKn, Math.max(40, twa)) * scale;
  if (p.type === "catamaran") v *= twa < 70 ? 0.92 : 1.15;
  return v;
}

/** What the built-in polar gives in 15 kn of wind at the tune angles (defaults for the settings). */
export function defaultTune(p: BoatPerf): PolarTune {
  const r = (twa: number) => Math.round(baseSpeed(p, 15, twa) * 10) / 10;
  const pointing = noGoDeg(p.type);
  return { pointingDeg: pointing, closeHauledKn: r(pointing + 5), closeReachKn: r(60), beamKn: r(90), runKn: r(180) };
}

/**
 * Scale the built-in shape so it matches the skipper's numbers at 15 kn: the ratio user ÷ built-in
 * at each tune angle, blended linearly between angles, applied at every wind speed.
 */
export function tuneFactor(p: BoatPerf, twa: number): number {
  const t = p.tune!;
  const pts: Array<[number, number]> = [
    [t.pointingDeg, t.closeHauledKn / Math.max(0.1, baseSpeed(p, 15, t.pointingDeg + 5))],
    [TUNE_ANGLES.closeReach, t.closeReachKn / Math.max(0.1, baseSpeed(p, 15, 60))],
    [TUNE_ANGLES.beam, t.beamKn / Math.max(0.1, baseSpeed(p, 15, 90))],
    [TUNE_ANGLES.run, t.runKn / Math.max(0.1, baseSpeed(p, 15, 180))],
  ];
  pts.sort((a, b) => a[0] - b[0]);
  if (twa <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) {
    const [a, fa] = pts[i - 1]!;
    const [b, fb] = pts[i]!;
    if (twa <= b) return fa + ((fb - fa) * (twa - a)) / Math.max(1, b - a);
  }
  return pts[pts.length - 1]![1];
}

/** Sailing speed through the water (knots). 0 inside the no-go zone. */
export function sailSpeed(p: BoatPerf, twsKn: number, twaDeg: number): number {
  if (p.type === "motor") return 0;
  const twa = Math.abs(((twaDeg + 540) % 360) - 180);
  if (twa < noGoDeg(p)) return 0;
  let v = baseSpeed(p, twsKn, twa);
  if (p.tune) v *= tuneFactor(p, twa);
  // Reefed hard in a gale.
  if (twsKn > 30) v *= Math.max(0.6, 1 - (twsKn - 30) * 0.03);
  return p.learned ? v * learnedFactor(p.learned, twsKn, twa) : v;
}

export type Speed = { stwKn: number; motoring: boolean };

/**
 * Speed with the engine rules applied, like the motoring settings in most routing
 * software:
 *   - wind below `motorWindBelowKn`: motor;
 *   - predicted sailing speed below `motorBelowKn`: motor, except that inside the
 *     no-go zone the boat tacks unless `motorOnNose` is set.
 * Motor-sailing never makes the boat slower than sailing alone.
 */
export function boatSpeed(p: BoatPerf, twsKn: number, twaDeg: number): Speed {
  if (p.type === "motor") return { stwKn: p.motorKn, motoring: true };
  const sail = sailSpeed(p, twsKn, twaDeg);
  const twa = Math.abs(((twaDeg + 540) % 360) - 180);
  const onNose = twa < noGoDeg(p);
  const motor = { stwKn: Math.max(sail, p.motorKn), motoring: true };
  if ((p.motorWindBelowKn ?? 0) > 0 && twsKn < p.motorWindBelowKn!) return motor;
  if (p.motorBelowKn > 0 && sail < p.motorBelowKn) {
    // In a breeze, a sailor tacks rather than motoring into the no-go zone.
    if (!onNose || p.motorOnNose || sailSpeed(p, twsKn, 90) < p.motorBelowKn) return motor;
  }
  return { stwKn: sail, motoring: false };
}

/**
 * Speed lost to waves. Head seas cost most, beam seas about half, following seas
 * little. `relDeg` is the angle between the boat's heading and where waves come from
 * (0 = waves on the bow).
 */
export function waveFactor(waveM: number, relDeg: number, loaM: number, motorKn = 0): number {
  if (!(waveM > 0.3)) return 1;
  const rel = Math.abs(((relDeg + 540) % 360) - 180);
  if (motorKn > 0) {
    // Motor boats: a fast boat has to throttle back much more in a head sea (it slams),
    // a displacement boat at 6–8 kn loses about as much as a yacht.
    const aspect = rel < 60 ? 1 : rel < 120 ? 0.45 : 0.25;
    const fast = Math.min(2.5, Math.max(1, motorKn / 8));
    return Math.max(0.3, 1 - 1.2 * fast * (waveM / Math.max(4, loaM)) * aspect);
  }
  const aspect = rel < 60 ? 1 : rel < 120 ? 0.5 : 0.2;
  return Math.max(0.4, 1 - 1.2 * (waveM / Math.max(4, loaM)) * aspect);
}
