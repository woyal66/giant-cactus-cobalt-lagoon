/*
 * Sharper radar for US waters: NOAA's MRMS QC'd base reflectivity mosaic (about 1 km, updated
 * every 2 minutes, public domain), served as WMS by the NWS GeoServer at opengeo.ncep.noaa.gov.
 * The WMS gives coloured pictures, so the colour is read back to dBZ by its hue
 * (`dbzFromRadarColor`); that works for the usual NWS reflectivity colours whatever their exact
 * shades. Layer names and CORS couldn't be checked from the dev sandbox: confirm on a device.
 *   VITE_US_RADAR=off  hide it
 */
const ENV = ((import.meta as { env?: Record<string, string | undefined> }).env ?? {}) as Record<string, string | undefined>;

export const ATTR_US_RADAR = "US radar: NOAA MRMS";
const GEOSERVER = "https://opengeo.ncep.noaa.gov/geoserver";

type Region = { ws: string; layer: string; south: number; west: number; north: number; east: number };
const REGIONS: Region[] = [
  { ws: "conus", layer: "conus_bref_qcd", south: 20, west: -130, north: 55, east: -60 },
  { ws: "alaska", layer: "alaska_bref_qcd", south: 50, west: -180, north: 72, east: -128 },
  { ws: "hawaii", layer: "hawaii_bref_qcd", south: 16, west: -164, north: 25, east: -152 },
  { ws: "carib", layer: "carib_bref_qcd", south: 15.5, west: -69, north: 20.5, east: -63 },
  { ws: "guam", layer: "guam_bref_qcd", south: 11.5, west: 142.5, north: 17, east: 147.5 },
];

export function usRadarAvailable(): boolean {
  return ENV.VITE_US_RADAR !== "off";
}

/** The NOAA mosaic covering a place, or null outside US radar coverage. */
export function usRadarRegion(lat: number, lng: number): Region | null {
  return REGIONS.find((r) => lat >= r.south && lat <= r.north && lng >= r.west && lng <= r.east) ?? null;
}

const R = 6378137;
/** Web Mercator metres of a world pixel at zoom z (256 px tiles). */
export function mercMetres(px: number, py: number, z: number): { x: number; y: number } {
  const n = 256 * 2 ** z;
  return { x: (px / n) * 2 * Math.PI * R - Math.PI * R, y: Math.PI * R - (py / n) * 2 * Math.PI * R };
}

/** WMS GetMap for a block of world pixels (x0, y0, w, h) at zoom z: one picture, one pixel per cell. */
export function usRadarUrl(region: Region, z: number, x0: number, y0: number, w: number, h: number): string {
  const a = mercMetres(x0, y0 + h, z);
  const b = mercMetres(x0 + w, y0, z);
  const q = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.3.0",
    REQUEST: "GetMap",
    LAYERS: region.layer,
    STYLES: "",
    CRS: "EPSG:3857",
    BBOX: [a.x, a.y, b.x, b.y].map((v) => v.toFixed(1)).join(","),
    WIDTH: String(w),
    HEIGHT: String(h),
    FORMAT: "image/png",
    TRANSPARENT: "true",
  });
  return `${GEOSERVER}/${region.ws}/${region.layer}/ows?${q.toString()}`;
}

/**
 * dBZ from a radar colour by hue, for the standard NWS scale: blues 5–15, greens 20–30 (darker
 * is stronger), yellow 35–40, orange 45, reds 50–60, magenta 65, purple 70, white 75.
 * Greys, black and transparent pixels are no echo (-Infinity).
 */
export function dbzFromRadarColor(r: number, g: number, b: number, a: number): number {
  if (a < 40) return -Infinity;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const v = mx / 255;
  const s = mx === 0 ? 0 : (mx - mn) / mx;
  if (s < 0.2) return v > 0.85 ? 75 : -Infinity; // white = extreme; greys = map furniture
  let hue: number;
  if (mx === r) hue = (60 * ((g - b) / (mx - mn)) + 360) % 360;
  else if (mx === g) hue = 60 * ((b - r) / (mx - mn)) + 120;
  else hue = 60 * ((r - g) / (mx - mn)) + 240;
  if (hue >= 260 && hue < 290) return 70; // purple
  if (hue >= 290 && hue < 340) return 65; // magenta
  if (hue >= 340 || hue < 15) return v > 0.9 ? 50 : v > 0.78 ? 55 : 60; // reds, darker = stronger
  if (hue < 45) return 45; // orange
  if (hue < 70) return v > 0.95 ? 35 : 40; // yellow to gold
  if (hue < 160) return v > 0.9 ? 20 : v > 0.65 ? 25 : 30; // greens, darker = stronger
  if (hue < 200) return 5; // cyan
  return hue < 225 ? 10 : 15; // blues
}
