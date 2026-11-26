/*
 * Licensing. Anchor Mate is a paid app, and most free tile endpoints forbid that:
 *   google / bing  - fetched straight from consumer tile servers, no licence.
 *   clarity        - Esri beta endpoint, no key, no commercial terms.
 *   maxar (Esri)   - commercial use needs an ArcGIS Location Platform key.
 *   sentinel       - EOX S2 cloudless 2018-2024 is CC BY-NC-SA (non-commercial).
 *   maptiler       - commercial plans, device caching allowed per their terms.
 * Build settings (see .env.example, and docs/imagery-keys.md for getting each key):
 *   VITE_MAPTILER_KEY             enables MapTiler Satellite
 *   VITE_ESRI_KEY                 switches Esri World Imagery to the keyed, licensed endpoint
 *   VITE_GOOGLE_TILES_KEY         Google satellite through the official Map Tiles API
 *   VITE_AZURE_MAPS_KEY           Microsoft (Bing) aerial through Azure Maps
 *   VITE_MAPBOX_TOKEN             Mapbox Satellite
 *   VITE_HERE_KEY                 HERE satellite
 *   VITE_LINZ_KEY                 New Zealand aerial (free LINZ Basemaps key)
 *   VITE_LICENSED_IMAGERY_ONLY=1  hides every source above without a licence
 * Free and open, always offered (and saved in offline packs):
 *   sentinel (store build)  - EOX Sentinel-2 cloudless 2016, CC BY 4.0 (the 2018+ years are non-commercial)
 *   gov                     - government aerial photos: NSW Spatial Services and Queensland (CC BY 4.0),
 *                             LINZ New Zealand (CC BY 4.0, needs VITE_LINZ_KEY), USGS (public domain)
 * The four keyed online services above are never saved in offline packs (their terms don't
 * allow bulk saving); they are kept only in the short in-memory tile cache while viewing.
 */
const ENV = (import.meta.env ?? {}) as Record<string, string | undefined>;
const MAPTILER_KEY = ENV.VITE_MAPTILER_KEY || "";
const ESRI_KEY = ENV.VITE_ESRI_KEY || "";
const GOOGLE_KEY = ENV.VITE_GOOGLE_TILES_KEY || "";
const AZURE_KEY = ENV.VITE_AZURE_MAPS_KEY || "";
const MAPBOX_TOKEN = ENV.VITE_MAPBOX_TOKEN || "";
const HERE_KEY = ENV.VITE_HERE_KEY || "";
const LINZ_KEY = ENV.VITE_LINZ_KEY || "";
export const LICENSED_IMAGERY_ONLY = ENV.VITE_LICENSED_IMAGERY_ONLY === "1";

