/**
 * Storm and squall risk from model convective fields.
 *
 * Thunderstorm thresholds follow the industry convention of scaling CAPE with air
 * temperature (CAPE >= 1000 J/kg below 20 C, >= 2000 for 20-30 C, >= 3000 above
 * 30 C); lifted index and precipitation sharpen it; strong convective inhibition
 * (a "cap") holds storms back. A rain squall is >= 3 mm/h with gusts >= 25 kn.
 * Models place squalls poorly: treat this as "possible here", not "will happen".
 */
export type StormInputs = {
  capeJkg: number;
  /** Lifted index, °C (negative = unstable). NaN if the model has none. */
  liftedIndex: number;
  /** Convective inhibition, J/kg (positive). NaN if none. */
  cinJkg: number;
  precipMm: number;
  gustKn: number;
  tempC: number;
  /** WMO weather code; 95-99 are thunderstorms. */
  code: number;
};

export type Risk = 0 | 1 | 2 | 3;

export const RISK_LABEL: Record<Risk, string> = { 0: "None", 1: "Possible", 2: "Likely", 3: "Severe" };

export function capeThreshold(tempC: number): number {
  if (!Number.isFinite(tempC)) return 2000;
  return tempC < 20 ? 1000 : tempC <= 30 ? 2000 : 3000;
}

export function thunderRisk(s: StormInputs): Risk {
  const t = capeThreshold(s.tempC);
  const cape = Number.isFinite(s.capeJkg) ? s.capeJkg : 0;
  const li = s.liftedIndex;
  const thunderCode = s.code >= 95 && s.code <= 99;
  const wet = s.precipMm >= 1 || thunderCode;
  let r = 0;
  if (cape >= t || (Number.isFinite(li) && li <= -3 && s.precipMm >= 0.3) || thunderCode) r = 1;
  if ((cape >= t * 1.5 && wet) || (thunderCode && s.precipMm >= 1)) r = 2;
  if ((thunderCode && s.gustKn >= 35) || (cape >= 2500 && Number.isFinite(li) && li <= -6)) r = 3;
  if (r > 0 && Number.isFinite(s.cinJkg) && s.cinJkg >= 200) r -= 1;
  return r as Risk;
}

export function isSquall(s: Pick<StormInputs, "precipMm" | "gustKn">): boolean {
  return s.precipMm >= 3 && s.gustKn >= 25;
}

/** How the skipper wants a hazard handled in routing. */
export type Treat = "avoid" | "penalise" | "warn" | "ignore";

export const TREAT_LABEL: Record<Treat, string> = {
  avoid: "Avoid",
  penalise: "Prefer to avoid",
  warn: "Warn only",
  ignore: "Ignore",
};

export function isTreat(v: unknown): v is Treat {
  return v === "avoid" || v === "penalise" || v === "warn" || v === "ignore";
}
