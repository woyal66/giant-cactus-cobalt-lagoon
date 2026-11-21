# Releasing Anchor Mate to the App Store and Google Play

The code is ready for the stores. What's left are accounts, store settings and
signing, which only you (the owner) can do. Work through the sections in order.
Prices and policies below were correct when written. Check the current pages
before paying for anything.

**The app is free (current setting).** Every feature is open to everyone: no paywall,
trial, subscription or ads. List it as **Free** in both stores and create no in-app
purchases, so you can skip sections 3 and 4 (store subscriptions and RevenueCat). You
still pay Apple's developer fee (US$99 a year) and Google's one-off fee (US$25).

To charge later, build with `VITE_PAID_APP=1`: the subscription screen, trial and
RevenueCat code are still in the app, and sections 3 and 4 then apply.

### Being free changes the data licences

"Free" means no money is made, which several providers count as non-commercial. It does
not make every source usable:

| Source | Free app |
| --- | --- |
| Google and Bing satellite | **Still not allowed.** Their terms forbid other apps taking their tiles, whatever the price. Keep `VITE_LICENSED_IMAGERY_ONLY=1` for store builds so they stay hidden. |
| Esri / Maxar World Imagery | Create a free ArcGIS Location Platform account and set `VITE_ESRI_KEY`; the free tier includes a monthly basemap allowance. Check the current limit, and what happens when many users exceed it. |
| MapTiler Satellite | The free plan is non-commercial with a monthly request limit; a free app may qualify. Check whether the free plan allows saving tiles offline, and expect to need a paid plan as users grow. |
| Sentinel-2 cloudless (EOX) | CC BY-NC-SA: usable by a free, non-commercial app with the credit shown. Ask EOX if you want certainty. |
| Open-Meteo | The free API is for non-commercial use; a free app should qualify. `VITE_OPEN_METEO_KEY` is then optional. |
| RainViewer radar | The free API is for personal and non-commercial use; confirm with RainViewer that a free app in the stores is fine. |
| BOM tides and radar | Still ask BOM: free or not, it's redistribution to the public. |

**Checking sharpness before launch (do this, it matters for reef safety):** with your keys
set, open the app on your phone over three reefs you know well and use the ⇄ compare button
to flip between MapTiler and Esri at helm zoom. Note which shows bommies and channel edges
best, and pick that as the store build's main source. Google and Bing will not be in the
store build, so judge only the licensed sources.

---

## 1. Accounts you need

