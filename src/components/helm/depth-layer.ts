import type { Coords, DoneCallback, GridLayer } from "leaflet";
import { ATTR_DEPTH, DEPTH_MAX_Z, depthColor, loadDemTile, sampleTile, shallowColor, waterDepthM } from "@/lib/depth";

type LeafletNS = typeof import("leaflet");

export type DepthLook = { mode: "depth" | "shallow"; tideMsl: number; limitM: number };

/**
 * Seabed overlay drawn on the phone from depth tiles: depth shading, or red/amber where the
 * water is too shallow for the boat at the current tide. Redraw when the tide or draft changes.
 */
export function createDepthLayer(L: LeafletNS, maxZoom: number, look: () => DepthLook): GridLayer {
  const Layer = L.GridLayer.extend({
    createTile(this: GridLayer, coords: Coords, done: DoneCallback) {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const z = Math.min(coords.z, DEPTH_MAX_Z);
      const scale = 2 ** (coords.z - z);
      const tx = Math.floor(coords.x / scale);
      const ty = Math.floor(coords.y / scale);
      void loadDemTile(z, tx, ty).then((t) => {
        const g = canvas.getContext("2d");
        if (!t || !g) {
          done(undefined, canvas);
          return;
        }
        const { mode, tideMsl, limitM } = look();
        const img = g.createImageData(size, size);
        const k = t.size / size;
        const ox = (coords.x - tx * scale) * size;
        const oy = (coords.y - ty * scale) * size;
        for (let j = 0; j < size; j++) {
          for (let i = 0; i < size; i++) {
            const h = sampleTile(t, ((ox + i + 0.5) / scale) * k, ((oy + j + 0.5) / scale) * k);
            const depth = waterDepthM(h, tideMsl);
            const c = mode === "depth" ? depthColor(depth) : shallowColor(depth, limitM);
            if (!c) continue;
            const o = (j * size + i) * 4;
            img.data[o] = c[0];
            img.data[o + 1] = c[1];
            img.data[o + 2] = c[2];
            img.data[o + 3] = c[3];
          }
        }
        g.putImageData(img, 0, 0);
        done(undefined, canvas);
      });
      return canvas;
    },
  });
  return new (Layer as unknown as new (o: object) => GridLayer)({
    maxZoom,
    pane: "chartOverlay",
    attribution: ATTR_DEPTH,
    updateWhenZooming: false,
    keepBuffer: 2,
  });
}
