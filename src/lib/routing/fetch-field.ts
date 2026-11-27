/**
 * Fetch a weather field over the route corridor from Open-Meteo: wind and gust
 * from one model, plus waves and ocean current from the marine API, on a grid of
 * up to ~100 points (one request each, multi-location).
 */
import { haversineMeters, type LatLng } from "../geo.ts";
import { openMeteoUrl } from "../open-meteo.ts";
import type { WeatherField } from "./field.ts";
import type { BBox } from "./land.ts";

/** `fallback`: the model asked for when `param` comes back empty or short (ECMWF 9 km → 25 km). */
export type RouteModel = { id: string; label: string; param: string; fallback?: string; /** How far ahead it runs. */ days: number };

export const ROUTE_MODELS: RouteModel[] = [
  { id: "ecmwf", label: "ECMWF", param: "ecmwf_ifs", fallback: "ecmwf_ifs025", days: 15 },
  { id: "gfs", label: "GFS", param: "gfs_global", days: 16 },
  { id: "icon", label: "ICON", param: "icon_global", days: 7 },
  { id: "ukmo", label: "UKMO", param: "ukmo_global_deterministic_10km", days: 7 },
];

export type CorridorGrid = BBox & { lats: number[]; lngs: number[] };

const MAX_POINTS = 100;

/** Box around start and finish, padded so the router can tack and go around land. */
export function corridor(a: LatLng, b: LatLng): CorridorGrid {
  const distKm = haversineMeters(a, b) / 1000;
  const padDeg = Math.max(0.2, (distKm / 111) * 0.3);
  const south = Math.min(a.lat, b.lat) - padDeg;
  const north = Math.max(a.lat, b.lat) + padDeg;
  const west = Math.min(a.lng, b.lng) - padDeg;
  const east = Math.max(a.lng, b.lng) + padDeg;
  // Aim for ~8 km spacing on short trips, coarser offshore, inside the point cap.
  let step = Math.max(0.07, distKm / 111 / 8);
  const count = (s: number) => (Math.floor((north - south) / s) + 1) * (Math.floor((east - west) / s) + 1);
  while (count(step) > MAX_POINTS) step *= 1.15;
  const ny = Math.floor((north - south) / step) + 1;
  const nx = Math.floor((east - west) / step) + 1;
  const lats = Array.from({ length: ny }, (_, i) => south + i * step);
  const lngs = Array.from({ length: nx }, (_, i) => west + i * step);
  return { south, west, north: lats[ny - 1]!, east: lngs[nx - 1]!, lats, lngs };
}

type Hourly = Record<string, (number | null)[] | undefined> & { time?: number[] };
type Loc = { hourly?: Hourly };

/** Build a field from Open-Meteo responses (arrays in grid order, row by row from the south). */
export function fieldFromResponses(
  grid: CorridorGrid,
  model: string,
  wind: Loc[],
  marine: Loc[] | null,
): WeatherField {
  const times = (wind[0]?.hourly?.time ?? []).map((s) => s * 1000);
  if (times.length < 2) throw new Error("The forecast came back empty.");
  const nx = grid.lngs.length;
  const ny = grid.lats.length;
  const n = nx * ny;
  const layers = () => times.map(() => new Float32Array(n).fill(NaN));
  const f: WeatherField = {
    model,
    lat0: grid.lats[0]!,
    lng0: grid.lngs[0]!,
    dLat: ny > 1 ? grid.lats[1]! - grid.lats[0]! : 1,
    dLng: nx > 1 ? grid.lngs[1]! - grid.lngs[0]! : 1,
    ny,
    nx,
    times,
    windKn: layers(),
    windDir: layers(),
    gustKn: layers(),
    waveM: layers(),
    waveDir: layers(),
    wavePer: layers(),
    curKn: layers(),
    curDir: layers(),
    capeJkg: layers(),
    liftedIndex: layers(),
    cinJkg: layers(),
    precipMm: layers(),
    code: layers(),
    tempC: layers(),
    pressureHpa: layers(),
    fetchedAt: Date.now(),
  };
  if (wind[0]?.hourly?.cloud_cover) {
    f.cloudPct = layers();
    f.lowCloudPct = layers();
  }
  const put = (dst: Float32Array[], src: (number | null)[] | undefined, k: number, scale = 1, idx?: Map<number, number>) => {
    if (!src) return;
    for (let t = 0; t < times.length; t += 1) {
      const i = idx ? idx.get(times[t]!) : t;
      if (i == null) continue;
      const v = src[i];
      if (typeof v === "number" && Number.isFinite(v)) dst[t]![k] = v * scale;
    }
  };
  for (let k = 0; k < n; k += 1) {
    const w = wind[k]?.hourly;
    put(f.windKn, w?.wind_speed_10m, k);
    put(f.windDir, w?.wind_direction_10m, k);
    put(f.gustKn, w?.wind_gusts_10m, k);
    put(f.capeJkg!, w?.cape, k);
    put(f.liftedIndex!, w?.lifted_index, k);
    put(f.cinJkg!, w?.convective_inhibition, k);
    put(f.precipMm!, w?.precipitation, k);
    put(f.code!, w?.weather_code, k);
    put(f.tempC!, w?.temperature_2m, k);
    put(f.pressureHpa!, w?.pressure_msl, k);
    if (f.cloudPct) put(f.cloudPct, w?.cloud_cover, k);
    if (f.lowCloudPct) put(f.lowCloudPct, w?.cloud_cover_low, k);
    const m = marine?.[k]?.hourly;
    if (m?.time) {
      const idx = new Map(m.time.map((s, i) => [s * 1000, i] as const));
      put(f.waveM, m.wave_height, k, 1, idx);
      put(f.waveDir, m.wave_direction, k, 1, idx);
      put(f.wavePer!, m.wave_period, k, 1, idx);
      put(f.curKn, m.ocean_current_velocity, k, 1 / 1.852, idx); // km/h -> kn
      put(f.curDir, m.ocean_current_direction, k, 1, idx);
    }
  }
  return f;
}

