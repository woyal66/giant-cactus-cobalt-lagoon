import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { destPoint, haversineMeters } from "./geo.ts";
import {
  DEFAULT_BOAT,
  bowFromGps,
  chartedDepthNeededM,
  clampBoat,
  gpsReachM,
  gpsStationLabel,
  stationFromTap,
  stationPreset,
} from "./boat.ts";
import { DEFAULT_RODE, hookAstern, laybackM, swingRadiusM } from "./anchor.ts";

describe("bowFromGps", () => {
  const gps = { lat: -23.9058, lng: 152.3964 };

  it("is the GPS when the phone is at the bow", () => {
    const bow = bowFromGps(gps, 0, DEFAULT_BOAT);
    assert.ok(haversineMeters(gps, bow) < 0.4);
  });

  it("puts the bow 15 m forward of an aft-cabin phone", () => {
    const hull = { ...DEFAULT_BOAT, loaM: 18, gpsFromBowM: 15, gpsFromCenterM: 0 };
    const bow = bowFromGps(gps, 0, hull);
    assert.ok(Math.abs(haversineMeters(gps, bow) - 15) < 0.6);
    const north = destPoint(gps, 0, 15);
    assert.ok(haversineMeters(bow, north) < 0.6);
  });

  it("does not guess north when heading is unknown", () => {
    const hull = { ...DEFAULT_BOAT, gpsFromBowM: 15 };
    const bow = bowFromGps(gps, null, hull);
    assert.ok(haversineMeters(gps, bow) < 0.2);
  });
});

describe("stationFromTap", () => {
  it("reads bow at the top of the plan and stern at the bottom", () => {
    const bow = stationFromTap(50, 0, 100, 200, DEFAULT_BOAT);
    assert.equal(bow.gpsFromBowM, 0);
    const stern = stationFromTap(50, 200, 100, 200, DEFAULT_BOAT);
    assert.equal(stern.gpsFromBowM, 12);
    const cabin = stationFromTap(50, 150, 100, 200, DEFAULT_BOAT);
    assert.equal(cabin.gpsFromBowM, 9);
  });
});

describe("clampBoat", () => {
  it("keeps the GPS on the hull", () => {
    const b = clampBoat({ loaM: 10, gpsFromBowM: 40, gpsFromCenterM: 20, beamM: 4 });
    assert.equal(b.gpsFromBowM, 10);
    assert.equal(b.gpsFromCenterM, 2);
  });
});

describe("label and presets", () => {
  it("names the station", () => {
    assert.match(gpsStationLabel(DEFAULT_BOAT), /bow/);
    assert.match(
      gpsStationLabel({ ...DEFAULT_BOAT, gpsFromBowM: 12 }),
      /stern/,
    );
  });

  it("drops an aft-cabin preset well back of the bow", () => {
    const p = stationPreset("cabin", { ...DEFAULT_BOAT, loaM: 18 });
    assert.ok(p.gpsFromBowM > 14);
    assert.ok(p.gpsFromBowM < 18);
  });
});

describe("aft cabin vs hook", () => {
  it("keeps the phone inside the swing when it sits 15 m aft", () => {
    const hull = { ...DEFAULT_BOAT, loaM: 18, gpsFromBowM: 15 };
    const gps = { lat: -23.9058, lng: 152.3964, heading: 0 };
    const bow = bowFromGps(gps, gps.heading, hull);
    const rode = { ...DEFAULT_RODE, loaM: 18, depthM: 6, chainM: 40, bowM: 1.5 };
    const hook = hookAstern({ ...bow, heading: 0 }, rode);
    const radius = swingRadiusM(40, 7.5, 18, gpsReachM(hull));
    assert.ok(Math.abs(haversineMeters(bow, hook) - Math.max(8, laybackM(rode))) < 0.8);
    assert.ok(haversineMeters(gps, hook) <= radius);
  });
});

describe("charted depth", () => {
  it("asks for draft minus the tide, plus a spare", () => {
    assert.equal(chartedDepthNeededM(1.8, 0.7), 1.5);
    assert.equal(chartedDepthNeededM(1.8, 2.4), 0.4);
  });
});
