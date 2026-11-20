import { openMeteoUrl } from "./open-meteo.ts";
export type TideHour = {
  at: number;
  m: number;
};

export type TideTurn = {
  kind: "high" | "low";
  at: number;
  m: number;
};

export type TideOrigin =
  | {
      kind: "station";
      name: string;
      aac: string;
      km: number;
      primary: boolean;
      datum: "LAT";
    }
  | {
      kind: "model";
      name: string;
      datum: "LAT estimate";
    };

export type TideRise = {
  nowM: number;
  highM: number;
  riseM: number;
  highAt: number;
  lowM: number;
  lowAt: number;
  hours: TideHour[];
  turns: TideTurn[];
  origin: TideOrigin;
};

type MarineHourly = {
  hourly?: {
    time?: string[];
    sea_level_height_msl?: (number | null)[];
  };
};

function stamp(s: string): number {
  if (!s) return Number.NaN;
  if (/Z$|[+-]\d\d:\d\d$/.test(s)) return Date.parse(s);
  return Date.parse(`${s}Z`);
}

export function parseTideHours(
  times: string[],
  heights: Array<number | null | undefined>,
  now = Date.now(),
  maxHours = 192,
): TideHour[] {
  const hours: TideHour[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const at = stamp(times[i] ?? "");
    const m = heights[i];
    if (!Number.isFinite(at) || typeof m !== "number" || !Number.isFinite(m)) continue;
    if (at < now - 50 * 60_000) continue;
    hours.push({ at, m: Math.round(m * 100) / 100 });
    if (hours.length >= maxHours) break;
  }
  return hours;
}

export function tideTurns(hours: TideHour[]): TideTurn[] {
  if (hours.length < 3) return [];
  const out: TideTurn[] = [];
  for (let i = 1; i < hours.length - 1; i += 1) {
    const a = hours[i - 1]!;
    const b = hours[i]!;
    const c = hours[i + 1]!;
    if (b.m >= a.m && b.m >= c.m && (b.m > a.m || b.m > c.m)) {
      out.push({ kind: "high", at: b.at, m: b.m });
    } else if (b.m <= a.m && b.m <= c.m && (b.m < a.m || b.m < c.m)) {
      out.push({ kind: "low", at: b.at, m: b.m });
    }
  }
  return out;
}

export function windowTide(
  hours: TideHour[],
  t0: number,
  horizonH: number,
): TideHour[] {
  const end = t0 + Math.max(1, horizonH) * 3_600_000;
  return hours.filter((h) => h.at >= t0 - 20 * 60_000 && h.at <= end + 20 * 60_000);
}

export function tideRange(hours: TideHour[]): { minM: number; maxM: number } {
  if (hours.length === 0) return { minM: 0, maxM: 1 };
  let minM = hours[0]!.m;
  let maxM = hours[0]!.m;
  for (const h of hours) {
    minM = Math.min(minM, h.m);
    maxM = Math.max(maxM, h.m);
  }
  if (maxM - minM < 0.2) {
    const mid = (minM + maxM) / 2;
    return { minM: mid - 0.1, maxM: mid + 0.1 };
  }
  return { minM, maxM };
}

/** Lowest predicted MSL minus 10 cm — a stand-in for LAT when no station datum exists. */
export function latDatumM(hours: TideHour[]): number {
  if (hours.length === 0) return 0;
  let min = hours[0]!.m;
  for (const h of hours) min = Math.min(min, h.m);
  return Math.round((min - 0.1) * 100) / 100;
}

export function toLatM(mslM: number, datumM: number): number {
  return Math.round((mslM - datumM) * 100) / 100;
}

export function nextTurn(
  turns: TideTurn[],
  kind: "high" | "low",
  now = Date.now(),
): TideTurn | null {
  return turns.find((t) => t.kind === kind && t.at >= now - 20 * 60_000) ?? null;
}

/** Height and remaining rise to the next high — from now, not the first sample. */
export function tideRiseAt(
  turns: TideTurn[],
  hours: TideHour[],
  now = Date.now(),
): { nowM: number; high: TideTurn | null; low: TideTurn | null; riseM: number } {
  const raw =
    (turns.length >= 2 ? heightBetweenTurns(turns, now) : null) ??
    tideAt(hours, now) ??
    hours[0]?.m ??
    0;
  const nowM = Math.round(raw * 100) / 100;
  const high = nextTurn(turns, "high", now);
  const low = nextTurn(turns, "low", now);
  const riseM = high ? Math.max(0, Math.round((high.m - nowM) * 10) / 10) : 0;
  return { nowM, high, low, riseM };
}

export function tideAt(hours: TideHour[], at: number): number | null {
  if (hours.length === 0) return null;
  const first = hours[0]!;
  const last = hours[hours.length - 1]!;
  if (at <= first.at) return first.m;
  if (at >= last.at) return last.m;
  for (let i = 1; i < hours.length; i += 1) {
    const b = hours[i]!;
    const a = hours[i - 1]!;
    if (at <= b.at) {
      const t = (at - a.at) / Math.max(1, b.at - a.at);
      return Math.round((a.m + (b.m - a.m) * t) * 100) / 100;
    }
  }
  return last.m;
}

export function tideRising(hours: TideHour[], at: number): boolean | null {
  const a = tideAt(hours, at);
  const b = tideAt(hours, at + 40 * 60_000);
  if (a == null || b == null) return null;
  const d = b - a;
  if (Math.abs(d) < 0.03) return null;
  return d > 0;
}

