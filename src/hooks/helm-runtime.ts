import { useEffect, useRef } from "react";
import type { Position } from "@capacitor/geolocation";
import { toast } from "sonner";
import { cornerIndexes, formatMeters, haversineMeters, shouldAppendTrack } from "@/lib/geo";
import { boatInsideWatch, anchorPollMs, ANCHOR_POLL_FAST_MS, fixPreciseForWatch } from "@/lib/anchor";
import { HELM_ZOOM } from "@/lib/imagery";
import { previewAlarm, startAlarmTone, stopAlarmTone, unlockAlarmAudio } from "@/lib/alarm";
import { setSteerEar, stopSteerEar } from "@/lib/steer-audio";
import { markNav, steerCue, steerLegIndex } from "@/lib/steer";
import {
  clearAnchorStatus,
  clearWatchNotice,
  showAnchorStatus,
  showWatchNotice,
} from "@/lib/watch-notify";
import {
  freshGuard,
  isGoodFix,
  stepGuard,
  type GuardState,
} from "@/lib/watch-guard";
import { isNativeApp } from "@/lib/native";
import { isDaylight } from "@/lib/sun";
import {
  REMOTE_MAX_REPEATS,
  REMOTE_REPEAT_MS,
  buildMessage,
  publish,
  remoteEvents,
  type RemoteEvent,
  type WatchSnapshot,
} from "@/lib/remote-watch";
import { nearestReef } from "@/lib/reefs";
import {
  FIX_EVENT,
  isBackgroundGpsActive,
  startBackgroundGps,
  type BackgroundWatch,
} from "@/lib/background-gps";
import { useHelm, guidePoints } from "@/store/helm";
import type { Waypoint } from "@/lib/passages";

const MUSGRAVE: Waypoint[] = [
  { lat: -23.8918, lng: 152.3842, label: "Deep approach" },
  { lat: -23.8964, lng: 152.3878, label: "Outer cut" },
  { lat: -23.8998, lng: 152.3906, label: "Channel" },
  { lat: -23.9026, lng: 152.3934, label: "Inner turn" },
  { lat: -23.9058, lng: 152.3964, label: "Lagoon sand" },
];

/** A slow anchor sample stays "fresh" until the next one is due, plus slack. */
const ANCHOR_FIX_FRESH_MS = 45_000;
const UNDERWAY_FIX_FRESH_MS = 20_000;
const ANCHOR_STATUS = "Screen can sleep. Checking the swing about every half minute.";

function asWebFix(pos: Position): GeolocationPosition {
  return {
    coords: {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      altitude: pos.coords.altitude,
      altitudeAccuracy: pos.coords.altitudeAccuracy ?? null,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      toJSON() {
        return this;
      },
    },
    timestamp: pos.timestamp,
    toJSON() {
      return this;
    },
  };
}

