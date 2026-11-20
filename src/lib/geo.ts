export type LatLng = { lat: number; lng: number };

export type ChartUp = "north" | "heading";

const EARTH_M = 6371000;
const DEG = Math.PI / 180;

export const CRUMB_MIN_MS = 0.4;
export const CRUMB_STEP_M = 12;
export const CRUMB_MAX = 2000;
export const REVERSE_STEP_M = 20;
/** Safe water is this far each side of the line. */
export const TUBE_M = 1;
/** Drop points on a straight run. Keep a bend of 30° or more, and any point 8 m off the chord. */
export const TRACK_TURN_DEG = 30;
export const TRACK_CHORD_M = 8;
export const TRACK_TURN_PRESETS = [15, 20, 30, 45, 60] as const;
export const TRACK_CHORD_PRESETS = [4, 8, 12, 20, 30] as const;

export type TrackClean = { turnDeg: number; chordM: number };

export function clampTrackClean(turnDeg: number, chordM: number): TrackClean {
  const turn = Number.isFinite(turnDeg) ? Math.round(turnDeg) : TRACK_TURN_DEG;
  const chord = Number.isFinite(chordM) ? Math.round(chordM) : TRACK_CHORD_M;
  return {
    turnDeg: Math.max(5, Math.min(90, turn)),
    chordM: Math.max(1, Math.min(80, chord)),
  };
}

export function isChartUp(v: unknown): v is ChartUp {
  return v === "north" || v === "heading";
}

export function wrapDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLng = (b.lng - a.lng) * DEG;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * s2 * s2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDegrees(a: LatLng, b: LatLng): number {
  const y = Math.sin((b.lng - a.lng) * DEG) * Math.cos(b.lat * DEG);
  const x =
    Math.cos(a.lat * DEG) * Math.sin(b.lat * DEG) -
    Math.sin(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.cos((b.lng - a.lng) * DEG);
  return wrapDegrees((Math.atan2(y, x) * 180) / Math.PI);
}

export function destPoint(start: LatLng, bearingDeg: number, distM: number): LatLng {
  const br = (bearingDeg * Math.PI) / 180;
  const ang = distM / EARTH_M;
  const lat1 = start.lat * DEG;
  const lng1 = start.lng * DEG;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(br),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(br) * Math.sin(ang) * Math.cos(lat1),
      Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2),
    );
  let lng = ((lng2 * 180) / Math.PI + 540) % 360 - 180;
  return { lat: (lat2 * 180) / Math.PI, lng };
}

export function turnDegrees(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export function lerpBearing(a: number, b: number, t: number): number {
  return wrapDegrees(a + turnDegrees(a, b) * t);
}

export function chartBearing(up: ChartUp, heading: number | null): number {
  if (up === "heading" && heading != null && Number.isFinite(heading)) return heading;
  return 0;
}

export function hullScreenHeading(up: ChartUp | string, heading: number | null): number {
  if (heading == null || !Number.isFinite(heading)) return 0;
  if (up === "heading") return 0;
  return heading;
}

export type SegmentHit = { distM: number; t: number; point: LatLng };

export function closestOnSegment(p: LatLng, a: LatLng, b: LatLng): SegmentHit {
  const mPerLat = (Math.PI / 180) * EARTH_M;
  const mPerLng = mPerLat * Math.cos(((a.lat + b.lat) / 2) * DEG);
  const bx = (b.lng - a.lng) * mPerLng;
  const by = (b.lat - a.lat) * mPerLat;
  const px = (p.lng - a.lng) * mPerLng;
  const py = (p.lat - a.lat) * mPerLat;
  const len2 = bx * bx + by * by;
  let t = len2 < 1e-4 ? 0 : (px * bx + py * by) / len2;
  t = Math.max(0, Math.min(1, t));
  return {
    distM: Math.hypot(px - bx * t, py - by * t),
    t,
    point: { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t },
  };
}

/** Positive is starboard of the line from a to b. */
export function crossTrackMeters(boat: LatLng, a: LatLng, b: LatLng): number {
  const along = bearingDegrees(a, b);
  const to = bearingDegrees(a, boat);
  return Math.sin(turnDegrees(along, to) * DEG) * haversineMeters(a, boat);
}

export function pointInPolygon(p: LatLng, ring: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    const hit =
      a.lat > p.lat !== b.lat > p.lat &&
      p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (hit) inside = !inside;
  }
  return inside;
}

