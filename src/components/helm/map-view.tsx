import { useEffect, useRef } from "react";
import type {
  Coords,
  DoneCallback,
  Map as LeafletMap,
  Marker,
  Circle,
  Polyline,
  Polygon,
  Rectangle,
  TileLayer,
  LayerGroup,
  TileEvent,
  TileLayerOptions,
} from "leaflet";
import { useHelm, guidePoints, passagePoints } from "@/store/helm";
import { getReef } from "@/lib/reefs";
import { bearingDegrees, destPoint, formatHeading, formatMeters, haversineMeters, chartBearing, hullScreenHeading, lerpBearing, segmentTube, cornerIndexes, TUBE_M } from "@/lib/geo";
import { rodeDropNote, laybackM, snapToLayback, clampAlarmRadius } from "@/lib/anchor";
import { markNav } from "@/lib/steer";
import { bowFromGps, type BoatSetup } from "@/lib/boat";
import { readTile, type OfflineSource } from "@/lib/offline-tiles";
import { useWx } from "@/hooks/weather";
import {
  ATTR_BING,
  ATTR_ESRI,
  ATTR_GOOGLE,
  ATTR_OPENSEAMAP,
  ATTR_SENTINEL,
  CLOSE_ZOOM,
  DEPTH_WMS_LAYERS,
  DEPTH_WMS_URL,
  HELM_ZOOM,
  LABELS_URL,
  MAX_ZOOM,
  SEAMARK_URL,
  SENTINEL_URL,
  STUB_TILE_BYTES,
  ATTR_MAPTILER,
  ATTR_ZONING,
  ZONING_WMS_LAYERS,
  REEF_WMS_URL,
  autoSatOrder,
  satTileUrl,
  type ImageryId,
  type SatSource,
} from "@/lib/imagery";
import { squareFromCorners } from "@/lib/offline-tiles";
import { toast } from "sonner";
import { measure } from "@/lib/measure";
import { createRadar } from "@/components/helm/radar-layer";
import { radarAvailable } from "@/lib/radar";
import { createDepthLayer, type DepthLook } from "@/components/helm/depth-layer";
import { createHazardLayer } from "@/components/helm/hazard-layer";
import { OFFICIAL_CHARTS } from "@/lib/official-charts";
import { createWxLayer } from "@/components/helm/wx-layer";
import { setViewField } from "@/lib/wx-view";
import { createChartLayer } from "@/components/helm/chart-layer";
import { loadViewField } from "@/lib/wx-map-data";
import type { WeatherField } from "@/lib/routing/field";
import { ATTR_BENTHIC, BENTHIC_LAYERS, BENTHIC_WMS } from "@/lib/imagery";

/** LatLng to put at screen centre so the boat sits just below it. */
function followCenter(
  map: LeafletMap,
  boat: { lat: number; lng: number },
  low: boolean,
): { lat: number; lng: number } {
  if (!low) return boat;
  const drop = Math.round(Math.min(150, Math.max(56, map.getSize().y * 0.16)));
  const pt = map.latLngToContainerPoint([boat.lat, boat.lng]);
  const ahead = map.containerPointToLatLng([pt.x, pt.y - drop]);
  return { lat: ahead.lat, lng: ahead.lng };
}

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

function boatHtml(heading: number, size: number, gpsX: number, gpsY: number) {
  const rot = Number.isFinite(heading) ? heading : 0;
  return `<div class="rp-boat" style="width:${size}px;height:${size}px;transform:rotate(${rot}deg);transform-origin:${gpsX}px ${gpsY}px">
    <svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">
      <path class="rp-boat-hull" d="M20 2 L32 34 L20 28 L8 34 Z"/>
      <circle class="rp-boat-gps" cx="${(gpsX / size) * 40}" cy="${(gpsY / size) * 40}" r="2.4"/>
    </svg>
  </div>`;
}

function loaPixels(lat: number, zoom: number, loaM: number, sun: boolean) {
  const mPerPx =
    (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** zoom);
  const px = loaM / Math.max(mPerPx, 0.08);
  return Math.round(Math.min(160, Math.max(sun ? 48 : 36, px)));
}

function gpsAnchorPx(size: number, hull: BoatSetup) {
  const gpsY = Math.max(
    3,
    Math.min(size - 3, (hull.gpsFromBowM / Math.max(1, hull.loaM)) * size),
  );
  const gpsX =
    size / 2 +
    (hull.gpsFromCenterM / Math.max(0.4, hull.beamM)) * (size * 0.28);
  return { gpsX, gpsY };
}

function pinHtml(kind: "anchor" | "wp" | "rim", label?: string, next?: boolean) {
  if (kind === "anchor") {
    return `<div class="rp-pin rp-pin-anchor"><svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 2a3 3 0 0 1 1 5.83V11h3v2h-3.1A6.5 6.5 0 0 1 18 19h-2a4.5 6.5 0 0 0-8 0H6a6.5 6.5 0 0 1 5.1-6H8v-2h3V7.83A3 3 0 0 1 12 2Z"/></svg></div>`;
  }
  if (kind === "rim") {
    return `<div class="rp-rim"></div>`;
  }
  const named = label === "Start" || label === "Stop";
  return `<div class="rp-pin rp-pin-wp${named ? " rp-pin-end" : ""}${next ? " rp-pin-next" : ""}">${label ?? ""}</div>`;
}

export function zoomBy(delta: 1 | -1) {
  window.dispatchEvent(new CustomEvent("rp-zoom", { detail: delta }));
}

export function closeInOnBoat() {
  window.dispatchEvent(new CustomEvent("rp-close-in"));
}

type SeaSetPaint = {
  lat: number;
  lng: number;
  kn: number;
  screenDeg: number;
} | null;

let paintSeaSet: ((v: SeaSetPaint) => void) | null = null;

export function setSeaSetOverlay(v: SeaSetPaint) {
  paintSeaSet?.(v);
}

type ChartBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
  zoom: number;
};

let chartBounds: ChartBounds | null = null;

export function getChartBounds(): ChartBounds | null {
  return chartBounds;
}

/** Which satellite source painted the tile under the chart centre (Auto mixes sources). */
export function centreTileSource(): string | null {
  const box = document.querySelector<HTMLElement>(".leaflet-container");
  if (!box) return null;
  const r = box.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (const img of document.querySelectorAll<HTMLImageElement>(".leaflet-tile-pane img[data-sat]")) {
    const t = img.getBoundingClientRect();
    if (cx >= t.left && cx < t.right && cy >= t.top && cy < t.bottom && img.style.opacity !== "0") return img.dataset.sat ?? null;
  }
  return null;
}

const TRANSPARENT_GIF =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const satEpoch = 0;
const memTiles = new Map<string, Blob>();

function rememberTile(key: string | undefined, blob: Blob) {
  if (!key) return;
  memTiles.set(key, blob);
  if (memTiles.size > 480) {
    const first = memTiles.keys().next().value;
    if (first) memTiles.delete(first);
  }
}

type LeafletNS = typeof import("leaflet");

function leafletFrom(mod: unknown): LeafletNS {
  const m = mod as LeafletNS & { default?: LeafletNS & { default?: LeafletNS } };
  if (typeof m.TileLayer === "function" && typeof m.map === "function") return m;
  if (typeof m.default?.TileLayer === "function" && typeof m.default.map === "function") {
    return m.default;
  }
  if (typeof m.default?.default?.TileLayer === "function") return m.default.default;
  throw new Error("Leaflet TileLayer missing");
}

/** One tiny reusable canvas for the placeholder test (was one new canvas per tile). */
let probe: CanvasRenderingContext2D | null = null;
function probeCtx(): CanvasRenderingContext2D | null {
  if (probe) return probe;
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  probe = canvas.getContext("2d", { willReadFrequently: true });
  return probe;
}

/** Light grey "no imagery" tiles are tiny and flat. Real ocean can be small and dark — keep those. */
async function isPlaceholder(blob: Blob): Promise<boolean> {
  if (blob.size < 400) return true;
  if (blob.size > 6000) return false;
  try {
    const bmp = await createImageBitmap(blob);
    const g = probeCtx();
    if (!g) {
      bmp.close();
      return false;
    }
    g.clearRect(0, 0, 8, 8);
    g.drawImage(bmp, 0, 0, 8, 8);
    bmp.close();
    const d = g.getImageData(0, 0, 8, 8).data;
    let n = 0;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let min = 255;
    let max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const y = (d[i]! + d[i + 1]! + d[i + 2]!) / 3;
      if (y < min) min = y;
      if (y > max) max = y;
      sr += d[i]!;
      sg += d[i + 1]!;
      sb += d[i + 2]!;
      n += 1;
    }
    const ar = sr / n;
    const ag = sg / n;
    const ab = sb / n;
    const grey = Math.abs(ar - ag) < 14 && Math.abs(ag - ab) < 14;
    const light = (ar + ag + ab) / 3 > 150;
    return grey && light && max - min < 18;
  } catch {
    return blob.size < STUB_TILE_BYTES;
  }
}

async function fetchRealTile(
  url: string,
  cacheKey?: string,
  signal?: AbortSignal,
): Promise<Blob | null> {
  if (cacheKey) {
    const mem = memTiles.get(cacheKey);
    if (mem) return mem;
    const hit = await readTile(cacheKey);
    if (hit && !(await isPlaceholder(hit))) {
      rememberTile(cacheKey, hit);
      return hit;
    }
  }
  try {
    if (signal?.aborted) return null;
    const r = await fetch(url, { mode: "cors", signal });
    if (!r.ok) return null;
    const blob = await r.blob();
    if (await isPlaceholder(blob)) return null;
    rememberTile(cacheKey, blob);
    return blob;
  } catch {
    return null;
  }
}

/** Tiles that scroll away mid-download are aborted so the visible ones load first. */
const tileAborts = new WeakMap<HTMLElement, AbortController>();

/** The quarter of a tile one zoom level up, scaled to a full tile. */
async function cropQuadrant(blob: Blob, qx: number, qy: number): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const half = bmp.width / 2;
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const g = c.getContext("2d");
    if (!g) {
      bmp.close();
      return null;
    }
    g.imageSmoothingQuality = "high";
    g.drawImage(bmp, qx * half, qy * half, half, half, 0, 0, c.width, c.height);
    bmp.close();
    return await new Promise((resolve) => c.toBlob((b) => resolve(b), "image/jpeg", 0.92));
  } catch {
    return null;
  }
}

type TileSource = { id: string; url: string; cacheKey?: string };

