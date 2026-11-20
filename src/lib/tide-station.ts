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
  return "Marine model · LAT estimate — not a tide station";
}

export function tideOriginChip(o: TideOrigin | null | undefined): string {
  if (o?.kind === "station") return "Tide · BOM";
  return "Tide · model";
}
