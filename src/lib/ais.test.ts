import { test } from "node:test";
import assert from "node:assert/strict";
import { cpa, dangers, mergeTarget, parseAisStream, parseSignalK, pruneTargets, signalKUrl, type AisTarget } from "./ais.ts";

const own = { lat: -20, lng: 149, sogKn: 0, cogDeg: 0 };
const nmLat = 1852 / 110_540;

test("CPA: a ship heading straight at an anchored boat", () => {
  // 2 nm north, steaming south at 12 kn: hits in 10 minutes.
  const t = { lat: own.lat + 2 * nmLat, lng: own.lng, sogKn: 12, cogDeg: 180 };
  const c = cpa(own, t);
  assert.ok(c.cpaM < 20, `cpa ${c.cpaM}`);
  assert.ok(Math.abs(c.tcpaMin - 10) < 0.2, `tcpa ${c.tcpaMin}`);
});

test("CPA: a ship passing 1 nm off, and one going away", () => {
  const k = Math.cos((own.lat * Math.PI) / 180);
  const east1nm = 1852 / (111_320 * k);
  const passing = cpa(own, { lat: own.lat + 3 * nmLat, lng: own.lng + east1nm, sogKn: 15, cogDeg: 180 });
  assert.ok(Math.abs(passing.cpaM - 1852) < 15);
  assert.ok(Math.abs(passing.tcpaMin - 12) < 0.3);
  const away = cpa(own, { lat: own.lat + 1 * nmLat, lng: own.lng, sogKn: 10, cogDeg: 0 });
  assert.ok(away.tcpaMin < 0);
  assert.ok(Math.abs(away.cpaM - 1852) < 15);
});

test("dangers: inside the limits only, stale and navigation aids ignored", () => {
  const now = 1_000_000_000;
  const mk = (mmsi: string, p: Partial<AisTarget>): AisTarget => ({ mmsi, name: "", lat: own.lat, lng: own.lng, sogKn: 0, cogDeg: 0, headingDeg: NaN, at: now, cls: "A", ...p });
  const list = [
    mk("1", { lat: own.lat + 2 * nmLat, sogKn: 12, cogDeg: 180 }), // collision in 10 min
    mk("2", { lat: own.lat + 6 * nmLat, sogKn: 12, cogDeg: 180 }), // collision in 30 min: outside 15
    mk("3", { lat: own.lat + 2 * nmLat, sogKn: 12, cogDeg: 180, at: now - 10 * 60_000 }), // stale
    mk("4", { lat: own.lat + 0.1 * nmLat, cls: "aton" }),
  ];
  const d = dangers(own, list, { cpaNm: 0.5, tcpaMin: 15 }, now);
  assert.deepEqual(d.map((x) => x.target.mmsi), ["1"]);
});

test("aisstream messages", () => {
  const u = parseAisStream({
    MessageType: "PositionReport",
    MetaData: { MMSI: 503123456, ShipName: "PACIFIC DAWN@@@ ", latitude: -20.1, longitude: 148.9, time_utc: "2026-11-26 03:10:00.123 +0000 UTC" },
    Message: { PositionReport: { Latitude: -20.1, Longitude: 148.9, Sog: 11.2, Cog: 182.5, TrueHeading: 511, NavigationalStatus: 0 } },
  })!;
  assert.equal(u.mmsi, "503123456");
  assert.equal(u.name, "PACIFIC DAWN");
  assert.equal(u.sogKn, 11.2);
  assert.ok(Number.isNaN(u.headingDeg));
  assert.equal(u.at, Date.UTC(2026, 10, 26, 3, 10, 0, 123));
  assert.equal(parseAisStream({ MessageType: "PositionReport", MetaData: { MMSI: 12 } }), null);
  const map = new Map<string, AisTarget>();
  mergeTarget(map, { mmsi: "503123456", name: "PACIFIC DAWN" });
  mergeTarget(map, { ...u, name: undefined });
  assert.equal(map.get("503123456")!.name, "PACIFIC DAWN");
  pruneTargets(map, u.at! + 7 * 60_000);
  assert.equal(map.size, 0);
});

test("Signal K deltas", () => {
  const ups = parseSignalK({
    context: "vessels.urn:mrn:imo:mmsi:503000111",
    updates: [
      {
        timestamp: "2026-11-26T03:10:00Z",
        values: [
          { path: "navigation.position", value: { latitude: -20.2, longitude: 148.8 } },
          { path: "navigation.speedOverGround", value: 5 },
          { path: "navigation.courseOverGroundTrue", value: Math.PI },
          { path: "", value: { name: "Seabird" } },
        ],
      },
    ],
  });
  assert.equal(ups.length, 1);
  assert.equal(ups[0]!.name, "Seabird");
  assert.ok(Math.abs(ups[0]!.sogKn! - 9.72) < 0.01);
  assert.ok(Math.abs(ups[0]!.cogDeg! - 180) < 1e-9);
  assert.deepEqual(parseSignalK({ context: "vessels.urn:mrn:imo:mmsi:503000111", updates: [] }, "vessels.urn:mrn:imo:mmsi:503000111"), []);
  assert.equal(signalKUrl("192.168.1.10"), "ws://192.168.1.10:3000/signalk/v1/stream?subscribe=all");
  assert.equal(signalKUrl("http://venus.local:3001/"), "ws://venus.local:3001/signalk/v1/stream?subscribe=all");
  assert.equal(signalKUrl("bad host!"), null);
});
