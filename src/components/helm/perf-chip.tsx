import { useHelm } from "@/store/helm";

/** Speed against the polar while sailing, with the engine switch that pauses learning. */
export function PerfChip() {
  const perf = useHelm((s) => s.perfLive);
  const engineOn = useHelm((s) => s.routePrefs.engineOn);
  const panel = useHelm((s) => s.panel);
  const mob = useHelm((s) => s.mob);
  if (!perf || panel || mob) return null;
  const tone = perf.pct >= 95 ? "text-primary" : perf.pct >= 80 ? "text-foreground" : "text-amber-400";
  return (
    <div className="pointer-events-auto absolute top-[calc(max(0.4rem,var(--safe-area-inset-top,env(safe-area-inset-top)))+6.6rem)] right-2 z-30 grid justify-items-end gap-1">
      <div
        className="rounded-lg bg-card/95 px-2.5 py-1.5 text-right shadow-[var(--shadow-border)]"
        title={`Wind from the ${perf.source}`}
      >
        <p className={`font-display text-xl leading-none font-semibold tabular-nums ${tone}`}>{perf.pct}%</p>
        <p className="text-t12 text-muted-foreground tabular-nums">
          of polar · {perf.stwKn.toFixed(1)}/{perf.polarKn.toFixed(1)} kn
        </p>
        <p className="text-t12 text-muted-foreground tabular-nums">
          TWS {Math.round(perf.twsKn)} kn · TWA {Math.round(perf.twaDeg)}°
        </p>
      </div>
      <button
        type="button"
        aria-pressed={engineOn}
        onClick={() => {
          const s = useHelm.getState();
          s.setRoutePrefs({ engineOn: !s.routePrefs.engineOn });
        }}
        className={`rounded-full px-2.5 py-1 text-t12 font-semibold shadow-[var(--shadow-border)] ${engineOn ? "bg-amber-500 text-black" : "bg-card/95 text-muted-foreground"}`}
      >
        {engineOn ? "Engine on · not learning" : perf.learning ? "Sailing · learning" : "Sailing"}
      </button>
    </div>
  );
}
