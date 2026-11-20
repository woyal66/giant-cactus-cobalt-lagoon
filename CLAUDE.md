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
