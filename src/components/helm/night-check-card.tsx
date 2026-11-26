import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { previewAlarm, unlockAlarmAudio } from "@/lib/alarm";
import { openLocationSettings } from "@/lib/background-gps";
import { criticalAlerts } from "@/lib/critical-alert";
import { isNativeApp } from "@/lib/native";
import { nightChecks, nightSummary, type CheckInput, type CheckItem } from "@/lib/night-check";
import { armWatchAlerts } from "@/lib/watch-notify";
import { useHelm } from "@/store/helm";

// Remembered for the app session, so a test before setting the watch still counts after.
let soundTestedThisSession = false;

type BatteryLike = { level: number; charging: boolean; addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void };

async function readNotify(): Promise<{ notify: CheckInput["notify"]; critical: CheckInput["critical"] }> {
  const crit = criticalAlerts();
  if (crit) {
    try {
      const st = await crit.status();
      return { notify: st.granted ? "granted" : "denied", critical: { critical: st.critical, timeSensitive: st.timeSensitive } };
    } catch {
      return { notify: "unknown", critical: null };
    }
  }
  if (isNativeApp()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const p = await LocalNotifications.checkPermissions();
      return { notify: p.display === "granted" ? "granted" : p.display === "denied" ? "denied" : "prompt", critical: null };
    } catch {
      return { notify: "unknown", critical: null };
    }
  }
  if (typeof Notification === "undefined") return { notify: "unknown", critical: null };
  return { notify: Notification.permission === "default" ? "prompt" : Notification.permission, critical: null };
}

/**
 * "Ready for the night": one list of everything that decides whether the alarm wakes you,
 * each with a fix. `radiusM` is the circle being set (or the live watch's).
 */
export function NightCheckCard({ radiusM, compact }: { radiusM: number; compact?: boolean }) {
  const boat = useHelm((s) => s.boat);
  const remote = useHelm((s) => Boolean(s.remoteWatch));
  const sound = useHelm((s) => s.alarmSound);
  const [perm, setPerm] = useState<{ notify: CheckInput["notify"]; critical: CheckInput["critical"] }>({ notify: "unknown", critical: null });
  const [battery, setBattery] = useState<CheckInput["battery"]>(null);
  const [tested, setTested] = useState(soundTestedThisSession);
  const [open, setOpen] = useState(!compact);

  const refresh = useCallback(() => {
    void readNotify().then(setPerm);
  }, []);

  useEffect(() => {
    refresh();
    // Coming back from the phone's settings: read the permissions again.
    const onVis = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    let bat: BatteryLike | null = null;
    const readBat = () => bat && setBattery({ level: bat.level, charging: bat.charging });
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
    void nav.getBattery?.().then((b) => {
      bat = b;
      readBat();
      b.addEventListener("levelchange", readBat);
      b.addEventListener("chargingchange", readBat);
    }).catch(() => undefined);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (bat) {
        bat.removeEventListener("levelchange", readBat);
        bat.removeEventListener("chargingchange", readBat);
      }
    };
  }, [refresh]);

  const items = nightChecks({
    native: isNativeApp(),
    ios: Boolean(criticalAlerts()),
    notify: perm.notify,
    critical: perm.critical,
    battery,
    accuracyM: boat?.accuracy ?? null,
    radiusM,
    hasFix: Boolean(boat && (boat.source === "gps" || boat.source === "demo")),
    soundTested: tested,
    remoteLinked: remote,
  });
  const summary = nightSummary(items);

  const act = (it: CheckItem) => {
    if (it.action === "allow") void armWatchAlerts().then(refresh);
    else if (it.action === "settings") openLocationSettings();
    else if (it.action === "test") {
      unlockAlarmAudio();
      previewAlarm(sound);
      soundTestedThisSession = true;
      setTested(true);
    } else if (it.action === "remote") {
      const st = useHelm.getState();
      if (st.anchor && !st.anchorStep) st.setPanel("anchor");
      else toast("Link a second phone from the Anchor sheet once the watch is set.");
    }
  };

  const head =
    summary === "ok" ? "Ready for the night" : summary === "warn" ? "Nearly ready for the night" : "The alarm may not wake you";
  return (
    <div
      className={`mb-2 rounded-lg border px-2.5 py-2 ${
        summary === "ok" ? "border-primary/50" : summary === "warn" ? "border-amber-400/60" : "border-destructive/70"
      }`}
    >
      <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="flex items-center gap-2 text-t15 font-semibold">
          <StateIcon state={summary} />
          {head}
        </span>
        <span className="text-t13 text-muted-foreground">{open ? "Hide" : "Check"}</span>
      </button>
      {open ? (
        <ul className="mt-2 grid gap-1.5">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-2">
              <StateIcon state={it.state} />
              <div className="min-w-0 flex-1">
                <p className="text-t14 font-semibold leading-snug">{it.title}</p>
                <p className="text-t13 leading-snug text-muted-foreground">{it.detail}</p>
              </div>
              {it.action ? (
                <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => act(it)}>
                  {it.actionLabel}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StateIcon({ state }: { state: CheckItem["state"] }) {
  if (state === "ok") return <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-label="OK" />;
  if (state === "warn") return <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-400" aria-label="Check" />;
  if (state === "bad") return <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-label="Problem" />;
  return <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-label="Not checked" />;
}
