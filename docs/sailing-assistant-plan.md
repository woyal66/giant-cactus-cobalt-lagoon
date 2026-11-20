# Anchor Mate Passage: the professional sailing assistant (plan)

One tool that helps a skipper **before** a passage (when to go, which way, what to expect on
arrival, which sails) and **during** it (is the plan still right, what's coming in the next three
hours, when to change sail, squall watch).

Status: plan. The routing engine, departure table, tide and current physics, wind-over-tide seas,
motoring rules, GPX import and export, and Follow mode are already built (see
`docs/passage-planner-plan.md`). This plan builds on them.

Independence: this is Anchor Mate's own design, built on public weather data and its own code.
Other products are named below only as an internal benchmark. Their names don't appear in the app or marketing.

---

## 1. What the market leader offers, and where we can do better

| They have | What they do | How Anchor Mate does better |
| --- | --- | --- |
| Weather routing, departure planning and a destination forecast as **separate tools** | You choose the day in one tool, route in another, and check the destination in a third. | **One Passage screen**: Departures → Route → Arrival in one flow, with the same settings throughout. |
| CAPE, lightning and squall **warnings** | Warnings show on route maps and tables. Thunderstorm warnings depend on temperature: CAPE ≥1000 J/kg below 20 °C, ≥2000 for 20–30 °C, ≥3000 above 30 °C. Lightning warns on any strike, and a rain squall is ≥3 mm/h with gusts ≥25 kn. | **Storms can change the route**: a storm and squall risk score steers it (avoid, penalise or warn only, your choice), not just a warning icon. |
| Sail crossover charts | Sail choice by **true** wind angle and speed only. They say they don't plan to show apparent wind. | **True and apparent wind** on one graph along the route, plus a sail plan built from **your** sail inventory using apparent wind, which is what you trim to on deck. |
| Comfort mode | Avoids wind over 25 kn and swell over 2.5 m (defaults). | Comfort that includes **wind-over-tide steepening** (built), beam-sea rolling, upwind hours, and night arrival at reef passes. |
| Global routing | Strong offshore. | **Reef-aware coastal sailing**: reef outlines, passes as gates, daylight and tide windows at passes, and an anchorage-exposure check on arrival. |

## 2. The Passage screen (one flow)

```
Route ▸ tap start, tap finish ▸ [Settings]
   ├─ 1. DEPARTURES  table of departure times: green / amber / red, arrival, hours, peak wind,
   │                 seas, tide help, storm risk, model agreement. "Best for: Safety | Speed | Comfort"
   ├─ 2. ROUTE       the chosen plan on the chart, plus a timeline:
   │                 wind graph (TWS/AWS, TWA/AWA), seas, current, storm risk, sail plan, warnings
   ├─ 3. ARRIVAL     destination forecast: ±12 h around ETA, tide at arrival, daylight and moon,
   │                 the night's wind shift and anchorage exposure, "best side of the island tonight"
   └─ 4. SAIL IT     Follow: steering cues, next-3-hours strip, sail change reminders,
                     "behind plan" and squall alerts, re-route from here
```

Each step is one tap from the next. Defaults are good enough that a casual sailor taps start,
finish and Go; a professional opens Settings and tunes everything.

## 3. Weather Routing Settings (one page, with presets)

**Presets**: *Family cruising* (cautious), *Delivery* (efficient, tolerant), *Racing* (fastest,
warnings only), *Custom*. Every setting below can be changed and is remembered.

| Group | Settings |
| --- | --- |
| **Boat** | Type and length (built), polar file import (`.pol` / CSV), **sail inventory** (main with reef 1–3, genoa or jib with furl %, staysail, code zero, asymmetric or symmetric spinnaker) with each sail's apparent-wind range |
| **Limits** | Max wind, max gust, max sea height (built), shortest acceptable wave period, max wind-over-tide steepness, max true wind angle for long upwind legs |
| **Motoring** | Motor below a boat speed, motor below a wind speed, motoring speed, wind on the nose: tack or motor (all built), fuel range in hours |
| **Storms and squalls** | For each of *thunderstorms (CAPE)*, *rain squalls*, *lightning*: **Avoid** (route around), **Penalise** (prefer to avoid), **Warn only**, or **Ignore**. Advanced: CAPE thresholds by temperature (the industry defaults above), lifted index, squall rain and gust thresholds |
| **Tide and current** | Use currents (built), wind over tide: avoid, penalise or warn (penalised now), prefer a fair tide through passes |
| **Daylight and passes** | No arrival or pass transit in the dark (off / warn / avoid), sun behind you through reef passes, minimum depth under keel at a bar (needs charted depth) |
| **Comfort weighting** | A slider from Speed to Comfort, plus beam seas, upwind hours and motion sensitivity (crew experience) |
| **Models** | ECMWF and GFS (built), plus ICON and UKMO. Spread between models shows as confidence |

