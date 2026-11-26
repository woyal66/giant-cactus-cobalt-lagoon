/*
 * AIS: other vessels' positions, and the closest point of approach (CPA) to us.
 *
 * Two sources:
 *   - Online: aisstream.io (free account, the skipper's own key, typed in Settings and kept on
 *     the phone). Shore-based receivers, so coverage near ports and busy coasts, little offshore.
 *   - Boat Wi-Fi: a Signal K server on board (Raspberry Pi, Victron Cerbo GX and others) that
 *     relays the boat's own AIS receiver. Works offshore, no internet needed.
 * Pure maths and parsing here, so it is tested.
 */

export type AisTarget = {
  mmsi: string;
  name: string;
  lat: number;
  lng: number;
  /** Speed (kn) and course over ground (°true); NaN when not sent. */
  sogKn: number;
  cogDeg: number;
  headingDeg: number;
  at: number;
  /** "A" ships, "B" small craft, "aton" aids to navigation, "sart" rescue beacons. */
  cls: "A" | "B" | "aton" | "sart" | "base";
  shipType?: number;
  lengthM?: number;
  status?: number;
};

export type Own = { lat: number; lng: number; sogKn: number; cogDeg: number };

const NM = 1852;
const KN = NM / 3600; // m/s per knot

/** Velocity (east, north) in m/s. */
function vel(sogKn: number, cogDeg: number) {
  if (!Number.isFinite(sogKn) || !Number.isFinite(cogDeg) || sogKn < 0.2) return { e: 0, n: 0 };
  const r = (cogDeg * Math.PI) / 180;
  return { e: sogKn * KN * Math.sin(r), n: sogKn * KN * Math.cos(r) };
}

/**
 * Closest point of approach: how near (m) and how soon (min) on the present courses. A negative
 * time means the closest point is behind us (already passed); then CPA is the distance now.
 */
export function cpa(own: Own, t: Pick<AisTarget, "lat" | "lng" | "sogKn" | "cogDeg">): { cpaM: number; tcpaMin: number; rangeM: number } {
  const k = Math.cos((own.lat * Math.PI) / 180);
  const dx = (t.lng - own.lng) * 111_320 * k;
  const dy = (t.lat - own.lat) * 110_540;
  const a = vel(own.sogKn, own.cogDeg);
  const b = vel(t.sogKn, t.cogDeg);
  const ve = b.e - a.e;
  const vn = b.n - a.n;
  const v2 = ve * ve + vn * vn;
  const rangeM = Math.hypot(dx, dy);
  if (v2 < 1e-6) return { cpaM: rangeM, tcpaMin: Infinity, rangeM };
  const tSec = -(dx * ve + dy * vn) / v2;
  if (tSec < 0) return { cpaM: rangeM, tcpaMin: tSec / 60, rangeM };
  return { cpaM: Math.hypot(dx + ve * tSec, dy + vn * tSec), tcpaMin: tSec / 60, rangeM };
}

export type AisAlarmPrefs = { cpaNm: number; tcpaMin: number };
export const DEFAULT_AIS_ALARM: AisAlarmPrefs = { cpaNm: 0.5, tcpaMin: 15 };
/** Targets older than this are dropped (Class B can report every 3 minutes). */
export const AIS_STALE_MS = 6 * 60_000;

export type Danger = { target: AisTarget; cpaM: number; tcpaMin: number; rangeM: number };

/** Vessels that will pass closer than the limit within the time window, nearest in time first. */
export function dangers(own: Own, targets: AisTarget[], prefs: AisAlarmPrefs, now = Date.now()): Danger[] {
  const out: Danger[] = [];
  for (const t of targets) {
    if (t.cls === "aton" || t.cls === "base" || now - t.at > AIS_STALE_MS) continue;
    const c = cpa(own, t);
    const closeNow = c.rangeM < prefs.cpaNm * NM * 0.5;
    if ((c.cpaM <= prefs.cpaNm * NM && c.tcpaMin >= 0 && c.tcpaMin <= prefs.tcpaMin) || (closeNow && c.tcpaMin > -2)) {
      out.push({ target: t, ...c });
    }
  }
  return out.sort((p, q) => p.tcpaMin - q.tcpaMin);
}

