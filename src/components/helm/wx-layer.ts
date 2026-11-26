import type { Map as LeafletMap, Point } from "leaflet";
import type { WeatherField } from "@/lib/routing/field";
import { thunderRisk } from "@/lib/routing/storm";
import { RAIN_BANDS, rainBandIndex, rainRateFromDbz, stormCells } from "@/lib/rain";
import { latLngOfWorld, type RainNow } from "@/components/helm/rain-now";
import {
  CLOUD_RAMP,
  CURRENT_RAMP,
  PRESSURE_RAMP,
  WAVE_RAMP,
  WIND_RAMP,
  contourSegments,
  extremesSmooth,
  isobarLevels,
  isobarStep,
  layerIndex,
  rampColor,
  smoothLines,
  upsample,
  valueAt,
  valueAtEdge,
  vectorAt,
  type Ramp,
  type WxMapLayer,
} from "@/lib/wx-map";

type LeafletNS = typeof import("leaflet");

export type WxLayerState = {
  layer: WxMapLayer | "off";
  style: "particles" | "arrows";
  at: number;
  field: WeatherField | null;
  /** Isobars over any layer (always on the Pressure layer). */
  isobars?: boolean;
  /** Live radar frame to draw instead of the model's rain (Rain & thunder layer). */
  live?: { rain: RainNow; at: number } | null;
};

/** Natural Earth 1:50m coastline and borders, loaded the first time the weather map is drawn. */
let coast: { coast: Array<Array<[number, number]>>; borders: Array<Array<[number, number]>> } | null = null;
let coastLoading: Promise<void> | null = null;
function loadCoast(): Promise<void> {
  coastLoading ??= Promise.all([import("topojson-client"), import("world-atlas/countries-50m.json")])
    .then(([{ mesh }, topo]) => {
      const t = ((topo as { default?: unknown }).default ?? topo) as Parameters<typeof mesh>[0];
      const objs = (t as unknown as { objects: Record<string, Parameters<typeof mesh>[1]> }).objects;
      const land = mesh(t, objs.land!);
      const border = mesh(t, objs.countries!, (a, b) => a !== b);
      coast = { coast: land.coordinates as Array<Array<[number, number]>>, borders: border.coordinates as Array<Array<[number, number]>> };
    })
    .catch(() => {
      coast = { coast: [], borders: [] };
    });
  return coastLoading;
}

const PAD = 0.3; // extra canvas around the view so heading-up rotation never shows bare corners

/**
 * Weather drawn over the chart: shading, isobars and arrows on one canvas, moving particles on
 * another. Everything is redrawn after the map stops moving; particles pause during gestures.
 */
