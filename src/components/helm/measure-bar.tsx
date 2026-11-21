import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatHeading, formatMeters } from "@/lib/geo";
import { formatDuration, measure } from "@/lib/measure";
import { useHelm, useUnitsKey } from "@/store/helm";

/** Measuring tool: tap points on the chart, read each leg, the total and the time at a speed. */
export function MeasureBar() {
  useUnitsKey();
  const on = useHelm((s) => s.tapMode === "measure");
  const pts = useHelm((s) => s.measurePts);
  const cruise = useHelm((s) => s.routePrefs.motorKn);
  const [speed, setSpeed] = useState<number | null>(null);
  if (!on) return null;
  const kn = speed ?? cruise;
  const m = measure(pts, kn);
  const last = m.legs[m.legs.length - 1];
  const s = useHelm.getState();
  return (
    <div className="pointer-events-auto absolute inset-x-2 bottom-[calc(max(0.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))+5.2rem)] z-40 mx-auto max-w-md rounded-xl border border-border bg-card/97 p-3 shadow-[var(--shadow-border)] rp-glass">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-lg font-semibold">Measure</p>
        {pts.length >= 2 ? (
          <p className="font-display text-2xl font-semibold tabular-nums">{formatMeters(m.totalM)}</p>
        ) : null}
      </div>
      {pts.length < 2 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {pts.length === 0 ? "Tap the chart where you want to start." : "Tap the next point. Keep tapping to add legs."}
        </p>
      ) : (
        <div className="mt-1 grid gap-0.5 text-sm tabular-nums">
          <p>
            Last leg {formatMeters(last!.distM)} on {formatHeading(last!.bearing)}
            {m.legs.length > 1 ? ` · ${m.legs.length} legs` : ""}
          </p>
          <div className="flex items-center gap-2">
            <span>
              At {kn} kn: <b>{m.hours != null ? formatDuration(m.hours) : "—"}</b>
            </span>
            <Button size="sm" variant="outline" className="h-9 w-9 p-0" aria-label="Slower" onClick={() => setSpeed(Math.max(1, kn - 1))}>
              −
            </Button>
            <Button size="sm" variant="outline" className="h-9 w-9 p-0" aria-label="Faster" onClick={() => setSpeed(Math.min(40, kn + 1))}>
              +
            </Button>
          </div>
        </div>
      )}
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <Button variant="outline" className="h-11" disabled={!pts.length} onClick={() => s.undoMeasurePt()}>
          Undo
        </Button>
        <Button variant="outline" className="h-11" disabled={!pts.length} onClick={() => useHelm.setState({ measurePts: [] })}>
          Clear
        </Button>
        <Button className="h-11" onClick={() => s.endMeasure()}>
          Done
        </Button>
      </div>
    </div>
  );
}
