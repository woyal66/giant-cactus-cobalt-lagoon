/**
 * Moon for night arrivals: how bright it is, and when it is up.
 * A bright moon high in the sky lets you read reef colour and spot bommies;
 * no moon means a pass is radar-and-track only.
 */
import SunCalc from "suncalc";

export type MoonInfo = {
  /** 0..1 lit fraction of the disc. */
  illumination: number;
  /** 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
  phase: number;
  phaseName: string;
  waxing: boolean;
  /** Next rise and set after `at` within ~48 h, or null. */
  nextRise: number | null;
  nextSet: number | null;
  /** Up right now. */
  upNow: boolean;
};

const DAY = 86_400_000;

export function phaseName(phase: number): string {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.033 || p >= 0.967) return "New moon";
  if (p < 0.217) return "Waxing crescent";
  if (p < 0.283) return "First quarter";
  if (p < 0.467) return "Waxing gibbous";
  if (p < 0.533) return "Full moon";
  if (p < 0.717) return "Waning gibbous";
  if (p < 0.783) return "Last quarter";
  return "Waning crescent";
}

export function moonInfo(lat: number, lng: number, at = Date.now()): MoonInfo {
  const now = new Date(at);
  const ill = SunCalc.getMoonIllumination(now);
  const rises: number[] = [];
  const sets: number[] = [];
  for (let d = -1; d <= 2; d += 1) {
    const t = SunCalc.getMoonTimes(new Date(at + d * DAY), lat, lng);
    if (t.rise) rises.push(t.rise.getTime());
    if (t.set) sets.push(t.set.getTime());
  }
  const next = (xs: number[]) => xs.filter((x) => x > at).sort((a, b) => a - b)[0] ?? null;
  const pos = SunCalc.getMoonPosition(now, lat, lng);
  return {
    illumination: ill.fraction,
    phase: ill.phase,
    phaseName: phaseName(ill.phase),
    waxing: ill.phase < 0.5,
    nextRise: next(rises),
    nextSet: next(sets),
    upNow: pos.altitude > 0,
  };
}

/** One-line note for a night passage. */
export function moonNote(m: MoonInfo): string {
  const pct = Math.round(m.illumination * 100);
  if (pct <= 10) return "Dark night: little or no moon. Follow the track, not your eyes.";
  if (pct >= 70) return m.upNow ? "Bright moon up now: reef colour readable at night." : "Bright moon tonight once it rises.";
  return m.upNow ? "Some moonlight now." : "Part moon, not up yet.";
}