export function useGpsWatch() {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!isNativeApp() && !navigator.geolocation) {
      useHelm.getState().setGpsDenied(true);
      return;
    }

    let stopped = false;
    let watchId: number | string | null = null;
    let pollTimer: number | null = null;
    let mode: "watch" | "poll" | "bg" | null = null;
    let bgWatch: BackgroundWatch | null = null;
    let pending = false;
    let pendingAt = 0;

    const applyFix = (pos: GeolocationPosition) => {
      if (stopped) return;
      const s = useHelm.getState();
      // A drag test parks the boat outside the circle; live GPS must not snap it back.
      if (s.demoPlaying || Date.now() < demoHoldUntil) return;
      const heading = Number.isFinite(pos.coords.heading)
        ? (pos.coords.heading as number)
        : (s.boat?.heading ?? null);
      const fix = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        heading,
        speedMs: pos.coords.speed ?? 0,
        accuracy: pos.coords.accuracy,
        source: "gps" as const,
        at: Date.now(),
      };
      const firstLive = s.boat?.source !== "gps";
      s.setBoat(fix);
      s.setGpsDenied(false);
      if (firstLive) {
        s.setFollowBoat(true);
        s.fly(fix.lat, fix.lng, HELM_ZOOM);
      }
      if (s.drawMode === "record" && shouldAppendTrack(s.draft, fix, 2)) {
        s.appendDraft({ lat: fix.lat, lng: fix.lng });
      }
    };

    const onErr = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        useHelm.getState().setGpsDenied(true);
      }
    };

    const clearWatch = () => {
      if (watchId == null) return;
      const id = watchId;
      watchId = null;
      if (typeof id === "string") {
        void import("@capacitor/geolocation").then(({ Geolocation }) => Geolocation.clearWatch({ id }));
      } else {
        navigator.geolocation.clearWatch(id);
      }
    };
    const clearPoll = () => {
      if (pollTimer != null) {
        window.clearTimeout(pollTimer);
        pollTimer = null;
      }
    };

    const stopBg = () => {
      bgWatch?.stop();
      bgWatch = null;
    };

    /** On the phone, any armed watch must survive the screen locking. */
    const wantBackground = () => {
      if (!isNativeApp()) return false;
      const s = useHelm.getState();
      return Boolean(s.anchor) || s.drawMode === "record" || Boolean(s.activePassage);
    };

    const wantPoll = () => {
      const s = useHelm.getState();
      return Boolean(s.anchor) && s.drawMode !== "record";
    };

    const requestFix = (maximumAge: number) => {
      if (stopped) return;
      if (pending && Date.now() - pendingAt < 20_000) return;
      pending = true;
      pendingAt = Date.now();
      const done = (pos: GeolocationPosition) => {
        pending = false;
        applyFix(pos);
      };
      const fail = (err: GeolocationPositionError) => {
        pending = false;
        onErr(err);
      };
      if (isNativeApp()) {
        void import("@capacitor/geolocation").then(({ Geolocation }) =>
          Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 20_000,
            maximumAge,
          })
            .then((pos) => done(asWebFix(pos)))
            .catch(() =>
              fail({
                code: 2,
                message: "no fix",
                PERMISSION_DENIED: 1,
                POSITION_UNAVAILABLE: 2,
                TIMEOUT: 3,
              }),
            ),
        );
        return;
      }
      navigator.geolocation.getCurrentPosition(done, fail, {
        enableHighAccuracy: true,
        maximumAge,
        timeout: 20_000,
      });
    };

    const schedulePoll = () => {
      if (stopped || !wantPoll()) return;
      const s = useHelm.getState();
      const wait = anchorPollMs(s.boat, s.anchor);
      requestFix(wait === ANCHOR_POLL_FAST_MS ? 5_000 : 25_000);
      pollTimer = window.setTimeout(schedulePoll, wait);
    };

    const startWatch = () => {
      const opts: PositionOptions = {
        enableHighAccuracy: true,
        maximumAge: 8_000,
        timeout: 25_000,
      };
      if (isNativeApp()) {
        void import("@capacitor/geolocation")
          .then(({ Geolocation }) =>
            Geolocation.requestPermissions().then(() =>
              Geolocation.watchPosition(
                { enableHighAccuracy: true, timeout: 25_000, maximumAge: 8_000 },
                (pos, err) => {
                  if (stopped) return;
                  if (pos) applyFix(asWebFix(pos));
                  else if (err) useHelm.getState().setGpsDenied(true);
                },
              ),
            ),
          )
          .then((id) => {
            if (typeof id === "string") {
              watchId = id;
              if (stopped) {
                void import("@capacitor/geolocation").then(({ Geolocation }) =>
                  Geolocation.clearWatch({ id }),
                );
              }
            }
          })
          .catch(() => {
            useHelm.getState().setGpsDenied(true);
          });
        return;
      }
      requestFix(opts.maximumAge ?? 0);
      watchId = navigator.geolocation.watchPosition(applyFix, onErr, opts);
    };

    const sync = () => {
      if (stopped) return;
      if (wantBackground()) {
        if (mode === "bg") return;
        clearWatch();
        clearPoll();
        mode = "bg";
        bgWatch = startBackgroundGps(applyFix, () => useHelm.getState().setGpsDenied(true));
        return;
      }
      stopBg();
      if (wantPoll()) {
        if (mode === "poll") return;
        clearWatch();
        clearPoll();
        mode = "poll";
        schedulePoll();
        return;
      }
      if (mode === "watch") return;
      clearPoll();
      mode = "watch";
      startWatch();
    };

    const onVis = () => {
      if (document.visibilityState !== "visible" || !wantPoll()) return;
      requestFix(5_000);
    };

    sync();
    const unsub = useHelm.subscribe((s, prev) => {
      if (
        Boolean(s.anchor) !== Boolean(prev.anchor) ||
        s.drawMode !== prev.drawMode ||
        Boolean(s.activePassage) !== Boolean(prev.activePassage)
      ) {
        sync();
      }
    });
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stopped = true;
      unsub();
      document.removeEventListener("visibilitychange", onVis);
      clearWatch();
      clearPoll();
      stopBg();
    };
  }, []);
}

