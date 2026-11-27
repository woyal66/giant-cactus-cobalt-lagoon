import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bearingDegrees, formatHeading, formatMeters, haversineMeters, msToKnots } from "@/lib/geo";
import { formatXte, markLine, markNav, nextTurn, steerCue, steerLegIndex, type TurnAhead } from "@/lib/steer";
import { isNativeApp } from "@/lib/native";
import { setAllowance } from "@/lib/weather";
import { useWx } from "@/hooks/weather";
import { cn } from "@/lib/utils";
import { useHelm, guidePoints } from "@/store/helm";

export function AlarmOverlay() {
  const alarmOn = useHelm((s) => s.alarmOn);
  const trackAlarm = useHelm((s) => s.trackAlarm);
  const muted = useHelm((s) => s.alarmMuted);
  const boat = useHelm((s) => s.boat);
  const anchor = useHelm((s) => s.anchor);
  const passage = useHelm((s) => s.activePassage);
  const turnDeg = useHelm((s) => s.trackTurnDeg);
  const chordM = useHelm((s) => s.trackChordM);
  const steerSense = useHelm((s) => s.steerSense);
  const xteAlarmM = useHelm((s) => s.xteAlarmM);
  const courseMark = useHelm((s) => s.courseMark);
  const pinned = useHelm((s) => s.pinnedMark);
  const gpsLost = useHelm((s) => s.gpsLost);
  const ackGpsLost = useHelm((s) => s.ackGpsLost);
  const setGpsAlarmOn = useHelm((s) => s.setGpsAlarmOn);
  const setMuted = useHelm((s) => s.setAlarmMuted);
  const weigh = useHelm((s) => s.weighAnchor);
  const setActivePassage = useHelm((s) => s.setActivePassage);
  const [gpsOffAsk, setGpsOffAsk] = useState(false);

  if (alarmOn && anchor && boat) {
    const d = haversineMeters(boat, anchor);
    const fenced = Boolean(anchor.fence && anchor.fence.length >= 3);
    const over = d - anchor.radiusM;
    return (
      <div className="pointer-events-none absolute inset-x-0 top-[max(0.5rem,var(--safe-area-inset-top,env(safe-area-inset-top)))] z-50 flex justify-center px-3">
        <div className="rp-alarm pointer-events-auto w-full max-w-md rounded-xl border border-destructive bg-destructive px-4 py-3 text-white shadow-[var(--shadow-border)]">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl leading-none font-semibold">
                Anchor dragging
              </p>
              <p className="mt-1 text-sm text-white/85">
                {fenced
                  ? "Outside the barrier"
                  : `${formatMeters(over)} outside a ${formatMeters(anchor.radiusM)} circle`}
              </p>
              <p className="mt-1 font-display text-lg leading-none font-semibold tabular-nums">
                Anchor bears {formatHeading(bearingDegrees(boat, anchor))} ·{" "}
                {formatMeters(d)}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              onClick={() => setMuted(!muted)}
              className="bg-white text-destructive hover:bg-white/90"
            >
              {muted ? "Unmute" : "Silence"}
            </Button>
            <Button
              variant="outline"
              onClick={weigh}
              className="border-white/40 bg-transparent text-white hover:bg-white/10"
            >
              Weigh anchor
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (gpsLost) {
    return (
      <div className="pointer-events-none absolute inset-x-0 top-[max(0.5rem,var(--safe-area-inset-top,env(safe-area-inset-top)))] z-50 flex justify-center px-3">
        <div className="rp-alarm pointer-events-auto w-full max-w-md rounded-xl border border-destructive bg-destructive px-4 py-3 text-white shadow-[var(--shadow-border)]">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl leading-none font-semibold">
                GPS lost
              </p>
              <p className="mt-1 text-sm text-white/85">
                {gpsOffAsk
                  ? "Turning this off means a dead fix will not warn you, at anchor or on a cut, until you turn it back on."
                  : "No good fix for more than 60 seconds. A short hole or the phone sleeping will not trip this."}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {gpsOffAsk ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setGpsOffAsk(false)}
                  className="bg-white text-destructive hover:bg-white/90"
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setGpsAlarmOn(false);
                    setGpsOffAsk(false);
                  }}
                  className="border-white/40 bg-transparent text-white hover:bg-white/10"
                >
                  Turn off
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => ackGpsLost()}
                  className="bg-white text-destructive hover:bg-white/90"
                >
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setMuted(!muted)}
                  className="border-white/40 bg-transparent text-white hover:bg-white/10"
                >
                  {muted ? "Unmute" : "Silence"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setGpsOffAsk(true)}
                  className="col-span-2 border-white/40 bg-transparent text-white hover:bg-white/10"
                >
                  Turn GPS alarm off
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!trackAlarm || !boat || !passage) return null;
  const pts = guidePoints(passage, undefined, { turnDeg, chordM });
  const nav = markNav(boat, pts, pinned, courseMark);
  const cue = steerCue(boat, pts, steerSense, xteAlarmM, nav?.index);
  if (!cue) return null;
  const side = cue.xteM >= 0 ? "starboard" : "port";
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[max(0.5rem,var(--safe-area-inset-top,env(safe-area-inset-top)))] z-50 flex justify-center px-3">
      <div className="rp-alarm pointer-events-auto w-full max-w-md rounded-xl border border-destructive bg-destructive px-4 py-3 text-white shadow-[var(--shadow-border)]">
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl leading-none font-semibold">
              Off track
            </p>
            <p className="mt-1 text-sm text-white/85">
              {formatMeters(Math.abs(cue.xteM))} {side} of the line
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={() => setMuted(!muted)}
            className="bg-white text-destructive hover:bg-white/90"
          >
            {muted ? "Unmute" : "Silence"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setActivePassage(null)}
            className="border-white/40 bg-transparent text-white hover:bg-white/10"
          >
            Drop track
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The steering bar's bottom edge, so the chart buttons can start below it. Its height changes
 * with the look (night and sunlight are larger) and the text size.
 */
