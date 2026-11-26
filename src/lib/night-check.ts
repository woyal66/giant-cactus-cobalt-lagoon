/**
 * "Ready for the night": the things that decide whether the anchor alarm will actually wake
 * the skipper, checked in one list. Pure, so it is tested; the component gathers the inputs.
 */
import { fixPreciseForWatch } from "./anchor.ts";

export type CheckState = "ok" | "warn" | "bad" | "unknown";
export type CheckId = "notify" | "critical" | "battery" | "gps" | "sound" | "remote" | "browser";

export type CheckItem = {
  id: CheckId;
  state: CheckState;
  title: string;
  detail: string;
  /** What the fix button does, if there is one. */
  action?: "allow" | "settings" | "test" | "remote";
  actionLabel?: string;
};

export type CheckInput = {
  native: boolean;
  ios: boolean;
  /** Notification permission: granted, denied, or not asked yet / not known. */
  notify: "granted" | "denied" | "prompt" | "unknown";
  /** iPhone only: Critical Alerts or Time Sensitive allowed. */
  critical?: { critical: boolean; timeSensitive: boolean } | null;
  battery?: { level: number; charging: boolean } | null;
  accuracyM: number | null;
  radiusM: number;
  hasFix: boolean;
  soundTested: boolean;
  remoteLinked: boolean;
};

export function nightChecks(i: CheckInput): CheckItem[] {
  const out: CheckItem[] = [];
  if (!i.native) {
    out.push({
      id: "browser",
      state: "bad",
      title: "Browser: keep this page open",
      detail: "In a browser the watch stops when the screen locks or the tab closes. Use the phone app overnight.",
    });
  }
  out.push(
    i.notify === "granted"
      ? { id: "notify", state: "ok", title: "Notifications allowed", detail: "The alarm can show and sound with the phone locked." }
      : i.notify === "denied"
        ? {
            id: "notify",
            state: "bad",
            title: "Notifications are off",
            detail: "With the phone locked the alarm can't sound. Turn notifications on for Anchor Mate.",
            action: "settings",
            actionLabel: "Settings",
          }
        : {
            id: "notify",
            state: "warn",
            title: "Allow notifications",
            detail: "Needed for the alarm to sound with the phone locked.",
            action: "allow",
            actionLabel: "Allow",
          },
  );
  if (i.ios) {
    const c = i.critical;
    out.push(
      !c
        ? { id: "critical", state: "unknown", title: "Silent mode", detail: "Couldn't check whether the alarm breaks through silent mode." }
        : c.critical
          ? { id: "critical", state: "ok", title: "Sounds through silent mode", detail: "Critical Alerts are on." }
          : c.timeSensitive
            ? {
                id: "critical",
                state: "warn",
                title: "Ringer switch must be on",
                detail: "The alarm breaks through Focus but not the silent switch. Keep the ringer on.",
              }
            : {
                id: "critical",
                state: "bad",
                title: "Focus or silent can mute the alarm",
                detail: "Allow Time Sensitive notifications for Anchor Mate.",
                action: "settings",
                actionLabel: "Settings",
              },
    );
  }
  const b = i.battery;
  out.push(
    !b
      ? { id: "battery", state: "unknown", title: "Battery", detail: "Plug the phone in for the night: GPS all night uses a lot of battery." }
      : b.charging
        ? { id: "battery", state: "ok", title: `Charging (${Math.round(b.level * 100)}%)`, detail: "Good: leave it on charge." }
        : b.level < 0.5
          ? {
              id: "battery",
              state: "bad",
              title: `Battery ${Math.round(b.level * 100)}%, not charging`,
              detail: "It may not last the night with GPS on. Plug it in.",
            }
          : {
              id: "battery",
              state: "warn",
              title: `Battery ${Math.round(b.level * 100)}%, not charging`,
              detail: "Plug the phone in for the night if you can.",
            },
  );
  out.push(
    !i.hasFix
      ? { id: "gps", state: "bad", title: "No GPS fix", detail: "The watch needs a GPS fix. Go on deck or near a window." }
      : fixPreciseForWatch(i.accuracyM, i.radiusM)
        ? {
            id: "gps",
            state: "ok",
            title: i.accuracyM != null ? `GPS good (±${Math.round(i.accuracyM)} m)` : "GPS fix",
            detail: "Precise enough to judge the swing circle.",
          }
        : {
            id: "gps",
            state: "warn",
            title: `GPS vague (±${Math.round(i.accuracyM ?? 0)} m)`,
            detail: "Too vague to judge this circle yet. Fixes this vague are ignored until it improves.",
          },
  );
  out.push(
    i.soundTested
      ? { id: "sound", state: "ok", title: "Alarm heard", detail: "You tested the sound at this volume." }
      : {
          id: "sound",
          state: "warn",
          title: "Test the alarm sound",
          detail: "Check you can hear it from your bunk at this volume.",
          action: "test",
          actionLabel: "Test",
        },
  );
  out.push(
    i.remoteLinked
      ? { id: "remote", state: "ok", title: "Second phone linked", detail: "A second phone also gets the alarm." }
      : {
          id: "remote",
          state: "unknown",
          title: "Second phone (optional)",
          detail: "Link a crew phone so it alarms too.",
          action: "remote",
          actionLabel: "Set up",
        },
  );
  return out;
}

/** The headline: everything fine, something to look at, or a problem that stops the alarm. */
export function nightSummary(items: CheckItem[]): CheckState {
  if (items.some((x) => x.state === "bad")) return "bad";
  if (items.some((x) => x.state === "warn")) return "warn";
  return "ok";
}
