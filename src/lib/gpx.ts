/**
 * GPX 1.1 export so tracks and passages open in chartplotters, OpenCPN, Navionics
 * and other navigation apps. Drawn passages export as a route (<rte>) so they
 * can be followed; everything is also written as a track (<trk>) for viewers
 * that only read tracks.
 */
import type { Waypoint } from "./passages.ts";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const coord = (n: number) => n.toFixed(7);

export function toGpx(name: string, points: Waypoint[], at = new Date()): string {
  const title = esc(name || "Anchor Mate track");
  const pts = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const rtepts = pts
    .map((p, i) => {
      const label = esc(p.label || `WP${String(i + 1).padStart(3, "0")}`);
      return `    <rtept lat="${coord(p.lat)}" lon="${coord(p.lng)}"><name>${label}</name></rtept>`;
    })
    .join("\n");
  const trkpts = pts
    .map((p) => `      <trkpt lat="${coord(p.lat)}" lon="${coord(p.lng)}"></trkpt>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Anchor Mate" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${title}</name><time>${at.toISOString()}</time></metadata>
  <rte>
    <name>${title}</name>
${rtepts}
  </rte>
  <trk>
    <name>${title}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

export function gpxFileName(name: string): string {
  const base = (name || "track")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${base || "track"}.gpx`;
}
