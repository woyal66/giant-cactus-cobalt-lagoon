import type { Coords, DoneCallback, GridLayer } from "leaflet";
import { ATTR_HAZARDS, hazardsInBox, loadHazards, type Hazard, type HazardKind } from "@/lib/hazards";

type LeafletNS = typeof import("leaflet");

/** Chart colours: coral for reef, red for drying reef and rocks, sand for cays. */
const STYLE: Record<HazardKind, { fill: string; stroke: string; width: number; dash?: number[] }> = {
  reef: { fill: "rgba(255,138,92,0.16)", stroke: "rgba(255,150,100,0.95)", width: 1.6 },
  dry: { fill: "rgba(235,70,55,0.30)", stroke: "rgba(255,90,70,0.95)", width: 1.4, dash: [4, 3] },
  rock: { fill: "rgba(220,40,40,0.55)", stroke: "rgba(255,255,255,0.95)", width: 1.5 },
  cay: { fill: "rgba(240,220,160,0.55)", stroke: "rgba(200,170,90,0.95)", width: 1.2 },
  island: { fill: "rgba(0,0,0,0)", stroke: "rgba(255,255,255,0.55)", width: 1 },
};
const ORDER: HazardKind[] = ["island", "reef", "cay", "dry", "rock"];

function tileLngLat(z: number, x: number, y: number) {
  const n = 2 ** z;
  const lng = (x / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return { lng, lat };
}

/** Chart symbol for a rock: a cross with dots in the corners, ringed so it reads on the photo. */
function rockSymbol(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.save();
  g.lineCap = "round";
  g.strokeStyle = "rgba(0,0,0,0.75)";
  g.lineWidth = 4.5;
  g.beginPath();
  g.moveTo(x - r, y);
  g.lineTo(x + r, y);
  g.moveTo(x, y - r);
  g.lineTo(x, y + r);
  g.stroke();
  g.strokeStyle = "#ff4d4d";
  g.lineWidth = 2.2;
  g.stroke();
  g.fillStyle = "#ff4d4d";
  const d = r * 0.6;
  for (const [dx, dy] of [[-d, -d], [d, -d], [-d, d], [d, d]] as const) {
    g.beginPath();
    g.arc(x + dx, y + dy, 1.8, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/**
 * GBRMPA reefs, drying reef, rocks, cays and island outlines drawn on the phone from the
 * bundled file, so they work offline and line up with the photo at any zoom.
 */
export function createHazardLayer(L: LeafletNS, maxZoom: number): GridLayer {
  const Layer = L.GridLayer.extend({
    createTile(this: GridLayer, coords: Coords, done: DoneCallback) {
      const size = 256;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const canvas = document.createElement("canvas");
      canvas.width = size * ratio;
      canvas.height = size * ratio;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      void loadHazards().then((idx) => {
        const g = canvas.getContext("2d");
        if (!idx || !g) {
          done(undefined, canvas);
          return;
        }
        g.scale(ratio, ratio);
        const { z, x, y } = coords;
        const nw = tileLngLat(z, x, y);
        const se = tileLngLat(z, x + 1, y + 1);
        const pad = (se.lng - nw.lng) * 0.05;
        const items = hazardsInBox(idx, nw.lng - pad, se.lat - pad, se.lng + pad, nw.lat + pad);
        const n = 2 ** z;
        const px = (lng: number) => (((lng + 180) / 360) * n - x) * size;
        const py = (lat: number) => {
          const s = Math.sin((lat * Math.PI) / 180);
          return ((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n - y) * size;
        };
        const byKind = new Map<HazardKind, Hazard[]>();
        for (const h of items) {
          const list = byKind.get(h.kind);
          if (list) list.push(h);
          else byKind.set(h.kind, [h]);
        }
        for (const kind of ORDER) {
          const list = byKind.get(kind);
          if (!list) continue;
          const st = STYLE[kind];
          g.beginPath();
          for (const h of list) {
            for (const r of h.rings) {
              g.moveTo(px(r[0]!), py(r[1]!));
              for (let i = 2; i < r.length; i += 2) g.lineTo(px(r[i]!), py(r[i + 1]!));
              g.closePath();
            }
          }
          g.fillStyle = st.fill;
          g.fill("evenodd");
          g.setLineDash(st.dash ?? []);
          g.strokeStyle = st.stroke;
          g.lineWidth = z >= 14 ? st.width + 0.6 : st.width;
          g.stroke();
          g.setLineDash([]);
          // Rocks are small: mark them with the chart symbol so they can't be missed.
          if (kind === "rock" && z >= 10) {
            for (const h of list) rockSymbol(g, px(h.c[0]), py(h.c[1]), z >= 14 ? 7 : 5);
          }
        }
        done(undefined, canvas);
      });
      return canvas;
    },
  });
  return new (Layer as unknown as new (o: object) => GridLayer)({
    maxZoom,
    pane: "chartOverlay",
    attribution: ATTR_HAZARDS,
    updateWhenZooming: false,
    keepBuffer: 2,
  });
}
