import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMessage, isTopic, newTopic, ntfyAppUrl, remoteEvents, subscribeUrl } from "./remote-watch.ts";

test("topics are long, random and valid", () => {
  const t = newTopic();
  assert.ok(isTopic(t), t);
  assert.notEqual(newTopic(), t);
  assert.equal(isTopic("anchormate-short"), false);
  assert.equal(subscribeUrl(t), `https://ntfy.sh/${t}`);
  assert.equal(ntfyAppUrl(t), `ntfy://ntfy.sh/${t}`);
});

test("alarms go out at max priority with a map link", () => {
  const m = buildMessage("anchormate-abcdefghijkmnpqrstuv", "drag", {
    boatName: "Saltwater",
    place: "Lady Musgrave",
    outsideText: "27 m outside",
    boat: { lat: -23.9, lng: 152.39 },
  });
  assert.equal(m.priority, 5);
  assert.match(m.title, /ANCHOR DRAGGING: Saltwater/);
  assert.match(m.message, /27 m outside the swing circle at Lady Musgrave/);
  assert.equal(m.click, "https://maps.google.com/?q=-23.90000,152.39000");
  assert.equal(buildMessage("t", "stop", {}).priority, 2);
});

test("events fire on changes only", () => {
  const off = { watching: false, drag: false, gps: false, mob: false };
  const on = { ...off, watching: true };
  assert.deepEqual(remoteEvents(off, on), ["start"]);
  assert.deepEqual(remoteEvents(on, on), []);
  assert.deepEqual(remoteEvents(on, { ...on, drag: true }), ["drag"]);
  assert.deepEqual(remoteEvents({ ...on, drag: true }, on), ["clear"]);
  assert.deepEqual(remoteEvents({ ...on, drag: true }, off), ["stop"]);
  assert.deepEqual(remoteEvents(on, { ...on, mob: true }), ["mob"]);
});
