import type { Coords, DoneCallback, GridLayer } from "leaflet";
import { ATTR_DEPTH, DEPTH_MAX_Z, depthColor, loadDemTile, sampleTile, shallowColor, waterDepthM } from "@/lib/depth";
import { DEPTH_LINES, contourGrid, depthLineColor } from "@/lib/contour";
import { formatDepth } from "@/lib/units";

type LeafletNS = typeof import("leaflet");

export type DepthLook = { mode: "depth" | "shallow" | "lines"; tideMsl: number; limitM: number };

/**
 * Seabed overlay drawn on the phone from depth tiles: depth shading, or red/amber where the
 * water is too shallow for the boat at the current tide. Redraw when the tide or draft changes.
 */
/**
 * Depth contour lines like a chart's: every metre from 1 to 5 m in its own colour (red at 1 m
 * to pale yellow at 5 m), then 10, 20, 50, 100 and 200 m, with depth labels. From the same depth model, so as approximate as the shading.
 */
function drawLines(
  g: CanvasRenderingContext2D,
  t: Parameters<typeof sampleTile>[0],
  ox: number,
  oy: number,
  scale: number,
  k: number,
  tideMsl: number,
  bold: boolean,
  done: () => void,
) {
  const size = 256;
  const n = 65; // sample every 4 px, plus the edge, so lines join across tiles
  const step = size / (n - 1);
  const vals = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const h = sampleTile(t, ((ox + i * step) / scale) * k, ((oy + j * step) / scale) * k);
      const d = waterDepthM(h, tideMsl);
      vals[j * n + i] = Number.isFinite(d) ? d : NaN;
    }
  }
  g.lineJoin = "round";
  g.lineCap = "round";
  g.font = "600 12px system-ui";
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (const level of DEPTH_LINES) {
    const segs = contourGrid(vals, n, level);
    if (!segs.length) continue;
    const path = new Path2D();
    for (const [x1, y1, x2, y2] of segs) {
      path.moveTo(x1 * step, y1 * step);
      path.lineTo(x2 * step, y2 * step);
    }
    const shallow = level <= 5;
    // The 1–5 m lines are the ones that matter for a keel: thicker, each its own colour.
    g.strokeStyle = "rgba(0,0,0,0.55)";
    g.lineWidth = shallow ? (bold ? 4 : 3.4) : bold ? 3.2 : 2.6;
    g.stroke(path);
    g.strokeStyle = depthLineColor(level);
    g.lineWidth = shallow ? (bold ? 2.2 : 1.8) : bold ? 1.4 : 1.1;
    g.stroke(path);
    // One label per level per tile, on a segment away from the edges.
    const mid = segs.find(([x1, y1]) => x1 > 8 && x1 < n - 8 && y1 > 8 && y1 < n - 8 && ((Math.round(x1) + Math.round(y1) + level) % 7 === 0)) ??
      segs.find(([x1, y1]) => x1 > 8 && x1 < n - 8 && y1 > 8 && y1 < n - 8);
    if (mid && segs.length > (shallow ? 3 : 6)) {
      const text = formatDepth(level).replace(/\.0(?=\s|$)/, "");
      const x = mid[0] * step;
      const y = mid[1] * step;
      g.lineWidth = 3;
      g.strokeStyle = "rgba(0,0,0,0.8)";
      g.strokeText(text, x, y);
      g.fillStyle = shallow ? depthLineColor(level) : "#ffffff";
      g.fillText(text, x, y);
    }
  }
  if (bold) done();
}

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
        const k = t.size / size;
        const ox = (coords.x - tx * scale) * size;
        const oy = (coords.y - ty * scale) * size;
        if (mode === "depth" || mode === "lines") drawLines(g, t, ox, oy, scale, k, tideMsl, mode === "lines", () => {
          done(undefined, canvas);
        });
        if (mode === "lines") return;
        const img = g.createImageData(size, size);
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
        // Shading goes under the lines (drawn after, on top).
        const lines = mode === "depth" ? g.getImageData(0, 0, size, size) : null;
        g.putImageData(img, 0, 0);
        if (lines) {
          const over = document.createElement("canvas");
          over.width = size;
          over.height = size;
          over.getContext("2d")?.putImageData(lines, 0, 0);
          g.drawImage(over, 0, 0);
        }
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