## 4. Storm and squall risk (CAPE, lightning, squalls)

**Data (per grid point, hourly):** CAPE, lifted index, convective inhibition, precipitation,
gusts, temperature, and weather code (95–99 = thunderstorm). Open-Meteo serves CAPE and lifted index for GFS,
and CAPE for ECMWF. Inhibition depends on the model. Forecast **lightning potential is only available
for Europe (ICON-D2)**, so in Australia lightning risk is estimated from the convective fields.

**Risk score (0–3) per point and hour:**

- **0 (none)**: CAPE below the temperature threshold and no thunderstorm code.
- **1 (possible)**: CAPE above the threshold, *or* lifted index ≤ −3 with showers forecast.
- **2 (likely)**: CAPE ≥ 1.5× the threshold *and* (precipitation ≥ 1 mm/h *or* thunderstorm code), *or* a rain squall
  (≥3 mm/h with gusts ≥25 kn).
- **3 (severe)**: thunderstorm code with gusts ≥ 35 kn, or CAPE ≥ 2500 with lifted index ≤ −6.
- **Inhibition** ≥ 200 J/kg lowers the score by 1: a strong cap holds storms back.

The score feeds the router through the existing per-step cost:
**Avoid** = steps scoring ≥2 are forbidden. **Penalise** = cost rises with the score. **Warn** = shown
on the timeline only. The timeline shows a lightning-bolt band where the score is ≥2, and the map
can show a storm overlay.

**Squall reality check:** squalls are small and short-lived, and models place them poorly. The app
says so: "Squalls possible 14:00–18:00 in this area: reef early, watch the sky and radar."

**Live lightning (during the sail, later):** real-time strikes within X nm need a licensed feed.
Blitzortung is free for non-commercial use only. Commercial options include Xweather/Vaisala and
Global Lightning Network. This would be an add-on to the remote-watch alerts.

## 5. Wind graph: true and apparent wind along the route

For every point on the route, from the forecast and the boat's own speed:

- **True wind** (over the water, current-corrected; built): TWS and TWA.
- **Apparent wind** from the wind triangle with the boat's predicted speed through the water *V*:
  `AWS = √(TWS² + V² + 2·TWS·V·cos TWA)`,
  `AWA = acos((TWS·cos TWA + V) / AWS)`.
  Apparent wind is what the instruments and the crew feel, and what sail ranges are set by.

**The graph** (time along the bottom, scrubbable, with a marker that moves the boat on the chart):

1. **Wind speed band**: TWS line, AWS line and gust shading, with your wind limit as a dashed line.
2. **Wind angle band**: TWA and AWA lines from 0° to 180°, coloured by point of sail: upwind (≤55° TWA),
   reaching (55–135°), downwind (≥135°), matching the industry definitions. Port and starboard are shown by side.
3. **Sea band**: sea height (after wind over tide) and period, and current help or hindrance.
4. **Storm band**: the storm and squall risk score.
5. **Sail plan band**: which sails, from your inventory, for each stretch, with change times.

**Sail plan:** each sail in the inventory has an apparent-wind angle range and an apparent wind speed
range (templates from typical sailmaker ranges, for example a code zero for light air on a close reach,
and asymmetric spinnakers by angle). Reefs come from apparent wind speed. The plan merges stretches
shorter than 30 minutes so you aren't told to change sail every 10 minutes, and lists changes:
*"14:20 reef 1 (AWS 22 kn) · 17:40 furl genoa to 70% · 21:00 shake out, code zero (AWA 60°, AWS 9 kn)."*
Day or night is shown on every change, because night sail changes need more care.

## 6. Arrival (destination forecast)

- **Wind, gust, sea and rain** for 12 hours either side of the ETA at the destination, plus the **night
  after arrival** (anchorage holding check).
- **Tide** at arrival (BOM station tide where available, built) and the next high and low water.
- **Light**: sunset, sunrise and moon (built). "Arrive 40 min before sunset with the sun behind you."
- **Anchorage exposure**: from the night's wind direction and the coastline around the finish
  (already rasterised for routing), which sides are open to the wind, and "a 20 kn SE change
  at 02:00 makes this side exposed. Consider the NW side."
- One tap: **"Set the anchor watch here"** when you arrive, using the anchor watch that's built.

## 7. During the sail

