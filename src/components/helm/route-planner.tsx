import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/helm/panels";
import { RouteSettings, SettingsSummary } from "@/components/helm/route-settings";
import { RouteTimeline } from "@/components/helm/route-timeline";
import { ArrivalCard } from "@/components/helm/arrival-card";
import { forecastAge, saveActivePassage } from "@/lib/routing/passage-store";
import type { WeatherField } from "@/lib/routing/field";
import type { BoatPerf } from "@/lib/routing/polar";
import type { Limits, RouteRules } from "@/lib/routing/router";
import { formatHeading, formatMeters, bearingDegrees, haversineMeters } from "@/lib/geo";
import { formatDepth } from "@/lib/units";
import { shareGpx } from "@/lib/share-gpx";
import { shareTextAndFile } from "@/lib/share-file";
import { passageBrief } from "@/lib/routing/brief";
import { findWeatherWindows, runPlan } from "@/lib/routing/client";
import type { WindowScan } from "@/lib/routing/plan";
import { WindowFinder } from "@/components/helm/window-finder";
import type { Choice, DepartureRow, PlanOutput } from "@/lib/routing/plan";
import type { RouteMetrics, RouteMode, RoutePoint } from "@/lib/routing/router";
import { boatPerfOf, useHelm, useUnitsKey, type LocalDraft } from "@/store/helm";
import { shallowAlong } from "@/lib/depth";

const H = 3_600_000;

type PlanContext = {
  fields: WeatherField[];
  box: { south: number; west: number; north: number; east: number };
  forecastAt: number;
  boat: BoatPerf;
  limits: Limits;
  rules: RouteRules;
  models: string[];
};

