/**
 * Tiny forecast for satellite text messengers (about 160 characters per message).
 *
 *   AM1 0611T06|P-23.90,152.40|T0 12/135 G18 S1.2/6 C+0.4 R0|T3 15/140 G21 S1.5/6 C-0.2 R1|P-23.60,152.90|T0 …
 *
 * AM1 = format version; 0611T06 = base time, day of month 06, month 11, 06 UTC (the year
 * is inferred, nearest to now). P = a point (lat,lng, 2 decimals). Then per time step:
 * T<hours after base> <wind kn>/<from °> G<gust kn> S<sea m>/<period s> C<current along route, kn, + fair>
 * R<storm risk 0–3>. Fields after the wind are optional. Several messages can be pasted
 * together, in any order: points are merged by position.
 */
export type SatStep = {
  at: number;
  windKn: number;
  windDir: number;
  gustKn?: number;
  seaM?: number;
  periodS?: number;
  currentKn?: number;
  risk?: number;
};
export type SatPoint = { lat: number; lng: number; steps: SatStep[] };
export type SatForecast = { base: number; points: SatPoint[] };

const H = 3_600_000;

export function encodeSat(f: SatForecast): string {
  const d = new Date(f.base);
  const base = `${String(d.getUTCDate()).padStart(2, "0")}${String(d.getUTCMonth() + 1).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}`;
  const parts = [`AM1 ${base}`];
  for (const p of f.points) {
    parts.push(`P${p.lat.toFixed(2)},${p.lng.toFixed(2)}`);
    for (const s of p.steps) {
      let t = `T${Math.round((s.at - f.base) / H)} ${Math.round(s.windKn)}/${Math.round(s.windDir) % 360}`;
      if (s.gustKn != null) t += ` G${Math.round(s.gustKn)}`;
      if (s.seaM != null) t += ` S${s.seaM.toFixed(1)}${s.periodS != null ? `/${Math.round(s.periodS)}` : ""}`;
      if (s.currentKn != null) t += ` C${s.currentKn >= 0 ? "+" : "-"}${Math.abs(s.currentKn).toFixed(1)}`;
      if (s.risk != null) t += ` R${s.risk}`;
      parts.push(t);
    }
  }
  return parts.join("|");
}

/** Split an encoded forecast into messages of at most `max` characters, each self-contained. */
export function splitSat(text: string, max = 160): string[] {
  const [head, ...rest] = text.split("|");
  const out: string[] = [];
  let cur = head!;
  let point = "";
  for (const part of rest) {
    if (part.startsWith("P")) point = part;
    const add = `|${part}`;
    if (cur.length + add.length > max) {
      out.push(cur);
      cur = part.startsWith("P") ? `${head}` : `${head}|${point}`;
    }
    cur += add;
  }
  out.push(cur);
  return out;
}

function baseTime(code: string, now: number): number | null {
  const m = /^(\d{2})(\d{2})T(\d{2})$/.exec(code);
  if (!m) return null;
  const [day, month, hour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (day < 1 || day > 31 || month < 1 || month > 12 || hour > 23) return null;
  const y = new Date(now).getUTCFullYear();
  const options = [y - 1, y, y + 1].map((yy) => Date.UTC(yy, month - 1, day, hour));
  return options.reduce((a, b) => (Math.abs(b - now) < Math.abs(a - now) ? b : a));
}

/** Decode one or more pasted messages. Unknown text around them is ignored. */
export function decodeSat(text: string, now = Date.now()): SatForecast | null {
  const msgs = text.match(/AM1 \d{4}T\d{2}(\|[^\n\r]*)?/g);
  if (!msgs) return null;
  let base: number | null = null;
  const points = new Map<string, SatPoint>();
  for (const msg of msgs) {
    const [head, ...parts] = msg.split("|");
    const b = baseTime(head!.slice(4).trim(), now);
    if (b == null) continue;
    base ??= b;
    let point: SatPoint | null = null;
    for (const raw of parts) {
      const part = raw.trim();
      const pm = /^P(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(part);
      if (pm) {
        const key = `${Number(pm[1]).toFixed(2)},${Number(pm[2]).toFixed(2)}`;
        point = points.get(key) ?? { lat: Number(pm[1]), lng: Number(pm[2]), steps: [] };
        points.set(key, point);
        continue;
      }
      const tm = /^T(\d+) (\d+)\/(\d+)(.*)$/.exec(part);
      if (!tm || !point) continue;
      const step: SatStep = { at: b + Number(tm[1]) * H, windKn: Number(tm[2]), windDir: Number(tm[3]) % 360 };
      const rest = tm[4]!;
      const g = /G(\d+)/.exec(rest);
      const sea = /S(\d+(?:\.\d+)?)(?:\/(\d+))?/.exec(rest);
      const c = /C([+-]\d+(?:\.\d+)?)/.exec(rest);
      const r = /R([0-3])/.exec(rest);
      if (g) step.gustKn = Number(g[1]);
      if (sea) {
        step.seaM = Number(sea[1]);
        if (sea[2]) step.periodS = Number(sea[2]);
      }
      if (c) step.currentKn = Number(c[1]);
      if (r) step.risk = Number(r[1]);
      if (!point.steps.some((s) => s.at === step.at)) point.steps.push(step);
    }
  }
  if (base == null || !points.size) return null;
  const list = [...points.values()].filter((p) => p.steps.length);
  for (const p of list) p.steps.sort((a, b) => a.at - b.at);
  return list.length ? { base, points: list } : null;
}
