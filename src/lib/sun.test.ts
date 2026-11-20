import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDaylight, nightSpans, sunRiseSet } from "./sun.ts";

describe("sun", () => {
  it("puts equator equinox sunrise near 06:00 UTC", () => {
    const sun = sunRiseSet(0, 0, Date.parse("2026-03-20T12:00:00Z"));
    assert.ok(sun);
    const riseH = new Date(sun!.rise).getUTCHours() + new Date(sun!.rise).getUTCMinutes() / 60;
    const setH = new Date(sun!.set).getUTCHours() + new Date(sun!.set).getUTCMinutes() / 60;
    assert.ok(Math.abs(riseH - 6) < 0.4, `rise ${riseH}`);
    assert.ok(Math.abs(setH - 18) < 0.4, `set ${setH}`);
  });

  it("puts GBR sunrise in the morning local time", () => {
    const sun = sunRiseSet(-23.9, 152.4, Date.parse("2026-09-21T00:00:00Z"));
    assert.ok(sun);
    const localRise = new Date(sun!.rise).toLocaleString("en-AU", {
      timeZone: "Australia/Brisbane",
      hour: "numeric",
      hour12: false,
    });
    const h = Number(localRise);
    assert.ok(h >= 5 && h <= 7, `local rise hour ${localRise}`);
    assert.equal(isDaylight(-23.9, 152.4, sun!.rise + 60 * 60_000), true);
    assert.equal(isDaylight(-23.9, 152.4, sun!.set + 60 * 60_000), false);
  });

  it("does not paint GBR noon as night", () => {
    const t0 = Date.parse("2026-09-21T00:00:00Z");
    const nights = nightSpans(-23.9, 152.4, t0, t0 + 24 * 3_600_000);
    const noon = Date.parse("2026-09-21T02:00:00Z");
    const midnight = Date.parse("2026-09-21T14:00:00Z");
    assert.equal(
      nights.some((n) => noon >= n.start && noon < n.end),
      false,
    );
    assert.equal(
      nights.some((n) => midnight >= n.start && midnight < n.end),
      true,
    );
  });

  it("keeps equator night after 18:00 UTC", () => {
    const t0 = Date.parse("2026-03-20T00:00:00Z");
    const nights = nightSpans(0, 0, t0, t0 + 24 * 3_600_000);
    const evening = Date.parse("2026-03-20T20:00:00Z");
    const noon = Date.parse("2026-03-20T12:00:00Z");
    assert.equal(
      nights.some((n) => evening >= n.start && evening < n.end),
      true,
    );
    assert.equal(
      nights.some((n) => noon >= n.start && noon < n.end),
      false,
    );
  });
});