function coords(grid: CorridorGrid) {
  const lat: string[] = [];
  const lng: string[] = [];
  for (const la of grid.lats) for (const lo of grid.lngs) {
    lat.push(la.toFixed(3));
    lng.push(lo.toFixed(3));
  }
  return { lat: lat.join(","), lng: lng.join(",") };
}

/** Fill the gaps (nulls) of one model's response from another's, location by location. */
export function mergeLocs(primary: Loc[], fill: Loc[]): Loc[] {
  return primary.map((p, k) => {
    const f = fill[k]?.hourly;
    const h = p.hourly;
    if (!h || !f) return h ? p : (fill[k] ?? p);
    const times = h.time ?? f.time ?? [];
    const out: Hourly = { ...h, time: times };
    for (const key of Object.keys(f)) {
      if (key === "time") continue;
      const a = h[key] ?? [];
      const b = f[key] ?? [];
      out[key] = times.map((_, i) => (typeof a[i] === "number" && Number.isFinite(a[i] as number) ? a[i]! : (b[i] ?? null)));
    }
    return { ...p, hourly: out };
  });
}

async function getJson(url: URL): Promise<Loc[]> {
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Weather request failed (${res.status}).`);
  const json = (await res.json()) as Loc | Loc[];
  return Array.isArray(json) ? json : [json];
}

/** `cloud` adds cloud cover (weather map); the router doesn't need it. */
export async function fetchField(grid: CorridorGrid, model: RouteModel, days: number, opts: { cloud?: boolean } = {}): Promise<WeatherField> {
  const { lat, lng } = coords(grid);
  const d = String(Math.min(16, Math.max(2, Math.ceil(days))));
  const w = openMeteoUrl("https://api.open-meteo.com/v1/forecast");
  w.searchParams.set("latitude", lat);
  w.searchParams.set("longitude", lng);
  w.searchParams.set(
    "hourly",
    "wind_speed_10m,wind_direction_10m,wind_gusts_10m,cape,lifted_index,convective_inhibition,precipitation,weather_code,temperature_2m,pressure_msl" +
      (opts.cloud ? ",cloud_cover,cloud_cover_low" : ""),
  );
  w.searchParams.set("wind_speed_unit", "kn");
  w.searchParams.set("models", model.param);
  w.searchParams.set("timeformat", "unixtime");
  w.searchParams.set("forecast_days", d);
  w.searchParams.set("cell_selection", "sea");
  const m = openMeteoUrl("https://marine-api.open-meteo.com/v1/marine");
  m.searchParams.set("latitude", lat);
  m.searchParams.set("longitude", lng);
  m.searchParams.set("hourly", "wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction");
  m.searchParams.set("timeformat", "unixtime");
  m.searchParams.set("forecast_days", String(Math.min(16, Number(d))));
  const [first, marine] = await Promise.all([getJson(w), getJson(m).catch(() => null)]);
  let wind = first;
  // The fine model may not be served (or may run shorter than asked): use the fallback then.
  const want = Number(d) * 24 * 0.8;
  const real = (wind[0]?.hourly?.wind_speed_10m ?? []).filter((v) => typeof v === "number" && Number.isFinite(v)).length;
  if (model.fallback && real < want) {
    // Keep the fine model's hours and fill the rest (or all of it) from the fallback.
    w.searchParams.set("models", model.fallback);
    const back = await getJson(w).catch(() => null);
    if (back) wind = mergeLocs(wind, back);
  }
  return fieldFromResponses(grid, model.id, wind, marine);
}
