import { fetchField, ROUTE_MODELS } from "./routing/fetch-field.ts";
import type { WeatherField } from "./routing/field.ts";
import type { BBox } from "./routing/land.ts";
import { loadActivePassage } from "./routing/passage-store.ts";
import { kvDel, kvGet, kvSet } from "./kv.ts";
import { viewGrid } from "./wx-map.ts";

const FRESH_MS = 30 * 60_000;
const KEEP_MS = 3 * 24 * 3_600_000;
const mem = new Map<string, WeatherField>();

export type ViewField = { field: WeatherField; source: "live" | "saved" | "passage" };

const INDEX = "wx:view:index";
type IndexRow = { key: string; south: number; west: number; north: number; east: number; at: number };

async function remember(key: string, f: WeatherField) {
  const rows = ((await kvGet<IndexRow[]>(INDEX).catch(() => undefined)) ?? []).filter((r) => r.key !== key);
  rows.unshift({
    key,
    south: f.lat0,
    west: f.lng0,
    north: f.lat0 + (f.ny - 1) * f.dLat,
    east: f.lng0 + (f.nx - 1) * f.dLng,
    at: f.fetchedAt ?? Date.now(),
  });
  const keep = rows.slice(0, 24);
  for (const old of rows.slice(24)) void kvDel(old.key).catch(() => undefined);
  await kvSet(INDEX, keep);
}

/** Any saved grid (newest first) that covers the view. */
async function savedCovering(b: BBox, now: number): Promise<WeatherField | null> {
  const rows = (await kvGet<IndexRow[]>(INDEX).catch(() => undefined)) ?? [];
  for (const r of rows) {
    if (now - r.at > KEEP_MS) continue;
    if (r.south <= b.south && r.north >= b.north && r.west <= b.west && r.east >= b.east) {
      const f = await kvGet<WeatherField>(r.key).catch(() => undefined);
      if (f) return f;
    }
  }
  return null;
}

/** Download and keep the weather grid for an area (offline packs). */
export async function saveAreaWeather(b: BBox): Promise<boolean> {
  const grid = viewGrid(b);
  const key = `wx:view:${grid.key}`;
  try {
    const field = await fetchField(grid, ROUTE_MODELS[0]!, 3);
    mem.set(key, field);
    await kvSet(key, field);
    await remember(key, field);
    return true;
  } catch {
    return false;
  }
}

function covers(f: WeatherField, b: BBox): boolean {
  const north = f.lat0 + (f.ny - 1) * f.dLat;
  const east = f.lng0 + (f.nx - 1) * f.dLng;
  return f.lat0 <= b.south && north >= b.north && f.lng0 <= b.west && east >= b.east;
}

/**
 * Weather grid for the chart view (3 days, main model). Recent downloads are reused; each
 * download is kept on the phone so the layers still play offline. With no signal, falls back
 * to a saved download for the area, then to the saved passage's forecast.
 */
export async function loadViewField(b: BBox): Promise<ViewField | null> {
  const grid = viewGrid(b);
  const key = `wx:view:${grid.key}`;
  const now = Date.now();
  const hit = mem.get(key);
  if (hit && now - (hit.fetchedAt ?? 0) < FRESH_MS) return { field: hit, source: "live" };
  try {
    const field = await fetchField(grid, ROUTE_MODELS[0]!, 3);
    mem.set(key, field);
    void kvSet(key, field)
      .then(() => remember(key, field))
      .catch(() => undefined);
    return { field, source: "live" };
  } catch {
    const saved = hit ?? (await kvGet<WeatherField>(key).catch(() => undefined)) ?? (await savedCovering(b, now));
    if (saved && now - (saved.fetchedAt ?? 0) < KEEP_MS) {
      mem.set(key, saved);
      return { field: saved, source: "saved" };
    }
    const passage = await loadActivePassage();
    const pf = passage?.fields[0];
    if (pf && covers(pf, b)) return { field: pf, source: "passage" };
    return null;
  }
}