function when(at: number): string {
  const d = new Date(at);
  const day = d.toLocaleDateString([], { weekday: "short" });
  const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${day} ${t}`;
}

function dur(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return hh ? `${hh} h ${mm ? `${mm} m` : ""}`.trim() : `${mm} m`;
}

const PLAN_LOOK: Record<RouteMode, { title: string; why: string }> = {
  safest: { title: "Safest", why: "Lowest wind and sea, keeps clear of your limits and wind against tide." },
  fastest: { title: "Fastest", why: "Shortest time, inside your limits." },
  comfort: { title: "Most comfortable", why: "Least upwind work and steep sea." },
};

const START_OFFSETS = [
  { label: "Now", h: 0 },
  { label: "+3 h", h: 3 },
  { label: "+12 h", h: 12 },
  { label: "+24 h", h: 24 },
];
const WINDOWS = [6, 12, 24, 48, 72];

/** Planner: tap start and finish, choose a window, get three plans. */
export function RoutePlanner() {
  const tapMode = useHelm((s) => s.tapMode);
  const panel = useHelm((s) => s.panel);
  const start = useHelm((s) => s.routeStart);
  const finish = useHelm((s) => s.routeFinish);
  const boatFix = useHelm((s) => s.boat);
  const anchorAt = useHelm((s) => (s.anchor?.radiusLocked && !s.anchor.demo ? s.anchor : null));
  const setStart = useHelm((s) => s.setRouteStart);
  const end = useHelm((s) => s.endRoutePlan);

  if (tapMode === "route-start" || tapMode === "route-finish") {
    const picking = tapMode === "route-start" ? "start" : "finish";
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 p-2 pb-[max(0.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))]">
        <div className="pointer-events-auto mx-auto max-w-lg rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-border)]">
          <p className="text-t12 text-muted-foreground">Plan a passage</p>
          <p className="font-display mt-1 text-xl leading-tight font-semibold">
            Tap the {picking === "start" ? "start" : "finish"} on the chart
          </p>
          <p className="mt-0.5 text-t14 text-muted-foreground">
            {picking === "start"
              ? "Zoom and pan as needed, then tap where you'll leave from."
              : "Now tap where you're going. Zoom out to see both ends."}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {picking === "start" && (anchorAt || boatFix) ? (
              <Button
                variant="outline"
                onClick={() => {
                  const at = anchorAt ?? boatFix!;
                  setStart({ lat: at.lat, lng: at.lng });
                }}
              >
                {anchorAt ? "From the anchorage" : "From the boat"}
              </Button>
            ) : picking === "finish" ? (
              <Button variant="outline" onClick={() => setStart(null)}>
                Back
              </Button>
            ) : (
              <span />
            )}
            <Button variant="ghost" onClick={end}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }
  if (panel !== "route" || !start || !finish) return null;
  return <PlannerSheet />;
}

function PlannerSheet() {
  const start = useHelm((s) => s.routeStart)!;
  const finish = useHelm((s) => s.routeFinish)!;
  const prefs = useHelm((s) => s.routePrefs);
  const hull = useHelm((s) => s.hull);
  const setPreview = useHelm((s) => s.setRoutePreview);
  const begin = useHelm((s) => s.beginRoutePlan);
  const [view, setView] = useState<"plan" | "settings" | "windows">("plan");
  const [scan, setScan] = useState<WindowScan | null>(null);
  const [offsetH, setOffsetH] = useState(0);
  const [windowH, setWindowH] = useState(24);
  const [busy, setBusy] = useState<string | null>(null);
  const [out, setOut] = useState<PlanOutput | null>(null);
  const [ctx, setCtx] = useState<PlanContext | null>(null);
  const [picked, setPicked] = useState<{ mode: RouteMode; departAt: number } | null>(null);
  const distM = haversineMeters(start, finish);

  const run = (lead = offsetH, span = windowH) => {
    const now = Date.now();
    const windowStart = Math.ceil((now + lead * H) / (15 * 60_000)) * 15 * 60_000;
    setBusy("Starting…");
    setOut(null);
    setPicked(null);
    setPreview(null);
    const boat = boatPerfOf(prefs, hull.loaM);
    runPlan({
      start,
      finish,
      windowStart,
      windowEnd: windowStart + span * H,
      boat,
      limits: prefs.limits,
      rules: prefs.rules,
      models: prefs.models,
      onStatus: setBusy,
    })
      .then(({ out: o, fields, box, forecastAt }) => {
        setOut(o);
        setCtx({ fields, box, forecastAt, boat, limits: prefs.limits, rules: prefs.rules, models: prefs.models });
        const first = o.best.safest ?? o.best.fastest ?? o.best.comfort;
        if (first) {
          setPicked({ mode: first.result.mode, departAt: first.row.departAt });
          setPreview(first.result.points);
        }
      })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Couldn't plan the passage"))
      .finally(() => setBusy(null));
  };

  const runRef = useRef(run);
  runRef.current = run;

  const pickedResult = useMemo(() => {
    if (!out || !picked) return null;
    const row = out.rows.find((r) => r.departAt === picked.departAt);
    const r = row?.results[picked.mode];
    return row && r?.ok ? { row, result: r } : null;
  }, [out, picked]);

  const choose = (mode: RouteMode, row: DepartureRow) => {
    const r = row.results[mode];
    if (!r.ok) return;
    setPicked({ mode, departAt: row.departAt });
    setPreview(r.points);
  };

  return (
    <Sheet id="route" title="Plan a passage" kicker={`${formatMeters(distM)} · ${formatHeading(bearingDegrees(start, finish))} direct`}>
      <p className="mb-2 text-t13 leading-snug text-amber-300">
        Planning aid only. Routes avoid land on a simplified coastline but do not know about reefs,
        shoals or bommies. Check every leg against a chart and keep a lookout.
      </p>

      {view === "settings" ? (
        <RouteSettings onDone={() => setView("plan")} />
      ) : view === "windows" && scan ? (
        <>
          <WindowFinder
            scan={scan}
            onPick={(w) => {
              const lead = Math.max(0, Math.floor((w.from - Date.now()) / H));
              const span = Math.min(72, Math.max(6, Math.ceil((w.to - w.from) / H) + 3));
              setOffsetH(lead);
              setWindowH(span);
              setView("plan");
              // Plan the chosen window straight away.
              setTimeout(() => runRef.current?.(lead, span), 0);
            }}
          />
          <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setView("plan")}>
            Back
          </Button>
        </>
      ) : !out ? (
        <>
          <p className="mb-1 text-t12 text-muted-foreground">Leave from</p>
          <div className="mb-2 grid grid-cols-4 gap-1.5">
            {START_OFFSETS.map((o) => (
              <Button key={o.h} size="sm" variant={offsetH === o.h ? "default" : "outline"} onClick={() => setOffsetH(o.h)}>
                {o.label}
              </Button>
            ))}
          </div>
          <p className="mb-1 text-t12 text-muted-foreground">Departure window</p>
          <div className="mb-2 grid grid-cols-5 gap-1.5">
            {WINDOWS.map((w) => (
              <Button key={w} size="sm" variant={windowH === w ? "default" : "outline"} onClick={() => setWindowH(w)}>
                {w} h
              </Button>
            ))}
          </div>
          <div className="mb-2 flex items-start justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
            <SettingsSummary />
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setView("settings")}>
              Settings
            </Button>
          </div>
          <p className="mb-2 text-t13 leading-snug text-muted-foreground">
            Tide and ocean currents are included (Météo-France SMOC model, about 8 km
            detail): they speed you up or slow you down, change the wind you sail in, and
            make seas stand up where they run against the waves.
          </p>
          {distM < 926 ? (
            <p className="mb-2 text-t14 text-destructive">
              Start and finish are under half a mile apart. Tap Change start or finish and zoom out.
            </p>
          ) : null}
          <Button size="lg" className="w-full" disabled={Boolean(busy) || distM < 926} onClick={() => run()}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {busy ?? "Find routes"}
          </Button>
          <Button
            variant="outline"
            className="mt-1.5 w-full"
            disabled={Boolean(busy) || distM < 926}
            onClick={() => {
              setBusy("Starting…");
              findWeatherWindows({
                start,
                finish,
                boat: boatPerfOf(prefs, hull.loaM),
                limits: prefs.limits,
                rules: prefs.rules,
                models: prefs.models,
                onStatus: setBusy,
              })
                .then((sc) => {
                  setScan(sc);
                  setView("windows");
                })
                .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Couldn't scan the forecast"))
                .finally(() => setBusy(null));
            }}
          >
            Find the best window (next 10 days)
          </Button>
          <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={begin}>
            Change start or finish
          </Button>
        </>
      ) : (
        <Results out={out} ctx={ctx} picked={pickedResult} onChoose={choose} onAgain={() => setOut(null)} />
      )}
    </Sheet>
  );
}


function agreement(row: DepartureRow): string {
  if (row.spreadH == null) return "One model only";
  if (row.spreadH < 1) return "Models agree";
  return `Models differ by ${Math.round(row.spreadH)} h`;
}

function Results({
  out,
  ctx,
  picked,
  onChoose,
  onAgain,
}: {
  out: PlanOutput;
  ctx: PlanContext | null;
  picked: Choice | null;
  onChoose: (mode: RouteMode, row: DepartureRow) => void;
  onAgain: () => void;
}) {
  const modes: RouteMode[] = ["safest", "fastest", "comfort"];
  if (!modes.some((m) => out.best[m])) {
    const reason = out.rows.map((r) => r.results.fastest).find((r) => !r.ok);
    return (
      <div>
        <p className="text-sm">{reason && !reason.ok ? reason.reason : "No route found."}</p>
        <Button className="mt-2 w-full" variant="outline" onClick={onAgain}>
          Change the plan
        </Button>
      </div>
    );
  }
  return (
    <div>
      <div className="grid gap-1.5">
        {modes.map((m) => {
          const c = out.best[m];
          if (!c) return null;
          const on = picked?.result.mode === m && picked.row.departAt === c.row.departAt;
          const x = c.result.metrics;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onChoose(m, c.row)}
              className={`rounded-lg border px-3 py-2 text-left ${on ? "border-primary bg-primary/10" : "border-border bg-background"}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-display text-base font-semibold">{PLAN_LOOK[m].title}</p>
                <p className="text-t14 text-muted-foreground tabular-nums">{dur(x.hours)} · {x.distanceNm.toFixed(0)} nm</p>
              </div>
              <p className="text-t14 tabular-nums">
                Leave {when(c.row.departAt)} → arrive {when(c.result.arriveAt)}
              </p>
              <p className="text-t13 text-muted-foreground tabular-nums">
                Wind to {Math.round(x.maxWindKn)} kn, gusts {Math.round(x.maxGustKn)} · seas to {formatDepth(x.maxWaveM)} ·{" "}
                {x.hours - x.motorHours >= 0.5 ? `${x.upwindPct}% upwind` : "all under engine"}
                {x.motorHours >= 0.5 && x.hours - x.motorHours >= 0.5 ? ` · ${dur(x.motorHours)} motoring` : ""} ·{" "}
                {agreement(c.row)}
              </p>
              <p className="text-t13 text-muted-foreground tabular-nums">{tideLine(x)}</p>
              <p className="mt-0.5 text-t13 text-muted-foreground">{PLAN_LOOK[m].why}</p>
            </button>
          );
        })}
      </div>

      {out.reefData !== "used" ? (
        <p className="mt-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-2.5 py-1.5 text-t14 leading-snug text-amber-200">
          Routes avoid the coastline but not reefs (reef data isn&apos;t installed). Check every leg on the chart
          with reef outlines on.
        </p>
      ) : (
        <p className="mt-2 text-t13 text-muted-foreground">
          Routes avoid mapped reefs (GBRMPA outlines, generalised). Small gaps and entrances are closed: pilot those yourself.
        </p>
      )}
      {picked ? <PickedActions picked={picked} ctx={ctx} shelter={out.shelter} /> : null}

      <p className="mt-3 mb-1 text-t12 text-muted-foreground">All departures</p>
      <ul className="grid gap-1">
        {out.rows.map((row) => {
          const r = row.results.fastest;
          return (
            <li key={row.departAt}>
              <button
                type="button"
                disabled={!r.ok}
                onClick={() => onChoose("fastest", row)}
                className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-left disabled:opacity-60"
              >
                <span
                  aria-label={row.light}
                  className={`size-2.5 shrink-0 rounded-full ${row.light === "green" ? "bg-emerald-400" : row.light === "amber" ? "bg-amber-400" : "bg-destructive"}`}
                />
                <span className="w-24 shrink-0 text-t14 tabular-nums">{when(row.departAt)}</span>
                <span className="min-w-0 flex-1 text-t13 leading-snug text-muted-foreground tabular-nums">
                  {r.ok
                    ? `${dur(r.metrics.hours)} · ${Math.round(r.metrics.maxWindKn)} kn · ${formatDepth(r.metrics.maxWaveM)} · tide ${signedKn(r.metrics.avgCurrentKn)}${r.metrics.steepSeaHours >= 0.5 ? " · wind over tide" : ""}${r.metrics.arrivesInDark ? " · dark arrival" : ""}`
                    : "Over your limits"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={onAgain}>
        Change times, boat or limits
      </Button>
    </div>
  );
}

function asDraft(title: string, pts: RoutePoint[]): LocalDraft {
  return {
    localId: `route-${Date.now()}`,
    title,
    region: "",
    notes: "Planned by weather routing. Check against a chart.",
    kind: "passage",
    waypoints: pts.map((p, i) => ({
      lat: p.lat,
      lng: p.lng,
      label: i === 0 ? "Start" : i === pts.length - 1 ? "Finish" : new Date(p.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    })),
    savedAt: new Date().toISOString(),
  };
}

/** Shallow water along the chosen route, from the depth model (approximate). */
function ShallowCheck({ points }: { points: RoutePoint[] }) {
  useUnitsKey();
  const draft = useHelm((s) => s.hull.draftM);
  const [hits, setHits] = useState<Array<{ lat: number; lng: number; depthM: number }> | null>(null);
  // At mean sea level; 1 m extra allows for a low tide on the way.
  const limit = draft + 1.5;
  useEffect(() => {
    let live = true;
    setHits(null);
    void shallowAlong(points, limit).then((h) => {
      if (live) setHits(h);
    });
    return () => {
      live = false;
    };
  }, [points, limit]);
  if (hits == null) return <p className="mb-2 text-t13 text-muted-foreground">Checking depths along the route…</p>;
  if (!hits.length) {
    return (
      <p className="mb-2 text-t13 text-muted-foreground">
        No shallow water found along the route in the depth model (approximate; it doesn't show bommies).
      </p>
    );
  }
  return (
    <div className="mb-2 rounded-md border border-amber-400/50 bg-amber-400/10 px-2.5 py-2 text-t14">
      <p className="font-semibold text-amber-200">Shallow water on the route</p>
      <ul className="mt-1 grid gap-1">
        {hits.slice(0, 5).map((h) => (
          <li key={`${h.lat},${h.lng}`}>
            <button
              type="button"
              className="text-left underline"
              onClick={() => useHelm.getState().setRouteCursor({ lat: h.lat, lng: h.lng })}
            >
              About {formatDepth(Math.max(0, h.depthM))} at mean sea level
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-t13 text-muted-foreground">
        The planner avoids the coastline and mapped reefs, but these spots look shallower than your draft plus a margin.
        Tap one to see it on the chart, and plan your own track through there.
      </p>
    </div>
  );
}

function PickedActions({ picked, ctx, shelter }: { picked: Choice; ctx: PlanContext | null; shelter?: boolean[] }) {
  const end = useHelm((s) => s.endRoutePlan);
  const prefs = useHelm((s) => s.routePrefs);
  const start = useHelm((s) => s.routeStart);
  const finish = useHelm((s) => s.routeFinish);
  const r = picked.result;
  const title = `${PLAN_LOOK[r.mode].title} · ${when(picked.row.departAt)}`;
  /** Keep the plan and its forecast on the phone, for re-routing and the passage tools offshore. */
  const keepOffline = (id: string) => {
    if (!ctx || !start || !finish) return;
    void saveActivePassage({
      id,
      title,
      start,
      finish,
      mode: r.mode,
      departAt: picked.row.departAt,
      arriveAt: r.arriveAt,
      points: r.points,
      boat: ctx.boat,
      limits: ctx.limits,
      rules: ctx.rules,
      models: ctx.models,
      fields: ctx.fields,
      box: ctx.box,
      forecastAt: ctx.forecastAt,
      savedAt: Date.now(),
    }).catch(() => toast.error("Couldn't save the forecast for offline use"));
  };
  return (
    <div className="mt-2 rounded-lg border border-border bg-background px-3 py-2">
      <RouteTimeline points={r.points} sails={prefs.sails} maxWindKn={prefs.limits.maxWindKn} />
      {finish ? <ArrivalCard finish={finish} eta={r.arriveAt} shelter={shelter} /> : null}
      {ctx ? (
        <p className="mt-1 text-t13 text-muted-foreground">
          Forecast {forecastAge(ctx.forecastAt)} ({ctx.models.join(", ").toUpperCase()}). Follow or Save keeps it on the phone for offline re-routing.
        </p>
      ) : null}
      <div className="mt-2" />
      <ShallowCheck points={r.points} />
      {r.warnings.length ? (
        <ul className="mb-2 list-disc space-y-0.5 pl-4 text-t14 leading-snug text-amber-300">
          {r.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-t14 text-muted-foreground">No warnings on this plan.</p>
      )}
      <div className="grid grid-cols-4 gap-1.5">
        <Button
          size="sm"
          onClick={() => {
            const d = asDraft(title, r.points);
            const s = useHelm.getState();
            // At anchor, following a route would start the off-track alarm: ask first.
            if (
              s.anchor?.radiusLocked &&
              !window.confirm(
                "You're on anchor watch. Following now starts steering cues and the off-track alarm while you're still at anchor. Follow anyway? (Choose Cancel to keep it saved for when you leave.)",
              )
            ) {
              useHelm.setState({ drafts: [d, ...s.drafts].slice(0, 40) });
              toast.success("Saved to Tracks. Follow it from Tracks when you weigh anchor.");
              return;
            }
            useHelm.setState({ drafts: [d, ...s.drafts].slice(0, 40) });
            keepOffline(d.localId);
            s.setActivePassage(d);
            s.setChartUp("heading");
            s.setBoatLow(true);
            end();
            toast.success("Following the planned route. Steering cues are on.");
          }}
        >
          Follow
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const d = asDraft(title, r.points);
            const s = useHelm.getState();
            useHelm.setState({ drafts: [d, ...s.drafts].slice(0, 40) });
            keepOffline(d.localId);
            toast.success("Saved to Tracks, with its forecast for offline use");
          }}
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            shareGpx(title, asDraft(title, r.points).waypoints).catch((err: unknown) => {
              if (!/cancel/i.test(String(err))) toast.error("Couldn't export");
            });
          }}
        >
          GPX
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (!start || !finish) return;
            const b = passageBrief({
              title,
              start,
              finish,
              departAt: picked.row.departAt,
              arriveAt: r.arriveAt,
              points: r.points,
              metrics: r.metrics,
              warnings: r.warnings,
              sails: prefs.sails,
              models: ctx?.models ?? prefs.models,
              forecastAt: ctx?.forecastAt ?? Date.now(),
              shelter,
              wave: (m) => formatDepth(m),
            });
            shareTextAndFile({ fileName: "passage-brief.html", file: b.html, mime: "text/html", text: b.text, title }).catch(
              (err: unknown) => {
                if (!/cancel/i.test(String(err))) toast.error("Couldn't share the brief");
              },
            );
          }}
        >
          Brief
        </Button>
      </div>
    </div>
  );
}

function signedKn(v: number): string {
  if (Math.abs(v) < 0.05) return "0 kn";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} kn`;
}

/** "Tide +0.8 kn fair · 2 h wind over tide (seas +35%)" */
function tideLine(m: RouteMetrics): string {
  const fair = m.avgCurrentKn >= 0.1 ? "fair" : m.avgCurrentKn <= -0.1 ? "foul" : "slack";
  const tide = `Tide and current ${signedKn(m.avgCurrentKn)} ${fair}`;
  if (m.steepSeaHours >= 0.5) {
    return `${tide} · ${Math.max(1, Math.round(m.steepSeaHours))} h wind over tide (seas +${Math.round((m.maxWaveAmp - 1) * 100)}%)`;
  }
  return tide;
}