export function pathLengthMeters(pts: LatLng[]): number {
  let n = 0;
  for (let i = 1; i < pts.length; i += 1) n += haversineMeters(pts[i - 1]!, pts[i]!);
  return n;
}

export function shouldAppendTrack(trail: LatLng[], p: LatLng, stepM: number): boolean {
  const last = trail[trail.length - 1];
  if (!last) return true;
  const dist = haversineMeters(last, p);
  if (dist >= stepM) return true;
  const prev = trail.length >= 2 ? trail[trail.length - 2] : null;
  if (!prev || dist < 1) return false;
  const turn = Math.abs(turnDegrees(bearingDegrees(prev, last), bearingDegrees(last, p)));
  return turn >= 12;
}

export function appendTrail(
  trail: LatLng[],
  p: LatLng,
  stepM = CRUMB_STEP_M,
  max = CRUMB_MAX,
): LatLng[] {
  if (!shouldAppendTrack(trail, p, stepM)) return trail;
  const next = [...trail, { lat: p.lat, lng: p.lng }];
  return next.length > max ? next.slice(-max) : next;
}

export function thinTrail(pts: LatLng[], stepM = REVERSE_STEP_M): LatLng[] {
  if (pts.length < 2) return pts.map((p) => ({ lat: p.lat, lng: p.lng }));
  const out: LatLng[] = [{ lat: pts[0]!.lat, lng: pts[0]!.lng }];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    const last = out[out.length - 1]!;
    if (haversineMeters(last, p) >= stepM) out.push({ lat: p.lat, lng: p.lng });
  }
  const end = pts[pts.length - 1]!;
  const tail = out[out.length - 1]!;
  if (haversineMeters(tail, end) > 1) out.push({ lat: end.lat, lng: end.lng });
  return out;
}

export function simplifyPath<T extends LatLng>(pts: T[], epsilonM = TUBE_M): T[] {
  if (pts.length < 3) return pts.map((p) => ({ ...p }));
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = true;
  keep[pts.length - 1] = true;
  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  while (stack.length > 0) {
    const pair = stack.pop();
    if (!pair) break;
    const [s, e] = pair;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i += 1) {
      const d = closestOnSegment(pts[i]!, pts[s]!, pts[e]!).distM;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > epsilonM) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]).map((p) => ({ ...p }));
}

export function simplifyTrack<T extends LatLng>(pts: T[], clean?: Partial<TrackClean>): T[] {
  const turnKeep = clean?.turnDeg ?? TRACK_TURN_DEG;
  const chordKeep = clean?.chordM ?? TRACK_CHORD_M;
  if (pts.length < 3) return pts.map((p) => ({ ...p }));
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = true;
  keep[pts.length - 1] = true;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const turn = Math.abs(
      turnDegrees(bearingDegrees(pts[i - 1]!, pts[i]!), bearingDegrees(pts[i]!, pts[i + 1]!)),
    );
    if (turn >= turnKeep) keep[i] = true;
  }
  let changed = true;
  while (changed) {
    changed = false;
    let s = 0;
    while (s < pts.length - 1 && !keep[s]) s += 1;
    for (let e = s + 1; e < pts.length; e += 1) {
      if (!keep[e]) continue;
      let maxD = 0;
      let idx = -1;
      for (let i = s + 1; i < e; i += 1) {
        const d = closestOnSegment(pts[i]!, pts[s]!, pts[e]!).distM;
        if (d > maxD) {
          maxD = d;
          idx = i;
        }
      }
      if (idx >= 0 && maxD > chordKeep) {
        keep[idx] = true;
        changed = true;
      }
      s = e;
    }
  }
  return pts.filter((_, i) => keep[i]).map((p) => ({ ...p }));
}

export function segmentTube(a: LatLng, b: LatLng, halfM = TUBE_M): LatLng[] {
  const brg = bearingDegrees(a, b);
  const left = wrapDegrees(brg - 90);
  const right = wrapDegrees(brg + 90);
  return [
    destPoint(a, left, halfM),
    destPoint(b, left, halfM),
    destPoint(b, right, halfM),
    destPoint(a, right, halfM),
  ];
}

export function cornerIndexes(pts: LatLng[], turnDeg = 20): number[] {
  if (pts.length === 0) return [];
  const out = [0];
  for (let i = 1; i < pts.length - 1; i += 1) {
    const turn = Math.abs(
      turnDegrees(bearingDegrees(pts[i - 1]!, pts[i]!), bearingDegrees(pts[i]!, pts[i + 1]!)),
    );
    if (turn >= turnDeg) out.push(i);
  }
  if (pts.length > 1) out.push(pts.length - 1);
  return out;
}

