import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { newVoiceMemory, spokenDistance, voicePrompt, type VoiceInput } from "./voice.ts";

const base: VoiceInput = { index: 2, count: 5, toMarkM: 180, turn: null, xteM: 0, speedMs: 2, now: 0 };

describe("spoken prompts", () => {
  it("distances read naturally", () => {
    assert.equal(spokenDistance(48), "50 metres");
    assert.equal(spokenDistance(183), "180 metres");
    assert.equal(spokenDistance(1234), "1.2 kilometres");
    assert.equal(spokenDistance(2), "5 metres");
    assert.equal(spokenDistance(50, "ft"), "160 feet");
  });

  it("starts with the next mark and the turn after it", () => {
    const turn = { index: 2, distM: 180, turnDeg: -25, newCourse: 128, now: false };
    const r = voicePrompt({ ...base, turn }, newVoiceMemory());
    assert.equal(r.say, "Mark 3 in 180 metres, then 25 degrees to port.");
    assert.equal(voicePrompt({ ...base, turn }, r.mem).say, null, "not repeated");
  });

  it("before the start it leads to the start", () => {
    assert.equal(voicePrompt({ ...base, index: 0, xteM: null, toMarkM: 400 }, newVoiceMemory()).say, "Head to the start, 400 metres.");
  });

  it("warns of a turn about 30 seconds out, then calls it when due, once each", () => {
    let mem = voicePrompt(base, newVoiceMemory()).mem;
    const far = { index: 3, distM: 300, turnDeg: 40, newCourse: 200, now: false };
    assert.equal(voicePrompt({ ...base, turn: far }, mem).say, null);
    const near = { ...far, distM: 55 };
    let r = voicePrompt({ ...base, turn: near }, mem);
    assert.equal(r.say, "In 55 metres, turn 40 degrees to starboard.");
    mem = r.mem;
    assert.equal(voicePrompt({ ...base, turn: { ...near, distM: 45 } }, mem).say, null);
    r = voicePrompt({ ...base, turn: { ...near, distM: 14, now: true } }, mem);
    assert.equal(r.say, "Turn starboard now, 40 degrees, to 2 0 0.");
    assert.equal(voicePrompt({ ...base, turn: { ...near, distM: 10, now: true } }, r.mem).say, null);
  });

  it("a new mark is announced", () => {
    const mem = voicePrompt(base, newVoiceMemory()).mem;
    assert.equal(voicePrompt({ ...base, index: 3, toMarkM: 90 }, mem).say, "Mark 4 in 90 metres.");
    assert.equal(voicePrompt({ ...base, index: 4, toMarkM: 120 }, mem).say, "Mark passed. Last mark in 120 metres.");
  });

  it("off the line: said, repeated after 20 s or when worse, and back on", () => {
    let mem = voicePrompt(base, newVoiceMemory()).mem;
    let r = voicePrompt({ ...base, xteM: 8, now: 1000 }, mem);
    assert.equal(r.say, "You're 10 metres to starboard. Steer port.");
    mem = r.mem;
    assert.equal(voicePrompt({ ...base, xteM: 9, now: 5000 }, mem).say, null);
    assert.match(voicePrompt({ ...base, xteM: 14, now: 6000 }, mem).say ?? "", /15 metres to starboard/);
    assert.match(voicePrompt({ ...base, xteM: 8, now: 22_000 }, mem).say ?? "", /starboard/);
    assert.match(voicePrompt({ ...base, xteM: -6, now: 2000 }, mem).say ?? "", /to port\. Steer starboard/);
    r = voicePrompt({ ...base, xteM: 1, now: 3000 }, mem);
    assert.equal(r.say, "Back on the line.");
    assert.equal(voicePrompt({ ...base, xteM: 1, now: 4000 }, r.mem).say, null);
  });

  it("arrival once", () => {
    const mem = voicePrompt({ ...base, index: 4 }, newVoiceMemory()).mem;
    const turn = { index: 4, distM: 10, arrival: true as const, now: true };
    const r = voicePrompt({ ...base, index: 4, turn }, mem);
    assert.equal(r.say, "Arriving at the last mark.");
    assert.equal(voicePrompt({ ...base, index: 4, turn }, r.mem).say, null);
  });
});
