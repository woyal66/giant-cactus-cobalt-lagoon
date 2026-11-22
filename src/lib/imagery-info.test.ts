import { test } from "node:test";
import assert from "node:assert/strict";
import { describePhoto, esriIdentifyUrl, parseDate, parseEsriMetadata } from "./imagery-info.ts";

test("reads the dates Esri metadata may use", () => {
  assert.equal(parseDate("20230514"), Date.UTC(2023, 4, 14));
  assert.equal(parseDate(20230514), Date.UTC(2023, 4, 14));
  assert.equal(parseDate("2023/05/14"), Date.UTC(2023, 4, 14));
  assert.equal(parseDate("5/14/2023 12:00:00 AM"), Date.UTC(2023, 4, 14));
  assert.equal(parseDate(1684022400000), 1684022400000);
  assert.equal(parseDate("soon"), null);
});

test("picks the record for the zoom and reads date, resolution and sensor", () => {
  const json = {
    results: [
      { attributes: { MinMapLevel: 0, MaxMapLevel: 13, SRC_DATE2: "2019/02/01", SRC_RES: 15, NICE_DESC: "Landsat" } },
      { attributes: { MinMapLevel: 14, MaxMapLevel: 23, SRC_DATE2: "2023/05/14", SRC_RES: 0.3, NICE_DESC: "WorldView-3" } },
    ],
  };
  const info = parseEsriMetadata(json, 19)!;
  assert.equal(info.date, Date.UTC(2023, 4, 14));
  assert.equal(info.resM, 0.3);
  assert.equal(info.source, "WorldView-3");
  assert.match(describePhoto(info), /WorldView-3 · May 2023 · 0\.3 m per pixel/);
  assert.equal(parseEsriMetadata({ results: [] }, 19), null);
  assert.equal(parseEsriMetadata({ error: { code: 400 } }, 19), null);
  assert.equal(describePhoto(null), "date not published");
});

test("identify URL carries the point and zoom", () => {
  const u = new URL(esriIdentifyUrl(-23.9, 152.4, 19));
  assert.equal(u.searchParams.get("geometry"), "152.4,-23.9");
  assert.equal(u.searchParams.get("f"), "json");
});
