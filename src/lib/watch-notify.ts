import { isNativeApp } from "@/lib/native";

let lastKey = "";
let lastShownAt = 0;
/** A notification sound is at most ~30 s (iOS limit), so a live alarm re-fires on this beat. */
export const ALARM_RENOTIFY_MS = 30_000;
/** 28 s klaxon in ios/App/App and android res/raw. Without it iOS alarms are silent. */
const ALARM_SOUND_FILE = "anchor_alarm.wav";
let statusKey = "";
let statusNote: Notification | null = null;

export async function registerWatchWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/reefpilot-watch.js", { scope: "/" });
  } catch {
    /* blocked */
  }
}

export async function armWatchAlerts(): Promise<void> {
  if (isNativeApp()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.requestPermissions();
    } catch {
      /* denied */
    }
  }
  await registerWatchWorker();
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      /* denied / blocked */
    }
  }
}

type WatchMsg =
  | { type: "show"; title: string; body: string }
  | { type: "clear" }
  | { type: "status"; title: string; body: string }
  | { type: "clear-status" };

function post(msg: WatchMsg) {
  const ctl = navigator.serviceWorker?.controller;
  if (ctl) {
    ctl.postMessage(msg);
    return;
  }
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (msg.type === "show") {
    try {
      const n = new Notification(msg.title, {
        body: msg.body,
        tag: "reefpilot-watch",
        requireInteraction: true,
        silent: false,
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      /* ignore */
    }
    return;
  }
  if (msg.type === "status") {
    try {
      statusNote?.close();
      statusNote = new Notification(msg.title, {
        body: msg.body,
        tag: "reefpilot-anchor",
        silent: true,
        requireInteraction: false,
      });
      statusNote.onclick = () => {
        window.focus();
        statusNote?.close();
      };
    } catch {
      statusNote = null;
    }
    return;
  }
  if (msg.type === "clear-status") {
    statusNote?.close();
    statusNote = null;
  }
}

/** Android: alarms need their own max-importance channel to sound on a locked phone. */
// Android fixes a channel's sound when it is first created, so a new sound needs a new id.
const ALARM_CHANNEL = "anchor-alarm-v2";
let channelReady: Promise<void> | null = null;

function ensureAlarmChannel(
  LocalNotifications: typeof import("@capacitor/local-notifications").LocalNotifications,
): Promise<void> {
  channelReady ??= LocalNotifications.createChannel({
    id: ALARM_CHANNEL,
    name: "Anchor and safety alarms",
    description: "Anchor drag, GPS lost, off track and man overboard",
    importance: 5,
    visibility: 1,
    vibration: true,
    sound: ALARM_SOUND_FILE,
  }).catch(() => undefined); // iOS has no channels; that is fine.
  return channelReady;
}

function nativeAlarm(kind: "drag" | "xte" | "gps" | "mob", title: string, body: string) {
  if (!isNativeApp()) return;
  const id = kind === "drag" ? 1 : kind === "gps" ? 2 : kind === "xte" ? 3 : 4;
  void import("@capacitor/local-notifications")
    .then(async ({ LocalNotifications }) => {
      await ensureAlarmChannel(LocalNotifications);
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title,
            body,
            ongoing: kind === "drag",
            autoCancel: false,
            channelId: ALARM_CHANNEL,
            sound: ALARM_SOUND_FILE,
          },
        ],
      });
    })
    .catch(() => undefined);
}

export function showWatchNotice(kind: "drag" | "xte" | "gps" | "mob", body: string) {
  const title =
    kind === "drag"
      ? "Anchor dragging"
      : kind === "xte"
        ? "Off track"
        : kind === "mob"
          ? "Man overboard"
          : "GPS lost";
  const key = `${kind}:${body}`;
  const now = Date.now();
  // Same alarm still ringing: re-fire natively so the sound keeps going on a locked phone.
  if (key === lastKey) {
    if (isNativeApp() && now - lastShownAt >= ALARM_RENOTIFY_MS) {
      lastShownAt = now;
      nativeAlarm(kind, title, body);
    }
    return;
  }
  lastKey = key;
  lastShownAt = now;
  post({ type: "show", title, body });
  nativeAlarm(kind, title, body);
  try {
    navigator.vibrate?.([240, 80, 240, 80, 480]);
  } catch {
    /* no vibrate */
  }
}

export function clearWatchNotice() {
  if (!lastKey) return;
  lastKey = "";
  post({ type: "clear" });
  if (isNativeApp()) {
    void import("@capacitor/local-notifications")
      .then(({ LocalNotifications }) =>
        LocalNotifications.cancel({ notifications: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] }),
      )
      .catch(() => undefined);
  }
}

/** Quiet ongoing note so the skipper can see the watch is armed. Not an alarm. */
export function showAnchorStatus(body: string) {
  if (statusKey === body) return;
  if (typeof Notification !== "undefined" && Notification.permission !== "granted") return;
  statusKey = body;
  post({ type: "status", title: "Anchor watch", body });
}

export function clearAnchorStatus() {
  if (!statusKey && !statusNote) return;
  statusKey = "";
  statusNote?.close();
  statusNote = null;
  post({ type: "clear-status" });
}
