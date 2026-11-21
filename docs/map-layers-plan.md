# Weather on the chart, and a clear "Chart" base map

Status: phases 1–4 built (weather layers, Chart base map, spot card / route editing / route card / search, offline regions). Not built: drawing weather in a Web Worker; online place search. Goal: one chart that works like a mix of a weather map (wind, current,
pressure moving over the map with a time slider), a passage planner, and a clean chartplotter
view of land and reef — while keeping the satellite photo for reef pilotage.

## What exists already

- Satellite photos (several sources, sharp mode, compare), reef outlines and park zones,
  OpenSeaMap seamarks and depth contours, seabed depth shading, rain radar.
- Gridded wind, gusts, waves and currents are already downloaded for the passage planner
  (Open-Meteo, several models), and saved for offline use with a planned passage.
- MapLibre (vector map engine) is already in the app for the 3D reef view.

## Phase 1 — Weather on the chart (1–2 weeks)

One "Weather" button on the chart opens a layer chooser and a time slider (now to +72 h, play
button), shared with the forecast screen.

| Layer | How it looks | Data |
| --- | --- | --- |
| **Wind** | Animated particles coloured by strength (same colours as the forecast table), plus an option for plain arrows with the knots printed, which is easier to read | Open-Meteo wind grid around the view |
| **Gusts** | Colour shading by gust strength | same grid |
| **Current** | Particles or arrows with knots (tidal streams included) | Open-Meteo marine currents |
| **Waves** | Colour shading by height, small arrows for direction and period | Open-Meteo marine |
| **Pressure (isobars)** | Lines every 2 hPa with labels, H and L marks at highs and lows | Open-Meteo sea-level pressure, contoured on the phone |
| **Rain / storms** | Rain shading; storm-risk shading from CAPE (same 0–3 scale as the planner) | Open-Meteo |

- **Libraries:** `leaflet-velocity-ts` (MIT) for particles; a small marching-squares contour
  step (or `d3-contour`) for isobars.
- **Offline:** the grids saved with a passage play back offline; elsewhere the last download
  for the area is kept, like the forecast.
- **Readability:** particles can be hard for older eyes, so arrows-with-numbers is a one-tap
  alternative, and every layer has a legend.

## Phase 2 — "Chart" base map (2–3 weeks)

A fast, clean alternative to the photo, readable in sun and at night:

- land in a sand colour, water shaded by depth bands (from the seabed model), crisp coastline;
- GBR reefs, cays and rocks filled from the GBRMPA outlines (coral colour with a hatch);
- place names, marinas and anchorages; OpenSeaMap lights and marks on top; park zones optional;
- three modes on one button: **Photo**, **Chart**, **Photo + chart lines** (outlines and names
  over the satellite photo).

| Source | Cost | Notes |
| --- | --- | --- |
| **Protomaps PMTiles, self-hosted** (OpenStreetMap data) | Hosting only | One file per region can be downloaded for **offline** use; small and fast. Recommended. Credit OpenStreetMap (ODbL). |
| OpenFreeMap | Free, no key | Good to start with; terms for production use are unclear, so keep a fallback. |
| MapTiler vector styles | Free tier, then paid | Already supported for satellite; has ocean-friendly styles. |

Engine: MapLibre draws the vector chart (already bundled for 3D). It can sit under the existing
Leaflet chart as a base layer, so all current tools keep working.

## Phase 3 — Navionics-style ease of use (1–2 weeks)

- **Press and hold anywhere:** one card with depth (model), wind and tide now, distance and
  bearing from the boat, and buttons: Go to, Add to route, Forecast here, Measure from here.
- **Edit routes by dragging points**; route card with distance, ETA and fuel at your speed.
- **Search** for anchorages and places (a bundled GBR anchorage list first; online search later).

## Phase 4 — Offline and speed

- Download a region once: vector chart, reef outlines, seabed and the last weather grids.
- Draw weather layers in a Web Worker so the chart stays smooth while particles animate.

## Licences to confirm before release

OpenFreeMap production terms; Protomaps / OpenStreetMap attribution; Open-Meteo (free for
non-commercial use, which suits the free app); leaflet-velocity-ts (MIT).

## Sources

- leaflet-velocity: https://www.github.com/onaci/leaflet-velocity
- leaflet-velocity-ts: https://www.npmjs.com/package/leaflet-velocity-ts
- windgl (WebGL wind): https://github.com/openearth/windgl
- OpenLayers wind particles explainer: https://github.com/gberaudo/olwind/blob/master/blog.md
- OpenFreeMap: https://openfreemap.org
- Protomaps: https://protomaps.com/about
- Free vs paid vector tiles: https://dev.to/janis-k/free-vs-paid-vector-map-tiles-when-to-use-openfreemap-self-host-or-choose-ogmap-4hg5
