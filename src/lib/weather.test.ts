import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  beaufort,
  clampWxHorizon,
  currentVsHeading,
  formatKn,
  graphLine,
  graphLineTimed,
  graphMaxKn,
  parseMetNo,
  parseOpenMeteo,
  parseSea,
  setAllowance,
  skyFromSymbol,
  skyFromWmo,
  sliceByHorizon,
  axisMarks,
  stormRiskOf,
  windColor,
  windSeaM,
  dayClock,
  windCardinal,
  reviveForecast,
  WX_SAVE_MAX_AGE_MS,
  type WxForecast,
} from "./weather.ts";

describe("forecast axis", () => {
  it("keeps time labels far enough apart to read", () => {
    const t0 = Date.UTC(2026, 10, 20, 0);
    for (const h of [6, 12, 24, 48, 72, 168, 336]) {
      const n = axisMarks(t0, h).length;
      assert.ok(n >= 3 && n <= 7, `${h} h → ${n} labels`);
    }
  });

  it("keeps the weekday on a zoomed window and aligns marks to the clock", () => {
    const t0 = Date.parse("2026-10-06T15:10:00");
    const marks = axisMarks(t0, 6);
    assert.ok(marks.length >= 4);
    assert.ok(marks.some((m) => m.day));
    for (const m of marks) {
      assert.equal(new Date(m.at).getMinutes(), 0);
      assert.ok(m.at >= t0);
    }
  });

  it("names today and tomorrow instead of only a clock time", () => {
    const now = Date.parse("2026-10-05T09:00:00");
    assert.equal(dayClock(now + 5 * 60_000, now).label, "Now");
    assert.equal(dayClock(now + 3 * 3_600_000, now).label, "Today");
    assert.ok(dayClock(now + 3 * 3_600_000, now).hint.length > 0);
    assert.equal(dayClock(now + 26 * 3_600_000, now).label, "Tomorrow");
  });
});

describe("wind helpers", () => {
  it("uses 16-point cardinals from the from-direction", () => {
    assert.equal(windCardinal(0), "N");
    assert.equal(windCardinal(22), "NNE");
    assert.equal(windCardinal(321.9), "NW");
    assert.equal(windCardinal(348), "NNW");
  });

  it("labels beaufort for skipper wind bands", () => {
    assert.equal(beaufort(8).label, "Gentle breeze");
    assert.equal(beaufort(12).label, "Moderate breeze");
    assert.equal(beaufort(25).label, "Strong breeze");
    assert.equal(beaufort(30).label, "Near gale");
  });

  it("formats knots without a trailing tenth on whole numbers", () => {
    assert.equal(formatKn(8.0), "8");
    assert.equal(formatKn(8.4), "8.4");
    assert.equal(formatKn(18.2), "18");
  });

  it("steers into a beam set and ignores a fair set", () => {
    const port = setAllowance(0, 6, 1, 90);
    assert.ok(port);
    assert.equal(port.side, "P");
    assert.equal(port.deg, 10);
    const stbd = setAllowance(0, 6, 1, 270);
    assert.equal(stbd?.side, "S");
    assert.equal(setAllowance(90, 6, 1, 90), null);
    assert.equal(setAllowance(0, 0.4, 1, 90), null);
  });
});

describe("sky mapping", () => {
  it("maps MET Norway symbols and WMO codes", () => {
    assert.equal(skyFromSymbol("clearsky_day"), "clear");
    assert.equal(skyFromSymbol("partlycloudy_night"), "partly");
    assert.equal(skyFromSymbol("lightrainshowers_day"), "rain");
    assert.equal(skyFromSymbol("heavyrainandthunder"), "storm");
    assert.equal(skyFromWmo(0), "clear");
    assert.equal(skyFromWmo(61), "rain");
    assert.equal(skyFromWmo(95), "storm");
  });
});

