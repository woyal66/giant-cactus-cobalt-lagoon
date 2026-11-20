import type { LatLng } from "./geo.ts";
import { destPoint } from "./geo.ts";

export type BoatSetup = {
  loaM: number;
  beamM: number;
  draftM: number;
  bowM: number;
  /** Metres aft of the bow roller. 0 = phone at the bow. */
  gpsFromBowM: number;
  /** Metres to starboard of the centreline. */
  gpsFromCenterM: number;
};

export type GpsStationId = "bow" | "helm" | "cabin" | "stern";

export const DEFAULT_BOAT: BoatSetup = {
  loaM: 12,
  beamM: 3.8,
  draftM: 1.8,
  bowM: 1.5,
  gpsFromBowM: 0,
  gpsFromCenterM: 0,
};

function n(v: unknown, fallback: number, max = 80) {
  if (!Number.isFinite(v as number)) return fallback;
  return Math.min(max, Math.max(0, v as number));
}

export function clampBoat(
  partial: Partial<BoatSetup>,
  base: BoatSetup = DEFAULT_BOAT,
): BoatSetup {
  const loa = n(partial.loaM, base.loaM, 80);
  const beam = n(partial.beamM, base.beamM, 20);
  const draft = n(partial.draftM, base.draftM, 12);
  const bow = n(partial.bowM, base.bowM, 8);
  const along = Math.min(loa, n(partial.gpsFromBowM, base.gpsFromBowM, 80));
  const off = Math.max(
    -beam / 2,
    Math.min(
      beam / 2,
      Number.isFinite(partial.gpsFromCenterM as number)
        ? (partial.gpsFromCenterM as number)
        : base.gpsFromCenterM,
    ),
  );
  return {
    loaM: loa,
    beamM: beam,
    draftM: draft,
    bowM: bow,
    gpsFromBowM: along,
    gpsFromCenterM: off,
  };
}

/** Bow roller, given the phone/GPS fix and heading (bow direction). */
export function bowFromGps(
  gps: LatLng,
  heading: number | null,
  boat: BoatSetup,
): LatLng {
  if (heading == null) return gps;
  let p = gps;
  if (boat.gpsFromBowM > 0.2) p = destPoint(p, heading, boat.gpsFromBowM);
  if (Math.abs(boat.gpsFromCenterM) > 0.2) {
    p = destPoint(p, heading - 90, boat.gpsFromCenterM);
  }
  return p;
}

/** Map a tap on the plan (bow at top) to a GPS station on the hull. */
export function stationFromTap(
  x: number,
  y: number,
  width: number,
  height: number,
  boat: BoatSetup,
): Pick<BoatSetup, "gpsFromBowM" | "gpsFromCenterM"> {
  if (width < 4 || height < 4) {
    return { gpsFromBowM: boat.gpsFromBowM, gpsFromCenterM: boat.gpsFromCenterM };
  }
  const along = Math.min(boat.loaM, Math.max(0, (y / height) * boat.loaM));
  const off = Math.max(
    -boat.beamM / 2,
    Math.min(boat.beamM / 2, (x / width - 0.5) * boat.beamM),
  );
  return {
    gpsFromBowM: Math.round(along * 10) / 10,
    gpsFromCenterM: Math.round(off * 10) / 10,
  };
}

export function stationPreset(
  id: GpsStationId,
  boat: BoatSetup,
): Pick<BoatSetup, "gpsFromBowM" | "gpsFromCenterM"> {
  const along =
    id === "bow"
      ? 0
      : id === "helm"
        ? boat.loaM * 0.62
        : id === "cabin"
          ? boat.loaM * 0.82
          : boat.loaM;
  return {
    gpsFromBowM: Math.round(along * 10) / 10,
    gpsFromCenterM: 0,
  };
}

export function gpsReachM(boat: BoatSetup): number {
  return Math.hypot(boat.gpsFromBowM, boat.gpsFromCenterM);
}

/** Charted LAT depth to stay off the bottom. Not a sounder — draft, tide, and a small spare. */
export function chartedDepthNeededM(draftM: number, tideLatM: number): number {
  const spare = 0.4;
  return Math.max(spare, Math.round((draftM - tideLatM + spare) * 10) / 10);
}

export function gpsStationLabel(boat: BoatSetup): string {
  const aft = boat.gpsFromBowM;
  const off = boat.gpsFromCenterM;
  const along =
    aft < 0.4
      ? "at the bow"
      : aft > boat.loaM - 0.6
        ? "at the stern"
        : `${aft.toFixed(1)} m aft of the bow`;
  if (Math.abs(off) < 0.3) return along;
  const side = off > 0 ? "starboard" : "port";
  return `${along}, ${Math.abs(off).toFixed(1)} m ${side}`;
}
