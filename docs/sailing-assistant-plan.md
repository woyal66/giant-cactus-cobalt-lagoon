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

Recommended order: **A → B → C → D → E → H → F → G**, then I and J. A to E turn the planner into a
full pre-departure tool. H matters most for reef safety. F turns it into a passage companion.

## 11. Honest limits to state in the app

- Global models miss squalls, sea breezes and wind bending around headlands. Storm risk is "possible", not "will".
- Currents are about 8 km detail and miss narrow passages. Tidal streams in a pass can be far stronger.
- Built-in polars and sail ranges are templates. Results improve with the boat's own polar and sails.
- Routes are planning aids. The skipper checks charts, keeps a lookout and decides.

## Sources

- PredictWind help: [extreme weather warnings](https://help.predictwind.com/en/articles/6462127-what-are-extreme-weather-warnings), [what CAPE means](https://help.predictwind.com/en/articles/2884586-what-does-cape-mean), [severe weather indicators](https://predictwind.com/news/blogs/indicators-predicting-severe-weather), [sail crossover charts](https://help.predictwind.com/en/articles/11742413-weather-routing-how-to-use-sail-crossover-charts), [why TWA not AWA](https://help.predictwind.com/en/articles/15298635-why-predictwind-uses-true-wind-angle-twa-instead-of-apparent-wind-angle-awa), [interpreting sail routing results](https://help.predictwind.com/en/articles/2884533-how-to-interpret-the-sail-routing-results), [routing settings](https://help.predictwind.com/en/articles/2884622-weather-routing-change-weather-routing-settings), [departure planning settings](https://help.predictwind.com/en/articles/2884625-how-to-change-departure-planning-settings)
- Other routers' motoring rules: [LuckGRIB](https://routing.luckgrib.com/manual/settings/motor-or-not.html), [TimeZero](https://userguide.mytimezero.com/tz-navigator/Options_Routing.htm), [Weather4D](https://www.weather4d.com/?p=7142)
- Convective indices: [NWS severe parameters](https://www.weather.gov/akq/SevereParameters), [Penn State on CAPE](https://courses.ems.psu.edu/meteo361/node/2013), [meteoblue air motion](https://content.meteoblue.com/en/research-education/specifications/weather-variables/air-motion/), [NOAA JetStream](https://www.noaa.gov/jetstream/upperair/severe-weather)
- Data: [Open-Meteo GFS](https://open-meteo.com/en/docs/gfs-api), [Open-Meteo ECMWF](https://open-meteo.com/en/docs/ecmwf-api), [Open-Meteo DWD (lightning potential)](https://open-meteo.com/en/docs/dwd-api), [Open-Meteo marine](https://open-meteo.com/en/docs/marine-weather-api), [SMOC currents with tides](https://ui.adsabs.harvard.edu/abs/2019EGUGA..21.2376D/abstract)
- Sails: [Quantum headsail options](https://www.quantumsails.com/en/resources-and-expertise/articles/the-lowdown-on-headsail-options), [Cruising World off-wind sails](https://www.cruisingworld.com/story/gear/off-wind-sails-for-cruising/), [asymmetric spinnaker ranges](https://encountercrewmanual.readthedocs.io/en/latest/060_sails/0020_asymmetric_spinnakers/)
- Wave–current physics: [SWAN on ambient currents](https://swanmodel.sourceforge.io/online_doc/swantech/node24.html), [opposing currents and wave height](https://arxiv.org/pdf/2101.03439)
