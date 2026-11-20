/**
 * Passage brief: one page for crew or a shore contact. Plain text for messages, and a
 * printable HTML page. Built from the chosen plan; no network needed.
 */
import type { LatLng } from "../geo.ts";
import { formatDmm } from "../mob.ts";
import { isDaylight } from "../sun.ts";
import type { RouteMetrics, RoutePoint } from "./router.ts";
import { sailPlan, type SailDef } from "./sails.ts";

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const cardinal = (deg: number) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
const RISK = ["low", "possible", "likely", "high"];

export type BriefInput = {
  title: string;
  boatName?: string;
  start: LatLng;
  finish: LatLng;
  departAt: number;
  arriveAt: number;
  points: RoutePoint[];
  metrics: RouteMetrics;
  warnings: string[];
  sails: SailDef[];
  models: string[];
  forecastAt: number;
  /** 16 compass points at the finish: true = land close by (sheltered from there). */
  shelter?: boolean[];
  /** Formatters, so the brief follows the app's units and locale. */
  time?: (ms: number) => string;
  wave?: (m: number) => string;
};

export type Stretch = {
  from: number;
  to: number;
  at: LatLng;
  wind: string;
  sea: string;
  current: string;
  sailing: string;
  flags: string[];
};

const STRETCH_MS = 3 * 3_600_000;

/** Conditions in roughly 3-hour stretches along the route. */
export function stretches(points: RoutePoint[], wave: (m: number) => string = (m) => `${m.toFixed(1)} m`): Stretch[] {
  if (points.length < 2) return [];
  const out: Stretch[] = [];
  let i = 0;
  while (i < points.length - 1) {
    const from = points[i]!.at;
    let j = i;
    while (j < points.length - 1 && points[j + 1]!.at - from <= STRETCH_MS) j++;
    if (j === i) j = i + 1;
    const seg = points.slice(i, j + 1);
    const legs = seg.slice(0, -1);
    const max = (f: (p: RoutePoint) => number) => Math.max(...legs.map(f));
    const avgDir = (f: (p: RoutePoint) => number) => {
      const x = legs.reduce((a, p) => a + Math.sin((f(p) * Math.PI) / 180), 0);
      const y = legs.reduce((a, p) => a + Math.cos((f(p) * Math.PI) / 180), 0);
      return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
    };
    const lo = Math.round(Math.min(...legs.map((p) => p.windKn)));
    const hi = Math.round(max((p) => p.windKn));
    const twa = legs.reduce((a, p) => a + p.twa, 0) / legs.length;
    const motor = legs.filter((p) => p.motoring).length > legs.length / 2;
    const cur = legs.reduce((a, p) => a + p.curAlongKn, 0) / legs.length;
    const thunder = max((p) => p.thunder);
    const flags: string[] = [];
    if (thunder >= 1) flags.push(`storm risk ${RISK[thunder]}`);
    if (legs.some((p) => p.squall)) flags.push("squalls");
    if (max((p) => p.waveAmp) >= 1.15) flags.push("wind over tide");
    if (!isDaylight(seg[0]!.lat, seg[0]!.lng, from + 1)) flags.push("night");
    out.push({
      from,
      to: seg[seg.length - 1]!.at,
      at: { lat: seg[0]!.lat, lng: seg[0]!.lng },
      wind: `${cardinal(avgDir((p) => p.windDir))} ${lo === hi ? hi : `${lo}–${hi}`} kn, gusts ${Math.round(max((p) => p.gustKn))}`,
      sea: wave(max((p) => p.waveM)),
      current: Math.abs(cur) < 0.1 ? "slack" : `${cur > 0 ? "+" : "−"}${Math.abs(cur).toFixed(1)} kn ${cur > 0 ? "fair" : "foul"}`,
      sailing: motor ? "motoring" : twa < 60 ? "upwind" : twa < 110 ? "reaching" : twa < 150 ? "broad reach" : "running",
      flags,
    });
    i = j;
  }
  return out;
}

/** Directions at the finish open to the sea, e.g. "open to NE–SE". */
export function exposureLine(shelter?: boolean[]): string | null {
  if (!shelter || shelter.length !== 16) return null;
  const open = shelter.map((s, k) => (s ? null : COMPASS[k])).filter(Boolean) as string[];
  if (!open.length) return "Sheltered all round (by the coastline data).";
  if (open.length === 16) return "Open water all round: no shelter at the finish.";
  return `Open to ${open.join(", ")}.`;
}