| Account | Cost | Notes |
| --- | --- | --- |
| [Apple Developer Program](https://developer.apple.com/programs/) | US$99 / year | Enrol as an individual or as a company (a company needs a D-U-N-S number). |
| [Google Play Console](https://play.google.com/console/signup) | US$25 once | New *personal* accounts must run a closed test with at least 12 testers for 14 days before going public. |
| [RevenueCat](https://www.revenuecat.com/) | Free to start | Handles subscriptions for both stores. |
| A Mac with Xcode 16 or newer | – | Apple only accepts iPhone builds from Xcode. No Mac? Use a cloud Mac (e.g. MacinCloud) or a CI service such as Codemagic. |
| [Android Studio](https://developer.android.com/studio) | Free | Runs on Windows, Mac or Linux. |

Both stores also need **banking and tax details** before they will sell
subscriptions (App Store Connect → Business; Play Console → Payments profile).

## 2. App ID

The app ID is `com.anchormate.app` (in `capacitor.config.ts`, the Android
`build.gradle` and the Xcode project). It must be unique in each store and
**can't be changed after the first upload**. If you'd rather use your own domain
(e.g. `au.com.yourbusiness.anchormate`), ask Claude to change it *before*
creating the store listings.

## 3. Create the subscription in each store

Use the **same names everywhere** so RevenueCat can match them.

### App Store Connect
1. **Apps → + → New App**: name "Anchor Mate", bundle ID `com.anchormate.app`.
2. **Monetization → Subscriptions → Create subscription group** named `Anchor Mate Pro`.
3. Add a subscription: reference name `Pro Annual`, product ID
   **`anchormate_pro_annual`**, duration **1 year**, set the price.
4. On that subscription, add an **Introductory Offer → Free → 1 week** (or the
   trial length you want), for new subscribers.
5. Fill in the subscription's display name and description, and add a review screenshot of the paywall.
6. **Users and Access → Integrations → In-App Purchase**: generate a key (`.p8`). RevenueCat needs it.

### Google Play Console
1. **Create app**: "Anchor Mate", app, free (the *download* is free; the subscription is paid).
2. **Monetize → Subscriptions → Create subscription**: product ID
   **`anchormate_pro`**.
3. Add a **base plan**: ID `annual`, auto-renewing, billing period **1 year**, set prices.
4. Add an **offer** on that base plan: ID `free-trial`, eligibility **new customer
   acquisition**, phase **Free trial, 7 days**.
5. Create a **Google Cloud service account** with access to the Play Console's
   financial data. RevenueCat's guide walks through this
   ([link](https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials)).

Google only lets you create subscriptions after the first build is uploaded (step 6).
If the Subscriptions page is locked, upload a build to Internal testing first, then come back.

## 4. Set up RevenueCat

1. Create a project called **Anchor Mate**.
2. Add an **App Store app** (bundle ID `com.anchormate.app`, upload the `.p8` key)
   and a **Play Store app** (package `com.anchormate.app`, upload the service-account JSON).
3. **Product catalog → Entitlements**: create an entitlement with identifier **`pro`**.
4. **Products**: import `anchormate_pro_annual` (Apple) and
   `anchormate_pro:annual` (Google), and attach both to the `pro` entitlement.
5. **Offerings**: in the `default` offering (mark it *current*), add an **Annual**
   package containing both products.
6. **API keys**: copy the **public** app-specific keys (`appl_…` and `goog_…`).

Then, in the project folder:

```bash
cp .env.example .env.production.local
```

Put the two keys into `.env.production.local`. That file is git-ignored. These
are public keys, designed to ship inside the app, so this is safe. **Never** use a
RevenueCat secret key (`sk_…`) here.

## 5. Build the app

```bash
npm install
```

```bash
npm run mobile:sync
```

That builds the phone version and copies it into both native projects. Run it
again after every code change.

If you change the logo, replace the files in `assets/` and run `npm run assets`
to regenerate every icon and splash size.

## 6. Android release

> **Shortest path:** follow `store/google-play/GOOGLE-PLAY.md`. It builds the signed upload
> file in GitHub Actions (no Android Studio needed) and has the listing text, images, form
> answers and the closed-test requirement. The steps below are the manual (Android Studio) way.

1. **Create an upload key** (once; keep the file and passwords safe. Losing
   them means you can't update the app without asking Google to reset the key):

   ```bash
   keytool -genkey -v -keystore anchormate-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```

2. Move `anchormate-upload.jks` into `android/` and create
   `android/keystore.properties` (git-ignored):

   ```properties
   storeFile=anchormate-upload.jks
   storePassword=YOUR_STORE_PASSWORD
   keyAlias=upload
   keyPassword=YOUR_KEY_PASSWORD
   ```

3. `npm run android:open`, then in Android Studio: **Build → Generate Signed App
   Bundle** (or run `./gradlew bundleRelease` in `android/`). Upload the `.aab`
   from `android/app/build/outputs/bundle/release/` to **Testing → Internal testing**.
4. For each new release, increase `versionCode` (1, 2, 3…) and `versionName`
   ("1.0.1"…) in `android/app/build.gradle`.

**Play Console forms that apply to this app:**
- **Foreground service permissions**: the anchor watch uses a *location*
  foreground service. Declare it and explain: *"Anchor drag alarm: while the user
  has set an anchor watch, the app tracks the boat's position with the screen off
  and sounds an alarm if the boat drags outside the swing circle."* Google asks
  for a short video showing this.
- **Data safety**: location is used on the device. The boat's position is also
  sent to Open-Meteo and the Bureau of Meteorology to fetch weather and tides,
  and purchase history goes to RevenueCat. Declare these honestly.
- **Content rating**, **target audience** (not for children), **Privacy policy URL** (see section 8).

## 7. iPhone release

1. On the Mac: `npm install`, `npm run ios:sync`, `npm run ios:open`.
2. In Xcode, select the **App** target:
   - **Signing & Capabilities**: choose your team and keep *Automatically manage signing* on.
   - Check that **Background Modes → Location updates** is ticked (already set in `Info.plist`).
   - Click **+ Capability → In-App Purchase**.
   - **General**: set Version (1.0.0) and Build (1, 2, 3…; increase it for every upload).
3. **Product → Archive**, then **Distribute App → App Store Connect**. The build shows up in TestFlight after processing.
4. In App Store Connect, attach the subscription to the version (**In-App
   Purchases and Subscriptions** section of the version page) so Apple reviews them together.

**App Review notes** (paste into *App Review Information → Notes*):

> Anchor Mate is an anchor drag alarm for boats. Background location is used only
> while the user has an anchor watch or track running, so the alarm can sound with
> the phone locked; it stops when the watch ends. The app requires an active
> Anchor Mate Pro subscription (1-week free trial). Use a sandbox account to start
> the trial. To try the alarm without a boat: open Anchor, drop the anchor, then
> tap "Test drag alarm".

Apple also requires a link to your **Terms of Use (EULA)** in the App
Description or the EULA field, plus a **Privacy Policy URL**.

## 7a. iPhone Critical Alerts (alarm through silent mode and Do Not Disturb)

The app is already coded for this. It has two levels:

| Level | Breaks through | Apple approval |
| --- | --- | --- |
| **Time Sensitive** (on now) | Focus modes and scheduled summaries. **Not** the ringer switch. | None. The capability is already in `App.entitlements`. |
| **Critical Alerts** | Silent switch, Do Not Disturb, every Focus mode, at full volume. | Yes. Apple grants it to safety apps on request. |

To turn on Critical Alerts:

1. Request the entitlement from Apple. On developer.apple.com, find the
   **Critical Alerts entitlement request** form (search "Critical Alerts" in the
   developer account's Contact pages). Choose app ID `com.anchormate.app` and explain:
   > Anchor Mate is an anchor drag alarm for boats. It wakes the crew at night if
   > the anchor drags or GPS is lost, when the boat may be about to go aground.
   > The alarm must sound even if the phone is on silent or in Do Not Disturb.
   > Critical Alerts are used only for anchor drag, GPS lost and man overboard,
   > never for marketing or routine notices.
2. When Apple approves it, open `ios/App/App/App.entitlements` and move the two
   `critical-alerts` lines out of the comment, so it reads:
   ```xml
   <key>com.apple.developer.usernotifications.critical-alerts</key>
   <true/>
   ```
   **Don't do this before approval.** Code signing fails without it.
3. In the Apple Developer portal, regenerate the provisioning profile (Xcode does
   this automatically with *Automatically manage signing*), then build again.
4. On first use of the anchor watch, iPhone asks the user to allow Critical
   Alerts. The Anchor panel shows "Critical Alerts on" once allowed.

Android has no approval step: the alarm uses a max-priority channel. Users who
want it to ring through Do Not Disturb can turn on **Override Do Not Disturb**
for the "Anchor and safety alarms" channel in the phone's app notification settings.

## 8. Privacy policy and Terms of Use links

The stores need public web addresses for both. The pages already exist in the
app (`/privacy` and `/terms`). The easiest way to publish them is to deploy this
project's website to Vercel (free):

1. Sign in at [vercel.com](https://vercel.com) with GitHub, then **Add New → Project** and pick this repository.
2. Under **Environment Variables** add `VITE_AUTH_ENABLED` = `false` (the
   website's old Grok sign-in doesn't work outside Grok).
3. Deploy. Your links are `https://<project>.vercel.app/privacy` and `/terms`.

Any web host works. All you need is two public pages with the same text.
**Have a lawyer review the Terms and Privacy text before launch.** They're a
starting point, not legal advice.

## 9. Map and weather data: licences for a paid app

Most free map and weather feeds may only be used by **non-commercial** apps.
Anchor Mate is paid, so before launch:

| Data | Used for | What's needed for a paid app |
| --- | --- | --- |
| Google / Bing satellite | Sharpest close-in photos | **No licence possible this way.** They're fetched directly from consumer tile servers. Turn them off for the store build (below). |
| Esri World Imagery and Clarity | Reef photos | An ArcGIS Location Platform account and key → `VITE_ESRI_KEY`. Clarity has no commercial terms, so it's hidden in the store build. |
| Sentinel-2 cloudless (EOX) | Wide-area colour | The 2018–2024 mosaics are non-commercial. A commercial licence comes from EOX (cloudless@eox.at). |
| **MapTiler Satellite** (recommended) | Licensed satellite and offline packs | A paid MapTiler Cloud plan → `VITE_MAPTILER_KEY`. Its terms cover saving tiles on the device. |
| Open-Meteo | Wind, waves, currents, model tide, and the passage planner (about 4 requests per plan) | A commercial API plan → `VITE_OPEN_METEO_KEY`. Requests switch over automatically. |
| Natural Earth coastline | Passage planner land avoidance | Public domain. Bundled with the app (3 MB), so nothing is needed. |
| BOM tide tables | Official port tides | BOM content is personal use by default. Ask BOM about a data licence, and show their copyright and disclaimer. |
| OpenSeaMap seamarks and depths | Chart overlays | CC BY-SA. Credit is shown. For heavy use, contact the project. |
| GBRMPA reef outlines and zoning (eAtlas) | Reef and marine park overlays | CC BY. Credit is shown. The zoning legend says it's a guide, not the law. |
| RainViewer radar | Rain radar overlay and closing-squall alert | Their free API is personal and non-commercial. Get a commercial agreement with RainViewer (or a BOM radar licence and a BOM source) before launch, then set `VITE_RADAR_LICENSED=1`. To ship without radar, set `VITE_RADAR_SOURCE=off`. |
| GBRMPA reef features (planner) | Passage planner reef avoidance | CC BY 4.0. Download the "Great Barrier Reef Features" GeoJSON and run `npm run build:reefs -- path/to/file.geojson` (writes `public/reefs/gbr.json`, bundled into the app). Without it, the planner warns that routes don't avoid reefs. Credit GBRMPA. |
| ntfy (remote watch) | Second-phone alarms | The public ntfy.sh is free but rate-limited, so it suits testing. For launch, buy an ntfy plan or self-host, and set `VITE_REMOTE_WATCH_SERVER`. |

For the store build, add `VITE_LICENSED_IMAGERY_ONLY=1` to `.env.production.local`.
It hides every map source above that has no licence and saves offline packs from
MapTiler only. With it on and no keys set, the map has no satellite layer, so
add at least `VITE_MAPTILER_KEY`.

## 9b. Seabed depth (3D view, depth shading, shallow-water warnings)

The app uses AWS Terrain Tiles by default (open data; credit is shown). Around reefs they
show the reef and its drop-off at a few hundred metres. For sharper Great Barrier Reef depth,
convert the free GBR depth models (James Cook University "gbr100", 100 m, or Geoscience
Australia "AusBathyTopo GBR 30 m", both CC BY) into terrarium-encoded PNG tiles
(height = R x 256 + G + B / 256 - 32768 m), host them, and build with:

    VITE_DEPTH_TILES=https://your-host/gbr100/{z}/{x}/{y}.png  VITE_DEPTH_MAX_Z=14

GDAL (gdalwarp to EPSG:3857) plus a terrarium tile encoder does the conversion. Credit the
dataset in the store listing. The sand/coral layer appears only when you set
`VITE_BENTHIC_WMS` and `VITE_BENTHIC_LAYERS` to an Allen Coral Atlas map service you have
confirmed you may use.

## 9c. Chart base map (vector)

The "Chart" and "Photo + lines" modes use OpenStreetMap vector tiles (OpenMapTiles schema),
from OpenFreeMap by default (free, no key). Check OpenFreeMap's current terms for an app in
the stores; for certainty, host your own extract (for example a Protomaps or OpenMapTiles
file for Australia) and build with `VITE_CHART_TILES=<your TileJSON URL>` and
`VITE_CHART_GLYPHS=<font URL with {fontstack}/{range}.pbf>`. Credit "© OpenStreetMap
contributors" (shown on the map).

## 10. Test before you submit

- **Satellite photos on a real phone:** at a reef you know, compare Sharp photos on and off
  (View panel). Check bommies are crisper with it on, and note data use in the phone's
  settings over 10 minutes each way. Then turn on aeroplane mode over a saved pack: there
  should be no blank squares at any zoom. Save one "Max" pack and check it stays sharp offline.
- **Photo date:** in the View panel, "Photo at chart centre" should show a date and
  resolution over Esri (Maxar) imagery. It couldn't be tested during development; if it
  always says "date not published", the metadata service reply needs checking.

- **Purchases:** Apple sandbox testers (App Store Connect → Users and Access →
  Sandbox) and Google license testers (Play Console → Settings → License
  testing). Sandbox trials and renewals run fast (a year renews every hour),
  so you can see the whole cycle in an afternoon. Test **Restore purchases** on a second device.
- **Anchor alarm with the screen locked**, on a real iPhone and a real Android
  phone. Set an anchor with a small swing radius, lock the phone, walk away, and
  confirm the alarm notification arrives. Repeat with battery saver on.
  This is the feature people pay for, so test it at sea before launch.
- **Offline:** turn on aeroplane mode with a subscription active; the app should stay unlocked,
  and the weather panel should show the last forecast with a "No signal" badge.
- **Alarm volume:** with the ringer switch on silent (iPhone) and in Do Not Disturb,
  check the drag alarm still sounds (see section 7a). The Anchor panel shows
  whether the alarm can break through on that phone.
- **Battery:** an overnight anchor watch uses the GPS once a second. Recommend a charger
  in the app description.

## 11. Store listing checklist

- [ ] App name, subtitle, description (mention the free trial and annual price)
- [ ] Screenshots: iPhone 6.9" and 6.5", Android phone (take them from the real app)
- [ ] App icon (generated from `assets/icon-only.png`)
- [ ] Privacy policy URL and Terms of Use URL
- [ ] Support URL or email
- [ ] Category: Navigation (iOS) / Maps & Navigation (Android)
- [ ] Age rating questionnaire
- [ ] Subscription attached to the release and *Ready to Submit*
- [ ] Banking and tax set up in both stores