export function parseTideWatch(
  json: MarineHourly,
  now = Date.now(),
): TideRise | null {
  const hours = parseTideHours(
    json.hourly?.time ?? [],
    json.hourly?.sea_level_height_msl ?? [],
    now,
  );
  if (hours.length < 2) return null;
  const nowH = hours[0]!;
  const day = windowTide(hours, nowH.at, 24);
  const turns = tideTurns(hours);
  let high = nextTurn(turns, "high", now);
  let low = nextTurn(turns, "low", now);
  if (!high) {
    let m = nowH;
    for (const h of day) if (h.m > m.m) m = h;
    high = { kind: "high", at: m.at, m: m.m };
  }
  if (!low) {
    let m = nowH;
    for (const h of day) if (h.m < m.m) m = h;
    low = { kind: "low", at: m.at, m: m.m };
  }
  return {
    nowM: nowH.m,
    highM: high.m,
    riseM: Math.max(0, Math.round((high.m - nowH.m) * 10) / 10),
    highAt: high.at,
    lowM: low.m,
    lowAt: low.at,
    hours,
    turns,
    origin: {
      kind: "model",
      name: "Open-Meteo marine",
      datum: "LAT estimate",
    },
  };
}

/** Cosine between published high/low — the usual way to sketch a curve from a table. */
export function hoursFromTurns(
  turns: TideTurn[],
  t0: number,
  horizonH: number,
  stepMin = 20,
): TideHour[] {
  if (turns.length < 2) return [];
  const sorted = [...turns].sort((a, b) => a.at - b.at);
  const end = t0 + Math.max(1, horizonH) * 3_600_000;
  const step = stepMin * 60_000;
  const hours: TideHour[] = [];
  for (let t = t0; t <= end; t += step) {
    const m = heightBetweenTurns(sorted, t);
    if (m == null) continue;
    hours.push({ at: t, m: Math.round(m * 100) / 100 });
  }
  return hours;
}

export function heightBetweenTurns(turns: TideTurn[], at: number): number | null {
  if (turns.length === 0) return null;
  if (at <= turns[0]!.at) return turns[0]!.m;
  const last = turns[turns.length - 1]!;
  if (at >= last.at) return last.m;
  for (let i = 1; i < turns.length; i += 1) {
    const b = turns[i]!;
    const a = turns[i - 1]!;
    if (at <= b.at) {
      const span = Math.max(1, b.at - a.at);
      const u = (at - a.at) / span;
      return a.m + (b.m - a.m) * (1 - Math.cos(Math.PI * u)) / 2;
    }
  }
  return last.m;
}

export function parseBomPrint(html: string): TideTurn[] {
  const out: TideTurn[] = [];
  const re =
    /<(?:th|td)[^>]*class="instance (high|low)-tide"[^>]*>[\s\S]*?data-time-utc="([^"]+)"[\s\S]*?class="height \1-tide"[^>]*>\s*([0-9]+(?:\.[0-9]+)?)\s*m/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const kind = m[1] === "high" ? "high" : "low";
    const at = Date.parse(m[2]!);
    const h = Number(m[3]);
    if (!Number.isFinite(at) || !Number.isFinite(h)) continue;
    out.push({ kind, at, m: Math.round(h * 100) / 100 });
  }
  if (out.length >= 2) return out.sort((a, b) => a.at - b.at);

  const loose =
    /data-time-utc="([^"]+)"[\s\S]{0,280}class="height (high|low)-tide"[^>]*>\s*([0-9]+(?:\.[0-9]+)?)\s*m/gi;
  while ((m = loose.exec(html))) {
    const at = Date.parse(m[1]!);
    const kind = m[2] === "high" ? "high" : "low";
    const h = Number(m[3]);
    if (!Number.isFinite(at) || !Number.isFinite(h)) continue;
    out.push({ kind, at, m: Math.round(h * 100) / 100 });
  }
  out.sort((a, b) => a.at - b.at);
  return out.filter((t, i, a) => i === 0 || t.at !== a[i - 1]!.at);
}

export async function fetchTideRise(lat: number, lng: number): Promise<TideRise> {
  const { fetchBomStationTide } = await import("./tide-station.ts");
  try {
    const station = await fetchBomStationTide(lat, lng);
    if (station) {
      const now = Date.now();
      const r = tideRiseAt(station.turns, station.hours, now);
      if (r.high) {
        return {
          nowM: r.nowM,
          highM: r.high.m,
          riseM: r.riseM,
          highAt: r.high.at,
          lowM: r.low?.m ?? r.nowM,
          lowAt: r.low?.at ?? r.high.at,
          hours: station.hours,
          turns: station.turns,
          origin: station.origin,
        };
      }
    }
  } catch {
    /* fall through to the marine model */
  }
  const url = openMeteoUrl("https://marine-api.open-meteo.com/v1/marine");
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lng.toFixed(4));
  url.searchParams.set("hourly", "sea_level_height_msl");
  url.searchParams.set("forecast_days", "3");
  url.searchParams.set("timezone", "GMT");
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error("tide fetch failed");
  const json = (await res.json()) as MarineHourly;
  const watch = parseTideWatch(json);
  if (!watch) throw new Error("no tide samples");
  return watch;
}
