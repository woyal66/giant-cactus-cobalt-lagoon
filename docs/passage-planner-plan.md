# Passage Planner: weather routing for Anchor Mate

A plan for adding passage planning to Anchor Mate: tap a start and a finish,
pick a departure window, and get the best plan for **safety, speed and comfort**.

Status: proposal. Nothing here is built yet.

**Independence:** this is Anchor Mate's own tool, with its own routing engine, public weather
data and its own boat polars. It has no affiliation with, data from, or connection to
PredictWind or any other routing service. PredictWind appears below only as an internal
benchmark of what sailors expect. Don't use its name in the app, store listing or marketing,
because it's their trademark.

---

## 1. What the market leader does (internal benchmark only)

| Feature | How PredictWind does it |
| --- | --- |
| Boat performance | **Polars**: boat speed for each wind speed and angle. Predefined by boat model, edited by hand, or "AI Polars" learned from the boat's instruments via their DataHub hardware (Professional plan). |
| Weather | 8 models, including their own high-resolution PWG/PWE plus ECMWF, GFS, UKMO and ICON. PWG/PWE are recommended for coastal trips; the others for long passages. |
| Weather routing | Fastest route from your polars, shown as one track per model so you can see where the models disagree. |
| Departure planning | Compares 4 departure times (24 h to 1 h apart), summarised across 4 models. "Pick the day first, then route it." |
| Comfort | A "Comfort" mode avoids areas over set limits (default 25 kn wind, 2.5 m swell). Wave polars estimate roll, vertical acceleration and slamming. |
| Currents | Ocean and tidal currents (Mercator by default, or HyCom / RTOFS). |
| Safety alerts | Lightning, squalls, high gusts, fog, and wind against current (for example wind over 12 kn within 60° of a current over 1 kn). |
| Price | Routing needs Standard (US$249/yr) or Professional (US$499/yr). |
| Export | Routes export as GPX. Departure plans don't. |

Anchor Mate's version is built independently from public data and its own code.

## 2. What Anchor Mate's version would be

**One screen, three taps:**

1. **Tap the start and finish** on the chart (or pick from saved anchorages and tracks).
2. **Pick a departure window** such as "Sat 6am to Sun 6pm". The app tries a departure every 3 h inside it.
3. **Choose the boat**: a type (cruising monohull, performance monohull, catamaran, motor) plus length,
   or import a real polar file. It defaults to the boat already set in the Boat panel.

**What you get back:**

- **Three suggested plans, each with a plain reason:**
  - **Safest**: the lowest peak wind and sea, avoids wind against tide, and arrives at reef passes in daylight.
  - **Fastest**: the shortest time across the models.
  - **Most comfortable**: the least time upwind and in short steep seas, with no beam seas over your limit.
- **A departure table:** each departure time scored green, amber or red against your limits, with
  arrival time, hours under way, peak wind and gust, peak wave, % upwind, motoring hours, and **model agreement**
  (how much ECMWF, GFS, ICON and UKMO disagree). Model agreement is the honest measure of how sure the plan is.
