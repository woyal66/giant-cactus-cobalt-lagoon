import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  boxAround,
  boxFromCorners,
  countTiles,
  estimatePack,
  latToTile,
  lngToTile,
  packCovers,
  tileUrl,
} from "./offline-tiles.ts";

describe("offline reef packs", () => {
  it("maps Lady Musgrave to the expected z16 tile", () => {
    const z = 16;
    const x = lngToTile(152.395, z);
    const y = latToTile(-23.904, z);
    assert.equal(x, 60510);
    assert.equal(y, 37251);
  });

  it("maximum detail saves z20 only where the source has it", () => {
    const b = boxAround({ lat: -23.904, lng: 152.395 }, 300);
    const z19 = estimatePack(b, 19);
    const z20 = estimatePack(b, 20);
    assert.equal(z20.maxZ, 20);
    // This build has no MapTiler key, so only Esri and Sentinel are saved, and neither goes past z19.
    assert.equal(z20.tiles, z19.tiles);
  });

  it("keeps a 2.5 km lagoon under a phone-sized helm pack", () => {
    const b = boxAround({ lat: -23.904, lng: 152.395 }, 1250);
    const est = estimatePack(b, 18);
    assert.ok(est.km > 2 && est.km < 3.2);
    assert.equal(est.minZ, 16);
    assert.equal(est.maxZ, 18);
    assert.ok(est.tiles < 4000);
    assert.ok(est.bytes < 120_000_000);
    assert.equal(est.tooWide, false);
  });

  it("covers Lady Musgrave after a named pack", () => {
    const b = boxAround({ lat: -23.904, lng: 152.395 }, 2200);
    const pack = {
      id: "x",
      name: "Lady Musgrave",
      bounds: b,
      minZ: 16,
      maxZ: 18 as const,
      sources: ["sentinel" as const, "maxar" as const],
      tiles: 1,
      bytes: 1,
      savedAt: "2026-01-01",
    };
    assert.equal(packCovers(pack, -23.904, 152.395), true);
    assert.equal(packCovers(pack, -10, 150), false);
  });

  it("builds a box from two taps", () => {
    const b = boxFromCorners({ lat: -23.91, lng: 152.38 }, { lat: -23.89, lng: 152.41 });
    assert.ok(b.south < b.north);
    assert.ok(b.west < b.east);
  });

  it("refuses a whole-ocean box", () => {
    const est = estimatePack(
      { south: -40, west: 110, north: -10, east: 160 },
      "helm",
    );
    assert.equal(est.tooWide, true);
  });

  it("counts one tile at world zoom for a point box", () => {
    const b = boxAround({ lat: -23.9, lng: 152.4 }, 20);
    assert.equal(countTiles(b, 8, 8), 1);
  });

  it("builds Esri z/y/x URLs", () => {
    const u = tileUrl("maxar", 18, 10, 20);
    assert.ok(u.includes("/18/20/10"));
  });
});
