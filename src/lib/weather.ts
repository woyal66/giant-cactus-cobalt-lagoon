import {
  latDatumM,
  parseTideHours,
  tideTurns,
  type TideHour,
  type TideOrigin,
  type TideTurn,
} from "./tides.ts";
import { fetchBomStationTide, modelTideOrigin } from "./tide-station.ts";
import { openMeteoUrl } from "./open-meteo.ts";

export type WxSky =
  | "clear"
  | "partly"
  | "cloud"
  | "fog"
  | "rain"
  | "heavy"
  | "storm"
  | "snow";

export type WxModel = "ecmwf" | "gfs" | "ukmo" | "icon" | "best" | "met.no";

export type WxHour = {
  at: number;
  windKn: number;
  gustKn: number | null;
  dirDeg: number;
  tempC: number;
  precipMm: number;
  cloudPct: number;
  sky: WxSky;
};

export type CurrentHour = {
  at: number;
  kn: number;
  dirDeg: number;
};

export type WaveHour = {
  at: number;
  heightM: number;
  dirDeg: number;
  periodS: number | null;
  swellM: number | null;
};

export type SeaState = {
  waveM: number | null;
  swellM: number | null;
  periodS: number | null;
  dirDeg: number | null;
  currentKn: number | null;
  currentDir: number | null;
  currentHours: CurrentHour[];
  waveHours: WaveHour[];
  tideHours: TideHour[];
  tideTurns: TideTurn[];
  latDatumM: number | null;
  tideOrigin: TideOrigin | null;
};

export type WxForecast = {
  lat: number;
  lng: number;
  source: WxModel;
  hours: WxHour[];
  now: WxHour;
  maxWind: WxHour;
  rainMm: number;
  sea: SeaState | null;
  /** Other models drawn against the primary line. */
  compare?: Array<{ source: WxModel; hours: WxHour[] }>;
  alt?: { source: WxModel; hours: WxHour[] };
  /** Set when there was no signal and this is the last forecast saved on the phone. */
  savedAt?: number;
};

export const WX_MODEL_LABEL: Record<WxModel, string> = {
  ecmwf: "ECMWF IFS",
  gfs: "NOAA GFS",
  ukmo: "UK Met Office",
  icon: "DWD ICON",
  best: "Open-Meteo",
  "met.no": "MET Norway",
};

const CARDINALS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

export function msToKn(ms: number): number {
  return ms * 1.94384;
}

export function formatKn(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const r = Math.round(n);
  if (Math.abs(n - r) < 0.25) return String(r);
  return (Math.round(n * 10) / 10).toFixed(1);
}

export function windCardinal(deg: number): string {
  const i = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
  return CARDINALS[i]!;
}

export function beaufort(kn: number): { n: number; label: string } {
  const bands: Array<[number, number, string]> = [
    [1, 0, "Calm"],
    [4, 1, "Light air"],
    [7, 2, "Light breeze"],
    [11, 3, "Gentle breeze"],
    [17, 4, "Moderate breeze"],
    [22, 5, "Fresh breeze"],
    [28, 6, "Strong breeze"],
    [34, 7, "Near gale"],
    [41, 8, "Gale"],
    [48, 9, "Strong gale"],
    [56, 10, "Storm"],
    [64, 11, "Violent storm"],
  ];
  for (const [max, n, label] of bands) {
    if (kn < max) return { n, label };
  }
  return { n: 12, label: "Hurricane" };
}

export function skyLabel(sky: WxSky): string {
  if (sky === "clear") return "Clear";
  if (sky === "partly") return "Partly cloudy";
  if (sky === "cloud") return "Cloudy";
  if (sky === "fog") return "Fog";
  if (sky === "rain") return "Rain";
  if (sky === "heavy") return "Heavy rain";
  if (sky === "storm") return "Thunder";
  return "Snow";
}

export function skyFromWmo(code: number): WxSky {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code === 65 || code === 67 || code === 82 || code === 81) return "heavy";
  if (code >= 95) return "storm";
  if (code >= 51) return "rain";
  return "cloud";
}

