/**
 * Wind over tide: waves running into an opposing current slow down, shorten and
 * grow, so they "stand up". Deep-water linear theory (Longuet-Higgins & Stewart,
 * 1961) gives, for a current U along the wave direction (negative = opposing):
 *
 *   c / c0 = ½ (1 + √(1 + 4U/c0))        phase speed in the current
 *   H / H0 = c0 / √(c (c + 2U))          height change
 *   L / L0 = (c / c0)²                   wavelength change
 *
 * with c0 = gT / 2π. When 1 + 4U/c0 ≤ 0 the current blocks the waves and they
 * break. Linear theory overstates the growth (Peregrine & Thomas, 1979), so the
 * extra height is damped by 30% and capped at 2×.
 */
const G = 9.81;
const KN = 0.514444;
const DAMP = 0.7;
const CAP = 2;

export type WaveEffect = {
  /** Height after the current, metres. */
  heightM: number;
  /** Height multiplier (1 = no change, >1 = standing up). */
  amp: number;
  /** Steepness multiplier (height ÷ wavelength), the part you feel as "short and steep". */
  steep: number;
  /** Current strong enough to stop the waves: breaking seas. */
  blocked: boolean;
};

/** Rough period for a wind sea when the model gives none. */
export function guessPeriod(waveM: number): number {
  return Math.max(3, 3.9 * Math.sqrt(Math.max(0.1, waveM)));
}

/** Current speed (m/s) along the direction the waves travel. Waves come FROM waveDir. */
export function currentAlongWaves(curKn: number, curDirToward: number, waveDirFrom: number): number {
  const travel = (waveDirFrom + 180) % 360;
  return curKn * KN * Math.cos(((curDirToward - travel) * Math.PI) / 180);
}

export function waveInCurrent(periodS: number, uMs: number): { amp: number; steep: number; blocked: boolean } {
  const c0 = (G * periodS) / (2 * Math.PI);
  const r = 1 + (4 * uMs) / c0;
  if (r <= 0) return { amp: CAP, steep: CAP * 2, blocked: true };
  const c = (c0 * (1 + Math.sqrt(r))) / 2;
  const d = c * (c + 2 * uMs);
  if (d <= 0) return { amp: CAP, steep: CAP * 2, blocked: true };
  const raw = c0 / Math.sqrt(d);
  const amp = Math.min(CAP, 1 + DAMP * (raw - 1));
  const lenRatio = (c / c0) ** 2;
  return { amp, steep: Math.min(CAP * 2, amp / lenRatio), blocked: false };
}

export function effectiveWave(
  waveM: number,
  periodS: number,
  waveDirFrom: number,
  curKn: number,
  curDirToward: number,
): WaveEffect {
  if (!(waveM > 0.05) || !(curKn > 0.1)) return { heightM: Math.max(0, waveM), amp: 1, steep: 1, blocked: false };
  const T = periodS > 0 ? periodS : guessPeriod(waveM);
  const w = waveInCurrent(T, currentAlongWaves(curKn, curDirToward, waveDirFrom));
  return { heightM: waveM * w.amp, amp: w.amp, steep: w.steep, blocked: w.blocked };
}
