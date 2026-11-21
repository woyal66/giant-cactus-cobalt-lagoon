import type { Map as LeafletMap, Point } from "leaflet";
import type { WeatherField } from "@/lib/routing/field";
import { thunderRisk } from "@/lib/routing/storm";
import { windColor } from "@/lib/weather";
import { contourSegments, extremes, isobarLevels, layerIndex, upsample, valueAt, vectorAt, type WxMapLayer } from "@/lib/wx-map";

type LeafletNS = typeof import("leaflet");

export type WxLayerState = {
  layer: WxMapLayer | "off";
  style: "particles" | "arrows";
  at: number;
  field: WeatherField | null;
};

const PAD = 0.3; // extra canvas around the view so heading-up rotation never shows bare corners

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function waveColor(m: number): string {
  const t = Math.min(1, m / 4);
  return `rgba(${Math.round(40 + 200 * t)},${Math.round(150 - 90 * t)},${Math.round(230 - 150 * t)},0.45)`;
}

const STORM = ["", "rgba(250,200,40,0.55)", "rgba(245,120,30,0.6)", "rgba(225,35,35,0.65)"];

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

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    moving.getContext("2d")?.clearRect(0, 0, moving.width, moving.height);
  }

  function draw() {
    stop();
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
    // Shade at low resolution, then scale up with smoothing so the colours blend.
    const shade = (step: number, color: (lat: number, lng: number) => string | null) => {
      const cw = Math.ceil(w / step);
      const ch = Math.ceil(h / step);
      const off = document.createElement("canvas");
      off.width = cw;
      off.height = ch;
      const o = off.getContext("2d");
      if (!o) return;
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const ll = toLatLng((x + 0.5) * step, (y + 0.5) * step);
          const c = color(ll.lat, ll.lng);
          if (!c) continue;
          o.fillStyle = c;
          o.fillRect(x, y, 1, 1);
        }
      }
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(off, 0, 0, cw * step, ch * step);
    };
    const L1 = state.layer;
    if (L1 === "gust") {
      shade(10, (la, lo) => {
        const v = valueAt(f, f.gustKn[t]!, la, lo);
        return Number.isFinite(v) ? rgba(windColor(v).bg, 0.45) : null;
      });
    } else if (L1 === "waves") {
      shade(10, (la, lo) => {
        const v = valueAt(f, f.waveM[t]!, la, lo);
        return Number.isFinite(v) ? waveColor(v) : null;
      });
    } else if (L1 === "rain" && f.precipMm) {
      shade(10, (la, lo) => {
        const v = valueAt(f, f.precipMm![t]!, la, lo);
        return v >= 0.1 ? `rgba(56,152,236,${Math.min(0.75, 0.15 + v / 6)})` : null;
      });
    } else if (L1 === "storm" && f.capeJkg) {
      shade(10, (la, lo) => {
        const r = thunderRisk({
          capeJkg: valueAt(f, f.capeJkg![t]!, la, lo),
          liftedIndex: f.liftedIndex ? valueAt(f, f.liftedIndex[t]!, la, lo) : NaN,
          cinJkg: f.cinJkg ? valueAt(f, f.cinJkg[t]!, la, lo) : NaN,
          precipMm: f.precipMm ? valueAt(f, f.precipMm[t]!, la, lo) : 0,
          code: f.code ? Math.round(valueAt(f, f.code[t]!, la, lo)) : 0,
          gustKn: valueAt(f, f.gustKn[t]!, la, lo),
          tempC: f.tempC ? valueAt(f, f.tempC[t]!, la, lo) : 25,
        });
        return STORM[r] || null;
      });
    } else if (L1 === "pressure" && f.pressureHpa) {
      const raw = f.pressureHpa[t]!;
      // Smooth the coarse grid so isobars are curves, not polygons.
      const up = upsample(f, raw, 4);
      const pg = up.grid;
      const p = up.values;
      g.lineWidth = 1.6;
      g.strokeStyle = "rgba(255,255,255,0.85)";
      g.font = "600 12px system-ui";
      g.textAlign = "center";
      g.textBaseline = "middle";
      for (const level of isobarLevels(p, 2)) {
        const segs = contourSegments(pg, p, level);
        g.beginPath();
        for (const [a, b] of segs) {
          const pa = toPx(a.lat, a.lng);
          const pb = toPx(b.lat, b.lng);
          g.moveTo(pa.x, pa.y);
          g.lineTo(pb.x, pb.y);
        }
        g.stroke();
        // Spread labels: each level labels a different part of its line.
        const mid = segs[Math.floor(segs.length * (((level / 2) % 5) + 0.5) / 5.5)];
        if (mid) {
          const pm = toPx(mid[0].lat, mid[0].lng);
          g.lineWidth = 3;
          g.strokeStyle = "rgba(0,0,0,0.7)";
          g.strokeText(String(level), pm.x, pm.y);
          g.fillStyle = "#fff";
          g.fillText(String(level), pm.x, pm.y);
          g.lineWidth = 1.6;
          g.strokeStyle = "rgba(255,255,255,0.85)";
        }
      }
      g.font = "700 26px system-ui";
      for (const e of extremes(f, raw)) {
        const pe = toPx(e.lat, e.lng);
        g.lineWidth = 4;
        g.strokeStyle = "rgba(0,0,0,0.7)";
        g.strokeText(e.kind, pe.x, pe.y);
        g.fillStyle = e.kind === "H" ? "#7dd3fc" : "#fca5a5";
        g.fillText(e.kind, pe.x, pe.y);
      }
    }
    if (L1 === "wind" || L1 === "current") {
      const knL = (L1 === "wind" ? f.windKn : f.curKn)[t]!;
      const dirL = (L1 === "wind" ? f.windDir : f.curDir)[t]!;
      const vec = (la: number, lo: number) => vectorAt(f, knL, dirL, la, lo, L1 === "current");
      if (state.style === "arrows") {
        const step = 64;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.font = "600 12px system-ui";
        for (let y = step / 2; y < h; y += step) {
          for (let x = step / 2; x < w; x += step) {
            const ll = toLatLng(x, y);
            const v = vec(ll.lat, ll.lng);
            if (!v) continue;
            const ang = Math.atan2(v.u, v.v); // clockwise from north, direction of travel
            const len = 16;
            const col = L1 === "wind" ? windColor(v.kn).bg : "#c4b5fd";
            g.save();
            g.translate(x, y);
            g.rotate(ang);
            g.strokeStyle = "rgba(0,0,0,0.6)";
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
            const label = L1 === "wind" ? String(Math.round(v.kn)) : v.kn.toFixed(1);
            g.lineWidth = 3;
            g.strokeStyle = "rgba(0,0,0,0.75)";
            g.strokeText(label, x + 18, y + 14);
            g.fillStyle = "#fff";
            g.fillText(label, x + 18, y + 14);
          }
        }
        return;
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
      const n = Math.min(1400, Math.round((w * h) / 2200));
      particles = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, age: Math.floor(Math.random() * 80) }));
      animate(w, h, dpr, L1 === "current" ? 1.4 : 0.22);
    }
  }

  function animate(w: number, h: number, dpr: number, pxPerKn: number) {
    const g = moving.getContext("2d");
    const fg = flowGrid;
    if (!g || !fg) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sample = (x: number, y: number) => {
      const i = Math.max(0, Math.min(fg.cols - 1, Math.round(x / fg.step)));
      const j = Math.max(0, Math.min(fg.rows - 1, Math.round(y / fg.step)));
      const k = j * fg.cols + i;
      return { u: fg.u[k]!, v: fg.v[k]!, kn: fg.kn[k]! };
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
        const nx = p.x + s.u * pxPerKn;
        const ny = p.y - s.v * pxPerKn;
        g.strokeStyle = state.layer === "wind" ? windColor(s.kn).bg : "#c4b5fd";
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
      const changed = next.layer !== state.layer || next.style !== state.style || next.at !== state.at || next.field !== state.field;
      state = next;
      if (changed) draw();
    },
    destroy() {
      stop();
      map.off("movestart zoomstart", onStart);
      map.off("moveend zoomend resize", onEnd);
      document.removeEventListener("visibilitychange", onVis);
      still.remove();
      moving.remove();
    },
  };
}
