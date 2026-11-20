# Weather and graphs: review and plan

Reviewed on a phone-sized screen (390 × 844) with a mocked 16-day forecast.

## What works

- Four models (ECMWF, GFS, ICON, UKMO) with on/off chips, plus gusts, tide, current and waves.
- Scrub the graph to read any hour; the card below shows each model, tide, waves and current.
- Day and night shading, moon card, offline revival of the last forecast, forecast at a pin.
- Tide and current alongside wind. Windy.com doesn't integrate tides at all, so this is a real
  strength for a boating app.

## Problems found

| # | Problem | Status |
| --- | --- | --- |
| 1 | Direction arrows for hours outside the visible window were clamped onto the graph edges, a pile of dozens of arrows at the left and right | **Fixed** |
| 2 | Time labels ran together ("12 PM6 PM") at the 2-day view | **Fixed** (about 6 labels per graph) |
| 3 | On a phone there is no obvious way into the forecast. The top bar with the wind reading is replaced by the steering bar, the wind strip is tablet-only, and the anchor card doesn't link to it. The only ways in are holding the chart or a 25 kn gust warning | To do |
| 4 | One graph carries everything: two wind models, gust lines, tide curve, current, waves, up to 60 arrows and two vertical scales. With all layers on it's unreadable | To do |
| 5 | Colour means "which model", not "how strong". You can't see at a glance which hours are windy | To do |
| 6 | Night shading is pure black and dominates the graph | To do |
| 7 | Rain, cloud, temperature and storm risk are fetched but not shown in the forecast (storm risk only in the passage planner). No swell vs wind sea split | To do |
| 8 | The header always shows "Hold the chart, then tap Forecast on the pin" instead of where the forecast is for | To do |

## What the leading apps do that we can learn from

- **Windy.com:** animated wind on the map with a time slider and play button; many layers
  (wind, gusts, rain, thunder/CAPE, waves, swell, currents, clouds, pressure); a meteogram per
  spot with stacked rows; a compare view showing each model for the same hour.
- **Windfinder:** live wind from coastal stations next to the forecast, so you see if the forecast
  is running high or low today; wind alerts.
- **Passage-planning apps:** many models, departure planning and routing (already built here).
- **Gaps in those apps we can fill:** integrated tides and currents, wind over tide, anchorage
  shelter, the anchor watch linked to the forecast, and official Australian marine warnings.

## Plan

### Phase 1: make the forecast easy to read (about 1 week)

1. **Always-visible Wind button** on the chart (top left, under MOB) showing wind now, e.g.
   "18 SE". Tap opens the forecast. Also link it from the anchor card.
2. **Stacked lanes instead of one graph**, one shared time axis and one scrub line across all:
   - Wind: speed line with a gust band, arrows every 3 h, fill colour by strength (Beaufort scale).
   - Sea: waves, with swell and wind sea separate, period printed.
   - Tide: curve with HW/LW times and heights.
   - Current: set arrows and rate, with a "wind against tide" stripe.
   - Rain and storms: rain bars, thunder icons from CAPE (risk 0–3, as in the planner).
   Lanes can be hidden, but each keeps its own scale, so turning one on never squashes another.
3. **Hourly table** (meteogram rows), swipe sideways: time, wind arrow, speed and gust
   cells coloured by strength, rain, waves, tide, storm. Colour cells read faster than lines.
4. **Models as a Compare tab**: a row per model per hour, plus a shaded spread band on the wind
   lane ("models agree" / "models differ by 8 kn").
5. Lighter night shading (dark blue, not black); header shows the place or "At the boat".

### Phase 2: weather on the chart (about 2 weeks)

6. **Animated wind on the map**: moving particles drawn from the gridded wind the planner
   already downloads (Open-Meteo grid), with a time slider and play button. Overlays for gusts,
   rain, waves and thunder risk, with a colour legend.
7. Tap anywhere on the map for a mini forecast card at that point (already partly there with the pin).

### Phase 3: better forecasts (2–3 weeks, some licensing)

8. **BOM ACCESS model**: the Australian Bureau's own model is available through Open-Meteo;
   add it as a fifth model, it's often best for local sea breezes and troughs.
9. **Ensembles**: show "chance of more than 25 kn tonight" from ensemble runs (Open-Meteo
   ensemble API), not just one line per model.
10. **Observations**: nearest BOM coastal station or buoy wind against the forecast for the last
    6 hours ("forecast running 4 kn light today"). Needs a BOM data licence. Feeds the local
    correction in docs/ai-plan.md 3.5.
11. **Official warnings**: BOM coastal waters forecast and strong wind, gale and storm warnings
    for the area shown as a banner (BOM licence).
12. **Wind alerts at anchor**: "tell me if tonight's forecast goes over 25 kn or swings more
    than 90°", checked on each forecast update, linked to the anchor watch.

## Sources

- Windy community, compare feature: https://community.windy.com/topic/9427/how-to-use-the-compare-feature/?page=1
- Windy community, model comparison view: https://community.windy.com/topic/7814/new-wind-map-gets-forecast-model-comparison-view
- Windy, how weather models work: https://www.windy.com/-numerical-weather-prediction-how-weather-models-turn-physical-equations-into-forecasts/articles/43915
- Yacht.de, weather apps for the 2026 season: https://www.yacht.de/en/sailing-knowledge/meteorology/apps-for-sailing-the-best-weather-apps-for-the-2026-season/
- Yachting Monthly, best weather apps for sailors: https://www.yachtingmonthly.com/gear/best-weather-apps-for-sailors-91944
