# AI in Anchor Mate: feature review and plan

Status: plan only. Nothing in this document is built yet.

## 1. Ground rules

- **Alarms stay deterministic.** The anchor alarm, off-track alarm, GPS-lost alarm and MOB
  stay plain, tested code that works offline and is never gated on a model. AI can *add*
  early warnings, never replace or delay the existing ones.
- **Advice, not autopilot.** Every AI output is labelled as a suggestion, shows what it is
  based on, and leaves the skipper to accept, edit or ignore it.
- **Offline first.** Anything needed at sea runs on the phone (small on-device models or
  plain maths). Cloud AI is for planning ashore or with Starlink, and the app works fully
  without it.
- **Privacy.** Positions and tracks leave the phone only when the user asks for a cloud
  feature, and the privacy policy says so. No training on users' tracks without opt-in.
- **Store rules.** Apple and Google ask apps to disclose generative AI and to filter
  output; the assistant only answers boating questions from app data and tools.

## 2. Feature review

| Area | What it does now | Gaps / where AI helps |
| --- | --- | --- |
| Anchor watch | Swing circle or drawn fence, drag + GPS-lost alarms, lock-screen GPS, Critical Alerts, remote second phone | False alarms in big wind shifts; no "where to drop" advice. Swing-pattern learning (3.4) and anchorage advisor (3.2) |
| Satellite helm | Multi-source imagery, offline packs, reef outlines, park zones, seamarks, depth contours, night mode | Reading the water is still by eye. Reef/shallows detection from imagery (3.1) |
| Reef pilotage | Tap a route on high-res imagery, or record a trail and reverse it; steer cues, cross-track, turn calls, off-track alarm | Route is only as good as the skipper's reading; no check for light/glare or tide. AI route suggestion through deep water (3.1), light check (see reef-pilotage.md) |
| Tracks | Save, share GPX, import GPX, backups | Auto-written logbook (3.6) |
| Weather | Multi-model forecast, tides, currents, moon, wind strip, offline cache | Forecasts are raw model output. Local bias correction (3.5), plain-language summary (3.3) |
| Passage planner | Isochrone routing, polars (learned), motoring rules, tide and wind-over-tide, CAPE/squall risk, sail plan, arrival, window finder, live re-routing, brief | Users must interpret a lot of numbers. Conversational planning (3.3) |
| Underway | Passage bar, re-route offline, sail reminders, % of polar, radar with closing-cell alert | Radar cell tracking is simple; nowcasting with motion (3.7) |
| Safety | MOB with drift cone and recovery steps | Voice control and spoken prompts (3.8) |

## 3. AI features, ranked by value to the skipper

### 3.1 Reef reader and "suggest a safe track" (highest value)

The app's core promise is getting into a new reef anchorage safely using satellite imagery.

- **What:** an on-device model labels each satellite pixel as deep water, sand/shallow,
  coral/rock, or land (plus "unsure"). The chart shades hazards; the skipper taps
  start and anchorage and the app proposes a track through the deepest water, keeping a
  chosen margin from coral, with corners the helm can actually steer. The skipper edits
  it like any tapped route.
- **How:** a small segmentation model (for example a MobileNet/U-Net in the 2–10 MB range)
  run with TensorFlow Lite on Android and Core ML on iOS through a Capacitor plugin, on
  the offline tiles already cached for the reef. Training labels: the **Allen Coral Atlas**
  geomorphic and benthic maps (CC BY 4.0) and GBRMPA reef outlines, matched to the imagery
  sources the app is licensed to use. The route search is plain A* on the hazard grid with
  a cost for nearness to coral and for turns: no AI needed there.
- **Limits to state:** imagery can be years old, cloud, glare and turbid water fool it,
  and it can't see depth precisely. "Suggested track: check every leg by eye."
- **Effort:** 6–10 weeks (data prep, training, native plugins, UI), plus device testing.

### 3.2 Anchorage advisor

- **What:** for a chosen bay: where to drop (sand, depth, room to swing), expected swing
  overnight with the forecast wind shift, shelter by direction, park-zone rules, and
  "move before 3 am when the wind backs NE".
- **How:** mostly existing data (shelter from the coastline, forecast, park zones,
  bottom type from the Allen Coral Atlas) combined by rules; a language model only
  writes the explanation. Works offline except the explanation.
- **Effort:** 2–3 weeks.