- **Next 3 hours strip** on the chart: wind, angle, sea, current and squall risk ahead along the route.
- **On-plan check**: compare GPS speed and position with the plan, and say "38 min behind plan". Offer
  **Re-route from here** with the same settings (uses the cached forecast, so it works offline).
- **Sail change reminders** at the planned times, and when the live data has drifted from the plan.
- **Forecast vs actual**: with an instrument feed (NMEA 0183/2000 over Wi-Fi), log real wind
  against the forecast, warn when the forecast is clearly off, and learn the boat's real polar over time.
- **Squall watch**: alerts when the storm risk ahead rises in a newer forecast, plus live lightning later.
- **Remote watch** (built) shares the position and alerts with someone ashore or below.
- **Passage log**: automatic log entries for position, speed, wind, sail changes and warnings, exportable.

## 8. Before the sail: passage brief

A one-page brief to share with crew or a shore contact (PDF or link): route map, departure and ETA,
weather summary by stretch, tide gates, storm risk, sail plan, hazards (reefs near the route,
night stretches), bail-out anchorages along the way, and the model-agreement note.

## 9. Data sources and licences

| Data | Source | Commercial use |
| --- | --- | --- |
| Wind, gust, CAPE, lifted index, precipitation, weather code | Open-Meteo (ECMWF, GFS, ICON, UKMO) | Commercial plan (already needed) |
| Waves (height, period, direction), currents including tides | Open-Meteo Marine / Météo-France SMOC | Same plan |
| Station tides | BOM | Data licence (already flagged) |
| Coastline | Natural Earth (bundled) | Public domain |
| Reef outlines for avoidance | GBRMPA features (CC BY), loaded into the phone | Free with credit |
| Live lightning (optional) | Xweather/Vaisala, Global Lightning Network (Blitzortung is non-commercial only) | Paid licence |
| Own forecast pipeline (later) | ECMWF Open Data, NOAA GFS | Free for commercial use |

## 10. Build phases

| Phase | Scope | Rough effort |
| --- | --- | --- |
| **A. Settings page and presets** | All of section 3 except sail inventory and polar import; move today's planner choices there | 3–4 days |
| **B. Storm and squall risk** | Fetch CAPE, lifted index, precipitation and weather code; risk score; Avoid/Penalise/Warn in the router; timeline band; warnings | 1 week |
| **C. Wind graph (true and apparent)** | The apparent wind calculation, a scrubbable timeline with wind, angle, sea, current and storm bands, linked to the chart | 1 week |
| **D. Sail inventory and sail plan** | Sail list with templates, crossover by apparent wind, merged change list, reminders | 1 week |
| **E. Arrival tab** | Destination forecast, tide, light, anchorage exposure, set anchor watch | 1 week |
| **F. During-the-sail tools** | Next-3-hours strip, on-plan check, re-route from here, sail-change reminders, passage log | 1.5–2 weeks |
| **G. Passage brief** | Shareable one-pager (PDF) | 3–4 days |
| **H. Reef avoidance** | GBRMPA reef polygons loaded into the phone as obstacles with a safety margin | 1 week |
| **I. Instruments and learned polars** | NMEA over Wi-Fi, forecast vs actual, polar learning | 3–4 weeks |
| **J. Live lightning** | Licensed feed and alerts | 1 week plus the licence |
| **K. Offline passage forecast** | "Save this passage offline", forecast age everywhere, offline re-route (12.1, first tier) | 4–5 days |
| **L. Satellite top-ups** | Server-built tiny forecasts for low-bandwidth data and text messengers, plus a decoder (12.1) | 2 weeks plus the server |
| **M. MOB recovery guide** | Drift cone from current and leeway, bearing to predicted position, recovery prompts, Mayday position card (12.2) | 1 week plus safety review |
| **N. Weather window finder** | 10-day scan, best windows, suitability strip, window alert (12.3) | 1 week |
| **O. Live re-routing** | New-run detection, meaningful-change rules, accept or keep banner (12.4) | 1 week |
| **P. Squall radar overlay** | BOM (licensed) or alternative radar, loop, closing-cell alert (12.5) | 1 week plus the licence |
| **Q. Speed vs polar** | % of polar live and per leg, diagnosis hints, learned polar (12.6, works with phase I) | 1–1.5 weeks |

Recommended order: **A → B → C → K → M → N → D → E → H → O → F → G**, then P, Q, I, L, J.
- **First (A–C):** turn the planner into a proper pre-departure tool.
- **K:** makes everything work offshore without signal.
- **M:** a cheap, high-value safety feature on top of the existing MOB mark.
- **N and O:** make the forecast work for you before and during the trip.
- **H:** the most important item for reef safety.
- **P, L and J:** depend on data licences or the server, so they come once those are in place.