function loadSatTile(
  tile: HTMLImageElement,
  sources: TileSource[],
  done: DoneCallback,
  /** Same place one zoom level down: used when no source has this tile (sharp mode offline, coverage gaps). */
  parent?: { sources: TileSource[]; qx: number; qy: number },
) {
  const ctrl = new AbortController();
  tileAborts.set(tile, ctrl);
  const ok = () => done(undefined, tile);
  const blank = () => {
    tile.src = TRANSPARENT_GIF;
    tile.onload = ok;
  };
  const paint = (blob: Blob, id: string) => {
    if (tile.dataset.gen !== String(satEpoch)) return;
    const obj = URL.createObjectURL(blob);
    tile.dataset.blob = obj;
    tile.dataset.sat = id;
    tile.onload = ok;
    tile.onerror = blank;
    tile.src = obj;
  };

  void (async () => {
    for (const src of sources) {
      if (tile.dataset.gen !== String(satEpoch) || ctrl.signal.aborted) return;
      const blob = await fetchRealTile(src.url, src.cacheKey, ctrl.signal);
      if (!blob) continue;
      paint(blob, src.id);
      return;
    }
    if (parent) {
      for (const src of parent.sources) {
        if (tile.dataset.gen !== String(satEpoch) || ctrl.signal.aborted) return;
        const blob = await fetchRealTile(src.url, src.cacheKey, ctrl.signal);
        if (!blob) continue;
        const part = await cropQuadrant(blob, parent.qx, parent.qy);
        if (!part) continue;
        paint(part, src.id);
        return;
      }
    }
    if (tile.dataset.gen !== String(satEpoch) || ctrl.signal.aborted) return;
    const first = sources[0];
    if (!first) {
      blank();
      return;
    }
    tile.dataset.sat = first.id;
    tile.onload = ok;
    tile.onerror = blank;
    tile.src = first.url;
  })();
}

function satLayer(
  L: LeafletNS,
  url: string,
  opts: {
    maxNativeZoom: number;
    attribution: string;
    skipStubs?: boolean;
    pane?: string;
    opacity?: number;
    subdomains?: string;
    tileUrl?: (coords: Coords) => string;
    cacheSource?: OfflineSource;
    /** Tried in order. First real photo wins. Sentinel-only passes one. */
    sources?: (coords: Coords) => { id: string; url: string; cacheKey?: string }[];
    /**
     * Sharp mode for high-density screens: 128 px tiles from one zoom level deeper, so each
     * photo pixel lands on one screen pixel instead of being stretched 2–3×.
     */
    hd?: boolean;
  },
): TileLayer {
  const hd = Boolean(opts.hd && opts.sources);
  const options: TileLayerOptions = {
    maxZoom: MAX_ZOOM,
    maxNativeZoom: hd ? opts.maxNativeZoom - 1 : opts.maxNativeZoom,
    ...(hd ? { tileSize: 128, zoomOffset: 1 } : {}),
    minZoom: 3,
    detectRetina: false,
    keepBuffer: 6,
    updateWhenIdle: false,
    // Fetching every in-between level during a pinch stutters on phones; load when the zoom settles.
    updateWhenZooming: false,
    attribution: opts.attribution,
    errorTileUrl: TRANSPARENT_GIF,
    opacity: opts.opacity ?? 1,
    className: "rp-sat-tile",
  };
  if (opts.pane) options.pane = opts.pane;
  if (opts.subdomains) options.subdomains = opts.subdomains;

  if (!opts.skipStubs && !opts.tileUrl && !opts.sources) {
    return L.tileLayer(url, options);
  }

  const proto: {
    getTileUrl?: (coords: Coords) => string;
    createTile?: (coords: Coords, done: DoneCallback) => HTMLElement;
  } = {};

  if (opts.tileUrl) {
    const custom = opts.tileUrl;
    proto.getTileUrl = function (coords: Coords) {
      return custom(coords);
    };
  }

  if (opts.skipStubs || opts.cacheSource || opts.sources) {
    proto.createTile = function (
      this: TileLayer,
      coords: Coords,
      done: DoneCallback,
    ) {
      const tile = document.createElement("img");
      tile.alt = "";
      tile.dataset.gen = String(satEpoch);
      tile.setAttribute("role", "presentation");
      // Leaflet's coords.z leaves out zoomOffset; the tile servers need the real level.
      const at = hd ? ({ x: coords.x, y: coords.y, z: coords.z + 1 } as Coords) : coords;
      const list = opts.sources
        ? opts.sources(at)
        : [
            {
              id: opts.cacheSource ?? "sat",
              url: this.getTileUrl(coords),
              cacheKey: opts.cacheSource
                ? `${opts.cacheSource}/${coords.z}/${coords.x}/${coords.y}`
                : undefined,
            },
          ];
      const cached = list.find((src) => src.cacheKey && memTiles.has(src.cacheKey));
      if (cached?.cacheKey) {
        const blob = memTiles.get(cached.cacheKey);
        if (blob) {
          const obj = URL.createObjectURL(blob);
          tile.dataset.blob = obj;
          tile.dataset.sat = cached.id;
          tile.onload = () => done(undefined, tile);
          tile.onerror = () => {
            tile.src = TRANSPARENT_GIF;
            tile.onload = () => done(undefined, tile);
          };
          tile.src = obj;
          return tile;
        }
      }
      tile.src = TRANSPARENT_GIF;
      const parent =
        opts.sources && at.z > 3
          ? {
              sources: opts.sources({ x: at.x >> 1, y: at.y >> 1, z: at.z - 1 } as Coords),
              qx: at.x & 1,
              qy: at.y & 1,
            }
          : undefined;
      loadSatTile(tile, list, done, parent);
      return tile;
    };
  }

  const Ctor = L.TileLayer.extend(proto) as unknown as new (
    template: string,
    layerOpts?: TileLayerOptions,
  ) => TileLayer;
  const layer = new Ctor(url, options);
  layer.on("tileunload", (e: TileEvent) => {
    tileAborts.get(e.tile)?.abort();
    tileAborts.delete(e.tile);
    const blob = e.tile.dataset.blob;
    if (blob) URL.revokeObjectURL(blob);
  });
  return layer;
}

function tileChoice(id: SatSource, coords: Coords) {
  return [
    {
      id,
      url: satTileUrl(id, coords.x, coords.y, coords.z),
      cacheKey: `${id}/${coords.z}/${coords.x}/${coords.y}`,
    },
  ];
}

function nativeZoom(id: ImageryId): number {
  if (id === "google" || id === "auto") return 21;
  if (id === "maptiler") return 20;
  if (id === "bing") return 19;
  return 18;
}

