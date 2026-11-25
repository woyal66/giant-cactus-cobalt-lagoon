# Satellite imagery keys

Each licensed source turns on when its key is in the build; leave a key out and that source
simply isn't offered. All keys go in GitHub: **repository → Settings → Secrets and variables →
Actions → New repository secret**. Then run **Build Android release** (and **Publish website
and depth tiles** for the web app).

| Source | Secret name | Works offline? | Cost (check the provider's page before release) |
| --- | --- | --- | --- |
| Maxar (Esri) | `VITE_ESRI_KEY` | No (shown online) | Already set up |
| MapTiler Satellite | `VITE_MAPTILER_KEY` | **Yes**, offline packs | Paid plan for a published app |
| Google Satellite | `VITE_GOOGLE_TILES_KEY` | No | Per tile after a monthly free allowance |
| Microsoft aerial (Bing) | `VITE_AZURE_MAPS_KEY` | No | Per 1,000 tiles after a monthly free allowance |
| Mapbox Satellite | `VITE_MAPBOX_TOKEN` | No | Per tile after a monthly free allowance |
| HERE Satellite | `VITE_HERE_KEY` | No | Per tile after a monthly free allowance |

The keys end up inside the app, where a determined person can read them. That is normal for
map keys; what protects you is restricting each key to its one service and **setting a quota
and budget alert**, so a stolen key can't run up a bill.

## Google (Map Tiles API)

1. Go to console.cloud.google.com and sign in. Top bar → project picker → **New project**,
   name it `Anchor Mate`.
2. **Billing** → link a billing account (a card is required even inside the free allowance).
3. **APIs & Services → Library** → search **Map Tiles API** → **Enable**.
4. **APIs & Services → Credentials → Create credentials → API key**. Copy it.
5. Click the new key → **API restrictions → Restrict key** → tick only **Map Tiles API** → Save.
   (Leave "Application restrictions" on None: the app loads tiles from inside its web view,
   which Android/iOS app restrictions don't cover.)
6. **APIs & Services → Map Tiles API → Quotas**: set a daily request cap, e.g. 50,000.
7. **Billing → Budgets & alerts → Create budget**, e.g. A$20 a month, alerts at 50/90/100 %.
8. GitHub secret `VITE_GOOGLE_TILES_KEY` = the key.

In the app: Google appears in the photo list on its own. It is not mixed into "Auto" and is
never saved for offline use, because Google's terms forbid both. The copyright line for the
area in view is fetched from Google and shown in the map credits, as its terms require; read
the Map Tiles API policies page once before release to confirm the logo requirements.

## Microsoft / Bing aerial (Azure Maps)

1. Go to portal.azure.com and sign in (a free Azure account needs a card).
2. Search **Azure Maps Accounts** → **Create**. Subscription: yours; Resource group: new,
   `anchormate`; Name: `anchormate-maps`; Pricing tier: **Gen2**. Create.
3. Open the account → **Authentication** → copy the **Primary Key**.
4. **Cost Management → Budgets** → add a monthly budget with alerts.
5. GitHub secret `VITE_AZURE_MAPS_KEY` = the key.

## Mapbox Satellite

1. Go to account.mapbox.com and sign up.
2. **Tokens → Create a token**. Name `Anchor Mate`, keep only the public scopes
   (`styles:tiles`, `styles:read`, `fonts:read`, `datasets:read`). Create and copy (starts `pk.`).
3. Mapbox bills per tile above its free allowance; under **Billing**, check the current
   Static Tiles/raster pricing and set an alert.
4. GitHub secret `VITE_MAPBOX_TOKEN` = the token.

## HERE Satellite

1. Go to platform.here.com and sign up (choose the free Base plan).
2. **Access manager → Apps → Register new app**, name `Anchor Mate`.
3. Open the app → **API Keys → Create API key**. Copy it.
4. Check the plan's free monthly allowance and set usage alerts in the billing area.
5. GitHub secret `VITE_HERE_KEY` = the key.

## After adding keys

Run **Build Android release**, install the new APK, then View → photo source: each source with a
key now appears. If one shows blank tiles, the key is wrong or the service isn't enabled yet
(Google can take a few minutes after enabling).
