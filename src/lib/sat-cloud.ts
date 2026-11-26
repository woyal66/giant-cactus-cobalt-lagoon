/*
 * Cloud from space: geostationary infrared pictures from NASA GIBS (Worldview), free to use
 * with credit. Infrared works day and night: cold cloud tops are bright, warm sea is dark.
 *   Himawari-9 (Japan) covers Australia, Asia and the western Pacific;
 *   GOES-West and GOES-East (US) cover the Pacific and the Americas.
 * Elsewhere there is the daily true-colour picture from a polar satellite (VIIRS).
 * Served by GIBS WMS (EPSG:3857). The layer names and how late the newest picture is couldn't be
 * checked from the dev sandbox: confirm on a device.
 *   VITE_SAT_CLOUD=off  hide it
 */
const ENV = ((import.meta as { env?: Record<string, string | undefined> }).env ?? {}) as Record<string, string | undefined>;

export const GIBS_WMS = "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi";
export const ATTR_SAT_CLOUD = "Cloud imagery: NASA GIBS / Worldview, JMA Himawari, NOAA GOES";

export function satCloudAvailable(): boolean {
  return ENV.VITE_SAT_CLOUD !== "off";
}

export type SatSource = { id: string; layer: string; label: string; stepMin: number; daily: boolean };

const HIMAWARI: SatSource = { id: "himawari", layer: "Himawari_AHI_Band13_Clean_Infrared", label: "Himawari-9 infrared", stepMin: 10, daily: false };
const GOES_W: SatSource = { id: "goes-w", layer: "GOES-West_ABI_Band13_Clean_Infrared", label: "GOES-West infrared", stepMin: 10, daily: false };
const GOES_E: SatSource = { id: "goes-e", layer: "GOES-East_ABI_Band13_Clean_Infrared", label: "GOES-East infrared", stepMin: 10, daily: false };
const VIIRS: SatSource = { id: "viirs", layer: "VIIRS_NOAA20_CorrectedReflectance_TrueColor", label: "VIIRS daily picture", stepMin: 1440, daily: true };

/** The satellite that sees a place best (by longitude; all three reach about 60° N/S). */
export function satFor(lat: number, lng: number): SatSource {
  const lo = ((((lng + 180) % 360) + 360) % 360) - 180;
  if (Math.abs(lat) > 65) return VIIRS;
  if (lo >= 80 || lo <= -170) return HIMAWARI;
  if (lo > -170 && lo <= -105) return GOES_W;
  if (lo > -105 && lo <= -20) return GOES_E;
  return VIIRS;
}

/**
 * Frame times for the live strip: the newest picture is usually 20–40 minutes old, so frames
 * run back from 40 minutes ago, every 20 minutes, over 2 hours (oldest first). Daily pictures:
 * today and yesterday.
 */
export function satFrames(src: SatSource, now = Date.now()): number[] {
  if (src.daily) {
    const d = new Date(now);
    const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return [today - 86_400_000, today];
  }
  const step = 10 * 60_000;
  const newest = Math.floor((now - 40 * 60_000) / step) * step;
  const out: number[] = [];
  for (let k = 6; k >= 0; k--) out.push(newest - k * 20 * 60_000);
  return out;
}

/** WMS TIME value: ISO to the minute for geostationary frames, the date for daily ones. */
export function satTime(src: SatSource, at: number): string {
  const iso = new Date(at).toISOString();
  return src.daily ? iso.slice(0, 10) : `${iso.slice(0, 16)}:00Z`;
}