export function useDemoCruise() {
  const demoPlaying = useHelm((s) => s.demoPlaying);

  useEffect(() => {
    if (!demoPlaying) return;

    const active = useHelm.getState().activePassage;
    const pts =
      active && active.waypoints.length >= 2 ? active.waypoints : MUSGRAVE;

    let seg = 0;
    let t = 0;
    const tickMs = 80;
    const segTime = 2200;

    const id = window.setInterval(() => {
      const s = useHelm.getState();
      if (!s.demoPlaying) return;
      t += tickMs / segTime;
      if (t >= 1) {
        t = 0;
        seg += 1;
      }
      if (seg >= pts.length - 1) {
        const last = pts[pts.length - 1]!;
        s.setBoat({
          lat: last.lat,
          lng: last.lng,
          heading: s.boat?.heading ?? 120,
          speedMs: 0,
          accuracy: 6,
          source: "demo",
          at: Date.now(),
        });
        s.setDemoPlaying(false);
        return;
      }
      const a = pts[seg]!;
      const b = pts[seg + 1]!;
      const lat = a.lat + (b.lat - a.lat) * t;
      const lng = a.lng + (b.lng - a.lng) * t;
      const heading =
        (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI;
      s.setBoat({
        lat,
        lng,
        heading: (heading + 360) % 360,
        speedMs: 4.2,
        accuracy: 5,
        source: "demo",
        at: Date.now(),
      });
      if (s.drawMode === "record" && shouldAppendTrack(s.draft, { lat, lng }, 2)) {
        s.appendDraft({ lat, lng });
      }
    }, tickMs);

    return () => window.clearInterval(id);
  }, [demoPlaying]);
}

export function useAnchorWatch() {
  const guard = useRef<GuardState>(freshGuard(Date.now(), true));

  useEffect(() => {
    let timer = 0;
    let stopped = false;

    const arm = (ms: number) => {
      timer = window.setTimeout(() => {
        const next = tick();
        if (!stopped) arm(next);
      }, ms);
    };
    const kick = () => {
      window.clearTimeout(timer);
      const next = tick();
      if (!stopped) arm(next);
    };

    document.addEventListener("visibilitychange", kick);
    // Background GPS delivers fixes while browser timers are frozen; check each one.
    window.addEventListener(FIX_EVENT, kick);
    kick();
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", kick);
      window.removeEventListener(FIX_EVENT, kick);
      window.clearTimeout(timer);
      stopAlarmTone();
      stopSteerEar();
      clearWatchNotice();
      clearAnchorStatus();
    };

    function tick(): number {
      const s = useHelm.getState();
      const now = Date.now();
      const visible = document.visibilityState === "visible";
      const boat = s.boat;
      const anchor = s.anchor;
      const watchOn = Boolean(anchor) || Boolean(s.activePassage);
      const slowAnchor = Boolean(anchor) && s.drawMode !== "record";
      const age = boat ? now - boat.at : Infinity;
      const fresh = age < (slowAnchor ? ANCHOR_FIX_FRESH_MS : UNDERWAY_FIX_FRESH_MS);
      const goodFix = Boolean(
        boat &&
          boat.source !== "placed" &&
          boat.source !== "none" &&
          isGoodFix(boat.accuracy, boat.source) &&
          fresh,
      );
      const dragging = Boolean(
        fresh &&
          boat &&
          anchor &&
          fixPreciseForWatch(boat.accuracy, anchor.radiusM) &&
          !boatInsideWatch(boat, anchor),
      );
      const pts = s.activePassage
        ? guidePoints(s.activePassage, s.crumb, {
            turnDeg: s.trackTurnDeg,
            chordM: s.trackChordM,
          })
        : [];
      const leg = boat && pts.length >= 1 ? markNav(boat, pts, s.pinnedMark, s.courseMark) : null;
      const cue =
        boat && pts.length >= 2
          ? steerCue(boat, pts, s.steerSense, s.xteAlarmM, leg ? steerLegIndex(boat, pts, leg.index) : undefined)
          : null;
      // With lock-screen GPS running the page is not frozen when hidden, so the
      // guard can (and must) still raise "GPS lost" with the screen off.
      const { state, alarms } = stepGuard(guard.current, {
        now,
        visible: visible || isBackgroundGpsActive(),
        goodFix,
        fixAt: boat?.at,
        dragging: dragging && goodFix,
        offTrack: Boolean(cue?.offTrack) && goodFix && fresh,
        armed: watchOn,
      });
      guard.current = state;
      if (s.alarmOn !== alarms.drag) s.setAlarmOn(alarms.drag);
      if (s.trackAlarm !== alarms.xte) s.setTrackAlarm(alarms.xte);
      if (goodFix && s.gpsLostAck) s.clearGpsLostAck();
      const showGps = s.gpsAlarmOn && alarms.gpsLost && !s.gpsLostAck;
      if (s.gpsLost !== showGps) s.setGpsLost(showGps);
      const mobOn = Boolean(s.mob);
      const emergency = (alarms.drag || showGps) && !s.alarmMuted;
      const earOn =
        s.steerEar &&
        !s.alarmMuted &&
        Boolean(s.activePassage) &&
        goodFix &&
        cue != null &&
        !mobOn &&
        !emergency;
      if (earOn) setSteerEar(cue.xteM);
      else stopSteerEar();
      const ringing = (emergency || (alarms.xte && !s.steerEar)) && !s.alarmMuted;
      if (anchor) showAnchorStatus(ANCHOR_STATUS);
      else clearAnchorStatus();
      if (ringing) {
        startAlarmTone(s.alarmSound);
        if (visible) unlockAlarmAudio();
        if (alarms.drag) showWatchNotice("drag", "Outside the swing or barrier.");
        else if (alarms.xte) showWatchNotice("xte", "Vessel is off the track.");
        else showWatchNotice("gps", "No fix for more than 60 seconds.");
      } else {
        stopAlarmTone();
        clearWatchNotice();
      }
      const quiet = !visible && Boolean(anchor) && !mobOn && !ringing;
      return quiet ? 5_000 : 1_000;
    }
  }, []);
}

