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
import { formatMeters, haversineMeters, pathLengthMeters, trackInView, TRACK_CHORD_PRESETS, TRACK_TURN_PRESETS } from "@/lib/geo";
import { GARMIN_SDK_URL, PARK_ZONES, availableImagery } from "@/lib/imagery";
import { getChartBounds } from "@/components/helm/map-view";
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
import {
  deletePassage,
  listMyPassages,
  listPublicPassages,
  savePassage,
  setPublished,
  type Passage,
} from "@/lib/passages";
import { REEFS } from "@/lib/reefs";
import { fetchTideRise } from "@/lib/tides";
import { STEER_PRESETS, XTE_ALARM_PRESETS } from "@/lib/steer";
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
import { isPreview } from "@/lib/subscription";
import { radarAvailable } from "@/lib/radar";
import { SubscriptionRow } from "@/components/subscription";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { simulateAnchorDrag, startMusgraveDemo, unlockAlarmAudio } from "@/hooks/helm-runtime";
import { useHelm, useUnitsKey, type LocalDraft, type PanelId } from "@/store/helm";

export function Sheet({
  id,
  title,
  kicker,
  children,
}: {
  id: NonNullable<PanelId>;
  title: string;
  kicker?: string;
  children: ReactNode;
}) {
  const panel = useHelm((s) => s.panel);
  const setPanel = useHelm((s) => s.setPanel);
  useUnitsKey();
  if (panel !== id) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 md:inset-y-20 md:right-3 md:bottom-24 md:left-auto md:w-[22rem]">
      <div className="pointer-events-auto max-h-[min(46vh,24rem)] overflow-y-auto rounded-t-xl border border-border bg-card px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-border)] md:max-h-[min(72vh,36rem)] md:rounded-xl md:p-4">
        <div className="mx-auto mb-1.5 h-1 w-10 rounded-full bg-border md:hidden" />
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            {kicker ? (
              <p className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                {kicker}
              </p>
            ) : null}
            <h2 className="font-display text-xl leading-none font-semibold tracking-tight">
              {title}
            </h2>
          </div>
          <Button variant="outline" size="sm" className="h-10 min-w-16 px-3" onClick={() => setPanel(null)}>
            Close
          </Button>
        </div>
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
        <span className={`text-[11px] font-semibold tracking-wide uppercase ${on ? "text-primary" : "text-muted-foreground"}`}>
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
    <Sheet id="anchor" title="Anchor" kicker="Mark the hook">
      {anchor?.radiusLocked ? (
        stopAsk ? (
          <div className="mb-2 rounded-lg border border-destructive/50 bg-destructive/10 p-2">
            <p className="text-center text-sm font-medium">Stop the anchor watch?</p>
            <p className="mt-0.5 text-center text-[11px] text-muted-foreground">
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
      <p className="mb-2 text-xs text-pretty text-muted-foreground">
        Boat is the fallen-back position. Chain from the bow. Set depth and chain, then drag to the hook.
      </p>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <UnitStepField label="Depth" kind="depth" valueM={rode.depthM} steps={{ m: 0.2, ft: 1, fm: 0.5 }} onChange={(n) => setRode({ depthM: n })} />
        <UnitStepField label="Chain out" kind="length" valueM={rode.chainM} steps={{ m: 5, ft: 10 }} onChange={(n) => setRode({ chainM: n })} />
      </div>
      <div className="mb-2 rounded-lg border border-border bg-background px-3 py-2">
        <div className="flex items-baseline justify-between">
          <p className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Layback</p>
          <p className="font-display text-2xl font-semibold tabular-nums">{formatLength(math.laybackM)}</p>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
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
              <p className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Distance</p>
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
              <p className="text-[11px] leading-snug text-destructive">
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
          <p className="text-[11px] leading-snug text-muted-foreground">
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
          <p className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Alarm</p>
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
        <p className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Hull · GPS</p>
        <p className="font-display text-sm font-semibold">{gpsStationLabel(hull)}</p>
      </button>
    </Sheet>
  );
}

export function AtlasPanel() {
  const reefId = useHelm((s) => s.reefId);
  const setReef = useHelm((s) => s.setReef);
  const packs = useHelm((s) => s.offlinePacks);
  return (
    <Sheet id="atlas" title="Reef atlas" kicker="Cuts and lagoons">
      <p className="mb-3 text-sm text-muted-foreground">
        Jump a known cut. Colour of water is the chart — dark is deep, brown is coral, pale is sand.
        Green means this reef is on the phone.
      </p>
      <Button className="mb-3 w-full" onClick={startMusgraveDemo}>
        Run Lady Musgrave entrance
      </Button>
      <ul className="grid gap-2">
        {REEFS.map((r) => {
          const onPhone = Boolean(packOnPhone(packs, r.lat, r.lng));
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setReef(r.id)}
                className={`w-full rounded-lg border px-3 py-3 text-left ${
                  reefId === r.id ? "border-primary bg-primary/10" : "border-border bg-background"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-lg leading-none font-semibold">{r.name}</p>
                  {onPhone ? (
                    <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-400 uppercase">
                      On phone
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.region} · {r.country}
                </p>
                <p className="mt-2 text-sm text-pretty text-muted-foreground">{r.blurb}</p>
              </button>
            </li>
          );
        })}
      </ul>
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
  const radar = useHelm((s) => s.radar);
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
          <SubscriptionRow />
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
      <div className="mb-2 grid gap-1">
        {availableImagery().map((im) => (
          <button
            key={im.id}
            type="button"
            onClick={() => setImagery(im.id)}
            className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left ${
              imagery === im.id ? "border-primary bg-primary/10" : "border-border bg-background"
            }`}
          >
            <span
              className="grid size-7 shrink-0 place-items-center rounded-md font-display text-sm font-semibold"
              style={{ background: im.markBg, color: im.markFg }}
            >
              {im.mark}
            </span>
            <span className="min-w-0">
              <span className="block font-display text-sm leading-none font-semibold">{im.name}</span>
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{im.detail}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
        The chart button centres the boat. Tap again for heading-up, with the boat just below centre so the water ahead stays on screen. Drag the chart to let go. Tap to come back.
      </p>
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
          Read water
        </Button>
      </div>
      <div className="mb-2 grid gap-1.5">
        <ToggleRow label="Sharp photos (HD, about 4× the data)" on={sharpTiles} onChange={setSharpTiles} />
        <ToggleRow label="Reef clarity (more contrast to read depth)" on={reefClarity} onChange={setReefClarity} />
        <ToggleRow label="Place names" on={labels} onChange={setLabels} />
        <ToggleRow label="Lat / long lines" on={graticule} onChange={setGraticule} />
        <ToggleRow label="Seamarks" on={seamarks} onChange={setSeamarks} />
        <ToggleRow label="Depth contours" on={depths} onChange={setDepths} />
        <ToggleRow label="Reef outlines (GBR)" on={reefOutlines} onChange={setReefOutlines} />
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
      <p className="mb-1.5 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Look</p>
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
      <p className="text-[11px] leading-snug text-muted-foreground">
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

  const refresh = () => {
    void listPacks().then(setPacks);
  };

  useEffect(() => {
    refresh();
  }, []);

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
      if (pack.missing) {
        toast.warning(`${label} saved with ${pack.missing} tiles missing. Download again to fill gaps.`);
      } else {
        toast.success(`${label} on this phone`);
      }
      setPackBox(null);
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Download stopped";
      if (msg !== "cancelled" && !/AbortError/.test(String(err))) toast.error(msg);
    } finally {
      setBusy(false);
      setProgress(null);
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
        <p className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Offline packs</p>
        {here ? (
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-400 uppercase">
            On phone
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">Not on phone</span>
        )}
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
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
            <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
          </label>
          <p className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Close-up zoom</p>
          <div className="grid grid-cols-4 gap-1">
            {PACK_ZOOMS.map((z) => (
              <Button key={z} variant={maxZ === z ? "default" : "outline"} size="sm" className="h-8" onClick={() => setMaxZ(z)}>
                z{z}
              </Button>
            ))}
          </div>
          <p className="text-[11px] tabular-nums text-muted-foreground">
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
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {progress.done}/{progress.total} · {formatBytes(progress.bytes)}
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
  const alarmM = useHelm((s) => s.xteAlarmM);
  const setAlarmM = useHelm((s) => s.setXteAlarmM);
  const ear = useHelm((s) => s.steerEar);
  const setEar = useHelm((s) => s.setSteerEar);
  const turnDeg = useHelm((s) => s.trackTurnDeg);
  const setTurnDeg = useHelm((s) => s.setTrackTurnDeg);
  const chordM = useHelm((s) => s.trackChordM);
  const setChordM = useHelm((s) => s.setTrackChordM);

  return (
    <div className="mb-2 rounded-lg border border-border bg-background px-2.5 py-2">
      <p className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Track steer</p>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {(Object.keys(STEER_PRESETS) as Array<keyof typeof STEER_PRESETS>).map((id) => (
          <Button key={id} variant={sense === id ? "default" : "outline"} size="sm" onClick={() => setSense(id)}>
            {STEER_PRESETS[id].label}
          </Button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
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
      <p className="mt-1.5 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
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
      <p className="mt-1.5 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
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
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        Straights are dropped on save and reverse. A tighter turn or a smaller distance keeps more of the bend.
      </p>
      <p className="mt-1.5 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Off-track alarm</p>
      <div className="mt-1 grid grid-cols-5 gap-1">
        {XTE_ALARM_PRESETS.map((m) => (
          <Button key={m} variant={alarmM === m ? "default" : "outline"} size="sm" className="h-8" onClick={() => setAlarmM(m)}>
            {formatLength(m)}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function LegendPanel() {
  return (
    <Sheet id="legend" title="Read the water" kicker="Colour is the chart">
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
  const saveDraft = useHelm((s) => s.saveDraft);
  const setDrawMode = useHelm((s) => s.setDrawMode);
  const { user } = useCurrentUserState();
  const [title, setTitle] = useState("Untitled cut");
  const [region, setRegion] = useState("");
  const [notes, setNotes] = useState("");
  const [kind, setKind] = useState<"passage" | "anchorage">("passage");
  const [busy, setBusy] = useState(false);
  const len = pathLengthMeters(draft);

  const local = () => {
    const saved: LocalDraft = saveDraft({
      title: title.trim() || "Untitled cut",
      region,
      notes,
      kind,
      waypoints: draft,
    });
    toast(`Saved ${saved.title}`);
  };

  const publish = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await savePassage({
        data: {
          title: title.trim() || "Untitled cut",
          region,
          notes,
          kind,
          published: true,
          waypoints: draft,
          authorName: user.displayName || "Skipper",
        },
      });
      saveDraft({
        title: title.trim() || "Untitled cut",
        region,
        notes,
        kind,
        waypoints: draft,
      });
      toast("Published to the library");
    } catch {
      toast("Could not publish — saved on this helm only");
      local();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet id="save" title="Save track" kicker={`${draft.length} marks · ${formatMeters(len)}`}>
      <div className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Title</span>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={(e) => {
              const el = e.currentTarget;
              if (el.value !== "Untitled cut") return;
              requestAnimationFrame(() => el.select());
            }}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Region</span>
          <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Great Barrier Reef" />
        </label>
        <label className="grid gap-1">
          <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Notes</span>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Button variant={kind === "passage" ? "default" : "outline"} onClick={() => setKind("passage")}>
            Passage
          </Button>
          <Button variant={kind === "anchorage" ? "default" : "outline"} onClick={() => setKind("anchorage")}>
            Anchorage
          </Button>
        </div>
        <Button onClick={local} disabled={draft.length < 1}>
          Save on this helm
        </Button>
        <SignedIn>
          <Button variant="outline" disabled={busy || draft.length < 1} onClick={() => void publish()}>
            {busy ? "Publishing…" : "Publish to library"}
          </Button>
        </SignedIn>
        <SignedOut>
          <Button asChild variant="outline">
            <Link to="/login">Sign in to publish</Link>
          </Button>
        </SignedOut>
        <Button variant="ghost" onClick={() => setDrawMode("idle")}>
          Discard
        </Button>
      </div>
    </Sheet>
  );
}

export function PassagesPanel() {
  const drafts = useHelm((s) => s.drafts);
  const active = useHelm((s) => s.activePassage);
  const setActive = useHelm((s) => s.setActivePassage);
  const removeDraft = useHelm((s) => s.removeDraft);
  const reverseTrack = useHelm((s) => s.reverseTrack);
  const { user } = useCurrentUserState();
  const pub = useQuery({
    queryKey: ["passages-public"],
    queryFn: () => listPublicPassages(),
    staleTime: 60_000,
  });
  const mine = useQuery({
    queryKey: ["passages-mine", user?.id],
    queryFn: () => listMyPassages(),
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const follow = (p: Passage | LocalDraft) => {
    unlockAlarmAudio();
    const onChart = trackInView(p.waypoints, getChartBounds());
    setActive(p);
    const s = useHelm.getState();
    s.setChartUp("heading");
    s.setBoatLow(true);
    s.setSteerEar(true);
    if (onChart) s.setFollowBoat(true);
    s.setPanel(null);
  };

  return (
    <Sheet id="passages" title="Tracks" kicker="Cuts to follow">
      {active ? (
        <div className="mb-2 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => reverseTrack()}>
            Reverse
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setActive(null)}>
            Drop track
          </Button>
        </div>
      ) : null}
      {drafts.length ? (
        <div className="mb-3">
          <p className="mb-1 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">On this helm</p>
          <ul className="grid gap-1.5">
            {drafts.map((d) => (
              <li key={d.localId} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => follow(d)}>
                  <p className="truncate text-sm font-medium">{d.title}</p>
                  <p className="text-[11px] text-muted-foreground">{d.waypoints.length} marks</p>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    shareGpx(d.title, d.waypoints).catch((err: unknown) => {
                      // Closing the share sheet is not an error.
                      if (!/cancel/i.test(String(err))) toast.error("Couldn't export the track");
                    });
                  }}
                >
                  GPX
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    if (window.confirm(`Delete "${d.title}"? This can't be undone.`)) {
                      removeDraft(d.localId);
                    }
                  }}
                >
                  Del
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <SignedIn>
        {mine.data?.length ? (
          <div className="mb-3">
            <p className="mb-1 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Mine</p>
            <ul className="grid gap-1.5">
              {mine.data.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => follow(p)}>
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <p className="text-[11px] text-muted-foreground">{p.published ? "Public" : "Private"}</p>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => {
                      void setPublished({ data: { id: p.id, published: !p.published } }).then(() => mine.refetch());
                    }}
                  >
                    {p.published ? "Hide" : "Share"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => {
                      void deletePassage({ data: { id: p.id } }).then(() => mine.refetch());
                    }}
                  >
                    Del
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </SignedIn>
      {!drafts.length && !pub.isLoading && !(pub.data ?? []).length ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center">
          <p className="font-display text-base font-semibold">No tracks yet</p>
          <p className="mx-auto mt-1 max-w-xs text-[12px] leading-snug text-muted-foreground">
            Tap <span className="font-semibold text-foreground">Start</span> to record your way in
            through a cut, or <span className="font-semibold text-foreground">Draw</span> to plan one
            on the satellite. Saved tracks appear here to follow back out, even at night.
          </p>
        </div>
      ) : null}
      <GpxImportRow />
      <BackupRow />
      {(pub.data ?? []).length || pub.isLoading ? (
        <p className="mb-1 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Library</p>
      ) : null}
      {pub.isLoading ? <p className="text-sm text-muted-foreground">Loading cuts…</p> : null}
      <ul className="grid gap-1.5">
        {(pub.data ?? []).map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => follow(p)}
              className="w-full rounded-md border border-border px-2 py-1.5 text-left"
            >
              <p className="truncate text-sm font-medium">{p.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {p.region || p.authorName} · {p.waypoints.length} marks
              </p>
            </button>
          </li>
        ))}
      </ul>
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
      className={`flex items-start justify-between gap-2 rounded-md border px-2 py-1.5 text-[11px] leading-snug ${
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
      <p className="mb-1.5 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Units</p>
      <div className="grid grid-cols-[4.5rem_1fr] items-center gap-x-2 gap-y-1.5">
        <span className="text-[12px] text-muted-foreground">Depth</span>
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
        <span className="text-[12px] text-muted-foreground">Chain, distance</span>
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
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
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
          <li key={z.name} className="flex items-start gap-2 text-[12px] leading-snug">
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
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
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
      <p className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Backup</p>
      <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
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
