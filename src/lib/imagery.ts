/*
 * Licensing. Anchor Mate is a paid app, and most free tile endpoints forbid that:
 *   google / bing  - fetched straight from consumer tile servers, no licence.
 *   clarity        - Esri beta endpoint, no key, no commercial terms.
 *   maxar (Esri)   - commercial use needs an ArcGIS Location Platform key.
 *   sentinel       - EOX S2 cloudless 2018-2024 is CC BY-NC-SA (non-commercial).
 *   maptiler       - commercial plans, device caching allowed per their terms.
 * Build settings (see .env.example):
 *   VITE_MAPTILER_KEY             enables MapTiler Satellite
 *   VITE_ESRI_KEY                 switches Esri World Imagery to the keyed, licensed endpoint
 *   VITE_LICENSED_IMAGERY_ONLY=1  hides every source above without a licence
 */
const ENV = (import.meta.env ?? {}) as Record<string, string | undefined>;
const MAPTILER_KEY = ENV.VITE_MAPTILER_KEY || "";
const ESRI_KEY = ENV.VITE_ESRI_KEY || "";
export const LICENSED_IMAGERY_ONLY = ENV.VITE_LICENSED_IMAGERY_ONLY === "1";

export type ImageryId =
  | "auto"
  | "google"
  | "maxar"
  | "clarity"
  | "bing"
  | "sentinel"
  | "maptiler";

export const IMAGERY: {
  id: ImageryId;
  name: string;
  detail: string;
  mark: string;
  markBg: string;
  markFg: string;
}[] = [
  {
    id: "auto",
    name: "Auto — clearest",
    detail: "Picks one photo for this zoom. Clarity over the cay, Google in close, Sentinel only when nothing sharper exists.",
    mark: "A",
    markBg: "#1a6b62",
    markFg: "#e8fff8",
  },
  {
    id: "maptiler",
    name: "MapTiler Satellite",
    detail: "Licensed high-res satellite. Can be saved to the phone for offline use.",
    mark: "M",
    markBg: "#2a4cbf",
    markFg: "#ffffff",
  },
  {
    id: "google",
    name: "Google Satellite",
    detail: "Sharpest close-in photo. A different pass from Maxar — look for the Google mark.",
    mark: "G",
    markBg: "#4285F4",
    markFg: "#ffffff",
  },
  {
    id: "maxar",
    name: "Maxar (Esri)",
    detail: "Esri’s lagoon mosaic. Softer than Google once you are inside the reef.",
    mark: "E",
    markBg: "#2d6a4f",
    markFg: "#ffffff",
  },
  {
    id: "clarity",
    name: "Maxar Clarity",
    detail: "Cleaner Maxar pass. Often the brightest cay and sand.",
    mark: "C",
    markBg: "#c4a35a",
    markFg: "#1a1408",
  },
  {
    id: "bing",
    name: "Bing Aerial",
    detail: "A darker aerial pass. Useful when Maxar is hazy on the outer reef.",
    mark: "B",
    markBg: "#00809d",
    markFg: "#ffffff",
  },
  {
    id: "sentinel",
    name: "Sentinel-2 cloudless",
    detail: "10 m colour of the whole ocean. Soft on purpose — the reef shapes stay, the bommies do not.",
    mark: "S",
    markBg: "#3d5a80",
    markFg: "#ffffff",
  },
];

export const ESRI_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const CLARITY_URL =
  "https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const SENTINEL_URL =
  "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg";
export const GOOGLE_URL =
  "https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}";
export const LABELS_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
export const SEAMARK_URL = "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png";
export const DEPTH_WMS_URL =
  "https://depth.openseamap.org/geoserver/openseamap/wms";
export const DEPTH_WMS_LAYERS = "openseamap:contour2,openseamap:contour";
/** GBRMPA reef, island, cay and rock outlines, served by AIMS eAtlas (CC BY). */
export const REEF_WMS_URL = "https://maps.eatlas.org.au/maps/wms";
export const REEF_WMS_LAYERS = "ea:GBR_GBRMPA_GBR-features";
export const ATTR_REEFS = "Reef outlines © Great Barrier Reef Marine Park Authority (CC BY)";
/** GBR Marine Park zoning (Zoning Plan 2003, in force since 1 July 2004), via eAtlas. */
export const ZONING_WMS_LAYERS = "ea:GBR_GBRMPA_Zoning-2003";
export const ATTR_ZONING = "Zoning © Great Barrier Reef Marine Park Authority. Not an official zoning map.";

