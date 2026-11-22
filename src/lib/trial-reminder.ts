/**
 * Trial-ending reminder: a local notification the day before the free trial ends,
 * plus an in-app banner in the last 48 hours. Honest both ways: says when the
 * charge happens and how to cancel, and that saved data stays on the phone.
 */
export const TRIAL_NOTICE_ID = 900;
export const REMIND_BEFORE_MS = 24 * 3_600_000;
export const BANNER_WINDOW_MS = 48 * 3_600_000;

export type TrialState = { inTrial: boolean; expiresAt: number | null; willRenew: boolean };

export function trialPlan(t: TrialState, now = Date.now()): { notifyAt: number | null; showBanner: boolean } {
  if (!t.inTrial || !t.expiresAt || t.expiresAt <= now) return { notifyAt: null, showBanner: false };
  const at = t.expiresAt - REMIND_BEFORE_MS;
  return {
    // Too close to schedule ahead: the banner covers it.
    notifyAt: at > now + 60_000 ? at : null,
    showBanner: t.expiresAt - now <= BANNER_WINDOW_MS,
  };
}

function when(at: number, now: number): string {
  const d = new Date(at);
  const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const days = Math.round((new Date(d.toDateString()).getTime() - new Date(new Date(now).toDateString()).getTime()) / 86_400_000);
  if (days <= 0) return `today at ${t}`;
  if (days === 1) return `tomorrow at ${t}`;
  return `${d.toLocaleDateString([], { weekday: "long" })} at ${t}`;
}

export function trialMessage(opts: {
  expiresAt: number;
  willRenew: boolean;
  price: string | null;
  period: string;
  store: string;
  tracks: number;
  packs: number;
  /** Time the message will be read (the notification fires a day early). */
  readAt?: number;
}): { title: string; body: string } {
  const now = opts.readAt ?? Date.now();
  const ends = when(opts.expiresAt, now);
  const saved =
    opts.tracks || opts.packs
      ? ` Your ${opts.tracks} saved track${opts.tracks === 1 ? "" : "s"} and ${opts.packs} offline chart${opts.packs === 1 ? "" : "s"} stay on this phone either way.`
      : "";
  if (opts.willRenew) {
    const price = opts.price ? `${opts.price} per ${opts.period}` : `the ${opts.period}ly price`;
    return {
      title: "Your free trial ends " + ends,
      body: `Anchor Mate Pro then renews at ${price} unless you cancel in your ${opts.store} settings before then.${saved}`,
    };
  }
  return {
    title: "Your free trial ends " + ends,
    body: `Renewal is off, so the anchor watch stops when the trial ends. You can subscribe again any time.${saved}`,
  };
}
