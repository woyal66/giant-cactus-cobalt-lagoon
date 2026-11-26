# Anchor Mate

Anchor drag alarm and satellite helm for small boats (Australian reefs focus).
Shipped as **free iOS and Android store apps** (Capacitor); an annual subscription
can be switched back on with `VITE_PAID_APP=1`. Originally generated with Grok; all Grok platform code has been removed.

## Two builds from one codebase

| Build | Config | Entry | Notes |
| --- | --- | --- | --- |
| **Phone app** (the product) | `vite.mobile.config.ts` | `mobile.html` → `src/mobile.tsx` | Static bundle, no server. Output `dist-mobile/`, copied into `ios/` and `android/` by `cap sync`. |
| Website (optional) | `vite.config.ts` | TanStack Start, `src/routes/` | Mainly hosts `/privacy` and `/terms` for store listings. Its Better Auth sign-in (`src/lib/auth/`) was wired to Grok's auth broker and is dormant; deploy with `VITE_AUTH_ENABLED=false`. |

**Web app:** the same phone bundle is published at `https://<owner>.github.io/<repo>/app/` by `legal-pages.yml` for planning on a laptop or tablet (data URLs relative, `../depth/…`). Phone-only features degrade: the anchor alarm needs the tab open (`web-notice.tsx` says so), BOM tables fall back to EOT20 (CORS). Keep paths relative (`base: "./"`, no leading `/` in fetches, service worker registered relative).

The phone build swaps server-only modules via aliases in `vite.mobile.config.ts`:
`passages.mobile.ts` (tracks stored on device), `bom-tides.mobile.ts` (BOM fetched
natively with `CapacitorHttp`, no CORS), and stubs in `src/mobile-shims/`. When you add
a server function, give the phone build an equivalent or it silently returns `null`.

## Key modules

