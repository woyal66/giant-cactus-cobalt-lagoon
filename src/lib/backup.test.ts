import { test } from "node:test";
import assert from "node:assert/strict";
import { backupFileName, makeBackup, mergeTracks, parseBackup } from "./backup.ts";

const track = (id: string, savedAt: string) => ({
  localId: id, title: `T ${id}`, region: "", notes: "", kind: "passage" as const,
  waypoints: [{ lat: -23.9, lng: 152.4 }, { lat: -23.91, lng: 152.41 }], savedAt,
});

test("round trip keeps tracks and chosen settings, never the anchor", () => {
  const state = { drafts: [track("a", "2026-01-01")], depthUnit: "ft", anchor: { lat: 1, lng: 2 }, alarmSound: "bell" };
  const file = makeBackup(state as never, new Date("2026-11-20T00:00:00Z"));
  const back = parseBackup(JSON.stringify(file));
  assert.equal(back.tracks.length, 1);
  assert.equal(back.settings.depthUnit, "ft");
  assert.equal(back.settings.alarmSound, "bell");
  assert.equal("anchor" in back.settings, false);
});

test("rejects other files and newer versions with clear messages", () => {
  assert.throws(() => parseBackup("not json"), /isn't an Anchor Mate backup/);
  assert.throws(() => parseBackup(JSON.stringify({ app: "other" })), /isn't an Anchor Mate backup/);
  assert.throws(() => parseBackup(JSON.stringify({ app: "anchor-mate", version: 99 })), /newer Anchor Mate/);
});

test("drops broken tracks", () => {
  const bad = { app: "anchor-mate", version: 1, tracks: [track("ok", "2026-01-01"), { localId: "x", title: "x", waypoints: [{ lat: "no" }] }] };
  assert.equal(parseBackup(JSON.stringify(bad)).tracks.length, 1);
});

test("merge skips duplicates, sorts newest first, respects the cap", () => {
  const cur = [track("a", "2026-03-01")];
  const r = mergeTracks(cur, [track("a", "2026-03-01"), track("b", "2026-05-01"), track("c", "2026-01-01")], 2);
  assert.deepEqual(r.tracks.map((t) => t.localId), ["b", "a"]);
  assert.equal(r.dropped, 1);
});

test("file name carries the date", () => {
  assert.equal(backupFileName(new Date("2026-11-20T10:00:00Z")), "anchor-mate-backup-2026-11-20.json");
});