export function useMarkMade() {
  const prev = useRef<number | null>(null);
  const toasted = useRef<number | null>(null);

  useEffect(() => {
    let timer = 0;
    let stopped = false;
    const loop = () => {
      const hidden = document.visibilityState === "hidden";
      if (!hidden) tick();
      if (!stopped) timer = window.setTimeout(loop, hidden ? 8_000 : 1_000);
    };
    const onVis = () => {
      window.clearTimeout(timer);
      loop();
    };
    document.addEventListener("visibilitychange", onVis);
    loop();
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVis);
      window.clearTimeout(timer);
    };

    function tick() {
      const s = useHelm.getState();
      const pts = s.activePassage
        ? guidePoints(s.activePassage, s.crumb, {
            turnDeg: s.trackTurnDeg,
            chordM: s.trackChordM,
          })
        : [];
      if (!s.boat || pts.length < 2 || s.pinnedMark != null || s.mob) {
        prev.current = null;
        return;
      }
      const nav = markNav(s.boat, pts, null, s.courseMark);
      if (!nav) return;
      if (nav.index !== s.courseMark) s.setCourseMark(nav.index);
      const corners = cornerIndexes(pts);
      const madeCorner =
        prev.current != null
          ? corners.find((i) => i >= prev.current! && i < nav.index)
          : undefined;
      if (madeCorner != null && toasted.current !== madeCorner) {
        toast(`Made corner ${corners.indexOf(madeCorner) + 1}`);
        toasted.current = madeCorner;
      }
      prev.current = nav.index;
    };
  }, []);
}

