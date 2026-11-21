import { test } from "node:test";
import assert from "node:assert/strict";
import { searchPlaces } from "./place-search.ts";

test("finds reefs and ports, best matches first", () => {
  assert.equal(searchPlaces("lady musg")[0]?.name, "Lady Musgrave");
  assert.ok(searchPlaces("lady").every((p) => p.name.startsWith("Lady")));
  assert.ok(searchPlaces("albany").some((p) => p.kind === "port"));
  assert.deepEqual(searchPlaces("a"), []);
  const mine = searchPlaces("pancake", [{ name: "Pancake Creek in", detail: "My track", lat: -24, lng: 151.7, zoom: 15, kind: "track" }]);
  assert.equal(mine[0]?.kind, "track");
});
