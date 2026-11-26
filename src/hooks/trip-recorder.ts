import { useEffect } from "react";
import { toast } from "sonner";
import { pathLengthMeters, type LatLng } from "@/lib/geo";
import { kvGet, kvSet } from "@/lib/kv";
import { loadActivePassage } from "@/lib/routing/passage-store";
import { keepFix, thinPlan, tripStats, type TripFix, type TripPlan } from "@/lib/trip";
import { MAX_TRIPS, useHelm, type TripRecord } from "@/store/helm";

/** Moving this fast for 20 s while a route is up counts as setting off. */
const SET_OFF_KN = 1.5;
const FLUSH_MS = 30_000;

export const tripKey = (id: string) => `trip:fixes:${id}`;

let buffer: TripFix[] = [];
let last: TripFix | undefined;
let flushTimer = 0;
let movingSince = 0;

async function flush(id: string) {
  if (!buffer.length) return;
  const add = buffer;
  buffer = [];
  const prev = (await kvGet<TripFix[]>(tripKey(id)).catch(() => undefined)) ?? [];
  // Very long trips: keep every other old fix past 20,000 so storage stays small.
  const all = prev.concat(add);
  await kvSet(tripKey(id), all.length > 20_000 ? all.filter((_, i) => i % 2 === 0 || i > all.length - 5_000) : all).catch(() => undefined);
}

async function planFor(passageId: string | undefined): Promise<TripPlan | undefined> {
  if (!passageId) return undefined;
  const saved = await loadActivePassage().catch(() => undefined);
  if (!saved || saved.id !== passageId || saved.points.length < 2) return undefined;
  return {
    title: saved.title,
    departAt: saved.departAt,
    arriveAt: saved.arriveAt,
    distM: pathLengthMeters(saved.points),
    points: thinPlan(saved.points),
  };
}

function start(by: "record" | "follow") {
  const s = useHelm.getState();
  if (s.activeTrip) return;
  const id = `trip-${Date.now()}`;
  const passageId = s.activePassage && "localId" in s.activePassage ? s.activePassage.localId : undefined;
  buffer = [];
  last = undefined;
  useHelm.setState({ activeTrip: { id, startedAt: Date.now(), by, passageId } });
  void planFor(passageId).then((plan) => {
    const t = useHelm.getState().activeTrip;
    if (plan && t?.id === id) useHelm.setState({ activeTrip: { ...t, plan } });
  });
}

/**
 * Finish the trip: work out its stats and keep it. Returns the record, or null for a trip too
 * short to be worth keeping (under 100 m or 2 minutes).
 */
async function finish(opts: { trackId?: string; anchoredAt?: LatLng; discard?: boolean }): Promise<TripRecord | null> {
  const t = useHelm.getState().activeTrip;
  if (!t) return null;
  useHelm.setState({ activeTrip: null });
  await flush(t.id);
  if (opts.discard) return null;
  const fixes = (await kvGet<TripFix[]>(tripKey(t.id)).catch(() => undefined)) ?? [];
  const stats = tripStats(fixes, t.plan);
  if (!stats || stats.distM < 100 || stats.endAt - stats.startAt < 120_000) return null;
  const s = useHelm.getState();
  const track = opts.trackId ? s.drafts.find((d) => d.localId === opts.trackId) : undefined;
  const when = new Date(stats.departAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const rec: TripRecord = {
    id: t.id,
    title: track?.title ?? t.plan?.title ?? `Trip ${when}`,
    stats,
    plan: t.plan,
    trackId: opts.trackId,
    anchoredAt: opts.anchoredAt,
  };
  useHelm.setState({ trips: [rec, ...s.trips.filter((x) => x.id !== rec.id)].slice(0, MAX_TRIPS) });
  return rec;
}

/**
 * Trip log: records a timestamped fix every few seconds while a trip runs, on the phone. A trip
 * starts when you press Start recording, or when you get moving with a route up to follow; it
 * ends at Stop, when you stop following, or when you set the anchor. Stats come at the end.
 */
export function useTripRecorder() {
  useEffect(() => {
    const onHide = () => {
      const t = useHelm.getState().activeTrip;
      if (document.hidden && t) void flush(t.id);
    };
    document.addEventListener("visibilitychange", onHide);
    const unsub = useHelm.subscribe((s, prev) => {
      // Start: recording begins, or moving off with a route up.
      if (!s.activeTrip) {
        if (s.drawMode === "record" && prev.drawMode !== "record") start("record");
        else if (s.activePassage && s.boat && s.boat !== prev.boat && s.boat.source === "gps") {
          const kn = (s.boat.speedMs ?? 0) * 1.943844;
          if (kn >= SET_OFF_KN) {
            movingSince ||= s.boat.at;
            if (s.boat.at - movingSince >= 20_000) start("follow");
          } else movingSince = 0;
        }
      }
      const t = useHelm.getState().activeTrip;
      if (!t) return;
      // Fixes.
      if (s.boat && s.boat !== prev.boat && (s.boat.source === "gps" || s.boat.source === "demo")) {
        const f: TripFix = {
          at: s.boat.at,
          lat: s.boat.lat,
          lng: s.boat.lng,
          sog: Number.isFinite(s.boat.speedMs) ? s.boat.speedMs : NaN,
          acc: s.boat.accuracy ?? NaN,
          eng: s.routePrefs.engineOn || s.routePrefs.boatType === "motor",
        };
        if (keepFix(last, f)) {
          buffer.push(f);
          last = f;
          if (!flushTimer) {
            flushTimer = window.setTimeout(() => {
              flushTimer = 0;
              const cur = useHelm.getState().activeTrip;
              if (cur) void flush(cur.id);
            }, FLUSH_MS);
          }
        }
      }
      // End: the anchor goes down.
      if (s.anchor?.radiusLocked && !prev.anchor?.radiusLocked && !s.anchor.demo) {
        const at = { lat: s.anchor.lat, lng: s.anchor.lng };
        void finish({ anchoredAt: at }).then((rec) => {
          if (!rec) return;
          toast.success("Trip saved", {
            description: "Your trip ends here, at the anchor.",
            action: { label: "See stats", onClick: () => useHelm.setState({ tripView: rec.id, panel: "trip" }) },
            duration: 8000,
          });
        });
        return;
      }
      // End: Stop recording (the new track), whichever way the trip started.
      if (prev.drawMode === "record" && s.drawMode !== "record") {
        const newTrack = s.drafts[0] && s.drafts[0] !== prev.drafts[0] ? s.drafts[0].localId : undefined;
        if (newTrack) {
          void finish({ trackId: newTrack });
          return;
        }
        // Discard with no route to follow: drop the trip too.
        if (t.by === "record" && !s.activePassage) {
          void finish({ discard: true });
          return;
        }
      }
      // End: stop following the route (and not recording).
      if (s.drawMode !== "record" && prev.activePassage && !s.activePassage) void finish({});
    });
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      unsub();
    };
  }, []);
}

/** Trip for a recorded track, if it has one. */
export function tripForTrack(trackId: string): TripRecord | undefined {
  return useHelm.getState().trips.find((t) => t.trackId === trackId);
}
