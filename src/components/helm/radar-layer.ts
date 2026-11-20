import type { Map as LeafletMap, TileLayer } from "leaflet";
import { toast } from "sonner";
import { useHelm } from "@/store/helm";
import { isNativeApp } from "@/lib/native";
import {
  ATTR_RADAR,
  RADAR_MAX_NATIVE_ZOOM,
  cellTrend,
  dbzFromGrey,
  fetchRadarFrames,
  kmPerPxAt,
  nearestEcho,
  radarDataTileUrl,
  radarTileUrl,
  worldPx,
  type Echo,
  type RadarFrame,
} from "@/lib/radar";

type LeafletNS = typeof import("leaflet");

const LOOP_MS = 700;
const REFRESH_MS = 5 * 60_000;
const ALERT_COOLDOWN_MS = 20 * 60_000;
const SQUALL_NOTICE_ID = 800;
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/**
 * Rain radar on the chart: one tile layer per frame, faded in turn for the loop, plus a check
 * on each new frame for a heavy-rain cell closing on the boat.
 */
export function createRadar(L: LeafletNS, map: LeafletMap, maxZoom: number) {
  let on = false;
  let host = "";
  let frames: RadarFrame[] = [];
  const layers = new Map<string, TileLayer>();
  let shown = -1;
  let loopTimer = 0;
  let refreshTimer = 0;
  const echoes = new Map<string, Echo | null>();
  let lastAlert = 0;

  const show = (i: number) => {
    if (i === shown || !frames[i]) return;
    const f = frames[i];
    let layer = layers.get(f.path);
    if (!layer) {
      layer = L.tileLayer(radarTileUrl(host, f), {
        maxNativeZoom: RADAR_MAX_NATIVE_ZOOM,
        maxZoom,
        opacity: 0,
        pane: "chartOverlay",
        attribution: ATTR_RADAR,
        crossOrigin: true,
      });
      layer.addTo(map);
      layers.set(f.path, layer);
    }
    layer.setOpacity(0.65);
    const prev = frames[shown];
    if (prev) layers.get(prev.path)?.setOpacity(0);
    shown = i;
    publish();
  };

  const latestPast = () => {
    let i = -1;
    frames.forEach((f, k) => {
      if (!f.nowcast) i = k;
    });
    return i;
  };

  const publish = (cell = useHelm.getState().radarInfo?.cell ?? null) => {
    const s = useHelm.getState();
    const f = frames[shown];
    const last = frames[latestPast()];
    if (!f || !last) return;
    s.setRadarInfo({ frameAt: f.at, latestAt: last.at, playing: s.radarInfo?.playing ?? false, cell });
  };

  const tick = () => {
    const s = useHelm.getState();
    if (!on || !frames.length) return;
    if (s.radarInfo?.playing) show((shown + 1) % frames.length);
    else if (shown !== latestPast()) show(latestPast());
  };

  async function echoFor(f: RadarFrame, lat: number, lng: number): Promise<Echo | null> {
    const z = RADAR_MAX_NATIVE_ZOOM;
    const p = worldPx(lat, lng, z);
    const tx = Math.floor(p.x / 256);
    const ty = Math.floor(p.y / 256);
    const key = `${f.path}|${tx}|${ty}`;
    if (echoes.has(key)) return echoes.get(key) ?? null;
    const w = 768;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = w;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    const loads: Promise<void>[] = [];
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        loads.push(
          new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              ctx.drawImage(img, (i + 1) * 256, (j + 1) * 256);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = radarDataTileUrl(host, f, z, tx + i, ty + j);
          }),
        );
      }
    }
    await Promise.all(loads);
    let px: Uint8ClampedArray;
    try {
      px = ctx.getImageData(0, 0, w, w).data;
    } catch {
      return null; // tiles without CORS headers: no alert, the overlay still works
    }
    const dbz = new Float32Array(w * w);
    for (let k = 0; k < w * w; k++) dbz[k] = dbzFromGrey(px[k * 4], px[k * 4 + 3]);
    const echo = nearestEcho(dbz, w, w, p.x - (tx - 1) * 256, p.y - (ty - 1) * 256, kmPerPxAt(lat, z));
    echoes.set(key, echo);
    return echo;
  }

  async function checkCells() {
    const boat = useHelm.getState().boat;
    if (!boat || !on) return;
    const past = frames.filter((f) => !f.nowcast).slice(-6);
    const samples: { at: number; echo: Echo | null }[] = [];
    for (const f of past) samples.push({ at: f.at, echo: await echoFor(f, boat.lat, boat.lng) });
    if (!on) return;
    const cell = cellTrend(samples);
    publish(cell);
    if (!cell || Date.now() - lastAlert < ALERT_COOLDOWN_MS) return;
    lastAlert = Date.now();
    const text = `Heavy rain ${cell.distNm.toFixed(0)} nm ${COMPASS[Math.round(cell.bearing / 45) % 8]}, closing at ${cell.closingKn.toFixed(0)} kn${cell.etaMin != null ? `, about ${cell.etaMin} min` : ""}. Consider reefing early.`;
    toast.warning(text, { duration: 15_000 });
    if (isNativeApp()) {
      void import("@capacitor/local-notifications").then(({ LocalNotifications }) =>
        LocalNotifications.schedule({
          notifications: [{ id: SQUALL_NOTICE_ID, title: "Squall closing", body: text }],
        }).catch(() => undefined),
      );
    }
  }

  async function refresh() {
    const got = await fetchRadarFrames();
    if (!on) return;
    if (!got) {
      if (!frames.length) toast.error("Radar is not available right now.");
      return;
    }
    host = got.host;
    const keep = new Set(got.frames.map((f) => f.path));
    for (const [path, layer] of layers) {
      if (!keep.has(path)) {
        map.removeLayer(layer);
        layers.delete(path);
      }
    }
    for (const k of echoes.keys()) if (!keep.has(k.split("|")[0])) echoes.delete(k);
    frames = got.frames;
    shown = -1;
    show(latestPast());
    void checkCells();
  }

  return {
    set(next: boolean) {
      if (next === on) return;
      on = next;
      if (on) {
        void refresh();
        loopTimer = window.setInterval(tick, LOOP_MS);
        refreshTimer = window.setInterval(() => void refresh(), REFRESH_MS);
      } else {
        window.clearInterval(loopTimer);
        window.clearInterval(refreshTimer);
        for (const layer of layers.values()) map.removeLayer(layer);
        layers.clear();
        frames = [];
        shown = -1;
      }
    },
    destroy() {
      this.set(false);
    },
  };
}
