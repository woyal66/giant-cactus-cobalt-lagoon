import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { destPoint } from "./geo.ts";
import { formatTtg, formatXte, markNav, nextTurn, nextVertexIndex, steerCue, steerLegIndex } from "./steer.ts";

describe("track steer", () => {
  const a = { lat: -23.9, lng: 152.4 };
  const b = destPoint(a, 90, 400);
  const c = destPoint(b, 90, 400);
  const track = [a, b, c];

  it("holds the bow up when on the line and headed along it", () => {
    const mid = destPoint(a, 90, 200);
    const cue = steerCue({ ...mid, heading: 90 }, track, "track", 40);
    assert.ok(cue);
    assert.ok(Math.abs(cue.xteM) < 2);
    assert.ok(Math.abs(cue.steerDeg) < 6);
    assert.equal(cue.offTrack, false);
  });

  it("calls a port turn when the boat is to starboard of the track", () => {
    const on = destPoint(a, 90, 200);
    const boat = destPoint(on, 180, 30);
    const cue = steerCue({ ...boat, heading: 90 }, track, "cut", 25);
    assert.ok(cue);
    assert.ok(cue.xteM > 20);
    assert.ok(cue.steerDeg < -8);
    assert.equal(cue.offTrack, true);
  });

  it("open sense asks for a gentler correction than cut", () => {
    const on = destPoint(a, 90, 200);
    const boat = destPoint(on, 0, 20);
    const tight = steerCue({ ...boat, heading: 90 }, track, "cut", 0);
    const wide = steerCue({ ...boat, heading: 90 }, track, "open", 0);
    assert.ok(tight && wide);
    assert.ok(Math.abs(tight.steerDeg) > Math.abs(wide.steerDeg));
  });

  it("names the next vertex ahead on the cut", () => {
    const on = destPoint(a, 90, 80);
    assert.equal(nextVertexIndex(on, track, null), 1);
    const pastB = destPoint(b, 90, 30);
    assert.equal(nextVertexIndex(pastB, track, null), 2);
    assert.equal(nextVertexIndex(on, track, 2), 2);
    const onLinePast = destPoint(b, 90, 3);
    assert.equal(nextVertexIndex(onLinePast, track, null, 1), 2);
    const widePast = destPoint(destPoint(b, 90, 8), 180, 6);
    assert.equal(nextVertexIndex(widePast, track, null, 1), 2);
    assert.equal(nextVertexIndex(on, track, null, 2), 2);
    const rejoined = destPoint(c, 0, 15);
    assert.equal(nextVertexIndex(rejoined, track, null, 1), 2);
    assert.equal(nextVertexIndex(a, track, null, 2), 2);
  });

  it("gives range, true bearing and time at SOG", () => {
    const boat = { ...a, speedMs: 2.5 };
    const nav = markNav(boat, track, null);
    assert.ok(nav);
    assert.equal(nav.index, 1);
    assert.ok(Math.abs(nav.bearing - 90) < 4);
    assert.ok(Math.abs(nav.rangeM - 400) < 20);
    const ahead = markNav({ ...destPoint(a, 90, 50), speedMs: 2.5 }, track, null);
    assert.ok(ahead);
    assert.equal(ahead.index, 1);
    assert.ok(Math.abs(ahead.bearing - 90) < 4);
    assert.ok(Math.abs(ahead.rangeM - 350) < 20);
    assert.ok(ahead.ttgS != null && Math.abs(ahead.ttgS - 350 / 2.5) < 10);
    assert.equal(formatTtg(48), "48 s");
    assert.equal(formatTtg(null), "—");
  });

  it("prints XTE in metres with P/S for the helm", () => {
    assert.equal(formatXte(0).value, "0");
    assert.equal(formatXte(0.2).side, null);
    assert.equal(formatXte(1.2).value, "1.2S");
    assert.equal(formatXte(8.4).value, "8.4S");
    assert.equal(formatXte(8.4).unit, "m");
    assert.equal(formatXte(-12).value, "12P");
    assert.equal(formatXte(-12).unit, "m");
    assert.equal(formatXte(null).value, "—");
    assert.equal(formatXte(null).unit, "");
  });
});

