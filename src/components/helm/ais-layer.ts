import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { dangers, type AisTarget } from "@/lib/ais";
import { useHelm } from "@/store/helm";

type LeafletNS = typeof import("leaflet");

/**
 * AIS targets on the chart: a triangle pointing along the heading (or course), sized for the
 * screen, with a line showing where it will be in 6 minutes. Red when it will pass inside the
 * alarm limits. Drawn in chart coordinates so heading-up rotation stays right.
 */
export function createAisLayer(L: LeafletNS, map: LeafletMap) {
  const group: LayerGroup = L.layerGroup();
  let list: AisTarget[] = [];
  let shown = false;

  const metresPerPx = () => {
    const c = map.getCenter();
    return (40075016.686 * Math.cos((c.lat * Math.PI) / 180)) / (256 * 2 ** map.getZoom());
  };

  const draw = () => {
    group.clearLayers();
    if (!list.length) return;
    const s = useHelm.getState();
    const own = s.boat ? { lat: s.boat.lat, lng: s.boat.lng, sogKn: s.boat.speedMs * 1.943844, cogDeg: s.boat.heading ?? NaN } : null;
    const red = new Set(own && s.aisAlarm.on ? dangers(own, list, s.aisAlarm).map((d) => d.target.mmsi) : []);
    const mpp = metresPerPx();
    const b = map.getBounds().pad(0.2);
    for (const t of list) {
      if (!b.contains([t.lat, t.lng])) continue;
      const k = Math.cos((t.lat * Math.PI) / 180);
      const off = (de: number, dn: number): [number, number] => [t.lat + dn / 110_540, t.lng + de / (111_320 * k)];
      const danger = red.has(t.mmsi);
      const color = danger ? "#ef4444" : t.cls === "aton" ? "#a855f7" : t.cls === "sart" ? "#f97316" : t.cls === "B" ? "#94a3b8" : "#22d3ee";
      const onTap = (ev: L.LeafletMouseEvent) => {
        L.DomEvent.stop(ev);
        useHelm.setState({ aisCard: t.mmsi });
      };
      if (t.cls === "aton") {
        L.circleMarker([t.lat, t.lng], { radius: 6, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 }).on("click", onTap).addTo(group);
        continue;
      }
      const dir = Number.isFinite(t.headingDeg) ? t.headingDeg : t.cogDeg;
      const size = (t.cls === "B" ? 9 : 12) * mpp;
      if (!Number.isFinite(dir)) {
        L.circleMarker([t.lat, t.lng], { radius: 6, color: "#0b2530", weight: 2, fillColor: color, fillOpacity: 0.9 }).on("click", onTap).addTo(group);
        continue;
      }
      const r = (dir * Math.PI) / 180;
      const rot = (x: number, y: number): [number, number] => off(x * Math.cos(r) + y * Math.sin(r), -x * Math.sin(r) + y * Math.cos(r));
      L.polygon([rot(0, size * 1.4), rot(size * 0.75, -size), rot(-size * 0.75, -size)], {
        color: "#0b2530",
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.95,
      })
        .on("click", onTap)
        .addTo(group);
      if (Number.isFinite(t.sogKn) && t.sogKn >= 0.5 && Number.isFinite(t.cogDeg)) {
        const m = t.sogKn * 1852 * 0.1; // 6 minutes ahead
        const c = (t.cogDeg * Math.PI) / 180;
        L.polyline([[t.lat, t.lng], off(m * Math.sin(c), m * Math.cos(c))], { color, weight: danger ? 3 : 2, dashArray: "6 5", interactive: false }).addTo(group);
      }
    }
  };

  map.on("zoomend moveend", () => shown && draw());

  return {
    set(next: AisTarget[], on: boolean) {
      if (on !== shown) {
        shown = on;
        if (on) group.addTo(map);
        else group.remove();
      }
      if (next !== list) {
        list = next;
        if (shown) draw();
      }
    },
    destroy() {
      group.remove();
    },
  };
}
