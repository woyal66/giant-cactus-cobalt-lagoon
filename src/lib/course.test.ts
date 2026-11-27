import { test } from "node:test";
import assert from "node:assert/strict";
import { courseFromFixes, type CourseRef } from "./course.ts";
import { destPoint } from "./geo.ts";

test("course and speed from movement", () => {
  const a = { lat: -23.9, lng: 152.39 };
  let ref: CourseRef | null = courseFromFixes(null, { ...a, at: 0, accuracy: 5 });
  // 4 m/s on 135°, a fix a second.
  for (let i = 1; i <= 5; i++) ref = courseFromFixes(ref, { ...destPoint(a, 135, 4 * i), at: i * 1000, accuracy: 5 });
  assert.ok(Math.abs(ref!.headingDeg! - 135) < 1, `heading ${ref!.headingDeg}`);
  assert.ok(Math.abs(ref!.speedMs - 4) < 0.1, `speed ${ref!.speedMs}`);
});

test("GPS wander while still does not set a course", () => {
  const a = { lat: -23.9, lng: 152.39 };
  let ref = courseFromFixes(null, { ...a, at: 0, accuracy: 8 });
  for (let i = 1; i <= 10; i++) ref = courseFromFixes(ref, { ...destPoint(a, i * 70, 2), at: i * 1000, accuracy: 8 });
  assert.equal(ref.headingDeg, null);
  assert.equal(ref.speedMs, 0);
  // After 15 s still, speed reads 0 and the last course is kept.
  const moving = courseFromFixes(ref, { ...destPoint(a, 90, 20), at: 12_000, accuracy: 8 });
  const still = courseFromFixes(moving, { ...destPoint(a, 90, 21), at: 30_000, accuracy: 8 });
  assert.equal(still.speedMs, 0);
  assert.ok(Math.abs(still.headingDeg! - 90) < 2);
});
