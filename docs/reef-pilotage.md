# Reef pilotage: plan a track on satellite, follow it in

Goal: before arriving at an unfamiliar reef, plan a safe track to the anchorage on high-res
satellite imagery; on arrival, load it and be guided in (and back out).

## How it works now

1. **Plan:** Draw mode, tap waypoints on the satellite chart (save offline tiles for the
   reef first). Every tapped waypoint is kept exactly as tapped. Waypoints within 1 m
   (double taps) are dropped.
2. **Or record:** record a trail on the way in; Save or "Back out" reverses it for the exit.
   Recorded trails are cleaned: fixes worse than 15 m accuracy and drift while stopped are
   skipped, GPS wobble is smoothed (±5 m), and one waypoint is kept per real corner.
3. **Follow:** from Tracks. The steering bar shows SOG, cross-track (metres, port or
   starboard), course to steer (with current allowance), and a steer arrow in heading-up.
   Steer sense: Cut (2 m), Track, or Open.
4. **Turn calls:** "In 40 m: turn 90° starboard to 090°", then "Turn starboard now"
   (green for starboard, red for port) with a haptic buzz, then "Last mark in 100 m".
   "Now" is about 10 s at boat speed and never less than 15 m.
5. **Marks advance by themselves:** a mark counts as made within 12 m, or as soon as the
   boat is further along the route than it, so passing wide still moves on. Passed marks
   never rewind; a mark can be pinned to steer for it specifically.
6. **Off-track alarm:** optional, 1–5 m. Cross-track and the alarm stay measured on the
   leg into a corner until the turn is made, so neither cuts the corner nor false-alarms.

## Changed in this review

- Jagged recorded tracks: caused by keeping every 30° "turn" between fixes 2 m apart,
  which GPS wobble produces constantly. Fixed (filtering, smoothing, baseline turns).
- Tapped routes were run through the same simplifier at save, which could silently drop
  a gentle dog-leg tapped on purpose. Fixed: tapped routes are never simplified.
- No warning before a turn. Added turn calls and haptics.
- 8–12 m before each corner the cues jumped to the next leg: cross-track read up to 12 m
  off, the course to steer pointed diagonally across the corner, and a tight off-track
  alarm could sound. Fixed.

## Suggested next steps

1. **Light check:** reading coral needs the sun high and behind you. For each leg at the
   planned time, warn "sun ahead on leg 3 after 15:30, glare" and suggest an entry
   window. Cheap: sun position is already computed offline.
2. **Hazard check on the route:** warn when a leg passes within X m of a mapped reef
   outline (needs the reef polygon data, phase H) and, later, the AI reef reader
   (docs/ai-plan.md 3.1).
3. **Waypoint notes:** "bommie 10 m to port", "keep the white sand on starboard", shown
   in the turn call as the mark comes up.
4. **Corridor width per leg:** draw the safe width on the chart (for example 20 m) and
   set the off-track alarm to half of it automatically.
5. **Spoken turn calls:** so the helm can watch the water (docs/ai-plan.md 3.8).
6. **Rehearse:** a fly-through of the track on the offline tiles before arriving, at
   boat speed, with the same turn calls.
7. **Tide note:** each saved track can carry "least depth seen 2.1 m at LAT+1.2" from
   the recording (needs a depth sounder over NMEA).
8. **Share a reef track** with other users of the app (library), with date and boat draft.
