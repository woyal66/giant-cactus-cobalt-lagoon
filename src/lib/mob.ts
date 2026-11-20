/**
 * Man-overboard drift. A person in the water moves almost entirely with the
 * current, plus a small push downwind (leeway). LEEWAY_FRACTION is an initial
 * figure in the range of published search-and-rescue leeway data for a person in
 * the water; calibrate against those tables before release.
 */
import { destPoint, type LatLng } from "./geo.ts";

export const LEEWAY_FRACTION = 0.015;
const KN_TO_MS = 0.514444;

export type DriftInputs = {
  curKn: number;
  /** Direction the current sets TOWARD. */
  curDir: number;
  windKn: number;
  /** Direction the wind blows FROM. */
  windDir: number;
};

export type DriftPoint = LatLng & { minutes: number; radiusM: number };

/** Where the person is likely to be after `minutes`, with an uncertainty radius. */
export function driftAt(mob: LatLng, minutes: number, d: DriftInputs): DriftPoint {
  const s = minutes * 60;
  const cr = (d.curDir * Math.PI) / 180;
  const lr = (((d.windDir + 180) % 360) * Math.PI) / 180;
  const leewayKn = d.windKn * LEEWAY_FRACTION;
  const x = (d.curKn * Math.sin(cr) + leewayKn * Math.sin(lr)) * KN_TO_MS * s;
  const y = (d.curKn * Math.cos(cr) + leewayKn * Math.cos(lr)) * KN_TO_MS * s;
  const dist = Math.hypot(x, y);
  const brg = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  const p = dist > 0.01 ? destPoint(mob, brg, dist) : { lat: mob.lat, lng: mob.lng };
  // Uncertainty: the mark itself (~20 m), plus a share of the drift, plus spread over time.
  const radiusM = 20 + 0.3 * dist + minutes * 3;
  return { ...p, minutes, radiusM };
}

export function driftCone(mob: LatLng, d: DriftInputs, marks = [5, 10, 20]): DriftPoint[] {
  return marks.map((m) => driftAt(mob, m, d));
}

/** Degrees and decimal minutes, the format read over VHF: 23°54.24'S 152°23.70'E. */
export function formatDmm(lat: number, lng: number): string {
  const part = (v: number, pos: string, neg: string, width: number) => {
    const a = Math.abs(v);
    const deg = Math.floor(a);
    const min = (a - deg) * 60;
    return `${String(deg).padStart(width, "0")}°${min.toFixed(2).padStart(5, "0")}'${v >= 0 ? pos : neg}`;
  };
  return `${part(lat, "N", "S", 2)} ${part(lng, "E", "W", 3)}`;
}
