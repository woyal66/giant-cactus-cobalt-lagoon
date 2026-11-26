import type { Coords, DoneCallback, GridLayer } from "leaflet";
import { LAND_MAX_Z, loadLandTile, sampleTile } from "@/lib/depth";
import { contourGrid } from "@/lib/contour";
import { LAND_LINE_STEP_M, hillshade, shadeRgba } from "@/lib/terrain";
import { formatLength } from "@/lib/units";

type LeafletNS = typeof import("leaflet");

export const ATTR_LAND = "Land heights: AWS Terrain Tiles (SRTM and others)";

/**
 * Land heights over the chart: hill shading so slopes and ridges stand out, and height lines
 * every 50 m (labelled every 100 m). Land only; the water is left clear. Shows where high ground
 * gives shelter, from free worldwide terrain tiles (about 30 m detail on land).
 */
export function createLandLayer(L: LeafletNS, maxZoom: number): GridLayer {
  const Layer = L.GridLayer.extend({
    createTile(this: GridLayer, coords: Coords, done: DoneCallback) {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const z = Math.min(coords.z, LAND_MAX_Z);
      const scale = 2 ** (coords.z - z);
      const tx = Math.floor(coords.x / scale);
      const ty = Math.floor(coords.y / scale);
      void loadLandTile(z, tx, ty).then((t) => {
        const g = canvas.getContext("2d");
        if (!t || !g) {
          done(undefined, canvas);
          return;
        }
        const k = t.size / size;
        const ox = (coords.x - tx * scale) * size;
        const oy = (coords.y - ty * scale) * size;
        // Heights on a grid with a one-pixel border, so shading and lines join across tiles.
        const n = 66;
        const step = size / (n - 2);
        const hs = new Float32Array(n * n);
        for (let j = 0; j < n; j++) {
          for (let i = 0; i < n; i++) {
            hs[j * n + i] = sampleTile(t, ((ox + (i - 1) * step) / scale) * k, ((oy + (j - 1) * step) / scale) * k);
          }
        }
        const n2 = 2 ** coords.z;
        const latC = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (coords.y + 0.5)) / n2))) * 180) / Math.PI;
        const cellM = ((40075016.686 * Math.cos((latC * Math.PI) / 180)) / (256 * n2)) * step;
        const shade = hillshade(hs, n, cellM);
        const small = document.createElement("canvas");
        small.width = n - 2;
        small.height = n - 2;
        const sg = small.getContext("2d");
        if (sg) {
          const img = sg.createImageData(n - 2, n - 2);
          for (let j = 1; j < n - 1; j++) {
            for (let i = 1; i < n - 1; i++) {
              const c = shadeRgba(shade[j * n + i]!);
              if (!c) continue;
              const o = ((j - 1) * (n - 2) + (i - 1)) * 4;
              img.data[o] = c[0];
              img.data[o + 1] = c[1];
              img.data[o + 2] = c[2];
              img.data[o + 3] = c[3];
            }
          }
          sg.putImageData(img, 0, 0);
          g.imageSmoothingEnabled = true;
          g.drawImage(small, 0, 0, size, size);
        }
        // Height lines: every 50 m; thicker and labelled every 100 m.
        let top = 0;
        for (const v of hs) if (v > top) top = v;
        g.lineJoin = "round";
        // Labels placed apart from each other, at different points round each line.
        const placed: Array<[number, number]> = [];
        g.font = "600 11px system-ui";
        g.textAlign = "center";
        g.textBaseline = "middle";
        for (let level = LAND_LINE_STEP_M; level <= top; level += LAND_LINE_STEP_M) {
          const segs = contourGrid(hs, n, level);
          if (!segs.length) continue;
          const major = level % 100 === 0;
          const path = new Path2D();
          for (const [x1, y1, x2, y2] of segs) {
            path.moveTo((x1 - 1) * step, (y1 - 1) * step);
            path.lineTo((x2 - 1) * step, (y2 - 1) * step);
          }
          g.strokeStyle = "rgba(60,30,0,0.55)";
          g.lineWidth = major ? 2.4 : 1.6;
          g.stroke(path);
          g.strokeStyle = major ? "rgba(255,214,160,0.95)" : "rgba(255,214,160,0.6)";
          g.lineWidth = major ? 1.2 : 0.7;
          g.stroke(path);
          if (major && segs.length > 6) {
            const start = Math.floor(((level / 100) * 0.37 % 1) * segs.length);
            for (let q = 0; q < segs.length; q += 1) {
              const [x1, y1] = segs[(start + q) % segs.length]!;
              if (!(x1 > 6 && x1 < n - 6 && y1 > 6 && y1 < n - 6)) continue;
              const px = (x1 - 1) * step;
              const py = (y1 - 1) * step;
              if (placed.some(([a, b]) => Math.hypot(a - px, b - py) < 40)) continue;
              placed.push([px, py]);
              const text = formatLength(level);
              g.lineWidth = 3;
              g.strokeStyle = "rgba(40,20,0,0.85)";
              g.strokeText(text, px, py);
              g.fillStyle = "#ffe2b8";
              g.fillText(text, px, py);
              break;
            }
          }
        }
        done(undefined, canvas);
      });
      return canvas;
    },
  });
  return new (Layer as unknown as new (o: object) => GridLayer)({
    maxZoom,
    minZoom: 8,
    pane: "chartOverlay",
    attribution: ATTR_LAND,
    updateWhenZooming: false,
    keepBuffer: 2,
  });
}
