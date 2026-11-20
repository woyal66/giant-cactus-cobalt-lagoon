export type ImageryId =
  | "auto"
  | "google"
  | "maxar"
  | "clarity"
  | "bing"
  | "sentinel";

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
export const GARMIN_SDK_URL = "https://developer.garmin.com/marine-charts/mobile";
export const GARMIN_SDK_REQUEST_URL =
  "https://www.garmin.com/en-US/forms/navionics-mobile-sdk/";

export const ATTR_ESRI = "Maxar © Esri, Maxar, Earthstar Geographics";
export const ATTR_SENTINEL = "Sentinel-2 cloudless © EOX / Copernicus";
export const ATTR_GOOGLE = "Imagery © Google";
export const ATTR_BING = "Aerial © Microsoft";
export const ATTR_OPENSEAMAP = "Seamarks & depths © OpenSeaMap contributors";

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
    v === "sentinel"
  );
}

export type SatSource = Exclude<ImageryId, "auto">;

export function imageryShort(id: ImageryId): string {
  if (id === "auto") return "Auto";
  if (id === "google") return "Google";
  if (id === "maxar") return "Maxar";
  if (id === "clarity") return "Clarity";
  if (id === "bing") return "Bing";
  return "Sentinel";
}

export function satTileUrl(id: SatSource, x: number, y: number, z: number): string {
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
  if (z >= 18) return ["google", "bing", "clarity", "maxar", "sentinel"];
  if (z >= 14) return ["clarity", "google", "bing", "maxar", "sentinel"];
  return ["sentinel", "clarity", "google", "bing", "maxar"];
}