export function metresAlong(pts: LatLng[], from: LatLng, fromIndex: number, toIndex: number): number {
  if (pts.length === 0 || fromIndex < 0) return 0;
  const end = Math.min(Math.max(toIndex, fromIndex), pts.length - 1);
  const start = Math.min(fromIndex, pts.length - 1);
  let n = haversineMeters(from, pts[start]!);
  for (let i = start; i < end; i += 1) n += haversineMeters(pts[i]!, pts[i + 1]!);
  return n;
}

export function reverseWaypoints(
  pts: LatLng[],
  clean?: Partial<TrackClean>,
): Array<LatLng & { label?: string }> {
  const kept = simplifyTrack([...pts].reverse(), clean);
  return kept.map((w, i) => ({
    lat: w.lat,
    lng: w.lng,
    label: `WP ${i + 1}`,
  }));
}

export function reverseCourse<T extends LatLng & { label?: string }>(
  pts: T[],
  clean?: Partial<TrackClean>,
): T[] {
  const slim = simplifyTrack([...pts].reverse(), clean);
  const hadEnds = pts.some((w) => w.label === "Start" || w.label === "Stop");
  return slim.map((w, i) => {
    const name = w.label?.trim() ?? "";
    const generic = name.length === 0 || /^WP \d+$/.test(name);
    let label = generic ? `WP ${i + 1}` : name;
    if (hadEnds && i === 0) label = "Start";
    if (hadEnds && i === slim.length - 1) label = "Stop";
    return { ...w, label };
  });
}

export function msToKnots(ms: number | null | undefined): number {
  if (ms == null || !Number.isFinite(ms)) return 0;
  return ms * 1.943844;
}

export function formatMeters(m: number): string {
  const a = Math.abs(m);
  if (a < 1000) return `${Math.round(a)} m`;
  const nm = a / 1852;
  return nm < 10 ? `${nm.toFixed(1)} nm` : `${Math.round(nm)} nm`;
}

/** Centre and zoom that put a whole track on a phone chart. */
export function fitTrackView(pts: LatLng[]): { lat: number; lng: number; zoom: number } | null {
  if (pts.length < 1) return null;
  let south = 90;
  let north = -90;
  let west = 180;
  let east = -180;
  for (const p of pts) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
  }
  const lat = (south + north) / 2;
  const lng = (west + east) / 2;
  const latM = Math.max(80, (north - south) * 111_320);
  const lngM = Math.max(80, (east - west) * 111_320 * Math.cos((lat * Math.PI) / 180));
  const span = Math.max(latM, lngM) * 1.45;
  const mPerPx = span / 280;
  const cos = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const z = Math.log2((156543.03392 * cos) / Math.max(0.4, mPerPx));
  return { lat, lng, zoom: Math.max(11, Math.min(18, Math.round(z * 10) / 10)) };
}

export function trackInView(
  pts: LatLng[],
  view: { south: number; north: number; west: number; east: number } | null,
): boolean {
  if (!view || pts.length < 1) return false;
  const padLat = (view.north - view.south) * 0.06;
  const padLng = (view.east - view.west) * 0.06;
  return pts.every(
    (p) =>
      p.lat >= view.south + padLat &&
      p.lat <= view.north - padLat &&
      p.lng >= view.west + padLng &&
      p.lng <= view.east - padLng,
  );
}

export function formatHeading(deg: number | null | undefined): string {
  if (deg == null || !Number.isFinite(deg)) return "—";
  return `${String(Math.round(wrapDegrees(deg)) % 360).padStart(3, "0")}°`;
}

export function formatLat(lat: number): string {
  const hem = lat >= 0 ? "N" : "S";
  const a = Math.abs(lat);
  const d = Math.floor(a);
  const m = (a - d) * 60;
  return `${d}° ${m.toFixed(3)}′ ${hem}`;
}

export function formatLng(lng: number): string {
  const hem = lng >= 0 ? "E" : "W";
  const a = Math.abs(lng);
  const d = Math.floor(a);
  const m = (a - d) * 60;
  return `${d}° ${m.toFixed(3)}′ ${hem}`;
}

export function formatGroundScale(lat: number, zoom: number): string {
  const mPerPx =
    (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** zoom);
  if (mPerPx < 1) return `${Math.round(mPerPx * 100)} cm/px`;
  if (mPerPx < 10) return `${mPerPx.toFixed(1)} m/px`;
  return `${Math.round(mPerPx)} m/px`;
}
