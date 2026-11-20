/*
 * Rain radar overlay and closing-cell alert.
 *
 * Source: RainViewer's global composite (weather-maps.json + tiles). Their free API is for
 * personal and non-commercial use; a paid app needs a commercial agreement with RainViewer,
 * or a BOM radar data licence (see STORE-RELEASE). Build switches:
 *   VITE_RADAR_SOURCE=off          hide radar entirely
 *   VITE_RADAR_LICENSED=1          radar is covered by a licence (keeps it when
 *                                  VITE_LICENSED_IMAGERY_ONLY=1)
 * Tiles above zoom 7 are not served on the free tier, so they are stretched from zoom 7.
 */
const ENV = ((import.meta as { env?: Record<string, string | undefined> }).env ?? {}) as Record<
  string,
  string | undefined
>;

export const RADAR_MAX_NATIVE_ZOOM = 7;
export const ATTR_RADAR = "Radar © RainViewer";
const MAPS_URL = "https://api.rainviewer.com/public/weather-maps.json";

export function radarAvailable(): boolean {
  if (ENV.VITE_RADAR_SOURCE === "off") return false;
  if (ENV.VITE_LICENSED_IMAGERY_ONLY === "1" && ENV.VITE_RADAR_LICENSED !== "1") return false;
  return true;
}

export type RadarFrame = { at: number; path: string; nowcast: boolean };

/** Frames from weather-maps.json, oldest first (past hour, then any nowcast). */
export function parseRadarFrames(json: unknown): { host: string; frames: RadarFrame[] } | null {
  const j = json as {
    host?: unknown;
    radar?: { past?: { time?: unknown; path?: unknown }[]; nowcast?: { time?: unknown; path?: unknown }[] };
  };
  if (!j || typeof j.host !== "string" || !j.radar) return null;
  const read = (list: unknown, nowcast: boolean): RadarFrame[] =>
    (Array.isArray(list) ? list : [])
      .filter((f) => f && typeof f.time === "number" && typeof f.path === "string")
      .map((f) => ({ at: f.time * 1000, path: f.path, nowcast }));
  const frames = [...read(j.radar.past, false), ...read(j.radar.nowcast, true)].sort((a, b) => a.at - b.at);
  return frames.length ? { host: j.host, frames } : null;
}

/** Display tiles (colour scheme 2, smoothed, snow shown). */
export function radarTileUrl(host: string, frame: RadarFrame): string {
  return `${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
}

/** Analysis tiles: scheme 0 is greyscale by reflectivity, unsmoothed. */
export function radarDataTileUrl(host: string, frame: RadarFrame, z: number, x: number, y: number): string {
  return `${host}${frame.path}/256/${z}/${x}/${y}/0/0_0.png`;
}

export async function fetchRadarFrames(): Promise<{ host: string; frames: RadarFrame[] } | null> {
  try {
    const r = await fetch(MAPS_URL);
    if (!r.ok) return null;
    return parseRadarFrames(await r.json());
  } catch {
    return null;
  }
}

/*
 * Reflectivity from a scheme-0 pixel. RainViewer documents scheme 0 as dBZ values in greyscale;
 * we take dBZ = grey - 32 (their raw encoding), which must be checked against a known storm
 * before release. 40 dBZ is heavy showers; 50+ is a thunderstorm core.
 */
export function dbzFromGrey(grey: number, alpha: number): number {
  if (alpha < 16) return -Infinity;
  return grey - 32;
}
export const SQUALL_DBZ = 40;

export type Echo = { distKm: number; bearing: number };

/**
 * Nearest strong echo to the boat on a reflectivity grid. A pixel counts only when at least
 * three of its eight neighbours are strong too, so speckle does not set off the alarm.
 */
export function nearestEcho(
  dbz: ArrayLike<number>,
  w: number,
  h: number,
  boatX: number,
  boatY: number,
  kmPerPx: number,
  minDbz = SQUALL_DBZ,
  maxKm = 80,
): Echo | null {
  const strong = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && dbz[y * w + x] >= minDbz;
  const r = Math.ceil(maxKm / kmPerPx);
  let best: Echo | null = null;
  for (let y = Math.max(0, Math.floor(boatY - r)); y <= Math.min(h - 1, Math.ceil(boatY + r)); y++) {
    for (let x = Math.max(0, Math.floor(boatX - r)); x <= Math.min(w - 1, Math.ceil(boatX + r)); x++) {
      if (!strong(x, y)) continue;
      const dx = x - boatX;
      const dy = y - boatY;
      const d = Math.hypot(dx, dy) * kmPerPx;
      if (d > maxKm || (best && d >= best.distKm)) continue;
      let n = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if ((i || j) && strong(x + i, y + j)) n++;
      if (n < 3) continue;
      best = { distKm: d, bearing: ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360 };
    }
  }
  return best;
}

export type CellTrend = { distNm: number; bearing: number; closingKn: number; etaMin: number | null };

/**
 * Is the nearest cell closing on the boat? Fits the distance over the last frames (up to an hour).
 * Returns a trend when it is within 25 nm and closing faster than 3 kn.
 */
export function cellTrend(samples: { at: number; echo: Echo | null }[]): CellTrend | null {
  const s = samples.filter((x): x is { at: number; echo: Echo } => x.echo != null).slice(-6);
  if (s.length < 3) return null;
  const last = s[s.length - 1];
  const t0 = s[0].at;
  const n = s.length;
  const xs = s.map((p) => (p.at - t0) / 3_600_000);
  const ys = s.map((p) => p.echo.distKm / 1.852);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  const closingKn = -num / den;
  const distNm = last.echo.distKm / 1.852;
  if (distNm > 25 || closingKn < 3) return null;
  return {
    distNm,
    bearing: last.echo.bearing,
    closingKn,
    etaMin: Math.round((distNm / closingKn) * 60),
  };
}

/** Web Mercator pixel of a position at zoom z (256 px tiles). */
export function worldPx(lat: number, lng: number, z: number): { x: number; y: number } {
  const n = 256 * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * n,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n,
  };
}

export function kmPerPxAt(lat: number, z: number): number {
  return (40075.016 * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** z);
}
