import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  heightBetweenTurns,
  hoursFromTurns,
  latDatumM,
  parseBomPrint,
  parseTideHours,
  parseTideWatch,
  tideAt,
  tideRiseAt,
  tideTurns,
  toLatM,
} from "./tides.ts";
import {
  nearestBomPort,
  tideOriginChip,
  tideOriginLabel,
} from "./tide-station.ts";

describe("tide series", () => {
  it("finds high and low turning points", () => {
    const t0 = Date.parse("2026-09-20T00:00:00Z");
    const times = [];
    const heights = [];
    for (let i = 0; i < 25; i += 1) {
      times.push(new Date(t0 + i * 3_600_000).toISOString());
      heights.push(1 + Math.sin((i / 12) * Math.PI));
    }
    const hours = parseTideHours(times, heights, t0);
    const turns = tideTurns(hours);
    assert.ok(turns.some((t) => t.kind === "high"));
    assert.ok(turns.some((t) => t.kind === "low"));
    const watch = parseTideWatch(
      { hourly: { time: times, sea_level_height_msl: heights } },
      t0,
    );
    assert.ok(watch);
    assert.ok(watch!.riseM >= 0);
    assert.ok(watch!.hours.length >= 20);
    const mid = tideAt(hours, t0 + 6 * 3_600_000);
    assert.ok(mid != null && mid > 1);
    const datum = latDatumM(hours);
    assert.ok(toLatM(hours[0]!.m, datum) >= 0.09);
    assert.ok(hours.every((h) => toLatM(h.m, datum) >= 0));
    assert.equal(watch!.origin.kind, "model");
  });
});

const MUSGRAVE_PRINT = `
  <h2 class="tide">Lady Musgrave Island, QLD</h2>
  <table>
    <tr>
      <th rowspan="2" class="instance high-tide">High</th>
      <td data-time-utc="2026-09-20T18:45:00Z" class="localtime high-tide">4:45 am</td>
    </tr>
    <tr>
      <td class="height high-tide">1.24 m</td>
    </tr>
    <tr>
      <th rowspan="2" class="instance low-tide">Low</th>
      <td data-time-utc="2026-09-21T00:12:00Z" class="localtime low-tide">10:12 am</td>
    </tr>
    <tr>
      <td class="height low-tide">0.86 m</td>
    </tr>
    <tr>
      <th rowspan="2" class="instance high-tide">High</th>
      <td data-time-utc="2026-09-21T07:12:00Z" class="localtime high-tide">5:12 pm</td>
    </tr>
    <tr>
      <td class="height high-tide">1.89 m</td>
    </tr>
    <tr>
      <th rowspan="2" class="instance low-tide">Low</th>
      <td data-time-utc="2026-09-21T13:58:00Z" class="localtime low-tide">11:58 pm</td>
    </tr>
    <tr>
      <td class="height low-tide">0.69 m</td>
    </tr>
  </table>
`;

describe("BOM station table", () => {
  it("parses the real BOM print markup (instance then utc then height)", () => {
    const turns = parseBomPrint(MUSGRAVE_PRINT);
    assert.equal(turns.length, 4);
    assert.equal(turns[0]!.kind, "high");
    assert.equal(turns[0]!.m, 1.24);
    assert.equal(turns[0]!.at, Date.parse("2026-09-20T18:45:00Z"));
    assert.equal(turns[2]!.m, 1.89);
    assert.equal(turns[3]!.kind, "low");
    assert.equal(turns[3]!.m, 0.69);
  });

  it("sketches a cosine curve between high and low", () => {
    const t0 = Date.parse("2026-09-21T00:00:00Z");
    const turns = [
      { kind: "high" as const, at: t0, m: 2 },
      { kind: "low" as const, at: t0 + 6 * 3_600_000, m: 0.6 },
    ];
    const mid = heightBetweenTurns(turns, t0 + 3 * 3_600_000);
    assert.ok(mid != null);
    assert.ok(Math.abs(mid - 1.3) < 0.05);
    const hours = hoursFromTurns(turns, t0, 6, 60);
    assert.ok(hours.length >= 6);
  });

  it("measures remaining rise from now, not the first sample", () => {
    const t0 = Date.parse("2026-09-21T00:00:00Z");
    const turns = [
      { kind: "low" as const, at: t0, m: 0.6 },
      { kind: "high" as const, at: t0 + 6 * 3_600_000, m: 2.0 },
    ];
    const hours = hoursFromTurns(turns, t0, 6, 60);
    const now = t0 + 3 * 3_600_000;
    const r = tideRiseAt(turns, hours, now);
    assert.ok(r.high);
    assert.ok(Math.abs(r.nowM - 1.3) < 0.05);
    assert.equal(r.riseM, 0.7);
    const stale = hours[0]!.m;
    assert.ok(Math.abs(stale - 0.6) < 0.05);
    assert.notEqual(
      Math.max(0, Math.round((r.high!.m - stale) * 10) / 10),
      r.riseM,
    );
  });

  it("treats station heights as LAT — do not subtract the series min", () => {
    const turns = parseBomPrint(MUSGRAVE_PRINT);
    const hours = hoursFromTurns(turns, turns[0]!.at, 12, 60);
    assert.ok(hours.some((h) => h.m > 1.2));
    assert.ok(hours.every((h) => h.m >= 0.69 - 0.01));
    assert.equal(toLatM(1.89, 0), 1.89);
  });

  it("picks Lady Musgrave for the lagoon, not Gladstone", () => {
    const n = nearestBomPort({ lat: -23.904, lng: 152.395 });
    assert.ok(n);
    assert.match(n.port.name, /Musgrave/);
    assert.equal(n.port.aac, "QLD_TP157");
    assert.equal(n.port.primary, false);
    assert.ok(n.km < 5);
  });

  it("falls back when no BOM port is within 120 km", () => {
    const n = nearestBomPort({ lat: 0, lng: 0 });
    assert.equal(n, null);
  });

  it("labels station vs model in skipper language", () => {
    const station = tideOriginLabel({
      kind: "station",
      name: "Lady Musgrave Island",
      aac: "QLD_TP157",
      km: 1.4,
      primary: false,
      datum: "LAT",
    });
    assert.match(station, /BOM tide table/);
    assert.match(station, /Musgrave/);
    assert.match(station, /LAT/);
    assert.equal(
      tideOriginChip({
        kind: "station",
        name: "Lady Musgrave Island",
        aac: "QLD_TP157",
        km: 1.4,
        primary: false,
        datum: "LAT",
      }),
      "Tide · BOM",
    );
    const model = tideOriginLabel({
      kind: "model",
      name: "Open-Meteo marine",
      datum: "LAT estimate",
    });
    assert.match(model, /not a tide station/i);
    assert.equal(
      tideOriginChip({ kind: "model", name: "Open-Meteo marine", datum: "LAT estimate" }),
      "Tide · model",
    );
  });
});
