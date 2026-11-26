import type { Map as LeafletMap, Point } from "leaflet";
import type { WeatherField } from "@/lib/routing/field";
import { thunderRisk } from "@/lib/routing/storm";
import {
  CAPE_RAMP,
  CURRENT_RAMP,
  RAIN_RAMP,
  WAVE_RAMP,
  WIND_RAMP,
  contourSegments,
  extremes,
  isobarLevels,
  isobarStep,
  layerIndex,
  rampColor,
  smoothLines,
  upsample,
  valueAt,
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
};

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
    if (state.layer === "off" || !f) return;
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
    const fill = (layer: Float32Array | undefined, ramp: Ramp, alpha: number, min = -Infinity) => {
      if (!layer) return;
      shade(6, (la, lo) => {
        const v = valueAt(f, layer, la, lo);
        if (!Number.isFinite(v) || v < min) return null;
        const c = rampColor(ramp, v);
        return [c[0], c[1], c[2], alpha];
      });
    };
    const L1 = state.layer;
    if (L1 === "wind") fill(f.windKn[t], WIND_RAMP, 110);
    else if (L1 === "gust") fill(f.gustKn[t], WIND_RAMP, 130);
    else if (L1 === "current") fill(f.curKn[t], CURRENT_RAMP, 95);
    else if (L1 === "waves") fill(f.waveM[t], WAVE_RAMP, 125);
    else if (L1 === "rain") fill(f.precipMm?.[t], RAIN_RAMP, 150, 0.1);
    else if (L1 === "storm" && f.capeJkg) {
      shade(6, (la, lo) => {
        const cape = valueAt(f, f.capeJkg![t]!, la, lo);
        const r = thunderRisk({
          capeJkg: cape,
          liftedIndex: f.liftedIndex ? valueAt(f, f.liftedIndex[t]!, la, lo) : NaN,
          cinJkg: f.cinJkg ? valueAt(f, f.cinJkg[t]!, la, lo) : NaN,
          precipMm: f.precipMm ? valueAt(f, f.precipMm[t]!, la, lo) : 0,
          code: f.code ? Math.round(valueAt(f, f.code[t]!, la, lo)) : 0,
          gustKn: valueAt(f, f.gustKn[t]!, la, lo),
          tempC: f.tempC ? valueAt(f, f.tempC[t]!, la, lo) : 25,
        });
        if (!r) return null;
        const c = rampColor(CAPE_RAMP, Math.max(cape, [0, 600, 1500, 2800][r]!));
        return [c[0], c[1], c[2], 90 + 35 * r];
      });
    } else if (L1 === "pressure" && f.pressureHpa) {
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
        g.lineWidth = major ? 4.5 : 3.5;
        g.strokeStyle = "rgba(0,0,0,0.55)";
        g.stroke(path);
        g.lineWidth = major ? 2.2 : 1.4;
        g.strokeStyle = "rgba(255,255,255,0.95)";
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
      for (const e of extremes(f, raw)) {
        const pe = toPx(e.lat, e.lng);
        g.lineWidth = 4;
        g.strokeStyle = "rgba(0,0,0,0.75)";
        g.strokeText(e.kind, pe.x, pe.y);
        g.fillStyle = e.kind === "H" ? "#7dd3fc" : "#fca5a5";
        g.fillText(e.kind, pe.x, pe.y);
      }
    }
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
    const n = Math.min(own ? 1600 : 900, Math.round((w * h) / (own ? 1900 : 3200)));
    // Keep the particles when only the time or data changed, so the slider never restarts them.
    if (!keep || particles.length !== n || w !== lastW || h !== lastH) {
      particles = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, age: Math.floor(Math.random() * 80) }));
    }
    lastW = w;
    lastH = h;
    // Pixels a frame per unit: currents are slow, so they get a bigger scale to be seen moving;
    // waves (metres) drift at a steady pace that grows with height.
    const speed = L1 === "current" ? 3.2 : waves ? 1.3 : 0.22;
    const color = L1 === "current" ? "rgba(235,225,255,0.92)" : waves ? "rgba(220,240,255,0.9)" : own ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.5)";
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
    const tick = () => {
      g.globalCompositeOperation = "destination-in";
      g.fillStyle = "rgba(0,0,0,0.9)";
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "source-over";
      g.lineWidth = 1.6;
      for (const p of particles) {
        const s = sample(p.x, p.y);
        if (!Number.isFinite(s.kn) || p.age > 90) {
          p.x = Math.random() * w;
          p.y = Math.random() * h;
          p.age = 0;
          continue;
        }
        // Waves keep a visible drift even where they are small.
        const boost = minSpeed && s.kn > 0 && s.kn < 0.6 ? 0.6 / s.kn : 1;
        const nx = p.x + s.u * pxPerKn * boost;
        const ny = p.y - s.v * pxPerKn * boost;
        g.strokeStyle = color;
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(nx, ny);
        g.stroke();
        p.x = nx;
        p.y = ny;
        p.age += 1;
        if (p.x < 0 || p.y < 0 || p.x > w || p.y > h) p.age = 999;
      }
      raf = requestAnimationFrame(tick);
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
      const restart = next.layer !== state.layer || next.style !== state.style;
      const changed = restart || next.at !== state.at || next.field !== state.field;
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
