#!/usr/bin/env node
/**
 * Build public/reefs/gbr.json (the planner's reef obstacles) and public/reefs/gbr-hazards.json
 * (reefs, drying reef, rocks, cays and islands drawn on the chart, offline) from the GBRMPA
 * "Great Barrier Reef Features" (CC BY 4.0, GBRMPA). Download both layers as GeoJSON from
 * the eAtlas map server:
 *
 *   curl -o feat.json "https://maps.eatlas.org.au/maps/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=ea:GBR_GBRMPA_GBR-features&outputFormat=application/json&srsName=EPSG:4326"
 *   curl -o dry.json  "https://maps.eatlas.org.au/maps/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=ea:GBR_GBRMPA_GBR-dry-reef&outputFormat=application/json&srsName=EPSG:4326"
 *   node scripts/build-reefs.mjs feat.json dry.json
 *
 * Keeps reefs, rocks, cays and islands (not the mainland), simplifies each outline to
 * about 30 m and stores coordinates at 1e-5°. Credit "GBRMPA" in the app's attributions.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

export const KEEP = /reef|rock|cay|island|shoal|bank/i;
const SCALE = 1e5;

/** Douglas–Peucker on [lng, lat] pairs, tolerance in degrees. Closed rings are split at
 * the point farthest from the start, since the first and last points are the same. */
export function simplifyRing(ring, tol) {
  if (ring.length <= 4) return ring;
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx === lx && fy === ly) {
    let far = 1;
    let farD = 0;
    for (let i = 1; i < ring.length - 1; i++) {
      const d = Math.hypot(ring[i][0] - fx, ring[i][1] - fy);
      if (d > farD) {
        farD = d;
        far = i;
      }
    }
    const a = simplifyLine(ring.slice(0, far + 1), tol);
    const b = simplifyLine(ring.slice(far), tol);
    const out = [...a, ...b.slice(1)];
    return out.length >= 4 ? out : ring;
  }
  return simplifyLine(ring, tol);
}

function simplifyLine(ring, tol) {
  if (ring.length <= 2) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [x1, y1] = ring[a];
    const [x2, y2] = ring[b];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1e-12;
    let best = -1;
    let bestD = 0;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = ring[i];
      const d = Math.abs((x2 - x1) * (y1 - y) - (x1 - x) * (y2 - y1)) / len;
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best > 0 && bestD > tol) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

function featureType(props = {}) {
  for (const k of ["FEAT_NAME", "FEATURE_TY", "FEAT_TYPE", "TYPE", "LEVEL_1"]) if (props[k]) return String(props[k]);
  return "Reef";
}

/** GeoJSON FeatureCollection → compact reef file. */
export function buildReefFile(geo, source = "GBRMPA Great Barrier Reef Features (CC BY 4.0)", tolDeg = 0.0003) {
  const polys = [];
  for (const f of geo.features ?? []) {
    if (!f?.geometry || !KEEP.test(featureType(f.properties)) || /mainland/i.test(featureType(f.properties))) continue;
    const g = f.geometry;
    const list = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const poly of list) {
      const outer = poly[0];
      if (!outer || outer.length < 4) continue;
      const ring = simplifyRing(outer, tolDeg);
      polys.push(ring.flatMap(([x, y]) => [Math.round(x * SCALE), Math.round(y * SCALE)]));
    }
  }
  return { v: 1, source, polys };
}

/** Hazard kind from a GBR Features class name. */
export function hazardKind(type) {
  const t = String(type).toLowerCase();
  if (t.includes("rock")) return "rock";
  if (t.includes("cay")) return "cay";
  if (t.includes("island")) return "island";
  if (t.includes("sand")) return "cay";
  if (t.includes("mainland")) return null;
  return "reef";
}

/**
 * GBR Features (+ optional dry reef layer) → the chart's hazard file
 * (public/reefs/gbr-hazards.json):
 *   { v: 1, source, items: [{ k: "reef"|"dry"|"rock"|"cay"|"island", n?: name, c: [lng, lat], b: [w, s, e, n], r: [ring, ...] }] }
 * Coordinates in 1e-5° integers; each ring is delta-encoded [x0, y0, dx1, dy1, ...].
 * Outlines are simplified to about 8 m.
 */
export function buildHazardFile(features, dryReef, source = "© Great Barrier Reef Marine Park Authority (GBR Features, CC BY 4.0)", tolDeg = 0.00008) {
  const items = [];
  const add = (kind, name, geometry) => {
    const list = geometry?.type === "Polygon" ? [geometry.coordinates] : geometry?.type === "MultiPolygon" ? geometry.coordinates : [];
    const rings = [];
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity, sx = 0, sy = 0, cnt = 0;
    for (const poly of list) {
      const outer = poly[0];
      if (!outer || outer.length < 4) continue;
      const ring = simplifyRing(outer, tolDeg);
      for (const [x, y] of ring) {
        w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
        sx += x; sy += y; cnt += 1;
      }
      // Delta-encoded: first point absolute, then steps from the previous point (small numbers).
      const flat = [];
      let px = 0;
      let py = 0;
      for (const [x, y] of ring) {
        const ix = Math.round(x * SCALE);
        const iy = Math.round(y * SCALE);
        flat.push(ix - px, iy - py);
        px = ix;
        py = iy;
      }
      rings.push(flat);
    }
    if (!rings.length) return;
    const r5 = (v) => Math.round(v * SCALE);
    const item = { k: kind, c: [r5(sx / cnt), r5(sy / cnt)], b: [r5(w), r5(s), r5(e), r5(n)], r: rings };
    if (name && !/^u\/n\b/i.test(name)) item.n = name;
    items.push(item);
  };
  for (const f of features.features ?? []) {
    const kind = hazardKind(featureType(f.properties));
    if (!kind) continue;
    const p = f.properties ?? {};
    add(kind, p.GBR_NAME || p.QLD_NAME || null, f.geometry);
  }
  for (const f of dryReef?.features ?? []) add("dry", null, f.geometry);
  return { v: 1, source, items };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // node scripts/build-reefs.mjs <gbr-features.geojson> [dry-reef.geojson]
  // Writes public/reefs/gbr.json (router obstacles) and public/reefs/gbr-hazards.json (chart).
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node scripts/build-reefs.mjs <gbr-features.geojson> [dry-reef.geojson]");
    process.exit(1);
  }
  const features = JSON.parse(readFileSync(input, "utf8"));
  const dry = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], "utf8")) : null;
  const file = buildReefFile(features);
  mkdirSync("public/reefs", { recursive: true });
  writeFileSync("public/reefs/gbr.json", JSON.stringify(file));
  console.log(`${file.polys.length} router outlines → public/reefs/gbr.json`);
  const hz = buildHazardFile(features, dry);
  writeFileSync("public/reefs/gbr-hazards.json", JSON.stringify(hz));
  console.log(`${hz.items.length} hazards → public/reefs/gbr-hazards.json`);
}