## 11. Honest limits to state in the app

- Global models miss squalls, sea breezes and wind bending around headlands. Storm risk is "possible", not "will".
- Currents are about 8 km detail and miss narrow passages. Tidal streams in a pass can be far stronger.
- Built-in polars and sail ranges are templates. Results improve with the boat's own polar and sails.
- Routes are planning aids. The skipper checks charts, keeps a lookout and decides.

## 12. Additions (agreed)

### 12.1 Offline and satellite weather

Offshore there's no mobile signal, so the plan has to keep working without it.

- **Download before leaving (default).** "Save this passage offline" stores the whole forecast for the
  corridor and the departure window, covering every model plus waves, currents and storm fields, with a
  margin for delays. The router, the timeline, re-routing from your position and the arrival forecast
  then all work with no signal. The saved forecast's age shows everywhere ("forecast from 06:00, 9 h old").
- **Top-up by satellite.** Three tiers, by what the boat carries:
  - **Starlink or other internet.** Normal download, but compressed: the app only asks for the
    corridor ahead of the boat for the next 48 h, so a full update costs about 50–150 KB.
  - **Low-bandwidth data (Iridium GO!, satellite phones).** A *tiny forecast*: a few points along the
    route, every 3 h, with wind, gust, sea, current and storm score, packed into a compact binary
    format (a few KB). It needs a small Anchor Mate server that builds the packet from the
    route the app uploads.
  - **Text messengers (Garmin inReach and similar, about 160 characters per message).** An
    email or SMS request to that server, answered by a coded text of a few points, for example
    `T0 12/135 G18 S1.2/6 C+0.4 R0|T3 15/140 G21 S1.5/6 C-0.2 R1|…`. The app decodes a pasted reply.
    Garmin also offers its own weather, and the app reads ours alongside it.
- **Limits:** the satellite tiers need the Anchor Mate server (phase 3 in the planner plan) and an
  account, so they suit the Pro + Passage tier. Messenger airtime is the user's own.

### 12.2 Man-overboard recovery guide

The MOB mark is already built. This turns it into a recovery tool.

- **Drift prediction.** A person in the water moves almost entirely with the **current** (from the
  saved or live forecast) plus a small **wind leeway**: roughly a few percent of the wind speed, from
  published search-and-rescue leeway tables, to be calibrated before release. The chart shows where
  they're likely to be at +5, +10 and +20 minutes, as a cone that widens with uncertainty, and
  the bearing and distance to the *predicted* position, not the original mark.
- **Recovery prompts.** Big-button, step-by-step prompts: *shout, point, throw*; recommended manoeuvre
  by situation (Williamson turn at night or in poor visibility when going back down your own track
  matters; quick-stop under sail in daylight); time since MOB; "call Mayday on VHF 16 / DSC distress"
  with the position read out in large type for the radio call.
- **Alerts.** Remote watch (built) sends an MOB alert with the position, and the drift cone updates with it.
- **Limits:** drift is an estimate. The prompts support training and don't replace it. Wording to be
  reviewed against current safety-at-sea guidance before release.

### 12.3 Weather window finder

- **What:** for a saved passage (or start and finish), look **up to 10 days ahead** and find the best
  windows against your limits and settings, not only inside a window you picked.
- **How:** scan departures every 3 h over the forecast range with a fast first pass (straight-line plus
  tacking estimate per departure, about a millisecond each), then fully route the best 5–8 candidates
  with all three plans. Forecast confidence falls after day 5, so later windows show a
  lower confidence (ensemble spread where available).
