import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SatPaste } from "@/components/helm/sat-paste";
import { isNativeApp } from "@/lib/native";
import { formatDepth } from "@/lib/units";
import { windCardinal } from "@/lib/weather";
import { kvGet, kvSet } from "@/lib/kv";
import { shareTextFile } from "@/lib/share-file";
import { planOnFields, runPlan } from "@/lib/routing/client";
import { forecastAge, loadActivePassage, saveActivePassage, type SavedPassage } from "@/lib/routing/passage-store";
import { apparentWind, describe, sailPlan } from "@/lib/routing/sails";
import { RISK_LABEL } from "@/lib/routing/storm";
import {
  describeProgress,
  logToCsv,
  meaningfulChange,
  progressOnPlan,
  upcoming,
  type LogEntry,
} from "@/lib/routing/underway";
import type { RouteMode, RoutePoint } from "@/lib/routing/router";
import type { PlanOutput } from "@/lib/routing/plan";
import { isLocalDraft, useHelm, useUnitsKey, type LocalDraft } from "@/store/helm";

const MIN = 60_000;
const H = 3_600_000;
/** Look for a newer forecast when the one in use is this old. */
const STALE_MS = 6 * H;
const LOG_EVERY_MS = 30 * MIN;
const SAIL_NOTICE_BASE = 700;

