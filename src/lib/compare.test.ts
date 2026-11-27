import { test } from "node:test";
import assert from "node:assert/strict";
import { agreementText, columnTimes, sampleAt, spreadOf } from "./compare.ts";

test("columns fall on whole steps", () => {
  const start = new Date(2026, 10, 27, 7, 20).getTime();
  const c = columnTimes(start, 24, 3);
  assert.equal(new Date(c[0]!).getHours(), 9);
  assert.ok(c.every((t) => new Date(t).getHours() % 3 === 0));
  assert.equal(c.length, 8);
});

test("nearest sample within the tolerance", () => {
  const h = [{ at: 0, v: 1 }, { at: 3_600_000, v: 2 }];
  assert.equal(sampleAt(h, 3_500_000)?.v, 2);
  assert.equal(sampleAt(h, 20_000_000), null);
});

test("spread and agreement", () => {
  assert.deepEqual(spreadOf([10, 12, 11]), { spread: 2, level: "good" });
  assert.equal(spreadOf([10, 17])!.level, "fair");
  assert.equal(spreadOf([8, 20, NaN])!.level, "poor");
  assert.equal(spreadOf([10]), null);
  assert.equal(spreadOf([1, 1.6], "wave")!.level, "fair");
});

test("agreement in words", () => {
  const u = (n: number) => `${Math.round(n)} kn`;
  const mon = new Date(2026, 10, 30, 12).getTime();
  assert.match(agreementText([{ at: 0, level: "good", spread: 2 }, { at: mon, level: "poor", spread: 12 }], u), /agree until Monday.*12 kn/);
  assert.match(agreementText([{ at: 0, level: "good", spread: 1 }], u), /agree well/);
  assert.match(agreementText([{ at: 0, level: "fair", spread: 6 }], u), /already differ/);
  assert.match(agreementText([{ at: 0, level: null, spread: 0 }], u), /Only one model/);
});
