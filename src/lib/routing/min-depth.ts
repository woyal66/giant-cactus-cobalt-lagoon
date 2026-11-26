/**
 * How deep the water must be for the router (it blocks cells shallower than this, by the depth
 * model at mean sea level). The skipper's own figure, or draft + 1 m; and, when asked, measured
 * at the lowest tide, so a route clear at mid-tide doesn't ground at low water.
 */
export type DepthRule = { minDepthM: number | null; depthAt: "msl" | "low" };

/** Margin under the keel when the skipper hasn't set a depth. */
export const AUTO_MARGIN_M = 1;

export function wantedDepthM(rule: DepthRule, draftM: number): number {
  return rule.minDepthM ?? draftM + AUTO_MARGIN_M;
}

/**
 * The depth the router checks against at mean sea level. `lowestTideM` is the lowest tide below
 * mean sea level at the start (negative), or null when unknown (then mean sea level is used).
 */
export function mslLimitM(rule: DepthRule, draftM: number, lowestTideM: number | null): number {
  const want = wantedDepthM(rule, draftM);
  if (rule.depthAt !== "low" || lowestTideM == null || !Number.isFinite(lowestTideM)) return want;
  return Math.round((want + Math.max(0, -lowestTideM)) * 10) / 10;
}

/** The lowest tide over the next year at a spot, from the EOT20 model (null offline / no data). */
export async function lowestTideAt(lat: number, lng: number): Promise<number | null> {
  try {
    const { tideConstants, lowestTide } = await import("../tide-model.ts");
    const c = await tideConstants(lat, lng);
    return c ? lowestTide(c.k, Date.now()) : null;
  } catch {
    return null;
  }
}
