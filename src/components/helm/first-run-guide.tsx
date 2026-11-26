import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Anchor, BellRing, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runAlarmDemo } from "@/hooks/helm-runtime";
import { armWatchAlerts } from "@/lib/watch-notify";
import { isNativeApp } from "@/lib/native";
import { useHelm } from "@/store/helm";

/**
 * The tour: each step points at a real button (`data-tour` on it) with a ring and a short note.
 * Steps without a target are cards in the middle. Skip at any time; replay from Settings → Help.
 */
type Step = { tour?: string; title: string; body: string };

const STEPS: Step[] = [
  {
    title: "Welcome to Anchor Mate",
    body: "An anchor alarm that keeps watch while you sleep, plus satellite charts, weather, tides and passage planning for small boats. Here's a one-minute look round.",
  },
  {
    tour: "anchor",
    title: "Anchor: the alarm",
    body: "Tap Anchor when the hook is down. Set depth and chain, check the swing circle on the photo, go through Ready for the night, then Set alarm. If the boat drags or the GPS drops out, the phone sounds loudly, even locked.",
  },
  {
    tour: "weather",
    title: "Weather",
    body: "The wind now, at a glance. Tap for the forecast here, or the weather map: wind, gusts, rain and thunder with live radar for the next hour, cloud, waves, current and pressure, up to 7 days ahead.",
  },
  {
    tour: "route",
    title: "Route",
    body: "Plan a passage: tap the start, then turning points round reefs and islands, then Finish here. It finds the best time to leave and keeps off land and shallows. Or just draw a route with straight legs.",
  },
  {
    tour: "navigation",
    title: "Navigation",
    body: "Start recording a track, search places, find your saved tracks and trip stats (speed, time, distance), and the shared library of other skippers' tracks.",
  },
  {
    tour: "map",
    title: "Map",
    body: "Choose the satellite photo or chart, show depth, reefs, official charts, moorings, ramps and shared anchorages. Save an offline area before you lose signal: photos, depth, tides and weather go with it.",
  },
  {
    title: "Press and hold the map",
    body: "Anywhere on the map: depth and the nearest hazard there, Go to, Add to route, Forecast here, Measure from here, or add a place for other skippers.",
  },
  {
    tour: "centre",
    title: "Centre and heading",
    body: "Brings the map back to the boat. Tap again to switch between north up and heading up. The bar below it is the scale.",
  },
  {
    tour: "mob",
    title: "Man overboard",
    body: "One tap marks the spot and shows the way back, with the drift and recovery steps. It's kept on its own so you can find it fast.",
  },
  {
    tour: "settings",
    title: "Settings",
    body: "Text size, night and sun looks, units, your boat, and Safety: AIS ships, the squall alert and marine rescue log on / log off. This tour is in Settings → Help any time.",
  },
  {
    title: "Last thing: hear the alarm once",
    body: "Allow alerts so the alarm can wake you with the phone locked. Then try the demo: the boat jumps outside the circle and the alarm sounds in about 12 seconds.",
  },
];

/** Where the highlighted button is on screen (null when the step has none or it's hidden). */
function useTarget(tour: string | undefined, step: number) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!tour) {
      setRect(null);
      return;
    }
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${tour}"]`);
      const r = el?.getBoundingClientRect();
      setRect(r && r.width > 0 && r.height > 0 ? r : null);
    };
    find();
    window.addEventListener("resize", find);
    const t = window.setTimeout(find, 150);
    return () => {
      window.removeEventListener("resize", find);
      window.clearTimeout(t);
    };
  }, [tour, step]);
  return rect;
}

/** Shown on first launch; replayable from Settings → Help. Skippable at every step. */
export function FirstRunGuide() {
  const done = useHelm((s) => s.guideDone);
  const setDone = useHelm((s) => s.setGuideDone);
  const alarmOn = useHelm((s) => s.alarmOn);
  const [step, setStep] = useState(0);
  const [demo, setDemo] = useState<"off" | "running" | "rang">("off");
  const [alerts, setAlerts] = useState(false);
  const cleanup = useRef<(() => void) | null>(null);
  const s = STEPS[step]!;
  const rect = useTarget(done ? undefined : s.tour, step);

  useEffect(() => {
    if (demo === "running" && alarmOn) setDemo("rang");
  }, [demo, alarmOn]);

  useEffect(() => () => cleanup.current?.(), []);

  // Close any open sheet so the buttons being pointed at are visible.
  useEffect(() => {
    if (!done) {
      const st = useHelm.getState();
      if (st.panel) st.setPanel(null);
      if (st.wxMapLayer !== "off") st.setWxMap({ wxMapLayer: "off", wxMapPlaying: false, wxLiveAt: null });
    }
  }, [done]);

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
          <p className="font-display text-lg leading-tight font-semibold">{demo === "rang" ? "That's the drag alarm" : "Demo running…"}</p>
          <p className="mt-1 text-t15 text-muted-foreground">
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

  const last = step === STEPS.length - 1;
  const first = step === 0;
  // Put the card on the other half of the screen from the button.
  const below = rect ? rect.top + rect.height / 2 < window.innerHeight / 2 : false;
  const pad = 6;

  return (
    <div className="absolute inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      {rect ? (
        <>
          {/* Dim everything except the button, and ring it (only the ring pulses). */}
          <div
            className="pointer-events-none absolute rounded-xl transition-all duration-200"
            style={{
              left: rect.left - pad,
              top: rect.top - pad,
              width: rect.width + pad * 2,
              height: rect.height + pad * 2,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
            }}
          />
          <div
            className="pointer-events-none absolute animate-pulse rounded-xl border-[3px] border-primary transition-all duration-200"
            style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
          />
          <div className="absolute inset-0" aria-hidden />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" aria-hidden />
      )}

      <div
        className={`absolute inset-x-0 flex justify-center px-3 ${
          rect ? (below ? "bottom-0 pb-[max(0.75rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))]" : "top-0 pt-[max(0.75rem,var(--safe-area-inset-top,env(safe-area-inset-top)))]") : "top-1/2 -translate-y-1/2"
        }`}
      >
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-border)]">
          <div className="flex items-start justify-between gap-2">
            <p className="text-t13 text-muted-foreground tabular-nums">
              {first ? "Getting started" : `${step} of ${STEPS.length - 1}`}
            </p>
            <Button variant="ghost" size="sm" className="-mt-1 -mr-1 h-10" onClick={finish}>
              {first ? "Skip" : "Skip tour"}
            </Button>
          </div>
          {first ? (
            <div className="mb-2 grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Anchor className="size-7" aria-hidden />
            </div>
          ) : last ? (
            <div className="mb-2 grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
              <BellRing className="size-7" aria-hidden />
            </div>
          ) : null}
          <h2 id="guide-title" className="font-display text-2xl leading-tight font-semibold text-balance">
            {s.title}
          </h2>
          <p className="mt-2 text-t16 leading-relaxed text-muted-foreground">{s.body}</p>

          {last ? (
            <div className="mt-3 grid gap-2">
              <Button variant={alerts ? "outline" : "default"} size="lg" onClick={() => void armWatchAlerts().then(() => setAlerts(true))}>
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

          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1" aria-hidden>
              {STEPS.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-primary" : "w-1.5 bg-border"}`} />
              ))}
            </div>
            <div className="flex shrink-0 gap-2">
              {step > 0 ? (
                <Button variant="outline" className="h-11" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              ) : null}
              <Button className="h-11" onClick={() => (last ? finish() : setStep(step + 1))}>
                {first ? "Show me round" : last ? "Done" : "Next"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
