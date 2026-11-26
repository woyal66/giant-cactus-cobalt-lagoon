import type { Map as LeafletMap, TileLayer, WMSOptions } from "leaflet";
import { useHelm, type WxLiveInfo } from "@/store/helm";
import { radarAvailable } from "@/lib/radar";
import { dbzNear, outlookText, rainRateFromDbz } from "@/lib/rain";
import { compassPoint } from "@/lib/routing/explain";
import { ATTR_SAT_CLOUD, GIBS_WMS, satCloudAvailable, satFor, satFrames, satTime, type SatSource } from "@/lib/sat-cloud";
import { cellOf, gridCovers, loadRainNow, type RainNow } from "@/components/helm/rain-now";

type LeafletNS = typeof import("leaflet");

const REFRESH_MS = 5 * 60_000;

const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/**
 * The weather map's live view: radar (last hour, then the next-hour outlook) for Rain and
 * Storms, the satellite picture for Cloud. Loads only while the live strip is in use.
 */
export function createWxLive(L: LeafletNS, map: LeafletMap, onRain: (r: RainNow | null) => void) {
  let kind: "radar" | "sat" | null = null;
  let rain: RainNow | null = null;
  let loading = false;
  let loadedAt = 0;
  let sat: { src: SatSource; layer: TileLayer; at: number } | null = null;
  let refresh = 0;

  const pane = map.getPane("wxSatPane") ?? map.createPane("wxSatPane", map.getPane("rotatePane") ?? map.getPane("mapPane"));
  // Infrared: dark sea, bright cloud. Screen-blending lets the chart show through the clear sky.
  pane.style.zIndex = "270";
  pane.style.pointerEvents = "none";
  pane.style.mixBlendMode = "screen";
  pane.style.filter = "contrast(1.5) brightness(0.85)";

  const publish = (p: Partial<WxLiveInfo> & Pick<WxLiveInfo, "kind" | "status">) => {
    useHelm.getState().setWxMap({
      wxLiveInfo: { frames: [], latestAt: null, outlookFrom: null, motion: null, here: null, note: null, ...p },
    });
  };

  const hereText = (r: RainNow) => {
    const s = useHelm.getState();
    const spot = s.boat ?? map.getCenter();
    const steps: { at: number; mmh: number }[] = [];
    for (const f of r.frames) {
      if (f.at < r.latestAt) continue;
      const g = f.grid ?? r.grid;
      const c = cellOf(g, spot.lat, spot.lng);
      if (c.x < 0 || c.y < 0 || c.x >= g.w || c.y >= g.h) return null;
      // About the same 1–2 km around the spot on either grid.
      const reach = Math.max(1, Math.round(2 ** (g.z - r.grid.z)));
      steps.push({ at: f.at, mmh: rainRateFromDbz(dbzNear(f.dbz, g.w, g.h, c.x, c.y, reach)) });
    }
    if (steps.length < 2) return null;
    return `${s.boat ? "At the boat" : "Chart centre"}: ${outlookText(steps, clock)}`;
  };

  const publishRain = () => {
    if (!rain) return;
    const outlook = rain.frames.find((f) => f.outlook);
    publish({
      kind: "radar",
      status: "ok",
      frames: rain.frames.map((f) => f.at),
      latestAt: rain.latestAt,
      outlookFrom: outlook?.at ?? null,
      motion:
        rain.towardDeg != null && rain.speedKn != null
          ? `Rain moving ${compassPoint(rain.towardDeg)} at ${Math.round(rain.speedKn)} kn`
          : rain.motion
            ? "Rain barely moving"
            : null,
      here: hereText(rain),
      note: [
        rain.source === "noaa" ? "Sharp US radar (NOAA, every 2 min) for now and the outlook" : null,
        outlook ? null : "Not enough rain on the radar to see where it is heading, so no outlook.",
      ]
        .filter(Boolean)
        .join(" · ") || null,
    });
  };

  async function loadRain(force = false) {
    if (loading) return;
    const b = map.getBounds();
    if (!force && rain && gridCovers(rain.grid, b) && Date.now() - loadedAt < REFRESH_MS) {
      publishRain();
      return;
    }
    loading = true;
    if (!rain) publish({ kind: "radar", status: "loading" });
    try {
      const r = await loadRainNow(b);
      if (kind !== "radar") return;
      if (!r) {
        rain = null;
        onRain(null);
        publish({ kind: "radar", status: "none", note: "Radar isn't available here or there's no signal. Showing the model forecast." });
        return;
      }
      rain = r;
      loadedAt = Date.now();
      // Opening the strip "now" shows the newest real frame.
      const s = useHelm.getState();
      if (s.wxLiveAt != null && Math.abs(s.wxLiveAt - Date.now()) < 15 * 60_000) s.setWxMap({ wxLiveAt: r.latestAt });
      onRain(r);
      publishRain();
    } finally {
      loading = false;
    }
  }

  function showSat(at: number) {
    const c = map.getCenter();
    const src = satFor(c.lat, c.lng);
    if (sat && sat.src.id === src.id && sat.at === at) return;
    sat?.layer.remove();
    const layer = L.tileLayer.wms(GIBS_WMS, {
      layers: src.layer,
      format: "image/png",
      transparent: true,
      version: "1.3.0",
      pane: "wxSatPane",
      opacity: 0.9,
      maxNativeZoom: src.daily ? 9 : 7,
      attribution: ATTR_SAT_CLOUD,
      crossOrigin: true,
      // The WMS TIME parameter picks the picture.
      ...({ TIME: satTime(src, at) } as object),
    } as WMSOptions);
    layer.addTo(map);
    sat = { src, layer, at };
  }

  function publishSat() {
    const c = map.getCenter();
    const src = satFor(c.lat, c.lng);
    const frames = satFrames(src);
    publish({
      kind: "sat",
      status: "ok",
      frames,
      latestAt: frames[frames.length - 1] ?? null,
      note: src.daily
        ? "No weather satellite picture every few minutes here: showing the once-a-day picture."
        : `${src.label}: bright = high, cold cloud (showers, storms); grey = low cloud.`,
    });
    return frames;
  }

  const onMove = () => {
    if (kind === "radar") void loadRain();
    else if (kind === "sat") {
      const at = useHelm.getState().wxLiveAt;
      const frames = publishSat();
      if (at != null) showSat(frames.includes(at) ? at : frames[frames.length - 1]!);
    }
  };
  map.on("moveend", onMove);

  function stop() {
    window.clearInterval(refresh);
    refresh = 0;
    sat?.layer.remove();
    sat = null;
    if (rain) onRain(null);
    kind = null;
  }

  return {
    /** Call on every store change. */
    set(layer: string, liveAt: number | null) {
      const want: "radar" | "sat" | null =
        liveAt == null ? null : layer === "rain" ? (radarAvailable() ? "radar" : null) : layer === "cloud" ? (satCloudAvailable() ? "sat" : null) : null;
      if (want !== kind) {
        stop();
        kind = want;
        if (!want) {
          if (liveAt != null && (layer === "rain" || layer === "cloud")) {
            publish({ kind: layer === "cloud" ? "sat" : "radar", status: "none", note: "Not available in this build." });
          } else if (useHelm.getState().wxLiveInfo) useHelm.getState().setWxMap({ wxLiveInfo: null });
          return;
        }
        refresh = window.setInterval(() => (kind === "radar" ? void loadRain(true) : onMove()), REFRESH_MS);
        if (want === "radar") {
          if (rain) onRain(rain);
          void loadRain();
        } else {
          const frames = publishSat();
          const s = useHelm.getState();
          const at = s.wxLiveAt != null && frames.includes(s.wxLiveAt) ? s.wxLiveAt : frames[frames.length - 1]!;
          if (at !== s.wxLiveAt) s.setWxMap({ wxLiveAt: at });
          showSat(at);
        }
        return;
      }
      if (kind === "sat" && liveAt != null) showSat(liveAt);
    },
    destroy() {
      stop();
      map.off("moveend", onMove);
    },
  };
}