/** Zone colours and the plain-English rule of thumb, from GBRMPA's zoning maps. */
export const PARK_ZONES = [
  { name: "General Use", color: "#a9d6f5", rule: "Most fishing and collecting allowed." },
  { name: "Habitat Protection", color: "#3c7fc8", rule: "Fishing allowed. No trawling." },
  { name: "Conservation Park", color: "#f3e24b", rule: "Limited fishing: one line, one hook." },
  { name: "Buffer", color: "#8ca33b", rule: "Trolling for pelagic fish only." },
  { name: "Scientific Research", color: "#f39b3b", rule: "No fishing. Entry may need a permit." },
  { name: "Marine National Park", color: "#3fa34d", rule: "Green zone: no fishing or collecting." },
  { name: "Preservation", color: "#f4a6c6", rule: "No entry without a permit." },
] as const;
export const GARMIN_SDK_URL = "https://developer.garmin.com/marine-charts/mobile";
export const GARMIN_SDK_REQUEST_URL =
  "https://www.garmin.com/en-US/forms/navionics-mobile-sdk/";

export const ATTR_ESRI = "Maxar © Esri, Maxar, Earthstar Geographics";
export const ATTR_SENTINEL = "Sentinel-2 cloudless © EOX / Copernicus";
export const ATTR_GOOGLE = "Imagery © Google";
export const ATTR_BING = "Aerial © Microsoft";
export const ATTR_OPENSEAMAP = "Seamarks & depths © OpenSeaMap contributors";
export const ATTR_MAPTILER = "© MapTiler © OpenStreetMap contributors, satellite imagery providers";

export const ESRI_KEYED_URL =
  "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const MAPTILER_URL = "https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg";

/** Whether a source may be offered in this build. */
export function sourceReady(id: SatSource): boolean {
  if (id === "maptiler") return Boolean(MAPTILER_KEY);
  if (!LICENSED_IMAGERY_ONLY) return true;
  return id === "maxar" && Boolean(ESRI_KEY);
}

/** Imagery choices shown in the View panel for this build. */
export function availableImagery(): typeof IMAGERY {
  return IMAGERY.filter((im) => im.id === "auto" || sourceReady(im.id));
}

/** A saved choice that this build no longer offers falls back to Auto. */
export function usableImagery(id: ImageryId): ImageryId {
  return id === "auto" || sourceReady(id) ? id : "auto";
}

/** Esri no-data stubs are 2521 B; Bing stubs ~1033 B. Real reef tiles are larger. */
export const STUB_TILE_BYTES = 3200;

/** Follow-the-boat helm zoom — close enough to read bommies. */
export const HELM_ZOOM = 19.5;
/** Drive-by-eye zoom, a boat-length or two of water. */
export const CLOSE_ZOOM = 20.75;
export const MAX_ZOOM = 22;

export function bingTileUrl(x: number, y: number, z: number): string {
  let q = "";
  for (let i = z; i > 0; i -= 1) {
    let d = 0;
    const mask = 1 << (i - 1);
    if ((x & mask) !== 0) d += 1;
    if ((y & mask) !== 0) d += 2;
    q += String(d);
  }
  const s = (x + y) % 4;
  return `https://ecn.t${s}.tiles.virtualearth.net/tiles/a${q}.jpeg?g=14400`;
}

export function isImageryId(v: unknown): v is ImageryId {
  return (
    v === "auto" ||
    v === "google" ||
    v === "maxar" ||
    v === "clarity" ||
    v === "bing" ||
    v === "sentinel" ||
    v === "maptiler"
  );
}

export type SatSource = Exclude<ImageryId, "auto">;

export function imageryShort(id: ImageryId): string {
  if (id === "auto") return "Auto";
  if (id === "google") return "Google";
  if (id === "maxar") return "Maxar";
  if (id === "clarity") return "Clarity";
  if (id === "bing") return "Bing";
  if (id === "maptiler") return "MapTiler";
  return "Sentinel";
}

function fill(template: string, x: number, y: number, z: number): string {
  return template.replace("{z}", String(z)).replace("{y}", String(y)).replace("{x}", String(x));
}

export function satTileUrl(id: SatSource, x: number, y: number, z: number): string {
  if (id === "maptiler") return `${fill(MAPTILER_URL, x, y, z)}?key=${MAPTILER_KEY}`;
  if (id === "maxar" && ESRI_KEY) return `${fill(ESRI_KEYED_URL, x, y, z)}?token=${ESRI_KEY}`;
  if (id === "bing") return bingTileUrl(x, y, z);
  if (id === "google") {
    return `https://mt${(x + y) % 4}.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}`;
  }
  const template =
    id === "maxar" ? ESRI_URL : id === "clarity" ? CLARITY_URL : SENTINEL_URL;
  return template
    .replace("{z}", String(z))
    .replace("{y}", String(y))
    .replace("{x}", String(x));
}

/** Clearest reef photo first. Native detail in close; Clarity on the cay; Sentinel only as the base. */
export function autoSatOrder(z: number): SatSource[] {
  const order: SatSource[] =
    z >= 18
      ? ["google", "maptiler", "bing", "clarity", "maxar", "sentinel"]
      : z >= 14
        ? ["clarity", "maptiler", "google", "bing", "maxar", "sentinel"]
        : ["sentinel", "maptiler", "clarity", "google", "bing", "maxar"];
  return order.filter(sourceReady);
}
