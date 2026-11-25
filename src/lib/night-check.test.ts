import { test } from "node:test";
import assert from "node:assert/strict";
import { nightChecks, nightSummary, type CheckInput } from "./night-check.ts";

const good: CheckInput = {
  native: true,
  ios: false,
  notify: "granted",
  battery: { level: 0.8, charging: true },
  accuracyM: 5,
  radiusM: 40,
  hasFix: true,
  soundTested: true,
  remoteLinked: false,
};

test("all set: ok, the optional second phone doesn't count against it", () => {
  const items = nightChecks(good);
  assert.equal(nightSummary(items), "ok");
  assert.ok(!items.some((x) => x.id === "critical"));
});

test("notifications denied is a problem with a settings fix", () => {
  const items = nightChecks({ ...good, notify: "denied" });
  const n = items.find((x) => x.id === "notify")!;
  assert.equal(n.state, "bad");
  assert.equal(n.action, "settings");
  assert.equal(nightSummary(items), "bad");
});

test("low battery off charge and an untested sound are flagged", () => {
  const items = nightChecks({ ...good, battery: { level: 0.3, charging: false }, soundTested: false });
  assert.equal(items.find((x) => x.id === "battery")!.state, "bad");
  assert.equal(items.find((x) => x.id === "sound")!.action, "test");
});

test("iPhone without Time Sensitive or Critical Alerts is a problem; browsers are warned", () => {
  const ios = nightChecks({ ...good, ios: true, critical: { critical: false, timeSensitive: false } });
  assert.equal(ios.find((x) => x.id === "critical")!.state, "bad");
  const web = nightChecks({ ...good, native: false });
  assert.equal(web[0]!.id, "browser");
});

test("vague GPS warns, no fix is a problem", () => {
  assert.equal(nightChecks({ ...good, accuracyM: 60, radiusM: 30 }).find((x) => x.id === "gps")!.state, "warn");
  assert.equal(nightChecks({ ...good, hasFix: false }).find((x) => x.id === "gps")!.state, "bad");
});