export function createWxLayer(L: LeafletNS, map: LeafletMap) {
  const pane = map.getPane("wxPane") ?? map.createPane("wxPane", map.getPane("rotatePane") ?? map.getPane("mapPane"));
  pane.style.zIndex = "275";
  pane.style.pointerEvents = "none";
  const still = document.createElement("canvas");
  const moving = document.createElement("canvas");
  for (const c of [still, moving]) {
    c.style.position = "absolute";
    c.style.pointerEvents = "none";
    pane.appendChild(c);
  }
  let state: WxLayerState = { layer: "off", style: "particles", at: Date.now(), field: null };
  let origin: Point = L.point(0, 0);
  let raf = 0;
  let flowGrid: { step: number; cols: number; rows: number; u: Float32Array; v: Float32Array; kn: Float32Array } | null = null;
  let particles: { x: number; y: number; age: number }[] = [];
  let lastW = 0;
  let lastH = 0;
  let pending = 0;

  const frame = () => {
    const size = map.getSize();
    const corners = [L.point(0, 0), L.point(size.x, 0), L.point(0, size.y), L.point(size.x, size.y)].map((p) =>
      map.containerPointToLayerPoint(p),
    );
    const minX = Math.min(...corners.map((p) => p.x));
    const maxX = Math.max(...corners.map((p) => p.x));
    const minY = Math.min(...corners.map((p) => p.y));
    const maxY = Math.max(...corners.map((p) => p.y));
    const w = maxX - minX;
    const h = maxY - minY;
    origin = L.point(minX - w * PAD, minY - h * PAD);
    return { w: Math.ceil(w * (1 + 2 * PAD)), h: Math.ceil(h * (1 + 2 * PAD)) };
  };

  const toPx = (lat: number, lng: number) => {
    const p = map.latLngToLayerPoint([lat, lng]);
    return { x: p.x - origin.x, y: p.y - origin.y };
  };
  const toLatLng = (x: number, y: number) => map.layerPointToLatLng(L.point(x + origin.x, y + origin.y));

  function stop(clear = true) {
    cancelAnimationFrame(raf);
    raf = 0;
    if (clear) moving.getContext("2d")?.clearRect(0, 0, moving.width, moving.height);
  }

  /** A radar frame by rain intensity, plus storm cores outlined and labelled. */
  function drawRadar(g: CanvasRenderingContext2D, r: RainNow, at: number) {
    let fr = r.frames[0];
    for (const x of r.frames) if (Math.abs(x.at - at) < Math.abs((fr?.at ?? 0) - at)) fr = x;
    if (!fr) return;
    const grid = fr.grid ?? r.grid;
    const { w, h } = grid;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const o = off.getContext("2d");
    if (!o) return;
    const img = o.createImageData(w, h);
    for (let k = 0; k < w * h; k++) {
      const b = rainBandIndex(rainRateFromDbz(fr.dbz[k]!));
      if (b < 0) continue;
      const c = RAIN_BANDS[b]!.color;
      img.data[k * 4] = c[0];
      img.data[k * 4 + 1] = c[1];
      img.data[k * 4 + 2] = c[2];
      img.data[k * 4 + 3] = fr.outlook ? 150 : 190;
    }
    o.putImageData(img, 0, 0);
    const nw = latLngOfWorld(grid.x0, grid.y0, grid.z);
    const se = latLngOfWorld(grid.x0 + w, grid.y0 + h, grid.z);
    const a = toPx(nw.lat, nw.lng);
    const b = toPx(se.lat, se.lng);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(off, a.x, a.y, b.x - a.x, b.y - a.y);
    // Storm cores (50 dBZ and up): ringed, with the way they are heading.
    const sx = (b.x - a.x) / w;
    const sy = (b.y - a.y) / h;
    g.font = "600 14px system-ui";
    g.textAlign = "center";
    for (const c of stormCells(fr.dbz, w, h).slice(0, 12)) {
      const x = a.x + c.x * sx;
      const y = a.y + c.y * sy;
      const rad = Math.max(10, Math.sqrt(c.cells) * sx * 0.8);
      g.lineWidth = 3;
      g.strokeStyle = "rgba(0,0,0,0.7)";
      g.beginPath();
      g.arc(x, y, rad + 1.5, 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = 2;
      g.strokeStyle = "#ffffff";
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.stroke();
      if (r.towardDeg != null) arrow(g, x, y - rad - 14, (r.towardDeg * Math.PI) / 180, 12, "#ffffff", "");
      g.lineWidth = 4;
      g.strokeStyle = "rgba(0,0,0,0.75)";
      g.strokeText("Storm", x, y + rad + 16);
      g.fillStyle = "#ffffff";
      g.fillText("Storm", x, y + rad + 16);
    }
  }

  /** Isobars with pressure labels, and H / L at the centres. Strong on the Pressure layer. */
  function drawIsobars(g: CanvasRenderingContext2D, f: WeatherField, t: number, strong: boolean) {
    if (!f.pressureHpa) return;
      const raw = f.pressureHpa[t]!;
      // Smooth the coarse grid so isobars are curves, not polygons; spacing adapts to the view.
      const up = upsample(f, raw, 4);
      const pg = up.grid;
      const p = up.values;
      const stepHpa = isobarStep(raw);
      g.font = "600 13px system-ui";
      g.textAlign = "center";
      g.textBaseline = "middle";
      for (const level of isobarLevels(p, stepHpa)) {
        const lines = smoothLines(contourSegments(pg, p, level));
        const path = new Path2D();
        for (const line of lines) {
          line.forEach((q, i) => {
            const pq = toPx(q.lat, q.lng);
            if (i === 0) path.moveTo(pq.x, pq.y);
            else path.lineTo(pq.x, pq.y);
          });
        }
        g.lineJoin = "round";
        g.lineCap = "round";
        const major = level % (stepHpa * 2) === 0;
        g.lineWidth = strong ? (major ? 4.5 : 3.5) : major ? 3.5 : 2.5;
        g.strokeStyle = "rgba(0,0,0,0.55)";
        g.stroke(path);
        g.lineWidth = strong ? (major ? 2.2 : 1.4) : major ? 1.6 : 1;
        g.strokeStyle = strong ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.8)";
        g.stroke(path);
        // Spread labels: each level labels a different part of its line.
        const longest = lines.reduce<(typeof lines)[number] | undefined>((m, l) => (!m || l.length > m.length ? l : m), undefined);
        const mid = longest?.[Math.floor((longest.length * (((level / stepHpa) % 5) + 0.5)) / 5.5)];
        if (mid) {
          const pm = toPx(mid.lat, mid.lng);
          g.lineWidth = 3.5;
          g.strokeStyle = "rgba(0,0,0,0.8)";
          g.strokeText(String(level), pm.x, pm.y);
          g.fillStyle = "#fff";
          g.fillText(String(level), pm.x, pm.y);
        }
      }
      g.font = "700 28px system-ui";
      for (const e of extremesSmooth(f, raw, 4)) {
        const pe = toPx(e.lat, e.lng);
        g.lineWidth = 4;
        g.strokeStyle = "rgba(0,0,0,0.75)";
        g.strokeText(e.kind, pe.x, pe.y);
        g.fillStyle = e.kind === "H" ? "#7dd3fc" : "#fca5a5";
        g.fillText(e.kind, pe.x, pe.y);
      }
  }

  /** A lightning bolt at each grid point where the model gives a thunderstorm risk. */
  function drawThunder(g: CanvasRenderingContext2D, f: WeatherField, t: number) {
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let j = 0; j < f.ny; j++) {
      for (let i = 0; i < f.nx; i++) {
        const k = j * f.nx + i;
        const r = thunderRisk({
          capeJkg: f.capeJkg![t]![k]!,
          liftedIndex: f.liftedIndex ? f.liftedIndex[t]![k]! : NaN,
          cinJkg: f.cinJkg ? f.cinJkg[t]![k]! : NaN,
          precipMm: f.precipMm ? f.precipMm[t]![k]! : 0,
          code: f.code ? Math.round(f.code[t]![k]!) : 0,
          gustKn: f.gustKn[t]![k]!,
          tempC: f.tempC ? f.tempC[t]![k]! : 25,
        });
        if (r < 1) continue;
        const p = toPx(f.lat0 + j * f.dLat, f.lng0 + i * f.dLng);
        g.font = `700 ${r >= 2 ? 22 : 15}px system-ui`;
        g.lineWidth = 4;
        g.strokeStyle = "rgba(0,0,0,0.7)";
        g.strokeText("⚡", p.x, p.y);
        g.fillStyle = r >= 3 ? "#fde047" : r >= 2 ? "#fef08a" : "rgba(254,240,138,0.75)";
        g.fillText("⚡", p.x, p.y);
      }
    }
  }

  /** Coastlines and borders over the colour (zoomed out), so the map reads like Windy's. */
  function drawCoast(g: CanvasRenderingContext2D, w: number, h: number) {
    if (map.getZoom() > 9) return;
    if (!coast) {
      void loadCoast().then(() => draw(true));
      return;
    }
    const b = map.getBounds().pad(0.5);
    const path = new Path2D();
    const borders = new Path2D();
    const add = (pp: Path2D, line: Array<[number, number]>) => {
      let started = false;
      for (const [lng, lat] of line) {
        if (lat < b.getSouth() - 2 || lat > b.getNorth() + 2) {
          started = false;
          continue;
        }
        const q = toPx(lat, lng);
        if (q.x < -w || q.x > 2 * w || q.y < -h || q.y > 2 * h) {
          started = false;
          continue;
        }
        if (!started) pp.moveTo(q.x, q.y);
        else pp.lineTo(q.x, q.y);
        started = true;
      }
    };
    for (const line of coast.coast) add(path, line);
    for (const line of coast.borders) add(borders, line);
    g.lineJoin = "round";
    g.lineWidth = 1.2;
    g.strokeStyle = "rgba(255,255,255,0.75)";
    g.stroke(path);
    g.lineWidth = 0.8;
    g.setLineDash([4, 3]);
    g.strokeStyle = "rgba(255,255,255,0.45)";
    g.stroke(borders);
    g.setLineDash([]);
  }

  function draw(keep = false) {
    stop(!keep);
    const { w, h } = frame();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [still, moving]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      L.DomUtil.setPosition(c, origin);
    }
    const g = still.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const f = state.field;
    if (state.layer === "off") return;
    const live = state.live && state.layer === "rain" ? state.live : null;
    if (live) drawRadar(g, live.rain, live.at);
    if (!f) return;
    const t = layerIndex(f, state.at);
    // Smooth colour fill: sample on a coarse pixel grid, then scale up with smoothing.
    const shade = (step: number, color: (lat: number, lng: number) => [number, number, number, number] | null) => {
      const cw = Math.ceil(w / step);
      const ch = Math.ceil(h / step);
      const off = document.createElement("canvas");
      off.width = cw;
      off.height = ch;
      const o = off.getContext("2d");
      if (!o) return;
      const img = o.createImageData(cw, ch);
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const ll = toLatLng((x + 0.5) * step, (y + 0.5) * step);
          const c = color(ll.lat, ll.lng);
          if (!c) continue;
          const k = (y * cw + x) * 4;
          img.data[k] = c[0];
          img.data[k + 1] = c[1];
          img.data[k + 2] = c[2];
          img.data[k + 3] = c[3];
        }
      }
      o.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(off, 0, 0, cw * step, ch * step);
    };
    // Colour carried just past the grid's edge and faded, so it reaches the screen edge.
    const fill = (layer: Float32Array | undefined, ramp: Ramp, alpha: number) => {
      if (!layer) return;
      shade(6, (la, lo) => {
        const e = valueAtEdge(f, layer, la, lo);
        if (!Number.isFinite(e.v)) return null;
        const c = rampColor(ramp, e.v);
        return [c[0], c[1], c[2], Math.round(alpha * e.a)];
      });
    };
    const L1 = state.layer;
    if (L1 === "wind") fill(f.windKn[t], WIND_RAMP, 128);
    else if (L1 === "gust") fill(f.gustKn[t], WIND_RAMP, 128);
    else if (L1 === "current") fill(f.curKn[t], CURRENT_RAMP, 128);
    else if (L1 === "waves") fill(f.waveM[t], WAVE_RAMP, 128);
    else if (L1 === "pressure") fill(f.pressureHpa?.[t], PRESSURE_RAMP, 120);
    else if (L1 === "rain" && !live && f.precipMm) {
      // Rain by intensity band. The model grid is coarse (about 10–25 km), so it is smoothed
      // into rounded areas; the live radar shows the real detail.
      const up = upsample(f, f.precipMm[t]!, 4);
      const ug = up.grid as unknown as WeatherField;
      shade(4, (la, lo) => {
        const e = valueAtEdge(ug, up.values, la, lo, 10);
        const k = rainBandIndex(e.v);
        if (k < 0) return null;
        const c = RAIN_BANDS[k]!.color;
        return [c[0], c[1], c[2], Math.round((k === 0 ? 110 : 150) * e.a)];
      });
    } else if (L1 === "cloud" && f.cloudPct) {
      // Cloud: a veil as thick as the cover; low cloud (the kind that hides reefs) greyer.
      shade(6, (la, lo) => {
        const e = valueAtEdge(f, f.cloudPct![t]!, la, lo);
        const tot = e.v;
        if (!Number.isFinite(tot) || tot < 8) return null;
        const low = f.lowCloudPct ? valueAt(f, f.lowCloudPct[t]!, la, lo) : NaN;
        const share = Number.isFinite(low) && tot > 0 ? Math.min(1, low / tot) : 0;
        const c = rampColor(CLOUD_RAMP, 100 - share * 45);
        return [c[0], c[1], c[2], Math.round((30 + tot * 1.6) * e.a)];
      });
    }
    drawCoast(g, w, h);
    // Thunder on the rain layer: a bolt where storms are possible (model; live radar rings cores).
    if (L1 === "rain" && !live && f.capeJkg) drawThunder(g, f, t);
    if (L1 === "pressure" || state.isobars) drawIsobars(g, f, t, L1 === "pressure");
    // Motion: every layer moves. Wind, gust and current follow their own flow; waves drift along
    // the direction they travel; pressure, rain and storm show the wind beneath them, fainter.
    const waves = L1 === "waves";
    const own = L1 === "wind" || L1 === "gust" || L1 === "current" || waves;
    const knL = (L1 === "current" ? f.curKn : L1 === "gust" ? f.gustKn : waves ? f.waveM : f.windKn)[t];
    const dirL = (L1 === "current" ? f.curDir : waves ? f.waveDir : f.windDir)[t];
    if (!knL || !dirL) return;
    const vec = (la: number, lo: number) => {
      if (L1 !== "gust") return vectorAt(f, knL, dirL, la, lo, L1 === "current");
      // Gusts move with the wind but are coloured and sized by gust strength.
      const wv = vectorAt(f, f.windKn[t]!, dirL, la, lo, false);
      const gk = valueAt(f, knL, la, lo);
      if (!wv || !Number.isFinite(gk) || wv.kn <= 0) return null;
      const k = gk / wv.kn;
      return { kn: gk, u: wv.u * k, v: wv.v * k };
    };
    if (state.style === "arrows" || waves) {
      if (own) {
        const step = waves ? 72 : 64;
        for (let y = step / 2; y < h; y += step) {
          for (let x = step / 2; x < w; x += step) {
            const ll = toLatLng(x, y);
            const v = vec(ll.lat, ll.lng);
            if (!v) continue;
            const label = L1 === "current" || waves ? v.kn.toFixed(1) : String(Math.round(v.kn));
            arrow(g, x, y, Math.atan2(v.u, v.v), waves ? 12 : 16, "#ffffff", label);
          }
        }
      }
      if (state.style === "arrows") return;
    }
    // Particles: velocity on a coarse pixel grid, then animate.
    const step = 24;
    const cols = Math.ceil(w / step) + 1;
    const rows = Math.ceil(h / step) + 1;
    const u = new Float32Array(cols * rows);
    const v = new Float32Array(cols * rows);
    const kn = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const ll = toLatLng(i * step, j * step);
        const vv = vec(ll.lat, ll.lng);
        const k = j * cols + i;
        if (!vv) {
          kn[k] = NaN;
          continue;
        }
        u[k] = vv.u;
        v[k] = vv.v;
        kn[k] = vv.kn;
      }
    }
    flowGrid = { step, cols, rows, u, v, kn };
    const n = Math.min(own ? 1300 : 700, Math.round((w * h) / (own ? 2400 : 4200)));
    // Keep the particles when only the time or data changed, so the slider never restarts them.
    if (!keep || particles.length !== n || w !== lastW || h !== lastH) {
      particles = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, age: Math.floor(Math.random() * 80) }));
    }
    lastW = w;
    lastH = h;
    // Pixels a frame per unit: currents are slow, so they get a bigger scale to be seen moving;
    // waves (metres) drift at a steady pace that grows with height.
    const speed = L1 === "current" ? 2 : waves ? 0.8 : 0.12;
    const color = L1 === "current" ? "rgba(235,225,255,0.7)" : waves ? "rgba(220,240,255,0.7)" : own ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.38)";
    animate(w, h, dpr, speed, color, waves);
  }

  /** An arrow pointing along `ang` (radians clockwise from north) with an outlined label. */
  function arrow(g: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, col: string, label: string) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.strokeStyle = "rgba(0,0,0,0.65)";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(0, len);
    g.lineTo(0, -len);
    g.stroke();
    g.strokeStyle = col;
    g.fillStyle = col;
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(0, len);
    g.lineTo(0, -len + 6);
    g.stroke();
    g.beginPath();
    g.moveTo(0, -len - 2);
    g.lineTo(-6, -len + 8);
    g.lineTo(6, -len + 8);
    g.closePath();
    g.fill();
    g.restore();
    g.font = "600 13px system-ui";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 3.5;
    g.strokeStyle = "rgba(0,0,0,0.8)";
    g.strokeText(label, x + 20, y + 14);
    g.fillStyle = "#fff";
    g.fillText(label, x + 20, y + 14);
  }

  function animate(w: number, h: number, dpr: number, pxPerKn: number, color: string, minSpeed: boolean) {
    const g = moving.getContext("2d");
    const fg = flowGrid;
    if (!g || !fg) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Bilinear between grid points so particles curve smoothly instead of stepping.
    const sample = (x: number, y: number) => {
      const fx = Math.max(0, Math.min(fg.cols - 1.001, x / fg.step));
      const fy = Math.max(0, Math.min(fg.rows - 1.001, y / fg.step));
      const i = Math.floor(fx);
      const j = Math.floor(fy);
      const tx = fx - i;
      const ty = fy - j;
      const k00 = j * fg.cols + i;
      const ks = [k00, k00 + 1, k00 + fg.cols, k00 + fg.cols + 1];
      const ws = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
      let u = 0;
      let v = 0;
      let kn = 0;
      let wsum = 0;
      for (let q = 0; q < 4; q++) {
        const kk = fg.kn[ks[q]!]!;
        if (!Number.isFinite(kk)) continue;
        u += fg.u[ks[q]!]! * ws[q]!;
        v += fg.v[ks[q]!]! * ws[q]!;
        kn += kk * ws[q]!;
        wsum += ws[q]!;
      }
      if (wsum < 0.25) return { u: 0, v: 0, kn: NaN };
      return { u: u / wsum, v: v / wsum, kn: kn / wsum };
    };
    // About 30 frames a second, all particles drawn as one path: the same look as 60 fps with
    // one stroke each, for a fraction of the battery. Steps and the fading trail are scaled by
    // the real time between frames, so speed and trail length don't change.
    let lastT = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (lastT && now - lastT < 30) return;
      const k = lastT ? Math.min(3, (now - lastT) / 16.7) : 1;
      lastT = now;
      g.globalCompositeOperation = "destination-in";
      g.fillStyle = `rgba(0,0,0,${Math.pow(0.78, k).toFixed(3)})`;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "source-over";
      g.lineWidth = 1.1;
      g.strokeStyle = color;
      g.beginPath();
      for (const p of particles) {
        const s = sample(p.x, p.y);
        if (!Number.isFinite(s.kn) || p.age > 55) {
          p.x = Math.random() * w;
          p.y = Math.random() * h;
          p.age = 0;
          continue;
        }
        // Waves keep a visible drift even where they are small.
        const boost = minSpeed && s.kn > 0 && s.kn < 0.6 ? 0.6 / s.kn : 1;
        const nx = p.x + s.u * pxPerKn * boost * k;
        const ny = p.y - s.v * pxPerKn * boost * k;
        g.moveTo(p.x, p.y);
        g.lineTo(nx, ny);
        p.x = nx;
        p.y = ny;
        p.age += k;
        if (p.x < 0 || p.y < 0 || p.x > w || p.y > h) p.age = 999;
      }
      g.stroke();
    };
    raf = requestAnimationFrame(tick);
  }

  const onStart = () => stop();
  const onEnd = () => draw();
  map.on("movestart zoomstart", onStart);
  map.on("moveend zoomend resize", onEnd);
  const onVis = () => (document.hidden ? stop() : draw());
  document.addEventListener("visibilitychange", onVis);

  return {
    set(next: WxLayerState) {
      const restart = next.layer !== state.layer || next.style !== state.style || Boolean(next.isobars) !== Boolean(state.isobars);
      const changed = restart || next.at !== state.at || next.field !== state.field || next.live?.rain !== state.live?.rain || next.live?.at !== state.live?.at;
      state = next;
      if (!changed) return;
      if (restart) {
        cancelAnimationFrame(pending);
        pending = 0;
        draw();
        return;
      }
      // Time slider: redraw at most once a frame and keep the particles flowing.
      if (!pending)
        pending = requestAnimationFrame(() => {
          pending = 0;
          draw(true);
        });
    },
    destroy() {
      cancelAnimationFrame(pending);
      stop();
      map.off("movestart zoomstart", onStart);
      map.off("moveend zoomend resize", onEnd);
      document.removeEventListener("visibilitychange", onVis);
      still.remove();
      moving.remove();
    },
  };
}
