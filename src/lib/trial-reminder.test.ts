import { test } from "node:test";
import assert from "node:assert/strict";
import { BANNER_WINDOW_MS, REMIND_BEFORE_MS, trialMessage, trialPlan } from "./trial-reminder.ts";

const H = 3_600_000;
const now = Date.parse("2026-11-20T08:00:00Z");

test("schedules the notice a day early and the banner in the last 48 h", () => {
  const far = trialPlan({ inTrial: true, expiresAt: now + 5 * 24 * H, willRenew: true }, now);
  assert.equal(far.notifyAt, now + 5 * 24 * H - REMIND_BEFORE_MS);
  assert.equal(far.showBanner, false);
  const near = trialPlan({ inTrial: true, expiresAt: now + BANNER_WINDOW_MS - H, willRenew: true }, now);
  assert.equal(near.showBanner, true);
  const late = trialPlan({ inTrial: true, expiresAt: now + 10 * H, willRenew: true }, now);
  assert.equal(late.notifyAt, null); // inside 24 h: banner only
  assert.equal(late.showBanner, true);
});

test("nothing outside a trial or after it ended", () => {
  assert.deepEqual(trialPlan({ inTrial: false, expiresAt: now + H, willRenew: true }, now), { notifyAt: null, showBanner: false });
  assert.deepEqual(trialPlan({ inTrial: true, expiresAt: now - H, willRenew: true }, now), { notifyAt: null, showBanner: false });
});

test("message names the price and how to cancel, and the saved data", () => {
  const m = trialMessage({ expiresAt: now + 24 * H, willRenew: true, price: "A$49.99", period: "year", store: "Apple ID", tracks: 3, packs: 1, readAt: now });
  assert.match(m.title, /tomorrow/);
  assert.match(m.body, /A\$49\.99 per year/);
  assert.match(m.body, /cancel in your Apple ID settings/);
  assert.match(m.body, /3 saved tracks and 1 offline chart stay/);
  const off = trialMessage({ expiresAt: now + 2 * H, willRenew: false, price: null, period: "year", store: "Google Play", tracks: 0, packs: 0, readAt: now });
  assert.match(off.body, /Renewal is off/);
  assert.doesNotMatch(off.body, /saved track/);
});
