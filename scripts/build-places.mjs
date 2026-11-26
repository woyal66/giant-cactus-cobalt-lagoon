#!/usr/bin/env node
/**
 * Build public/places/places.json from open GeoJSON files.
 * Usage: node scripts/build-places.mjs kind:file.geojson:"Credit" [kind:file:"Credit" ...]
 * kind is one of mooring ramp marina fuel water pumpout landing rescue.
 */
import { readFileSync, writeFileSync } from "node:fs";

const KINDS = ["mooring", "ramp", "marina", "fuel", "water", "pumpout", "landing", "rescue"];
const NAME_KEYS = ["name", "NAME", "Name", "site_name", "SITE_NAME", "facility_name", "FACILITY_NAME", "mooring_name", "MOORING_NAME", "location", "LOCATION", "label"];

export function centre(geom) {
  if (!geom) return null;
  if (geom.type === "Point") return geom.coordinates;
  const pts = [];
  const walk = (c) => (typeof c[0] === "number" ? pts.push(c) : c.forEach(walk));
  walk(geom.coordinates ?? []);
  if (!pts.length) return null;
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
}

export function featureName(props = {}) {
  for (const k of NAME_KEYS) if (typeof props[k] === "string" && props[k].trim()) return props[k].trim().replace(/\s+/g, " ").slice(0, 60);
  return "";
}

export function build(inputs) {
  const credits = [];
  const rows = [];
  for (const { kind, json, credit } of inputs) {
    const ki = KINDS.indexOf(kind);
    if (ki < 0) throw new Error(`Unknown kind ${kind}`);
    let ci = credits.indexOf(credit);
    if (ci < 0) ci = credits.push(credit) - 1;
    for (const f of json.features ?? []) {
      const c = centre(f.geometry);
      if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || Math.abs(c[1]) > 90) continue;
      rows.push([ki, Math.round(c[1] * 1e5), Math.round(c[0] * 1e5), featureName(f.properties), ci]);
    }
  }
  return { v: 1, credits, rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const inputs = process.argv.slice(2).map((a) => {
    const [kind, file, ...rest] = a.split(":");
    return { kind, json: JSON.parse(readFileSync(file, "utf8")), credit: rest.join(":") || "Open data" };
  });
  if (!inputs.length) {
    console.error('Usage: node scripts/build-places.mjs kind:file.geojson:"Credit" ...');
    process.exit(1);
  }
  const out = build(inputs);
  writeFileSync("public/places/places.json", JSON.stringify(out));
  console.log(`Wrote ${out.rows.length} places to public/places/places.json`);
}