export function MapView() {
  const hostRef = useRef<HTMLDivElement>(null);
  const wx = useWx();
  const boat = useHelm((s) => s.boat ?? s.lastFix);
  const chartUp = useHelm((s) => s.chartUp);

  useEffect(() => {
    const sea = wx.data?.sea;
    if (
      !boat ||
      sea?.currentKn == null ||
      sea.currentDir == null ||
      sea.currentKn < 0.2
    ) {
      setSeaSetOverlay(null);
      return;
    }
    const screen = sea.currentDir - chartBearing(chartUp, boat.heading);
    setSeaSetOverlay({
      lat: boat.lat,
      lng: boat.lng,
      kn: sea.currentKn,
      screenDeg: screen,
    });
  }, [wx.data, boat, chartUp]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let stopRadar = () => {};
    let stopWx = () => {};
    let map: LeafletMap | null = null;
    let unsub: () => void = () => {};

    void import("leaflet").then(async (mod) => {
        if (cancelled || !hostRef.current) return;
        const L = leafletFrom(mod);
        (window as unknown as { L: LeafletNS }).L = L;
        await import("leaflet-rotate");
        if (cancelled || !hostRef.current) return;

        const primary = cssVar("--color-primary", "#3ee0c0");
        const danger = cssVar("--color-destructive", "#ff5a6a");
        const fg = cssVar("--color-foreground", "#e6f3ef");
        const sunMark = cssVar("--color-sun-mark", "#f4fff8");
        const sunInk = cssVar("--color-sun-ink", "#041016");

        map = L.map(hostRef.current, {
          zoomControl: false,
          attributionControl: true,
          maxZoom: MAX_ZOOM,
          minZoom: 3,
          worldCopyJump: false,
          zoomSnap: 0.25,
          zoomDelta: 0.5,
          fadeAnimation: true,
          zoomAnimation: true,
          dragging: true,
          tapTolerance: 20,
          inertia: true,
          inertiaDeceleration: 1800,
          bounceAtZoomLimits: false,
          rotate: true,
          rotateControl: false,
          bearing: 0,
          touchRotate: false,
          shiftKeyRotate: false,
          compassBearing: false,
        } as Parameters<LeafletNS["map"]>[1]);
        const mapDrag = map.dragging as typeof map.dragging & {
          moving?: () => boolean;
          _draggable?: { options: { clickTolerance: number } };
        };
        if (mapDrag._draggable) mapDrag._draggable.options.clickTolerance = 1;
        // Credits: one line on wide screens; tap or hover to read them all.
        const credits = map.attributionControl?.getContainer();
        if (credits) {
          credits.tabIndex = 0;
          credits.title = "Map credits";
          L.DomEvent.on(credits, "click", () => credits.classList.toggle("rp-open"));
        }

        const rotatePane = map.getPane("rotatePane") ?? map.getPane("mapPane");
        map.createPane("satOverlay", rotatePane);
        const overlayPane = map.getPane("satOverlay");
        if (overlayPane) overlayPane.style.zIndex = "250";
        map.createPane("satHi", rotatePane);
        const hiPane = map.getPane("satHi");
        if (hiPane) hiPane.style.zIndex = "260";
        map.createPane("chartOverlay", rotatePane);
        const chartPane = map.getPane("chartOverlay");
        if (chartPane) chartPane.style.zIndex = "270";

        let activeImagery: ImageryId = useHelm.getState().imagery;
        const attrOne = (id: Exclude<ImageryId, "auto">) =>
          id === "google"
            ? ATTR_GOOGLE
            : id === "bing"
              ? ATTR_BING
              : id === "sentinel"
                ? ATTR_SENTINEL
                : id === "maptiler"
                  ? ATTR_MAPTILER
                  : ATTR_ESRI;
        // Auto credits every source it may draw from in this build.
        const attrFor = (id: ImageryId) =>
          id === "auto"
            ? [...new Set(autoSatOrder(18).concat(autoSatOrder(12)).map(attrOne))].join(" · ")
            : attrOne(id);
        const sourcesFor = (id: ImageryId) => (c: Coords) =>
          id === "auto"
            ? autoSatOrder(c.z).map((src) => ({
                id: src,
                url: satTileUrl(src, c.x, c.y, c.z),
                cacheKey: `${src}/${c.z}/${c.x}/${c.y}`,
              }))
            : tileChoice(id, c);
        let activeHd = useHelm.getState().sharpTiles;
        let photo = satLayer(L, SENTINEL_URL, {
          maxNativeZoom: nativeZoom(activeImagery),
          attribution: attrFor(activeImagery),
          sources: sourcesFor(activeImagery),
          hd: activeHd,
        });
        photo.addTo(map);
        let incoming: TileLayer | null = null;
        const labels: TileLayer = L.tileLayer(LABELS_URL, {
          maxZoom: MAX_ZOOM,
          maxNativeZoom: 19,
          detectRetina: false,
          opacity: 0.9,
          pane: "satHi",
        });
        const sea: TileLayer = L.tileLayer(SEAMARK_URL, {
          maxZoom: 18,
          opacity: 0.95,
          pane: "chartOverlay",
          attribution: ATTR_OPENSEAMAP,
        });
        const depths: TileLayer = L.tileLayer.wms(DEPTH_WMS_URL, {
          layers: DEPTH_WMS_LAYERS,
          format: "image/png",
          transparent: true,
          version: "1.1.0",
          maxZoom: MAX_ZOOM,
          opacity: 0.85,
          pane: "chartOverlay",
          attribution: ATTR_OPENSEAMAP,
        });

        // Reefs, drying reef, rocks and cays from the bundled GBRMPA file (works offline).
        const reefs = createHazardLayer(L, MAX_ZOOM);
        // Free official charts (NOAA in the USA): one WMS layer per covered area, so nothing
        // is requested outside it. Under the reef outlines and seamarks.
        const official = L.layerGroup(
          OFFICIAL_CHARTS.flatMap((c) =>
            c.boxes.map(([w, s, e, n]) =>
              L.tileLayer.wms(c.url, {
                layers: c.layers,
                format: "image/png",
                transparent: true,
                version: c.version,
                maxZoom: MAX_ZOOM,
                minZoom: c.minZoom,
                bounds: L.latLngBounds([s, w], [n, e]),
                pane: "chartOverlay",
                attribution: c.attribution,
                zIndex: 0,
              }),
            ),
          ),
        );
        let officialOn = false;
        let reefsOn = false;
        // Under the reef outlines and seamarks, translucent so the satellite still reads.
        const zones: TileLayer = L.tileLayer.wms(REEF_WMS_URL, {
          layers: ZONING_WMS_LAYERS,
          format: "image/png",
          transparent: true,
          version: "1.1.1",
          maxZoom: MAX_ZOOM,
          opacity: 0.4,
          pane: "chartOverlay",
          attribution: ATTR_ZONING,
        });
        let zonesOn = false;
        const radar = createRadar(L, map, MAX_ZOOM);
        // Seabed overlay: depth shading or too-shallow-for-my-draft at the tide now.
        const depthLook = (): DepthLook => {
          const st = useHelm.getState();
          return {
            mode: st.depthLayer === "shallow" ? "shallow" : "depth",
            tideMsl: st.tideNowMsl ?? 0,
            limitM: st.hull.draftM + 0.5,
          };
        };
        const depthLayer = createDepthLayer(L, MAX_ZOOM, depthLook);
        let depthStamp = "";
        let chartLayer: import("leaflet").Layer | null = null;
        let chartStamp = "photo";
        let chartToken = 0;
        // Weather on the chart: grid for the view, loaded when a layer is on and after panning away.
        const wxLayer = createWxLayer(L, map);
        let wxField: WeatherField | null = null;
        let wxLoading = false;
        let wxProbeMarker: import("leaflet").Marker | null = null;
        const wxCovers = (f: WeatherField | null) => {
          if (!f || !map) return false;
          const b = map.getBounds();
          return (
            f.lat0 <= b.getSouth() &&
            f.lat0 + (f.ny - 1) * f.dLat >= b.getNorth() &&
            f.lng0 <= b.getWest() &&
            f.lng0 + (f.nx - 1) * f.dLng >= b.getEast()
          );
        };
        const wxLoad = () => {
          const st = useHelm.getState();
          if (!map || st.wxMapLayer === "off" || wxLoading || wxCovers(wxField)) return;
          wxLoading = true;
          st.setWxMap({ wxMapInfo: { source: "loading", fetchedAt: null, times: wxField?.times ?? [] } });
          const b = map.getBounds();
          void loadViewField({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() })
            .then((r) => {
              wxField = r?.field ?? wxField;
              setViewField(wxField);
              useHelm.getState().setWxMap({
                wxMapInfo: r
                  ? { source: r.source, fetchedAt: r.field.fetchedAt ?? null, times: r.field.times }
                  : { source: "none", fetchedAt: null, times: [] },
              });
            })
            .finally(() => {
              wxLoading = false;
              const s2 = useHelm.getState();
              wxLayer.set({ layer: s2.wxMapLayer, style: s2.wxMapStyle, at: s2.wxMapAt, field: wxField });
            });
        };
        map.on("moveend", wxLoad);
        stopWx = () => {
          map?.off("moveend", wxLoad);
          wxLayer.destroy();
        };
        // Allen Coral Atlas sand / coral / seagrass, only when the build names its map service.
        const benthic: TileLayer | null = BENTHIC_WMS
          ? L.tileLayer.wms(BENTHIC_WMS, {
              layers: BENTHIC_LAYERS,
              format: "image/png",
              transparent: true,
              version: "1.1.1",
              maxZoom: MAX_ZOOM,
              opacity: 0.55,
              pane: "chartOverlay",
              attribution: ATTR_BENTHIC,
            })
          : null;
        stopRadar = () => radar.destroy();

        L.control
          .scale({ metric: true, imperial: false, position: "bottomright" })
          .addTo(map);

        const boatIcon = (
          heading: number,
          sun: boolean,
          hull: BoatSetup,
          lat: number,
          zoom: number,
        ) => {
          const size = loaPixels(lat, zoom, hull.loaM, sun);
          const { gpsX, gpsY } = gpsAnchorPx(size, hull);
          return L.divIcon({
            className: "rp-divicon",
            html: boatHtml(heading, size, gpsX, gpsY),
            iconSize: [size, size],
            iconAnchor: [gpsX, gpsY],
          });
        };

        const boatMarker: Marker = L.marker([-23.8918, 152.3842], {
          icon: boatIcon(125, false, useHelm.getState().hull, -23.8918, HELM_ZOOM),
          zIndexOffset: 800,
          keyboard: false,
          interactive: false,
        });
        const setMarker: Marker = L.marker([-23.8918, 152.3842], {
          icon: L.divIcon({
            className: "rp-divicon",
            html: `<div class="rp-set"></div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
          zIndexOffset: 750,
          keyboard: false,
          interactive: false,
        });
        let setOn = false;
        paintSeaSet = (v) => {
          if (!map) return;
          if (!v || v.kn < 0.2) {
            if (setOn) {
              map.removeLayer(setMarker);
              setOn = false;
            }
            return;
          }
          setMarker.setLatLng([v.lat, v.lng]);
          setMarker.setIcon(
            L.divIcon({
              className: "rp-divicon",
              html: `<div class="rp-set" style="transform:rotate(${v.screenDeg}deg)"><svg viewBox="0 0 24 32" width="22" height="28"><path d="M12 2 L20 18 L14 18 L14 30 L10 30 L10 18 L4 18 Z"/></svg></div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            }),
          );
          if (!setOn) {
            setMarker.addTo(map);
            setOn = true;
          }
        };

        const accCircle: Circle = L.circle([-23.8918, 152.3842], {
          radius: 8,
          color: primary,
          weight: 1,
          fillColor: primary,
          fillOpacity: 0.12,
          interactive: false,
        });
        const anchorCircle: Circle = L.circle([0, 0], {
          radius: 40,
          color: primary,
          weight: 2,
          dashArray: "6 8",
          fillColor: primary,
          fillOpacity: 0.08,
          interactive: false,
        });
        const alarmCircle: Circle = L.circle([0, 0], {
          radius: 40,
          color: danger,
          weight: 3,
          fillColor: danger,
          fillOpacity: 0.18,
          interactive: false,
        });
        const laybackCircle: Circle = L.circle([0, 0], {
          radius: 30,
          color: primary,
          weight: 2,
          dashArray: "2 10",
          fillColor: primary,
          fillOpacity: 0.04,
          interactive: false,
        });
        const rodeLine: Polyline = L.polyline([], {
          color: primary,
          weight: 3,
          dashArray: "5 7",
          opacity: 0.95,
          interactive: false,
        });
        const hookGhost: Marker = L.marker([0, 0], {
          icon: L.divIcon({
            className: "rp-divicon",
            html: pinHtml("anchor"),
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
          interactive: false,
          opacity: 0.75,
          zIndexOffset: 550,
        });
        const anchorMarker: Marker = L.marker([0, 0], {
          icon: L.divIcon({
            className: "rp-divicon",
            html: pinHtml("anchor"),
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
          draggable: true,
          autoPan: true,
          zIndexOffset: 500,
        });
        const rimHandle: Marker = L.marker([0, 0], {
          icon: L.divIcon({
            className: "rp-divicon",
            html: pinHtml("rim"),
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          draggable: true,
          autoPan: false,
          zIndexOffset: 520,
        });
        const fencePoly: Polygon = L.polygon([], {
          color: primary,
          weight: 3,
          fillColor: primary,
          fillOpacity: 0.08,
          interactive: false,
        });
        const fenceDraftLine: Polyline = L.polyline([], {
          color: primary,
          weight: 3,
          dashArray: "6 6",
          interactive: false,
        });
        const fenceGroup: LayerGroup = L.layerGroup();
        const rangeLine: Polyline = L.polyline([], {
          color: primary,
          weight: 2,
          dashArray: "4 8",
          opacity: 0.95,
          interactive: false,
        });
        const routeLine: Polyline = L.polyline([], {
          color: primary,
          weight: 4,
          opacity: 0.95,
          lineJoin: "round",
          lineCap: "round",
        });
        const routeGlow: Polyline = L.polyline([], {
          color: fg,
          weight: 8,
          opacity: 0.22,
          lineJoin: "round",
        });
        // Passage planner: suggested route plus start (green) and finish (chequered) marks.
        const planLine: Polyline = L.polyline([], {
          color: "#f0c14a",
          weight: 4,
          opacity: 0.95,
          lineJoin: "round",
          interactive: false,
        });
        const planStart = L.circleMarker([0, 0], {
          radius: 9,
          color: "#ffffff",
          weight: 3,
          fillColor: "#2bb673",
          fillOpacity: 1,
          interactive: false,
        });
        const planFinish = L.circleMarker([0, 0], {
          radius: 9,
          color: "#ffffff",
          weight: 3,
          fillColor: "#e5484d",
          fillOpacity: 1,
          interactive: false,
        });
        let planStamp = "";
        const planCursor = L.circleMarker([0, 0], {
          radius: 7,
          color: "#071318",
          weight: 3,
          fillColor: "#f0c14a",
          fillOpacity: 1,
          interactive: false,
        });
        const draftLine: Polyline = L.polyline([], {
          color: primary,
          weight: 3,
          dashArray: "7 8",
          opacity: 0.9,
        });
        const swingLine: Polyline = L.polyline([], {
          color: primary,
          weight: 2.5,
          opacity: 0.9,
          lineJoin: "round",
          lineCap: "round",
        });
        const crumbLine: Polyline = L.polyline([], {
          color: "#f0c14a",
          weight: 3,
          opacity: 0.85,
          lineJoin: "round",
          lineCap: "round",
        });
        const mobLine: Polyline = L.polyline([], {
          color: danger,
          weight: 3,
          dashArray: "3 7",
          opacity: 0.95,
          interactive: false,
        });
        const mobMarker: Marker = L.marker([0, 0], {
          icon: L.divIcon({
            className: "rp-divicon",
            html: `<div class="rp-pin rp-pin-mob">MOB</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          }),
          interactive: false,
          zIndexOffset: 900,
        });
        // The press-and-hold pin. Tapping it reopens the spot card (PinCard).
        const wxMarker: Marker = L.marker([0, 0], {
          icon: L.divIcon({
            className: "rp-divicon",
            html: `<div class="rp-pin">◎</div>`,
            iconSize: [30, 22],
            iconAnchor: [15, 11],
          }),
          interactive: true,
          zIndexOffset: 700,
        });
        wxMarker.on("click", (ev) => {
          L.DomEvent.stop(ev);
          useHelm.setState({ pinCard: true });
        });
        const packDraftRect: Rectangle = L.rectangle(
          [
            [0, 0],
            [0, 0],
          ],
          {
            color: "#3ee0c0",
            weight: 2,
            dashArray: "6 5",
            fillOpacity: 0.08,
            interactive: false,
          },
        );
        const packGroup: LayerGroup = L.layerGroup();
        const wpGroup: LayerGroup = L.layerGroup();
        // MOB drift: where the person is likely to be at +5 / +10 / +20 min (and now).
        const mobDriftGroup: LayerGroup = L.layerGroup();
        let mobDriftStamp = "";
        // Measuring tool: line, points and a distance and bearing label on each leg.
        const measureGroup: LayerGroup = L.layerGroup();
        let measureStamp = "";
        const tubeGroup: LayerGroup = L.layerGroup();
        routeGlow.addTo(map);
        routeLine.addTo(map);
        draftLine.addTo(map);
        swingLine.addTo(map);
        planLine.addTo(map);
        crumbLine.addTo(map);
        packGroup.addTo(map);
        tubeGroup.addTo(map);
        wpGroup.addTo(map);
        fenceGroup.addTo(map);
        const gridGroup = L.layerGroup().addTo(map);
        let gridKey = "";
        const gridStep = (zoom: number) => {
          if (zoom >= 17) return 0.01;
          if (zoom >= 15) return 0.02;
          if (zoom >= 13) return 0.05;
          if (zoom >= 11) return 0.1;
          if (zoom >= 9) return 0.25;
          return 1;
        };
        const gridText = (deg: number, step: number, hem: string) => {
          const a = Math.abs(deg);
          if (step >= 1) return `${Math.round(a)}°${hem}`;
          const d = Math.floor(a + 1e-8);
          const minutes = (a - d) * 60;
          const shown = step >= 0.05 ? minutes.toFixed(0) : minutes.toFixed(1);
          return `${d}°${shown}'${hem}`;
        };
        const paintGrid = () => {
          if (!map) return;
          const chart = map;
          if (!useHelm.getState().graticule) {
            if (gridKey) {
              gridGroup.clearLayers();
              gridKey = "";
            }
            return;
          }
          const view = chart.getBounds();
          let step = gridStep(chart.getZoom());
          const spanLat = view.getNorth() - view.getSouth();
          const spanLng = view.getEast() - view.getWest();
          while (spanLat / step > 8 || spanLng / step > 8) step *= 2;
          const south = Math.ceil(view.getSouth() / step) * step;
          const west = Math.ceil(view.getWest() / step) * step;
          const bearing = Math.round(
            (chart as LeafletMap & { getBearing?: () => number }).getBearing?.() ?? 0,
          );
          const key = `${step.toFixed(5)}|${south.toFixed(4)}|${west.toFixed(4)}|${view.getNorth().toFixed(2)}|${view.getEast().toFixed(2)}|${Math.round(chart.getSize().x)}|${bearing}`;
          if (key === gridKey) return;
          gridKey = key;
          gridGroup.clearLayers();
          const line = {
            color: "rgba(255,255,255,0.8)",
            weight: 1,
            opacity: 0.9,
            interactive: false,
          };
          const size = chart.getSize();
          const box = {
            x0: 72,
            y0: 86,
            x1: Math.max(120, size.x - 60),
            y1: Math.max(160, size.y - 124),
          };
          const cross = (ax: number, ay: number, bx: number, by: number) => {
            const hits: { x: number; y: number }[] = [];
            const edges: [number, number, number, number][] = [
              [box.x0, box.y0, box.x1, box.y0],
              [box.x1, box.y0, box.x1, box.y1],
              [box.x1, box.y1, box.x0, box.y1],
              [box.x0, box.y1, box.x0, box.y0],
            ];
            for (const [cx, cy, dx, dy] of edges) {
              const rx = bx - ax;
              const ry = by - ay;
              const qx = dx - cx;
              const qy = dy - cy;
              const den = rx * qy - ry * qx;
              if (Math.abs(den) < 1e-6) continue;
              const t = ((cx - ax) * qy - (cy - ay) * qx) / den;
              const u = ((cx - ax) * ry - (cy - ay) * rx) / den;
              if (t >= 0 && t <= 1 && u >= 0 && u <= 1) hits.push({ x: ax + t * rx, y: ay + t * ry });
            }
            return hits;
          };
          const tagAt = (text: string, x: number, y: number, anchor: [number, number]) => {
            const ll = chart.containerPointToLatLng(L.point(x, y));
            L.marker(ll, {
              interactive: false,
              keyboard: false,
              icon: L.divIcon({
                className: "rp-divicon",
                html: `<span class="rp-grid-label">${text}</span>`,
                iconSize: [78, 16],
                iconAnchor: anchor,
              }),
            }).addTo(gridGroup);
          };
          for (let lat = south; lat < view.getNorth(); lat += step) {
            L.polyline(
              [
                [lat, view.getWest()],
                [lat, view.getEast()],
              ],
              line,
            ).addTo(gridGroup);
            const a = chart.latLngToContainerPoint([lat, view.getWest()]);
            const b = chart.latLngToContainerPoint([lat, view.getEast()]);
            const hits = cross(a.x, a.y, b.x, b.y).sort((p, q) => p.x - q.x);
            const at = hits[0];
            if (at) tagAt(gridText(lat, step, lat >= 0 ? "N" : "S"), at.x, at.y, [0, 8]);
          }
          for (let lng = west; lng < view.getEast(); lng += step) {
            L.polyline(
              [
                [view.getSouth(), lng],
                [view.getNorth(), lng],
              ],
              line,
            ).addTo(gridGroup);
            const a = chart.latLngToContainerPoint([view.getSouth(), lng]);
            const b = chart.latLngToContainerPoint([view.getNorth(), lng]);
            const hits = cross(a.x, a.y, b.x, b.y).sort((p, q) => p.y - q.y);
            const at = hits[0];
            if (at) tagAt(gridText(lng, step, lng >= 0 ? "E" : "W"), at.x, at.y, [39, 0]);
          }
        };
        map.on("moveend", paintGrid);
        map.on("zoomend", paintGrid);

        const start = useHelm.getState();
        const reef = getReef(start.reefId);
        const origin = start.boat ?? start.flyTo ?? reef;
        const zoom = start.boat
          ? HELM_ZOOM
          : (start.flyTo?.zoom ?? reef.zoom);
        map.setView([origin.lat, origin.lng], zoom);
        useHelm.getState().setChartZoom(map.getZoom());

        let lastFly = 0;
        let labelsOn = false;
        let seaOn = false;
        let depthsOn = false;
        let anchorOn = false;
        let alarmShown = false;
        let followArmed = false;
        let boatOn = false;
        let laybackOn = false;
        let rodeOn = false;
        let ghostOn = false;
        let hookDragging = false;
        let rimDragging = false;
        let rimOn = false;
        let fenceOn = false;
        let fenceDraftOn = false;
        let drawingStroke = false;
        let swingStamp = "";
        let mobOn = false;
        let wxOn = false;
        let displayBearing = 0;
        let applying = false;
        let applyAgain = false;
        let routeStamp = "";
        let packStamp = "";
        let boatIconKey = "";

        // Two-finger gesture guard. Follow-boat only paused for one-finger drags, so a GPS fix
        // (once a second) re-centred or rotated the chart mid-pinch: the jumpy zoom.
        let pinchTouches = 0;
        let gestureUntil = 0;
        const gesturing = () =>
          pinchTouches >= 2 ||
          Date.now() < gestureUntil ||
          Boolean((map as unknown as { _animatingZoom?: boolean })._animatingZoom);
        const setMapBearing = (deg: number) => {
          if (gesturing()) return;
          const m = map as LeafletMap & {
            setBearing?: (b: number) => void;
            getBearing?: () => number;
          };
          if (typeof m.setBearing !== "function") return;
          const cur = m.getBearing?.() ?? 0;
          const d = ((deg - cur + 540) % 360) - 180;
          if (Math.abs(d) < 0.35 && !(deg === 0 && Math.abs(cur) > 0.35)) return;
          m.setBearing(deg);
        };

        const applyImagery = (id: ImageryId, hd: boolean) => {
          if (!map || (id === activeImagery && hd === activeHd)) return;
          if (incoming) {
            map.removeLayer(incoming);
            incoming = null;
          }
          const next = satLayer(L, SENTINEL_URL, {
            maxNativeZoom: nativeZoom(id),
            attribution: attrFor(id),
            sources: sourcesFor(id),
            hd,
          });
          next.addTo(map);
          incoming = next;
          let settled = false;
          const commit = () => {
            if (settled || !map || incoming !== next) return;
            settled = true;
            if (map.hasLayer(photo)) map.removeLayer(photo);
            photo = next;
            activeImagery = id;
            activeHd = hd;
            incoming = null;
          };
          next.once("load", commit);
          window.setTimeout(() => {
            if (settled || incoming !== next || !map) return;
            const box = (next as TileLayer & { getContainer?: () => HTMLElement }).getContainer?.();
            const imgs = box ? [...box.querySelectorAll("img")] : [];
            if (imgs.length > 0 && imgs.every((img) => img.dataset.sat)) commit();
          }, 1800);
        };

        const paintWaypoints = (
          wps: Array<{ lat: number; lng: number; label?: string }>,
          pathIndex: number[],
          nextI: number | null,
        ) => {
          wpGroup.clearLayers();
          // While drawing a route, points can be dragged to adjust them.
          const editing = useHelm.getState().drawMode === "draw";
          pathIndex.forEach((src, n) => {
            const w = wps[src];
            if (!w) return;
            const next = nextI === src;
            const text = w.label === "Start" || w.label === "Stop" ? w.label : String(n + 1);
            const wide = text === "Start" || text === "Stop";
            const mk = L.marker([w.lat, w.lng], {
              icon: L.divIcon({
                className: "rp-divicon",
                html: pinHtml("wp", text, next),
                iconSize: wide ? [52, 22] : next ? [28, 28] : [22, 22],
                iconAnchor: wide ? [26, 11] : next ? [14, 14] : [11, 11],
              }),
              interactive: true,
              keyboard: false,
              draggable: editing,
              zIndexOffset: next ? 400 : 200,
            });
            if (editing) {
              mk.on("dragend", () => {
                const ll = mk.getLatLng();
                const st = useHelm.getState();
                st.setDraft(st.draft.map((p, i) => (i === src ? { ...p, lat: ll.lat, lng: ll.lng } : p)));
              });
            }
            mk.on("click", (ev) => {
              L.DomEvent.stop(ev);
              const st = useHelm.getState();
              st.setPinnedMark(st.pinnedMark === src ? null : src);
            });
            mk.addTo(wpGroup);
          });
        };

        const apply = () => {
          if (!map) return;
          if (applying) {
            applyAgain = true;
            return;
          }
          applying = true;
          try {
          const s = useHelm.getState();

          const holdMap =
            s.tapMode === "draw-pack" ||
            s.tapMode === "drop-anchor" ||
            s.tapMode === "resize-swing" ||
            hookDragging ||
            rimDragging;
          if (holdMap) {
            if (map.dragging.enabled()) map.dragging.disable();
            map.getContainer().style.touchAction = "none";
          } else if (!map.dragging.enabled()) {
            map.dragging.enable();
            map.getContainer().style.touchAction = "";
          }

          applyImagery(s.imagery, s.sharpTiles);
          // Base map: the photo is removed in Chart mode; the vector chart (or its lines) is added.
          const photoWanted = s.baseMap !== "chart";
          if (!photoWanted && map.hasLayer(photo)) map.removeLayer(photo);
          else if (photoWanted && !map.hasLayer(photo)) photo.addTo(map);
          const cStamp = s.baseMap === "photo" ? "photo" : `${s.baseMap}|${s.look === "night" ? "n" : "d"}`;
          if (cStamp !== chartStamp) {
            chartStamp = cStamp;
            const token = ++chartToken;
            if (chartLayer) {
              map.removeLayer(chartLayer);
              chartLayer = null;
            }
            if (s.baseMap !== "photo") {
              void createChartLayer(L, s.baseMap === "chart" ? "chart" : "lines", s.look === "night").then((layer) => {
                if (!map || token !== chartToken) return;
                chartLayer = layer;
                layer.addTo(map);
              });
            }
          }

          const look = s.look;
          const sun = look === "sunlight";
          const night = look === "night";
          routeLine.setStyle({
            color: sun ? sunMark : night ? "#ff6a2a" : primary,
            weight: sun ? 6 : 4,
            opacity: 0.98,
          });
          routeGlow.setStyle({
            color: sun ? sunInk : night ? "#3a1208" : fg,
            weight: sun ? 14 : 8,
            opacity: sun ? 0.92 : night ? 0.55 : 0.22,
          });
          draftLine.setStyle({
            color: sun ? sunMark : primary,
            weight: sun ? 5 : 3,
            opacity: 0.95,
          });
          swingLine.setStyle({
            color: sun ? sunMark : "#f0c14a",
            weight: sun ? 4 : 2.5,
            opacity: 0.95,
          });
          rodeLine.setStyle({
            color: sun ? sunMark : primary,
            weight: sun ? 4 : 3,
          });
          fencePoly.setStyle({
            color: sun ? sunMark : primary,
            fillColor: sun ? sunMark : primary,
          });
          fenceDraftLine.setStyle({
            color: sun ? sunMark : primary,
          });
          laybackCircle.setStyle({
            color: sun ? sunMark : primary,
            fillColor: sun ? sunMark : primary,
          });
          accCircle.setStyle({
            color: sun ? sunMark : primary,
            fillColor: sun ? sunMark : primary,
            weight: sun ? 2 : 1,
            fillOpacity: sun ? 0.18 : 0.12,
          });
          anchorCircle.setStyle({
            color: sun ? sunMark : primary,
            fillColor: sun ? sunMark : primary,
            weight: sun ? 3 : 2,
          });

          if (s.labels && s.baseMap === "photo") {
            if (!labelsOn) {
              labels.addTo(map);
              labelsOn = true;
            }
          } else if (labelsOn) {
            map.removeLayer(labels);
            labelsOn = false;
          }
          if (s.seamarks) {
            if (!seaOn) {
              sea.addTo(map);
              seaOn = true;
            }
          } else if (seaOn) {
            map.removeLayer(sea);
            seaOn = false;
          }
          if (s.depths) {
            if (!depthsOn) {
              depths.addTo(map);
              depthsOn = true;
            }
          } else if (depthsOn) {
            map.removeLayer(depths);
            depthsOn = false;
          }
          if (s.parkZones) {
            if (!zonesOn) {
              zones.addTo(map);
              zones.bringToBack();
              zonesOn = true;
            }
          } else if (zonesOn) {
            map.removeLayer(zones);
            zonesOn = false;
          }
          radar.set(s.radar && radarAvailable());
          if (s.wxMapLayer !== "off") wxLoad();
          wxLayer.set({ layer: s.wxMapLayer, style: s.wxMapStyle, at: s.wxMapAt, field: wxField });
          // The tapped weather spot: a draggable pin, only while the weather map is on.
          const probe = s.wxMapLayer !== "off" ? s.wxProbe : null;
          if (!probe) {
            if (wxProbeMarker) {
              wxProbeMarker.remove();
              wxProbeMarker = null;
            }
          } else if (!wxProbeMarker) {
            wxProbeMarker = L.marker([probe.lat, probe.lng], {
              draggable: true,
              keyboard: false,
              zIndexOffset: 1200,
              icon: L.divIcon({
                className: "rp-divicon",
                html: '<div style="width:44px;height:44px;display:grid;place-items:center"><div style="width:18px;height:18px;border-radius:50%;background:#fff;border:4px solid #111;box-shadow:0 0 0 3px rgba(255,255,255,.7)"></div></div>',
                iconSize: [44, 44],
                iconAnchor: [22, 22],
              }),
            }).addTo(map);
            wxProbeMarker.on("drag", () => {
              const ll = wxProbeMarker!.getLatLng();
              useHelm.getState().setWxMap({ wxProbe: { lat: ll.lat, lng: ll.lng } });
            });
          } else {
            const cur = wxProbeMarker.getLatLng();
            if (Math.abs(cur.lat - probe.lat) > 1e-9 || Math.abs(cur.lng - probe.lng) > 1e-9) wxProbeMarker.setLatLng([probe.lat, probe.lng]);
          }
          const dStamp =
            s.depthLayer === "off" ? "off" : `${s.depthLayer}|${(s.tideNowMsl ?? 0).toFixed(1)}|${s.hull.draftM.toFixed(1)}`;
          if (dStamp !== depthStamp) {
            const was = depthStamp;
            depthStamp = dStamp;
            if (dStamp === "off") map.removeLayer(depthLayer);
            else if (!map.hasLayer(depthLayer)) depthLayer.addTo(map);
            else if (was !== "off") depthLayer.redraw();
          }
          if (benthic) {
            if (s.benthic && !map.hasLayer(benthic)) benthic.addTo(map);
            else if (!s.benthic && map.hasLayer(benthic)) map.removeLayer(benthic);
          }
          if (s.officialCharts !== officialOn) {
            officialOn = s.officialCharts;
            if (officialOn) official.addTo(map);
            else map.removeLayer(official);
          }
          if (s.reefOutlines || s.baseMap === "chart") {
            if (!reefsOn) {
              reefs.addTo(map);
              reefsOn = true;
            }
          } else if (reefsOn) {
            map.removeLayer(reefs);
            reefsOn = false;
          }

          let framingTrack = false;
          if (s.flyTo && s.flyTo.nonce !== lastFly) {
            lastFly = s.flyTo.nonce;
            const track = s.activePassage?.waypoints ?? [];
            const box = map.getBounds();
            const already =
              s.flyTo.fit === "track" &&
              track.length >= 2 &&
              track.every((p) => box.contains([p.lat, p.lng]));
            if (s.flyTo.fit === "track" && track.length >= 2 && !already) {
              framingTrack = true;
              map.fitBounds(
                L.latLngBounds(track.map((p) => [p.lat, p.lng] as [number, number])),
                {
                  paddingTopLeft: [24, 76],
                  paddingBottomRight: [24, 108],
                  maxZoom: 18,
                  animate: true,
                },
              );
            } else if (!already) {
              const z = s.followBoat
                ? Math.max(s.flyTo.zoom, HELM_ZOOM)
                : s.flyTo.zoom;
              map.flyTo([s.flyTo.lat, s.flyTo.lng], z, { duration: 1.05 });
            }
          }

          const wantBearing = chartBearing(s.chartUp, s.boat?.heading ?? null);
          displayBearing = lerpBearing(displayBearing, wantBearing, 0.28);
          if (
            wantBearing === 0 &&
            (displayBearing < 0.5 || displayBearing > 359.5)
          ) {
            displayBearing = 0;
          }
          setMapBearing(displayBearing);

          if (s.boat) {
            boatMarker.setLatLng([s.boat.lat, s.boat.lng]);
            const iconKey = `${hullScreenHeading(s.chartUp, s.boat.heading)}|${map.getZoom().toFixed(2)}|${s.sunlight}|${s.hull.loaM}`;
            if (iconKey !== boatIconKey) {
              boatIconKey = iconKey;
              boatMarker.setIcon(
                boatIcon(
                  hullScreenHeading(s.chartUp, s.boat.heading),
                  s.sunlight,
                  s.hull,
                  s.boat.lat,
                  map.getZoom(),
                ),
              );
            }
            accCircle.setLatLng([s.boat.lat, s.boat.lng]);
            accCircle.setRadius(Math.max(4, s.boat.accuracy ?? 6));
            if (!boatOn) {
              accCircle.addTo(map);
              boatMarker.addTo(map);
              boatOn = true;
            }
            if (s.followBoat && !framingTrack && !mapDrag.moving?.() && !gesturing()) {
              if (!followArmed && map.getZoom() < HELM_ZOOM) {
                map.setView([s.boat.lat, s.boat.lng], HELM_ZOOM, { animate: false });
              }
              followArmed = true;
              const target = followCenter(map, s.boat, s.boatLow);
              map.panTo([target.lat, target.lng], {
                animate: true,
                duration: 0.35,
              });
            } else {
              followArmed = false;
            }
          } else if (boatOn) {
            map.removeLayer(boatMarker);
            map.removeLayer(accCircle);
            boatOn = false;
            followArmed = false;
          }

          const placing = s.tapMode === "drop-anchor";

          const bow = s.boat
            ? bowFromGps(s.boat, s.boat.heading, s.hull)
            : null;
          const drafting = !s.anchor && (s.anchorStep === "circle" || s.anchorStep === "watch");
          const hookAt = s.anchor ?? s.circleDraft ?? (placing ? s.hookPreview : null);
          if (bow && placing && s.swingShape !== "draw") {
            const lay = Math.max(8, laybackM(s.rode));
            laybackCircle.setLatLng([bow.lat, bow.lng]);
            laybackCircle.setRadius(lay);
            if (!laybackOn) {
              laybackCircle.addTo(map);
              laybackOn = true;
            }
          } else if (laybackOn) {
            map.removeLayer(laybackCircle);
            laybackOn = false;
          }

          if (bow && hookAt) {
            rodeLine.setLatLngs([
              [bow.lat, bow.lng],
              [hookAt.lat, hookAt.lng],
            ]);
            if (!rodeOn) {
              rodeLine.addTo(map);
              rodeOn = true;
            }
          } else if (rodeOn) {
            rodeLine.setLatLngs([]);
            map.removeLayer(rodeLine);
            rodeOn = false;
          }

          if ((placing || drafting) && (s.hookPreview || s.circleDraft)) {
            const g = s.circleDraft ?? s.hookPreview;
            if (g) hookGhost.setLatLng([g.lat, g.lng]);
            if (!ghostOn) {
              hookGhost.addTo(map);
              ghostOn = true;
            }
          } else if (ghostOn) {
            map.removeLayer(hookGhost);
            ghostOn = false;
          }

          const pts = s.activePassage
            ? guidePoints(s.activePassage, s.crumb, {
                turnDeg: s.trackTurnDeg,
                chordM: s.trackChordM,
              })
            : [];
          const stored = s.activePassage ? passagePoints(s.activePassage) : [];
          const wps =
            s.drawMode !== "idle" ? s.draft : pts;
          const nav =
            s.boat && wps.length >= 1
              ? markNav(s.boat, wps, s.pinnedMark, s.courseMark)
              : null;
          const marks =
            s.drawMode === "record"
              ? [0]
              : s.drawMode !== "idle" || pts.length <= stored.length
                ? wps.map((_, i) => i)
                : cornerIndexes(pts);
          const nextCorner =
            nav == null
              ? null
              : (marks.find((i) => i >= nav.index) ?? marks[marks.length - 1] ?? null);
          const end = pts[pts.length - 1];
          const routeKey = [
            s.activePassage && "id" in s.activePassage ? s.activePassage.id : s.activePassage?.title,
            pts.length,
            pts[0]?.lat?.toFixed(5),
            end?.lat?.toFixed(5),
            end?.lng?.toFixed(5),
            s.courseMark,
            s.drawMode,
            s.draft.length,
            s.drawMode === "draw" ? s.draft.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join(";") : s.draft[s.draft.length - 1]?.lat?.toFixed(5),
            s.pinnedMark,
            s.trackTurnDeg,
            s.trackChordM,
            s.look,
            nav?.index,
            s.crumbOn,
          ].join("|");
          if (routeKey !== routeStamp) {
            routeStamp = routeKey;
            routeLine.setLatLngs(
              pts.map((p) => [p.lat, p.lng] as [number, number]),
            );
            routeGlow.setLatLngs(
              pts.map((p) => [p.lat, p.lng] as [number, number]),
            );
            tubeGroup.clearLayers();
            const leg = nav && nav.index > 0 ? nav.index - 1 : 0;
            for (let i = 0; i < pts.length - 1; i += 1) {
              const ring = segmentTube(pts[i]!, pts[i + 1]!, TUBE_M);
              L.polygon(
                ring.map((p) => [p.lat, p.lng] as [number, number]),
                {
                  stroke: false,
                  fillColor: primary,
                  fillOpacity: i === leg ? 0.42 : 0.2,
                  interactive: false,
                },
              ).addTo(tubeGroup);
            }
            paintWaypoints(wps, marks, nextCorner);
            if (s.drawMode === "record" && s.crumbOn) {
              draftLine.setStyle({ color: "#f0c14a", dashArray: undefined, weight: 3, opacity: 0.9 });
              draftLine.setLatLngs(s.draft.map((p) => [p.lat, p.lng] as [number, number]));
            } else if (s.drawMode === "draw") {
              draftLine.setStyle({ color: primary, dashArray: "7 8", weight: 3, opacity: 0.9 });
              draftLine.setLatLngs(s.draft.map((p) => [p.lat, p.lng] as [number, number]));
            } else {
              draftLine.setLatLngs([]);
            }
          }
          const pStamp = `${s.routeStart?.lat},${s.routeStart?.lng}|${s.routeFinish?.lat},${s.routeFinish?.lng}|${s.routePreview?.length ?? 0}|${s.routePreview?.[1]?.lat ?? ""}`;
          if (pStamp !== planStamp) {
            planStamp = pStamp;
            planLine.setLatLngs((s.routePreview ?? []).map((p) => [p.lat, p.lng] as [number, number]));
            // Frame the whole route in the space above the planner sheet.
            if (s.routePreview && s.routePreview.length >= 2) {
              const h = map.getSize().y;
              map.fitBounds(
                L.latLngBounds(s.routePreview.map((p) => [p.lat, p.lng] as [number, number])),
                { paddingTopLeft: [28, 90], paddingBottomRight: [28, Math.round(h * 0.5) + 16], maxZoom: 15, animate: true },
              );
            }
            for (const [mk, at] of [
              [planStart, s.routeStart],
              [planFinish, s.routeFinish],
            ] as const) {
              if (at) {
                mk.setLatLng([at.lat, at.lng]);
                if (!map.hasLayer(mk)) mk.addTo(map);
              } else if (map.hasLayer(mk)) {
                map.removeLayer(mk);
              }
            }
          }
          if (s.routeCursor) {
            planCursor.setLatLng([s.routeCursor.lat, s.routeCursor.lng]);
            if (!map.hasLayer(planCursor)) planCursor.addTo(map);
          } else if (map.hasLayer(planCursor)) {
            map.removeLayer(planCursor);
          }
          // Measuring tool: two pins you drag anywhere; distance and bearing on the line.
          const mStamp = `${s.depthUnit}|${s.lengthUnit}|` + s.measurePts.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join("|");
          if (mStamp !== measureStamp) {
            measureStamp = mStamp;
            measureGroup.clearLayers();
            const mp = s.measurePts;
            if (mp.length === 2) {
              const shadow = L.polyline([], { color: "#000000", weight: 7, opacity: 0.45, interactive: false }).addTo(measureGroup);
              const line = L.polyline([], { color: "#ffffff", weight: 3.5, dashArray: "9 7", interactive: false }).addTo(measureGroup);
              const label = L.marker([0, 0], { interactive: false, keyboard: false, zIndexOffset: 950 }).addTo(measureGroup);
              const pins = mp.map((pt, i) =>
                L.marker([pt.lat, pt.lng], {
                  draggable: true,
                  keyboard: false,
                  zIndexOffset: 1000,
                  icon: L.divIcon({
                    className: "rp-divicon",
                    // 48 px touch area around a clear 22 px pin.
                    html: `<div style="width:48px;height:48px;display:grid;place-items:center"><div style="width:22px;height:22px;border-radius:50%;background:#fff;border:4px solid ${i === 0 ? "#0b7a6b" : "#c2410c"};box-shadow:0 0 0 2px rgba(0,0,0,.55)"></div></div>`,
                    iconSize: [48, 48],
                    iconAnchor: [24, 24],
                  }),
                }).addTo(measureGroup),
              );
              const redraw = () => {
                const a = pins[0]!.getLatLng();
                const b = pins[1]!.getLatLng();
                const ll: [number, number][] = [[a.lat, a.lng], [b.lat, b.lng]];
                shadow.setLatLngs(ll);
                line.setLatLngs(ll);
                const leg = measure([{ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }]).legs[0];
                if (!leg) return;
                label.setLatLng([(a.lat + b.lat) / 2, (a.lng + b.lng) / 2]);
                label.setIcon(
                  L.divIcon({
                    className: "rp-divicon",
                    html: `<span style="display:inline-block;transform:translate(-50%,-50%);font:600 15px system-ui;color:#fff;background:rgba(0,0,0,.8);padding:4px 9px;border-radius:8px;white-space:nowrap">${formatMeters(leg.distM)} · ${formatHeading(leg.bearing)}</span>`,
                    iconSize: [0, 0],
                    iconAnchor: [0, 0],
                  }),
                );
              };
              for (const pin of pins) {
                pin.on("drag", redraw);
                pin.on("dragend", () => {
                  const pts = pins.map((m) => ({ lat: m.getLatLng().lat, lng: m.getLatLng().lng }));
                  measureStamp = `${useHelm.getState().depthUnit}|${useHelm.getState().lengthUnit}|` + pts.map((q) => `${q.lat.toFixed(6)},${q.lng.toFixed(6)}`).join("|");
                  useHelm.setState({ measurePts: pts });
                });
              }
              redraw();
              if (!map.hasLayer(measureGroup)) measureGroup.addTo(map);
            } else if (map.hasLayer(measureGroup)) {
              map.removeLayer(measureGroup);
            }
          }
          const md = s.mob ? s.mobDrift : null;
          const mdStamp = md ? md.points.map((p) => `${p.minutes.toFixed(0)}:${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|") : "";
          if (mdStamp !== mobDriftStamp) {
            mobDriftStamp = mdStamp;
            mobDriftGroup.clearLayers();
            if (md && s.mob) {
              L.polyline([[s.mob.lat, s.mob.lng], ...md.points.map((p) => [p.lat, p.lng] as [number, number])], {
                color: "#ff5a5f",
                weight: 2,
                dashArray: "4 6",
                interactive: false,
              }).addTo(mobDriftGroup);
              for (const p of md.points) {
                L.circle([p.lat, p.lng], {
                  radius: p.radiusM,
                  color: "#ff5a5f",
                  weight: 1.5,
                  fillColor: "#ff5a5f",
                  fillOpacity: 0.12,
                  interactive: false,
                }).addTo(mobDriftGroup);
                L.marker([p.lat, p.lng], {
                  icon: L.divIcon({
                    className: "rp-divicon",
                    html: `<span style="font:600 11px system-ui;color:#fff;background:#c9363b;padding:1px 4px;border-radius:4px;white-space:nowrap">+${Math.round(p.minutes)} min</span>`,
                    iconSize: [46, 16],
                    iconAnchor: [23, -6],
                  }),
                  interactive: false,
                  keyboard: false,
                }).addTo(mobDriftGroup);
              }
              if (!map.hasLayer(mobDriftGroup)) mobDriftGroup.addTo(map);
            } else if (map.hasLayer(mobDriftGroup)) {
              map.removeLayer(mobDriftGroup);
            }
          }
          // Only clear once; redrawing an empty path on every store change was wasted work.
          if (rangeLine.getLatLngs().length) rangeLine.setLatLngs([]);
          paintGrid();
          if (crumbLine.getLatLngs().length) crumbLine.setLatLngs([]);

          if (s.anchor && s.swingTrailOn && s.swingTrail.length >= 2) {
            const last = s.swingTrail[s.swingTrail.length - 1]!;
            const stamp = `${s.swingTrail.length}:${last.lat.toFixed(5)}:${last.lng.toFixed(5)}`;
            if (stamp !== swingStamp) {
              swingStamp = stamp;
              swingLine.setLatLngs(
                s.swingTrail.map((p) => [p.lat, p.lng] as [number, number]),
              );
            }
          } else if (swingStamp) {
            swingStamp = "";
            swingLine.setLatLngs([]);
          }

          crumbLine.setLatLngs([]);

          if (s.mob) {
            mobMarker.setLatLng([s.mob.lat, s.mob.lng]);
            if (s.boat) {
              mobLine.setLatLngs([
                [s.boat.lat, s.boat.lng],
                [s.mob.lat, s.mob.lng],
              ]);
            } else {
              mobLine.setLatLngs([]);
            }
            if (!mobOn) {
              mobMarker.addTo(map);
              mobLine.addTo(map);
              mobOn = true;
            }
          } else if (mobOn) {
            map.removeLayer(mobMarker);
            map.removeLayer(mobLine);
            mobOn = false;
          }

          if (s.wxPin) {
            wxMarker.setLatLng([s.wxPin.lat, s.wxPin.lng]);
            if (!wxOn) {
              wxMarker.addTo(map);
              wxOn = true;
            }
          } else if (wxOn) {
            map.removeLayer(wxMarker);
            wxOn = false;
          }

          const packKey = [
            s.offlinePacks.map((p) => p.id).join(","),
            s.packBox ? `${s.packBox.south.toFixed(4)},${s.packBox.west.toFixed(4)}` : "",
            s.tapMode === "draw-pack" ? s.packDraft.map((p) => p.lat.toFixed(4)).join(",") : "",
          ].join("|");
          if (packKey !== packStamp) {
            packStamp = packKey;
          packGroup.clearLayers();
          for (const pack of s.offlinePacks) {
            L.rectangle(
              [
                [pack.bounds.south, pack.bounds.west],
                [pack.bounds.north, pack.bounds.east],
              ],
              {
                color: "#22c55e",
                weight: 2,
                fillColor: "#22c55e",
                fillOpacity: 0.08,
                interactive: false,
              },
            ).addTo(packGroup);
          }
          if (s.packBox) {
            L.rectangle(
              [
                [s.packBox.south, s.packBox.west],
                [s.packBox.north, s.packBox.east],
              ],
              {
                color: "#3ee0c0",
                weight: 2,
                dashArray: "5 4",
                fillOpacity: 0.1,
                interactive: false,
              },
            ).addTo(packGroup);
          }
          if (s.tapMode === "draw-pack" && s.packDraft.length >= 1) {
            const a = s.packDraft[0]!;
            const b = s.packDraft[1] ?? a;
            const box = squareFromCorners(a, b);
            packDraftRect.setBounds([
              [box.south, box.west],
              [box.north, box.east],
            ]);
            if (!map.hasLayer(packDraftRect)) packDraftRect.addTo(map);
          } else if (map.hasLayer(packDraftRect)) {
            map.removeLayer(packDraftRect);
          }
          }

          if (s.anchor && !placing) {
            anchorCircle.setLatLng([s.anchor.lat, s.anchor.lng]);
            anchorCircle.setRadius(s.anchor.radiusM);
            alarmCircle.setLatLng([s.anchor.lat, s.anchor.lng]);
            alarmCircle.setRadius(s.anchor.radiusM);
            if (!hookDragging) {
              anchorMarker.setLatLng([s.anchor.lat, s.anchor.lng]);
            }
            if (s.anchor.radiusLocked) anchorMarker.dragging?.disable();
            else anchorMarker.dragging?.enable();
            if (!anchorOn) {
              anchorCircle.addTo(map);
              anchorMarker.addTo(map);
              anchorOn = true;
            }
            const fenced = Boolean(s.anchor.fence && s.anchor.fence.length >= 3);
            if (s.alarmOn && !fenced && !alarmShown) {
              alarmCircle.addTo(map);
              alarmShown = true;
            } else if ((!s.alarmOn || fenced) && alarmShown) {
              map.removeLayer(alarmCircle);
              alarmShown = false;
            }

            if (!rimDragging && !fenced) {
              const brg = s.boat
                ? bearingDegrees(s.anchor, s.boat)
                : 0;
              const rim = destPoint(s.anchor, brg, s.anchor.radiusM);
              rimHandle.setLatLng([rim.lat, rim.lng]);
              rimHandle.dragging?.enable();
              if (!rimOn) {
                rimHandle.addTo(map);
                rimOn = true;
              }
            } else if (fenced && rimOn) {
              map.removeLayer(rimHandle);
              rimOn = false;
            }

            if (fenced) {
              fencePoly.setLatLngs(
                s.anchor.fence!.map((p) => [p.lat, p.lng] as [number, number]),
              );
              fencePoly.setStyle({
                color: s.alarmOn ? danger : sun ? sunMark : primary,
                fillColor: s.alarmOn ? danger : sun ? sunMark : primary,
                fillOpacity: s.alarmOn ? 0.2 : 0.14,
                weight: 3,
              });
              if (!fenceOn) {
                fencePoly.addTo(map);
                fenceOn = true;
              }
            } else if (fenceOn) {
              map.removeLayer(fencePoly);
              fenceOn = false;
            }
          } else if (anchorOn) {
            map.removeLayer(anchorCircle);
            map.removeLayer(anchorMarker);
            if (alarmShown) map.removeLayer(alarmCircle);
            if (rimOn) map.removeLayer(rimHandle);
            if (fenceOn) map.removeLayer(fencePoly);
            anchorOn = false;
            alarmShown = false;
            rimOn = false;
            fenceOn = false;
          }

          const swingInk = s.anchorStep === "circle" && s.swingShape === "draw";
          if (drafting && s.circleDraft && !swingInk) {
            anchorCircle.setLatLng([s.circleDraft.lat, s.circleDraft.lng]);
            anchorCircle.setRadius(s.circleDraft.radiusM);
            if (!map.hasLayer(anchorCircle)) anchorCircle.addTo(map);
            if (s.anchorStep === "circle" && !rimDragging) {
              const brg = bow ? bearingDegrees(s.circleDraft, bow) : 90;
              const rim = destPoint(s.circleDraft, brg, s.circleDraft.radiusM);
              rimHandle.setLatLng([rim.lat, rim.lng]);
              rimHandle.dragging?.disable();
              if (!rimOn) {
                rimHandle.addTo(map);
                rimOn = true;
              }
            }
          } else if (!s.anchor && map.hasLayer(anchorCircle)) {
            map.removeLayer(anchorCircle);
            if (rimOn) {
              map.removeLayer(rimHandle);
              rimOn = false;
            }
          }

          if (s.tapMode === "draw-fence" || swingInk) {
            const d = s.fenceDraft;
            const closed = swingInk && !drawingStroke && d.length >= 3 ? [...d, d[0]!] : d;
            fenceDraftLine.setLatLngs(closed.map((p) => [p.lat, p.lng] as [number, number]));
            fenceDraftLine.setStyle({
              color: primary,
              weight: 3,
              dashArray: swingInk && !drawingStroke && d.length >= 3 ? "" : "6 8",
            });
            if (!fenceDraftOn) {
              fenceDraftLine.addTo(map);
              fenceDraftOn = true;
            }
            fenceGroup.clearLayers();
            if (!swingInk) {
              d.forEach((p, i) => {
                L.marker([p.lat, p.lng], {
                  icon: L.divIcon({
                    className: "rp-divicon",
                    html: pinHtml("wp", String(i + 1)),
                    iconSize: [22, 22],
                    iconAnchor: [11, 11],
                  }),
                  interactive: false,
                  keyboard: false,
                }).addTo(fenceGroup);
              });
            }
            if (swingInk && !drawingStroke && d.length >= 3) {
              fencePoly.setLatLngs(d.map((p) => [p.lat, p.lng] as [number, number]));
              fencePoly.setStyle({
                color: primary,
                fillColor: primary,
                fillOpacity: 0.14,
                weight: 3,
              });
              if (!fenceOn) {
                fencePoly.addTo(map);
                fenceOn = true;
              }
            } else if (swingInk && fenceOn) {
              map.removeLayer(fencePoly);
              fenceOn = false;
            }
          } else if (fenceDraftOn || (fenceOn && !s.anchor)) {
            fenceDraftLine.setLatLngs([]);
            if (fenceDraftOn) map.removeLayer(fenceDraftLine);
            fenceGroup.clearLayers();
            fenceDraftOn = false;
            if (fenceOn && !s.anchor) {
              map.removeLayer(fencePoly);
              fenceOn = false;
            }
          }
          } finally {
            applying = false;
            if (applyAgain) {
              applyAgain = false;
              apply();
            }
          }
        };

        apply();
        unsub = useHelm.subscribe(apply);

        map.on("click", (e) => {
          if (heldPin) {
            heldPin = false;
            return;
          }
          const s = useHelm.getState();
          const wp = { lat: e.latlng.lat, lng: e.latlng.lng };
          if (s.drawMode === "draw") {
            s.appendDraft({
              ...wp,
              label: `WP ${s.draft.length + 1}`,
            });
            return;
          }
          if (s.tapMode === "route-start") {
            s.setRouteStart(wp);
            return;
          }
          if (s.tapMode === "route-finish") {
            s.setRouteFinish(wp);
            return;
          }
          if (s.tapMode === "place-boat") {
            s.setBoat({
              lat: wp.lat,
              lng: wp.lng,
              heading: s.boat?.heading ?? 0,
              speedMs: 0,
              accuracy: 4,
              source: "placed",
              at: Date.now(),
            });
            s.setFollowBoat(false);
            const step = useHelm.getState().anchorStep;
            if (step === "place") {
              useHelm.getState().setAnchorStep("depth");
              useHelm.getState().setTapMode("none");
            } else if (useHelm.getState().hookArmed) {
              useHelm.getState().setHookNow();
              const note = rodeDropNote(useHelm.getState().rode);
              if (note) toast(note);
            } else {
              useHelm.getState().setTapMode("none");
            }
            return;
          }
          if (s.tapMode === "drop-anchor") {
            return;
          }
          if (s.tapMode === "draw-fence") {
            const first = s.fenceDraft[0];
            if (first && s.fenceDraft.length >= 3 && haversineMeters(first, wp) < 12) {
              s.commitFence();
              return;
            }
            s.appendFencePoint(wp);
            return;
          }
          if (s.tapMode === "resize-swing") {
            return;
          }
          // Weather map: a tap reads the forecast at that spot (drag the pin to move it).
          if (s.wxMapLayer !== "off" && s.tapMode === "none") {
            s.setWxMap({ wxProbe: wp });
          }
        });

        map.on("contextmenu", (e) => {
          const oe = (e as { originalEvent?: Event }).originalEvent;
          oe?.preventDefault();
          const s = useHelm.getState();
          if (s.tapMode !== "none" || s.drawMode !== "idle" || s.anchorStep) return;
          useHelm.setState({ wxPin: { lat: e.latlng.lat, lng: e.latlng.lng }, pinCard: true });
          heldPin = true;
          window.setTimeout(() => {
            heldPin = false;
          }, 800);
        });

        map.on("dragstart", () => {
          if (
            useHelm.getState().followBoat &&
            !useHelm.getState().demoPlaying
          ) {
            useHelm.getState().setFollowBoat(false);
          }
        });

        let placingPtr = false;
        let resizePtr = false;
        let draftResize = false;
        let packOrigin: { lat: number; lng: number } | null = null;
        let heldPin = false;
        let holdTimer: ReturnType<typeof setTimeout> | null = null;
        let holdAt: { x: number; y: number; lat: number; lng: number } | null = null;
        const clearHold = () => {
          if (holdTimer) clearTimeout(holdTimer);
          holdTimer = null;
          holdAt = null;
        };
        const dropWxPin = (lat: number, lng: number) => {
          const s = useHelm.getState();
          if (s.tapMode !== "none" || s.drawMode !== "idle" || s.anchorStep) return;
          heldPin = true;
          window.setTimeout(() => {
            heldPin = false;
          }, 800);
          // Press and hold opens the spot card (see PinCard) instead of the old popup.
          useHelm.setState({ wxPin: { lat, lng }, pinCard: true });
        };
        const box = map.getContainer();
        const eventToLatLng = (ev: PointerEvent) => {
          if (!map) return null;
          return map.mouseEventToLatLng(ev as unknown as MouseEvent);
        };
        const applyResize = (ll: { lat: number; lng: number }) => {
          const a = useHelm.getState().anchor;
          if (!a) return;
          useHelm.getState().setAnchorRadius(haversineMeters(a, ll), true);
        };
        const onPointerDown = (ev: PointerEvent) => {
          if (!map) return;
          const hit = ev.target;
          if (hit instanceof Element && hit.closest(".leaflet-popup, [data-wx=open]")) return;
          const mode = useHelm.getState().tapMode;
          if (ev.pointerType === "mouse" && ev.button !== 0) return;
          const ll = eventToLatLng(ev);
          if (!ll) return;
          const finger = { lat: ll.lat, lng: ll.lng };
          if (mode === "none" && useHelm.getState().drawMode === "idle" && !useHelm.getState().anchorStep) {
            holdAt = { x: ev.clientX, y: ev.clientY, lat: finger.lat, lng: finger.lng };
            holdTimer = setTimeout(() => {
              if (!holdAt) return;
              dropWxPin(holdAt.lat, holdAt.lng);
              clearHold();
            }, 480);
          }
          if (mode === "draw-pack") {
            try {
              box.setPointerCapture(ev.pointerId);
            } catch {
              /* capture is best-effort on some browsers */
            }
            ev.preventDefault();
            packOrigin = finger;
            useHelm.getState().setPackDrag(finger, null);
            return;
          }
          if (mode !== "drop-anchor" && mode !== "resize-swing") return;
          const swingDraw =
            useHelm.getState().anchorStep === "circle" && useHelm.getState().swingShape === "draw";
          if (swingDraw) {
            try {
              box.setPointerCapture(ev.pointerId);
            } catch {
              /* capture is best-effort on some browsers */
            }
            ev.preventDefault();
            drawingStroke = true;
            useHelm.getState().setFenceDraft([finger]);
            return;
          }
          try {
            box.setPointerCapture(ev.pointerId);
          } catch {
            /* capture is best-effort on some browsers */
          }
          ev.preventDefault();
          if (mode === "resize-swing") {
            resizePtr = true;
            applyResize(finger);
            return;
          }
          const draft = useHelm.getState().circleDraft;
          if (useHelm.getState().anchorStep === "circle" && draft) {
            const c = map.latLngToContainerPoint([draft.lat, draft.lng]);
            const f = map.latLngToContainerPoint([finger.lat, finger.lng]);
            const dist = Math.hypot(f.x - c.x, f.y - c.y);
            const mPerPx =
              (40075016.686 * Math.cos((draft.lat * Math.PI) / 180)) /
              (256 * 2 ** map.getZoom());
            const radiusPx = draft.radiusM / Math.max(mPerPx, 0.05);
            if (Math.abs(dist - radiusPx) <= 36) {
              draftResize = true;
              return;
            }
          }
          placingPtr = true;
          placeOnLayback(finger);
        };
        const placeOnLayback = (finger: { lat: number; lng: number }) => {
          const s = useHelm.getState();
          const bow = s.boat ? bowFromGps(s.boat, s.boat.heading, s.hull) : null;
          if (bow && haversineMeters(bow, finger) < 3) return;
          const at = bow ? snapToLayback(bow, finger, s.rode) : finger;
          if (s.anchorStep === "circle") s.setCircleDraft(at);
          else s.setHookPreview(at);
        };
        const onPointerMove = (ev: PointerEvent) => {
          if (!map) return;
          if (placingPtr || draftResize || resizePtr) ev.preventDefault();
          const ll = eventToLatLng(ev);
          if (!ll) return;
          const finger = { lat: ll.lat, lng: ll.lng };
          if (holdAt) {
            const moved = Math.hypot(ev.clientX - holdAt.x, ev.clientY - holdAt.y);
            if (moved > 14) clearHold();
          }
          if (packOrigin && useHelm.getState().tapMode === "draw-pack") {
            useHelm.getState().setPackDrag(packOrigin, finger);
            return;
          }
          if (resizePtr && useHelm.getState().tapMode === "resize-swing") {
            applyResize(finger);
            return;
          }
          if (drawingStroke) {
            const s = useHelm.getState();
            const draft = s.fenceDraft;
            const last = draft[draft.length - 1];
            const mPerPx =
              (40075016.686 * Math.cos((finger.lat * Math.PI) / 180)) /
              (256 * 2 ** map.getZoom());
            const step = Math.max(2, mPerPx * 6);
            if (!last || haversineMeters(last, finger) >= step) s.appendFencePoint(finger);
            return;
          }
          if (draftResize) {
            const d = useHelm.getState().circleDraft;
            if (!d) return;
            useHelm.getState().setCircleDraft({
              lat: d.lat,
              lng: d.lng,
              radiusM: clampAlarmRadius(haversineMeters(d, finger)),
            });
            return;
          }
          if (!placingPtr) return;
          const s = useHelm.getState();
          if (s.tapMode !== "drop-anchor") return;
          placeOnLayback(finger);
        };
        const onPointerUp = () => {
          clearHold();
          if (packOrigin) {
            const draft = useHelm.getState().packDraft;
            packOrigin = null;
            const ok = useHelm.getState().commitPackBox();
            if (!ok && draft.length >= 2) {
              toast("Drag a box across the reef. A line is too thin.");
              useHelm.getState().setPackDrag(draft[0]!, null);
            }
          }
          if (resizePtr) {
            resizePtr = false;
            if (useHelm.getState().tapMode === "resize-swing") {
              useHelm.getState().setTapMode("none");
            }
          }
          if (drawingStroke) {
            drawingStroke = false;
            const draft = useHelm.getState().fenceDraft;
            useHelm.getState().setFenceDraft(draft.length < 3 ? [] : draft.slice());
            return;
          }
          if (draftResize) draftResize = false;
          if (!placingPtr) return;
          placingPtr = false;
          const s = useHelm.getState();
          const p = s.hookPreview;
          if (!p || s.tapMode !== "drop-anchor") return;
          if (s.anchorStep === "circle") return;
          const bow = s.boat ? bowFromGps(s.boat, s.boat.heading, s.hull) : null;
          if (bow && haversineMeters(bow, p) < 2) return;
          s.dropAnchor(p.lat, p.lng);
          const note = rodeDropNote(s.rode);
          if (note) toast(note);
        };
        const holdTouch = (ev: TouchEvent) => {
          const mode = useHelm.getState().tapMode;
          if (
            placingPtr ||
            draftResize ||
            resizePtr ||
            mode === "drop-anchor" ||
            mode === "resize-swing" ||
            mode === "draw-pack"
          ) {
            ev.preventDefault();
          }
        };
        box.addEventListener("pointerdown", onPointerDown);
        box.addEventListener("pointermove", onPointerMove);
        const countTouches = (ev: TouchEvent) => {
          const was = pinchTouches;
          pinchTouches = ev.touches.length;
          if (pinchTouches >= 2) clearHold(); // a pinch is not a long-press
          if (was >= 2 && pinchTouches < 2) gestureUntil = Date.now() + 700;
        };
        box.addEventListener("touchstart", countTouches, { passive: true });
        box.addEventListener("touchend", countTouches, { passive: true });
        box.addEventListener("touchcancel", countTouches, { passive: true });
        box.addEventListener("touchstart", holdTouch, { passive: false });
        box.addEventListener("touchmove", holdTouch, { passive: false });
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);

        anchorMarker.on("dragstart", () => {
          hookDragging = true;
          if (map?.dragging.enabled()) map.dragging.disable();
        });
        anchorMarker.on("drag", () => {
          const ll = anchorMarker.getLatLng();
          const s = useHelm.getState();
          const bow = s.boat
            ? bowFromGps(s.boat, s.boat.heading, s.hull)
            : null;
          if (bow) {
            rodeLine.setLatLngs([
              [bow.lat, bow.lng],
              [ll.lat, ll.lng],
            ]);
          }
          anchorCircle.setLatLng(ll);
        });
        anchorMarker.on("dragend", () => {
          hookDragging = false;
          const ll = anchorMarker.getLatLng();
          useHelm.getState().moveAnchor(ll.lat, ll.lng);
          const mode = useHelm.getState().tapMode;
          if (
            map &&
            !map.dragging.enabled() &&
            mode !== "drop-anchor" &&
            mode !== "resize-swing"
          ) {
            map.dragging.enable();
          }
        });

        rimHandle.on("dragstart", () => {
          rimDragging = true;
          if (map?.dragging.enabled()) map.dragging.disable();
        });
        rimHandle.on("drag", () => {
          const a = useHelm.getState().anchor;
          if (!a) return;
          const ll = rimHandle.getLatLng();
          const r = haversineMeters(a, { lat: ll.lat, lng: ll.lng });
          anchorCircle.setRadius(r);
        });
        rimHandle.on("dragend", () => {
          rimDragging = false;
          const a = useHelm.getState().anchor;
          const ll = rimHandle.getLatLng();
          if (a) {
            useHelm.getState().setAnchorRadius(
              haversineMeters(a, { lat: ll.lat, lng: ll.lng }),
              true,
            );
          }
          const mode = useHelm.getState().tapMode;
          if (
            map &&
            !map.dragging.enabled() &&
            mode !== "drop-anchor" &&
            mode !== "resize-swing"
          ) {
            map.dragging.enable();
          }
        });

        const publishZoom = () => {
          if (!map) return;
          useHelm.getState().setChartZoom(map.getZoom());
          const b = map.getBounds();
          chartBounds = {
            south: b.getSouth(),
            west: b.getWest(),
            north: b.getNorth(),
            east: b.getEast(),
            zoom: map.getZoom(),
          };
        };
        map.on("moveend", publishZoom);
        map.on("zoom", publishZoom);
        map.on("zoomend", publishZoom);
        publishZoom();

        const onZoom = (ev: Event) => {
          const delta = (ev as CustomEvent<number>).detail;
          if (delta > 0) map?.zoomIn();
          else map?.zoomOut();
        };
        const onCloseIn = () => {
          const boat = useHelm.getState().boat;
          if (!boat || !map) return;
          useHelm.getState().setFollowBoat(true);
          followArmed = true;
          map.setView([boat.lat, boat.lng], CLOSE_ZOOM, { animate: true });
        };
        window.addEventListener("rp-zoom", onZoom);
        window.addEventListener("rp-close-in", onCloseIn);
        const prevUnsub = unsub;
        unsub = () => {
          prevUnsub();
          window.removeEventListener("rp-zoom", onZoom);
          window.removeEventListener("rp-close-in", onCloseIn);
          box.removeEventListener("pointerdown", onPointerDown);
          box.removeEventListener("pointermove", onPointerMove);
          box.removeEventListener("touchstart", countTouches);
          box.removeEventListener("touchend", countTouches);
          box.removeEventListener("touchcancel", countTouches);
          box.removeEventListener("touchstart", holdTouch);
          box.removeEventListener("touchmove", holdTouch);
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          window.removeEventListener("pointercancel", onPointerUp);
        };
      });

    return () => {
      cancelled = true;
      paintSeaSet = null;
      stopRadar();
      stopWx();
      unsub();
      map?.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 z-0 bg-background"
      aria-label="Satellite chart"
    />
  );
}