### 3.3 Skipper's assistant (chat and voice, planning ashore)

- **What:** "Best day this week to go from Lady Musgrave to Pancake Creek, family crew,
  no beating?" The assistant runs the planner and window finder and explains the answer
  in plain words, with the normal results screen to check.
- **How:** Claude through a small Anchor Mate server (API keys can't live in the app).
  The app exposes its own functions as tools: plan a passage, find windows, read the
  forecast at a point, list saved tracks. The model calls tools rather than guessing
  numbers. Use a fast, low-cost model (for example `claude-haiku-5-5`) for most questions
  and a stronger one (`claude-sonnet-5-5`) for briefs; cache the fixed instructions to cut
  cost. Rate limit per subscriber.
- **Also:** a plain-language passage brief written from the structured brief data, and
  a "what changed?" note when live re-routing finds a new forecast.
- **Effort:** 3–4 weeks including the server, plus ongoing API cost (budget it into the
  subscription price, or a higher tier).

### 3.4 Smarter anchor watch (on-device, no cloud)

- **What:** learn the boat's normal swing (arc, period, response to wind) in the first
  half hour, then flag *unusual* movement earlier than the radius alarm: a steady creep
  downwind, or a jump outside the learned arc while still inside the circle. The radius
  alarm stays as the hard backstop.
- **How:** plain statistics on the swing trail (circle fit, drift trend, comparison with
  the forecast wind shift). Fully testable, small, offline.
- **Effort:** 2 weeks plus a season of real-boat testing before it's on by default.

### 3.5 Local forecast correction

- **What:** compare the forecast with what the boat actually saw (instrument wind once
  NMEA lands, BOM observations nearby) and adjust the next hours: "models have been 4 kn
  light here today".
- **How:** a simple per-location bias model, on device. Feeds the planner as a model option.
- **Effort:** 2 weeks after instrument input (phase I).

### 3.6 Auto logbook

- **What:** each passage or night at anchor becomes a log entry: route, times, wind and
  sea seen, sails, engine hours, events (alarms, MOB, reefs). One-tap share or export.
- **How:** written from app data; optional language-model polish when online.
- **Effort:** 1–2 weeks.

### 3.7 Squall nowcasting

- **What:** extend the radar cell alert with cell motion and growth (optical flow across
  frames) and a 30–60 min projection drawn on the chart.
- **How:** on-device image maths on the radar tiles already fetched; no cloud model.
- **Effort:** 2 weeks, needs the radar licence first.

### 3.8 Voice at the helm

- **What:** spoken turn calls ("in 50 metres, starboard to 090"), spoken alarms, and
  voice commands with wet hands: "man overboard", "distance to next mark", "mark here".
- **How:** on-device speech (iOS and Android speech APIs through a plugin). Works offline.
- **Effort:** 1–2 weeks.

## 4. Architecture

- **On device:** TFLite / Core ML plugin for the reef model; everything else is plain code.
  Models ship with the app or download once per region.
- **Server (small):** authenticates the RevenueCat subscriber, holds the AI provider key,
  runs the assistant with tool calls back to the app's own planner (or a server copy of
  it), rate-limits, logs no positions beyond the request. The same server is needed for
  the satellite forecast top-ups (plan 12.1), so build it once.
- **Pricing:** on-device features in the normal subscription; the cloud assistant either
  included with a monthly cap or in a higher tier.

## 5. Phases

1. **Voice helm + auto logbook** (3.8, 3.6): quick, offline, no new data. 3–4 weeks.
2. **Anchorage advisor + smarter anchor watch** (3.2, 3.4). 4–5 weeks plus sea testing.
3. **Server + skipper's assistant** (3.3), shared with satellite top-ups. 4–5 weeks.
4. **Reef reader + suggested tracks** (3.1). 6–10 weeks; the biggest differentiator.
5. **Forecast correction + squall nowcasting** (3.5, 3.7), after instruments and the radar licence.

## 6. Risks

- Over-trust: a confident wrong AI track into coral is the worst outcome. Mitigate with
  "unsure" shading, mandatory review of each leg, and never auto-following a suggestion.
- Imagery licences: training and on-device inference must use imagery the app may use
  commercially (see imagery.ts licensing switches).
- Cost: cloud model calls per subscriber per month; cap and cache.
- Battery: run the reef model once per tile set, not continuously.
