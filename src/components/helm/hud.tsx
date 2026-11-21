import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  LocateFixed,
  Ruler,
  Wind as WindIcon,
  Satellite,
} from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  bearingDegrees,
  formatGroundScale,
  formatHeading,
  formatLat,
  formatLng,
  formatMeters,
  haversineMeters,
  metresAlong,
  msToKnots,
  cornerIndexes,
} from "@/lib/geo";
import { imageryShort, availableImagery } from "@/lib/imagery";
import { formatLength } from "@/lib/units";
import { formatScope, hoursUntil, rodeMath } from "@/lib/anchor";
import { steerCue, formatTtg, markNav } from "@/lib/steer";
import { bowFromGps, gpsReachM } from "@/lib/boat";
import { Badge } from "@/components/ui/badge";
import { MobGuide } from "@/components/helm/mob-guide";
import { Button } from "@/components/ui/button";
import { centreTileSource, closeInOnBoat } from "@/components/helm/map-view";
import { WindInstrument } from "@/components/helm/weather";
import { windCardinal } from "@/lib/weather";
import { unlockAlarmAudio } from "@/hooks/helm-runtime";
import { useWx } from "@/hooks/weather";
import { useHelm, guidePoints, useUnitsKey } from "@/store/helm";

function AuthSlot({ compact }: { compact?: boolean }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return <div className="size-9 shrink-0 animate-pulse rounded-md bg-muted" />;
  }
  if (user) {
    return (
      <SignedIn>
        <div className={compact ? "size-9 overflow-hidden" : "hidden max-w-[10rem] truncate sm:block"}>
          <UserButton />
        </div>
        {compact ? null : (
          <div className="sm:hidden">
            <UserButton />
          </div>
        )}
      </SignedIn>
    );
  }
  return (
    <SignedOut>
      <Button asChild variant="helm" size={compact ? "icon-sm" : "sm"}>
        <Link to="/login">{compact ? "In" : "Sign in"}</Link>
      </Button>
    </SignedOut>
  );
}

/** Push the chart button columns below the steering bar when it is showing. */
let steerBottom = 0;
let steerRow: HTMLDivElement | null = null;
function placeRow() {
  const row = steerRow;
  if (!row) return;
  row.style.paddingTop = "0px";
  const top = row.getBoundingClientRect().top;
  row.style.paddingTop = steerBottom > top ? `${Math.ceil(steerBottom - top + 6)}px` : "0px";
}
if (typeof window !== "undefined") {
  window.addEventListener("rp:steer-bottom", (e) => {
    steerBottom = (e as CustomEvent<number>).detail;
    placeRow();
  });
}
function clearSteerBar(row: HTMLDivElement | null) {
  steerRow = row;
  placeRow();
}