export function skyFromSymbol(code: string): WxSky {
  const c = code.replace(/_day|_night|_polartwilight/g, "");
  if (c.includes("thunder")) return "storm";
  if (c.includes("snow") || c.includes("sleet")) return "snow";
  if (c.includes("heavyrain") || c.includes("heavysleet")) return "heavy";
  if (c.includes("rain") || c.includes("shower")) return "rain";
  if (c.includes("fog")) return "fog";
  if (c === "cloudy") return "cloud";
  if (c.includes("partlycloudy") || c === "fair") return "partly";
  if (c.includes("clearsky")) return "clear";
  return "cloud";
}

export const WX_HORIZONS = [6, 12, 24, 48, 72, 168, 336] as const;

export function clampWxHorizon(h: number): number {
  if (!Number.isFinite(h)) return 48;
  return Math.max(6, Math.min(336, Math.round(h)));
}

export function horizonLabel(h: number): string {
  if (h < 24) return `${h}h`;
  const d = h / 24;
  if (h === 24) return "24h";
  if (Number.isInteger(d)) return `${d}d`;
  return `${h}h`;
}

export function hourLabel(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: "numeric" });
}

export function dayStamp(at: number): string {
  return new Date(at).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

/** Relative day for a readout. The hint is the calendar date when the label is not already that date. */
export function dayClock(at: number, now = Date.now()): { label: string; hint: string } {
  const day = dayStamp(at);
  const a0 = new Date(at);
  a0.setHours(0, 0, 0, 0);
  const n0 = new Date(now);
  n0.setHours(0, 0, 0, 0);
  const diff = Math.round((a0.getTime() - n0.getTime()) / 86_400_000);
  const label =
    Math.abs(at - now) < 20 * 60_000
      ? "Now"
      : diff === 0
        ? "Today"
        : diff === 1
          ? "Tomorrow"
          : diff === -1
            ? "Yesterday"
            : day;
  return { label, hint: label === day ? "" : day };
}

export type AxisMark = { at: number; time: string; day: string | null };

/** Clock-aligned marks. They move with the window instead of stretching a fake Now to the left edge. */
export function axisMarks(t0: number, horizonH: number): AxisMark[] {
  const end = t0 + Math.max(1, horizonH) * 3_600_000;
  const stepH =
    horizonH <= 8 ? 1 : horizonH <= 18 ? 2 : horizonH <= 36 ? 3 : horizonH <= 72 ? 6 : horizonH <= 168 ? 12 : 24;
  const step = stepH * 3_600_000;
  const start = new Date(t0);
  start.setMinutes(0, 0, 0);
  const rem = start.getHours() % stepH;
  if (rem !== 0) start.setHours(start.getHours() + (stepH - rem));
  let at = start.getTime();
  if (at < t0) at += step;
  const out: AxisMark[] = [];
  const seen = new Set<string>();
  for (; at <= end + 1000; at += step) {
    if (at < t0 || at > end) continue;
    const d = new Date(at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const first = !seen.has(key);
    seen.add(key);
    const showDay = first || d.getHours() === 0 || stepH >= 12;
    out.push({
      at,
      time: stepH >= 24 ? "" : hourLabel(at),
      day: showDay ? d.toLocaleDateString([], { weekday: "short", day: "numeric" }) : null,
    });
  }
  if (out.length && !out.some((m) => m.day)) out[0] = { ...out[0]!, day: dayStamp(out[0]!.at) };
  return out;
}

export function clockLabel(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function nearestSample<T extends { at: number }>(hours: T[], at: number): T | null {
  if (hours.length === 0) return null;
  let best = hours[0]!;
  let d = Math.abs(best.at - at);
  for (const h of hours) {
    const dd = Math.abs(h.at - at);
    if (dd < d) {
      best = h;
      d = dd;
    }
  }
  return best;
}

export function wxLocKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export function windowStats(hours: WxHour[]): { maxWind: WxHour; rainMm: number } {
  const now = hours[0];
  if (!now) {
    return {
      maxWind: {
        at: Date.now(),
        windKn: 0,
        gustKn: null,
        dirDeg: 0,
        tempC: 0,
        precipMm: 0,
        cloudPct: 0,
        sky: "cloud",
      },
      rainMm: 0,
    };
  }
  let maxWind = now;
  let rainMm = 0;
  for (const h of hours) {
    if (h.windKn > maxWind.windKn) maxWind = h;
    rainMm += h.precipMm;
  }
  return { maxWind, rainMm: Math.round(rainMm * 10) / 10 };
}

export function graphTicks(n: number): number[] {
  if (n <= 1) return [0];
  if (n <= 8) return Array.from({ length: n }, (_, i) => i);
  const step = n <= 24 ? 6 : n <= 48 ? 12 : n <= 96 ? 24 : n <= 192 ? 48 : 72;
  const out: number[] = [0];
  for (let i = step; i < n - 1; i += step) out.push(i);
  if (out[out.length - 1] !== n - 1) out.push(n - 1);
  return out;
}

export function tickLabel(at: number, horizonH: number, first: boolean): string {
  if (first) return "Now";
  if (horizonH <= 48) return hourLabel(at);
  return new Date(at).toLocaleDateString([], { weekday: "short", day: "numeric" });
}

export function sliceByHorizon(hours: WxHour[], horizonH: number): WxHour[] {
  if (hours.length === 0) return [];
  const t0 = hours[0]!.at;
  const end = t0 + clampWxHorizon(horizonH) * 3_600_000;
  return hours.filter((h) => h.at <= end + 20 * 60_000);
}

export function extendHours(primary: WxHour[], extra: WxHour[]): WxHour[] {
  if (extra.length === 0) return primary;
  if (primary.length === 0) return extra;
  const last = primary[primary.length - 1]!.at;
  const tail = extra.filter((h) => h.at > last + 20 * 60_000);
  return tail.length ? [...primary, ...tail] : primary;
}

export function horizonTicks(
  t0: number,
  horizonH: number,
): Array<{ at: number; label: string }> {
  const n = horizonH <= 12 ? 3 : horizonH <= 48 ? 4 : 5;
  const span = clampWxHorizon(horizonH) * 3_600_000;
  const out: Array<{ at: number; label: string }> = [];
  for (let i = 0; i < n; i += 1) {
    const at = t0 + (span * i) / (n - 1);
    out.push({ at, label: i === 0 ? "Now" : tickLabel(at, horizonH, false) });
  }
  return out;
}

export function graphX(i: number, n: number, width: number, padL = 28, padR = 8): number {
  const inner = width - padL - padR;
  if (n <= 1) return padL;
  return padL + (i / (n - 1)) * inner;
}

export function graphLine(
  values: number[],
  width: number,
  height: number,
  maxY: number,
  padL = 28,
  padT = 8,
  padR = 6,
  padB = 22,
): string {
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  return values
    .map((v, i) => {
      const x = padL + (i / Math.max(1, values.length - 1)) * innerW;
      const y = padT + innerH - (v / Math.max(1, maxY)) * innerH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function graphXAt(
  at: number,
  t0: number,
  horizonH: number,
  width: number,
  padL = 28,
  padR = 8,
): number {
  const span = Math.max(1, horizonH) * 3_600_000;
  const t = Math.max(0, Math.min(1, (at - t0) / span));
  return padL + t * (width - padL - padR);
}

export function graphLineTimed(
  points: Array<{ at: number; v: number }>,
  t0: number,
  horizonH: number,
  width: number,
  height: number,
  maxY: number,
  padL = 28,
  padR = 8,
  padT = 8,
  padB = 22,
): string {
  const span = Math.max(1, horizonH) * 3_600_000;
  const end = t0 + span;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const pts = points.filter((p) => p.at >= t0 - 60_000 && p.at <= end + 60_000);
  if (pts.length < 2) return "";
  return pts
    .map((p, i) => {
      const x = padL + ((p.at - t0) / span) * innerW;
      const y = padT + innerH - (Math.max(0, p.v) / Math.max(1, maxY)) * innerH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function graphAreaTimed(
  points: Array<{ at: number; v: number }>,
  t0: number,
  horizonH: number,
  width: number,
  height: number,
  minV: number,
  maxV: number,
  padL = 28,
  padR = 8,
  padT = 8,
  padB = 22,
): string {
  const span = Math.max(1, horizonH) * 3_600_000;
  const end = t0 + span;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const pts = points.filter((p) => p.at >= t0 - 60_000 && p.at <= end + 60_000);
  if (pts.length < 2) return "";
  const range = Math.max(0.2, maxV - minV);
  const xs = pts.map((p) => {
    const x = padL + ((p.at - t0) / span) * innerW;
    const y = padT + innerH - ((p.v - minV) / range) * innerH;
    return { x, y };
  });
  const bottom = padT + innerH;
  const first = xs[0]!;
  const last = xs[xs.length - 1]!;
  return (
    `M${first.x.toFixed(1)} ${bottom.toFixed(1)} ` +
    xs.map((p) => `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
    ` L${last.x.toFixed(1)} ${bottom.toFixed(1)} Z`
  );
}

function finish(
  hours: WxHour[],
  lat: number,
  lng: number,
  source: WxModel,
): WxForecast {
  if (hours.length < 1) throw new Error("no weather hours");
  const stats = windowStats(hours.slice(0, 24));
  return {
    lat,
    lng,
    source,
    hours,
    now: hours[0]!,
    maxWind: stats.maxWind,
    rainMm: stats.rainMm,
    sea: null,
  };
}

function parseStamp(s: string): number {
  if (!s) return Number.NaN;
  if (/Z$|[+-]\d\d:\d\d$/.test(s)) return Date.parse(s);
  return Date.parse(`${s}Z`);
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

type MetNoPayload = {
  properties?: {
    timeseries?: Array<{
      time?: string;
      data?: {
        instant?: {
          details?: Record<string, number>;
        };
        next_1_hours?: {
          summary?: { symbol_code?: string };
          details?: { precipitation_amount?: number };
        };
      };
    }>;
  };
};

export function parseMetNo(json: MetNoPayload, lat: number, lng: number, now = Date.now()): WxForecast {
  const series = json.properties?.timeseries ?? [];
  const hours: WxHour[] = [];
  for (const row of series) {
    const at = parseStamp(row.time ?? "");
    if (!Number.isFinite(at)) continue;
    if (at < now - 50 * 60_000) continue;
    const det = row.data?.instant?.details ?? {};
    const next = row.data?.next_1_hours;
    const windMs = num(det.wind_speed);
    const gustMs = det.wind_speed_of_gust;
    hours.push({
      at,
      windKn: Math.round(msToKn(windMs) * 10) / 10,
      gustKn:
        typeof gustMs === "number" && Number.isFinite(gustMs)
          ? Math.round(msToKn(gustMs) * 10) / 10
          : null,
      dirDeg: num(det.wind_from_direction),
      tempC: Math.round(num(det.air_temperature) * 10) / 10,
      precipMm: num(next?.details?.precipitation_amount),
      cloudPct: Math.round(num(det.cloud_area_fraction)),
      sky: skyFromSymbol(next?.summary?.symbol_code ?? ""),
    });
    if (hours.length >= 384) break;
  }
  return finish(hours, lat, lng, "met.no");
}

type OpenMeteoPayload = {
  hourly?: {
    time?: string[];
    wind_speed_10m?: (number | null)[];
    wind_direction_10m?: (number | null)[];
    wind_gusts_10m?: (number | null)[];
    weather_code?: (number | null)[];
    temperature_2m?: (number | null)[];
    precipitation?: (number | null)[];
    cloud_cover?: (number | null)[];
  };
};

export function parseOpenMeteo(
  json: OpenMeteoPayload,
  lat: number,
  lng: number,
  now = Date.now(),
  source: WxModel = "ecmwf",
): WxForecast {
  const t = json.hourly?.time ?? [];
  const hours: WxHour[] = [];
  for (let i = 0; i < t.length; i += 1) {
    const at = parseStamp(t[i] ?? "");
    if (!Number.isFinite(at) || at < now - 50 * 60_000) continue;
    const wind = num(json.hourly?.wind_speed_10m?.[i]);
    const gust = json.hourly?.wind_gusts_10m?.[i];
    hours.push({
      at,
      windKn: Math.round(wind * 10) / 10,
      gustKn: typeof gust === "number" && Number.isFinite(gust) ? Math.round(gust * 10) / 10 : null,
      dirDeg: num(json.hourly?.wind_direction_10m?.[i]),
      tempC: Math.round(num(json.hourly?.temperature_2m?.[i]) * 10) / 10,
      precipMm: num(json.hourly?.precipitation?.[i]),
      cloudPct: Math.round(num(json.hourly?.cloud_cover?.[i])),
      sky: skyFromWmo(num(json.hourly?.weather_code?.[i])),
    });
    if (hours.length >= 384) break;
  }
  return finish(hours, lat, lng, source);
}

type MarinePayload = {
  hourly?: {
    time?: string[];
    wave_height?: (number | null)[];
    wave_direction?: (number | null)[];
    wave_period?: (number | null)[];
    swell_wave_height?: (number | null)[];
    ocean_current_velocity?: (number | null)[];
    ocean_current_direction?: (number | null)[];
    sea_level_height_msl?: (number | null)[];
  };
};

function kmhToKn(v: number): number {
  return Math.round((v / 1.852) * 10) / 10;
}

export function parseSea(json: MarinePayload, now = Date.now()): SeaState | null {
  const times = json.hourly?.time ?? [];
  const currentHours: CurrentHour[] = [];
  const waveHours: WaveHour[] = [];
  let best = -1;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i += 1) {
    const at = parseStamp(times[i] ?? "");
    if (!Number.isFinite(at)) continue;
    const diff = Math.abs(at - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
    if (at >= now - 50 * 60_000) {
      const kmh = json.hourly?.ocean_current_velocity?.[i];
      const dir = json.hourly?.ocean_current_direction?.[i];
      if (
        currentHours.length < 192 &&
        typeof kmh === "number" &&
        Number.isFinite(kmh) &&
        typeof dir === "number"
      ) {
        currentHours.push({ at, kn: kmhToKn(kmh), dirDeg: dir });
      }
      const wh = json.hourly?.wave_height?.[i];
      const wd = json.hourly?.wave_direction?.[i];
      if (waveHours.length < 192 && typeof wh === "number" && Number.isFinite(wh)) {
        const per = json.hourly?.wave_period?.[i];
        const sw = json.hourly?.swell_wave_height?.[i];
        waveHours.push({
          at,
          heightM: Math.round(wh * 10) / 10,
          dirDeg: typeof wd === "number" && Number.isFinite(wd) ? wd : 0,
          periodS: typeof per === "number" && Number.isFinite(per) ? Math.round(per) : null,
          swellM: typeof sw === "number" && Number.isFinite(sw) ? Math.round(sw * 10) / 10 : null,
        });
      }
    }
  }
  const tideHours = parseTideHours(times, json.hourly?.sea_level_height_msl ?? [], now);
  const tideTurnsList = tideTurns(tideHours);
  if (best < 0 && tideHours.length < 2) return null;
  const waveM = best >= 0 ? json.hourly?.wave_height?.[best] : null;
  const swell = best >= 0 ? json.hourly?.swell_wave_height?.[best] : null;
  const period = best >= 0 ? json.hourly?.wave_period?.[best] : null;
  const dir = best >= 0 ? json.hourly?.wave_direction?.[best] : null;
  const curKmh = best >= 0 ? json.hourly?.ocean_current_velocity?.[best] : null;
  const curDir = best >= 0 ? json.hourly?.ocean_current_direction?.[best] : null;
  const currentKn =
    typeof curKmh === "number" && Number.isFinite(curKmh) ? kmhToKn(curKmh) : null;
  const currentDir =
    typeof curDir === "number" && Number.isFinite(curDir) ? curDir : null;
  const hasWave = typeof waveM === "number" && Number.isFinite(waveM);
  if (!hasWave && currentKn == null && tideHours.length < 2) return null;
  return {
    waveM: hasWave ? Math.round(waveM * 10) / 10 : null,
    swellM: typeof swell === "number" ? Math.round(swell * 10) / 10 : null,
    periodS: typeof period === "number" ? Math.round(period) : null,
    dirDeg: typeof dir === "number" ? dir : null,
    currentKn,
    currentDir,
    currentHours,
    waveHours,
    tideHours,
    tideTurns: tideTurnsList,
    latDatumM: tideHours.length ? latDatumM(tideHours) : null,
    tideOrigin: tideHours.length ? modelTideOrigin() : null,
  };
}

/** +along with the bow, +across to starboard. Current dir is the set (water going to). */
export function currentVsHeading(
  currentKn: number,
  currentDir: number,
  heading: number,
): { alongKn: number; acrossKn: number } {
  const rad = ((currentDir - heading) * Math.PI) / 180;
  return {
    alongKn: Math.round(currentKn * Math.cos(rad) * 10) / 10,
    acrossKn: Math.round(currentKn * Math.sin(rad) * 10) / 10,
  };
}

/** Degrees to steer off the ground course so model set does not set you off the line.
 *  Water going to starboard means steer to port. Null if SOG is too low to trust it. */
export function setAllowance(
  desiredDeg: number,
  sogKn: number,
  currentKn: number,
  currentDir: number,
): { deg: number; side: "P" | "S" } | null {
  if (!Number.isFinite(sogKn) || sogKn < 1.5) return null;
  if (!Number.isFinite(currentKn) || currentKn < 0.15) return null;
  const rel = ((currentDir - desiredDeg + 540) % 360) - 180;
  const across = currentKn * Math.sin((rel * Math.PI) / 180);
  const ratio = across / sogKn;
  if (Math.abs(ratio) >= 0.95) return null;
  const steer = (-Math.asin(ratio) * 180) / Math.PI;
  const deg = Math.round(Math.abs(steer));
  if (deg < 2) return null;
  return { deg, side: steer >= 0 ? "S" : "P" };
}

async function fetchJson(url: string, headers?: HeadersInit): Promise<unknown> {
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`weather ${res.status}`);
  return res.json();
}

async function fetchSea(lat: number, lng: number): Promise<SeaState | null> {
  const url = openMeteoUrl("https://marine-api.open-meteo.com/v1/marine");
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lng.toFixed(4));
  url.searchParams.set(
    "hourly",
    "wave_height,wave_direction,wave_period,swell_wave_height,ocean_current_velocity,ocean_current_direction,sea_level_height_msl",
  );
  url.searchParams.set("forecast_days", "8");
  url.searchParams.set("timezone", "GMT");
  const json = (await fetchJson(url.toString())) as MarinePayload;
  return parseSea(json);
}

async function fetchNamedModel(
  lat: number,
  lng: number,
  source: "ecmwf" | "gfs" | "ukmo" | "icon",
): Promise<WxForecast | null> {
  const spec = {
    ecmwf: { base: "https://api.open-meteo.com/v1/forecast", model: "ecmwf_ifs025", days: "16" },
    gfs: { base: "https://api.open-meteo.com/v1/forecast", model: "gfs_global", days: "16" },
    icon: { base: "https://api.open-meteo.com/v1/forecast", model: "icon_global", days: "7" },
    ukmo: { base: "https://api.open-meteo.com/v1/forecast", model: "ukmo_global_deterministic_10km", days: "7" },
  }[source];
  const url = openMeteoUrl(spec.base);
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lng.toFixed(4));
  url.searchParams.set(
    "hourly",
    "wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,temperature_2m,precipitation,cloud_cover",
  );
  url.searchParams.set("forecast_days", spec.days);
  url.searchParams.set("wind_speed_unit", "kn");
  url.searchParams.set("timezone", "GMT");
  url.searchParams.set("models", spec.model);
  const json = (await fetchJson(url.toString())) as OpenMeteoPayload;
  const winds = json.hourly?.wind_speed_10m ?? [];
  let real = 0;
  for (const v of winds) {
    if (typeof v === "number" && Number.isFinite(v)) real += 1;
  }
  if (real < 3) return null;
  return parseOpenMeteo(json, lat, lng, Date.now(), source);
}

async function fetchOpenMeteo(
  lat: number,
  lng: number,
  model: "ecmwf_ifs025" | "gfs_global" | "auto",
): Promise<WxForecast> {
  const url = openMeteoUrl("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lng.toFixed(4));
  url.searchParams.set(
    "hourly",
    "wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,temperature_2m,precipitation,cloud_cover",
  );
  url.searchParams.set("forecast_days", "16");
  url.searchParams.set("wind_speed_unit", "kn");
  url.searchParams.set("timezone", "GMT");
  if (model !== "auto") url.searchParams.set("models", model);
  const json = (await fetchJson(url.toString())) as OpenMeteoPayload;
  const source: WxModel =
    model === "ecmwf_ifs025" ? "ecmwf" : model === "gfs_global" ? "gfs" : "best";
  return parseOpenMeteo(json, lat, lng, Date.now(), source);
}

async function fetchMetNo(lat: number, lng: number): Promise<WxForecast> {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;
  const json = (await fetchJson(url, { Accept: "application/json" })) as MetNoPayload;
  return parseMetNo(json, lat, lng);
}

/* ---------- offline: keep the last forecast for out-of-signal anchorages ---------- */

const WX_SAVE_PREFIX = "anchormate.wx.";
/** Older than this, a saved forecast is more misleading than helpful. */
export const WX_SAVE_MAX_AGE_MS = 72 * 3_600_000;

function wxSaveKey(lat: number, lng: number): string {
  // ~10 km cells: a forecast for the bay is still right after the boat swings or moves a little.
  return `${WX_SAVE_PREFIX}${lat.toFixed(1)},${lng.toFixed(1)}`;
}

function saveForecast(f: WxForecast) {
  try {
    const slim: WxForecast = { ...f, compare: undefined, alt: undefined, savedAt: Date.now() };
    localStorage.setItem(wxSaveKey(f.lat, f.lng), JSON.stringify(slim));
  } catch {
    /* storage full or blocked */
  }
}

/** Re-anchor a saved forecast on the current hour so "now" is not hours out of date. */
export function reviveForecast(f: WxForecast, now = Date.now()): WxForecast | null {
  if (!f.savedAt || now - f.savedAt > WX_SAVE_MAX_AGE_MS) return null;
  const hours = f.hours.filter((h) => h.at >= now - 3_600_000);
  if (hours.length < 3) return null;
  const { maxWind, rainMm } = windowStats(hours);
  return { ...f, hours, now: hours[0]!, maxWind, rainMm };
}

function loadForecast(lat: number, lng: number): WxForecast | null {
  try {
    const raw = localStorage.getItem(wxSaveKey(lat, lng));
    return raw ? reviveForecast(JSON.parse(raw) as WxForecast) : null;
  } catch {
    return null;
  }
}

export async function fetchWeather(
  lat: number,
  lng: number,
  opts?: { compare?: boolean },
): Promise<WxForecast> {
  try {
    const live = await fetchWeatherLive(lat, lng, opts);
    saveForecast(live);
    return live;
  } catch (err) {
    const saved = loadForecast(lat, lng);
    if (saved) return saved;
    throw err;
  }
}

async function fetchWeatherLive(
  lat: number,
  lng: number,
  opts?: { compare?: boolean },
): Promise<WxForecast> {
  const compare = opts?.compare === true;
  const seaP = fetchSea(lat, lng).catch(() => null);
  const ids = compare
    ? (["ecmwf", "gfs", "ukmo", "icon"] as const)
    : (["ecmwf"] as const);
  const named = await Promise.all(ids.map((id) => fetchNamedModel(lat, lng, id).catch(() => null)));
  let forecast = named.find((f): f is WxForecast => Boolean(f && f.hours.length > 2));
  if (!forecast) {
    forecast = await fetchOpenMeteo(lat, lng, "auto").catch(() => fetchMetNo(lat, lng));
  }
  const others = named.filter(
    (f): f is WxForecast => Boolean(f && f.hours.length > 2 && f.source !== forecast!.source),
  );
  if (others.length) {
    forecast.compare = others.map((f) => ({ source: f.source, hours: f.hours }));
    const gfs = others.find((f) => f.source === "gfs");
    if (gfs) forecast.alt = { source: gfs.source, hours: gfs.hours };
  }
  forecast.sea = await seaP;
  try {
    const station = await fetchBomStationTide(lat, lng);
    if (station) {
      const sea = forecast.sea ?? {
        waveM: null,
        swellM: null,
        periodS: null,
        dirDeg: null,
        currentKn: null,
        currentDir: null,
        currentHours: [],
        waveHours: [],
        tideHours: [],
        tideTurns: [],
        latDatumM: null,
        tideOrigin: null,
      };
      forecast.sea = {
        ...sea,
        tideHours: station.hours,
        tideTurns: station.turns,
        latDatumM: 0,
        tideOrigin: station.origin,
      };
    }
  } catch {
    /* keep marine model tide */
  }
  return forecast;
}

export function graphMaxKn(hours: WxHour[]): number {
  let m = 12;
  for (const h of hours) {
    m = Math.max(m, h.windKn, h.gustKn ?? 0);
  }
  return Math.max(15, Math.ceil(m / 5) * 5);
}
