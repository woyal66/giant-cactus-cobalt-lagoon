import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { anchoragesInView, anchoragesOn, type SharedAnchorage } from "@/lib/anchorage-library";
import { useHelm } from "@/store/helm";
import { cachedInView, remember } from "@/lib/library-cache";

type LeafletNS = typeof import("leaflet");

/** Shown from this zoom in: at the scale of a bay, not the coast. */
export const ANCHORAGE_MIN_ZOOM = 12;

const ICON = (mine: boolean) =>
  `<div style="width:24px;height:24px;border-radius:12px;background:${mine ? "#16a34a" : "#0b2530"};border:2px solid #fff;display:grid;place-items:center;box-shadow:0 1px 3px rgba(0,0,0,.5)">` +
  `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.2"/><path d="M12 7.5V21M5 13a7 7 0 0 0 14 0M8 11h8"/></svg></div>`;

/**
 * Other skippers' shared anchorages as small anchor symbols once zoomed in; tap one for its
 * card. Loads the area in view after the map settles and keeps what it has seen.
 */
export function createAnchorageLayer(L: LeafletNS, map: LeafletMap) {
  const group: LayerGroup = L.layerGroup();
  const seen = new Map<string, SharedAnchorage>();
  const drawn = new Set<string>();
  let on = false;
  let timer = 0;
  let lastBox = "";

  const draw = () => {
    const mine = new Set(useHelm.getState().mySharedAnchorages.map((x) => x.id));
    for (const a of seen.values()) {
      if (drawn.has(a.id)) continue;
      drawn.add(a.id);
      L.marker([a.lat, a.lng], {
        icon: L.divIcon({ className: "rp-divicon", html: ICON(mine.has(a.id)), iconSize: [24, 24], iconAnchor: [12, 12] }),
        keyboard: false,
        zIndexOffset: 150,
        title: "Shared anchorage",
      })
        .on("click", (ev) => {
          L.DomEvent.stop(ev);
          useHelm.setState({ anchorageCard: a });
        })
        .addTo(group);
    }
  };

  const load = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!on || map.getZoom() < ANCHORAGE_MIN_ZOOM) return;
      const b = map.getBounds().pad(0.3);
      const box = { s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() };
      const key = [box.s, box.w, box.n, box.e].map((v) => v.toFixed(3)).join(",");
      if (key === lastBox) return;
      lastBox = key;
      void anchoragesInView(box)
        .then((list) => {
          for (const a of list) seen.set(a.id, a);
          void remember("anchorages", box, list, list.length < 200);
          draw();
        })
        .catch(() => {
          // No signal: show what's saved on the phone, and try online again next time.
          lastBox = "";
          void cachedInView<SharedAnchorage>("anchorages", box).then((list) => {
            for (const a of list) seen.set(a.id, a);
            draw();
          });
        });
    }, 700);
  };

  const update = () => {
    const show = on && map.getZoom() >= ANCHORAGE_MIN_ZOOM;
    if (show && !map.hasLayer(group)) group.addTo(map);
    else if (!show && map.hasLayer(group)) map.removeLayer(group);
    if (show) load();
  };
  map.on("moveend zoomend", update);

  return {
    set(next: boolean) {
      const want = next && anchoragesOn();
      if (want === on) return;
      on = want;
      update();
    },
    /** After removing one of yours: take it off the chart now. */
    remove(id: string) {
      seen.delete(id);
      group.clearLayers();
      drawn.clear();
      draw();
    },
    /** After sharing: show it straight away. */
    add(a: SharedAnchorage) {
      seen.set(a.id, a);
      drawn.delete(a.id);
      group.clearLayers();
      drawn.clear();
      draw();
    },
    destroy() {
      window.clearTimeout(timer);
      map.off("moveend zoomend", update);
      group.remove();
    },
  };
}