export type ImageryId =
  | "auto"
  | "google"
  | "maxar"
  | "clarity"
  | "bing"
  | "sentinel"
  | "maptiler"
  | "mapbox"
  | "here"
  | "gov";

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
    detail: GOOGLE_KEY
      ? "Sharpest close-in photo. Online only: Google doesn't allow saving it to the phone."
      : "Sharpest close-in photo. A different pass from Maxar — look for the Google mark.",
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
    name: AZURE_KEY ? "Microsoft aerial (Bing)" : "Bing Aerial",
    detail: AZURE_KEY
      ? "Bing's aerial photos through Azure Maps. A darker pass, useful when Maxar is hazy. Online only."
      : "A darker aerial pass. Useful when Maxar is hazy on the outer reef.",
    mark: "B",
    markBg: "#00809d",
    markFg: "#ffffff",
  },
  {
    id: "mapbox",
    name: "Mapbox Satellite",
    detail: "Another high-res mosaic, often a different date from Esri's. Online only.",
    mark: "X",
    markBg: "#111827",
    markFg: "#ffffff",
  },
  {
    id: "here",
    name: "HERE Satellite",
    detail: "HERE's own satellite mosaic, a further date to compare. Online only.",
    mark: "H",
    markBg: "#00afaa",
    markFg: "#0b1f1e",
  },
  {
    id: "gov",
    name: "Gov aerial: NSW, Qld, NZ, USA (free)",
    detail: "Sharp free aerial photos where a government publishes them: NSW, Queensland, New Zealand and the USA. Elsewhere another photo fills in.",
    mark: "F",
    markBg: "#7c3aed",
    markFg: "#ffffff",
  },
  {
    id: "sentinel",
    name: ENV.VITE_LICENSED_IMAGERY_ONLY === "1" ? "Sentinel-2 (2016, free)" : "Sentinel-2 cloudless",
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
  ENV.VITE_LICENSED_IMAGERY_ONLY === "1"
    ? "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg"
    : "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg";
/** Free government aerial services, chosen by where the tile is. */
export const NSW_URL = "https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Imagery/MapServer/tile/{z}/{y}/{x}";
export const QLD_IMAGE_SERVER = "https://spatial-img.information.qld.gov.au/arcgis/rest/services/Basemaps/LatestStateProgram_AllUsers/ImageServer";
export const USGS_URL = "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}";
export const LINZ_URL = "https://basemaps.linz.govt.nz/v1/tiles/aerial/WebMercatorQuad/{z}/{x}/{y}.webp";
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
/**
 * Allen Coral Atlas benthic map (sand, coral, rubble, seagrass, rock). The atlas's map service
 * address and terms must be confirmed before use, so the layer only appears when the build sets
 * VITE_BENTHIC_WMS (and VITE_BENTHIC_LAYERS).
 */
export const BENTHIC_WMS = ENV.VITE_BENTHIC_WMS || "";
export const BENTHIC_LAYERS = ENV.VITE_BENTHIC_LAYERS || "";
export const ATTR_BENTHIC = "Benthic map © Allen Coral Atlas Partnership";
export const GARMIN_SDK_URL = "https://developer.garmin.com/marine-charts/mobile";
export const GARMIN_SDK_REQUEST_URL =
  "https://www.garmin.com/en-US/forms/navionics-mobile-sdk/";

export const ATTR_ESRI = "Maxar © Esri, Maxar, Earthstar Geographics";
export const ATTR_SENTINEL =
  ENV.VITE_LICENSED_IMAGERY_ONLY === "1"
    ? "Sentinel-2 cloudless 2016 by EOX IT Services GmbH (modified Copernicus Sentinel data 2016 & 2017), CC BY 4.0"
    : "Sentinel-2 cloudless © EOX / Copernicus";
export const ATTR_GOV =
  "Aerial: © Spatial Services NSW, © State of Queensland, © LINZ (CC BY 4.0); USGS (public domain)";
export const ATTR_GOOGLE = "Imagery © Google";
export const ATTR_BING = AZURE_KEY ? "© Microsoft Azure Maps, imagery © Microsoft and its providers" : "Aerial © Microsoft";
export const ATTR_MAPBOX = "© Mapbox © Maxar © OpenStreetMap contributors";
export const ATTR_HERE = "© HERE";
export const ATTR_OPENSEAMAP = "Seamarks & depths © OpenSeaMap contributors";
export const ATTR_MAPTILER = "© MapTiler © OpenStreetMap contributors, satellite imagery providers";

export const ESRI_KEYED_URL =
  "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const MAPTILER_URL = "https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg";

export const GOOGLE_TILES_BASE = "https://tile.googleapis.com";
export const AZURE_TILE_URL = "https://atlas.microsoft.com/map/tile";
export const MAPBOX_URL = "https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg90";
export const HERE_URL = "https://maps.hereapi.com/v3/base/mc/{z}/{x}/{y}/jpeg";

/** Which keyed services this build has. */
export const KEYED = {
  google: Boolean(GOOGLE_KEY),
  azure: Boolean(AZURE_KEY),
  mapbox: Boolean(MAPBOX_TOKEN),
  here: Boolean(HERE_KEY),
} as const;

/** Whether a source may be offered in this build. */
export function sourceReady(id: SatSource): boolean {
  if (id === "maptiler") return Boolean(MAPTILER_KEY);
  if (id === "mapbox") return Boolean(MAPBOX_TOKEN);
  if (id === "here") return Boolean(HERE_KEY);
  if (id === "gov") return true;
  // The store build shows the 2016 Sentinel-2 mosaic, which is CC BY 4.0.
  if (id === "sentinel" && LICENSED_IMAGERY_ONLY) return true;
  if (id === "google" && GOOGLE_KEY) return true;
  if (id === "bing" && AZURE_KEY) return true;
  if (!LICENSED_IMAGERY_ONLY) return true;
  return id === "maxar" && Boolean(ESRI_KEY);
}

/*
 * Google Map Tiles API: tiles need a session token, made once and reused until it expires
 * (about two weeks), as Google asks. Kept in localStorage so a relaunch doesn't make a new one.
 */
type GoogleSession = { session: string; expiry: number };
let googleSession: GoogleSession | null = null;
const GOOGLE_SESSION_KEY = "anchormate-google-tiles-session";

export function parseGoogleSession(v: unknown, now = Date.now()): GoogleSession | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { session?: unknown; expiry?: unknown };
  const expiry = Number(o.expiry) * (Number(o.expiry) < 1e12 ? 1000 : 1);
  if (typeof o.session !== "string" || !o.session || !Number.isFinite(expiry)) return null;
  // Renew a day early so a session never runs out mid-passage.
  return expiry - 86_400_000 > now ? { session: o.session, expiry } : null;
}

