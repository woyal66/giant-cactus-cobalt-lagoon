# Anchor Mate

Anchor drag alarm and satellite helm for small boats (Australian reefs focus).
Shipped as **iOS and Android store apps** (Capacitor) with a free-trial → annual
subscription. Originally generated with Grok; all Grok platform code has been removed.

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

- `src/lib/subscription.ts`: RevenueCat (`@revenuecat/purchases-capacitor`), `pro` entitlement, offline grace cache. Pure helpers are unit tested.
- `src/components/subscription.tsx`: `SubscriptionGate` (wraps the helm in `src/mobile.tsx`), `Paywall`, `SubscriptionRow` (in the View panel on native).
- `src/lib/background-gps.ts`: lock-screen GPS (`@capacitor-community/background-geolocation`). Used by `useGpsWatch` in `src/hooks/helm-runtime.ts` whenever an anchor, recording or passage is active on native; emits `helm:fix` so `useAnchorWatch` evaluates on every fix.
- `src/lib/watch-guard.ts`, `src/lib/anchor.ts`: alarm logic (pure, tested).
- `src/lib/watch-notify.ts`: alarm notifications (Android channel `anchor-alarm`, max importance).
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
- `docs/passage-planner-plan.md`: plan for weather routing (not built).
- Anchor watch: saved immediately on change and restored on relaunch (`isAnchorWatch` in the store). Other state is saved at most every 4 s and flushed on backgrounding.
- `src/components/legal/terms.tsx`, `src/routes/privacy.tsx`: legal text shown in-app and on the website. Keep in sync with what the stores link to.

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