/** Merge an update into the target list (by MMSI), keeping fields the update doesn't carry. */
export function mergeTarget(list: Map<string, AisTarget>, u: Partial<AisTarget> & { mmsi: string }, now = Date.now()) {
  const prev = list.get(u.mmsi);
  const lat = u.lat ?? prev?.lat;
  const lng = u.lng ?? prev?.lng;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    // Static data before the first position: keep the name for later.
    if (u.name && !prev) list.set(u.mmsi, { mmsi: u.mmsi, name: u.name, lat: NaN, lng: NaN, sogKn: NaN, cogDeg: NaN, headingDeg: NaN, at: 0, cls: u.cls ?? "A" });
    else if (prev && u.name) prev.name = u.name;
    return;
  }
  list.set(u.mmsi, {
    mmsi: u.mmsi,
    name: u.name || prev?.name || "",
    lat,
    lng,
    sogKn: u.sogKn ?? prev?.sogKn ?? NaN,
    cogDeg: u.cogDeg ?? prev?.cogDeg ?? NaN,
    headingDeg: u.headingDeg ?? prev?.headingDeg ?? NaN,
    at: u.lat != null ? (u.at ?? now) : (prev?.at ?? now),
    cls: u.cls ?? prev?.cls ?? "A",
    shipType: u.shipType ?? prev?.shipType,
    lengthM: u.lengthM ?? prev?.lengthM,
    status: u.status ?? prev?.status,
  });
}

