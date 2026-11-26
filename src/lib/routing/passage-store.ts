/**
 * The active passage, saved on the phone with the forecast it was planned on, so
 * re-routing, the next-hours strip and the arrival forecast work offshore with
 * no signal.
 */
import type { LatLng } from "../geo.ts";
import { kvDel, kvGet, kvSet } from "../kv.ts";
import type { WeatherField } from "./field.ts";
import type { BBox } from "./land.ts";
import type { BoatPerf } from "./polar.ts";
import type { Limits, RouteMode, RoutePoint, RouteRules } from "./router.ts";

export type SavedPassage = {
  id: string;
  title: string;
  start: LatLng;
  finish: LatLng;
  /** The skipper's turning points, kept for re-routing underway. */
  via?: LatLng[];
  mode: RouteMode;
  departAt: number;
  arriveAt: number;
  points: RoutePoint[];
  boat: BoatPerf;
  limits: Limits;
  rules: RouteRules;
  models: string[];
  fields: WeatherField[];
  box: BBox;
  /** When the forecast was downloaded. */
  forecastAt: number;
  savedAt: number;
};

const KEY = "passage:active";

export function saveActivePassage(p: SavedPassage): Promise<void> {
  return kvSet(KEY, p);
}

export function loadActivePassage(): Promise<SavedPassage | undefined> {
  return kvGet<SavedPassage>(KEY).catch(() => undefined);
}

export function clearActivePassage(): Promise<void> {
  return kvDel(KEY).catch(() => undefined);
}

/** "9 h old" style age of a saved forecast. */
export function forecastAge(at: number, now = Date.now()): string {
  const h = Math.max(0, (now - at) / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min old`;
  if (h < 48) return `${Math.round(h)} h old`;
  return `${Math.round(h / 24)} days old`;
}
