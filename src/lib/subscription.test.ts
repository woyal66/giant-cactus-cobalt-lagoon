import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OFFLINE_GRACE_MS,
  decideAccess,
  freeTrialPeriod,
  parsePeriod,
  trialLabel,
} from "./subscription.ts";

test("parsePeriod reads store ISO periods", () => {
  assert.deepEqual(parsePeriod("P1Y"), { n: 1, unit: "year" });
  assert.deepEqual(parsePeriod("P7D"), { n: 7, unit: "day" });
  assert.deepEqual(parsePeriod("P2W"), { n: 2, unit: "week" });
  assert.equal(parsePeriod(null), null);
  assert.equal(parsePeriod("garbage"), null);
});

test("trialLabel words the trial", () => {
  assert.equal(trialLabel("P7D"), "7-day free trial");
  assert.equal(trialLabel("P1M"), "1-month free trial");
  assert.equal(trialLabel(null), null);
});

test("freeTrialPeriod reads Google Play's free phase", () => {
  const product = {
    defaultOption: { freePhase: { billingPeriod: { iso8601: "P14D" } } },
    introPrice: null,
  } as never;
  assert.equal(freeTrialPeriod(product), "P14D");
});

test("freeTrialPeriod reads an App Store free intro offer", () => {
  const product = {
    defaultOption: null,
    introPrice: { price: 0, periodUnit: "DAY", periodNumberOfUnits: 7, cycles: 1 },
  } as never;
  assert.equal(freeTrialPeriod(product), "P7D");
});

test("freeTrialPeriod ignores a paid intro offer", () => {
  const product = {
    defaultOption: null,
    introPrice: { price: 0.99, periodUnit: "MONTH", periodNumberOfUnits: 1, cycles: 1 },
  } as never;
  assert.equal(freeTrialPeriod(product), null);
});

test("decideAccess trusts live store info first", () => {
  const cached = { active: true, expiresAt: Date.now() + 1e9, checkedAt: Date.now() };
  assert.equal(decideAccess({ active: false }, cached, Date.now()), "locked");
  assert.equal(decideAccess({ active: true }, null, Date.now()), "active");
});

test("decideAccess keeps a paying skipper unlocked offline, within grace", () => {
  const now = 1_000_000_000_000;
  const expired = { active: true, expiresAt: now - 1000, checkedAt: now - 5000 };
  assert.equal(decideAccess(null, expired, now), "active");
  assert.equal(decideAccess(null, expired, now + OFFLINE_GRACE_MS), "locked");
  assert.equal(decideAccess(null, { active: false, expiresAt: null, checkedAt: now }, now), "locked");
  assert.equal(decideAccess(null, null, now), "locked");
});