export function TopHud() {
  useUnitsKey();
  const boat = useHelm((s) => s.boat);
  const hull = useHelm((s) => s.hull);
  const follow = useHelm((s) => s.followBoat);
  const chartUp = useHelm((s) => s.chartUp);
  const boatLow = useHelm((s) => s.boatLow);
  const cycleChartLock = useHelm((s) => s.cycleChartLock);
  const followCourse = useHelm((s) => s.followCourse);
  const passage = useHelm((s) => s.activePassage);
  const tapMode = useHelm((s) => s.tapMode);
  const wxLayerOn = useHelm((s) => s.wxMapLayer !== "off");
  const anchorStep = useHelm((s) => s.anchorStep);
  const hookArmed = useHelm((s) => s.hookArmed);
  const demo = useHelm((s) => s.demoPlaying);
  const gpsDenied = useHelm((s) => s.gpsDenied);
  const chartZoom = useHelm((s) => s.chartZoom);
  const imagery = useHelm((s) => s.imagery);
  const hookPreview = useHelm((s) => s.hookPreview);
  const fenceDraft = useHelm((s) => s.fenceDraft);
  const packDraft = useHelm((s) => s.packDraft);
  const cancelPlaceHook = useHelm((s) => s.cancelPlaceHook);
  const popFencePoint = useHelm((s) => s.popFencePoint);
  const popPackCorner = useHelm((s) => s.popPackCorner);
  const commitFence = useHelm((s) => s.commitFence);
  const setPanel = useHelm((s) => s.setPanel);
  const mob = useHelm((s) => s.mob);
  const panel = useHelm((s) => s.panel);
  const dropMob = useHelm((s) => s.dropMob);
  const wx = useWx();
  const gust = wx.data?.now.gustKn ?? 0;
  const tracking = Boolean(passage && passage.waypoints.length >= 2);
  const following = tracking && follow && chartUp === "heading" && boatLow;

  const src =
    boat?.source === "gps"
      ? "GPS"
      : boat?.source === "last"
        ? "LAST"
        : boat?.source === "demo"
          ? "DEMO"
          : boat?.source === "placed"
            ? "PLOT"
            : "NO FIX";
  const scale = formatGroundScale(boat?.lat ?? -23.9, chartZoom);
  const tapeUp = Boolean(boat) && tapMode === "none" && panel !== "weather";

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 p-2 pt-[max(0.5rem,var(--safe-area-inset-top,env(safe-area-inset-top)))]">
      {tapeUp ? <div className="h-[4.1rem] md:hidden" aria-hidden /> : null}
      <div className="pointer-events-auto mx-auto hidden max-w-6xl items-center gap-2 md:flex">
        <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-[var(--shadow-border)] rp-glass">
          <div className="min-w-0">
            <p className="font-display text-lg leading-none font-semibold text-foreground">
              Anchor Mate
            </p>
            <p className="mt-0.5 text-t13 text-muted-foreground">
              Satellite helm
            </p>
          </div>
          <Badge variant={boat?.source === "gps" ? "default" : "muted"}>{src}</Badge>
          {demo ? <Badge>Entrance run</Badge> : null}
        </div>
        <div className="flex flex-1 items-stretch gap-px overflow-hidden rounded-xl border border-border bg-card/95 shadow-[var(--shadow-border)] rp-glass">
          <WindInstrument />
          <Instrument
            label="LAT"
            value={boat ? formatLat(boat.lat) : "—"}
            unit=""
            wide
          />
          <Instrument
            label="LON"
            value={boat ? formatLng(boat.lng) : "—"}
            unit=""
            wide
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card/95 px-2 py-1.5 shadow-[var(--shadow-border)] rp-glass">
          <AuthSlot />
        </div>
      </div>

      <div ref={clearSteerBar} className="mx-auto mt-1.5 flex max-w-6xl justify-between gap-2">
        <div className="pointer-events-auto flex w-[4.75rem] flex-col gap-1.5">
          {/* Chart */}
          <Button
            variant={following || follow ? "default" : "helm"}
            size="icon"
            className="h-10 w-full"
            aria-label={tracking ? (following ? "Release the chart" : "Follow the track") : !follow ? "Centre on boat" : chartUp === "heading" ? "North up" : "Heading up"}
            onClick={() => {
              if (tracking) {
                unlockAlarmAudio();
                followCourse();
                return;
              }
              cycleChartLock();
            }}
          >
            {tracking ? (
              <span className="font-display text-t12 font-semibold leading-none">
                {following ? "ON" : "GO"}
              </span>
            ) : !follow ? (
              <LocateFixed />
            ) : chartUp === "heading" ? (
              <span className="font-display text-lg font-semibold leading-none">↑</span>
            ) : (
              <span className="font-display text-sm font-semibold leading-none">N</span>
            )}
          </Button>
          <button
            type="button"
            onClick={closeInOnBoat}
            aria-label="Helm scale"
            className="w-full rounded-md border border-border bg-card/95 px-1 py-1 text-center shadow-[var(--shadow-border)] rp-glass"
          >
            <p className="font-display text-t13 leading-none font-semibold tabular-nums">
              {scale}
            </p>
            <p className="mt-0.5 text-t11 leading-none text-muted-foreground">
              {imageryShort(imagery)}
            </p>
          </button>
          {availableImagery().length > 2 ? (
            <button
              type="button"
              aria-label="Compare: flip to the other satellite photo"
              onClick={() => {
                const next = useHelm.getState().flipImagery(centreTileSource());
                toast(`Showing ${imageryShort(next)}. Tap ⇄ to flip back.`, { duration: 2500 });
              }}
              className="h-10 w-full rounded-md border border-border bg-card/95 py-1 text-center text-t15 leading-none font-semibold shadow-[var(--shadow-border)] rp-glass"
            >
              ⇄
            </button>
          ) : null}
          <div className="h-1.5" aria-hidden />
          {/* Tools */}
          <button
            type="button"
            aria-label={wxLayerOn ? "Hide weather on the chart" : "Show weather on the chart"}
            onClick={() => {
              const st = useHelm.getState();
              st.setWxMap(st.wxMapLayer === "off" ? { wxMapLayer: "wind", wxMapAt: Date.now() } : { wxMapLayer: "off", wxMapPlaying: false });
            }}
            className={`flex h-10 w-full items-center justify-center rounded-md border shadow-[var(--shadow-border)] ${wxLayerOn ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/95 rp-glass"}`}
          >
            <WindIcon className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={tapMode === "measure" ? "Stop measuring" : "Measure distance on the chart"}
            onClick={() => {
              const st = useHelm.getState();
              if (st.tapMode === "measure") st.endMeasure();
              else {
                st.setPanel(null);
                st.setTapMode("measure");
              }
            }}
            className={`flex h-10 w-full items-center justify-center rounded-md border py-1.5 shadow-[var(--shadow-border)] ${tapMode === "measure" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/95 rp-glass"}`}
          >
            <Ruler className="size-4" aria-hidden />
          </button>
          {/* Always here (the top bar's wind reading is hidden under the steering bar on phones). */}
          <button
            type="button"
            onClick={() => setPanel("weather")}
            aria-label={
              wx.data
                ? `Forecast. Wind ${Math.round(wx.data.now.windKn)} knots ${windCardinal(wx.data.now.dirDeg)}${gust >= 25 ? `, gusts ${Math.round(gust)}` : ""}`
                : "Forecast"
            }
            className={`w-full rounded-md border px-0.5 py-1 text-center shadow-[var(--shadow-border)] ${
              gust >= 25 ? "border-destructive bg-destructive text-white" : "border-border bg-card/95 rp-glass"
            }`}
          >
            {wx.data ? (
              <>
                <span
                  aria-hidden
                  className="block text-t13 leading-none"
                  style={{ transform: `rotate(${wx.data.now.dirDeg + 180}deg)` }}
                >
                  ↑
                </span>
                <span className="font-display block text-t15 leading-none font-semibold tabular-nums">
                  {Math.round(gust >= 25 ? gust : wx.data.now.windKn)}
                </span>
                <span className="block text-t11 leading-none opacity-80">
                  {gust >= 25 ? "gust" : windCardinal(wx.data.now.dirDeg)}
                </span>
              </>
            ) : (
              <span className="text-t11 font-semibold">Wx</span>
            )}
          </button>
          <div className="h-1.5" aria-hidden />
          {/* Emergency, on its own */}
          <Button
            variant={mob ? "danger" : "helm"}
            size="icon"
            className="h-12 w-full border-2 border-destructive/80"
            aria-label={mob ? "Man overboard is marked" : "Man overboard"}
            onClick={() => {
              if (mob) return;
              unlockAlarmAudio();
              if (!dropMob()) toast("Need a GPS fix before MOB.");
            }}
          >
            <span className="font-display text-t13 font-semibold leading-none">MOB</span>
          </Button>
        </div>
        <div className="pointer-events-auto flex flex-col gap-1.5">
          <Button
            variant={panel === "layers" ? "default" : "helm"}
            size="icon"
            className="size-10"
            aria-label="Map, boat, and look"
            onClick={() => setPanel(panel === "layers" ? null : "layers")}
          >
            <Satellite />
          </Button>
        </div>
      </div>

      {tapMode !== "none" && tapMode !== "measure" && !tapMode.startsWith("route-") && anchorStep !== "circle" ? (
        <div className="pointer-events-auto mx-auto mt-1.5 flex max-w-6xl items-center gap-1.5 rounded-md bg-card/95 px-2 py-1.5 text-xs text-foreground shadow-[var(--shadow-border)]">
          <p className="min-w-0 flex-1 truncate">
            {tapMode === "place-boat"
              ? hookArmed
                ? "Tap the chart. The hook sets just astern."
                : "Tap to place the boat."
              : tapMode === "resize-swing"
                ? "Drag to set the swing radius. Lift to lock."
                : tapMode === "draw-fence"
                  ? fenceDraft.length < 3
                    ? `Tap corners of the barrier (${fenceDraft.length}/3).`
                    : "Tap the first mark to close, or Set."
                  : tapMode === "draw-pack"
                    ? "Zoom out first. Drag across the reef — it becomes a square."
                  : boat && hookPreview
                    ? `Hook ${formatMeters(haversineMeters(bowFromGps(boat, boat.heading, hull), hookPreview))} — drag the ring, lift to set.`
                    : "Drag to the sand where the hook went down."}
          </p>
          {tapMode === "draw-pack" ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              disabled={packDraft.length === 0}
              onClick={popPackCorner}
            >
              Undo
            </Button>
          ) : null}
          {tapMode === "draw-fence" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0"
                disabled={fenceDraft.length === 0}
                onClick={popFencePoint}
              >
                Undo
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-8 shrink-0"
                disabled={fenceDraft.length < 3}
                onClick={commitFence}
              >
                Set
              </Button>
            </>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            onClick={() => cancelPlaceHook()}
          >
            Cancel
          </Button>
        </div>
      ) : null}

      {!boat && !gpsDenied ? (
        <p className="pointer-events-none mx-auto mt-1.5 max-w-6xl text-center text-t13 text-muted-foreground">
          Locating GPS…
        </p>
      ) : null}

      {!boat && gpsDenied ? (
        <p className="pointer-events-none mx-auto mt-1.5 max-w-6xl text-center text-t13 text-muted-foreground">
          GPS off — Layers → Place boat.
        </p>
      ) : null}
    </header>
  );
}

