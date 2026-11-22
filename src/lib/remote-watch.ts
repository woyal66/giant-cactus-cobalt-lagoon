/**
 * Remote watch: a second phone (partner's, or the skipper's in the cabin) gets
 * the anchor alarms too.
 *
 * Delivery uses ntfy (open source push notifications, free apps for iOS and
 * Android). The watching phone posts to a private, unguessable channel; the
 * second phone subscribes to it in the ntfy app. Set VITE_REMOTE_WATCH_SERVER to
 * a paid or self-hosted ntfy server for production; the public ntfy.sh server is
 * rate-limited and logs topic names and IP addresses.
 */
const ENV = (import.meta.env ?? {}) as Record<string, string | undefined>;
export const REMOTE_SERVER = (ENV.VITE_REMOTE_WATCH_SERVER || "https://ntfy.sh").replace(/\/+$/, "");

export type RemoteEvent = "start" | "drag" | "gps" | "mob" | "clear" | "stop" | "test";

export type RemoteMessage = {
  topic: string;
  title: string;
  message: string;
  priority: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  click?: string;
};

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** 20 random characters (~100 bits): unguessable, so only paired phones can listen. */
export function newTopic(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = rand(20);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `anchormate-${s}`;
}

export function isTopic(v: unknown): v is string {
  return typeof v === "string" && /^anchormate-[a-z0-9]{20}$/.test(v);
}

export function subscribeUrl(topic: string): string {
  return `${REMOTE_SERVER}/${topic}`;
}

/** Opens the ntfy app straight on "subscribe to this topic". */
export function ntfyAppUrl(topic: string): string {
  const host = REMOTE_SERVER.replace(/^https?:\/\//, "");
  return `ntfy://${host}/${topic}`;
}

function mapLink(p: { lat: number; lng: number } | null | undefined): string | undefined {
  if (!p) return undefined;
  return `https://maps.google.com/?q=${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
}

export function buildMessage(
  topic: string,
  event: RemoteEvent,
  ctx: {
    boatName?: string;
    place?: string;
    radiusText?: string;
    outsideText?: string;
    boat?: { lat: number; lng: number } | null;
  },
): RemoteMessage {
  const who = ctx.boatName?.trim() || "Your boat";
  const at = ctx.place ? ` at ${ctx.place}` : "";
  const click = mapLink(ctx.boat);
  switch (event) {
    case "drag":
      return {
        topic,
        title: `ANCHOR DRAGGING: ${who}`,
        message: `${who} is ${ctx.outsideText ?? "outside"} the swing circle${at}. Check the boat now.`,
        priority: 5,
        tags: ["rotating_light", "anchor"],
        click,
      };
    case "gps":
      return {
        topic,
        title: `GPS LOST: ${who}`,
        message: `The anchor watch phone has had no GPS fix for over a minute${at}. Check the boat.`,
        priority: 5,
        tags: ["warning", "satellite"],
        click,
      };
    case "mob":
      return {
        topic,
        title: `MAN OVERBOARD: ${who}`,
        message: `Man overboard marked${at}. Tap for the position.`,
        priority: 5,
        tags: ["sos"],
        click,
      };
    case "clear":
      return {
        topic,
        title: `Back inside: ${who}`,
        message: `The alarm on ${who} has cleared.`,
        priority: 3,
        tags: ["white_check_mark"],
        click,
      };
    case "start":
      return {
        topic,
        title: `Anchor watch on: ${who}`,
        message: `Watching${at}${ctx.radiusText ? `, circle ${ctx.radiusText}` : ""}. This phone will get the alarms.`,
        priority: 3,
        tags: ["anchor"],
        click,
      };
    case "stop":
      return {
        topic,
        title: `Anchor watch off: ${who}`,
        message: "The anchor watch has been stopped.",
        priority: 2,
        tags: ["anchor"],
      };
    case "test":
      return {
        topic,
        title: "Anchor Mate test alert",
        message: "Remote watch is working. Alarms from the boat will arrive here.",
        priority: 4,
        tags: ["bell"],
      };
  }
}

/**
 * Post one message. On the phone this goes through native HTTP, which keeps
 * working when Android throttles the web view in the background.
 */
export async function publish(msg: RemoteMessage): Promise<boolean> {
  const body = JSON.stringify(msg);
  try {
    const { Capacitor, CapacitorHttp } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.post({
        url: REMOTE_SERVER,
        headers: { "Content-Type": "application/json" },
        data: msg,
        connectTimeout: 10_000,
        readTimeout: 10_000,
      });
      return res.status >= 200 && res.status < 300;
    }
    const res = await fetch(REMOTE_SERVER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** While an alarm keeps ringing, repeat to the second phone on this beat (max). */
export const REMOTE_REPEAT_MS = 60_000;
export const REMOTE_MAX_REPEATS = 10;

/**
 * Decide which events to send from one state change to the next. Pure, so the
 * timing rules are unit tested.
 */
export type WatchSnapshot = {
  watching: boolean;
  drag: boolean;
  gps: boolean;
  mob: boolean;
};

export function remoteEvents(prev: WatchSnapshot, next: WatchSnapshot): RemoteEvent[] {
  const out: RemoteEvent[] = [];
  if (!prev.watching && next.watching) out.push("start");
  if (!prev.drag && next.drag) out.push("drag");
  if (!prev.gps && next.gps) out.push("gps");
  if (!prev.mob && next.mob) out.push("mob");
  if (((prev.drag && !next.drag) || (prev.gps && !next.gps)) && next.watching && !next.drag && !next.gps) {
    out.push("clear");
  }
  if (prev.watching && !next.watching) out.push("stop");
  return out;
}