- **Output:** a 10-day strip coloured by suitability, the best windows listed ("Sat 06:00–14:00 ★ best,
  Tue 18:00 good, Thu: front, avoid"), and the "Should I go?" verdict. Tapping a window opens it in the Passage screen.
- **Optional alert:** "Tell me when a good window opens for this passage", which re-checks after each
  new model run (uses 12.4).

### 12.4 Live re-routing on new forecasts

- **What:** while a plan is active (before leaving or under way), check for a newer model run every
  6–12 h, re-route quietly from the boat's current position, and **only speak up when something
  meaningful changes**.
- **"Meaningful" means:** ETA moves more than 30 min (or 10%), a limit is now exceeded, storm risk rises
  to likely or severe, the route shape moves more than a set distance, or the best departure changes.
  Small changes are logged, not announced.
- **How:** the cached forecast is replaced by the new run (or a satellite top-up, 12.1). The worker
  re-plans from the live position. A banner shows the change with **Accept new route / Keep current**,
  and a reason ("new ECMWF run: SE change 3 h earlier").
- **Background:** on the phone this needs background fetch (iOS limits how often it runs) or runs when
  the app is open. During a passage the app is usually open with GPS running, so it works.

### 12.5 Squall radar overlay

- **What:** real-time rain radar on the chart near the coast, showing where squalls actually are,
  with loop playback of the last hour and direction of travel, so you can see which way a cell is heading.
- **Source:** the **Bureau of Meteorology radar network** covers the Australian coast (about
  250 km range per radar). BOM's radar imagery is copyright, and commercial use in an app needs a BOM
  data licence or service agreement, so add this to the BOM licensing request already in STORE-RELEASE.
  Alternatives with commercial licences: RainViewer (global composite) and Xweather.
- **Squall alert:** if a radar cell is moving toward the boat (within X nm and closing), alert
  "Squall 6 nm SW, closing, about 25 min". Reef early.
- **Limits:** coastal only (radar range), and offshore falls back to the model storm risk (section 4).
  Radar needs a connection (Starlink offshore, or mobile signal near the coast).

### 12.6 Speed versus polar (performance monitor)

- **What:** compare the boat's live speed with what its polar predicts for the current wind and angle,
  as **% of polar**, live and averaged per leg.
- **Wind source:** instrument wind over NMEA (best, phase I), or else the forecast wind at the boat's
  position and time (good enough for trends, not for trim).
- **Insights:**
  - consistently 10–15% under in all conditions: hull or prop fouling, or the polar is optimistic;
  - under only upwind: trim or sails;
  - under at specific angles: wrong sail for that angle (ties into the sail plan);
  - over polar: the polar is pessimistic.
- **Learning:** clean samples (sailing, no motor, steady wind, not tacking) tune the boat's own polar
  over time, which makes every future route more accurate. Learned and built-in polars are
  shown side by side and the user chooses which to use.
- **Privacy:** all on the phone, included in backups.

## Sources

- PredictWind help: [extreme weather warnings](https://help.predictwind.com/en/articles/6462127-what-are-extreme-weather-warnings), [what CAPE means](https://help.predictwind.com/en/articles/2884586-what-does-cape-mean), [severe weather indicators](https://predictwind.com/news/blogs/indicators-predicting-severe-weather), [sail crossover charts](https://help.predictwind.com/en/articles/11742413-weather-routing-how-to-use-sail-crossover-charts), [why TWA not AWA](https://help.predictwind.com/en/articles/15298635-why-predictwind-uses-true-wind-angle-twa-instead-of-apparent-wind-angle-awa), [interpreting sail routing results](https://help.predictwind.com/en/articles/2884533-how-to-interpret-the-sail-routing-results), [routing settings](https://help.predictwind.com/en/articles/2884622-weather-routing-change-weather-routing-settings), [departure planning settings](https://help.predictwind.com/en/articles/2884625-how-to-change-departure-planning-settings)
- Other routers' motoring rules: [LuckGRIB](https://routing.luckgrib.com/manual/settings/motor-or-not.html), [TimeZero](https://userguide.mytimezero.com/tz-navigator/Options_Routing.htm), [Weather4D](https://www.weather4d.com/?p=7142)
- Convective indices: [NWS severe parameters](https://www.weather.gov/akq/SevereParameters), [Penn State on CAPE](https://courses.ems.psu.edu/meteo361/node/2013), [meteoblue air motion](https://content.meteoblue.com/en/research-education/specifications/weather-variables/air-motion/), [NOAA JetStream](https://www.noaa.gov/jetstream/upperair/severe-weather)
- Data: [Open-Meteo GFS](https://open-meteo.com/en/docs/gfs-api), [Open-Meteo ECMWF](https://open-meteo.com/en/docs/ecmwf-api), [Open-Meteo DWD (lightning potential)](https://open-meteo.com/en/docs/dwd-api), [Open-Meteo marine](https://open-meteo.com/en/docs/marine-weather-api), [SMOC currents with tides](https://ui.adsabs.harvard.edu/abs/2019EGUGA..21.2376D/abstract)
- Sails: [Quantum headsail options](https://www.quantumsails.com/en/resources-and-expertise/articles/the-lowdown-on-headsail-options), [Cruising World off-wind sails](https://www.cruisingworld.com/story/gear/off-wind-sails-for-cruising/), [asymmetric spinnaker ranges](https://encountercrewmanual.readthedocs.io/en/latest/060_sails/0020_asymmetric_spinnakers/)
- Wave–current physics: [SWAN on ambient currents](https://swanmodel.sourceforge.io/online_doc/swantech/node24.html), [opposing currents and wave height](https://arxiv.org/pdf/2101.03439)
