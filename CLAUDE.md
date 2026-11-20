# Anchor Mate

Anchor drag alarm and satellite helm for small boats (Australian reefs focus).
Shipped as **free iOS and Android store apps** (Capacitor); an annual subscription
can be switched back on with `VITE_PAID_APP=1`. Originally generated with Grok; all Grok platform code has been removed.

## Two builds from one codebase

| Build | Config | Entry | Notes |
| --- | --- | --- | --- |
| **Phone app** (the product) | `vite.mobile.config.ts` | `mobile.html` → `src/mobile.tsx` | Static bundle, no server. Output `dist-mobile/`, copied into `ios/` and `android/` by `cap sync`. |
| Website (optional) | `vite.config.ts` | TanStack Start, `src/routes/` | Mainly hosts `/privacy` and `/terms` for store listings. Its Better Auth sign-in (`src/lib/auth/`) was wired to Grok's auth broker and is dormant; deploy with `VITE_AUTH_ENABLED=false`. |

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
- Seabed: `src/lib/depth.ts` (terrarium depth tiles, AWS Terrain Tiles by default, `VITE_DEPTH_TILES` to override), `depth-layer.ts` (depth / too-shallow overlay drawn on the phone; tide from `useTideNow`), `ShallowCheck` in the planner, `reef-3d.tsx` (MapLibre 3D view, lazy-loaded). Approximate: hundreds of metres, not bommies. Allen Coral Atlas layer only with `VITE_BENTHIC_WMS`.
- `src/lib/imagery.ts`: map sources and licensing switches (`VITE_MAPTILER_KEY`, `VITE_ESRI_KEY`, `VITE_LICENSED_IMAGERY_ONLY`). `src/lib/open-meteo.ts` adds the commercial Open-Meteo key.
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
- **Passage planner** (`src/lib/routing/`): `polar.ts` (built-in polars by boat type, √LWL scaling, engine only in light air), `field.ts` (gridded wind/gust/wave/current, vector interpolation), `router.ts` (isochrone router; fastest/comfort/safest differ only in step cost; tack/gybe cost `MANOEUVRE_H`), `plan.ts` (departure window × plans, model spread, traffic lights), `land.ts` (Natural Earth 1:10m coastline rasterised per corridor; **no reefs**), `fetch-field.ts` (Open-Meteo multi-location, ECMWF + GFS + marine), `worker.ts` / `client.ts` (runs in a Web Worker). UI: `components/helm/route-planner.tsx`, dock "Route" button, tap modes `route-start` / `route-finish`, chart preview `routePreview`.
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
- Anchor watch: saved immediately on change and restored on relaunch (`isAnchorWatch` in the store). Other state is saved at most every 4 s and flushed on backgrounding.
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
- Don't change `appId` (`com.anchormate.app`) after the first store upload.
- This is a safety aid: changes to GPS, the watch guard or notifications need tests and a real-device check with the screen locked.
- Release steps for the owner live in `STORE-RELEASE.md`.