export function useWakeLock() {
  /* On the hook the screen must be allowed to sleep. MOB still holds it. */
  const keepAwake = useHelm((s) => {
    if (s.mob) return true;
    if (s.anchor) return false;
    return s.look !== "normal" || Boolean(s.activePassage) || s.demoPlaying;
  });
  useEffect(() => {
    if (!keepAwake || typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return;
    }
    let released = false;
    let sentinel: WakeLockSentinel | null = null;
    const grab = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        /* unsupported / denied */
      }
    };
    void grab();
    const onVis = () => {
      if (!released && document.visibilityState === "visible") void grab();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVis);
      void sentinel?.release();
    };
  }, [keepAwake]);
}

/**
 * While a drag test runs, live GPS is ignored so the test position holds long
 * enough (12 s) to sound the alarm. Without this, a real phone's 1 Hz GPS put
 * the boat back inside the circle within a second and the test never rang.
 */
let demoHoldUntil = 0;
export const DEMO_HOLD_MS = 30_000;

export function endAlarmTest() {
  demoHoldUntil = 0;
}

export function simulateAnchorDrag() {
  const s = useHelm.getState();
  if (!s.anchor) return;
  unlockAlarmAudio();
  demoHoldUntil = Date.now() + DEMO_HOLD_MS;
  const a = s.anchor;
  let lat = a.lat;
  let lng = a.lng;
  if (a.fence && a.fence.length >= 3) {
    const p = a.fence[0]!;
    lng = p.lng + 0.004;
    lat = p.lat;
  } else {
    lng =
      a.lng +
      (a.radiusM * 1.6) /
        (111320 * Math.cos((a.lat * Math.PI) / 180));
  }
  s.setFollowBoat(true);
  s.setBoat({
    lat,
    lng,
    heading: 90,
    speedMs: 0.4,
    accuracy: 4,
    source: "demo",
    at: Date.now(),
  });
}

export function startMusgraveDemo() {
  const s = useHelm.getState();
  s.setActivePassage({
    localId: "demo-musgrave",
    title: "Lady Musgrave lagoon entrance",
    region: "Great Barrier Reef",
    notes: "Time-compressed visual run of the north-west cut.",
    kind: "passage",
    waypoints: MUSGRAVE,
    savedAt: new Date().toISOString(),
  });
  const first = MUSGRAVE[0]!;
  s.setBoat({
    lat: first.lat,
    lng: first.lng,
    heading: 125,
    speedMs: 4,
    accuracy: 5,
    source: "demo",
    at: Date.now(),
  });
  s.setFollowBoat(true);
  s.setDemoPlaying(true);
  window.setTimeout(() => {
    useHelm.getState().setPanel(null);
  }, 0);
}

export { unlockAlarmAudio, MUSGRAVE };