/** Drop targets not heard from in a while. */
export function pruneTargets(list: Map<string, AisTarget>, now = Date.now()) {
  for (const [k, t] of list) if (now - t.at > AIS_STALE_MS && t.at > 0) list.delete(k);
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
/** AIS "not available" values: SOG 102.3, COG 360, heading 511. */
const sog = (v: unknown) => {
  const n = num(v);
  return n >= 102.2 ? NaN : n;
};
const deg = (v: unknown, na: number) => {
  const n = num(v);
  return n >= na ? NaN : n;
};

/** One aisstream.io message (JSON) as a target update, or null. */
export function parseAisStream(msg: unknown): (Partial<AisTarget> & { mmsi: string }) | null {
  const m = msg as { MessageType?: string; MetaData?: Record<string, unknown>; Message?: Record<string, Record<string, unknown>> };
  if (!m?.MetaData || !m.MessageType) return null;
  const meta = m.MetaData;
  const mmsi = String(meta.MMSI ?? meta.MMSI_String ?? "");
  if (!/^\d{9}$/.test(mmsi)) return null;
  const name = String(meta.ShipName ?? "").replace(/@+/g, "").trim();
  const body = m.Message?.[m.MessageType] ?? {};
  const t = Date.parse(String(meta.time_utc ?? "").replace(" +0000 UTC", "Z").replace(/ /, "T"));
  const at = Number.isFinite(t) ? t : undefined;
  if (m.MessageType === "PositionReport" || m.MessageType === "StandardClassBPositionReport" || m.MessageType === "ExtendedClassBPositionReport") {
    return {
      mmsi,
      name: name || undefined,
      lat: num(body.Latitude ?? meta.latitude),
      lng: num(body.Longitude ?? meta.longitude),
      sogKn: sog(body.Sog),
      cogDeg: deg(body.Cog, 360),
      headingDeg: deg(body.TrueHeading, 511),
      cls: m.MessageType === "PositionReport" ? "A" : "B",
      status: m.MessageType === "PositionReport" ? num(body.NavigationalStatus) : undefined,
      at,
    };
  }
  if (m.MessageType === "ShipStaticData" || m.MessageType === "StaticDataReport") {
    const dim = body.Dimension as Record<string, unknown> | undefined;
    const len = dim ? num(dim.A) + num(dim.B) : NaN;
    const nm = String(body.Name ?? (body.ReportA as Record<string, unknown> | undefined)?.Name ?? name).replace(/@+/g, "").trim();
    return { mmsi, name: nm || undefined, shipType: Number.isFinite(num(body.Type)) ? num(body.Type) : undefined, lengthM: len > 0 ? len : undefined };
  }
  if (m.MessageType === "AidsToNavigationReport") {
    return { mmsi, name: String(body.Name ?? name).trim() || undefined, lat: num(body.Latitude), lng: num(body.Longitude), cls: "aton", sogKn: 0, cogDeg: NaN, at };
  }
  return null;
}

/** The subscription aisstream.io expects first, for a box around the boat. */
export function aisStreamSubscribe(key: string, box: { s: number; w: number; n: number; e: number }) {
  return JSON.stringify({
    APIKey: key,
    BoundingBoxes: [[[box.s, box.w], [box.n, box.e]]],
    FilterMessageTypes: ["PositionReport", "StandardClassBPositionReport", "ExtendedClassBPositionReport", "ShipStaticData", "StaticDataReport", "AidsToNavigationReport"],
  });
}

/**
 * A Signal K delta as target updates (other vessels only; `self` is skipped). Signal K uses
 * SI units: radians and m/s.
 */
export function parseSignalK(delta: unknown, self?: string): Array<Partial<AisTarget> & { mmsi: string }> {
  const d = delta as { context?: string; updates?: Array<{ timestamp?: string; values?: Array<{ path?: string; value?: unknown }> }> };
  if (!d?.context || !Array.isArray(d.updates)) return [];
  if (self && d.context === self) return [];
  const m = /mmsi:(\d{9})/.exec(d.context);
  if (!m || d.context === "vessels.self") return [];
  const mmsi = m[1]!;
  const isAton = d.context.startsWith("atons.");
  const isSar = d.context.startsWith("sar.");
  const out: Array<Partial<AisTarget> & { mmsi: string }> = [];
  for (const u of d.updates) {
    const t: Partial<AisTarget> & { mmsi: string } = { mmsi };
    const ts = Date.parse(u.timestamp ?? "");
    if (Number.isFinite(ts)) t.at = ts;
    for (const v of u.values ?? []) {
      const val = v.value as Record<string, unknown> | number | string | undefined;
      switch (v.path) {
        case "navigation.position":
          if (val && typeof val === "object") {
            t.lat = num(val.latitude);
            t.lng = num(val.longitude);
          }
          break;
        case "navigation.speedOverGround":
          t.sogKn = num(val) / KN;
          break;
        case "navigation.courseOverGroundTrue":
          t.cogDeg = ((num(val) * 180) / Math.PI + 360) % 360;
          break;
        case "navigation.headingTrue":
          t.headingDeg = ((num(val) * 180) / Math.PI + 360) % 360;
          break;
        case "name":
          if (typeof val === "string") t.name = val.trim();
          break;
        case "":
          if (val && typeof val === "object" && typeof val.name === "string") t.name = val.name.trim();
          break;
        case "sensors.ais.class":
          if (val === "B") t.cls = "B";
          else if (val === "A") t.cls = "A";
          break;
        case "design.length":
          if (val && typeof val === "object") t.lengthM = num(val.overall) || undefined;
          break;
      }
    }
    if (isAton) t.cls = "aton";
    if (isSar) t.cls = "sart";
    out.push(t);
  }
  return out;
}

/** The Signal K stream address for a host typed by the skipper ("192.168.1.10", "venus.local:3000"). */
export function signalKUrl(host: string): string | null {
  const h = host.trim().replace(/^(wss?|https?):\/\//i, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9.-]+(:\d{2,5})?$/i.test(h)) return null;
  const withPort = /:\d+$/.test(h) ? h : `${h}:3000`;
  return `ws://${withPort}/signalk/v1/stream?subscribe=all`;
}

/** Words for a danger: "MV Pacific, 0.3 nm in 8 min". */
export function dangerText(d: Danger): string {
  const who = d.target.name || `MMSI ${d.target.mmsi}`;
  const nm = d.cpaM / NM;
  const when = d.tcpaMin < 1 ? "now" : `in ${Math.round(d.tcpaMin)} min`;
  return `${who}: passes ${nm < 0.1 ? "very close" : `${nm.toFixed(1)} nm`} ${when}`;
}
