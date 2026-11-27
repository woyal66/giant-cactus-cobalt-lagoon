import { test } from "node:test";
import assert from "node:assert/strict";
import { conditionsAt } from "./field.ts";
import { corridor, fieldFromResponses } from "./fetch-field.ts";

test("corridor pads the box and keeps under the point cap", () => {
  const g = corridor({ lat: -23.83, lng: 151.27 }, { lat: -23.9, lng: 152.4 });
  assert.ok(g.lats.length * g.lngs.length <= 100);
  assert.ok(g.west < 151.27 && g.east > 152.4);
  const far = corridor({ lat: -27, lng: 153.5 }, { lat: -16, lng: 146 });
  assert.ok(far.lats.length * far.lngs.length <= 100);
});

test("builds a field from multi-location responses, converting current to knots", () => {
  const g = corridor({ lat: -23.5, lng: 152 }, { lat: -23.5, lng: 152.3 });
  const n = g.lats.length * g.lngs.length;
  const time = [1_800_000_000, 1_800_003_600];
  const wind = Array.from({ length: n }, () => ({ hourly: { time, wind_speed_10m: [10, 20], wind_direction_10m: [90, 90], wind_gusts_10m: [14, 26] } }));
  const marine = Array.from({ length: n }, () => ({ hourly: { time: [1_800_003_600], wave_height: [1.5], wave_direction: [100], ocean_current_velocity: [3.704], ocean_current_direction: [45] } }));
  const f = fieldFromResponses(g, "ecmwf", wind, marine);
  const c = conditionsAt(f, -23.5, 152.1, 1_800_003_600_000);
  assert.ok(Math.abs(c.windKn - 20) < 1e-3);
  assert.ok(Math.abs(c.curKn - 2) < 1e-3, String(c.curKn));
  assert.ok(Math.abs(c.waveM - 1.5) < 1e-3);
  // Marine had no first hour: that layer reads as calm sea.
  assert.equal(conditionsAt(f, -23.5, 152.1, 1_800_000_000_000).waveM, 0);
});

test("the fine model's hours are kept and its gaps filled from the fallback", async () => {
  const { mergeLocs } = await import("./fetch-field.ts");
  const out = mergeLocs(
    [{ hourly: { time: [1, 2, 3], wind_speed_10m: [5, null, null] } }],
    [{ hourly: { time: [1, 2, 3], wind_speed_10m: [9, 8, 7] } }],
  );
  assert.deepEqual(out[0]!.hourly!.wind_speed_10m, [5, 8, 7]);
});
