# Putting Anchor Mate on Google Play

Everything to copy and paste is in this file. Images are in this folder.
Do the steps in order. Things only you can do are marked **You**.

---

## Step 1 — Google Play developer account (**You**, about 1 hour plus Google's checks)

1. Go to <https://play.google.com/console/signup> and sign up as an **individual**.
2. Pay the one-off US$25 fee.
3. Verify your identity (Google asks for ID) and a phone number. This can take a few days.

> **Important for new personal accounts:** before the app can go public, Google requires a
> **closed test with at least 12 testers who stay opted in for 14 days in a row**. Line up
> 12 or more boating friends with Android phones (each needs a Gmail address). Step 7.

## Step 2 — Map key (**You**, 15 minutes) — needed for satellite photos

The store build only shows map sources the app is allowed to use. Without a key the
satellite photo is blank (the Chart map, weather, depth and alarms still work).

Free option: create an **ArcGIS Location Platform** account at
<https://location.arcgis.com/sign-up/> → create an **API key** with *Basemaps* access →
copy the key. (MapTiler is the alternative: <https://cloud.maptiler.com>, free plan,
copy the key.)

You'll paste it into GitHub in Step 4 as `VITE_ESRI_KEY` (or `VITE_MAPTILER_KEY`).

## Step 3 — Upload key (**You**, 10 minutes, once)

This is the file that proves updates come from you. Make it on any computer with Java
(or Android Studio: *Build → Generate Signed Bundle → Create new…*). In a terminal:

```bash
keytool -genkey -v -keystore anchormate-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Choose a strong password and write it down. **Keep the `.jks` file and password safe and
backed up** (not in the code). Google's *Play App Signing* holds the real app key, so if this
upload key is ever lost, Google can reset it — but that takes time.

Turn the file into text for GitHub:

```bash
base64 -w0 anchormate-upload.jks > anchormate-upload.txt
```

(On a Mac: `base64 -i anchormate-upload.jks -o anchormate-upload.txt`.)

## Step 4 — Secrets in GitHub (**You**, 5 minutes)

Repository → **Settings → Secrets and variables → Actions → New repository secret**. Add:

| Name | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | the whole contents of `anchormate-upload.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | the key password (same as above unless you chose another) |
| `VITE_ESRI_KEY` (or `VITE_MAPTILER_KEY`) | the map key from Step 2 |

## Step 5 — Build the upload file (**You** click, GitHub builds, about 10 minutes)

The `.github/workflows` files must be on the repository's default branch for the
**Run workflow** button to appear, so first merge this work into `main`.

Repository → **Actions → Android release build → Run workflow** → version `1.0.0` → Run.
When it finishes (green tick), open the run, and under **Artifacts** download
`anchor-mate-1.0.0-…`. Inside is `app-release.aab` — that's what you upload to Google.

Each later update: run it again with a higher version (1.0.1, 1.1.0 …). The build number
goes up by itself.

## Step 6 — Privacy policy page (**You**, 5 minutes)

Google needs a public web link to the privacy policy.

1. Edit `site/privacy.html` and `site/terms.html`: replace `CONTACT_EMAIL` with your
   support email (a new Gmail just for the app is fine).
2. Repository → **Settings → Pages → Source: GitHub Actions**.
3. **Actions → Publish privacy and terms pages → Run workflow.**
4. Your link is `https://woyal66.github.io/AnchorMate/privacy.html`.

(GitHub Pages needs the repository to be **public**, or a paid GitHub plan. If you'd rather
keep the code private, paste the text of `site/privacy.html` into a free Google Site and use
that link instead.)

## Step 7 — Create the app in Play Console (**You**, about 2 hours the first time)

**Create app** → name *Anchor Mate* → App → **Free** → accept the declarations.

### Main store listing (Grow → Store presence → Main store listing)

- **App name:** Anchor Mate
- **Short description (80 max):**
  `Anchor drag alarm, satellite reef charts, offline maps and passage weather.`
- **Full description:** (copy below)
- **App icon:** `icon-512.png`
- **Feature graphic:** `feature-graphic-1024x500.png`
- **Phone screenshots:** at least 2 (up to 8), taken on your phone: the chart with an anchor
  watch, the forecast, the weather layer, the passage planner, the Chart map, the MOB screen.
  (Press power + volume down to take a screenshot.)
- **Category:** Maps & Navigation. **Tags:** Boating, Navigation, Weather.
- **Contact email:** your support email. **Website:** your site link (optional).

Full description:

```
Anchor Mate keeps watch while you sleep and helps you find your way into the reef.

ANCHOR WATCH
• Set the anchor and swing circle on a satellite photo, or draw your own boundary.
• Loud drag alarm that keeps watching with the screen locked.
• GPS-lost alarm, so a dead fix never fails silently.
• Second-phone alarm: pair another phone to get the alarm in the cabin or ashore.

REEF PILOTAGE
• Sharp satellite photos, with a quick compare between photo sources.
• Plan a safe track into a lagoon by tapping waypoints, then follow it with turn-by-turn calls
  ("In 40 m turn 90° starboard") and cross-track.
• Record your way in and reverse it to get back out on the same water.
• Reef outlines and Great Barrier Reef marine park zones.
• Approximate seabed depth, with a "too shallow for my keel at this tide" view.
• 3D reef view to see channels and drop-offs.

WEATHER AND PASSAGES
• Wind, gusts, waves, swell, current, tide, rain and storm risk, hour by hour.
• Weather on the chart: moving wind, current arrows, isobars, rain and storm shading.
• Passage planner for sail and power: tap start and finish for the fastest, most
  comfortable or safest route, with tides, wind over tide and storm risk taken into account.
• Weather window finder for the next 10 days.

OFFLINE
• Save a reef: photos, chart, depth and 3 days of weather, for when there's no signal.

ALSO
• Man-overboard mark with drift prediction and recovery steps.
• Measure distances, search reefs and harbours, GPX import and export, backups.
• Large, clear text and night mode for older eyes and dark cockpits.

Free, no ads, no account. Your position stays on your phone.

Anchor Mate is a lookout aid, not an official chart. Always keep a proper watch and check
the official forecast.
```

### App content (Policy → App content) — answers

- **Privacy policy:** your link from Step 6.
- **Ads:** No.
- **App access:** All functionality available without special access.
- **Content rating:** questionnaire → category *Utility/Productivity/Other*; answer **No** to
  violence, sexuality, language, drugs, gambling, user-generated content and sharing location
  with other users (Remote watch only goes to your own paired phones). Expected rating: Everyone.
- **Target audience:** 18 and over. Not designed for children.
- **News app:** No. **Government app:** No. **Financial features:** none. **Health:** none.
- **Data safety:**
  - Does the app collect or share user data? **Yes**.
  - **Location → Precise location:** *Collected* (sent to weather and map services to fetch
    the area you're viewing). Not shared for advertising. Purpose: **App functionality**.
    Processed ephemerally: No (you can't promise what those services log). Required: Yes.
  - Remote watch (optional): the alert includes the boat position. Covered by the same
    Location entry; mention "optional second-phone alerts" if asked.
  - Encrypted in transit: **Yes**. Users can request deletion: data is on the phone —
    choose **No** (there's no account; uninstalling deletes everything) and say so.
  - No personal info, financial info, contacts, photos, messages or app activity collected.
- **Foreground service permissions:** the app uses a **Location** foreground service.
  Choose *"User-initiated location sharing / Navigation"* style task and explain:
  > "Anchor drag alarm and navigation. While the user has set an anchor watch, is recording
  > a track or following a route, the app tracks the boat's position with the screen off and
  > sounds an alarm if the boat drags outside the swing circle, and gives steering cues on a route. A
  > notification is shown the whole time and the service stops when the watch ends."

  Google asks for a short **video** (a phone screen recording is fine, 30–60 s): set an
  anchor watch, lock the phone, show the notification, unlock, stop the watch. Upload it to
  YouTube as *Unlisted* and paste the link.
- **Exact alarms:** not needed; if asked, the app doesn't rely on exact alarms.

### Closed test (Test and release → Testing → Closed testing)

1. Create a track, upload `app-release.aab`, release notes: *First test version.*
2. **Testers:** make an email list of your 12+ testers. Send them the opt-in link.
3. Keep it running **14 days** with at least 12 testers opted in. Ask them to actually use it
   (an anchor watch overnight is the best test) and send you feedback.

### Production (after the 14 days)

**Dashboard → Apply for production** → answer Google's short questions about the test →
once approved, **Production → Create new release** → upload the same or a newer `.aab` →
countries: start with Australia (add more later) → **Review and roll out**.
Google's review usually takes a few days.

---

## Before you upload: check on your own phone

Install the test version from the closed-test link and check:

1. Anchor watch with the **screen locked**: walk away from a small circle, the alarm sounds.
2. The notification permission prompt appears on first watch, and the alarm sounds with
   the phone on silent (Android: the *Anchor alarm* notification channel).
3. Satellite photos load (your map key works).
4. Top bar and bottom dock are clear of the status bar and gesture bar.
5. Save a reef offline, turn on aeroplane mode, and check photos, chart, depth and weather.