function Instrument({
  label,
  value,
  unit,
  wide,
  compact,
}: {
  label: string;
  value: string;
  unit: string;
  wide?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "min-w-0 flex-1 px-2 py-1.5"
          : `px-3 py-2 ${wide ? "min-w-[9.5rem]" : "min-w-[4.5rem]"}`
      }
    >
      <p className="text-t11 text-muted-foreground">
        {label}
      </p>
      <p
        className={`font-display leading-none font-semibold tabular-nums rp-instrument-value ${
          compact ? "text-lg" : "text-[1.35rem]"
        }`}
      >
        {value}
        {unit ? (
          <span className="ml-0.5 text-t12 font-medium text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </p>
    </div>
  );
}

export function MobHud() {
  const boat = useHelm((s) => s.boat);
  const mark = useHelm((s) => s.mob);
  const drift = useHelm((s) => s.mobDrift);
  const clearMob = useHelm((s) => s.clearMob);
  const panel = useHelm((s) => s.panel);
  const tapMode = useHelm((s) => s.tapMode);
  const [guide, setGuide] = useState(false);
  if (!mark) return null;
  if (guide) return <MobGuide onClose={() => setGuide(false)} />;
  if (panel || (tapMode !== "none" && tapMode !== "measure")) return null;
  // Steer for where they have probably drifted to by now, not the original mark.
  const minsSince = (Date.now() - mark.at) / 60_000;
  const nowPt = drift?.points.reduce<{ lat: number; lng: number; minutes: number } | null>(
    (best, p) => (!best || Math.abs(p.minutes - minsSince) < Math.abs(best.minutes - minsSince) ? p : best),
    null,
  );
  const mob = nowPt && drift && !drift.source.startsWith("no current") ? nowPt : mark;
  const rangeM = boat ? haversineMeters(boat, mob) : null;
  const brg = boat ? formatHeading(bearingDegrees(boat, mob)) : "—";
  const rng = rangeM != null ? formatMeters(rangeM) : "—";
  const sog = boat ? msToKnots(boat.speedMs) : 0;
  const ttg =
    boat && rangeM != null && sog >= 0.4 ? formatTtg(rangeM / (boat.speedMs || 1)) : "—";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[5.2rem] z-30 px-2 md:bottom-[9.2rem] md:px-3">
      <div className="pointer-events-auto mx-auto flex w-full max-w-md items-stretch overflow-hidden rounded-xl border border-destructive bg-card/95 shadow-[var(--shadow-border)] rp-glass">
        <div className="min-w-0 flex-1 px-3 py-2">
          <p className="truncate text-t12 text-destructive">
            {mob === mark ? "Back to MOB" : "To drift position now"}
          </p>
          <div className="mt-1 grid grid-cols-3 gap-1">
            <div>
              <p className="text-t11 text-muted-foreground">Brg</p>
              <p className="font-display text-[1.4rem] leading-none font-semibold tabular-nums">
                {brg}
              </p>
            </div>
            <div>
              <p className="text-t11 text-muted-foreground">Rng</p>
              <p className="font-display text-[1.4rem] leading-none font-semibold tabular-nums">
                {rng}
              </p>
            </div>
            <div>
              <p className="text-t11 text-muted-foreground">Ttg</p>
              <p className="font-display text-[1.4rem] leading-none font-semibold tabular-nums">
                {ttg}
              </p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col border-l border-border">
          <button
            type="button"
            onClick={() => setGuide(true)}
            className="flex-1 bg-destructive px-3 text-xs font-semibold text-white"
          >
            Steps
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Clear the man-overboard mark?")) clearMob();
            }}
            className="flex-1 px-3 text-xs font-semibold text-destructive"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

