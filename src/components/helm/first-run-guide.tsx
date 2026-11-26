import { useEffect, useRef, useState } from "react";
import { Anchor, BellRing, Moon, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runAlarmDemo } from "@/hooks/helm-runtime";
import { armWatchAlerts } from "@/lib/watch-notify";
import { isNativeApp } from "@/lib/native";
import { useHelm } from "@/store/helm";

const STEPS = [
  {
    icon: Anchor,
    kicker: "Welcome aboard",
    title: "Anchor Mate keeps watch while you sleep",
    body: "Set a swing circle around your anchor. If the boat leaves it, or the GPS drops out, the phone sounds a loud alarm, even with the screen locked.",
  },
  {
    icon: ShieldCheck,
    kicker: "Setting a watch",
    title: "Three steps at the anchorage",
    body: "1. Tap Anchor and set depth, chain and scope.\n2. Check the swing circle on the satellite; drag it to fit.\n3. Go through the Ready for the night list, then tap Set alarm. The card at the bottom shows how far you are from the hook. Lock the phone and rest.",
  },
  {
    icon: BellRing,
    kicker: "Hear it once",
    title: "Try the alarm now",
    body: "Allow alerts so the alarm can wake you with the phone locked. Then run the demo: the boat jumps outside the circle and the alarm sounds in about 12 seconds.",
  },
] as const;

/** Shown once after the trial starts; replayable from the View panel. */
export function FirstRunGuide() {
  const done = useHelm((s) => s.guideDone);
  const setDone = useHelm((s) => s.setGuideDone);
  const alarmOn = useHelm((s) => s.alarmOn);
  const [step, setStep] = useState(0);
  const [demo, setDemo] = useState<"off" | "running" | "rang">("off");
  const [alerts, setAlerts] = useState(false);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (demo === "running" && alarmOn) setDemo("rang");
  }, [demo, alarmOn]);

  useEffect(() => () => cleanup.current?.(), []);

  if (done) return null;

  const finish = () => {
    cleanup.current?.();
    cleanup.current = null;
    setDemo("off");
    setStep(0);
    setDone(true);
  };

  if (demo !== "off") {
    // Small card at the bottom so the alarm banner at the top stays visible.
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[60] p-3 pb-[max(0.75rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))]">
        <div className="pointer-events-auto mx-auto max-w-md rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-border)]">
          <p className="font-display text-lg leading-tight font-semibold">
            {demo === "rang" ? "That's the drag alarm" : "Demo running…"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {demo === "rang"
              ? "Tap Silence on the red banner, or Finish here. On a real watch it keeps sounding until you deal with it."
              : "The boat has been moved outside a 30 m circle. Wait about 12 seconds."}
          </p>
          <Button className="mt-3 w-full" size="lg" onClick={finish}>
            Finish
          </Button>
        </div>
      </div>
    );
  }

  const s = STEPS[step]!;
  const Icon = s.icon;
  const last = step === STEPS.length - 1;

  return (
    <div className="absolute inset-0 z-[60] flex items-end bg-black/55 backdrop-blur-[2px] md:items-center md:justify-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        className="w-full rounded-t-2xl border border-border bg-card px-5 pt-5 pb-[max(1.25rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))] md:max-w-md md:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Icon className="size-6" aria-hidden />
          </div>
          <Button variant="ghost" size="sm" className="h-10" onClick={finish}>
            Skip
          </Button>
        </div>
        <p className="mt-4 text-t12 text-muted-foreground">{s.kicker}</p>
        <h2 id="guide-title" className="font-display mt-1 text-3xl leading-tight font-semibold text-balance">
          {s.title}
        </h2>
        <p className="mt-3 text-t16 leading-relaxed whitespace-pre-line text-muted-foreground">{s.body}</p>

        {last ? (
          <div className="mt-4 grid gap-2">
            <Button
              variant={alerts ? "outline" : "default"}
              size="lg"
              onClick={() => {
                void armWatchAlerts().then(() => setAlerts(true));
              }}
            >
              {alerts ? "Alerts allowed ✓" : isNativeApp() ? "Allow alerts" : "Allow notifications"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                cleanup.current = runAlarmDemo();
                setDemo("running");
              }}
            >
              <Moon className="size-4" aria-hidden />
              Run the alarm demo
            </Button>
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between">
          <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-border"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            ) : null}
            <Button onClick={() => (last ? finish() : setStep(step + 1))}>{last ? "Done" : "Next"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