/** Auto look: night (red) view between sunset and sunrise at the boat, normal by day. */
export function useAutoNight() {
  const autoNight = useHelm((s) => s.autoNight);
  useEffect(() => {
    if (!autoNight) return;
    const check = () => {
      const s = useHelm.getState();
      const at = s.boat ?? s.lastFix ?? s.flyTo;
      if (!at) return;
      const day = isDaylight(at.lat, at.lng, Date.now());
      if (!day && s.look !== "night") s.setLook("night");
      else if (day && s.look === "night") s.setLook("normal");
    };
    check();
    const id = window.setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [autoNight]);
}

/**
 * First-run demo: use the real anchor if one is set, else a temporary one that
 * is never saved, then fake a drag so the new user hears the alarm. Returns a
 * cleanup that puts everything back.
 */
export function runAlarmDemo(): () => void {
  const s = useHelm.getState();
  // A real watch is running: never fake a drag on it (and never pause its GPS). Just play the sound.
  if (s.anchor?.radiusLocked && !s.anchor.demo) {
    previewAlarm(s.alarmSound);
    return () => stopAlarmTone();
  }
  const prevBoat = s.boat;
  let madeAnchor = false;
  if (!s.anchor) {
    const at = s.boat ?? s.lastFix ?? s.flyTo;
    if (!at) return () => undefined;
    useHelm.setState({
      anchor: {
        lat: at.lat,
        lng: at.lng,
        radiusM: 30,
        droppedAt: Date.now(),
        radiusLocked: true,
        fence: null,
        demo: true,
      },
      alarmMuted: false,
    });
    madeAnchor = true;
  }
  simulateAnchorDrag();
  return () => {
    endAlarmTest();
    stopAlarmTone();
    const now = useHelm.getState();
    if (madeAnchor && now.anchor?.demo) now.weighAnchor();
    else now.setAlarmMuted(false);
    if (prevBoat && now.boat?.source === "demo") now.setBoat(prevBoat);
  };
}

/** Sends watch start/stop, alarms and all-clear to the paired second phone. */
export function useRemoteWatch() {
  useEffect(() => {
    const snap = (): WatchSnapshot => {
      const s = useHelm.getState();
      const real = Boolean(s.anchor?.radiusLocked && !s.anchor.demo);
      return { watching: real, drag: real && s.alarmOn, gps: real && s.gpsLost, mob: Boolean(s.mob) };
    };
    let prev = snap();
    let lastRepeat = 0;
    let repeats = 0;

    const send = (event: RemoteEvent) => {
      const s = useHelm.getState();
      const pair = s.remoteWatch;
      if (!pair) return;
      const where = s.anchor ?? s.boat;
      const reef = where ? nearestReef(where.lat, where.lng) : null;
      const outside =
        s.boat && s.anchor ? Math.max(0, haversineMeters(s.boat, s.anchor) - s.anchor.radiusM) : null;
      void publish(
        buildMessage(pair.topic, event, {
          boatName: pair.boatName,
          place: reef?.name,
          radiusText: s.anchor ? formatMeters(s.anchor.radiusM) : undefined,
          outsideText: outside != null ? `${formatMeters(outside)} outside` : undefined,
          boat: event === "mob" ? (s.mob ?? s.boat) : s.boat,
        }),
      );
    };

    const onChange = () => {
      const next = snap();
      for (const e of remoteEvents(prev, next)) send(e);
      if ((next.drag && !prev.drag) || (next.gps && !prev.gps)) {
        lastRepeat = Date.now();
        repeats = 0;
      }
      prev = next;
    };

    // Keep nudging the second phone while an alarm rings unanswered.
    const repeat = () => {
      const now = snap();
      const ringing = (now.drag || now.gps) && !useHelm.getState().alarmMuted;
      if (!ringing || repeats >= REMOTE_MAX_REPEATS) return;
      if (Date.now() - lastRepeat < REMOTE_REPEAT_MS) return;
      lastRepeat = Date.now();
      repeats += 1;
      send(now.drag ? "drag" : "gps");
    };

    const unsub = useHelm.subscribe(onChange);
    const id = window.setInterval(repeat, 5_000);
    window.addEventListener(FIX_EVENT, repeat);
    return () => {
      unsub();
      window.clearInterval(id);
      window.removeEventListener(FIX_EVENT, repeat);
    };
  }, []);
}
