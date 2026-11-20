/** Civil sunrise/sunset (sun 50′ below horizon). Times are UTC ms. */

const D2R = Math.PI / 180;
const ZENITH = 90.833;

function sind(d: number): number {
  return Math.sin(d * D2R);
}
function cosd(d: number): number {
  return Math.cos(d * D2R);
}

function wrap360(d: number): number {
  return ((d % 360) + 360) % 360;
}

function utcMidnight(at: number): number {
  const d = new Date(at);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** NOAA sunrise/sunset for the UTC calendar day containing `at`. */
export function sunRiseSet(
  lat: number,
  lng: number,
  at: number,
): { rise: number; set: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const d = new Date(utcMidnight(at));
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const N1 = Math.floor((275 * m) / 9);
  const N2 = Math.floor((m + 9) / 12);
  const N3 = 1 + Math.floor((y - 4 * Math.floor(y / 4) + 2) / 3);
  const N = N1 - N2 * N3 + day - 30;
  const lngHour = lng / 15;

  const event = (rising: boolean): number | null => {
    const t = N + ((rising ? 6 : 18) - lngHour) / 24;
    const M = wrap360(0.9856 * t - 3.289);
    const L = wrap360(M + 1.916 * sind(M) + 0.02 * sind(2 * M) + 282.634);
    let ra = wrap360(Math.atan(0.91764 * Math.tan(L * D2R)) / D2R);
    const lq = Math.floor(L / 90) * 90;
    const rq = Math.floor(ra / 90) * 90;
    ra = (ra + (lq - rq)) / 15;
    const sinDec = 0.39782 * sind(L);
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH =
      (cosd(ZENITH) - sinDec * sind(lat)) / (cosDec * cosd(lat));
    if (cosH > 1 || cosH < -1) return null;
    let H = Math.acos(Math.min(1, Math.max(-1, cosH))) / D2R;
    if (rising) H = 360 - H;
    H /= 15;
    const T = H + ra - 0.06571 * t - 6.622;
    let ut = T - lngHour;
    ut = ((ut % 24) + 24) % 24;
    return Date.UTC(y, m - 1, day) + ut * 3_600_000;
  };

  const rise = event(true);
  const set = event(false);
  if (rise == null || set == null) return null;
  return { rise, set };
}

export type NightSpan = { start: number; end: number };

/** Night intervals overlapping [t0, tEnd], from this lat/lng. */
export function nightSpans(
  lat: number,
  lng: number,
  t0: number,
  tEnd: number,
): NightSpan[] {
  const out: NightSpan[] = [];
  const first = utcMidnight(t0) - 86_400_000;
  const last = utcMidnight(tEnd) + 86_400_000;
  for (let day = first; day <= last; day += 86_400_000) {
    const sun = sunRiseSet(lat, lng, day);
    if (!sun) continue;
    let start: number;
    let end: number;
    if (sun.set < sun.rise) {
      start = sun.set;
      end = sun.rise;
    } else {
      const next = sunRiseSet(lat, lng, day + 86_400_000);
      start = sun.set;
      end = next?.rise ?? sun.set + 86_400_000;
      if (end <= start) end += 86_400_000;
    }
    const a = Math.max(start, t0);
    const b = Math.min(end, tEnd);
    if (b > a + 60_000) out.push({ start: a, end: b });
  }
  return out;
}

export function isDaylight(lat: number, lng: number, at: number): boolean {
  const sun = sunRiseSet(lat, lng, at);
  if (!sun) {
    const near = sunRiseSet(lat, lng, at - 86_400_000) ?? sunRiseSet(lat, lng, at + 86_400_000);
    if (!near) return true;
    return at >= near.rise && at < near.set;
  }
  if (sun.rise <= sun.set) return at >= sun.rise && at < sun.set;
  return at >= sun.rise || at < sun.set;
}

export function sunMarks(
  lat: number,
  lng: number,
  t0: number,
  tEnd: number,
): Array<{ at: number; kind: "rise" | "set" }> {
  const out: Array<{ at: number; kind: "rise" | "set" }> = [];
  const first = utcMidnight(t0) - 86_400_000;
  const last = utcMidnight(tEnd) + 86_400_000;
  for (let day = first; day <= last; day += 86_400_000) {
    const sun = sunRiseSet(lat, lng, day);
    if (!sun) continue;
    if (sun.rise >= t0 && sun.rise <= tEnd) out.push({ at: sun.rise, kind: "rise" });
    if (sun.set >= t0 && sun.set <= tEnd) out.push({ at: sun.set, kind: "set" });
  }
  return out;
}
