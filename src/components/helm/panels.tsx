import { HazardCheck } from "@/components/helm/hazard-check";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALARM_SOUNDS, previewAlarm } from "@/lib/alarm";
import {
  formatScope,
  hoursUntil,
  rodeMath,
  suggestedPayOutM,
} from "@/lib/anchor";
import { bowFromGps, gpsReachM, gpsStationLabel } from "@/lib/boat";
import { formatDuration, routeSummary } from "@/lib/measure";
import { nearestPlaceName, searchPlaces, zoomToFit, type Place } from "@/lib/place-search";
import { loadHazards } from "@/lib/hazards";
import { LIMITS, libraryConfig, removeFromLibrary, shareToLibrary } from "@/lib/track-library";
import { LibraryTab } from "@/components/helm/library-tab";
import { Radio } from "lucide-react";
import { formatMeters, haversineMeters, pathLengthMeters, trackInView, TRACK_CHORD_PRESETS, TRACK_TURN_PRESETS } from "@/lib/geo";
import { BENTHIC_WMS, GARMIN_SDK_URL, PARK_ZONES, availableImagery, imageryShort, isImageryId } from "@/lib/imagery";
import { centreTileSource, getChartBounds } from "@/components/helm/map-view";
import { SOURCE_NOTE, describePhoto, fetchEsriPhotoInfo } from "@/lib/imagery-info";
import { AnchorWxCard } from "@/components/helm/weather";
import {
  boxAround,
  cancelPackDownload,
  deletePack,
  downloadPack,
  estimatePack,
  formatBytes,
  listPacks,
  packName,
  packOnPhone,
  PACK_ZOOMS,
  type PackZoom,
} from "@/lib/offline-tiles";
import type { Passage } from "@/lib/passages";
import { fetchTideRise } from "@/lib/tides";
import { STEER_PRESETS } from "@/lib/steer";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { isNativeApp } from "@/lib/native";
import { shareGpx } from "@/lib/share-gpx";
import { restoreBackup, saveBackup } from "@/lib/backup-actions";
import { dedupeLines, parseGpx } from "@/lib/gpx-import";
import { mergeTracks } from "@/lib/backup";
import { UnitStepField } from "@/components/helm/unit-field";
import { MoonCard } from "@/components/helm/moon-card";
import { RemoteWatchCard } from "@/components/helm/remote-watch-card";
import { formatDepth, formatLength } from "@/lib/units";
import { criticalAlerts, type CriticalStatus } from "@/lib/critical-alert";
import { openLocationSettings } from "@/lib/background-gps";
import { isFreeApp, isPreview } from "@/lib/subscription";
import { radarAvailable } from "@/lib/radar";
import { SubscriptionRow } from "@/components/subscription";
import { simulateAnchorDrag, unlockAlarmAudio } from "@/hooks/helm-runtime";
import { nextTrackName, useHelm, useUnitsKey, type LocalDraft, type PanelId } from "@/store/helm";