- **The app is free** (`isFreeApp()` in `subscription.ts`): no paywall, trial or subscription UI unless built with `VITE_PAID_APP=1`. Terms and privacy text follow the same switch.
- `src/lib/subscription.ts`: RevenueCat (`@revenuecat/purchases-capacitor`), `pro` entitlement, offline grace cache. Pure helpers are unit tested.
- `src/components/subscription.tsx`: `SubscriptionGate` (wraps the helm in `src/mobile.tsx`), `Paywall`, `SubscriptionRow` (in the View panel on native).
- `src/lib/background-gps.ts`: lock-screen GPS (`@capacitor-community/background-geolocation`). Used by `useGpsWatch` in `src/hooks/helm-runtime.ts` whenever an anchor, recording or passage is active on native; emits `helm:fix` so `useAnchorWatch` evaluates on every fix.
- `src/lib/watch-guard.ts`, `src/lib/anchor.ts`: alarm logic (pure, tested).
- `src/lib/watch-notify.ts`: alarm notifications (Android channel `anchor-alarm`, max importance).
- Satellite sharpness: `satLayer` in `map-view.tsx` has a sharp mode (`sharpTiles`, default on for screens of 2× density or more) that uses 128 px tiles one zoom deeper (`zoomOffset: 1`, `maxNativeZoom − 1`); any tile no source has is filled from the quarter of its parent (`cropQuadrant`), so offline packs saved one level lower still show. `reefClarity` adds a contrast filter (`.rp-clarity`).
- Imagery tools: ⇄ compare button (`flipImagery`, always two real sources), "Photo at chart centre" in View (`imagery-info.ts`, Esri metadata, untested against the live service), offline packs up to z20 (`SOURCE_MAX_Z`).
- Seabed: `src/lib/depth.ts` merges two terrarium sources per tile: GBR 30 m (Geoscience Australia 2020, CC BY 4.0, MSL; `VITE_DEPTH_TILES`, built by `scripts/build-depth-tiles.py`, published to GitHub Pages by `legal-pages.yml`, 404 outside its water and 0,0,0 for no data) and AWS Terrain Tiles for the rest (`loadDepthTile`, merged tile cached as `depth/z/x/y`; the 3D view reads it via the `depthdem://` protocol), `depth-layer.ts` (depth / too-shallow overlay drawn on the phone; tide from `useTideNow`), `ShallowCheck` in the planner, `reef-3d.tsx` (MapLibre 3D view, lazy-loaded). Approximate: about 30 m in the GBR model (no bommies), about 1.8 km elsewhere. Allen Coral Atlas layer only with `VITE_BENTHIC_WMS`.
- Weather on the chart: `wx-map.ts` (view grid, vectors, isobar contours, H/L; tested), `wx-map-data.ts` (Open-Meteo grid for the view, saved for offline), `wx-layer.ts` (canvas drawing; particles on every layer: waves along their travel, pressure/rain/storm over the wind; kept across slider steps), `wx-map-bar.tsx` (layer chooser, time slider, model chips ECMWF/GFS/ICON/UKMO = `wxMapModel`; waves and current always come from the Open-Meteo marine model). Isobars: bicubic `upsample` + `smoothLines` (joined, Chaikin-rounded). Base map: `baseMap` photo / chart / lines; `chart-style.ts` (MapLibre style, OpenFreeMap by default, `VITE_CHART_TILES`), `chart-layer.ts` (MapLibre inside Leaflet via `@maplibre/maplibre-gl-leaflet`, centred for rotation, lazy-loaded).
- Hazards: `src/lib/hazards.ts` (bundled `public/reefs/gbr-hazards.json`: GBRMPA reefs, drying reef, rocks, cays, islands; delta-encoded; `hazardsNear`, `hazardsAlong`), `hazard-layer.ts` (chart drawing, offline, the reef outlines toggle), `hazard-check.tsx` (planner and drawn routes), nearest hazard on the pin card. `scripts/build-reefs.mjs feat.json dry.json` rebuilds it and the router's `gbr.json`.
- Offline regions: a pack download also runs `saveRegionExtras` (`region-pack.ts`): seabed depth tiles (`depth/…` in the tile store), the Chart map via the `cached://` MapLibre scheme (`chart-cache.ts`), and a 3-day weather grid (`saveAreaWeather`; any saved grid covering the view is used offline). Press-and-hold card `pin-card.tsx`; place search `place-search.ts`; route card `routeSummary` + `fuelLph`.
- `src/lib/imagery.ts`: map sources and licensing switches (`VITE_MAPTILER_KEY`, `VITE_ESRI_KEY`, `VITE_LICENSED_IMAGERY_ONLY`). Online-only licensed sources, each on only with its key (`docs/imagery-keys.md`): Google Map Tiles API (`VITE_GOOGLE_TILES_KEY`, session via `ensureGoogleSession`, viewport copyright in the credits, never in Auto or offline packs), Azure Maps `microsoft.imagery` for the Bing aerial (`VITE_AZURE_MAPS_KEY`, id `bing`), Mapbox Satellite (`VITE_MAPBOX_TOKEN`), HERE (`VITE_HERE_KEY`). `src/lib/open-meteo.ts` adds the commercial Open-Meteo key.
- Tides: `fetchBestTide` in `tide-station.ts` picks a BOM table within 25 km (`STATION_FIRST_KM`), else EOT20, else BOM up to 120 km, else Open-Meteo. `src/lib/tide-model.ts`: EOT20 global ocean tide model (DGFI-TUM, CC BY 4.0, MSL, 17 constituents, 0.125°), 5° chunks as PNG-packed int16 (`scripts/build-tide-chunks.py`, 46 MB worldwide, published by `legal-pages.yml`, `VITE_TIDE_MODEL`), harmonic prediction with nodal corrections matching pyTMD to the millimetre (Schureman phase convention), cached offline and saved with region packs. LAT estimated as the lowest tide over a year.
- Going global: imagery and the EOT20 tides are worldwide; depth sources (`DEPTH_SOURCES`) are GBR 30 m, then GEBCO_2026 shelf tiles (`VITE_DEPTH_GLOBAL_TILES`, zoom 3–8, public domain, land capped at 5 m, built by the same script with `--zmin 3 --zmax 8 --land-cap 5`, enlarged beyond z8 by `cropParent`), then AWS; official charts overlay (`official-charts.ts`, `officialCharts` toggle): NOAA ENC display WMS for US waters (public domain); hazards are GBR only. NOAA BlueTopo (97 GB) needs a bigger host than Pages. Add a region by adding a source in the same layered way (fine source first, global fallback).
- `src/lib/weather.ts`: forecasts are saved per ~10 km cell and revived offline (`reviveForecast`).
- `src/lib/critical-alert.ts` ↔ `ios/App/App/CriticalAlertPlugin.swift` (registered in `MainViewController.swift`): iPhone alarms as Critical Alerts (needs Apple entitlement, see STORE-RELEASE 7a) or Time Sensitive.
- `src/lib/gpx.ts` / `share-gpx.ts` / `share-file.ts`: GPX export and file sharing via the share sheet.
- `src/lib/units.ts`: display units (depth m/ft/fathoms, length m/ft). Everything is stored in metres; use `formatDepth` / `formatLength` / `formatMeters`, never a literal " m". Components that format call `useUnitsKey()` so they re-render on a change.
- `src/lib/moon.ts` (suncalc) + `components/helm/moon-card.tsx`: moon phase and rise/set, offline.
- `src/lib/remote-watch.ts` + `useRemoteWatch` + `remote-watch-card.tsx`: second-phone alarms over ntfy (`VITE_REMOTE_WATCH_SERVER`).
- `src/lib/backup.ts` / `backup-actions.ts`: backup file and restore. Restore goes through the store's own load path (`persist.rehydrate`) so values are validated; the live anchor watch is kept.
- `src/lib/trial-reminder.ts`: trial-ending notice (local notification id 900) and banner.
- `components/helm/first-run-guide.tsx`: onboarding; `runAlarmDemo` uses a `demo: true` anchor that is never persisted. `simulateAnchorDrag` pauses live GPS for 30 s (`demoHoldUntil`).
- Marine park zones: `ZONING_WMS_LAYERS` / `PARK_ZONES` in `imagery.ts`.
- **Passage planner** (`src/lib/routing/`): `polar.ts` (boat type Monohull / Catamaran / Motor boat, picked in the Boat panel and routing settings via `BoatTypePicker`; old `cruiser`/`performance` read as mono by `readBoatType`; built-in polars with √LWL scaling; a motor boat routes at its cruising speed, slowed harder by head seas the faster it goes (`waveFactor`), with fuel from `fuelLph`; sail plan, apparent wind and learned polar are hidden for motor boats), `field.ts` (gridded wind/gust/wave/current, vector interpolation), `router.ts` (isochrone router; fastest/comfort/safest differ only in step cost; tack/gybe cost `MANOEUVRE_H`), `plan.ts` (departure window × plans, model spread, traffic lights), `land.ts` (Natural Earth 1:10m coastline rasterised per corridor, plus `shallow-mask.ts`: cells the depth model shows as land or shallower than draft + 1 m at MSL are blocked, `minDepthM`; if that closes every route the worker retries on the coastline only and the planner says so, `depthCheck`), router `straighten` pass (replaces doglegs with one clear straight leg when it is no costlier), polar `tune` (skipper's speeds at 15 kn TWS for close-hauled/close reach/beam/run and pointing angle; `tuneFactor` scales the built-in shape), `fetch-field.ts` (Open-Meteo multi-location, ECMWF + GFS + marine), `worker.ts` / `client.ts` (runs in a Web Worker). UI: `components/helm/route-planner.tsx`, dock "Route" button, tap modes `route-start` / `route-finish`, chart preview `routePreview`.
- **Navigation** sheet (`NavigationPanel` in `panels.tsx`, dock button, panel id `passages`): Start recording, place search (named GBRMPA features + BOM ports + your tracks, offline; the old preset reef list is gone), My tracks, Library. Stop opens `RenameTrackPanel` (default `Track N` from `nextTrackName`, optional comment, optional share). Online library: `src/lib/track-library.ts` (Supabase REST, `VITE_TRACK_LIBRARY_URL` / `VITE_TRACK_LIBRARY_KEY`, no sign-in, per-track secret to remove, 3 reports hide), `library-tab.tsx` (search, dashed `libraryPreview` on the chart, save to phone, report). Setup SQL: `docs/track-library.md`.
- Screen layout (design plan phases 1–7): left rail of labelled `RailBtn`s in `hud.tsx` (chart up, scale bar `scaleBar`, Compare, Weather, Measure, MOB); top right Chart (`LayersPanel`, map things only) and Settings (`SettingsPanel`, sectioned with search: look, units, steering, boat/GPS, help) plus `StatusChips` (GPS quality, offline, forecast age). The SOG/XTE/CTS tape shows only when following a track, otherwise a slim speed/heading chip (`SteerOverlay`). At anchor: `AnchorStatusCard` above the dock (distance against the circle, time on watch, wind, next tide) replaces the old ribbon and top pill. `NightCheckCard` (`night-check.ts`, tested) is the "Ready for the night" list in the last anchor step and the anchor sheet. Weather: one half-height sheet with Forecast here / Weather map tabs; the map bar has Forecast and Done. Small buttons are at least 40 px (`size="sm"` is h-10).
- Head-up: leaflet-rotate turns the map clockwise by its bearing, so `setMapBearing` passes `360 − heading` (a mark ahead draws above the boat).
- `src/lib/gpx-import.ts`: GPX import into Tracks (routes, tracks, waypoints; dedupes our own route+track export).
- More planner modules: `learned.ts` (learned polar from clean sailing samples, `throughWater`), `brief.ts` (passage brief text + HTML), `reefs.ts` (bundled GBRMPA reef outlines as router obstacles; built by `scripts/build-reefs.mjs`).
- `src/lib/radar.ts` + `components/helm/radar-layer.ts`, `radar-chip.tsx`: rain radar overlay (RainViewer, licence switches) and closing heavy-rain cell alert.
- `src/hooks/polar-monitor.ts` + `perf-chip.tsx`: live % of polar, learning.
- `src/lib/mob.ts`, `hooks/mob-drift.ts`, `components/helm/mob-guide.tsx`: MOB drift cone and recovery steps.
- `src/lib/sat-forecast.ts` + `sat-paste.tsx`: satellite messenger text forecast format (decoder; the server is not built).
- Route following: `steer.ts` (`locateOnRoute`, `steerCue`, `nextTurn`, `steerLegIndex`). Tapped routes (`tapped: true`) are never simplified; recorded trails are filtered and smoothed (`smoothTrail`, `simplifyTrack` in `geo.ts`). See `docs/reef-pilotage.md`.
- `docs/passage-planner-plan.md`: the plan; phases 0–2 are now built (see its status line).
- `docs/ai-plan.md`: feature review and the AI plan (not built).
- `docs/sailing-assistant-plan.md`: next stage: routing settings page, storm/squall risk (CAPE), true and apparent wind graph, sail plan, arrival forecast, during-the-sail tools.
- Anchor watch: once set, the hook and swing circle can't be dragged on the chart; they change only via Move hook / Swing size (`resize-swing`) in the anchor panel. Saved immediately on change and restored on relaunch (`isAnchorWatch` in the store). Other state is saved at most every 4 s and flushed on backgrounding.
- `src/components/legal/terms.tsx`, `src/routes/privacy.tsx`: legal text shown in-app and on the website. Keep in sync with what the stores link to.

## Design for older readers

- Font: Atkinson Hyperlegible Next (bundled via `@fontsource-variable`, works offline) for all text; no condensed display face. Semibold at most.
- Text sizes: use `text-t11` … `text-t16` and the named sizes; they scale with the Text size setting (`textSize` → `html[data-text]` → `--ts`; Large is the default). Don't add fixed `text-[Npx]` sizes, and nothing under 11 px.
- Labels in sentence case (no `uppercase` or wide letter-spacing). Grey text `--color-muted-foreground` is 7.5:1 on cards; keep it that high.

## Commands

```bash
npm test            # node:test suites (scripts + src/lib)
npm run typecheck
npm run lint
npm run mobile:sync # build phone bundle + cap sync ios & android
npm run assets      # regenerate icons/splash from assets/*.png
npm run dev         # website dev server on :8080
```

Run the phone UI in a browser: `npx vite --config vite.mobile.config.ts`, then open `/mobile.html`
(the paywall is skipped in a browser; prefix `VITE_PAYWALL_PREVIEW=1` to show it with sample prices).

## Rules

- Native project folders (`ios/`, `android/`) are committed; build output (`dist-mobile/`, `ios/App/App/public`, `android/app/src/main/assets/public`) is not.
- RevenueCat keys come from `VITE_REVENUECAT_IOS_KEY` / `VITE_REVENUECAT_ANDROID_KEY` (public SDK keys) in a git-ignored `.env.production.local`. Never commit signing keys or `android/keystore.properties`.
- Don't change `appId` (`au.com.anchormate`) after the first store upload (`com.anchormate.app` was already taken on Google Play).
- This is a safety aid: changes to GPS, the watch guard or notifications need tests and a real-device check with the screen locked.
- Release steps for the owner live in `STORE-RELEASE.md`; Google Play quick path in `store/google-play/GOOGLE-PLAY.md`. `.github/workflows/android-release.yml` builds the signed `.aab` (versionCode = run number); `legal-pages.yml` publishes `site/` (privacy, terms). Safe-area CSS uses `var(--safe-area-inset-*, env(...))` because Capacitor 8 injects the variables on Android.
