/**
 * Marine rescue log on / log off. In Australia skippers log their trip with the local Marine
 * Rescue / Coast Guard unit by VHF (or their app) and log off on return; if they don't, the unit
 * starts looking. Pure helpers, tested.
 */
export type RescueBase = { name: string; vhf: string; phone: string };

/** "Log on with VMR Whitsunday on VHF 81" / "Log on with your local marine rescue unit". */
export function rescueText(b: RescueBase, what: "on" | "off"): string {
  const who = b.name.trim() || "your local marine rescue unit";
  const how = [b.vhf.trim() ? `VHF ${b.vhf.trim()}` : "", b.phone.trim() ? `phone ${b.phone.trim()}` : ""].filter(Boolean).join(" or ");
  return `Log ${what} with ${who}${how ? ` (${how})` : ""}.`;
}

/**
 * When to remind the skipper to log off: the planned arrival plus a margin, or in a few hours
 * for a trip with no plan. Never in the past.
 */
export function defaultReturnBy(now: number, plannedArrive?: number | null, marginMin = 30): number {
  const base = plannedArrive && plannedArrive > now ? plannedArrive : now + 4 * 3_600_000;
  return Math.round((base + marginMin * 60_000) / 300_000) * 300_000;
}

/** Local time for the "back by" field: "HH:MM". */
export function hhmm(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** The next time today (or tomorrow) at "HH:MM". */
export function nextAt(value: string, now = Date.now()): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}