let googlePending: Promise<boolean> | null = null;

/**
 * Make sure a Google session exists. Resolves true when Google tiles can be drawn. Every tile
 * asks at once on a cold start, so they all share one request.
 */
export function ensureGoogleSession(): Promise<boolean> {
  if (googleSession && googleSession.expiry - 86_400_000 > Date.now()) return Promise.resolve(true);
  googlePending ??= makeGoogleSession().finally(() => {
    googlePending = null;
  });
  return googlePending;
}

async function makeGoogleSession(): Promise<boolean> {
  if (!GOOGLE_KEY) return false;
  if (googleSession && googleSession.expiry - 86_400_000 > Date.now()) return true;
  try {
    const saved = parseGoogleSession(JSON.parse(localStorage.getItem(GOOGLE_SESSION_KEY) ?? "null"));
    if (saved) {
      googleSession = saved;
      return true;
    }
  } catch {
    // Storage unavailable: make a new session below.
  }
  try {
    const r = await fetch(`${GOOGLE_TILES_BASE}/v1/createSession?key=${encodeURIComponent(GOOGLE_KEY)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapType: "satellite", language: "en-AU", region: "AU" }),
    });
    if (!r.ok) return false;
    const s = parseGoogleSession(await r.json());
    if (!s) return false;
    googleSession = s;
    try {
      localStorage.setItem(GOOGLE_SESSION_KEY, JSON.stringify({ session: s.session, expiry: s.expiry }));
    } catch {
      // Fine: it is made again next launch.
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Google asks apps to show the copyright for the area in view, which its viewport call returns.
 * Empty when it can't be fetched (the static credit is shown then).
 */
export async function googleCopyright(zoom: number, b: { south: number; west: number; north: number; east: number }): Promise<string> {
  if (!GOOGLE_KEY || !googleSession) return "";
  const q = new URLSearchParams({
    session: googleSession.session,
    key: GOOGLE_KEY,
    zoom: String(Math.max(0, Math.min(22, Math.round(zoom)))),
    north: b.north.toFixed(5),
    south: b.south.toFixed(5),
    east: b.east.toFixed(5),
    west: b.west.toFixed(5),
  });
  try {
    const r = await fetch(`${GOOGLE_TILES_BASE}/tile/v1/viewport?${q.toString()}`);
    if (!r.ok) return "";
    const j = (await r.json()) as { copyright?: unknown };
    return typeof j.copyright === "string" ? j.copyright : "";
  } catch {
    return "";
  }
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
    v === "mapbox" ||
    v === "gov" ||
    v === "here" ||
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
  if (id === "mapbox") return "Mapbox";
  if (id === "here") return "HERE";
  if (id === "gov") return "Gov aerial";
  return "Sentinel";
}

function fill(template: string, x: number, y: number, z: number): string {
  return template.replace("{z}", String(z)).replace("{y}", String(y)).replace("{x}", String(x));
}

export function satTileUrl(id: SatSource, x: number, y: number, z: number): string {
  if (id === "maptiler") return `${fill(MAPTILER_URL, x, y, z)}?key=${MAPTILER_KEY}`;
  if (id === "google" && GOOGLE_KEY) {
    // No session yet: an empty URL fails fast and the layer falls back until it is ready.
    return googleSession ? `${GOOGLE_TILES_BASE}/v1/2dtiles/${z}/${x}/${y}?session=${googleSession.session}&key=${GOOGLE_KEY}` : "";
  }
  if (id === "bing" && AZURE_KEY) return azureUrl(x, y, z);
  if (id === "mapbox") return `${fill(MAPBOX_URL, x, y, z)}?access_token=${MAPBOX_TOKEN}`;
  if (id === "here") return `${fill(HERE_URL, x, y, z)}?style=satellite.day&apiKey=${HERE_KEY}`;
  if (id === "gov") return govTileUrl(x, y, z);
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

/** Which government aerial service covers a tile, by its centre. */
export function govRegion(x: number, y: number, z: number): "nsw" | "qld" | "nz" | "usa" | null {
  const n = 2 ** z;
  const lng = ((x + 0.5) / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n))) * 180) / Math.PI;
  if (lat > -48 && lat < -34 && lng > 165.5 && lng < 179) return "nz";
  if (lat > -37.6 && lat < -28.16 && lng > 140.9 && lng < 154) return "nsw";
  if (lat > -29.2 && lat < -9 && lng > 137.9 && lng < 154) return "qld";
  if (lat > 24.3 && lat < 49.5 && lng > -125 && lng < -66.5) return "usa";
  return null;
}

/** Tile edges in Web Mercator metres (for ArcGIS ImageServer exportImage). */
function tileBox3857(x: number, y: number, z: number): [number, number, number, number] {
  const size = (2 * Math.PI * 6378137) / 2 ** z;
  const west = -Math.PI * 6378137 + x * size;
  const north = Math.PI * 6378137 - y * size;
  return [west, north - size, west + size, north];
}

/** Government aerial tile URL, or "" where no free service covers the tile (another source fills in). */
export function govTileUrl(x: number, y: number, z: number): string {
  const r = govRegion(x, y, z);
  if (r === "nsw" && z <= 20) return fill(NSW_URL, x, y, z);
  if (r === "qld" && z <= 20) {
    const b = tileBox3857(x, y, z).map((v) => v.toFixed(2)).join(",");
    return `${QLD_IMAGE_SERVER}/exportImage?bbox=${b}&bboxSR=3857&imageSR=3857&size=256,256&format=jpg&f=image`;
  }
  if (r === "nz" && LINZ_KEY && z <= 21) return `${fill(LINZ_URL, x, y, z)}?api=${LINZ_KEY}`;
  if (r === "usa" && z <= 16) return fill(USGS_URL, x, y, z);
  return "";
}

function azureUrl(x: number, y: number, z: number): string {
  return `${AZURE_TILE_URL}?api-version=2024-04-01&tilesetId=microsoft.imagery&zoom=${z}&x=${x}&y=${y}&tileSize=256&subscription-key=${AZURE_KEY}`;
}

/**
 * Clearest reef photo first. Native detail in close; Clarity on the cay; Sentinel only as the base.
 * Licensed Google tiles are never mixed into Auto: Google's terms don't allow showing its
 * imagery stitched together with other providers'. Pick Google on its own instead.
 */
export function autoSatOrder(z: number): SatSource[] {
  const order: SatSource[] =
    z >= 18
      ? ["google", "maptiler", "mapbox", "gov", "bing", "here", "clarity", "maxar", "sentinel"]
      : z >= 14
        ? ["clarity", "maptiler", "mapbox", "gov", "google", "bing", "here", "maxar", "sentinel"]
        : ["sentinel", "maptiler", "mapbox", "clarity", "google", "bing", "here", "maxar"];
  return order.filter((id) => sourceReady(id) && !(id === "google" && GOOGLE_KEY));
}

/** Tile URL template ({z}/{x}/{y}) for engines that fill it themselves (the 3D view). Bing uses quadkeys, so it has none. */
export function satTileTemplate(id: SatSource): string | null {
  if (id === "google" && GOOGLE_KEY) {
    return googleSession ? `${GOOGLE_TILES_BASE}/v1/2dtiles/{z}/{x}/{y}?session=${googleSession.session}&key=${GOOGLE_KEY}` : null;
  }
  if (id === "bing" && AZURE_KEY) return azureUrl(0, 0, 0).replace("zoom=0&x=0&y=0", "zoom={z}&x={x}&y={y}");
  if (id === "mapbox") return `${MAPBOX_URL}?access_token=${MAPBOX_TOKEN}`;
  if (id === "here") return `${HERE_URL}?style=satellite.day&apiKey=${HERE_KEY}`;
  if (id === "bing" || id === "gov") return null;
  if (id === "google") return "https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}";
  if (id === "maptiler") return `${MAPTILER_URL}?key=${MAPTILER_KEY}`;
  if (id === "maxar" && ESRI_KEY) return `${ESRI_KEYED_URL}?token=${ESRI_KEY}`;
  return id === "maxar" ? ESRI_URL : id === "clarity" ? CLARITY_URL : SENTINEL_URL;
}