function clock(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function asDraft(title: string, pts: RoutePoint[], id: string): LocalDraft {
  return {
    localId: id,
    title,
    region: "",
    notes: "Planned by weather routing. Check against a chart.",
    kind: "passage",
    waypoints: pts.map((p, i) => ({
      lat: p.lat,
      lng: p.lng,
      label: i === 0 ? "Start" : i === pts.length - 1 ? "Finish" : clock(p.at),
    })),
    savedAt: new Date().toISOString(),
  };
}

function bestOf(out: PlanOutput, mode: RouteMode) {
  return out.best[mode] ?? out.best.fastest ?? out.best.safest ?? out.best.comfort;
}

/**
 * Passage companion while following a planned route: on-plan check, the next three
 * hours, re-route from here (works offline on the saved forecast), quiet checks for
 * newer forecasts, sail-change reminders and an automatic passage log.
 */
export function PassageHud() {
  useUnitsKey();
  const active = useHelm((s) => s.activePassage);
  const boat = useHelm((s) => s.boat);
  const sails = useHelm((s) => s.routePrefs.sails);
  const prefs = useHelm((s) => s.routePrefs);
  const [saved, setSaved] = useState<SavedPassage | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [update, setUpdate] = useState<{ reasons: string[]; passage: SavedPassage } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastIndex = useRef(0);
  const announced = useRef(new Set<number>());

  const activeId = active && isLocalDraft(active) ? active.localId : null;

  useEffect(() => {
    if (!activeId) {
      setSaved(null);
      return;
    }
    let live = true;
    void loadActivePassage().then((p) => {
      if (live) setSaved(p && p.id === activeId ? p : null);
    });
    return () => {
      live = false;
    };
  }, [activeId]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const fix = boat && (boat.source === "gps" || boat.source === "demo") ? boat : null;
  // Before the planned departure there is nothing to be ahead of or behind.
  const notYet = saved ? now < saved.departAt - 10 * MIN : false;
  const progress = useMemo(
    () => (saved && fix && !notYet ? progressOnPlan(saved.points, fix, now, lastIndex.current) : null),
    [saved, fix, now, notYet],
  );
  if (progress) lastIndex.current = progress.index;
  const plan = useMemo(() => (saved ? sailPlan(saved.points, sails) : null), [saved, sails]);
  const shiftMs = progress ? progress.behindMin * MIN : 0;

  // Sail-change reminders: a notification on the phone, a toast if the app is open.
  useEffect(() => {
    if (!plan || !saved) return;
    if (isNativeApp()) {
      void import("@capacitor/local-notifications").then(async ({ LocalNotifications }) => {
        const ids = Array.from({ length: 40 }, (_, i) => ({ id: SAIL_NOTICE_BASE + i }));
        await LocalNotifications.cancel({ notifications: ids }).catch(() => undefined);
        const soon = plan.changes
          .slice(1)
          .map((c, i) => ({ id: SAIL_NOTICE_BASE + i, at: c.at + shiftMs - 10 * MIN, text: c.text }))
          .filter((c) => c.at > Date.now() + MIN)
          .slice(0, 40);
        if (soon.length) {
          await LocalNotifications.schedule({
            notifications: soon.map((c) => ({
              id: c.id,
              title: "Sail change in 10 minutes",
              body: c.text,
              schedule: { at: new Date(c.at) },
            })),
          }).catch(() => undefined);
        }
      });
    }
    // Rescheduling on every small delay change would be noisy: round to 15 min.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, saved?.id, Math.round(shiftMs / (15 * MIN))]);

  useEffect(() => {
    if (!plan) return;
    for (const c of plan.changes.slice(1)) {
      const due = c.at + shiftMs;
      if (!announced.current.has(c.at) && now >= due - 10 * MIN && now < due + 15 * MIN) {
        announced.current.add(c.at);
        toast(`Sail plan: ${c.text} around ${clock(due)}`);
      }
    }
  }, [plan, now, shiftMs]);

  // Passage log: an entry every 30 minutes while following.
  useEffect(() => {
    if (!saved || !fix) return;
    const key = `passage:log:${saved.id}`;
    void kvGet<LogEntry[]>(key).then((log = []) => {
      const last = log[log.length - 1];
      if (last && now - last.at < LOG_EVERY_MS) return;
      const at = progress ? saved.points[progress.index] : null;
      const seg = plan?.segments.find((g) => now - shiftMs >= g.from && now - shiftMs < g.to);
      log.push({
        at: now,
        lat: fix.lat,
        lng: fix.lng,
        sogKn: (fix.speedMs ?? 0) * 1.94384,
        cogDeg: fix.heading ?? null,
        windKn: at?.windKn ?? null,
        windDir: at?.windDir ?? null,
        sails: seg ? describe(seg) : "",
      });
      void kvSet(key, log.slice(-2000));
    });
    // Every tick is fine: the 30-min gate is inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, saved?.id]);

  const replan = useCallback(
    async (from: { lat: number; lng: number }, download: boolean): Promise<SavedPassage | null> => {
      if (!saved) return null;
      const departAt = Date.now();
      const common = {
        start: from,
        finish: saved.finish,
        windowStart: departAt,
        windowEnd: departAt,
        boat: saved.boat,
        limits: saved.limits,
        rules: saved.rules,
        models: saved.models,
      };
      let out: PlanOutput;
      let fields = saved.fields;
      let box = saved.box;
      let forecastAt = saved.forecastAt;
      if (download) {
        const r = await runPlan(common);
        out = r.out;
        fields = r.fields;
        box = r.box;
        forecastAt = r.forecastAt;
      } else {
        out = await planOnFields({ ...common, fields, box });
      }
      const best = bestOf(out, saved.mode);
      if (!best) {
        const reason = out.rows[0]?.results.fastest;
        throw new Error(reason && !reason.ok ? reason.reason : "No route from here in this forecast.");
      }
      return {
        ...saved,
        start: from,
        departAt,
        arriveAt: best.result.arriveAt,
        points: best.result.points,
        fields,
        box,
        forecastAt,
        savedAt: Date.now(),
      };
    },
    [saved],
  );

  const apply = useCallback(async (p: SavedPassage) => {
    await saveActivePassage(p);
    setSaved(p);
    lastIndex.current = 0;
    const s = useHelm.getState();
    const d = asDraft(p.title, p.points, p.id);
    useHelm.setState({ drafts: s.drafts.map((x) => (x.localId === p.id ? d : x)) });
    s.setActivePassage(d);
  }, []);

  // Quietly look for a newer forecast when online and the one in use is old.
  useEffect(() => {
    if (!saved || !fix || busy || update) return;
    if (Date.now() - saved.forecastAt < STALE_MS) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    let live = true;
    void replan(fix, true)
      .then((next) => {
        if (!live || !next) return;
        const curMetrics = progress
          ? { arriveAt: saved.arriveAt + shiftMs, points: saved.points.slice(progress.index) }
          : { arriveAt: saved.arriveAt, points: saved.points };
        const metricsOld = metricsFor(saved.points.slice(progress?.index ?? 0));
        const metricsNew = metricsFor(next.points);
        const reasons = meaningfulChange(
          { ...curMetrics, metrics: metricsOld },
          { arriveAt: next.arriveAt, metrics: metricsNew, points: next.points },
        );
        if (reasons.length) setUpdate({ reasons, passage: next });
        else void saveActivePassage({ ...saved, fields: next.fields, box: next.box, forecastAt: next.forecastAt });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // Re-check at most on each 30 s tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, saved?.id]);

  if (!saved || !active) return null;

  const next3 = progress ? upcoming(saved.points, progress, now, 3) : [];
  const eta = saved.arriveAt + shiftMs;

  return (
    <div className="pointer-events-none absolute inset-x-14 top-[calc(max(0.4rem,env(safe-area-inset-top))+4.1rem)] z-30">
      <div className="pointer-events-auto mx-auto max-w-md rounded-lg border border-border bg-card/95 shadow-[var(--shadow-border)]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-h-10 w-full items-center justify-between gap-2 px-3 py-1.5 text-left"
        >
          <span className="min-w-0 text-t14 leading-tight">
            <span className={`font-semibold ${progress && Math.abs(progress.behindMin) >= 10 ? "text-amber-300" : "text-primary"}`}>
              {notYet
                ? `Departs ${new Date(saved.departAt).toLocaleDateString([], { weekday: "short" })} ${clock(saved.departAt)}`
                : progress
                  ? describeProgress(progress)
                  : "Waiting for GPS"}
            </span>
            <span className="text-muted-foreground"> · ETA {new Date(eta).toDateString() === new Date(now).toDateString() ? "" : `${new Date(eta).toLocaleDateString([], { weekday: "short" })} `}{clock(eta)}</span>
          </span>
          {open ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
        </button>

        {update ? (
          <div className="mx-2 mb-2 rounded-md border border-amber-400/50 bg-amber-400/10 px-2.5 py-2 text-t14">
            <p className="font-semibold">Newer forecast changes the plan</p>
            <ul className="mt-0.5 list-disc pl-4">
              {update.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <Button size="sm" onClick={() => void apply(update.passage).then(() => setUpdate(null))}>
                Use new route
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void saveActivePassage({ ...saved, fields: update.passage.fields, box: update.passage.box, forecastAt: update.passage.forecastAt });
                  setUpdate(null);
                }}
              >
                Keep current
              </Button>
            </div>
          </div>
        ) : null}

        {open ? (
          <div className="border-t border-border px-3 pt-2 pb-2.5">
            <p className="mb-1 text-t12 text-muted-foreground">Next 3 hours</p>
            {next3.length ? (
              <ul className="grid gap-0.5 text-t13 tabular-nums">
                {next3.filter((_, i) => i % Math.max(1, Math.ceil(next3.length / 6)) === 0).map((p) => {
                  const a = apparentWind(p.twsKn, p.twa, p.stwKn);
                  return (
                    <li key={p.at} className="flex justify-between gap-2">
                      <span className="w-14 shrink-0">{clock(p.at)}</span>
                      <span className="flex-1">
                        {Math.round(p.windKn)} kn {windCardinal(p.windDir)} · TWA {Math.round(p.twa)}° / AWA {Math.round(a.awa)}°
                      </span>
                      <span className="text-muted-foreground">
                        {formatDepth(p.waveM)}
                        {p.thunder >= 1 ? ` · ${RISK_LABEL[p.thunder].toLowerCase()} storms` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-t14 text-muted-foreground">Nothing planned for the next 3 hours.</p>
            )}
            <p className="mt-1.5 text-t13 text-muted-foreground">
              Forecast {forecastAge(saved.forecastAt)}, saved on the phone. {Date.now() - saved.forecastAt >= STALE_MS ? "A newer one is fetched when there's signal." : ""}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <Button
                size="sm"
                disabled={!fix || Boolean(busy)}
                onClick={() => {
                  if (!fix) return;
                  setBusy("Re-routing…");
                  void replan(fix, false)
                    .then((p) => p && apply(p).then(() => toast.success(`New route from here. ETA ${clock(p.arriveAt)}`)))
                    .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Couldn't re-route"))
                    .finally(() => setBusy(null));
                }}
              >
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Re-route from here
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void kvGet<LogEntry[]>(`passage:log:${saved.id}`).then((log = []) =>
                    shareTextFile({
                      fileName: `${saved.title.replace(/[^\w-]+/g, "-").slice(0, 40)}-log.csv`,
                      text: logToCsv(log),
                      mime: "text/csv",
                      title: "Passage log",
                    }).catch(() => undefined),
                  );
                }}
              >
                Passage log
              </Button>
            </div>
            <SatPaste />
            {prefs.rules.thunder !== "ignore" && next3.some((p) => p.thunder >= 2) ? (
              <p className="mt-1.5 text-t14 text-amber-300">Storms likely in the next 3 hours. Reef early and watch the sky.</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Metrics for a stretch of a planned route (used to compare against a re-plan). */
function metricsFor(points: RoutePoint[]) {
  const first = points[0];
  const last = points[points.length - 1];
  let maxWind = 0;
  let maxWave = 0;
  let maxThunder: 0 | 1 | 2 | 3 = 0;
  for (const p of points) {
    maxWind = Math.max(maxWind, p.windKn);
    maxWave = Math.max(maxWave, p.waveM);
    if (p.thunder > maxThunder) maxThunder = p.thunder;
  }
  return {
    hours: first && last ? (last.at - first.at) / H : 0,
    distanceNm: 0,
    maxWindKn: maxWind,
    maxGustKn: 0,
    maxWaveM: maxWave,
    upwindPct: 0,
    motorHours: 0,
    windAgainstCurrentHours: 0,
    steepSeaHours: 0,
    maxWaveAmp: 1,
    avgCurrentKn: 0,
    maxThunder,
    thunderHours: 0,
    squallHours: 0,
    arrivesInDark: false,
  };
}
