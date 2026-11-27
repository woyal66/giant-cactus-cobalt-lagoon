/**
 * Compare forecasts: line several models up hour by hour and say how far apart they are.
 * When the models agree the forecast is more likely to be right; when they differ, plan for the
 * worst of them. Pure, so it is tested.
 */
export type ModelSeries<T> = { id: string; label: string; resKm?: number; hours: Array<T & { at: number }> };

/** The sample nearest `at` (within `tolMs`), or null. */
export function sampleAt<T extends { at: number }>(hours: T[], at: number, tolMs = 90 * 60_000): T | null {
  let best: T | null = null;
  for (const h of hours) if (!best || Math.abs(h.at - at) < Math.abs(best.at - at)) best = h;
  return best && Math.abs(best.at - at) <= tolMs ? best : null;
}

/** Column times: every `stepH` hours from the first whole step at or after `start`, for `hours`. */
export function columnTimes(start: number, hours: number, stepH: number): number[] {
  const H = 3_600_000;
  const d = new Date(start);
  d.setMinutes(0, 0, 0);
  let t = d.getTime();
  while (new Date(t).getHours() % stepH !== 0 || t < start - H / 2) t += H;
  const out: number[] = [];
  for (; t <= start + hours * H; t += stepH * H) out.push(t);
  return out;
}

export type Agreement = "good" | "fair" | "poor";

/** Spread (max − min) and how much to trust it. Wind in knots; waves in metres. */
export function spreadOf(values: number[], kind: "wind" | "wave" = "wind"): { spread: number; level: Agreement } | null {
  const v = values.filter((x) => Number.isFinite(x));
  if (v.length < 2) return null;
  const spread = Math.max(...v) - Math.min(...v);
  const [fair, poor] = kind === "wind" ? [5, 10] : [0.5, 1];
  return { spread, level: spread >= poor ? "poor" : spread >= fair ? "fair" : "good" };
}

/** Plain words for the whole run: where the models start to differ. */
export function agreementText(cols: Array<{ at: number; level: Agreement | null; spread: number }>, unit: (n: number) => string): string {
  const known = cols.filter((c) => c.level != null);
  if (!known.length) return "Only one model here, so there's nothing to compare.";
  const firstBad = known.find((c) => c.level !== "good");
  const worst = known.reduce((m, c) => (c.spread > m.spread ? c : m), known[0]!);
  const day = (at: number) => new Date(at).toLocaleDateString([], { weekday: "long" });
  if (!firstBad) return "The models agree well all the way: a forecast you can lean on.";
  if (firstBad === known[0]) {
    return `The models already differ now (up to ${unit(worst.spread)}): plan for the strongest of them.`;
  }
  return `The models agree until ${day(firstBad.at)}; after that they differ by up to ${unit(worst.spread)}, so trust it less.`;
}
