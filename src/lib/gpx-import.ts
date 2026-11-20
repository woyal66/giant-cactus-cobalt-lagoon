/**
 * Read GPX 1.0/1.1 files (the open route/track format used by chartplotters,
 * OpenCPN, Navionics, Garmin and most navigation apps) into Anchor Mate tracks.
 * A small tolerant parser: no DOM needed, so it works in tests and web views.
 */
import { thinTrail, type LatLng } from "./geo.ts";
import type { Waypoint } from "./passages.ts";

export type GpxLine = { name: string; kind: "route" | "track" | "waypoints"; points: Waypoint[] };

/** Very long logged tracks are thinned to this spacing so they stay quick to follow. */
const THIN_M = 10;
const MAX_POINTS = 2000;

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .trim();
}

function attr(tag: string, name: string): number | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function nameIn(block: string): string {
  const m = /<name>([\s\S]*?)<\/name>/i.exec(block);
  return m ? decode(m[1]!) : "";
}

/** Points of one element type inside a block, e.g. "rtept" inside a <rte>. */
function points(block: string, el: string): Waypoint[] {
  const out: Waypoint[] = [];
  const re = new RegExp(`<${el}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${el}>)`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const lat = attr(m[1]!, "lat");
    const lng = attr(m[1]!, "lon");
    if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const label = m[2] ? nameIn(m[2]) : "";
    out.push(label ? { lat, lng, label } : { lat, lng });
  }
  return out;
}

function blocks(xml: string, el: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${el}\\b[^>]*>([\\s\\S]*?)</${el}>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]!);
  return out;
}

function thin(pts: Waypoint[]): Waypoint[] {
  if (pts.length <= MAX_POINTS) return pts;
  let step = THIN_M;
  let thinned: LatLng[] = pts;
  while (thinned.length > MAX_POINTS) {
    thinned = thinTrail(pts, step);
    step *= 1.6;
  }
  return thinned.map((p) => ({ lat: p.lat, lng: p.lng }));
}

/** Every route and track in the file (and loose waypoints, if that's all there is). */
export function parseGpx(xml: string): GpxLine[] {
  if (!/<gpx\b/i.test(xml)) throw new Error("That file isn't a GPX file.");
  const lines: GpxLine[] = [];
  for (const b of blocks(xml, "rte")) {
    const pts = points(b, "rtept");
    if (pts.length >= 2) lines.push({ name: nameIn(b.replace(/<rtept[\s\S]*$/i, "")), kind: "route", points: thin(pts) });
  }
  for (const b of blocks(xml, "trk")) {
    const pts = points(b, "trkpt");
    if (pts.length >= 2) lines.push({ name: nameIn(b.replace(/<trkseg[\s\S]*$/i, "")), kind: "track", points: thin(pts) });
  }
  if (!lines.length) {
    const wpts = points(xml, "wpt");
    if (wpts.length >= 2) lines.push({ name: "", kind: "waypoints", points: thin(wpts) });
  }
  if (!lines.length) throw new Error("No route or track with at least two points in that file.");
  return lines;
}

/**
 * The same line is often written twice (as a route and as a track, which is what
 * Anchor Mate's own export does). Keep the route and drop a track that matches it.
 */
export function dedupeLines(lines: GpxLine[]): GpxLine[] {
  const key = (l: GpxLine) => {
    const a = l.points[0]!;
    const z = l.points[l.points.length - 1]!;
    return `${a.lat.toFixed(4)},${a.lng.toFixed(4)}>${z.lat.toFixed(4)},${z.lng.toFixed(4)}`;
  };
  const seen = new Set(lines.filter((l) => l.kind === "route").map(key));
  return lines.filter((l) => l.kind === "route" || !seen.has(key(l)));
}
