import { test } from "node:test";
import assert from "node:assert/strict";
import { chartStyle } from "./chart-style.ts";

test("chart mode fills land and sea; lines mode draws only lines and names", () => {
  const chart = chartStyle("chart");
  assert.ok(chart.layers.some((l) => l.type === "background"));
  assert.ok(chart.layers.some((l) => l.type === "fill"));
  const lines = chartStyle("lines");
  assert.ok(!lines.layers.some((l) => l.type === "background" || l.type === "fill"));
  assert.ok(lines.layers.some((l) => l.id === "coast") && lines.layers.some((l) => l.id === "places"));
});

test("night palette is dark", () => {
  const sea = chartStyle("chart", true).layers.find((l) => l.id === "sea") as unknown as { paint: Record<string, string> };
  assert.match(sea.paint["fill-color"], /^#[0-3]/);
});
