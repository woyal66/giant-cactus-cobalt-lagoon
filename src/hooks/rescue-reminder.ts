import { useEffect } from "react";
import { toast } from "sonner";
import { isNativeApp } from "@/lib/native";
import { defaultReturnBy, rescueText } from "@/lib/rescue";
import { useHelm } from "@/store/helm";

const RESCUE_NOTICE_ID = 830;

async function scheduleOff(at: number | null, body: string) {
  if (!isNativeApp()) return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.cancel({ notifications: [{ id: RESCUE_NOTICE_ID }] }).catch(() => undefined);
  if (at && at > Date.now()) {
    await LocalNotifications.schedule({
      notifications: [{ id: RESCUE_NOTICE_ID, title: "Due back: log off", body, schedule: { at: new Date(at), allowWhileIdle: true } }],
    }).catch(() => undefined);
  }
}

/** Set (or clear) the "due back" reminder. Used by Settings too. */
export function setReturnBy(at: number | null) {
  const s = useHelm.getState();
  useHelm.setState({ rescue: { ...s.rescue, returnBy: at } });
  void scheduleOff(at, `${rescueText(s.rescue, "off")} If you're staying out longer, update your trip with them.`);
}

/**
 * Marine rescue reminders tied to the trip log: when a trip starts, "log on with …" and a
 * "due back" notification at the planned arrival plus 30 minutes; when it ends, "log off".
 */
export function useRescueReminder() {
  useEffect(
    () =>
      useHelm.subscribe((s, prev) => {
        if (!s.rescue.on) return;
        if (s.activeTrip && !prev.activeTrip) {
          const at = defaultReturnBy(Date.now(), s.activeTrip.plan?.arriveAt ?? null);
          setReturnBy(at);
          toast(rescueText(s.rescue, "on"), {
            description: `Reminder to log off set for ${new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Change it in Settings → Safety.`,
            duration: 15_000,
          });
        } else if (!s.activeTrip && prev.activeTrip) {
          setReturnBy(null);
          toast(rescueText(s.rescue, "off"), { duration: 15_000 });
        }
      }),
    [],
  );
}
