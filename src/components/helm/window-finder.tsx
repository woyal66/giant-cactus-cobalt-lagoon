import type { WindowScan, WeatherWindow } from "@/lib/routing/plan";
import { formatDepth } from "@/lib/units";

function day(at: number) {
  return new Date(at).toLocaleDateString([], { weekday: "short", day: "numeric" });
}
function time(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const LIGHT = { green: "bg-emerald-400", amber: "bg-amber-400", red: "bg-destructive/70" } as const;

/** 10-day suitability strip and the best windows, best first. Tap a window to plan it. */
export function WindowFinder({ scan, onPick }: { scan: WindowScan; onPick: (w: WeatherWindow) => void }) {
  const t0 = scan.slots[0]?.departAt ?? Date.now();
  const days: number[] = [];
  for (const s of scan.slots) {
    const d = new Date(s.departAt).setHours(0, 0, 0, 0);
    if (!days.includes(d)) days.push(d);
  }
  return (
    <div>
      <p className="mb-1 text-t12 text-muted-foreground">Departures over the next days</p>
      <div className="flex h-6 overflow-hidden rounded-md" role="img" aria-label="Departure suitability: green good, amber caution, red over your limits">
        {scan.slots.map((s) => (
          <span key={s.departAt} className={`flex-1 border-r border-background/40 ${LIGHT[s.light]}`} />
        ))}
      </div>
      <div className="mt-0.5 flex text-t11 text-muted-foreground">
        {days.map((d) => (
          <span key={d} className="flex-1 truncate">
            {new Date(d).toLocaleDateString([], { weekday: "short" })}
          </span>
        ))}
      </div>

      <p className="mt-3 mb-1 text-t12 text-muted-foreground">Best windows</p>
      {scan.windows.length ? (
        <ul className="grid gap-1.5">
          {scan.windows.map((w, i) => (
            <li key={w.from}>
              <button
                type="button"
                onClick={() => onPick(w)}
                className="flex w-full items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-left"
              >
                <span className={`mt-1 size-2.5 shrink-0 rounded-full ${LIGHT[w.light]}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {i === 0 ? "★ " : ""}
                    {day(w.from)} {time(w.from)}
                    {w.to > w.from ? ` – ${day(w.to) === day(w.from) ? "" : `${day(w.to)} `}${time(w.to)}` : ""}
                  </span>
                  <span className="block text-t13 text-muted-foreground tabular-nums">
                    Best {time(w.bestDepart)} · {Math.round(w.hours)} h · wind to {Math.round(w.maxWindKn)} kn · seas {formatDepth(w.maxWaveM)}
                    {w.note ? ` · ${w.note}` : ""}
                  </span>
                  <span className={`block text-t13 ${w.confidence === "low" ? "text-amber-300" : "text-muted-foreground"}`}>
                    {w.confidence === "good" ? "Good confidence" : w.confidence === "fair" ? "Fair confidence (4–5 days out)" : "Low confidence: more than 5 days out, check again closer to the day"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-t14 text-muted-foreground">No departure inside your limits in the next {Math.round((scan.slots[scan.slots.length - 1]!.departAt - t0) / 86_400_000)} days.</p>
      )}
    </div>
  );
}
