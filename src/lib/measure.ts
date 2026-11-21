import { bearingDegrees, haversineMeters, type LatLng } from "./geo.ts";

export type MeasureLeg = { from: LatLng; to: LatLng; distM: number; bearing: number };

/** Legs, total and time at a speed for a measured line on the chart. */
export function measure(pts: LatLng[], speedKn = 0): { legs: MeasureLeg[]; totalM: number; hours: number | null } {
  const legs: MeasureLeg[] = [];
  for (let i = 1; i < pts.length; i += 1) {
    const from = pts[i - 1]!;
    const to = pts[i]!;
    legs.push({ from, to, distM: haversineMeters(from, to), bearing: bearingDegrees(from, to) });
  }
  const totalM = legs.reduce((n, l) => n + l.distM, 0);
  return { legs, totalM, hours: speedKn > 0 ? totalM / 1852 / speedKn : null };
}

export function formatDuration(hours: number): string {
  const m = Math.round(hours * 60);
  if (m < 60) return `${Math.max(1, m)} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

/** Route card figures: distance, time at a speed, and fuel at litres per hour (0 = no fuel line). */
export function routeSummary(pts: LatLng[], speedKn: number, fuelLph: number): { distM: number; hours: number | null; litres: number | null } {
  const m = measure(pts, speedKn);
  return { distM: m.totalM, hours: m.hours, litres: m.hours != null && fuelLph > 0 ? m.hours * fuelLph : null };
}