describe("parsers", () => {
  it("takes the next 24 MET Norway hours from now", () => {
    const now = Date.parse("2026-09-20T00:00:00Z");
    const timeseries = [];
    for (let i = -2; i < 30; i += 1) {
      const at = new Date(now + i * 3_600_000).toISOString();
      timeseries.push({
        time: at,
        data: {
          instant: {
            details: {
              wind_speed: 4 + i * 0.1,
              wind_from_direction: 320,
              air_temperature: 21,
              cloud_area_fraction: 10,
            },
          },
          next_1_hours: {
            summary: { symbol_code: "clearsky_day" },
            details: { precipitation_amount: i === 5 ? 1.2 : 0 },
          },
        },
      });
    }
    const wx = parseMetNo({ properties: { timeseries } }, -23.9, 152.4, now);
    assert.ok(wx.hours.length >= 24);
    assert.equal(wx.source, "met.no");
    assert.equal(wx.now.at, now);
    assert.equal(wx.rainMm, 1.2);
    assert.ok(wx.maxWind.windKn >= wx.now.windKn);
  });

  it("parses Open-Meteo knots and gusts", () => {
    const now = Date.parse("2026-09-20T06:00:00Z");
    const wx = parseOpenMeteo(
      {
        hourly: {
          time: ["2026-09-20T06:00:00Z", "2026-09-20T07:00:00Z"],
          wind_speed_10m: [12.2, 18.8],
          wind_direction_10m: [90, 100],
          wind_gusts_10m: [16, 24],
          weather_code: [0, 61],
          temperature_2m: [22.1, 21.4],
          precipitation: [0, 0.4],
          cloud_cover: [5, 80],
        },
      },
      -23.9,
      152.4,
      now,
    );
    assert.equal(wx.source, "ecmwf");
    assert.equal(wx.now.windKn, 12.2);
    assert.equal(wx.now.gustKn, 16);
    assert.equal(wx.maxWind.windKn, 18.8);
    assert.equal(wx.hours[1]?.sky, "rain");
  });

  it("picks the nearest marine hour", () => {
    const now = Date.parse("2026-09-20T03:20:00Z");
    const sea = parseSea(
      {
        hourly: {
          time: ["2026-09-20T03:00:00Z", "2026-09-20T04:00:00Z"],
          wave_height: [1.3, 1.1],
          swell_wave_height: [1.1, 1.0],
          wave_period: [9.8, 10.2],
          wave_direction: [260, 250],
          ocean_current_velocity: [2.037, 1.5],
          ocean_current_direction: [90, 95],
        },
      },
      now,
    );
    assert.equal(sea?.waveM, 1.3);
    assert.equal(sea?.periodS, 10);
    assert.equal(sea?.currentKn, 1.1);
    assert.equal(sea?.currentDir, 90);
    assert.equal(sea?.tideHours.length, 0);
    assert.equal(sea?.waveHours.length, 2);
    assert.equal(sea?.waveHours[0]?.heightM, 1.3);
  });
});

describe("wind graph", () => {
  it("rounds the scale to a skipper-friendly 5 kn", () => {
    assert.equal(
      graphMaxKn([
        {
          at: 0,
          windKn: 11,
          gustKn: 18,
          dirDeg: 90,
          tempC: 20,
          precipMm: 0,
          cloudPct: 0,
          sky: "clear",
        },
      ]),
      20,
    );
  });

  it("draws a polyline across the plot", () => {
    const d = graphLine([5, 10, 15], 100, 50, 20);
    assert.ok(d.startsWith("M"));
    assert.equal(d.split(" L").length, 3);
  });
});

describe("current set", () => {
  it("splits set into with-you and to-starboard", () => {
    const withYou = currentVsHeading(2, 180, 180);
    assert.equal(withYou.alongKn, 2);
    assert.ok(Math.abs(withYou.acrossKn) < 0.05);
    const beam = currentVsHeading(2, 90, 0);
    assert.ok(Math.abs(beam.alongKn) < 0.05);
    assert.equal(beam.acrossKn, 2);
  });
});

