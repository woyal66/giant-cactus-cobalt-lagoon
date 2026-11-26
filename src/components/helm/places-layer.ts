import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { decodeOpenPlaces, placesInView, placesOn as libraryOn, type PlaceKind, type SharedPlace } from "@/lib/place-library";
import { cachedInView, remember } from "@/lib/library-cache";
import { useHelm } from "@/store/helm";

type LeafletNS = typeof import("leaflet");

/** Shown from this zoom in (moorings and ramps crowd the coast further out). */
export const PLACE_MIN_ZOOM = 11;

/** Simple white glyphs on a coloured disc, one colour per kind. */
const GLYPH: Record<PlaceKind, { bg: string; svg: string }> = {
  mooring: { bg: "#1d4ed8", svg: '<circle cx="12" cy="9" r="4"/><path d="M12 13v8"/>' },
  ramp: { bg: "#475569", svg: '<path d="M3 19h18L7 7z"/>' },
  marina: { bg: "#0e7490", svg: '<path d="M12 3v14M6 10h12M5 17c2 2 4 2 7 2s5 0 7-2"/>' },
  fuel: { bg: "#b45309", svg: '<path d="M6 21V5h8v16M6 11h8M14 8l4 3v7a1.5 1.5 0 0 0 3 0V9"/>' },
  water: { bg: "#0284c7", svg: '<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>' },
  pumpout: { bg: "#4d7c0f", svg: '<path d="M8 4h8v5H8zM12 9v6M7 21c0-3 2-6 5-6s5 3 5 6"/>' },
  landing: { bg: "#6d28d9", svg: '<path d="M4 15h16l-2 4H6zM12 15V5l5 6"/>' },
  rescue: { bg: "#dc2626", svg: '<path d="M12 4v16M4 12h16"/>' },
};

export const placeIcon = (kind: PlaceKind, mine = false) =>
  `<div style="width:24px;height:24px;border-radius:12px;background:${GLYPH[kind].bg};border:2px solid ${mine ? "#4ade80" : "#fff"};display:grid;place-items:center;box-shadow:0 1px 3px rgba(0,0,0,.5)">` +
  `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${GLYPH[kind].svg}</svg></div>`;

let openData: Promise<SharedPlace[]> | null = null;
/** Bundled government open data (moorings, ramps), loaded once. */
export function loadOpenPlaces(): Promise<SharedPlace[]> {
  openData ??= fetch("places/places.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => decodeOpenPlaces(j))
    .catch(() => []);
  return openData;
}

/**
 * Places on the chart: moorings, ramps, marinas, fuel, water, pump-out, landings and marine
 * rescue, filtered by the kinds chosen in Chart. Open data is bundled; shared places come
 * online and are kept on the phone for offline use.
 */
export function createPlacesLayer(L: LeafletNS, map: LeafletMap) {
  const group: LayerGroup = L.layerGroup();
  const seen = new Map<string, SharedPlace>();
  let on = false;
  let kinds = "";
  let timer = 0;
  let lastBox = "";

  const draw = () => {
    group.clearLayers();
    const s = useHelm.getState();
    const want = new Set(s.placeKinds);
    const mine = new Set(s.myPlaces.map((x) => x.id));
    const b = map.getBounds().pad(0.3);
    let n = 0;
    for (const p of seen.values()) {
      if (!want.has(p.kind) || !b.contains([p.lat, p.lng]) || n++ > 600) continue;
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: "rp-divicon", html: placeIcon(p.kind, mine.has(p.id)), iconSize: [24, 24], iconAnchor: [12, 12] }),
        keyboard: false,
        zIndexOffset: 140,
        title: p.name || p.kind,
      })
        .on("click", (ev) => {
          L.DomEvent.stop(ev);
          useHelm.setState({ placeCard: p });
        })
        .addTo(group);
    }
  };

  const load = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!on || map.getZoom() < PLACE_MIN_ZOOM) return;
      const b = map.getBounds().pad(0.3);
      const box = { s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() };
      void loadOpenPlaces().then((list) => {
        for (const p of list) if (b.contains([p.lat, p.lng])) seen.set(p.id, p);
        draw();
      });
      if (!libraryOn()) return;
      const key = [box.s, box.w, box.n, box.e].map((v) => v.toFixed(3)).join(",");
      if (key === lastBox) return draw();
      lastBox = key;
      void placesInView(box)
        .then((list) => {
          for (const p of list) seen.set(p.id, p);
          void remember("places", box, list, list.length < 300);
          draw();
        })
        .catch(() => {
          lastBox = "";
          void cachedInView<SharedPlace>("places", box).then((list) => {
            for (const p of list) seen.set(p.id, p);
            draw();
          });
        });
    }, 700);
  };

  const update = () => {
    const show = on && map.getZoom() >= PLACE_MIN_ZOOM;
    if (show && !map.hasLayer(group)) group.addTo(map);
    else if (!show && map.hasLayer(group)) map.removeLayer(group);
    if (show) load();
  };
  map.on("moveend zoomend", update);

  return {
    set(next: boolean, nextKinds: string) {
      if (next === on && nextKinds === kinds) return;
      const kindsChanged = nextKinds !== kinds;
      on = next;
      kinds = nextKinds;
      update();
      if (kindsChanged && on) draw();
    },
    add(p: SharedPlace) {
      seen.set(p.id, p);
      draw();
    },
    remove(id: string) {
      seen.delete(id);
      draw();
    },
    destroy() {
      window.clearTimeout(timer);
      map.off("moveend zoomend", update);
      group.remove();
    },
  };
}
