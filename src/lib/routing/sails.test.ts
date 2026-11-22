import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SAILS, apparentWind, chooseSails, readSails, sailPlan } from "./sails.ts";
import type { RoutePoint } from "./router.ts";

test("apparent wind: upwind it builds and comes forward, downwind it drops", () => {
  const up = apparentWind(15, 45, 6);
  assert.ok(up.aws > 19 && up.aws < 21 && up.awa < 35, JSON.stringify(up));
  const run = apparentWind(15, 180, 6);
  assert.ok(Math.abs(run.aws - 9) < 1e-9 && Math.abs(run.awa - 180) < 1e-6);
  const beam = apparentWind(12, 90, 7);
  assert.ok(beam.awa > 55 && beam.awa < 65);
});

test("reefs by apparent wind, downwind sails when owned and in range", () => {
  const owned = DEFAULT_SAILS.map((s) => (s.id === "asym" || s.id === "code0" ? { ...s, owned: true } : s));
  assert.deepEqual(chooseSails(DEFAULT_SAILS, 12, 60, false), { main: "Full main", head: "Genoa", motoring: false });
  assert.equal(chooseSails(DEFAULT_SAILS, 26, 40, false).main, "Main reef 2");
  assert.equal(chooseSails(DEFAULT_SAILS, 20, 40, false).head, "Genoa furled ~70%");
  assert.equal(chooseSails(owned, 10, 130, false).head, "Asymmetric spinnaker");
  assert.equal(chooseSails(owned, 8, 70, false).head, "Code zero");
  assert.equal(chooseSails(owned, 8, 70, true).head, "Engine");
});

const pt = (h: number, twsKn: number, twa: number, stwKn = 6, motoring = false): RoutePoint => ({
  lat: 0, lng: 0, at: h * 3_600_000, windKn: twsKn, windDir: 0, gustKn: twsKn, waveM: 0, waveAmp: 1, curAlongKn: 0,
  thunder: 0, squall: false, curKn: 0, curDir: 0, twa, twsKn, tack: 1, stwKn, sogKn: stwKn, motoring,
});

test("sail plan merges short stretches and lists changes", () => {
  // 0-3 h light reach, a 15-minute blip of wind, then a breeze that needs a reef.
  const pts = [pt(0, 10, 90), pt(1, 10, 90), pt(2, 10, 90), pt(2.25, 22, 90), pt(2.5, 10, 90), pt(3, 10, 90), pt(4, 18, 60), pt(5, 18, 60), pt(6, 18, 60)];
  const { segments, changes } = sailPlan(pts, DEFAULT_SAILS);
  assert.equal(segments.length, 2, JSON.stringify(segments.map((s) => [s.main, s.head])));
  assert.match(changes[0]!.text, /^Set Full main \+ Genoa/);
  assert.match(changes[1]!.text, /Reef 1/);
});

test("saved sails survive, unknown ones are dropped, new templates appear", () => {
  const r = readSails([{ id: "asym", owned: true }, { id: "bogus" }]);
  assert.equal(r.find((s) => s.id === "asym")!.owned, true);
  assert.equal(r.some((s) => s.id === "bogus"), false);
  assert.equal(r.length, DEFAULT_SAILS.length);
});