describe("following a tapped route", () => {
  const a = { lat: -23.9, lng: 152.4 };
  const b = destPoint(a, 0, 300);
  const c = destPoint(b, 90, 300);
  const d = destPoint(c, 120, 200);
  const route = [a, b, c, d];

  it("moves on to the next waypoint even when a mark is passed wide", () => {
    // 30 m wide of b, already past it heading east along leg b→c.
    const past = destPoint(destPoint(b, 90, 40), 0, 30);
    assert.equal(nextVertexIndex(past, route, null, 1), 2);
  });

  it("does not skip ahead before a mark is reached", () => {
    const before = destPoint(a, 0, 150);
    assert.equal(nextVertexIndex(before, route, null, 0), 1);
  });

  it("calls the turn ahead with side, size and new course", () => {
    const boat = { ...destPoint(a, 0, 260), speedMs: 2 };
    const t = nextTurn(boat, route, 1);
    assert.ok(t && !("arrival" in t));
    assert.equal(t.index, 1);
    assert.ok(Math.abs(t.distM - 40) < 1);
    assert.ok(Math.abs(t.turnDeg - 90) < 1);
    assert.ok(Math.abs(t.newCourse - 90) < 1);
    assert.equal(t.now, false);
    const close = nextTurn({ ...destPoint(a, 0, 285), speedMs: 2 }, route, 1);
    assert.equal(close?.now, true);
    // Inside the arrival radius the guide already points at the next mark: still "turn now".
    const atMark = nextTurn({ ...destPoint(a, 0, 294), speedMs: 2, heading: 0 }, route, 2);
    assert.ok(atMark && !("arrival" in atMark) && atMark.now && atMark.index === 1);
    // Once heading down the new leg, the call moves on.
    const turned = nextTurn({ ...destPoint(a, 0, 294), speedMs: 2, heading: 85 }, route, 2);
    assert.ok(turned && turned.index === 2 && !turned.now);
  });

  it("then announces the last mark", () => {
    const t = nextTurn({ ...destPoint(c, 120, 100), speedMs: 1 }, route, 3);
    assert.ok(t && "arrival" in t);
    assert.ok(Math.abs(t.distM - 100) < 1);
  });

  it("keeps cross-track on the leg into a corner until the turn is made", () => {
    const boat = { ...destPoint(a, 0, 292), speedMs: 2, heading: 0 };
    // The guide has already counted WP2 as made (courseMark = 2), 8 m short of it.
    const leg = steerLegIndex(boat, route, 2);
    assert.equal(leg, 1);
    const cue = steerCue(boat, route, "track", 3, leg)!;
    assert.ok(Math.abs(cue.xteM) < 0.5, String(cue.xteM));
    assert.equal(cue.offTrack, false);
  });
});

describe("markLine", () => {
  it("names the next mark, leads to the start, and calls the arrival", async () => {
    const { markLine } = await import("./steer.ts");
    const { destPoint } = await import("./geo.ts");
    const a = { lat: -23.9, lng: 152.39 };
    const pts = [a, destPoint(a, 0, 200), destPoint(destPoint(a, 0, 200), 10, 200), destPoint(destPoint(destPoint(a, 0, 200), 10, 200), 60, 200)];
    const fmt = (m: number) => `${Math.round(m)} m`;
    const hdg = (d: number) => `${Math.round(d)}°`;
    const before = destPoint(a, 180, 100);
    assert.match(markLine(before, pts, 0, null, fmt, hdg), /^Head to mark 1 \(the start\): 100 m/);
    const mid = destPoint(a, 0, 100);
    const turn = nextTurn({ ...mid, speedMs: 2 }, pts, 1);
    assert.match(markLine(mid, pts, 1, turn, fmt, hdg), /^Mark 2 of 4 in 100 m · 50° starboard at mark 3/);
    const nearEnd = destPoint(pts[2]!, 60, 150);
    assert.match(markLine(nearEnd, pts, 3, nextTurn({ ...nearEnd, speedMs: 2 }, pts, 3), fmt, hdg), /^Last mark in 50 m/);
  });
});

describe("followStart", async () => {
  const { followStart } = await import("./steer.ts");
  const a = { lat: -16.9, lng: 145.9 };
  const pts = [0, 1, 2, 3, 4].map((i) => destPoint(a, 90, i * 200));
  it("at the start: forwards from mark 1", () => {
    assert.deepEqual({ ...followStart(destPoint(a, 270, 30), pts), offM: 0 }, { reverse: false, index: 0, offM: 0 });
  });
  it("at the anchorage end: suggests reversed", () => {
    const r = followStart(destPoint(pts[4]!, 0, 20), pts);
    assert.equal(r.reverse, true);
    assert.equal(r.index, 0);
  });
  it("part-way along: picks up at the mark ahead", () => {
    const r = followStart(destPoint(destPoint(a, 90, 300), 0, 15), pts);
    assert.equal(r.reverse, false);
    assert.equal(r.index, 2);
  });
  it("a closed loop is not flipped", () => {
    const loop = [...pts, destPoint(a, 0, 40)];
    assert.equal(followStart(destPoint(a, 270, 20), loop).reverse, false);
  });
  it("no boat: plain start", () => {
    assert.equal(followStart(null, pts).index, 0);
  });
});