export function passageBrief(b: BriefInput): { text: string; html: string } {
  const t = b.time ?? ((ms: number) => new Date(ms).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }));
  const m = b.metrics;
  const hours = `${Math.floor(m.hours)} h ${Math.round((m.hours % 1) * 60)} min`;
  const st = stretches(b.points, b.wave);
  const plan = sailPlan(b.points, b.sails);
  const exposure = exposureLine(b.shelter);
  const head = [
    `PASSAGE BRIEF: ${b.title}`,
    b.boatName ? `Boat: ${b.boatName}` : null,
    `From ${formatDmm(b.start.lat, b.start.lng)}`,
    `To   ${formatDmm(b.finish.lat, b.finish.lng)}`,
    `Depart ${t(b.departAt)} · ETA ${t(b.arriveAt)} · ${m.distanceNm.toFixed(0)} nm · ${hours}`,
    `Max wind ${Math.round(m.maxWindKn)} kn, gusts ${Math.round(m.maxGustKn)} kn, seas ${(b.wave ?? ((x: number) => `${x.toFixed(1)} m`))(m.maxWaveM)}`,
    m.motorHours >= 0.5 ? `Motoring about ${Math.round(m.motorHours)} h` : null,
  ].filter(Boolean) as string[];
  const hazards = [
    ...b.warnings,
    m.arrivesInDark ? "Arrives in the dark." : null,
    exposure ? `Anchorage: ${exposure}` : null,
  ].filter(Boolean) as string[];
  const footer = `Forecast ${t(b.forecastAt)} (${b.models.join(", ").toUpperCase()}). Planning aid only: check the official forecast and warnings before leaving, and keep a proper lookout. Reefs are not in the routing data.`;

  const text = [
    ...head,
    "",
    "CONDITIONS",
    ...st.map(
      (s) =>
        `${t(s.from)}: ${s.wind}, sea ${s.sea}, ${s.sailing}, current ${s.current}${s.flags.length ? ` [${s.flags.join(", ")}]` : ""}`,
    ),
    "",
    "SAILS",
    ...(plan.changes.length ? plan.changes.map((c) => `${t(c.at)}: ${c.text}`) : ["No changes."]),
    "",
    "HAZARDS",
    ...(hazards.length ? hazards.map((h) => `- ${h}`) : ["None flagged."]),
    "",
    "POSITIONS (every ~3 h)",
    ...st.map((s) => `${t(s.from)}  ${formatDmm(s.at.lat, s.at.lng)}`),
    `${t(b.arriveAt)}  ${formatDmm(b.finish.lat, b.finish.lng)} (finish)`,
    "",
    footer,
  ].join("\n");

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows = st
    .map(
      (s) =>
        `<tr><td>${esc(t(s.from))}</td><td>${esc(s.wind)}</td><td>${esc(s.sea)}</td><td>${esc(s.sailing)}</td><td>${esc(s.current)}</td><td>${esc(s.flags.join(", "))}</td><td class="pos">${esc(formatDmm(s.at.lat, s.at.lng))}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(b.title)}</title>
<style>body{font:14px/1.45 system-ui,sans-serif;margin:16px;color:#111;max-width:900px}h1{font-size:20px;margin:0 0 6px}h2{font-size:14px;text-transform:uppercase;letter-spacing:.08em;margin:18px 0 6px;color:#444}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left;vertical-align:top}.pos{font-variant-numeric:tabular-nums;white-space:nowrap}ul{padding-left:18px;margin:0}.muted{color:#666;font-size:12px}
@media print{body{margin:0}}</style></head><body>
<h1>${esc(b.title)}</h1>
<p>${head.slice(1).map(esc).join("<br>")}</p>
<h2>Conditions</h2><table><tr><th>From</th><th>Wind</th><th>Sea</th><th>Sailing</th><th>Current</th><th>Flags</th><th>Position</th></tr>${rows}</table>
<h2>Sails</h2><ul>${plan.changes.length ? plan.changes.map((c) => `<li>${esc(t(c.at))}: ${esc(c.text)}</li>`).join("") : "<li>No changes.</li>"}</ul>
<h2>Hazards</h2><ul>${hazards.length ? hazards.map((h) => `<li>${esc(h)}</li>`).join("") : "<li>None flagged.</li>"}</ul>
<p class="muted">${esc(footer)}</p></body></html>`;
  return { text, html };
}
