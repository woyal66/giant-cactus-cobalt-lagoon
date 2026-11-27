/**
 * Course and speed over ground from successive fixes, for phones that don't send them (most
 * browsers, and many phones at slow speed). The boat must move further than the GPS noise
 * before a course is taken, so a boat lying still doesn't spin on the chart.
 */
import { bearingDegrees, haversineMeters, type LatLng } from "./geo.ts";

export type CourseRef = { lat: number; lng: number; at: number; headingDeg: number | null; speedMs: number };

/**
 * Next course estimate. `ref` is the last point a course was taken from (null at first).
 * Returns the new ref (keep it for the next fix) and the heading and speed to use.
 */
export function courseFromFixes(
  ref: CourseRef | null,
  fix: LatLng & { at: number; accuracy?: number | null },
): CourseRef {
  if (!ref) return { lat: fix.lat, lng: fix.lng, at: fix.at, headingDeg: null, speedMs: 0 };
  const dt = (fix.at - ref.at) / 1000;
  if (dt <= 0) return ref;
  const d = haversineMeters(ref, fix);
  // Moved clearly more than the fix could wander: that's real way.
  const noise = Math.max(3, (fix.accuracy != null && Number.isFinite(fix.accuracy) ? fix.accuracy : 5) * 0.6);
  if (d >= noise) {
    return { lat: fix.lat, lng: fix.lng, at: fix.at, headingDeg: bearingDegrees(ref, fix), speedMs: d / dt };
  }
  // Barely moved for a while: stopped (keep the last course so the hull doesn't spin).
  if (dt > 15) return { lat: fix.lat, lng: fix.lng, at: fix.at, headingDeg: ref.headingDeg, speedMs: 0 };
  return ref;
}
