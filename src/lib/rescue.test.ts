import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultReturnBy, nextAt, rescueText } from "./rescue.ts";

test("log on and off words", () => {
  assert.equal(rescueText({ name: "VMR Whitsunday", vhf: "81", phone: "" }, "on"), "Log on with VMR Whitsunday (VHF 81).");
  assert.equal(rescueText({ name: "", vhf: "", phone: "" }, "off"), "Log off with your local marine rescue unit.");
  assert.equal(rescueText({ name: "MR Mooloolaba", vhf: "73", phone: "07 5444 1600" }, "off"), "Log off with MR Mooloolaba (VHF 73 or phone 07 5444 1600).");
});

test("return times", () => {
  const now = Date.UTC(2026, 10, 26, 0, 0);
  assert.equal(defaultReturnBy(now, now + 3 * 3_600_000), now + 3.5 * 3_600_000);
  assert.equal(defaultReturnBy(now, now - 1000), now + 4.5 * 3_600_000);
  const t = nextAt("00:00", now + 60_000)!;
  assert.ok(t > now + 60_000 && t - now <= 24 * 3_600_000);
  assert.equal(nextAt("25:99"), null);
  assert.equal(nextAt("bad"), null);
});
