#!/usr/bin/env node
/**
 * Build public/reefs/gbr.json (the planner's reef obstacles) from the GBRMPA
 * "Great Barrier Reef Features" GeoJSON (CC BY 4.0, GBRMPA). Download it from the
 * GBRMPA GeoHub / eAtlas as GeoJSON in WGS84, then:
 *
 *   node scripts/build-reefs.mjs path/to/gbr-features.geojson
 *
 * Keeps reefs, rocks, cays and islands (not the mainland), simplifies each outline to
 * about 30 m and stores coordinates at 1e-5°. Credit "GBRMPA" in the app's attributions.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

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

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = process.argv[2];
  const output = process.argv[3] ?? "public/reefs/gbr.json";
  if (!input) {
    console.error("Usage: node scripts/build-reefs.mjs <features.geojson> [output.json]");
    process.exit(1);
  }
  const file = buildReefFile(JSON.parse(readFileSync(input, "utf8")));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(file));
  console.log(`${file.polys.length} outlines → ${output}`);
}