export function Sheet({
  id,
  title,
  kicker,
  help,
  compact,
  children,
}: {
  id: NonNullable<PanelId>;
  title: string;
  /** Short context, read out to screen readers; not shown, to keep the heading to one row. */
  kicker?: string;
  /** "How this works" text, behind an ⓘ button instead of always taking space. */
  help?: ReactNode;
  /** Open low (about a third of the screen) so the chart stays visible; the handle makes it taller. */
  compact?: boolean;
  children: ReactNode;
}) {
  const panel = useHelm((s) => s.panel);
  const setPanel = useHelm((s) => s.setPanel);
  const [tall, setTall] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  useUnitsKey();
  if (panel !== id) return null;
  const height = tall ? "max-h-[78vh]" : compact ? "max-h-[min(34vh,20rem)]" : "max-h-[min(46vh,24rem)]";
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 md:inset-y-20 md:right-3 md:bottom-24 md:left-auto md:w-[22rem]">
      <div
        className={`pointer-events-auto ${height} overflow-y-auto rounded-t-xl border border-border bg-card px-3 pt-1 pb-[max(0.6rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))] shadow-[var(--shadow-border)] md:max-h-[min(72vh,36rem)] md:rounded-xl md:p-4`}
        aria-label={kicker ? `${title}: ${kicker}` : title}
      >
        <button
          type="button"
          onClick={() => setTall((t) => !t)}
          aria-label={tall ? "Make this panel shorter" : "Make this panel taller"}
          className="mx-auto mb-1 flex h-5 w-16 items-center justify-center md:hidden"
        >
          <span className="h-1 w-10 rounded-full bg-muted-foreground/60" />
        </button>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="font-display truncate text-xl leading-none font-semibold tracking-tight">{title}</h2>
            {help ? (
              <button
                type="button"
                onClick={() => setShowHelp((v) => !v)}
                aria-expanded={showHelp}
                aria-label={`How ${title.toLowerCase()} works`}
                className={`grid size-8 shrink-0 place-items-center rounded-full border text-t14 font-semibold ${showHelp ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
              >
                i
              </button>
            ) : null}
          </div>
          <Button variant="outline" size="sm" className="h-10 min-w-16 px-3" onClick={() => setPanel(null)}>
            Close
          </Button>
        </div>
        {help && showHelp ? <div className="mb-2 rounded-md bg-muted px-2.5 py-2 text-t14 leading-snug">{help}</div> : null}
        {children}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-left"
    >
      <span className="text-sm">{label}</span>
      {/* A real switch reads at a glance in glare; the word stays for colour-blind users. */}
      <span className="flex shrink-0 items-center gap-2">
        <span className={`text-t13 font-semibold ${on ? "text-primary" : "text-muted-foreground"}`}>
          {on ? "On" : "Off"}
        </span>
        <span
          aria-hidden
          className={`relative h-6 w-10 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted"}`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full shadow transition-transform ${
              // No white at night: it would wreck night vision on the red screen.
              on
                ? "translate-x-[1.125rem] bg-white in-[.rp-night]:bg-[#1a0904]"
                : "translate-x-0.5 bg-white in-[.rp-night]:bg-[#9a4318]"
            }`}
          />
        </span>
      </span>
    </button>
  );
}

export function AnchorPanel() {
  const boat = useHelm((s) => s.boat);
  const anchor = useHelm((s) => s.anchor);
  const alarmOn = useHelm((s) => s.alarmOn);
  const gpsLost = useHelm((s) => s.gpsLost);
  const gpsAlarmOn = useHelm((s) => s.gpsAlarmOn);
  const setGpsAlarmOn = useHelm((s) => s.setGpsAlarmOn);
  const [gpsOffAsk, setGpsOffAsk] = useState(false);
  const [stopAsk, setStopAsk] = useState(false);
  const muted = useHelm((s) => s.alarmMuted);
  const weigh = useHelm((s) => s.weighAnchor);
  const startPlaceHook = useHelm((s) => s.startPlaceHook);
  const startResizeSwing = useHelm((s) => s.startResizeSwing);
  const startDrawFence = useHelm((s) => s.startDrawFence);
  const clearFence = useHelm((s) => s.clearFence);
  const setMuted = useHelm((s) => s.setAlarmMuted);
  const rode = useHelm((s) => s.rode);
  const swingTrailOn = useHelm((s) => s.swingTrailOn);
  const setSwingTrailOn = useHelm((s) => s.setSwingTrailOn);
  const setRode = useHelm((s) => s.setRode);
  const hull = useHelm((s) => s.hull);
  const setPanel = useHelm((s) => s.setPanel);
  const alarmSound = useHelm((s) => s.alarmSound);
  const setAlarmSound = useHelm((s) => s.setAlarmSound);
  const bow = boat ? bowFromGps(boat, boat.heading, hull) : null;
  const distM = bow && anchor ? haversineMeters(bow, anchor) : 0;
  const dist = bow && anchor ? formatMeters(distM) : null;
  const math = rodeMath(rode, gpsReachM(hull));
  const loc = anchor ?? boat;
  const pay = suggestedPayOutM(rode, math);
  const letMoreM = Math.round((pay - rode.chainM) * 10) / 10;

  const tide = useQuery({
    queryKey: ["tide-rise", loc?.lat.toFixed(3), loc?.lng.toFixed(3)],
    queryFn: () => fetchTideRise(loc!.lat, loc!.lng),
    enabled: Boolean(loc),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    if (!tide.data || rode.tideManual) return;
    const d = tide.data;
    if (Math.abs(rode.tideRiseM - d.riseM) < 0.05 && rode.tideHighAt === d.highAt) {
      return;
    }
    setRode({ tideRiseM: d.riseM, tideHighAt: d.highAt, tideManual: false });
  }, [tide.data, rode.tideManual, rode.tideRiseM, rode.tideHighAt, setRode]);

  return (
    <Sheet
      id="anchor"
      title="Anchor"
      kicker="Mark the hook"
      compact
      help="The boat icon is where the boat has fallen back to. Chain is measured from the bow. Set the depth and chain out, then drag on the chart to where the anchor is."
    >
      {anchor?.radiusLocked ? (
        stopAsk ? (
          <div className="mb-2 rounded-lg border border-destructive/50 bg-destructive/10 p-2">
            <p className="text-center text-sm font-medium">Stop the anchor watch?</p>
            <p className="mt-0.5 text-center text-t13 text-muted-foreground">
              The drag alarm won't sound until you set it again.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setStopAsk(false)}>
                Keep watching
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setStopAsk(false);
                  weigh();
                  setPanel(null);
                }}
              >
                Stop watch
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" className="mb-2 w-full" onClick={() => setStopAsk(true)}>
            Stop watch
          </Button>
        )
      ) : null}
      <div className="mb-2 grid grid-cols-2 gap-2">
        <UnitStepField label="Depth" kind="depth" valueM={rode.depthM} steps={{ m: 0.2, ft: 1, fm: 0.5 }} onChange={(n) => setRode({ depthM: n })} />
        <UnitStepField label="Chain out" kind="length" valueM={rode.chainM} steps={{ m: 5, ft: 10 }} onChange={(n) => setRode({ chainM: n })} />
      </div>
      <div className="mb-2 rounded-lg border border-border bg-background px-3 py-2">
        <div className="flex items-baseline justify-between">
          <p className="text-t12 text-muted-foreground">Layback</p>
          <p className="font-display text-2xl font-semibold tabular-nums">{formatLength(math.laybackM)}</p>
        </div>
        <p className="mt-0.5 text-t13 text-muted-foreground">
          Chain on the sand: {formatLength(rode.chainM)} − {formatDepth(rode.depthM)} −{" "}
          {formatDepth(rode.bowM)} bow. Taut swing {formatLength(math.radiusM)}.
        </p>
      </div>
      {boat || anchor ? <AnchorWxCard /> : null}
      <MoonCard compact />
      <RemoteWatchCard />
      {anchor ? (
        <div className="mb-2 grid gap-2">
          <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
            <div>
              <p className="text-t12 text-muted-foreground">Distance</p>
              <p className="font-display text-xl font-semibold tabular-nums">
                {dist ?? "—"}
                <span className="ml-1 text-xs font-medium text-muted-foreground">
                  {Math.abs(distM - math.laybackM) <= 8 ? "on rode" : `want ${formatLength(math.laybackM)}`}
                </span>
              </p>
            </div>
            <Badge variant={alarmOn || gpsLost ? "danger" : "holding"}>
              {alarmOn ? "Dragging" : gpsLost ? "GPS lost" : "Holding"}
            </Badge>
          </div>
          <ToggleRow
            label="GPS lost alarm"
            on={gpsAlarmOn}
            onChange={(on) => {
              if (on) {
                setGpsAlarmOn(true);
                setGpsOffAsk(false);
              } else setGpsOffAsk(true);
            }}
          />
          {gpsOffAsk ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-2.5 py-2">
              <p className="text-t13 leading-snug text-destructive">
                A dead fix will not warn you at anchor or on a cut until you turn this back on.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => setGpsOffAsk(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setGpsAlarmOn(false);
                    setGpsOffAsk(false);
                  }}
                >
                  Turn off
                </Button>
              </div>
            </div>
          ) : null}
          <ToggleRow label="Swing trail" on={swingTrailOn} onChange={setSwingTrailOn} />
          <p className="text-t13 leading-snug text-muted-foreground">
            {isNativeApp()
              ? "Lock the phone and sleep: the watch keeps checking the GPS with the screen off. The alarm needs the boat outside the circle for 12 s, and ignores fixes too vague to judge. GPS lost sounds after 60 s without a fix. Keep the phone on charge, and don't swipe Anchor Mate closed."
              : "In a browser the watch only runs while this page is open and the screen is on. Install the Anchor Mate app to keep watch with the phone locked."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => startPlaceHook()}>
              Move hook
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                unlockAlarmAudio();
                startResizeSwing();
              }}
            >
              Swing size
            </Button>
            <Button variant="outline" size="sm" onClick={() => startDrawFence()}>
              Draw barrier
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!anchor.fence}
              onClick={() => clearFence()}
            >
              Clear barrier
            </Button>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={() => setMuted(!muted)}>
            {muted ? "Unmute" : "Silence"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              simulateAnchorDrag();
              toast("Test: the alarm sounds in about 12 s. Live GPS pauses for 30 s, then the watch carries on.");
            }}
          >
            Test drag alarm
          </Button>
          <p className="text-t12 text-muted-foreground">Alarm</p>
          <AlarmReach />
          <div className="grid grid-cols-3 gap-1.5">
            {ALARM_SOUNDS.map((s) => (
              <Button
                key={s.id}
                variant={alarmSound === s.id ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setAlarmSound(s.id);
                  previewAlarm(s.id);
                }}
              >
                {s.name}
              </Button>
            ))}
          </div>
          {math.shortHwM > 0.4 ? (
            <p className="text-xs text-destructive">
              Short of {formatScope(rode.scopeTarget)} at HW
              {letMoreM > 0 ? ` — pay ${formatLength(letMoreM)} more` : ""}.
              {rode.tideHighAt ? ` High ${hoursUntil(rode.tideHighAt)}.` : ""}
            </p>
          ) : null}
        </div>
      ) : (
        <Button
          className="w-full"
          onClick={() => {
            unlockAlarmAudio();
            useHelm.getState().beginAnchorSet();
          }}
        >
          Set hook
        </Button>
      )}
      <button
        type="button"
        onClick={() => setPanel("boat")}
        className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-left"
      >
        <p className="text-t12 text-muted-foreground">Hull · GPS</p>
        <p className="font-display text-sm font-semibold">{gpsStationLabel(hull)}</p>
      </button>
    </Sheet>
  );
}

export function LayersPanel() {
  const imagery = useHelm((s) => s.imagery);
  const setImagery = useHelm((s) => s.setImagery);
  const labels = useHelm((s) => s.labels);
  const setLabels = useHelm((s) => s.setLabels);
  const graticule = useHelm((s) => s.graticule);
  const setGraticule = useHelm((s) => s.setGraticule);
  const seamarks = useHelm((s) => s.seamarks);
  const setSeamarks = useHelm((s) => s.setSeamarks);
  const depths = useHelm((s) => s.depths);
  const setDepths = useHelm((s) => s.setDepths);
  const reefOutlines = useHelm((s) => s.reefOutlines);
  const parkZones = useHelm((s) => s.parkZones);
  const setParkZones = useHelm((s) => s.setParkZones);
  const setReefOutlines = useHelm((s) => s.setReefOutlines);
  const officialCharts = useHelm((s) => s.officialCharts);
  const setOfficialCharts = useHelm((s) => s.setOfficialCharts);
  const radar = useHelm((s) => s.radar);
  const baseMap = useHelm((s) => s.baseMap);
  const sharpTiles = useHelm((s) => s.sharpTiles);
  const setSharpTiles = useHelm((s) => s.setSharpTiles);
  const reefClarity = useHelm((s) => s.reefClarity);
  const setReefClarity = useHelm((s) => s.setReefClarity);
  const setRadar = useHelm((s) => s.setRadar);
  const crumbOn = useHelm((s) => s.crumbOn);
  const setCrumbOn = useHelm((s) => s.setCrumbOn);
  const crumb = useHelm((s) => s.crumb);
  const clearCrumb = useHelm((s) => s.clearCrumb);
  const reverseTrack = useHelm((s) => s.reverseTrack);
  const look = useHelm((s) => s.look);
  const setLook = useHelm((s) => s.setLook);
  const autoNight = useHelm((s) => s.autoNight);
  const setAutoNight = useHelm((s) => s.setAutoNight);
  const sunPunch = useHelm((s) => s.sunPunch);
  const setSunPunch = useHelm((s) => s.setSunPunch);
  const tapMode = useHelm((s) => s.tapMode);
  const setTapMode = useHelm((s) => s.setTapMode);
  const setPanel = useHelm((s) => s.setPanel);

  return (
    <Sheet id="layers" title="View" kicker="Map stays up">
      <div className="mb-2 flex items-center justify-between gap-2">
        {isNativeApp() || isPreview() ? (
          isFreeApp() ? null : <SubscriptionRow />
        ) : (
          <>
            <SignedIn>
              <UserButton />
            </SignedIn>
            <SignedOut>
              <Button asChild variant="outline" size="sm">
                <Link to="/login">Sign in</Link>
              </Button>
            </SignedOut>
          </>
        )}
      </div>
      <div className="mb-1.5 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Base map">
        {(
          [
            ["photo", "Photo"],
            ["chart", "Chart"],
            ["lines", "Photo + lines"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            role="radio"
            aria-checked={baseMap === id}
            variant={baseMap === id ? "default" : "outline"}
            className="h-11 px-1"
            onClick={() => useHelm.setState({ baseMap: id })}
          >
            {label}
          </Button>
        ))}
      </div>
      {/* Compact picker: tap to flip between photos and compare. */}
      <div className="mb-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Satellite photo">
        {availableImagery().map((im) => (
          <button
            key={im.id}
            type="button"
            role="radio"
            aria-checked={imagery === im.id}
            title={im.detail}
            onClick={() => setImagery(im.id)}
            className={`flex min-h-11 min-w-0 items-center gap-1.5 rounded-md border px-1.5 text-left ${
              imagery === im.id ? "border-primary bg-primary/15" : "border-border bg-background"
            }`}
          >
            <span
              className="grid size-6 shrink-0 place-items-center rounded font-display text-t13 font-semibold"
              style={{ background: im.markBg, color: im.markFg }}
              aria-hidden
            >
              {im.mark}
            </span>
            <span className="min-w-0 truncate text-t14 font-semibold">{imageryShort(im.id)}</span>
          </button>
        ))}
      </div>
      <OfflinePacks />
      <TrackSteerSettings />
      <div className="mb-2 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setTapMode(tapMode === "place-boat" ? "none" : "place-boat");
            setPanel(null);
          }}
        >
          Place boat
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPanel("boat")}>
          Boat
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPanel("legend")}>
          Colour guide
        </Button>
      </div>
      <div className="mb-2 grid gap-1.5">
        <Button variant="outline" className="h-11" onClick={() => useHelm.setState({ reef3d: true, panel: null })}>
          3D reef view
        </Button>
        <DepthRow />
        <TextSizeRow />
        <PhotoInfoRow />
        <ToggleRow label="Sharp photos (HD, about 4× the data)" on={sharpTiles} onChange={setSharpTiles} />
        <ToggleRow label="Reef clarity (more contrast to read depth)" on={reefClarity} onChange={setReefClarity} />
        <ToggleRow label="Place names" on={labels} onChange={setLabels} />
        <ToggleRow label="Lat / long lines" on={graticule} onChange={setGraticule} />
        <ToggleRow label="Seamarks" on={seamarks} onChange={setSeamarks} />
        <ToggleRow label="Depth contours" on={depths} onChange={setDepths} />
        <ToggleRow label="Reefs, rocks and cays (GBR, offline)" on={reefOutlines} onChange={setReefOutlines} />
        <ToggleRow label="Official charts where free (USA: NOAA)" on={officialCharts} onChange={setOfficialCharts} />
        <ToggleRow label="Marine park zones (GBR)" on={parkZones} onChange={setParkZones} />
        {parkZones ? <ZoneLegend /> : null}
        {radarAvailable() ? <ToggleRow label="Rain radar (needs signal)" on={radar} onChange={setRadar} /> : null}
        <ToggleRow label="Yellow line while recording" on={crumbOn} onChange={setCrumbOn} />
      </div>
      {crumb.length >= 2 ? (
        <div className="mb-2 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => reverseTrack()}>
            Reverse trail
          </Button>
          <Button variant="ghost" size="sm" onClick={() => clearCrumb()}>
            Clear trail
          </Button>
        </div>
      ) : null}
      <p className="mb-1.5 text-t12 text-muted-foreground">Look</p>
      <div className="mb-2 grid grid-cols-4 gap-2">
        <Button
          variant={autoNight ? "default" : "outline"}
          size="sm"
          onClick={() => setAutoNight(!autoNight)}
          aria-pressed={autoNight}
        >
          Auto
        </Button>
        {([
          ["normal", "Normal"],
          ["sunlight", "Sun"],
          ["night", "Night"],
        ] as const).map(([id, label]) => (
          <Button
            key={id}
            variant={!autoNight && look === id ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setAutoNight(false);
              setLook(id);
              if (id === "sunlight") {
                void document.documentElement.requestFullscreen?.().catch(() => {});
              } else if (document.fullscreenElement) {
                void document.exitFullscreen?.().catch(() => {});
              }
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <UnitsPicker />
      <Button
        variant="outline"
        size="sm"
        className="mb-2 w-full"
        onClick={() => {
          setPanel(null);
          useHelm.getState().setGuideDone(false);
        }}
      >
        Show the getting-started guide
      </Button>
      {look === "sunlight" ? (
        <div className="mb-2 grid grid-cols-3 gap-2">
          {([1, 2, 3] as const).map((n) => (
            <Button key={n} variant={sunPunch === n ? "default" : "outline"} size="sm" onClick={() => setSunPunch(n)}>
              Punch {n}
            </Button>
          ))}
        </div>
      ) : null}
      <p className="text-t13 leading-snug text-muted-foreground">
        OpenSeaMap marks and depth contours sit over the satellite. Official Navionics tiles need Garmin’s native marine SDK — there is no web login that unlocks them here.{" "}
        <a href={GARMIN_SDK_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          Garmin marine SDK
        </a>
      </p>
    </Sheet>
  );
}

function OfflinePacks() {
  const boat = useHelm((s) => s.boat);
  const packBox = useHelm((s) => s.packBox);
  const packs = useHelm((s) => s.offlinePacks);
  const setPacks = useHelm((s) => s.setOfflinePacks);
  const setPackBox = useHelm((s) => s.setPackBox);
  const startDrawPack = useHelm((s) => s.startDrawPack);
  const fly = useHelm((s) => s.fly);
  const [maxZ, setMaxZ] = useState<PackZoom>(18);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; bytes: number } | null>(null);
  const [extraStep, setExtraStep] = useState<string | null>(null);

  const refresh = () => {
    void listPacks().then(setPacks);
  };

  useEffect(() => {
    void listPacks().then(setPacks);
  }, [setPacks]);

  useEffect(() => {
    if (!packBox) return;
    setName(packName(packBox));
  }, [packBox]);

  const box = packBox;
  const est = box ? estimatePack(box, maxZ) : null;
  const here = boat ? packOnPhone(packs, boat.lat, boat.lng) : null;

  const run = async () => {
    if (!box || !est || est.tooWide) return;
    setBusy(true);
    setProgress({ done: 0, total: 1, bytes: 0 });
    try {
      const pack = await downloadPack(box, maxZ, name.trim() || packName(box), setProgress);
      const label = name.trim() || packName(box);
      // Then the rest of the region: seabed, Chart map and weather, so those work offline too.
      setExtraStep("Seabed depth");
      const { saveRegionExtras } = await import("@/lib/region-pack");
      const extras = await saveRegionExtras(box, setExtraStep);
      const missingParts = [extras.depthTiles ? null : "seabed", extras.chartTiles ? null : "chart map", extras.weather ? null : "weather"].filter(Boolean);
      if (pack.missing) {
        toast.warning(`${label} saved with ${pack.missing} photo tiles missing. Download again to fill gaps.`);
      } else if (missingParts.length) {
        toast.warning(`${label} saved. Couldn't save the ${missingParts.join(", ")}: those need a signal there.`);
      } else {
        toast.success(`${label} on this phone: photos, seabed, chart map and 3 days of weather`);
      }
      setPackBox(null);
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Download stopped";
      if (msg !== "cancelled" && !/AbortError/.test(String(err))) toast.error(msg);
    } finally {
      setBusy(false);
      setProgress(null);
      setExtraStep(null);
    }
  };

  const pickReef = (lat: number, lng: number, reefName: string, radiusM: number) => {
    const b = boxAround({ lat, lng }, radiusM);
    setPackBox(b);
    setName(reefName);
    fly(lat, lng, 16);
  };

  return (
    <div className="mb-2 rounded-lg border border-border bg-background px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-t12 text-muted-foreground">Offline packs</p>
        {here ? (
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-t12 font-semibold text-emerald-400">
            On phone
          </span>
        ) : (
          <span className="text-t12 text-muted-foreground">Not on phone</span>
        )}
      </div>
      <p className="mt-0.5 text-t13 leading-snug text-muted-foreground">
        Zoom out, then drag a box around the reef. A line will not download. z16 covers a whole cay. Green = this water is in the phone.
      </p>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => startDrawPack()}>
          Draw box
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => pickReef(-23.904, 152.395, "Lady Musgrave", 2200)}
        >
          Lady Musgrave
        </Button>
      </div>
      {box && est ? (
        <div className="mt-2 grid gap-1.5 rounded-md border border-border px-2 py-1.5">
          <label className="grid gap-1">
            <span className="text-t12 text-muted-foreground">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
          </label>
          <p className="text-t12 text-muted-foreground">Close-up zoom</p>
          <div className="grid grid-cols-5 gap-1">
            {PACK_ZOOMS.map((z) => (
              <Button key={z} variant={maxZ === z ? "default" : "outline"} size="sm" className="h-8" onClick={() => setMaxZ(z)}>
                {z === 20 ? "Max" : `z${z}`}
              </Button>
            ))}
          </div>
          {maxZ === 20 ? (
            <p className="text-t13 text-muted-foreground">
              Maximum detail: as sharp offline as online with Sharp photos on. About 4× the size of z19; keep the area small.
            </p>
          ) : null}
          <p className="text-t13 tabular-nums text-muted-foreground">
            {est.km.toFixed(1)} km · z16–{est.maxZ} · {est.tiles.toLocaleString()} tiles · {formatBytes(est.bytes)}
            {est.tooWide ? " — too big or too thin. Use z16 for a whole reef." : ""}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <Button size="sm" disabled={busy || est.tooWide} onClick={() => void run()}>
              Download
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setPackBox(null)}>
              Clear box
            </Button>
          </div>
        </div>
      ) : null}
      {busy && progress ? (
        <div className="mt-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-t13 tabular-nums text-muted-foreground">
              {extraStep ? `Saving ${extraStep.toLowerCase()}…` : `Photos ${progress.done}/${progress.total} · ${formatBytes(progress.bytes)}`}
            </p>
            <Button variant="ghost" size="sm" className="h-7" onClick={() => cancelPackDownload()}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {packs.length ? (
        <ul className="mt-1.5 grid gap-1">
          {packs.map((p) => {
            const on = Boolean(boat && packOnPhone([p], boat.lat, boat.lng));
            return (
              <li
                key={p.id}
                className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1 ${
                  on ? "border-emerald-500/50 bg-emerald-500/10" : "border-border"
                }`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-xs"
                  onClick={() =>
                    fly((p.bounds.south + p.bounds.north) / 2, (p.bounds.west + p.bounds.east) / 2, Math.min(18, p.maxZ))
                  }
                >
                  <span className={on ? "text-emerald-400" : ""}>{p.name}</span>
                  <span className="ml-1 text-muted-foreground">
                    z{p.maxZ} · {formatBytes(p.bytes)}
                    {on ? " · here" : ""}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0"
                  disabled={busy}
                  onClick={() => {
                    void deletePack(p.id).then(() => {
                      refresh();
                      toast.message("Pack removed");
                    });
                  }}
                >
                  Delete
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function TrackSteerSettings() {
  const sense = useHelm((s) => s.steerSense);
  const setSense = useHelm((s) => s.setSteerSense);
  const ear = useHelm((s) => s.steerEar);
  const setEar = useHelm((s) => s.setSteerEar);
  const turnDeg = useHelm((s) => s.trackTurnDeg);
  const setTurnDeg = useHelm((s) => s.setTrackTurnDeg);
  const chordM = useHelm((s) => s.trackChordM);
  const setChordM = useHelm((s) => s.setTrackChordM);

  return (
    <div className="mb-2 rounded-lg border border-border bg-background px-2.5 py-2">
      <p className="text-t12 text-muted-foreground">Track steer</p>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {(Object.keys(STEER_PRESETS) as Array<keyof typeof STEER_PRESETS>).map((id) => (
          <Button key={id} variant={sense === id ? "default" : "outline"} size="sm" onClick={() => setSense(id)}>
            {STEER_PRESETS[id].label}
          </Button>
        ))}
      </div>
      <p className="mt-1.5 text-t13 leading-snug text-muted-foreground">
        Stay inside the 1 m tube. A corner counts only when you are on the line.
        Ear guide: a soft tick on the line. Past 2 m, two high pips means steer to port, one low tone means steer to starboard. Faster means further off.
      </p>
      <Button
        variant={ear ? "default" : "outline"}
        size="sm"
        className="mt-1.5 w-full"
        onClick={() => {
          unlockAlarmAudio();
          setEar(!ear);
        }}
      >
        {ear ? "Ear guide on" : "Ear guide off"}
      </Button>
      <p className="mt-1.5 text-t12 text-muted-foreground">
        Keep a turn of
      </p>
      <div className="mt-1 grid grid-cols-5 gap-1">
        {TRACK_TURN_PRESETS.map((deg) => (
          <Button
            key={deg}
            variant={turnDeg === deg ? "default" : "outline"}
            size="sm"
            className="h-8 px-0"
            onClick={() => setTurnDeg(deg)}
          >
            {deg}°
          </Button>
        ))}
      </div>
      <p className="mt-1.5 text-t12 text-muted-foreground">
        Or off the line by
      </p>
      <div className="mt-1 grid grid-cols-5 gap-1">
        {TRACK_CHORD_PRESETS.map((m) => (
          <Button
            key={m}
            variant={chordM === m ? "default" : "outline"}
            size="sm"
            className="h-8 px-0"
            onClick={() => setChordM(m)}
          >
            {formatLength(m)}
          </Button>
        ))}
      </div>
      <p className="mt-1 text-t13 leading-snug text-muted-foreground">
        Straights are dropped on save and reverse. A tighter turn or a smaller distance keeps more of the bend.
      </p>
    </div>
  );
}

export function LegendPanel() {
  return (
    <Sheet id="legend" title="Colour guide" kicker="Reading depth from the photo">
      <ul className="grid gap-3 text-sm">
        <li>
          <p className="font-display text-lg font-semibold">Deep indigo / navy</p>
          <p className="text-muted-foreground">Deep water and the cut. Stay in the dark when entering a lagoon.</p>
        </li>
        <li>
          <p className="font-display text-lg font-semibold">Brown / olive</p>
          <p className="text-muted-foreground">Living coral and bommies. Do not cross. Give it a boat-length.</p>
        </li>
        <li>
          <p className="font-display text-lg font-semibold">Pale aqua / white</p>
          <p className="text-muted-foreground">Sand. The hook belongs here, inside the lagoon or off the lee of a cay.</p>
        </li>
        <li>
          <p className="font-display text-lg font-semibold">Turquoise over brown</p>
          <p className="text-muted-foreground">Shallow reef flat. Fine in the dinghy, not under the keel.</p>
        </li>
      </ul>
      <p className="mt-4 text-xs text-muted-foreground">
        Not a carriage chart. Satellite is a lookout aid — confirm with the sounder and your eyes.
      </p>
    </Sheet>
  );
}

export function SavePanel() {
  const draft = useHelm((s) => s.draft);
  const drafts = useHelm((s) => s.drafts);
  const saveDraft = useHelm((s) => s.saveDraft);
  const setDrawMode = useHelm((s) => s.setDrawMode);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const len = pathLengthMeters(draft);
  const prefs = useHelm((s) => s.routePrefs);
  const card = routeSummary(draft, prefs.motorKn, prefs.fuelLph);
  const fallback = nextTrackName(drafts);

  const save = () => {
    const saved: LocalDraft = saveDraft({
      title: title.trim() || fallback,
      region: "",
      notes: notes.trim(),
      kind: "passage",
      waypoints: draft,
    });
    toast(`Saved ${saved.title}`);
    setTitle("");
    setNotes("");
  };

  return (
    <Sheet id="save" title="Save track" kicker={`${draft.length} marks · ${formatMeters(len)}`}>
      <RouteCard distM={card.distM} hours={card.hours} litres={card.litres} kn={prefs.motorKn} />
      {draft.length >= 2 ? <HazardCheck points={draft} /> : null}
      <div className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-t13 text-muted-foreground">Name</span>
          <Input autoFocus value={title} placeholder={fallback} onChange={(e) => setTitle(e.target.value.slice(0, LIMITS.title))} className="h-11 text-base" />
        </label>
        <label className="grid gap-1">
          <span className="text-t13 text-muted-foreground">Comment (optional)</span>
          <Input value={notes} onChange={(e) => setNotes(e.target.value.slice(0, LIMITS.comment))} className="h-11 text-base" />
        </label>
        <Button onClick={save} disabled={draft.length < 1}>
          Save to My tracks
        </Button>
        <p className="text-t13 text-muted-foreground">Share it to the online library later from Navigation → My tracks.</p>
        <Button variant="ghost" onClick={() => setDrawMode("idle")}>
          Discard
        </Button>
      </div>
    </Sheet>
  );
}

/** Navigation: start recording, find a place, your tracks and the online library, in one sheet. */
export function NavigationPanel() {
  const drafts = useHelm((s) => s.drafts);
  const active = useHelm((s) => s.activePassage);
  const setActive = useHelm((s) => s.setActivePassage);
  const reverseTrack = useHelm((s) => s.reverseTrack);
  const [tab, setTab] = useState<"mine" | "library">("mine");
  useUnitsKey();

  return (
    <Sheet id="passages" title="Navigation" kicker="Record, find and follow tracks">
      <Button
        className="mb-2 h-14 w-full text-t16"
        onClick={() => {
          const st = useHelm.getState();
          st.setDraft([]);
          st.clearCrumb();
          st.setDrawMode("record");
          st.setPanel(null);
        }}
      >
        <Radio className="size-5" />
        Start recording
      </Button>
      {active ? (
        <div className="mb-2 rounded-lg border border-primary/50 px-2.5 py-2">
          <p className="truncate text-t14 font-semibold">Following: {active.title}</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => reverseTrack()}>
              Reverse
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setActive(null)}>
              Stop following
            </Button>
          </div>
        </div>
      ) : null}
      <PlaceSearch />
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-background p-1" role="tablist">
        {(
          [
            ["mine", `My tracks${drafts.length ? ` (${drafts.length})` : ""}`],
            ["library", "Library"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`h-10 rounded-md text-t14 font-semibold ${tab === id ? "bg-primary text-primary-foreground" : "text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "mine" ? <MyTracks /> : <LibraryTab />}
    </Sheet>
  );
}

function followTrack(p: Passage | LocalDraft) {
  unlockAlarmAudio();
  const onChart = trackInView(p.waypoints, getChartBounds());
  const s = useHelm.getState();
  s.setActivePassage(p);
  s.setChartUp("heading");
  s.setBoatLow(true);
  s.setSteerEar(true);
  if (onChart) s.setFollowBoat(true);
  else {
    const fit = zoomToFit(p.waypoints);
    if (fit) s.fly(fit.lat, fit.lng, fit.zoom);
  }
  s.setPanel(null);
}

function MyTracks() {
  const drafts = useHelm((s) => s.drafts);
  const removeDraft = useHelm((s) => s.removeDraft);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      {drafts.length ? (
        <ul className="mb-3 grid gap-1.5">
          {drafts.map((d) => {
            const isOpen = open === d.localId;
            return (
              <li key={d.localId} className="rounded-md border border-border px-2.5 py-2">
                <button type="button" className="w-full text-left" onClick={() => setOpen(isOpen ? null : d.localId)} aria-expanded={isOpen}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="min-w-0 truncate text-t15 font-semibold">{d.title}</p>
                    <span className="shrink-0 text-t13 text-muted-foreground">
                      {formatMeters(pathLengthMeters(d.waypoints))}
                      {d.libraryId ? " · shared" : d.fromLibrary ? " · library" : ""}
                    </span>
                  </div>
                  {d.notes || d.region ? (
                    <p className="mt-0.5 line-clamp-2 text-t13 text-muted-foreground">{[d.region, d.notes].filter(Boolean).join(" · ")}</p>
                  ) : null}
                </button>
                {isOpen ? (
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <Button size="sm" className="col-span-2" onClick={() => followTrack(d)}>
                      Follow
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => useHelm.setState({ renameTrackId: d.localId, panel: "rename" })}>
                      {d.fromLibrary ? "Rename" : d.libraryId ? "Edit / unshare" : "Rename / share"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        shareGpx(d.title, d.waypoints).catch((err: unknown) => {
                          // Closing the share sheet is not an error.
                          if (!/cancel/i.test(String(err))) toast.error("Couldn't export the track");
                        });
                      }}
                    >
                      Export GPX
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="col-span-2 text-destructive"
                      onClick={() => {
                        if (window.confirm(`Delete "${d.title}" from this phone? This can't be undone.`)) removeDraft(d.localId);
                      }}
                    >
                      Delete from phone
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mb-3 rounded-lg border border-dashed border-border px-3 py-4 text-center">
          <p className="font-display text-base font-semibold">No tracks yet</p>
          <p className="mx-auto mt-1 max-w-xs text-t14 leading-snug text-muted-foreground">
            Tap <span className="font-semibold text-foreground">Start recording</span> on your way in, or{" "}
            <span className="font-semibold text-foreground">Draw</span> one on the satellite. Saved tracks stay on the phone
            to follow back out, even with no signal.
          </p>
        </div>
      )}
      <GpxImportRow />
      <BackupRow />
    </>
  );
}

/** After Stop (or Rename): name the track, add a comment, and optionally share it. */
export function RenameTrackPanel() {
  const id = useHelm((s) => s.renameTrackId);
  const track = useHelm((s) => s.drafts.find((d) => d.localId === s.renameTrackId) ?? null);
  const update = useHelm((s) => s.updateDraft);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!track) return;
    setTitle(track.title);
    setNotes(track.notes);
    setLocation(track.region);
    if (track.region || !track.waypoints[0]) return;
    const first = track.waypoints[0];
    let live = true;
    void loadHazards().then((idx) => {
      if (!live) return;
      const named = (idx?.items ?? []).filter((h) => h.name).map((h) => ({ name: h.name!, lat: h.c[1], lng: h.c[0] }));
      const near = nearestPlaceName(first.lat, first.lng, named);
      if (near) setLocation((cur) => cur || near);
    });
    return () => {
      live = false;
    };
    // Only when a different track is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!track) return null;
  const close = () => useHelm.setState({ panel: null, renameTrackId: null });
  const save = () => {
    update(track.localId, { title: title.trim() || track.title, notes: notes.trim(), region: location.trim() });
  };
  const share = async () => {
    save();
    setBusy(true);
    try {
      const r = await shareToLibrary({
        title: title.trim() || track.title,
        location: location.trim(),
        comment: notes.trim(),
        points: track.waypoints,
        lengthM: pathLengthMeters(track.waypoints),
      });
      update(track.localId, { libraryId: r.id, librarySecret: r.secret });
      toast.success("Shared to the library");
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't share the track");
    } finally {
      setBusy(false);
    }
  };
  const unshare = async () => {
    if (!track.libraryId || !track.librarySecret) return;
    setBusy(true);
    try {
      await removeFromLibrary(track.libraryId, track.librarySecret);
      update(track.localId, { libraryId: undefined, librarySecret: undefined });
      toast.success("Removed from the library. It stays on this phone.");
    } catch {
      toast.error("Couldn't reach the library. Try again with signal.");
    } finally {
      setBusy(false);
    }
  };
  const canShare = Boolean(libraryConfig()) && !track.fromLibrary;
  return (
    <Sheet id="rename" title="Name this track" kicker={`${formatMeters(pathLengthMeters(track.waypoints))} · ${track.waypoints.length} marks`}>
      <div className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-t13 text-muted-foreground">Name</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, LIMITS.title))}
            onFocus={(e) => {
              const el = e.currentTarget;
              if (/^Track \d+$/.test(el.value)) requestAnimationFrame(() => el.select());
            }}
            className="h-11 text-base"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-t13 text-muted-foreground">Comment (optional)</span>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, LIMITS.comment))}
            placeholder="e.g. Half tide or more, keep the bommie to port"
            className="h-11 text-base"
          />
        </label>
        <Button
          onClick={() => {
            save();
            toast(`Saved ${title.trim() || track.title}`);
            close();
          }}
        >
          Save
        </Button>
        {canShare ? (
          <div className="rounded-lg border border-border px-2.5 py-2">
            <p className="text-t14 font-semibold">Share to the online library</p>
            <p className="mt-0.5 text-t13 leading-snug text-muted-foreground">
              Other skippers can find it by location and comment and save it to their phone. Shared without your name.
            </p>
            <label className="mt-2 grid gap-1">
              <span className="text-t13 text-muted-foreground">Location</span>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value.slice(0, LIMITS.location))}
                placeholder="e.g. Lady Musgrave lagoon entrance"
                className="h-11 text-base"
              />
            </label>
            {track.libraryId ? (
              <Button variant="outline" className="mt-2 w-full" disabled={busy} onClick={() => void unshare()}>
                {busy ? "Removing…" : "Remove from library"}
              </Button>
            ) : (
              <Button variant="outline" className="mt-2 w-full" disabled={busy || !location.trim()} onClick={() => void share()}>
                {busy ? "Sharing…" : "Share"}
              </Button>
            )}
          </div>
        ) : null}
        <Button variant="ghost" onClick={close}>
          Not now
        </Button>
      </div>
    </Sheet>
  );
}

/** iPhone: says whether the drag alarm will sound through silent mode and Focus. */
function AlarmReach() {
  const [st, setSt] = useState<CriticalStatus | null>(null);
  useEffect(() => {
    const plugin = criticalAlerts();
    if (!plugin) return;
    let live = true;
    const read = () => {
      void plugin.status().then((v) => {
        if (live) setSt(v);
      }).catch(() => undefined);
    };
    read();
    document.addEventListener("visibilitychange", read);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", read);
    };
  }, []);
  if (!st) return null;
  const [tone, text] = !st.granted
    ? (["warn", "Notifications are off. The alarm can't sound with the phone locked."] as const)
    : st.critical
      ? (["ok", "Critical Alerts on: sounds through silent mode and Do Not Disturb."] as const)
      : st.timeSensitive
        ? (["note", "Breaks through Focus, but not the silent switch. Keep the ringer on."] as const)
        : (["warn", "Focus and silent mode can mute the alarm. Allow Time Sensitive alerts."] as const);
  return (
    <div
      className={`flex items-start justify-between gap-2 rounded-md border px-2 py-1.5 text-t13 leading-snug ${
        tone === "ok"
          ? "border-primary/40 text-foreground"
          : tone === "note"
            ? "border-border text-muted-foreground"
            : "border-destructive/50 text-destructive"
      }`}
    >
      <span>{text}</span>
      {tone !== "ok" ? (
        <button type="button" className="shrink-0 underline" onClick={() => openLocationSettings()}>
          Settings
        </button>
      ) : null}
    </div>
  );
}

function UnitsPicker() {
  const depthUnit = useHelm((s) => s.depthUnit);
  const lengthUnit = useHelm((s) => s.lengthUnit);
  const setDepthUnit = useHelm((s) => s.setDepthUnit);
  const setLengthUnit = useHelm((s) => s.setLengthUnit);
  return (
    <div className="mb-2">
      <p className="mb-1.5 text-t12 text-muted-foreground">Units</p>
      <div className="grid grid-cols-[4.5rem_1fr] items-center gap-x-2 gap-y-1.5">
        <span className="text-t14 text-muted-foreground">Depth</span>
        <div className="grid grid-cols-3 gap-1.5">
          {([
            ["m", "Metres"],
            ["ft", "Feet"],
            ["fm", "Fathoms"],
          ] as const).map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={depthUnit === id ? "default" : "outline"}
              aria-pressed={depthUnit === id}
              onClick={() => setDepthUnit(id)}
            >
              {label}
            </Button>
          ))}
        </div>
        <span className="text-t14 text-muted-foreground">Chain, distance</span>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            ["m", "Metres"],
            ["ft", "Feet"],
          ] as const).map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={lengthUnit === id ? "default" : "outline"}
              aria-pressed={lengthUnit === id}
              onClick={() => setLengthUnit(id)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-t13 leading-snug text-muted-foreground">
        Over 1 km, distances show in nautical miles. Speeds are in knots.
      </p>
    </div>
  );
}

function ZoneLegend() {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <ul className="grid gap-1">
        {PARK_ZONES.map((z) => (
          <li key={z.name} className="flex items-start gap-2 text-t14 leading-snug">
            <span
              aria-hidden
              className="mt-0.5 size-3.5 shrink-0 rounded-sm border border-black/20"
              style={{ background: z.color }}
            />
            <span>
              <span className="font-semibold">{z.name}</span>
              <span className="text-muted-foreground"> · {z.rule}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-t13 leading-snug text-muted-foreground">
        A guide, not the law. Rules change and some areas have extra limits, including
        no-anchoring areas in the Whitsundays, Keppels and Hinchinbrook. Check the
        official GBRMPA zoning maps before you fish or anchor. Anchor on sand, not coral.
      </p>
    </div>
  );
}

/** Back up tracks and settings to a file (iCloud Drive, Google Drive, Files), or restore one. */
function BackupRow() {
  const input = useRef<HTMLInputElement>(null);
  const count = useHelm((s) => s.drafts.length);
  return (
    <div className="mb-3 rounded-lg border border-border bg-background px-3 py-2">
      <p className="text-t12 text-muted-foreground">Backup</p>
      <p className="mt-0.5 text-t14 leading-snug text-muted-foreground">
        Save your {count ? `${count} track${count === 1 ? "" : "s"}` : "tracks"} and settings to iCloud Drive,
        Google Drive or Files, and restore them on a new phone.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            saveBackup().catch((err: unknown) => {
              if (!/cancel/i.test(String(err))) toast.error("Couldn't save the backup");
            });
          }}
        >
          Save backup
        </Button>
        <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
          Restore
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          void file
            .text()
            .then((text) => {
              const r = restoreBackup(text);
              toast.success(
                r.added
                  ? `Restored ${r.added} track${r.added === 1 ? "" : "s"} and your settings`
                  : "Settings restored. Those tracks were already on this phone.",
              );
              if (r.dropped) toast.warning(`${r.dropped} oldest tracks didn't fit (40 max).`);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Couldn't restore"));
        }}
      />
    </div>
  );
}

/** Open a GPX route or track from a chartplotter, another app, or a friend. */
function GpxImportRow() {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="mb-2">
      <Button variant="outline" className="w-full" onClick={() => input.current?.click()}>
        Import route or track (GPX)
      </Button>
      <input
        ref={input}
        type="file"
        // iOS greys out .gpx files under a strict filter, so accept broadly and check the contents.
        accept=".gpx,application/gpx+xml,application/xml,text/xml,application/octet-stream"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          void file
            .text()
            .then((xml) => {
              const lines = dedupeLines(parseGpx(xml));
              const base = file.name.replace(/\.gpx$/i, "");
              const now = Date.now();
              const tracks = lines.map((l, i) => ({
                localId: `gpx-${now}-${i}`,
                title: l.name || (lines.length > 1 ? `${base} ${i + 1}` : base) || "Imported route",
                region: "",
                notes: `Imported from ${file.name}`,
                kind: "passage" as const,
                waypoints: l.points,
                savedAt: new Date(now - i).toISOString(),
              }));
              const s = useHelm.getState();
              const merged = mergeTracks(s.drafts, tracks);
              useHelm.setState({ drafts: merged.tracks });
              toast.success(
                tracks.length === 1
                  ? `Imported "${tracks[0]!.title}". Tap it to follow.`
                  : `Imported ${tracks.length} routes and tracks.`,
              );
              if (merged.dropped) toast.warning(`${merged.dropped} oldest tracks didn't fit (40 max).`);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Couldn't read that file"));
        }}
      />
    </div>
  );
}

/** Photo under the chart centre: source, and for Esri (Maxar) the capture date and resolution. */
function PhotoInfoRow() {
  const imagery = useHelm((s) => s.imagery);
  const [text, setText] = useState<string>("…");
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let live = true;
    const t = window.setTimeout(() => {
      const src = centreTileSource();
      const view = getChartBounds();
      const name = src && isImageryId(src) ? imageryShort(src) : imageryShort(imagery);
      if (!src || !view) {
        setText(`${name} · no photo loaded here yet`);
        return;
      }
      if (src === "maxar" || src === "clarity") {
        setText(`${name} · checking date…`);
        const lat = (view.north + view.south) / 2;
        const lng = (view.east + view.west) / 2;
        void fetchEsriPhotoInfo(lat, lng, view.zoom).then((info) => {
          if (live) setText(`${name} · ${describePhoto(info)}`);
        });
      } else {
        setText(`${name} · ${SOURCE_NOTE[src] ?? "date not published"}`);
      }
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [imagery, nonce]);
  return (
    <button
      type="button"
      onClick={() => setNonce((n) => n + 1)}
      className="rounded-md border border-border px-2.5 py-1.5 text-left text-t14 leading-snug"
      aria-label="Photo at the chart centre. Tap to check again."
    >
      <span className="block text-t12 text-muted-foreground">Photo at chart centre</span>
      {text}
    </button>
  );
}

/** Reader text size for the whole app. */
function TextSizeRow() {
  const size = useHelm((s) => s.textSize);
  const setSize = useHelm((s) => s.setTextSize);
  const opts: Array<{ id: "standard" | "large" | "xl"; label: string }> = [
    { id: "standard", label: "Standard" },
    { id: "large", label: "Large" },
    { id: "xl", label: "Extra large" },
  ];
  return (
    <div>
      <p className="mb-1 text-t13 text-muted-foreground">Text size</p>
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Text size">
        {opts.map((o) => (
          <Button
            key={o.id}
            role="radio"
            aria-checked={size === o.id}
            variant={size === o.id ? "default" : "outline"}
            className="h-11"
            onClick={() => setSize(o.id)}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** Seabed overlay choice, and the Allen Coral Atlas layer when this build has it. */
function DepthRow() {
  const mode = useHelm((s) => s.depthLayer);
  const setMode = useHelm((s) => s.setDepthLayer);
  const benthicOn = useHelm((s) => s.benthic);
  const setBenthic = useHelm((s) => s.setBenthic);
  const opts: Array<{ id: "off" | "depth" | "shallow"; label: string }> = [
    { id: "off", label: "Off" },
    { id: "depth", label: "Depth" },
    { id: "shallow", label: "Too shallow" },
  ];
  return (
    <div>
      <p className="mb-1 text-t13 text-muted-foreground">Seabed (approximate)</p>
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Seabed overlay">
        {opts.map((o) => (
          <Button
            key={o.id}
            role="radio"
            aria-checked={mode === o.id}
            variant={mode === o.id ? "default" : "outline"}
            className="h-11"
            onClick={() => setMode(o.id)}
          >
            {o.label}
          </Button>
        ))}
      </div>
      {mode !== "off" ? (
        <p className="mt-1 text-t13 leading-snug text-muted-foreground">
          {mode === "shallow"
            ? "Red where the water is shallower than your draft plus 0.5 m at today's tide. "
            : ""}
          The depth model shows reefs and drop-offs at a few hundred metres, not bommies.
        </p>
      ) : null}
      {BENTHIC_WMS ? (
        <div className="mt-1.5">
          <ToggleRow label="Sand, coral and seagrass (Allen Coral Atlas)" on={benthicOn} onChange={setBenthic} />
        </div>
      ) : null}
    </div>
  );
}

/** Distance, time and fuel for a route at cruising speed (speed and fuel are in Route settings). */
function RouteCard({ distM, hours, litres, kn }: { distM: number; hours: number | null; litres: number | null; kn: number }) {
  return (
    <div className="mb-2 grid grid-cols-3 gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5 text-center tabular-nums">
      <div>
        <p className="text-t12 text-muted-foreground">Distance</p>
        <p className="text-t16 font-semibold">{formatMeters(distM)}</p>
      </div>
      <div>
        <p className="text-t12 text-muted-foreground">At {kn} kn</p>
        <p className="text-t16 font-semibold">{hours != null ? formatDuration(hours) : "—"}</p>
      </div>
      <div>
        <p className="text-t12 text-muted-foreground">Fuel</p>
        <p className="text-t16 font-semibold">{litres != null ? `${Math.ceil(litres)} L` : "—"}</p>
      </div>
    </div>
  );
}

/** Search GBRMPA reefs, islands and cays, tide ports and saved tracks (offline); tap a result to go there. */
function PlaceSearch() {
  const [q, setQ] = useState("");
  const [named, setNamed] = useState<Place[]>([]);
  const drafts = useHelm((s) => s.drafts);
  useEffect(() => {
    if (q.trim().length < 2 || named.length) return;
    let live = true;
    void loadHazards().then((idx) => {
      if (!live || !idx) return;
      const seen = new Set<string>();
      const out: Place[] = [];
      for (const h of idx.items) {
        if (!h.name || seen.has(h.name)) continue;
        seen.add(h.name);
        out.push({ name: h.name, detail: h.kind === "island" ? "Island" : h.kind === "cay" ? "Cay" : "Reef", lat: h.c[1], lng: h.c[0], zoom: 14, kind: "reef" });
      }
      setNamed(out);
    });
    return () => {
      live = false;
    };
  }, [q, named.length]);
  const extra = [
    ...drafts
      .filter((d) => d.waypoints.length)
      .map((d) => ({ name: d.title, detail: "Your track", lat: d.waypoints[0]!.lat, lng: d.waypoints[0]!.lng, zoom: 16, kind: "track" as const })),
    ...named,
  ];
  const hits = searchPlaces(q, extra);
  return (
    <div className="mb-3">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find a place: reef, island, harbour or track"
        aria-label="Search places"
        className="h-11 text-base"
        type="search"
      />
      {hits.length ? (
        <ul className="mt-1.5 grid gap-1">
          {hits.map((p) => (
            <li key={`${p.kind}:${p.name}:${p.lat}`}>
              <button
                type="button"
                onClick={() => {
                  const st = useHelm.getState();
                  st.setFollowBoat(false);
                  st.fly(p.lat, p.lng, p.zoom);
                  st.setPanel(null);
                }}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-left"
              >
                <span className="min-w-0 truncate text-t15 font-semibold">{p.name}</span>
                <span className="shrink-0 text-t13 text-muted-foreground">{p.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : q.trim().length >= 2 ? (
        <p className="mt-1.5 text-t13 text-muted-foreground">Nothing found on the phone for “{q.trim()}”.</p>
      ) : null}
    </div>
  );
}