describe("horizon", () => {
  it("clamps between 6 hours and 14 days", () => {
    assert.equal(clampWxHorizon(1), 6);
    assert.equal(clampWxHorizon(400), 336);
    assert.equal(clampWxHorizon(48), 48);
  });

  it("windows by clock time, not sample count", () => {
    const t0 = Date.parse("2026-09-20T00:00:00Z");
    const hours = [];
    for (let i = 0; i < 240; i += 1) {
      hours.push({
        at: t0 + i * 3_600_000,
        windKn: 8 + (i % 20),
        gustKn: 10,
        dirDeg: 90,
        tempC: 20,
        precipMm: 0,
        cloudPct: 0,
        sky: "clear" as const,
      });
    }
    assert.equal(sliceByHorizon(hours, 48).length, 49);
    assert.ok(sliceByHorizon(hours, 336).length > 200);
    const two = graphLineTimed(
      hours.slice(0, 48).map((h) => ({ at: h.at, v: h.windKn })),
      t0,
      48,
      100,
      50,
      30,
    );
    const fortnight = graphLineTimed(
      hours.map((h) => ({ at: h.at, v: h.windKn })),
      t0,
      336,
      100,
      50,
      30,
    );
    assert.notEqual(two, fortnight);
  });
});

describe("offline forecast", () => {
  const H = 3_600_000;
  const t0 = Date.parse("2026-11-01T00:00:00Z");
  const hour = (i: number, kn: number) => ({
    at: t0 + i * H, windKn: kn, gustKn: null, dirDeg: 90, tempC: 25, precipMm: 0.5,
    cloudPct: 10, sky: "sun" as const,
  });
  const base = {
    lat: -23.9, lng: 152.4, source: "ecmwf" as const,
    hours: Array.from({ length: 24 }, (_, i) => hour(i, i === 2 ? 30 : 10)),
    rainMm: 12, sea: null, savedAt: t0,
  } as unknown as WxForecast;

  it("moves 'now' to the current hour and drops the past", () => {
    const f = reviveForecast(base, t0 + 5 * H)!;
    assert.equal(f.now.at, t0 + 4 * H); // keeps the hour just gone
    assert.equal(f.hours.length, 20);
    assert.equal(f.maxWind.windKn, 10); // the 30 kn hour is in the past now
  });

  it("refuses a forecast that is too old or nearly used up", () => {
    assert.equal(reviveForecast(base, t0 + WX_SAVE_MAX_AGE_MS + 1), null);
    assert.equal(reviveForecast(base, t0 + 23 * H), null);
    assert.equal(reviveForecast({ ...base, savedAt: undefined }, t0), null);
  });
});

describe("forecast table helpers", () => {
  it("colours wind by strength", () => {
    assert.notEqual(windColor(8).bg, windColor(27).bg);
    assert.equal(windColor(27).bg, windColor(29.9).bg);
    assert.equal(windColor(60).bg, "#6b2bb0");
  });
  it("splits wind sea from swell", () => {
    assert.equal(windSeaM(1.5, null), 1.5);
    assert.ok(Math.abs(windSeaM(1.0, 0.6) - 0.8) < 1e-9);
    assert.equal(windSeaM(0.5, 0.9), 0);
  });
  it("storm risk from CAPE and thunder codes", () => {
    const h = { at: 0, windKn: 12, gustKn: 20, dirDeg: 90, tempC: 26, precipMm: 0, cloudPct: 50, sky: "cloud" as const };
    assert.equal(stormRiskOf(h), 0);
    assert.ok(stormRiskOf({ ...h, capeJkg: 3200, precipMm: 2 }) >= 2);
    assert.ok(stormRiskOf({ ...h, code: 95, precipMm: 2 }) >= 2);
  });
});

it("point forecast: 9 km hours kept, the rest from the 25 km run", async () => {
  const { fillHourly } = await import("./weather.ts");
  const out = fillHourly(
    { hourly: { time: ["a", "b"], wind_speed_10m: [5, null] } },
    { hourly: { time: ["a", "b", "c"], wind_speed_10m: [9, 8, 7] } },
  );
  assert.deepEqual(out.hourly!.wind_speed_10m, [5, 8, 7]);
  assert.deepEqual(out.hourly!.time, ["a", "b", "c"]);
});
