/**
 * Display units. Everything is stored and computed in metres; these helpers only
 * convert for display and for the input dials, so the alarm maths never changes
 * with the setting.
 *   depth:  water depth, tide heights, draft, wave height (m | ft | fathoms)
 *   length: chain, layback, swing circle, distances under 1 km (m | ft)
 * Distances of 1 km or more are always nautical miles.
 */
export type DepthUnit = "m" | "ft" | "fm";
export type LengthUnit = "m" | "ft";

export const M_PER_FT = 0.3048;
export const M_PER_FM = 1.8288;

let depthUnit: DepthUnit = "m";
let lengthUnit: LengthUnit = "m";

export function isDepthUnit(v: unknown): v is DepthUnit {
  return v === "m" || v === "ft" || v === "fm";
}

export function isLengthUnit(v: unknown): v is LengthUnit {
  return v === "m" || v === "ft";
}

export function setUnits(u: { depth?: DepthUnit; length?: LengthUnit }) {
  if (u.depth) depthUnit = u.depth;
  if (u.length) lengthUnit = u.length;
}

export function getUnits(): { depth: DepthUnit; length: LengthUnit } {
  return { depth: depthUnit, length: lengthUnit };
}

/* ---------- depth ---------- */

export function toDepth(m: number, unit: DepthUnit = depthUnit): number {
  return unit === "ft" ? m / M_PER_FT : unit === "fm" ? m / M_PER_FM : m;
}

export function fromDepth(v: number, unit: DepthUnit = depthUnit): number {
  return unit === "ft" ? v * M_PER_FT : unit === "fm" ? v * M_PER_FM : v;
}

export function depthSuffix(unit: DepthUnit = depthUnit): string {
  return unit === "fm" ? "fm" : unit;
}

/** "8.0 m", "26 ft", "4.4 fm". Feet are whole numbers; metres and fathoms one decimal. */
export function formatDepth(m: number, opts?: { signed?: boolean; unit?: DepthUnit }): string {
  const unit = opts?.unit ?? depthUnit;
  const v = toDepth(m, unit);
  const n = unit === "ft" ? Math.round(v).toString() : (Math.round(v * 10) / 10).toFixed(1);
  const neg = n.startsWith("-");
  const body = neg ? n.slice(1) : n;
  const isZero = Number(body) === 0;
  const sign = opts?.signed ? (isZero ? "" : neg ? "−" : "+") : neg ? "−" : "";
  return `${sign}${body} ${depthSuffix(unit)}`;
}

/** Wheel range and step for picking a depth in the current unit. */
export function depthWheel(unit: DepthUnit = depthUnit): { min: number; max: number; step: number } {
  if (unit === "ft") return { min: 1, max: 130, step: 1 };
  if (unit === "fm") return { min: 0.5, max: 22, step: 0.5 };
  return { min: 0.2, max: 40, step: 0.2 };
}

/* ---------- length ---------- */

export function toLength(m: number, unit: LengthUnit = lengthUnit): number {
  return unit === "ft" ? m / M_PER_FT : m;
}

export function fromLength(v: number, unit: LengthUnit = lengthUnit): number {
  return unit === "ft" ? v * M_PER_FT : v;
}

export function lengthSuffix(unit: LengthUnit = lengthUnit): string {
  return unit;
}

/** Whole metres or whole feet: "45 m", "148 ft". */
export function formatLength(m: number, unit: LengthUnit = lengthUnit): string {
  return `${Math.round(toLength(Math.abs(m), unit))} ${unit}`;
}

/** Chain wheel range and step in the current unit. */
export function lengthWheel(unit: LengthUnit = lengthUnit): { min: number; max: number; step: number } {
  if (unit === "ft") return { min: 0, max: 650, step: 5 };
  return { min: 0, max: 200, step: 1 };
}