let steerObserver: ResizeObserver | null = null;
function publishSteerBottom(el: HTMLDivElement | null) {
  steerObserver?.disconnect();
  steerObserver = null;
  const emit = (px: number) => window.dispatchEvent(new CustomEvent("rp:steer-bottom", { detail: px }));
  if (!el) {
    emit(0);
    return;
  }
  const measure = () => {
    const bar = el.firstElementChild as HTMLElement | null;
    emit(bar ? Math.round(bar.getBoundingClientRect().bottom) : 0);
  };
  steerObserver = new ResizeObserver(measure);
  steerObserver.observe(el);
  measure();
}

export function SteerOverlay() {
  const boat = useHelm((s) => s.boat);
  const passage = useHelm((s) => s.activePassage);
  const turnDeg = useHelm((s) => s.trackTurnDeg);
  const chordM = useHelm((s) => s.trackChordM);
  const chartUp = useHelm((s) => s.chartUp);
  const tapMode = useHelm((s) => s.tapMode);
  const panel = useHelm((s) => s.panel);
  const sense = useHelm((s) => s.steerSense);
  const courseMark = useHelm((s) => s.courseMark);
  const pinned = useHelm((s) => s.pinnedMark);
  const trackAlarm = useHelm((s) => s.trackAlarm);
  const big = useHelm((s) => s.steerBig);
  const look = useHelm((s) => s.look);
  const wx = useWx();

  if (!boat || tapMode !== "none" || panel === "weather") return null;

  const pts = passage ? guidePoints(passage, undefined, { turnDeg, chordM }) : [];
  // Not following a track: just speed and heading, in a slim chip (no empty XTE / CTS boxes).
  if (pts.length < 2) {
    const kn = msToKnots(boat.speedMs);
    const sogText = Number.isFinite(kn) ? kn.toFixed(1) : "—";
    return (
      <div
        ref={publishSteerBottom}
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-2 pt-[max(0.35rem,var(--safe-area-inset-top,env(safe-area-inset-top)))] md:hidden"
      >
        <div
          className="rp-glass flex items-baseline gap-3 rounded-full border border-border bg-card/95 px-4 py-1.5 shadow-[var(--shadow-border)]"
          aria-label={`Speed ${sogText} knots, heading ${formatHeading(boat.heading)}`}
        >
          <span className="font-display text-t16 leading-none font-semibold tabular-nums">
            {sogText}
            <span className="ml-0.5 text-t12 font-medium text-muted-foreground">kn</span>
          </span>
          <span className="font-display text-t16 leading-none font-semibold tabular-nums">{formatHeading(boat.heading)}</span>
        </div>
      </div>
    );
  }
  const nav = boat && pts.length ? markNav(boat, pts, pinned, courseMark) : null;
  const turn = nav && pts.length >= 2 ? nextTurn(boat, pts, nav.index) : null;
  // A turn at the mark just counted as made is still to be steered (see steerLegIndex).
  const legTo = nav ? steerLegIndex(boat, pts, nav.index) : undefined;
  const cue =
    pts.length >= 2 ? steerCue(boat, pts, sense, 0, legTo) : null;
  const sog = msToKnots(boat.speedMs);
  const cog = boat.heading;
  // Before the first mark the boat is just heading for the start: no track to be off yet.
  const toStart = nav?.index === 0;
  const xte = toStart ? { value: "—", unit: "", side: null as string | null } : formatXte(cue?.xteM);
  const onLine = Boolean(cue && Math.abs(cue.xteM) < 1 && Math.abs(cue.steerDeg) < 6);
  const tone = cue && (cue.offTrack || trackAlarm) ? "danger" : onLine ? "ok" : cue ? "warn" : "ok";
  const showArrow = chartUp === "heading" && cue && boat.heading != null;
  const sogLabel = Number.isFinite(sog) ? sog.toFixed(1) : "—";
  const ctsLabel = cue ? formatHeading(cue.cts) : "—";
  const sea = wx.data?.sea;
  const allow =
    cue && sea?.currentKn != null && sea.currentDir != null
      ? setAllowance(cue.cts, sog, sea.currentKn, sea.currentDir)
      : null;
  const xteAria =
    xte.side === "S"
      ? `${xte.value.replace("S", "")} metres starboard`
      : xte.side === "P"
        ? `${xte.value.replace("P", "")} metres port`
        : xte.value === "0"
          ? "on track"
          : "no track";

  const line = nav ? markLine(boat, pts, nav.index, turn, formatMeters, formatHeading) : "";
  if (big) {
    return (
      <BigSteer
        night={look === "night"}
        cts={ctsLabel}
        steerDeg={cue && boat.heading != null ? cue.steerDeg : null}
        xte={xte}
        sog={sogLabel}
        turn={turn}
        markIndex={nav?.index ?? 0}
        line={line}
        warn={Boolean(cue?.offTrack || trackAlarm)}
      />
    );
  }

  return (
    <div
      ref={publishSteerBottom}
      className="pointer-events-none absolute inset-x-0 top-0 z-30 px-2 pt-[max(0.2rem,var(--safe-area-inset-top,env(safe-area-inset-top)))] md:top-[6.15rem] md:px-3 md:pt-0"
    >
      <div
        className={`rp-steer rp-steer-${tone} mx-auto flex w-full max-w-lg flex-col items-center md:max-w-2xl`}
        aria-label={`Speed ${sogLabel} knots. Cross-track ${xteAria}. Course to steer ${ctsLabel}${
          allow ? `. Allow ${allow.deg} degrees ${allow.side === "P" ? "port" : "starboard"} for set` : ""
        }.`}
      >
        <button
          type="button"
          aria-label="Big steering view"
          title="Tap for the big steering view"
          onClick={() => useHelm.getState().setSteerBig(true)}
          className="rp-helm-tape rp-glass pointer-events-auto grid w-full grid-cols-3 text-left md:grid-cols-4"
        >
          <HelmNum className="hidden md:flex" label="COG" value={formatHeading(cog)} />
          <HelmNum label="SOG" value={sogLabel} unit="kn" />
          <HelmNum
            label="XTE"
            value={xte.value}
            unit={xte.unit || undefined}
            warn={Boolean(cue?.offTrack || trackAlarm)}
          />
          <HelmNum
            label="CTS"
            value={ctsLabel}
            unit={allow ? `${allow.deg}° ${allow.side}` : undefined}
          />
        </button>
        {nav && pts.length >= 2 ? (
          <TurnLine turn={turn} markIndex={nav.index} text={line} />
        ) : null}
        {showArrow ? (
          <div
            className="rp-steer-bug mt-1"
            style={{ transform: `rotate(${cue.steerDeg}deg)` }}
            aria-hidden
          >
            <svg viewBox="0 0 64 72" className="rp-steer-bug-svg">
              <path d="M32 4 L56 44 L40 44 L40 68 L24 68 L24 44 L8 44 Z" />
            </svg>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The big steering view: course to steer, a large arrow and how far off the line, on a plain
 * background (black on white by day, red on black at night), readable in bright sun from the
 * helm. Tap anywhere (or Chart) to go back.
 */
function BigSteer({
  night,
  cts,
  steerDeg,
  xte,
  sog,
  turn,
  markIndex,
  line,
  warn,
}: {
  night: boolean;
  cts: string;
  steerDeg: number | null;
  xte: { value: string; unit: string; side: string | null };
  sog: string;
  turn: TurnAhead | null;
  markIndex: number;
  line: string;
  warn: boolean;
}) {
  const voiceOn = useHelm((s) => s.voiceOn);
  const close = () => useHelm.getState().setSteerBig(false);
  const fg = night ? "#ff5a4a" : "#000";
  const bg = night ? "#000" : "#fff";
  const port = steerDeg != null && steerDeg < -3;
  const stbd = steerDeg != null && steerDeg > 3;
  const steerText =
    steerDeg == null ? "" : Math.abs(steerDeg) <= 3 ? "On course" : `Steer ${Math.round(Math.abs(steerDeg))}° ${steerDeg > 0 ? "starboard" : "port"}`;
  return (
    <div
      className="absolute inset-0 z-[45] flex flex-col items-center px-4 pt-[max(0.75rem,var(--safe-area-inset-top,env(safe-area-inset-top)))] pb-[max(0.75rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))]"
      style={{ background: bg, color: fg }}
      role="region"
      aria-label={`Course to steer ${cts}. ${steerText}. Cross-track ${xte.value} ${xte.unit}.`}
    >
      <div className="flex w-full max-w-xl items-center justify-between gap-2">
        <span className="font-display text-t16 font-semibold tabular-nums">{sog} kn</span>
        <div className="flex gap-2">
          <button
            type="button"
            className="h-11 rounded-full border-2 px-4 text-t15 font-semibold"
            style={{ borderColor: fg }}
            aria-pressed={voiceOn}
            onClick={() => useHelm.getState().setVoiceOn(!voiceOn)}
          >
            {voiceOn ? "Voice on" : "Voice off"}
          </button>
          <button type="button" className="h-11 rounded-full border-2 px-4 text-t15 font-semibold" style={{ borderColor: fg }} onClick={close}>
            Chart
          </button>
        </div>
      </div>
      <button type="button" className="flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-2" onClick={close} aria-label="Back to the chart">
        <span className="text-t16 font-semibold">Course to steer</span>
        <span className="font-display leading-none font-semibold tabular-nums" style={{ fontSize: "min(26vw, 22vh, 10rem)" }}>
          {cts}
        </span>
        {steerDeg != null ? (
          <svg
            viewBox="0 0 64 72"
            aria-hidden
            style={{ width: "min(38vw, 26vh)", height: "min(38vw, 26vh)", transform: `rotate(${Math.max(-90, Math.min(90, steerDeg))}deg)`, transition: "transform 0.4s" }}
          >
            <path d="M32 4 L56 44 L40 44 L40 68 L24 68 L24 44 L8 44 Z" fill={port ? "#dc2626" : stbd ? "#16a34a" : fg} />
          </svg>
        ) : null}
        <span className="font-display text-t16 font-semibold" style={{ fontSize: "1.6rem" }}>
          {steerText}
        </span>
        <span className="mt-1 font-display font-semibold tabular-nums" style={{ fontSize: "2.4rem", color: warn ? "#dc2626" : undefined }}>
          Off line {xte.value}
          {xte.unit ? ` ${xte.unit}` : ""}
        </span>
      </button>
      <TurnLine turn={turn} markIndex={markIndex} text={line} big />
    </div>
  );
}

/** One short buzz: a turn is due, or a waypoint was passed. */
function buzz(strong: boolean) {
  if (isNativeApp()) {
    void import("@capacitor/haptics")
      .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: strong ? ImpactStyle.Heavy : ImpactStyle.Medium }))
      .catch(() => navigator.vibrate?.(strong ? [120, 60, 120] : 80));
  } else {
    navigator.vibrate?.(strong ? [120, 60, 120] : 80);
  }
}

/** Next turn on the route, called before it arrives, so the helm turns on time. */
function TurnLine({ turn, markIndex, text, big }: { turn: TurnAhead | null; markIndex: number; text: string; big?: boolean }) {
  const lastNow = useRef<number>(-1);
  const lastMark = useRef<number>(markIndex);
  useEffect(() => {
    if (turn?.now && lastNow.current !== turn.index) {
      lastNow.current = turn.index;
      buzz(true);
    }
  }, [turn?.now, turn?.index]);
  useEffect(() => {
    if (markIndex > lastMark.current) buzz(false);
    lastMark.current = markIndex;
  }, [markIndex]);
  if (!text) return null;
  const side = turn && turn.now && "turnDeg" in turn ? (turn.turnDeg > 0 ? "S" : "P") : null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        big
          ? "flex w-full max-w-xl items-center justify-center gap-2 rounded-2xl border-2 border-current px-4 py-3 text-center font-semibold tabular-nums [font-size:1.5rem] leading-tight"
          : "rp-glass mt-1 flex items-center gap-2 rounded-full px-3 py-1 text-t15 font-semibold tabular-nums",
        turn?.now && side === "S" && "bg-emerald-600 text-white",
        turn?.now && side === "P" && "bg-red-600 text-white",
        turn?.now && !side && "bg-primary text-primary-foreground",
      )}
    >
      {side ? (
        <span aria-hidden className="text-base leading-none">
          {side === "S" ? "↱" : "↰"}
        </span>
      ) : null}
      {text}
    </div>
  );
}

function HelmNum({
  label,
  value,
  unit,
  warn,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  warn?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col items-center px-1 py-1.5", className)}>
      <p className="rp-helm-label font-semibold text-muted-foreground">
        {label}
      </p>
      <p className={cn("rp-helm-num font-display font-semibold tabular-nums leading-none", warn && "rp-helm-warn")}>
        {value}
      </p>
      {unit ? <p className="rp-helm-unit mt-0.5 font-semibold text-muted-foreground">{unit}</p> : null}
    </div>
  );
}

export function Disclaimer() {
  return (
    <p className="pointer-events-none absolute bottom-4 left-3 z-10 hidden max-w-[16rem] text-t12 leading-snug text-foreground/80 md:block">
      Not a carriage chart. Satellite + OpenSeaMap are lookout aids.{" "}
      <Link to="/privacy" className="pointer-events-auto underline-offset-2 hover:underline">
        Privacy
      </Link>
    </p>
  );
}

export function LoginHint() {
  return (
    <Link
      to="/"
      className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      Back to the helm
    </Link>
  );
}
