import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDmm } from "@/lib/mob";
import { isDaylight } from "@/lib/sun";
import { useHelm } from "@/store/helm";

/**
 * Man-overboard recovery prompts. Big type, one screen. These support training;
 * the wording should be reviewed against current safety-at-sea guidance.
 */
export function MobGuide({ onClose }: { onClose: () => void }) {
  const mob = useHelm((s) => s.mob);
  const boat = useHelm((s) => s.boat);
  const drift = useHelm((s) => s.mobDrift);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!mob) return null;
  const secs = Math.max(0, Math.round((now - mob.at) / 1000));
  const elapsed = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const night = !isDaylight(mob.lat, mob.lng, now);
  const motoring = boat ? boat.speedMs * 1.94384 < 1 : false;
  const steps = [
    "Shout “Man overboard!” and keep pointing at them. One crew does nothing but point.",
    "Throw the lifebuoy, danbuoy and light (and a throwing line when close).",
    night
      ? "Night: Williamson turn to come back down your own track. Switch on deck lights."
      : motoring
        ? "Under engine: turn toward the side they fell, keep the propeller clear of them."
        : "Daylight under sail: quick-stop (tack, keep the headsail backed, circle back to leeward of them).",
    "Call for help: DSC distress (hold the red button 5 s) and Mayday on VHF 16 with the position below.",
    "Approach slowly from downwind. Stop the propeller before they are alongside.",
    "Recover with a sling or halyard. Treat for cold water shock and hypothermia.",
  ];
  const target = drift?.points.find((p) => Math.abs(p.minutes - secs / 60) < 0.6) ?? drift?.points[0];

  return (
    <div className="absolute inset-0 z-[55] overflow-y-auto bg-card px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <p className="font-display text-3xl font-semibold text-destructive">Man overboard</p>
          <p className="font-display text-3xl font-semibold tabular-nums">{elapsed}</p>
        </div>
        <ol className="mt-3 grid gap-2">
          {steps.map((t, i) => (
            <li key={t}>
              <button
                type="button"
                onClick={() => setDone((d) => new Set(d.has(i) ? [...d].filter((x) => x !== i) : [...d, i]))}
                className={`flex w-full gap-3 rounded-lg border px-3 py-2.5 text-left text-[15px] leading-snug ${done.has(i) ? "border-border bg-background text-muted-foreground line-through" : "border-destructive/50 bg-destructive/10"}`}
              >
                <span className="font-display text-xl font-semibold">{i + 1}</span>
                <span>{t}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-3 rounded-lg border-2 border-destructive px-3 py-3">
          <p className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Mayday position (where they fell)</p>
          <p className="font-display mt-1 text-2xl leading-tight font-semibold tabular-nums">{formatDmm(mob.lat, mob.lng)}</p>
          <p className="mt-1 text-[13px] leading-snug">
            “Mayday, Mayday, Mayday. This is [boat name]. Man overboard at {formatDmm(mob.lat, mob.lng)}, at{" "}
            {new Date(mob.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. [Persons on board]. Request
            assistance. Over.”
          </p>
          {target ? (
            <p className="mt-2 text-[13px] text-muted-foreground">
              Likely drifted to {formatDmm(target.lat, target.lng)} by now ({drift?.source}).
            </p>
          ) : null}
        </div>
        <Button size="lg" variant="outline" className="mt-3 w-full" onClick={onClose}>
          Back to the chart
        </Button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Drift is an estimate from current and wind. Search the whole circle. These prompts support your training; they
          don&apos;t replace it.
        </p>
      </div>
    </div>
  );
}
