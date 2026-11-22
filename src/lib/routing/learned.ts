/**
 * Learned polar: how fast this boat actually sails compared with its built-in polar,
 * kept as a ratio per true wind speed and angle bin. Clean samples only: sailing (engine
 * off), steady course and speed, sensible wind. Stays on the phone and goes in backups.
 */
export const TWS_BINS = [4, 6, 8, 10, 12, 14, 16, 20, 25, 30] as const;
export const TWA_BINS = [30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180] as const;
/** Samples a bin needs before the router trusts it. */
export const MIN_SAMPLES = 20;
const MAX_WEIGHT = 200;

export type LearnedBin = { n: number; ratio: number };
export type LearnedPolar = { bins: Record<string, LearnedBin>; samples: number };

export const EMPTY_LEARNED: LearnedPolar = { bins: {}, samples: 0 };

const nearest = (bins: readonly number[], v: number) =>
  bins.reduce((best, b) => (Math.abs(b - v) < Math.abs(best - v) ? b : best), bins[0]);

export function binKey(twsKn: number, twaDeg: number): string {
  const twa = Math.abs(((twaDeg + 540) % 360) - 180);
  return `${nearest(TWS_BINS, twsKn)}|${nearest(TWA_BINS, twa)}`;
}

export type Sample = {
  twsKn: number;
  twaDeg: number;
  stwKn: number;
  polarKn: number;
  engineOn: boolean;
  /** Course change over the last minute (degrees). */
  turnDeg: number;
  /** Speed change over the last minute (knots). */
  speedChangeKn: number;
};

/** Whether a sample is clean enough to learn from. */
export function isCleanSample(s: Sample): boolean {
  if (s.engineOn) return false;
  if (!(s.twsKn >= 4 && s.twsKn <= 32)) return false;
  if (!(s.polarKn > 1 && s.stwKn > 1)) return false;
  if (Math.abs(s.turnDeg) > 10 || Math.abs(s.speedChangeKn) > 1) return false;
  const r = s.stwKn / s.polarKn;
  return r > 0.4 && r < 1.6;
}

/** Adds a clean sample: a running mean, then a slow moving average once a bin is well filled. */
export function addSample(lp: LearnedPolar, s: Sample): LearnedPolar {
  if (!isCleanSample(s)) return lp;
  const k = binKey(s.twsKn, s.twaDeg);
  const b = lp.bins[k] ?? { n: 0, ratio: 1 };
  const n = Math.min(MAX_WEIGHT, b.n + 1);
  const ratio = b.ratio + (s.stwKn / s.polarKn - b.ratio) / n;
  return { bins: { ...lp.bins, [k]: { n: b.n + 1, ratio } }, samples: lp.samples + 1 };
}

/** Speed factor for the router (1 when the bin has too few samples). */
export function learnedFactor(lp: LearnedPolar | undefined, twsKn: number, twaDeg: number): number {
  const b = lp?.bins[binKey(twsKn, twaDeg)];
  if (!b || b.n < MIN_SAMPLES) return 1;
  return Math.min(1.3, Math.max(0.6, b.ratio));
}

export function readLearned(v: unknown): LearnedPolar {
  const p = v as Partial<LearnedPolar> | null;
  if (!p || typeof p !== "object" || !p.bins || typeof p.bins !== "object") return EMPTY_LEARNED;
  const bins: Record<string, LearnedBin> = {};
  for (const [k, b] of Object.entries(p.bins)) {
    if (/^\d+\|\d+$/.test(k) && b && Number.isFinite(b.n) && Number.isFinite(b.ratio) && b.n > 0) {
      bins[k] = { n: Math.round(b.n), ratio: Math.min(2, Math.max(0.2, b.ratio)) };
    }
  }
  return { bins, samples: Number.isFinite(p.samples) ? Math.max(0, Math.round(p.samples!)) : 0 };
}

/** One-line insight from the learned bins (needs a few filled bins). */
export function polarInsight(lp: LearnedPolar): string | null {
  const filled = Object.entries(lp.bins).filter(([, b]) => b.n >= MIN_SAMPLES);
  if (filled.length < 3) return null;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const all = avg(filled.map(([, b]) => b.ratio));
  const up = filled.filter(([k]) => Number(k.split("|")[1]) <= 60).map(([, b]) => b.ratio);
  const down = filled.filter(([k]) => Number(k.split("|")[1]) > 60).map(([, b]) => b.ratio);
  if (all < 0.88 && (!up.length || !down.length || Math.abs(avg(up) - avg(down)) < 0.06)) {
    return `About ${Math.round((1 - all) * 100)}% under the polar at all angles: check for hull or propeller fouling, or the polar is optimistic.`;
  }
  if (up.length && down.length && avg(up) < avg(down) - 0.08) {
    return "Slower upwind than off the wind: look at sail trim and sail choice upwind.";
  }
  if (all > 1.08) return `About ${Math.round((all - 1) * 100)}% over the polar: the built-in polar is pessimistic for this boat.`;
  return null;
}

/**
 * Speed and heading through the water from GPS speed and course over ground, minus the
 * current (`curDir` is where it sets toward). Without a compass, heading is the water track.
 */
export function throughWater(sogKn: number, cogDeg: number, curKn: number, curDir: number): { stwKn: number; headingDeg: number } {
  const r = Math.PI / 180;
  const x = sogKn * Math.sin(cogDeg * r) - curKn * Math.sin(curDir * r);
  const y = sogKn * Math.cos(cogDeg * r) - curKn * Math.cos(curDir * r);
  return { stwKn: Math.hypot(x, y), headingDeg: ((Math.atan2(x, y) / r) + 360) % 360 };
}

/** Live speed against the polar, for the display. */
export type PerfLive = {
  pct: number;
  stwKn: number;
  polarKn: number;
  twsKn: number;
  twaDeg: number;
  source: string;
  learning: boolean;
};