export function NavRibbon() {
  useUnitsKey();
  const boat = useHelm((s) => s.boat);
  const passage = useHelm((s) => s.activePassage);
  const anchor = useHelm((s) => s.anchor);
  const alarmOn = useHelm((s) => s.alarmOn);
  const rode = useHelm((s) => s.rode);
  const hull = useHelm((s) => s.hull);
  const panel = useHelm((s) => s.panel);
  const tapMode = useHelm((s) => s.tapMode);
  const steerSense = useHelm((s) => s.steerSense);
  const xteAlarmM = useHelm((s) => s.xteAlarmM);
  const crumb = useHelm((s) => s.crumb);
  const turnDeg = useHelm((s) => s.trackTurnDeg);
  const chordM = useHelm((s) => s.trackChordM);
  const courseMark = useHelm((s) => s.courseMark);
  const pinned = useHelm((s) => s.pinnedMark);
  const setPanel = useHelm((s) => s.setPanel);
  const math = rodeMath(rode, gpsReachM(hull));

  if (useHelm((s) => s.mob)) return null;
  if (!passage && !anchor) return null;
  if (panel || tapMode !== "none") return null;

  const pts = passage ? guidePoints(passage, crumb, { turnDeg, chordM }) : [];
  const nav = boat && pts.length >= 1 ? markNav(boat, pts, pinned, courseMark) : null;
  const cue =
    boat && pts.length >= 2
      ? steerCue(boat, pts, steerSense, xteAlarmM, nav?.index)
      : null;
  const corners = cornerIndexes(pts);
  const nextCorner =
    nav == null ? null : (corners.find((i) => i >= nav.index) ?? null);
  const toCorner =
    boat && nav && nextCorner != null
      ? metresAlong(pts, boat, nav.index, nextCorner)
      : null;
  const remaining = cue ? formatMeters(cue.remainM) : null;
  const xte =
    cue && Math.abs(cue.xteM) >= 1
      ? `${cue.xteM < 10 ? Math.abs(cue.xteM).toFixed(1) : formatMeters(Math.abs(cue.xteM))} ${cue.xteM > 0 ? "stb" : "port"}`
      : "in the tube";
  const hook = boat && anchor ? haversineMeters(boat, anchor) : null;
  const fenced = Boolean(anchor?.fence && anchor.fence.length >= 3);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[5.2rem] z-20 px-2 md:bottom-[9.2rem] md:px-3">
      <div className="mx-auto flex max-w-6xl flex-wrap gap-1.5">
        {passage ? (
          <button
            type="button"
            onClick={() => setPanel("passages")}
            className="pointer-events-auto rounded-md border border-border bg-card/95 px-2 py-1 text-left shadow-[var(--shadow-border)]"
          >
            <p className="font-display text-sm leading-none font-semibold">
              {passage.title}
            </p>
            {remaining ? (
              <p className="mt-0.5 text-t13 text-muted-foreground">
                {toCorner != null ? `${formatMeters(toCorner)} along to the corner · ` : ""}
                {remaining} left · {xte}
              </p>
            ) : null}
          </button>
        ) : null}
        {anchor && hook != null ? (
          <button
            type="button"
            onClick={() => setPanel("anchor")}
            aria-label="Anchor watch settings"
            className={`pointer-events-auto min-h-11 rounded-md border px-2.5 py-1.5 text-left shadow-[var(--shadow-border)] ${
              alarmOn
                ? "border-destructive bg-destructive text-white"
                : "border-border bg-card/95"
            }`}
          >
            <p className="font-display text-base leading-none font-semibold tabular-nums">
              {fenced ? (
                "Barrier"
              ) : (
                <>
                  {formatMeters(hook)}
                  <span className={`ml-1 text-t13 font-medium ${alarmOn ? "text-white/85" : "text-muted-foreground"}`}>
                    from anchor · circle {formatLength(anchor.radiusM)}
                  </span>
                </>
              )}
            </p>
            <p
              className={`mt-0.5 text-t13 ${
                alarmOn
                  ? "text-white/85"
                  : math.status === "critical"
                    ? "text-destructive"
                    : "text-muted-foreground"
              }`}
            >
              {fenced
                ? alarmOn
                  ? "Outside"
                  : "Inside"
                : `${formatScope(math.scopeHw)} HW${
                    math.shortHwM > 0.4
                      ? ` · +${formatLength(Math.ceil(math.shortHwM))}`
                      : rode.tideHighAt
                        ? ` · ${hoursUntil(rode.tideHighAt)}`
                        : ""
                  }`}
            </p>
          </button>
        ) : null}
      </div>
    </div>
  );
}
