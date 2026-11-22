import { haversineMeters, type LatLng } from "./geo.ts";
import { BOM_PORTS, type BomPort } from "./bom-ports.ts";
import { fetchBomPrint } from "./bom-tides.ts";
import {
  hoursFromTurns,
  type TideHour,
  type TideOrigin,
  type TideTurn,
} from "./tides.ts";

export { BOM_PORTS, type BomPort };

const MAX_KM = 120;
const cache = new Map<
  string,
  { at: number; hours: TideHour[]; turns: TideTurn[]; origin: TideOrigin }
>();

export function nearestBomPort(
  p: LatLng,
  maxKm = MAX_KM,
): { port: BomPort; km: number } | null {
  let best: BomPort | null = null;
  let bestM = Infinity;
  for (const port of BOM_PORTS) {
    const m = haversineMeters(p, port);
    if (m < bestM) {
      bestM = m;
      best = port;
    }
  }
  if (!best) return null;
  const km = bestM / 1000;
  if (km > maxKm) return null;
  return { port: best, km: Math.round(km * 10) / 10 };
}

export async function fetchBomStationTide(
  lat: number,
  lng: number,
  now = Date.now(),
): Promise<{ hours: TideHour[]; turns: TideTurn[]; origin: TideOrigin } | null> {
  const near = nearestBomPort({ lat, lng });
  if (!near) return null;
  const key = `${near.port.aac}:${new Date(now).toISOString().slice(0, 10)}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < 3 * 3_600_000) return hit;

  const packed = await fetchBomPrint({
    data: { aac: near.port.aac, tz: near.port.tz },
  });
  const turns = packed.turns;
  if (turns.length < 2) return null;
  const hours = hoursFromTurns(turns, now - 60 * 60_000, 7 * 24);
  if (hours.length < 4) return null;
  const origin: TideOrigin = {
    kind: "station",
    name: near.port.name,
    aac: near.port.aac,
    km: near.km,
    primary: near.port.primary,
    datum: "LAT",
  };
  const row = { at: now, hours, turns, origin };
  cache.set(key, row);
  return row;
}

/** A BOM table this close is better than any global model (bays, estuaries, reef lagoons). */
export const STATION_FIRST_KM = 25;

export type TideSet = { hours: TideHour[]; turns: TideTurn[]; origin: TideOrigin; latDatumM: number };

/** EOT20 global model tide at a point (offline once its chunk is saved), or null. */
export async function fetchModelTide(lat: number, lng: number, now = Date.now()): Promise<TideSet | null> {
  const { tideConstants, tideSeries, lowestTide, TIDE_MODEL_NAME } = await import("./tide-model.ts");
  const c = await tideConstants(lat, lng);
  if (!c) return null;
  const hours = tideSeries(c.k, now - 60 * 60_000, 7 * 24, 20);
  const { tideTurns } = await import("./tides.ts");
  return {
    hours,
    turns: tideTurns(hours),
    origin: { kind: "model", name: TIDE_MODEL_NAME, datum: "LAT estimate" },
    latDatumM: lowestTide(c.k, now),
  };
}

/**
 * Best tide for a point: a BOM table within 25 km, else the EOT20 global model (works offline
 * and anywhere in the world), else the nearest BOM table up to 120 km. Null when none is
 * available (the caller falls back to the online marine model).
 */
export async function fetchBestTide(lat: number, lng: number, now = Date.now()): Promise<TideSet | null> {
  const near = nearestBomPort({ lat, lng });
  const station = async () => {
    const s = await fetchBomStationTide(lat, lng, now).catch(() => null);
    return s ? { ...s, latDatumM: 0 } : null;
  };
  if (near && near.km <= STATION_FIRST_KM) {
    const s = await station();
    if (s) return s;
  }
  const model = await fetchModelTide(lat, lng, now).catch(() => null);
  if (model) return model;
  return near ? station() : null;
}

export function modelTideOrigin(): TideOrigin {
  return { kind: "model", name: "Open-Meteo marine", datum: "LAT estimate" };
}

export function tideOriginLabel(o: TideOrigin | null | undefined): string {
  if (!o) return "Tide";
  if (o.kind === "station") {
    const dist =
      o.km < 1 ? "<1 km" : `${o.km < 10 ? o.km.toFixed(1) : Math.round(o.km)} km`;
    const grade = o.primary ? "standard port" : "secondary port";
    return `BOM tide table · ${o.name} (${grade}) · ${dist} · LAT`;
  }
  if (o.name.startsWith("EOT20")) return "EOT20 global tide model (DGFI-TUM) · LAT estimate — not a tide station";
  return "Marine model · LAT estimate — not a tide station";
}

export function tideOriginChip(o: TideOrigin | null | undefined): string {
  if (o?.kind === "station") return "Tide · BOM";
  return "Tide · model";
}