- **The route on the satellite chart**, with timed marks every 2 h showing expected wind, waves and
  current, and warnings where they apply ("wind against tide 14:00–16:00 in the passage", "arrives
  at the reef pass after dark: leave 3 h earlier").
- **"Follow this route"** sends it straight to the existing Tracks follow mode, with steering cues and the
  off-track alarm. **"Export GPX"** uses the export that's already built.

**Your limits**, set once: max wind, max gust, max wave height, the shortest wave period you'll accept,
no night arrivals at passes, and the motor-sail threshold (motor below X kn of boat speed).

## 3. How it works

### 3.1 Weather data

| Data | Source | Licence | Notes |
| --- | --- | --- | --- |
| Wind (4 models) | Open-Meteo forecast and ensemble APIs (ECMWF IFS, GFS, ICON, UKMO) | Commercial plan needed | Already wired, with the commercial key switch. Fastest route to v1. |
| Wind (own server, phase 3) | **ECMWF Open Data** (0.25°) and **NOAA GFS** (0.25°) GRIB | ECMWF CC BY 4.0, GFS public domain. Both allow commercial use. | Removes the per-call cost and allows a finer grid. |
| Waves | Open-Meteo Marine (DWD global ~28 km, European 5 km) or Copernicus Marine | Commercial plan / free with registration | Height, period and direction drive the comfort and safety scores. |
| Currents | Météo-France SMOC via Open-Meteo (~8 km, hourly, 10 days) | as above | Coarse near the coast, so it's fine offshore. Tidal streams in passages need care (see 3.4). |
| Tides | BOM ports (already in the app) | BOM licence needed | Used for pass timing and depth over bars. |
| Squalls and lightning | Open-Meteo CAPE and precipitation per model | as above | Flagged as an alert, not routed around. |

The app samples weather on a grid over a corridor around the straight line (for example 6 km spacing
for coastal trips and 25 km offshore). Open-Meteo accepts many coordinates per request, so one trip is
a handful of calls per model. The data is cached on the phone so the plan still works offshore without signal.

### 3.2 Boat performance (polars)

- **Built-in polars** for four boat types, scaled by waterline length (speed grows with √LWL),
  with a reef-down cap for high wind and an upwind cut-off (no sailing closer than about 40° true).
- **Import** of standard polar files: the Expedition/ORC `.pol`/`.txt` tables and CSV. Owners of
  ORC-rated boats can download their real polar from ORC Sailor Services.
- **Wave penalty**: speed is reduced in head and beam seas based on wave height ÷ boat length,
  similar to PredictWind's wave polars.
- **Learned polars (later)**: the app already records GPS tracks. With wind from the forecast or from
  instruments (see phase 4), it can compare predicted and actual speed and tune the polar over time.
  That's the PredictWind AI Polars idea, using the phone's GPS.
- **Motor**: below a set sailing speed, the boat motors at cruise speed. Motoring hours show in the result.

### 3.3 The routing engine

An **isochrone router**, the standard method behind PredictWind, Expedition, qtVlm and OpenCPN's routing:

1. From the start, try headings every 5–10°. For each, look up wind and current at that place and time,
   get boat speed from the polar (with the wave penalty), add the current, and step forward 15–60 minutes.
2. Keep only the furthest-forward points in each direction sector. That's the isochrone, the line
   of "everywhere reachable by time T". Repeat until the finish is reached.
3. Throw out steps that cross land, reef outlines, or areas over your hard limits.
4. Trace back the best path. Run it once per model and once per departure time.

**Scoring** works on the same expansion, with a different cost per step:

- *Fastest* = time.
- *Comfort* = time plus a penalty for upwind sailing, short steep seas (period ÷ height), beam seas and gusts.
- *Safest* = time plus heavy penalties near your limits, plus wind against current over 1 kn,
  night arrival at a pass, and low depth under keel at the tide.

**On the phone or on a server?** A coastal trip (100 nm, 6 departures × 4 models = 24 routes) runs
in a few seconds on a phone, in the background so the screen stays smooth. It also works offline once the weather
is downloaded. A server only becomes necessary for ocean passages and the own-data pipeline in phase 3.

### 3.4 Reefs, land and passes (where Anchor Mate can beat PredictWind)

- **Obstacles**: coastline (OpenStreetMap land polygons) plus the **GBRMPA reef outlines** already in the
  app, buffered by a safety margin you choose (for example 0.3 nm, more at night).
- **Reef passes and cuts as gates**: routes go through known passes (the Atlas reefs and saved tracks),
  and the last leg follows the saved track in, rather than a straight line over coral.
- **Daylight and tide windows**: arrival at a pass is scored against sunrise and sunset, moon (already built), sun
  behind you for reading the water, and the BOM tide (rising tide, enough depth over the bar).
- **Anchorage check at the finish**: forecast wind direction and strength for the night after arrival,
  so it can warn "exposed to the 20 kn SE change at 02:00".

## 4. Accuracy: how close it can get, and how we'd show it

- **Model spread is the headline confidence.** Each plan shows "4 models agree" (good) or
  "models disagree by 6 h on arrival" (re-check before leaving), just as PredictWind shows one track per model.
- **Coastal resolution is the weak point.** Global models (9–25 km) miss sea breezes and wind bending around
  headlands, and the current grid is ~8 km. PredictWind's PWG/PWE models are better here, so the app should say so
  for trips under ~30 nm.
- **Backtest before launch**: re-run past trips from saved tracks against archived forecasts (Open-Meteo
  keeps historical forecasts) and publish the typical ETA error.
- **Always a planning aid**: the same wording as the rest of the app. The skipper decides.

## 5. Build phases

| Phase | What | Rough effort |
| --- | --- | --- |
| **0. Quick win** | **Import GPX**, the open standard route and track file format, into Tracks. Any route a skipper has (from a chartplotter, OpenCPN or another app, or shared by a friend) can then be followed with Anchor Mate's steering cues and off-track alarm. | 1–2 days |
| **1. Departure planner** | Start, finish and window. Straight-line plus simple tacking estimate per departure × 4 models. Green, amber and red table with wind, wave, current and arrival-in-daylight checks. No route shape yet. | 1–2 weeks |
| **2. Full router** | Isochrone router in the background on the phone, built-in polars plus import, land and reef obstacles, the three plans, a timed route on the chart, and Follow/Export. | 4–6 weeks |
| **3. Own weather pipeline** | A small server that pulls ECMWF Open Data, GFS and Copernicus currents and waves, cuts them into compact tiles for the app, and allows ocean passages. Removes the Open-Meteo per-call cost. | 3–4 weeks plus hosting (about US$20–50 a month) |
| **4. Learned polars and instruments** | Read wind and boat speed from onboard instruments (NMEA 2000/0183 over Wi-Fi), tune the polar from real sailing, and compare forecast with actual wind. | 3–4 weeks |

**Where it fits commercially:** dedicated routing services charge about US$249–499 a year. A
**"Pro + Passage"** tier, or Passage Planner included in the annual subscription with a lower
price than dedicated routing services, is a strong reason to subscribe, especially with reef
passes and anchorage checks that general routing tools don't do.

## 6. Risks and how to handle them

- **Data cost and licences**: start on the Open-Meteo commercial plan (already wired), then move to the
  free-for-commercial ECMWF and GFS data in phase 3.
- **Over-trust**: show model spread, coastal-resolution warnings and "planning aid" wording on every plan.
  Never show a single route as "the answer" without its range.
- **Polars**: generic polars can be 10–20% off a real boat. Prompt users to import their polar or let the app learn it.
- **Liability**: extend the Terms of Use to cover routing (a lawyer should review this).

## Sources

- PredictWind help: [weather routing](https://help.predictwind.com/en/articles/2884626-how-to-use-weather-routing-in-the-predictwind-app), [departure planning](https://help.predictwind.com/en/articles/2884536-how-to-use-the-departure-planning), [calculate a departure plan](https://help.predictwind.com/en/articles/2884624-how-to-calculate-a-departure-plan), [Standard vs Professional](https://help.predictwind.com/en/articles/8563285-predictwind-subscriptions-differences-between-standard-and-professional), [2026 weather route webinar](https://help.predictwind.com/en/articles/15282012-2026-webinar-how-to-run-a-weather-route)
- PredictWind features: [AI Polars](https://predictwind.com/features/ai-polars), [personalised weather routing](https://predictwind.com/news/blogs/weather-routing-personalised-to-the-way-you-sail), [safe routing through wind, waves and current](https://www.yachtsandyachting.com/news/272706/Safe-routing-through-the-wind-waves-and-current), [cruising](https://www.predictwind.com/what-predictwind-forecast/cruising), [2026 apps comparison (Yacht)](https://www.yacht.de/en/sailing-knowledge/meteorology/apps-for-sailing-the-best-weather-apps-for-the-2026-season/)
- Routing methods: [Rosetta Code weather routing](https://rosettacode.org/wiki/Weather_Routing), [VISIR-2 routing model](https://gmd.copernicus.org/articles/17/4355/2024/gmd-17-4355-2024.pdf)
- Polars: [ORC Sailor Services](https://orc.org/sailors/sailor-services), [ORC speed guides](https://orc.org/sailors/sailor-services/speed-guides), [orc-data](https://github.com/jieter/orc-data)
- Data: [Open-Meteo marine API](https://open-meteo.com/en/docs/marine-weather-api), [Open-Meteo ensemble API](https://open-meteo.com/en/docs/ensemble-api), [Open-Meteo ECMWF API](https://open-meteo.com/en/docs/ecmwf-api)
